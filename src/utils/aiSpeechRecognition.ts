/**
 * AI Speech Recognition System for v1z3r
 * Advanced voice command processing for VJ operations
 */

import React from 'react';

// Web Speech API types (avoid conflicts with existing definitions)
interface AIWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionError {
  error: string;
  message: string;
}

interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

export interface VoiceCommand {
  command: string;
  confidence: number;
  action: VJAction;
  parameters?: Record<string, any>;
  timestamp: number;
}

export interface VJAction {
  type: 'EFFECT_CHANGE' | 'VOLUME_ADJUST' | 'COLOR_SET' | 'BEAT_SYNC' | 'PRESET_LOAD' | 'LAYER_CONTROL';
  target?: string;
  value?: any;
}

export interface SpeechRecognitionConfig {
  language: 'ja-JP' | 'en-US';
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  confidenceThreshold: number;
  noiseReduction: boolean;
}

export interface VJVocabulary {
  [key: string]: VJAction;
}

// VJ専用語彙定義
export const VJ_VOCABULARY_JP: VJVocabulary = {
  // エフェクト制御
  'エフェクト変更': { type: 'EFFECT_CHANGE' },
  'エフェクト切り替え': { type: 'EFFECT_CHANGE' },
  'パーティクル': { type: 'EFFECT_CHANGE', target: 'particle' },
  'ウェーブ': { type: 'EFFECT_CHANGE', target: 'wave' },
  'スパイラル': { type: 'EFFECT_CHANGE', target: 'spiral' },
  
  // 音量制御
  '音量アップ': { type: 'VOLUME_ADJUST', value: 10 },
  '音量ダウン': { type: 'VOLUME_ADJUST', value: -10 },
  'ボリューム上げて': { type: 'VOLUME_ADJUST', value: 15 },
  'ボリューム下げて': { type: 'VOLUME_ADJUST', value: -15 },
  'ミュート': { type: 'VOLUME_ADJUST', value: 0 },
  
  // 色制御
  '色を赤に': { type: 'COLOR_SET', value: '#ff0000' },
  '色を青に': { type: 'COLOR_SET', value: '#0000ff' },
  '色を緑に': { type: 'COLOR_SET', value: '#00ff00' },
  '色を白に': { type: 'COLOR_SET', value: '#ffffff' },
  '色を黒に': { type: 'COLOR_SET', value: '#000000' },
  'レインボー': { type: 'COLOR_SET', value: 'rainbow' },
  
  // ビート同期
  'ビート同期開始': { type: 'BEAT_SYNC', value: true },
  'ビート同期停止': { type: 'BEAT_SYNC', value: false },
  'オートビート': { type: 'BEAT_SYNC', value: 'auto' },
  
  // プリセット
  'プリセット1': { type: 'PRESET_LOAD', target: '1' },
  'プリセット2': { type: 'PRESET_LOAD', target: '2' },
  'プリセット3': { type: 'PRESET_LOAD', target: '3' },
  'お気に入り': { type: 'PRESET_LOAD', target: 'favorite' },
  
  // レイヤー制御
  'レイヤー追加': { type: 'LAYER_CONTROL', value: 'add' },
  'レイヤー削除': { type: 'LAYER_CONTROL', value: 'remove' },
  'レイヤー表示': { type: 'LAYER_CONTROL', value: 'show' },
  'レイヤー非表示': { type: 'LAYER_CONTROL', value: 'hide' },
};

export const VJ_VOCABULARY_EN: VJVocabulary = {
  // Effect control
  'change effect': { type: 'EFFECT_CHANGE' },
  'switch effect': { type: 'EFFECT_CHANGE' },
  'particle': { type: 'EFFECT_CHANGE', target: 'particle' },
  'wave': { type: 'EFFECT_CHANGE', target: 'wave' },
  'spiral': { type: 'EFFECT_CHANGE', target: 'spiral' },
  
  // Volume control
  'volume up': { type: 'VOLUME_ADJUST', value: 10 },
  'volume down': { type: 'VOLUME_ADJUST', value: -10 },
  'louder': { type: 'VOLUME_ADJUST', value: 15 },
  'quieter': { type: 'VOLUME_ADJUST', value: -15 },
  'mute': { type: 'VOLUME_ADJUST', value: 0 },
  
  // Color control
  'red color': { type: 'COLOR_SET', value: '#ff0000' },
  'blue color': { type: 'COLOR_SET', value: '#0000ff' },
  'green color': { type: 'COLOR_SET', value: '#00ff00' },
  'white color': { type: 'COLOR_SET', value: '#ffffff' },
  'black color': { type: 'COLOR_SET', value: '#000000' },
  'rainbow': { type: 'COLOR_SET', value: 'rainbow' },
  
  // Beat sync
  'start beat sync': { type: 'BEAT_SYNC', value: true },
  'stop beat sync': { type: 'BEAT_SYNC', value: false },
  'auto beat': { type: 'BEAT_SYNC', value: 'auto' },
  
  // Presets
  'preset one': { type: 'PRESET_LOAD', target: '1' },
  'preset two': { type: 'PRESET_LOAD', target: '2' },
  'preset three': { type: 'PRESET_LOAD', target: '3' },
  'favorite': { type: 'PRESET_LOAD', target: 'favorite' },
  
  // Layer control
  'add layer': { type: 'LAYER_CONTROL', value: 'add' },
  'remove layer': { type: 'LAYER_CONTROL', value: 'remove' },
  'show layer': { type: 'LAYER_CONTROL', value: 'show' },
  'hide layer': { type: 'LAYER_CONTROL', value: 'hide' },
};

