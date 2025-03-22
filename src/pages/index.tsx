import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  // クライアントサイドレンダリングの確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      <Head>
        <title>v1z3r - インタラクティブ音響視覚化エンジン</title>
        <meta name="description" content="DJイベントやバンド演奏向けの自動映像生成システム" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="flex flex-col min-h-screen bg-black text-white">
        {/* ヘッダー */}
        <header className="p-4 flex justify-between items-center border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-bold">v1z3r</h1>
            <p className="text-gray-400 text-sm">インタラクティブ音響視覚化エンジン</p>
          </div>
        </header>

        {/* ビジュアライザーエリア */}
        <div className="flex-1 w-full relative overflow-hidden bg-gray-900 flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">開発中</h2>
            <p className="text-gray-300">
              音楽に合わせたインタラクティブな視覚エフェクトを生成します。<br />
              現在開発中です。
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
