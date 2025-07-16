/**
 * AI Audio Analysis System for v1z3r
 * Real-time music analysis and intelligent visual mapping
 */

import React from 'react';

export interface AudioAnalysis {
  genre: MusicGenre;
  bpm: number;
  key: MusicalKey;
  mood: EmotionalState;
  instruments: InstrumentType[];
  energy: number; // 0-1
  tempo: TempoType;
  dynamics: number; // 0-1
  timestamp: number;
}

export interface SmartVisualMapping {
  audioFeatures: AudioAnalysis;
  visualResponse: VisualParameters;
  confidence: number;
}

export interface VisualParameters {
  color: {
    hue: number;
    saturation: number;
    brightness: number;
    palette: string[];
  };
  animation: {
    speed: number;
    intensity: number;
    pattern: string;
  };
  effects: {
    type: string;
    strength: number;
    parameters: Record<string, any>;
  };
}

export type MusicGenre = 
  | 'electronic' | 'house' | 'techno' | 'trance' | 'dubstep'
  | 'rock' | 'pop' | 'jazz' | 'classical' | 'ambient'
  | 'hip-hop' | 'drum-and-bass' | 'trap' | 'experimental'
  | 'unknown';

export type MusicalKey = 
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'
  | 'Cm' | 'C#m' | 'Dm' | 'D#m' | 'Em' | 'Fm' | 'F#m' | 'Gm' | 'G#m' | 'Am' | 'A#m' | 'Bm'
  | 'unknown';

export type EmotionalState = 
  | 'energetic' | 'calm' | 'happy' | 'melancholic' | 'aggressive'
  | 'peaceful' | 'mysterious' | 'epic' | 'romantic' | 'dark'
  | 'uplifting' | 'nostalgic';

export type InstrumentType = 
  | 'kick' | 'snare' | 'hihat' | 'bass' | 'lead' | 'pad'
  | 'piano' | 'guitar' | 'violin' | 'vocal' | 'brass' | 'strings';

export type TempoType = 'slow' | 'medium' | 'fast' | 'very-fast';

export interface BPMDetectionResult {
  bpm: number;
  confidence: number;
  beats: number[];
  tempo: TempoType;
}

export interface SpectralFeatures {
  centroid: number;
  rolloff: number;
  flux: number;
  mfcc: number[];
  chroma: number[];
  tonnetz: number[];
}

export class AIAudioAnalysis {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  
  // FFT分析用バッファ
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private frequencyBinCount = 0;
  
  // BPM検出用
  private bpmBuffer: number[] = [];
  private lastBeatTime = 0;
  private bpmHistory: number[] = [];
  
  // 特徴量抽出用
  private spectralHistory: SpectralFeatures[] = [];
  private analysisCallback?: (analysis: AudioAnalysis) => void;
  private isAnalyzing = false;
  
  // ジャンル分類モデル（簡易版）
  private genreClassifier: GenreClassifier;
  
  // 楽器検出
  private instrumentDetector: InstrumentDetector;
  
  // 感情分析
  private emotionAnalyzer: EmotionAnalyzer;
  
  constructor() {
    this.genreClassifier = new GenreClassifier();
    this.instrumentDetector = new InstrumentDetector();
    this.emotionAnalyzer = new EmotionAnalyzer();
  }
  
