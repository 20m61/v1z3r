/**
 * パフォーマンス計測とモニタリングのためのユーティリティ
 * 
 * このモジュールは、アプリケーションのパフォーマンスを監視し、
 * 重要なメトリクスをログに記録するための機能を提供します。
 */

// 開発モードでのみ有効なデバッグフラグ
const DEBUG = process.env.NODE_ENV === 'development';

// FPSカウンターのインターバル (ミリ秒)
const FPS_INTERVAL = 1000;

// パフォーマンスメトリクスを保存するオブジェクト
interface PerformanceMetrics {
  fps: number;
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
  audioLatency?: number;
  renderTime?: number;
  lastTimestamp: number;
  frameCount: number;
}

// 拡張されたWindow型
interface ExtendedWindow extends Window {
  performance: Performance & {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };
}

// グローバルなパフォーマンスメトリクス
const metrics: PerformanceMetrics = {
  fps: 0,
  lastTimestamp: 0,
  frameCount: 0,
};

/**
 * FPSの計測を開始
 */
export const startPerformanceMonitoring = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  
  metrics.lastTimestamp = performance.now();
  metrics.frameCount = 0;
  
  let animationFrameId: number;
  let lastFpsUpdateTime = performance.now();
  
  // FPS計測のメインループ
  const updateFps = () => {
    metrics.frameCount++;
    const now = performance.now();
    
    // FPSの更新（1秒ごと）
    if (now - lastFpsUpdateTime > FPS_INTERVAL) {
      metrics.fps = Math.round((metrics.frameCount * 1000) / (now - lastFpsUpdateTime));
      
      // メモリ使用量の計測（Chromeのみ対応）
      if ((window as ExtendedWindow).performance.memory) {
        metrics.memory = (window as ExtendedWindow).performance.memory;
      }
      
      // デバッグモードでログ出力
      if (DEBUG) {
        console.log(`Performance: ${metrics.fps} FPS`);
        if (metrics.memory) {
          const memoryUsage = Math.round(metrics.memory.usedJSHeapSize / 1024 / 1024);
          console.log(`Memory usage: ${memoryUsage} MB`);
        }
      }
      
      // カウンターリセット
      lastFpsUpdateTime = now;
      metrics.frameCount = 0;
    }
    
    animationFrameId = requestAnimationFrame(updateFps);
  };
  
  // モニタリング開始
  animationFrameId = requestAnimationFrame(updateFps);
  
  // クリーンアップ関数を返す
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
};

/**
 * パフォーマンス計測の開始（特定の処理の実行時間を測定）
 */
export const startMeasure = (label: string): void => {
  if (typeof window === 'undefined' || !DEBUG) return;
  performance.mark(`${label}-start`);
};

/**
 * パフォーマンス計測の終了と結果のログ出力
 */
export const endMeasure = (label: string): number | undefined => {
  if (typeof window === 'undefined' || !DEBUG) return;
  
  performance.mark(`${label}-end`);
  performance.measure(label, `${label}-start`, `${label}-end`);
  
  const measures = performance.getEntriesByName(label, 'measure');
  const duration = measures.length > 0 ? measures[0].duration : 0;
  
  console.log(`${label}: ${duration.toFixed(2)}ms`);
  
  // 測定結果をクリア
  performance.clearMarks(`${label}-start`);
  performance.clearMarks(`${label}-end`);
  performance.clearMeasures(label);
  
  return duration;
};

/**
 * 現在のFPSを取得
 */
export const getCurrentFps = (): number => {
  return metrics.fps;
};

/**
 * 現在のメモリ使用量を取得（MB単位、Chromeのみ対応）
 */
export const getCurrentMemoryUsage = (): number | undefined => {
  if (typeof window === 'undefined' || !metrics.memory) return undefined;
  return Math.round(metrics.memory.usedJSHeapSize / 1024 / 1024);
};

/**
 * 処理を実行し、かかった時間を計測してログ出力
 */
export const measureExecutionTime = <T>(
  fn: () => T,
  label: string
): T => {
  if (typeof window === 'undefined' || !DEBUG) return fn();
  
  startMeasure(label);
  const result = fn();
  endMeasure(label);
  
  return result;
};

/**
 * 非同期処理の実行時間を計測
 */
export const measureAsyncExecutionTime = async <T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> => {
  if (typeof window === 'undefined' || !DEBUG) return fn();
  
  startMeasure(label);
  const result = await fn();
  endMeasure(label);
  
  return result;
};

// 高負荷な処理のデバウンス処理
let debounceTimer: ReturnType<typeof setTimeout>;
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  return (...args: Parameters<T>) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
};

// スロットリング（一定時間ごとに1回だけ実行）
let throttleLastTime = 0;
export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - throttleLastTime >= limit) {
      fn(...args);
      throttleLastTime = now;
    }
  };
};
