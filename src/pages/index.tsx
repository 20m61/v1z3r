import Head from 'next/head';
import { useEffect, useState } from 'react';
import styles from '@/styles/Home.module.css';

export default function Home() {
  const [isClient, setIsClient] = useState(false);

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
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>v1z3r</h1>
          <p className={styles.description}>インタラクティブ音響視覚化エンジン</p>
        </div>

        <div className={styles.visualizer}>
          {isClient && (
            <div className={styles.placeholder}>
              <p>ビジュアライザーがここに表示されます</p>
              <button className={styles.startButton}>開始</button>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.controlPanel}>
            <h2>コントロールパネル</h2>
            <div className={styles.controlGroup}>
              <label>視覚効果</label>
              <select>
                <option>波形</option>
                <option>パーティクル</option>
                <option>スペクトラム</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label>カラーテーマ</label>
              <div className={styles.colorButtons}>
                <button style={{ backgroundColor: '#ff5555' }}></button>
                <button style={{ backgroundColor: '#55ff55' }}></button>
                <button style={{ backgroundColor: '#5555ff' }}></button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
