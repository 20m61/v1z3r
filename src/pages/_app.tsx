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