  /**
   * オーディオ分析を初期化
   */
  async initialize(audioStream?: MediaStream): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      
      if (audioStream) {
        // 外部音声ストリーム使用
        this.source = this.audioContext.createMediaStreamSource(audioStream);
      } else {
        // マイクからの入力
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          } 
        });
        this.source = this.audioContext.createMediaStreamSource(stream);
      }
      
      // アナライザーノード設定
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;
      
      this.frequencyBinCount = this.analyserNode.frequencyBinCount;
      this.frequencyData = new Uint8Array(this.frequencyBinCount);
      this.timeData = new Uint8Array(this.frequencyBinCount);
      
      // ゲインノード（音量調整）
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      
      // ノード接続
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      
      console.log('[AIAudio] Audio analysis initialized');
      
    } catch (error) {
      console.error('[AIAudio] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * リアルタイム分析を開始
   */
  startAnalysis(): void {
    if (!this.analyserNode || this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    this.analyzeAudio();
  }
  
  /**
   * 分析を停止
   */
  stopAnalysis(): void {
    this.isAnalyzing = false;
  }
  
  /**
   * メイン分析ループ
   */
  private analyzeAudio(): void {
    if (!this.isAnalyzing || !this.analyserNode) return;
    
    // FFTデータ取得
    this.analyserNode.getByteFrequencyData(this.frequencyData!);
    this.analyserNode.getByteTimeDomainData(this.timeData!);
    
    // 音声分析実行
    const analysis = this.performAudioAnalysis();
    
    if (this.analysisCallback) {
      this.analysisCallback(analysis);
    }
    
    // 次のフレームをスケジュール
    requestAnimationFrame(() => this.analyzeAudio());
  }
  
  /**
   * 包括的音声分析
   */
  private performAudioAnalysis(): AudioAnalysis {
    const spectralFeatures = this.extractSpectralFeatures();
    const bpmResult = this.detectBPM();
    const genre = this.genreClassifier.classify(spectralFeatures, bpmResult);
    const instruments = this.instrumentDetector.detect(spectralFeatures);
    const mood = this.emotionAnalyzer.analyze(spectralFeatures, bpmResult);
    const key = this.detectMusicalKey(spectralFeatures);
    const energy = this.calculateEnergy();
    
    return {
      genre,
      bpm: bpmResult.bpm,
      key,
      mood,
      instruments,
      energy,
      tempo: bpmResult.tempo,
      dynamics: this.calculateDynamics(),
      timestamp: Date.now(),
    };
  }
  
  /**
   * スペクトル特徴量抽出
   */
  private extractSpectralFeatures(): SpectralFeatures {
    if (!this.frequencyData) {
      return this.getEmptySpectralFeatures();
    }
    
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const freqArray = Array.from(this.frequencyData);
    
    // スペクトル重心（明度）
    const centroid = this.calculateSpectralCentroid(freqArray, sampleRate);
    
    // スペクトルロールオフ（高周波成分）
    const rolloff = this.calculateSpectralRolloff(freqArray, sampleRate);
    
    // スペクトルフラックス（変化量）
    const flux = this.calculateSpectralFlux(freqArray);
    
    // MFCC（メル周波数ケプストラム係数）
    const mfcc = this.calculateMFCC(freqArray);
    
    // クロマ特徴量（ピッチクラス）
    const chroma = this.calculateChroma(freqArray, sampleRate);
    
    // トーネッツ（調性空間）
    const tonnetz = this.calculateTonnetz(chroma);
    
    const features = {
      centroid,
      rolloff,
      flux,
      mfcc,
      chroma,
      tonnetz,
    };
    
    // 履歴保存（最大100フレーム）
    this.spectralHistory.push(features);
    if (this.spectralHistory.length > 100) {
      this.spectralHistory.shift();
    }
    
    return features;
  }
  
  /**
   * BPM検出
   */
  private detectBPM(): BPMDetectionResult {
    if (!this.timeData) {
      return { bpm: 120, confidence: 0, beats: [], tempo: 'medium' };
    }
    
    // オンセット検出（ビート検出）
    const onset = this.detectOnset();
    const currentTime = Date.now();
    
    if (onset && currentTime - this.lastBeatTime > 200) { // 最小間隔200ms
      const interval = currentTime - this.lastBeatTime;
      if (this.lastBeatTime > 0) {
        this.bpmBuffer.push(60000 / interval); // BPMに変換
      }
      this.lastBeatTime = currentTime;
      
      // バッファサイズ制限
      if (this.bpmBuffer.length > 16) {
        this.bpmBuffer.shift();
      }
    }
    
    // BPM計算（中央値使用）
    let bpm = 120; // デフォルト
    let confidence = 0;
    
    if (this.bpmBuffer.length >= 4) {
      const sortedBPMs = [...this.bpmBuffer].sort((a, b) => a - b);
      bpm = sortedBPMs[Math.floor(sortedBPMs.length / 2)];
      
      // 信頼度計算（分散の逆数）
      const mean = this.bpmBuffer.reduce((a, b) => a + b) / this.bpmBuffer.length;
      const variance = this.bpmBuffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.bpmBuffer.length;
      confidence = Math.max(0, 1 - variance / 1000);
    }
    
    // テンポ分類
    let tempo: TempoType = 'medium';
    if (bpm < 80) tempo = 'slow';
    else if (bpm < 120) tempo = 'medium';
    else if (bpm < 160) tempo = 'fast';
    else tempo = 'very-fast';
    
    return {
      bpm,
      confidence,
      beats: [...this.bpmBuffer],
      tempo,
    };
  }
  
  /**
   * オンセット検出
   */
  private detectOnset(): boolean {
    if (!this.frequencyData) return false;
    
    // スペクトルフラックスによるオンセット検出
    const flux = this.calculateSpectralFlux(Array.from(this.frequencyData));
    
    // 動的閾値（過去の平均 + 標準偏差）
    const recentFlux = this.spectralHistory.slice(-10).map(f => f.flux);
    if (recentFlux.length < 3) return false;
    
    const mean = recentFlux.reduce((a, b) => a + b) / recentFlux.length;
    const std = Math.sqrt(recentFlux.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentFlux.length);
    const threshold = mean + 1.5 * std;
    
    return flux > threshold;
  }
  
  /**
   * 楽器音階検出
   */
  private detectMusicalKey(features: SpectralFeatures): MusicalKey {
    // クロマ特徴量からキー推定
    const chromaProfile = features.chroma;
    if (chromaProfile.length !== 12) return 'unknown';
    
    // 各キーのプロファイルとの相関計算
    const keyProfiles = this.getKeyProfiles();
    let bestKey: MusicalKey = 'unknown';
    let bestCorrelation = -1;
    
    for (const [key, profile] of Object.entries(keyProfiles)) {
      const correlation = this.calculateCorrelation(chromaProfile, profile);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestKey = key as MusicalKey;
      }
    }
    
    return bestCorrelation > 0.6 ? bestKey : 'unknown';
  }
  
  /**
   * エネルギー計算
   */
  private calculateEnergy(): number {
    if (!this.frequencyData) return 0;
    
    const sum = Array.from(this.frequencyData).reduce((a, b) => a + b * b, 0);
    return Math.min(1, sum / (this.frequencyData.length * 255 * 255));
  }
  
  /**
   * ダイナミクス計算
   */
  private calculateDynamics(): number {
    if (!this.timeData) return 0;
    
    // RMS（Root Mean Square）計算
    const rms = Math.sqrt(
      Array.from(this.timeData)
        .map(x => Math.pow((x - 128) / 128, 2))
        .reduce((a, b) => a + b) / this.timeData.length
    );
    
    return Math.min(1, rms * 2);
  }
  
  // 以下、ヘルパーメソッド群
  
  private calculateSpectralCentroid(spectrum: number[], sampleRate: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }
  
  private calculateSpectralRolloff(spectrum: number[], sampleRate: number, threshold = 0.85): number {
    const totalMagnitude = spectrum.reduce((a, b) => a + b);
    const targetMagnitude = totalMagnitude * threshold;
    
    let accumulator = 0;
    for (let i = 0; i < spectrum.length; i++) {
      accumulator += spectrum[i];
      if (accumulator >= targetMagnitude) {
        return (i * sampleRate) / (2 * spectrum.length);
      }
    }
    
    return sampleRate / 2;
  }
  
  private calculateSpectralFlux(spectrum: number[]): number {
    if (this.spectralHistory.length === 0) return 0;
    
    const prevSpectrum = this.spectralHistory[this.spectralHistory.length - 1];
    if (!prevSpectrum) return 0;
    
    // 前フレームとの差分の二乗和
    let flux = 0;
    for (let i = 0; i < Math.min(spectrum.length, 512); i++) {
      const diff = spectrum[i] - (prevSpectrum.mfcc[i] || 0);
      flux += Math.max(0, diff * diff);
    }
    
    return flux / spectrum.length;
  }
  
  private calculateMFCC(spectrum: number[]): number[] {
    // 簡略化されたMFCC実装
    const melFilters = this.createMelFilterBank(spectrum.length);
    const mfcc: number[] = [];
    
    for (let i = 0; i < 13; i++) {
      let coefficient = 0;
      for (let j = 0; j < spectrum.length; j++) {
        coefficient += spectrum[j] * melFilters[i][j];
      }
      mfcc.push(Math.log(Math.max(1, coefficient)));
    }
    
    return mfcc;
  }
  
  private calculateChroma(spectrum: number[], sampleRate: number): number[] {
    const chroma = new Array(12).fill(0);
    
    for (let i = 1; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      if (frequency < 80 || frequency > 5000) continue;
      
      // 周波数をピッチクラスにマッピング
      const pitchClass = Math.round(12 * Math.log2(frequency / 440)) % 12;
      const normalizedPitchClass = (pitchClass + 12) % 12;
      
      chroma[normalizedPitchClass] += spectrum[i];
    }
    
    // 正規化
    const sum = chroma.reduce((a, b) => a + b);
    return sum > 0 ? chroma.map(x => x / sum) : chroma;
  }
  
  private calculateTonnetz(chroma: number[]): number[] {
    // トーネッツ座標計算（簡略版）
    const tonnetz: number[] = [];
    
    // 5度円
    let fifth_x = 0, fifth_y = 0;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6; // 30度ずつ
      fifth_x += chroma[i] * Math.cos(angle);
      fifth_y += chroma[i] * Math.sin(angle);
    }
    tonnetz.push(fifth_x, fifth_y);
    
    // 短3度円
    let minor_x = 0, minor_y = 0;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 2; // 45度ずつ
      minor_x += chroma[i] * Math.cos(angle);
      minor_y += chroma[i] * Math.sin(angle);
    }
    tonnetz.push(minor_x, minor_y);
    
    // 長3度円
    let major_x = 0, major_y = 0;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 3; // 60度ずつ
      major_x += chroma[i] * Math.cos(angle);
      major_y += chroma[i] * Math.sin(angle);
    }
    tonnetz.push(major_x, major_y);
    
    return tonnetz;
  }
  
  private createMelFilterBank(spectrumLength: number): number[][] {
    const numFilters = 13;
    const melFilters: number[][] = [];
    
    for (let i = 0; i < numFilters; i++) {
      const filter = new Array(spectrumLength).fill(0);
      
      // 三角フィルタ作成（簡略版）
      const centerBin = Math.floor((i + 1) * spectrumLength / (numFilters + 1));
      const startBin = Math.max(0, centerBin - 20);
      const endBin = Math.min(spectrumLength - 1, centerBin + 20);
      
      for (let j = startBin; j <= endBin; j++) {
        if (j <= centerBin) {
          filter[j] = (j - startBin) / (centerBin - startBin);
        } else {
          filter[j] = (endBin - j) / (endBin - centerBin);
        }
      }
      
      melFilters.push(filter);
    }
    
    return melFilters;
  }
  
  private getKeyProfiles(): Record<string, number[]> {
    // Krumhansl-Schmuckler key profiles (simplified)
    return {
      'C': [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
      'G': [2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29],
      'D': [2.29, 2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66],
      'A': [3.66, 2.29, 2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39],
      'E': [2.39, 3.66, 2.29, 2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19],
      'B': [5.19, 2.39, 3.66, 2.29, 2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52],
      'Am': [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
      'Em': [3.17, 6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34],
      // ... 他のキーも追加可能
    };
  }
  
  private calculateCorrelation(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const meanA = a.reduce((sum, val) => sum + val) / a.length;
    const meanB = b.reduce((sum, val) => sum + val) / b.length;
    
    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const devA = a[i] - meanA;
      const devB = b[i] - meanB;
      numerator += devA * devB;
      denomA += devA * devA;
      denomB += devB * devB;
    }
    
    const denominator = Math.sqrt(denomA * denomB);
    return denominator > 0 ? numerator / denominator : 0;
  }
  
  private getEmptySpectralFeatures(): SpectralFeatures {
    return {
      centroid: 0,
      rolloff: 0,
      flux: 0,
      mfcc: new Array(13).fill(0),
      chroma: new Array(12).fill(0),
      tonnetz: new Array(6).fill(0),
    };
  }
  
  /**
   * 分析コールバック設定
   */
  public onAnalysis(callback: (analysis: AudioAnalysis) => void): void {
    this.analysisCallback = callback;
  }
  
  /**
   * リソース解放
   */
  public dispose(): void {
    this.stopAnalysis();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.source = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.frequencyData = null;
    this.timeData = null;
    this.analysisCallback = undefined;
  }
}

