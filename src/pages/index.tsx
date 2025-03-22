import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualizerStore } from '@/store/visualizerStore';
import ControlPanel from '@/components/ControlPanel';
import AudioAnalyzer from '@/components/AudioAnalyzer';
import VisualEffects from '@/components/VisualEffects';
import LyricsVisualizer from '@/components/LyricsVisualizer';
import dynamic from 'next/dynamic';

// SpeechRecognizerはクライアントサイドのみで動作するため、dynamicインポートする
const SpeechRecognizer = dynamic(
  () => import('@/components/SpeechRecognizer'),
  { ssr: false }
);

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | undefined>();
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false);
  const visualizerRef = useRef<HTMLDivElement>(null);
  
  // Zustand ストアからステートと関数を取得
  const {
    currentEffectType,
    colorTheme,
    sensitivity,
    isAudioAnalyzing,
    isMicrophoneEnabled,
    isFullscreen,
    isLyricsEnabled,
    layers,
    setAudioAnalyzing
  } = useVisualizerStore();

  // クライアントサイドレンダリングの確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  // オーディオデータの処理
  const handleAudioData = (data: Uint8Array) => {
    setAudioData(new Uint8Array(data));
    if (!isAudioAnalyzing) {
      setAudioAnalyzing(true);
    }
  };

  // 解析の開始/停止を処理
  const handleStartAnalysis = () => {
    setIsAnalysisStarted(true);
  };

  // 全画面表示の処理
  useEffect(() => {
    // サーバーサイドレンダリング対策
    if (typeof window === 'undefined') return;
    
    const handleFullscreenChange = () => {
      // 将来的に実装: Fullscreen API の状態変更監視
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ソート済みレイヤー（zIndexの降順）
  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);
  
  // アクティブなレイヤーのみをフィルタリング
  const activeLayersForRender = sortedLayers.filter(layer => layer.active);

  // サーバーサイドレンダリング時の初期表示
  if (!isClient) {
    return (
      <>
        <Head>
          <title>v1z3r - インタラクティブ音響視覚化エンジン</title>
          <meta name="description" content="DJイベントやバンド演奏向けの自動映像生成システム" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className="flex flex-col min-h-screen bg-v1z3r-dark text-white">
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-v1z3r-primary">v1z3r</h1>
              <p>読み込み中...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>v1z3r - インタラクティブ音響視覚化エンジン</title>
        <meta name="description" content="DJイベントやバンド演奏向けの自動映像生成システム" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="flex flex-col min-h-screen bg-v1z3r-dark text-white">
        {/* ヘッダー */}
        <header className="p-4 flex justify-between items-center border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-v1z3r-secondary to-v1z3r-primary bg-clip-text text-transparent">
              v1z3r
            </h1>
            <p className="text-gray-400 text-sm">インタラクティブ音響視覚化エンジン</p>
          </div>
          
          {!isAnalysisStarted && (
            <motion.button
              onClick={handleStartAnalysis}
              className="px-6 py-2 bg-gradient-to-r from-v1z3r-secondary to-v1z3r-primary text-white font-bold rounded-full transition-transform hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              開始
            </motion.button>
          )}
        </header>

        {/* ビジュアライザーエリア */}
        <div
          ref={visualizerRef}
          className="flex-1 w-full relative overflow-hidden bg-v1z3r-darker"
        >
          {/* ビジュアルエフェクトレイヤー */}
          <AnimatePresence>
            {activeLayersForRender.map((layer) => (
              <motion.div
                key={layer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: layer.opacity }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <VisualEffects
                  audioData={audioData}
                  effectType={layer.type}
                  colorTheme={layer.colorTheme}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 歌詞ビジュアライザー */}
          {isLyricsEnabled && (
            <LyricsVisualizer audioData={audioData} />
          )}

          {/* 音声認識（バックグラウンドで動作） */}
          {isLyricsEnabled && isAnalysisStarted && (
            <SpeechRecognizer 
              lang="ja-JP"
              continuous={true}
              autoStart={true}
              interimResults={true}
              maxAlternatives={3}
              noiseFilter={true}
              minConfidence={0.3}
            />
          )}

          {/* オーディオアナライザー（非表示） */}
          {isAnalysisStarted && (
            <div className="hidden">
              <AudioAnalyzer onAudioData={handleAudioData} />
            </div>
          )}

          {/* スタートプレースホルダー */}
          <AnimatePresence>
            {!isAnalysisStarted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <div
                  className="bg-v1z3r-darker p-6 rounded-lg border border-gray-800 text-center max-w-md"
                >
                  <h2 className="text-2xl font-bold mb-4">v1z3rへようこそ</h2>
                  <p className="text-gray-300 mb-6">
                    音楽に合わせたインタラクティブな視覚エフェクトを生成します。
                    「開始」ボタンをクリックしてマイクへのアクセスを許可してください。
                  </p>
                  <button
                    onClick={handleStartAnalysis}
                    className="px-8 py-3 bg-gradient-to-r from-v1z3r-secondary to-v1z3r-primary text-white font-bold rounded-full transition-transform hover:scale-105"
                  >
                    開始
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* コントロールパネル */}
        {isAnalysisStarted && (
          <ControlPanel />
        )}
      </main>
    </>
  );
}
