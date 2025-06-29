import '@/styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { errorHandler } from '@/utils/errorHandler';

export default function App({ Component, pageProps }: AppProps) {
  // アプリケーション初期化とエラーハンドリング
  useEffect(() => {
    // エラーハンドラの初期化ログ
    errorHandler.info('VJ Application started', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    })

    // PWA Service Worker登録
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          errorHandler.info('Service Worker registered successfully', {
            scope: registration.scope,
            hasUpdate: !!registration.installing
          });

          // Service Worker更新チェック
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 新しいService Workerが利用可能
                  errorHandler.info('New Service Worker available - refresh recommended');
                  
                  // オプション: ユーザーにリロードを促す通知
                  if (window.confirm('アプリの新しいバージョンが利用可能です。今すぐ更新しますか？')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          errorHandler.warn('Service Worker registration failed', error);
        });

      // PWAインストールプロンプト
      let deferredPrompt: any;
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

    if (typeof window !== 'undefined') {
      // フォントの事前読み込み
      const fontFamilies = ['Teko', 'Prompt', 'Audiowide', 'Russo One', 'Orbitron'];
      fontFamilies.forEach(fontFamily => {
        // FontFace APIを使用したロードは限定的なブラウザでしか動作しないため、
        // エラーハンドリングを含め、またフォールバックとしてlinkタグによるロードも行う
        try {
          // @ts-ignore - FontFace APIのサポートを確認
          if (window.FontFace) {
            const font = new FontFace(fontFamily, `url(https://fonts.gstatic.com/s/${fontFamily.toLowerCase().replace(' ', '')}/v1/regular.woff2)`);
            font.load().then(() => {
              document.fonts.add(font);
            }).catch(err => {
              errorHandler.warn(`Failed to preload font: ${fontFamily}`, err, { fontFamily });
            });
          }
        } catch (e) {
          errorHandler.warn('FontFace API not supported', e instanceof Error ? e : new Error(String(e)));
        }
      });
    }

    // アプリケーション終了時のクリーンアップ
    return () => {
      errorHandler.info('VJ Application cleanup', {
        stats: errorHandler.getStats()
      })
    }
  }, []);

  return <Component {...pageProps} />;
}