export class AISpeechRecognition {
  private recognition: SpeechRecognition | null = null;
  private config: SpeechRecognitionConfig;
  private vocabulary: VJVocabulary;
  private isListening = false;
  private onCommandCallback?: (command: VoiceCommand) => void;
  private onErrorCallback?: (error: SpeechRecognitionError) => void;
  
  // ノイズフィルタリング用
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  
  constructor(config: Partial<SpeechRecognitionConfig> = {}) {
    this.config = {
      language: 'ja-JP',
      continuous: true,
      interimResults: false,
      maxAlternatives: 3,
      confidenceThreshold: 0.7,
      noiseReduction: true,
      ...config,
    };
    
    this.vocabulary = this.config.language === 'ja-JP' ? VJ_VOCABULARY_JP : VJ_VOCABULARY_EN;
    this.initializeSpeechRecognition();
    this.initializeAudioProcessing();
  }
  
  private initializeSpeechRecognition(): void {
    // ブラウザ互換性チェック
    const aiWindow = window as AIWindow;
    const SpeechRecognition = aiWindow.SpeechRecognition || 
                             aiWindow.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.setupRecognitionConfig();
    this.setupEventListeners();
  }
  
  private setupRecognitionConfig(): void {
    if (!this.recognition) return;
    
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
  }
  
  private setupEventListeners(): void {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      console.log('[AISpeech] Recognition started');
      this.isListening = true;
    };
    
