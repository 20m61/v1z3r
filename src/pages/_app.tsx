import '@/styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  // フォントを事前読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // フォントの事前読み込み
      const fontFamilies = ['Teko', 'Prompt', 'Audiowide', 'Russo One', 'Orbitron'];
      fontFamilies.forEach(fontFamily => {
        const font = new FontFace(fontFamily, `url(https://fonts.gstatic.com/s/${fontFamily.toLowerCase().replace(' ', '')}/v1/regular.woff2)`);
        
        // フォントの読み込みを試行（エラーは無視）
        font.load().then(() => {
          document.fonts.add(font);
        }).catch(err => {
          console.warn(`Failed to preload font: ${fontFamily}`, err);
        });
      });
    }
  }, []);

  return (
    <>
      <Head>
        {/* フォントをプリロード */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Teko:wght@300;400;500;600;700&family=Prompt:wght@200;300;400;500;600;700&family=Audiowide&family=Russo+One&family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