// 補助クラス群

class GenreClassifier {
  classify(features: SpectralFeatures, bpm: BPMDetectionResult): MusicGenre {
    // 簡易ジャンル分類ロジック
    const { centroid, rolloff, mfcc } = features;
    const bpmValue = bpm.bpm;
    
    // ルールベース分類
    if (bpmValue >= 128 && bpmValue <= 140 && centroid > 2000) {
      return 'house';
    } else if (bpmValue >= 140 && bpmValue <= 150) {
      return 'techno';
    } else if (bpmValue >= 130 && bpmValue <= 138 && rolloff > 8000) {
      return 'trance';
    } else if (bpmValue >= 70 && bpmValue <= 75 && mfcc[1] < -5) {
      return 'dubstep';
    } else if (bpmValue >= 160 && bpmValue <= 180) {
      return 'drum-and-bass';
    } else if (bpmValue < 100 && centroid < 1500) {
      return 'ambient';
    } else if (bpmValue >= 80 && bpmValue <= 120) {
      return 'pop';
    }
    
    return 'electronic';
  }
}

class InstrumentDetector {
  detect(features: SpectralFeatures): InstrumentType[] {
    const instruments: InstrumentType[] = [];
    const { centroid, rolloff, mfcc } = features;
    
    // 低音域の強いエネルギー → キック・ベース
    if (mfcc[1] < -3) {
      instruments.push('kick', 'bass');
    }
    
    // 高音域の鋭いピーク → ハイハット・スネア
    if (rolloff > 8000 && centroid > 3000) {
      instruments.push('hihat');
    }
    
    if (mfcc[3] > 0 && centroid > 1500 && centroid < 3000) {
      instruments.push('snare');
    }
    
    // 中音域の持続音 → パッド・リード
    if (mfcc[2] > -1 && centroid > 800 && centroid < 2500) {
      instruments.push('pad');
    }
    
    if (mfcc[4] > 0 && centroid > 2000) {
      instruments.push('lead');
    }
    
    return instruments;
  }
}