    this.recognition.onend = () => {
      console.log('[AISpeech] Recognition ended');
      this.isListening = false;
    };
    
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.processRecognitionResult(event);
    };
    
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[AISpeech] Recognition error:', event.error);
      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
    };
  }
  
  private async initializeAudioProcessing(): Promise<void> {
    if (!this.config.noiseReduction) return;
    
    try {
      this.audioContext = new AudioContext();
      
      // ゲインノード（音量調整）
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.2; // 少し音量を上げる
      
      // バイクアッドフィルター（ノイズ除去）
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = 300; // 300Hz以下をカット
      this.filterNode.Q.value = 1;
      
      // ノード接続
      this.gainNode.connect(this.filterNode);
      this.filterNode.connect(this.audioContext.destination);
      
    } catch (error) {
      console.warn('[AISpeech] Audio processing initialization failed:', error);
    }
  }
  
  private processRecognitionResult(event: SpeechRecognitionEvent): void {
    const results = Array.from(event.results);
    
    for (const result of results) {
      if (!result.isFinal) continue;
      
      const alternatives = Array.from(result);
      
      for (const alternative of alternatives) {
        const transcript = alternative.transcript.trim().toLowerCase();
        const confidence = alternative.confidence;
        
        if (confidence < this.config.confidenceThreshold) continue;
        
        const command = this.matchVoiceCommand(transcript, confidence);
        if (command && this.onCommandCallback) {
          this.onCommandCallback(command);
        }
      }
    }
  }
  
  private matchVoiceCommand(transcript: string, confidence: number): VoiceCommand | null {
    // 完全一致チェック
    if (this.vocabulary[transcript]) {
      return {
        command: transcript,
        confidence,
        action: this.vocabulary[transcript],
        timestamp: Date.now(),
      };
    }
    
    // 部分一致チェック（より柔軟な認識）
    const partialMatches = Object.keys(this.vocabulary).filter(key => 
      transcript.includes(key) || key.includes(transcript)
    );
    
    if (partialMatches.length > 0) {
      // 最も長い一致を選択
      const bestMatch = partialMatches.reduce((a, b) => 
        a.length > b.length ? a : b
      );
      
      return {
        command: bestMatch,
        confidence: confidence * 0.8, // 部分一致は信頼度を下げる
        action: this.vocabulary[bestMatch],
        parameters: { originalTranscript: transcript },
        timestamp: Date.now(),
      };
    }
    
    // ファジーマッチング（編集距離による類似度）
    const fuzzyMatch = this.findFuzzyMatch(transcript);
    if (fuzzyMatch) {
      return {
        command: fuzzyMatch.command,
        confidence: confidence * fuzzyMatch.similarity,
        action: this.vocabulary[fuzzyMatch.command],
        parameters: { 
          originalTranscript: transcript,
          matchType: 'fuzzy',
          similarity: fuzzyMatch.similarity 
        },
        timestamp: Date.now(),
      };
    }
    
    return null;
  }
  
  private findFuzzyMatch(transcript: string): { command: string; similarity: number } | null {
    let bestMatch = '';
    let bestSimilarity = 0;
    
    for (const command of Object.keys(this.vocabulary)) {
      const similarity = this.calculateSimilarity(transcript, command);
      if (similarity > bestSimilarity && similarity > 0.6) { // 60%以上の類似度
        bestSimilarity = similarity;
        bestMatch = command;
      }
    }
    
    return bestSimilarity > 0 ? { command: bestMatch, similarity: bestSimilarity } : null;
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion  
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - (matrix[str2.length][str1.length] / maxLength) : 0;
  }
  
  /**
   * 音声認識を開始
   */
  public startListening(): void {
    if (!this.recognition) {
      console.error('[AISpeech] Speech recognition not available');
      return;
    }
    
    if (this.isListening) {
      console.warn('[AISpeech] Already listening');
      return;
    }
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('[AISpeech] Failed to start recognition:', error);
    }
  }
  
  /**
   * 音声認識を停止
   */
  public stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }
  
  /**
   * 音声コマンドのコールバック設定
   */
  public onCommand(callback: (command: VoiceCommand) => void): void {
    this.onCommandCallback = callback;
  }
  
  /**
   * エラーコールバック設定
   */
  public onError(callback: (error: SpeechRecognitionError) => void): void {
    this.onErrorCallback = callback;
  }
  
  /**
   * 語彙追加
   */
  public addVocabulary(commands: Record<string, VJAction>): void {
    this.vocabulary = { ...this.vocabulary, ...commands };
  }
  
  /**
   * 設定更新
   */
  public updateConfig(newConfig: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupRecognitionConfig();
    
    // 言語変更時は語彙も変更
    if (newConfig.language) {
      this.vocabulary = newConfig.language === 'ja-JP' ? VJ_VOCABULARY_JP : VJ_VOCABULARY_EN;
    }
  }
  
  /**
   * 認識状態取得
   */
  public isRecognitionActive(): boolean {
    return this.isListening;
  }
  
  /**
   * 対応状況チェック
   */
  public static isSupported(): boolean {
    const aiWindow = window as AIWindow;
    return !!(aiWindow.SpeechRecognition || aiWindow.webkitSpeechRecognition);
  }
  
  /**
   * リソース解放
   */
  public dispose(): void {
    this.stopListening();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.recognition = null;
    this.onCommandCallback = undefined;
    this.onErrorCallback = undefined;
  }
}

// グローバルインスタンス
let speechRecognitionInstance: AISpeechRecognition | null = null;

/**
 * AI音声認識インスタンス取得
 */
export function getAISpeechRecognition(config?: Partial<SpeechRecognitionConfig>): AISpeechRecognition {
  if (!speechRecognitionInstance) {
    speechRecognitionInstance = new AISpeechRecognition(config);
  }
  return speechRecognitionInstance;
}

/**
 * React Hook for AI Speech Recognition
 */
export function useAISpeechRecognition(config?: Partial<SpeechRecognitionConfig>) {
  const [isListening, setIsListening] = React.useState(false);
  const [lastCommand, setLastCommand] = React.useState<VoiceCommand | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const speechRecognition = getAISpeechRecognition(config);
    
    const handleCommand = (command: VoiceCommand) => {
      setLastCommand(command);
      setError(null);
    };
    
    const handleError = (err: SpeechRecognitionError) => {
      setError(err.error);
      setIsListening(false);
    };
    
    speechRecognition.onCommand(handleCommand);
    speechRecognition.onError(handleError);
    
    return () => {
      speechRecognition.dispose();
    };
  }, [config]);
  
  const startListening = React.useCallback(() => {
    const speechRecognition = getAISpeechRecognition();
    speechRecognition.startListening();
    setIsListening(true);
    setError(null);
  }, []);
  
  const stopListening = React.useCallback(() => {
    const speechRecognition = getAISpeechRecognition();
    speechRecognition.stopListening();
    setIsListening(false);
  }, []);
  
  return {
    isListening,
    lastCommand,
    error,
    startListening,
    stopListening,
    isSupported: AISpeechRecognition.isSupported(),
  };
}