import '@/styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { errorHandler } from '@/utils/errorHandler';
import { registerServiceWorker } from '@/utils/swRegistration';
import { rum } from '@/utils/realUserMonitoring';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  // アプリケーション初期化とエラーハンドリング
  useEffect(() => {
    // エラーハンドラの初期化ログ
    errorHandler.info('VJ Application started', {
      timestamp: new Date().toISOString(),
      environment: typeof process !== 'undefined' ? process.env?.NODE_ENV : 'production',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    })
    
    // Global error handler for debugging
    if (typeof window !== 'undefined') {
      window.onerror = (message, source, lineno, colno, error) => {
        console.error('Global error caught:', { message, source, lineno, colno, error });
        errorHandler.error('Global window error', error || new Error(String(message)), {
          source,
          lineno,
          colno
        });
        return true;
      };
      
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        errorHandler.error('Unhandled promise rejection', 
          event.reason instanceof Error ? event.reason : new Error(String(event.reason))
        );
      });
    }

    // Enhanced Service Worker登録（本番環境のみ）
    if (typeof process === 'undefined' || process.env?.NODE_ENV === 'production') {
      registerServiceWorker()
        .then(() => {
          errorHandler.info('Enhanced Service Worker registered successfully');
          // Track service worker cache hit
          rum.trackCustomMetric('serviceWorkerCacheHit', 1);
        })
        .catch((error) => {
          errorHandler.warn('Enhanced Service Worker registration failed', error);
        });
    }

    // Real User Monitoring setup
    if (process.env.NODE_ENV === 'production') {
      // Track audio initialization time
      const audioStartTime = performance.now();
      setTimeout(() => {
        const audioEndTime = performance.now();
        rum.trackCustomMetric('audioInitTime', audioEndTime - audioStartTime);
      }, 100);
    }

    // PWAインストールプロンプト
    let deferredPrompt: any;
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        errorHandler.info('PWA install prompt available');
        
        // カスタムインストールボタンを表示するロジックを追加可能
        // 例: showInstallButton();
      });

      // PWAインストール完了通知
      window.addEventListener('appinstalled', () => {
        errorHandler.info('PWA installed successfully');
        deferredPrompt = null;
      });
    }

    // フォント読み込みは _document.tsx で行うため、ここでは削除
    // フォントは Google Fonts CDN から直接読み込まれる

    // アプリケーション終了時のクリーンアップ
    return () => {
      errorHandler.info('VJ Application cleanup', {
        stats: errorHandler.getStats()
      })
    }
  }, []);

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