class EmotionAnalyzer {
  analyze(features: SpectralFeatures, bpm: BPMDetectionResult): EmotionalState {
    const { centroid, mfcc, tonnetz } = features;
    const bpmValue = bpm.bpm;
    const energy = bpm.confidence;
    
    // ルールベース感情分析
    if (bpmValue > 140 && energy > 0.7 && centroid > 2500) {
      return 'energetic';
    } else if (bpmValue < 80 && energy < 0.3) {
      return 'calm';
    } else if (tonnetz[0] > 0.5 && mfcc[1] > -2) {
      return 'happy';
    } else if (mfcc[1] < -4 && tonnetz[1] < 0) {
      return 'melancholic';
    } else if (bpmValue > 150 && mfcc[3] > 1) {
      return 'aggressive';
    } else if (centroid < 1200 && energy < 0.4) {
      return 'peaceful';
    } else if (mfcc[5] < -2 && centroid > 1800) {
      return 'mysterious';
    } else if (bpmValue > 120 && tonnetz[2] > 0.3) {
      return 'uplifting';
    }
    
    return 'energetic'; // デフォルト
  }
}

// React Hook
export function useAIAudioAnalysis() {
  const [analysis, setAnalysis] = React.useState<AudioAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const analyzerRef = React.useRef<AIAudioAnalysis | null>(null);
  
  React.useEffect(() => {
    analyzerRef.current = new AIAudioAnalysis();
    
    analyzerRef.current.onAnalysis((result) => {
      setAnalysis(result);
    });
    
    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.dispose();
      }
    };
  }, []);
  
  const startAnalysis = React.useCallback(async (audioStream?: MediaStream) => {
    if (!analyzerRef.current) return;
    
    try {
      await analyzerRef.current.initialize(audioStream);
      analyzerRef.current.startAnalysis();
      setIsAnalyzing(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  }, []);
  
  const stopAnalysis = React.useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
      setIsAnalyzing(false);
    }
  }, []);
  
  return {
    analysis,
    isAnalyzing,
    error,
    startAnalysis,
    stopAnalysis,
  };
}