/**
 * AI Gesture Recognition System for v1z3r
 * TensorFlow.js MediaPipe Pose Detection for VJ Operations
 */

import React from 'react';

// TensorFlow.js types (準備中のため仮型定義)
export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface Pose {
  landmarks: PoseLandmark[];
  worldLandmarks?: PoseLandmark[];
  confidence: number;
  timestamp: number;
}

export interface HandDetection {
  landmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  confidence: number;
  timestamp: number;
}

export interface GestureRecognitionResult {
  gesture: GestureType;
  confidence: number;
  hands: HandDetection[];
  pose?: Pose;
  timestamp: number;
}

export interface VJGestureMapping {
  gesture: GestureType;
  action: VJGestureAction;
  sensitivity: number;
  cooldown: number; // ms
  requires: ('left_hand' | 'right_hand' | 'both_hands' | 'pose')[];
}

export interface VJGestureAction {
  type: 'EFFECT_CHANGE' | 'VOLUME_CONTROL' | 'COLOR_ADJUST' | 'BEAT_CONTROL' | 'LAYER_CONTROL' | 'CAMERA_CONTROL';
  target?: string;
  value?: any;
  parameters?: Record<string, any>;
}

export type GestureType = 
  // Hand gestures
  | 'fist' | 'open_palm' | 'peace' | 'thumbs_up' | 'thumbs_down'
  | 'pointing' | 'ok_sign' | 'rock_on' | 'call_me' | 'stop'
  
  // Two-hand gestures
  | 'clap' | 'spread_arms' | 'hands_together' | 'push_away' | 'pull_in'
  
  // Body poses
  | 'arms_up' | 'arms_down' | 'lean_left' | 'lean_right' | 'jump'
  | 'squat' | 'dance_move' | 'air_drum' | 'air_scratch'
  
  // Special VJ gestures
  | 'cross_fade' | 'volume_knob' | 'filter_sweep' | 'beat_drop';

// VJ専用ジェスチャーマッピング
export const VJ_GESTURE_MAPPINGS: VJGestureMapping[] = [
  // エフェクト制御
  {
    gesture: 'fist',
    action: { type: 'EFFECT_CHANGE', target: 'particle', value: 'explosion' },
    sensitivity: 0.8,
    cooldown: 500,
    requires: ['right_hand']
  },
  {
    gesture: 'open_palm',
    action: { type: 'EFFECT_CHANGE', target: 'wave', value: 'smooth' },
    sensitivity: 0.7,
    cooldown: 300,
    requires: ['right_hand']
  },
  {
    gesture: 'peace',
    action: { type: 'EFFECT_CHANGE', target: 'spiral', value: 'double' },
    sensitivity: 0.85,
    cooldown: 400,
    requires: ['right_hand']
  },
  
  // 音量制御
  {
    gesture: 'thumbs_up',
    action: { type: 'VOLUME_CONTROL', value: 10 },
    sensitivity: 0.9,
    cooldown: 200,
    requires: ['right_hand']
  },
  {
    gesture: 'thumbs_down',
    action: { type: 'VOLUME_CONTROL', value: -10 },
    sensitivity: 0.9,
    cooldown: 200,
    requires: ['right_hand']
  },
  {
    gesture: 'volume_knob',
    action: { type: 'VOLUME_CONTROL', value: 'dynamic' },
    sensitivity: 0.6,
    cooldown: 50,
    requires: ['right_hand']
  },
  
  // 色調整
  {
    gesture: 'pointing',
    action: { type: 'COLOR_ADJUST', target: 'hue', value: 'follow_hand' },
    sensitivity: 0.7,
    cooldown: 100,
    requires: ['right_hand']
  },
  {
    gesture: 'ok_sign',
    action: { type: 'COLOR_ADJUST', target: 'brightness', value: 'increase' },
    sensitivity: 0.8,
    cooldown: 200,
    requires: ['right_hand']
  },
  
  // 両手ジェスチャー
  {
    gesture: 'clap',
    action: { type: 'BEAT_CONTROL', value: 'manual_beat' },
    sensitivity: 0.9,
    cooldown: 100,
    requires: ['both_hands']
  },
  {
    gesture: 'spread_arms',
    action: { type: 'EFFECT_CHANGE', target: 'fullscreen', value: 'expand' },
    sensitivity: 0.8,
    cooldown: 800,
    requires: ['both_hands']
  },
  {
    gesture: 'cross_fade',
    action: { type: 'LAYER_CONTROL', value: 'crossfade' },
    sensitivity: 0.7,
    cooldown: 200,
    requires: ['both_hands']
  },
  
  // 全身ジェスチャー
  {
    gesture: 'jump',
    action: { type: 'EFFECT_CHANGE', target: 'impact', value: 'big_bang' },
    sensitivity: 0.9,
    cooldown: 1000,
    requires: ['pose']
  },
  {
    gesture: 'arms_up',
    action: { type: 'EFFECT_CHANGE', target: 'energy', value: 'maximum' },
    sensitivity: 0.8,
    cooldown: 500,
    requires: ['pose']
  },
  {
    gesture: 'air_drum',
    action: { type: 'BEAT_CONTROL', value: 'drum_trigger' },
    sensitivity: 0.7,
    cooldown: 100,
    requires: ['both_hands', 'pose']
  },
  
  // カメラ制御
  {
    gesture: 'lean_left',
    action: { type: 'CAMERA_CONTROL', target: 'rotation', value: 'left' },
    sensitivity: 0.6,
    cooldown: 100,
    requires: ['pose']
  },
  {
    gesture: 'lean_right',
    action: { type: 'CAMERA_CONTROL', target: 'rotation', value: 'right' },
    sensitivity: 0.6,
    cooldown: 100,
    requires: ['pose']
  }
];

export interface GestureRecognitionConfig {
  modelType: 'lite' | 'full' | 'heavy';
  maxNumPoses: number;
  maxNumHands: number;
  minPoseConfidence: number;
  minHandConfidence: number;
  enableBodyTracking: boolean;
  enableHandTracking: boolean;
  smoothing: boolean;
  realTimeMode: boolean;
}

export class AIGestureRecognition {
  private poseModel: any = null; // TensorFlow.js Model
  private handModel: any = null; // MediaPipe Hands Model
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  
  private config: GestureRecognitionConfig;
  private gestureMappings: VJGestureMapping[];
  private gestureHistory: GestureRecognitionResult[] = [];
  private lastGestureTime: Map<GestureType, number> = new Map();
  
  // コールバック
  private onGestureCallback?: (result: GestureRecognitionResult) => void;
  private onVJActionCallback?: (action: VJGestureAction) => void;
  private onErrorCallback?: (error: Error) => void;
  
  // パフォーマンス最適化
  private isProcessing = false;
  private frameSkipCounter = 0;
  private readonly frameSkipInterval = 2; // 3フレームに1回処理
  
  // ジェスチャー検出フィルタ
  private gestureBuffer: Map<GestureType, number[]> = new Map();
  private readonly bufferSize = 5;
  
  constructor(config: Partial<GestureRecognitionConfig> = {}) {
    this.config = {
      modelType: 'lite',
      maxNumPoses: 1,
      maxNumHands: 2,
      minPoseConfidence: 0.5,
      minHandConfidence: 0.5,
      enableBodyTracking: true,
      enableHandTracking: true,
      smoothing: true,
      realTimeMode: true,
      ...config,
    };
    
    this.gestureMappings = [...VJ_GESTURE_MAPPINGS];
  }
  
  /**
   * ジェスチャー認識システムを初期化
   */
  async initialize(): Promise<void> {
    try {
      // カメラアクセス設定
      await this.setupCamera();
      
      // TensorFlow.js モデル読み込み（準備中）
      await this.loadModels();
      
      console.log('[AIGesture] Gesture recognition initialized');
      
    } catch (error) {
      console.error('[AIGesture] Initialization failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error);
      }
      throw error;
    }
  }
  
  /**
   * カメラセットアップ
   */
  private async setupCamera(): Promise<void> {
    try {
      // カメラストリーム取得
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
      
      // Video要素作成
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.autoplay = true;
      this.video.playsInline = true;
      
      // Canvas作成
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
      
      // Video読み込み完了を待機
      await new Promise<void>((resolve) => {
        this.video!.onloadedmetadata = () => resolve();
      });
      
    } catch (error) {
      throw new Error(`Camera setup failed: ${error}`);
    }
  }
  
  /**
   * AI モデル読み込み
   */
  private async loadModels(): Promise<void> {
    try {
      // 現在はプレースホルダー実装
      // 実際のTensorFlow.js統合時に実装
      console.log('[AIGesture] Loading pose detection model...');
      
      // TODO: TensorFlow.js Pose Detection統合
      // this.poseModel = await poseDetection.createDetector(
      //   poseDetection.SupportedModels.MediaPipePose,
      //   { modelType: this.config.modelType }
      // );
      
      console.log('[AIGesture] Loading hand detection model...');
      
      // TODO: MediaPipe Hands統合
      // this.handModel = await handPoseDetection.createDetector(
      //   handPoseDetection.SupportedModels.MediaPipeHands,
      //   { maxHands: this.config.maxNumHands }
      // );
      
      // プレースホルダーモデル
      this.poseModel = { predict: this.mockPoseDetection.bind(this) };
      this.handModel = { predict: this.mockHandDetection.bind(this) };
      
    } catch (error) {
      throw new Error(`Model loading failed: ${error}`);
    }
  }
  
  /**
   * リアルタイム認識開始
   */
  startRecognition(): void {
    if (!this.poseModel || !this.handModel || !this.video) {
      console.error('[AIGesture] Models not loaded or camera not ready');
      return;
    }
    
    if (this.animationFrame) {
      console.warn('[AIGesture] Recognition already running');
      return;
    }
    
    this.recognizeGestures();
    console.log('[AIGesture] Recognition started');
  }
  
  /**
   * 認識停止
   */
  stopRecognition(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    console.log('[AIGesture] Recognition stopped');
  }
  
  /**
   * メイン認識ループ
   */
  private recognizeGestures(): void {
    if (!this.video || !this.canvas) return;
    
    // フレームスキップによる最適化
    this.frameSkipCounter++;
    if (this.frameSkipCounter % this.frameSkipInterval !== 0) {
      this.animationFrame = requestAnimationFrame(() => this.recognizeGestures());
      return;
    }
    
    if (this.isProcessing) {
      this.animationFrame = requestAnimationFrame(() => this.recognizeGestures());
      return;
    }
    
    this.isProcessing = true;
    
    // 非同期処理でフレームレート維持
    this.processFrame().then(() => {
      this.isProcessing = false;
    }).catch((error) => {
      console.error('[AIGesture] Frame processing error:', error);
      this.isProcessing = false;
    });
    
    this.animationFrame = requestAnimationFrame(() => this.recognizeGestures());
  }
  
  /**
   * フレーム処理
   */
  private async processFrame(): Promise<void> {
    if (!this.video || !this.canvas || !this.poseModel || !this.handModel) return;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    // フレームキャプチャ
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    try {
      // 並列処理でパフォーマンス向上
      const [poses, hands] = await Promise.all([
        this.config.enableBodyTracking ? this.poseModel.predict(this.canvas) : Promise.resolve([]),
        this.config.enableHandTracking ? this.handModel.predict(this.canvas) : Promise.resolve([])
      ]);
      
      // ジェスチャー分析
      const gestureResult = this.analyzeGestures(poses, hands);
      
      if (gestureResult) {
        // 履歴保存
        this.gestureHistory.push(gestureResult);
        if (this.gestureHistory.length > 20) {
          this.gestureHistory.shift();
        }
        
        // コールバック実行
        if (this.onGestureCallback) {
          this.onGestureCallback(gestureResult);
        }
        
        // VJアクションの実行
        this.executeVJAction(gestureResult);
      }
      
    } catch (error) {
      console.error('[AIGesture] Gesture analysis error:', error);
    }
  }
  
  /**
   * ジェスチャー分析
   */
  private analyzeGestures(poses: any[], hands: any[]): GestureRecognitionResult | null {
    const timestamp = Date.now();
    
    // 手の検出結果を変換
    const handDetections: HandDetection[] = hands.map((hand: any) => ({
      landmarks: hand.landmarks || [],
      handedness: hand.handedness || 'Right',
      confidence: hand.confidence || 0,
      timestamp
    }));
    
    // ポーズ検出結果を変換
    const pose: Pose | undefined = poses.length > 0 ? {
      landmarks: poses[0].landmarks || [],
      confidence: poses[0].confidence || 0,
      timestamp
    } : undefined;
    
    // ジェスチャー認識
    const gesture = this.recognizeGestureType(handDetections, pose);
    
    if (!gesture) return null;
    
    // フィルタリングによるノイズ除去
    const filteredGesture = this.filterGesture(gesture.type, gesture.confidence);
    
    if (!filteredGesture) return null;
    
    return {
      gesture: filteredGesture.type,
      confidence: filteredGesture.confidence,
      hands: handDetections,
      pose,
      timestamp
    };
  }
  
  /**
   * ジェスチャータイプ認識
   */
  private recognizeGestureType(hands: HandDetection[], pose?: Pose): { type: GestureType; confidence: number } | null {
    // 手のジェスチャー認識
    if (hands.length > 0) {
      const handGesture = this.recognizeHandGesture(hands[0]);
      if (handGesture) return handGesture;
      
      // 両手ジェスチャー
      if (hands.length >= 2) {
        const twoHandGesture = this.recognizeTwoHandGesture(hands);
        if (twoHandGesture) return twoHandGesture;
      }
    }
    
    // ボディポーズ認識
    if (pose && pose.confidence > this.config.minPoseConfidence) {
      const poseGesture = this.recognizePoseGesture(pose);
      if (poseGesture) return poseGesture;
    }
    
    return null;
  }
  
  /**
   * 手のジェスチャー認識（簡易実装）
   */
  private recognizeHandGesture(hand: HandDetection): { type: GestureType; confidence: number } | null {
    if (hand.confidence < this.config.minHandConfidence) return null;
    
    // TODO: 実際の手の形状解析
    // 現在はランダム値による模擬実装
    const gestures: GestureType[] = ['fist', 'open_palm', 'peace', 'thumbs_up', 'pointing'];
    const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
    
    return {
      type: randomGesture,
      confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0
    };
  }
  
  /**
   * 両手ジェスチャー認識
   */
  private recognizeTwoHandGesture(hands: HandDetection[]): { type: GestureType; confidence: number } | null {
    if (hands.length < 2) return null;
    
    // TODO: 両手の位置関係分析
    const twoHandGestures: GestureType[] = ['clap', 'spread_arms', 'cross_fade'];
    const randomGesture = twoHandGestures[Math.floor(Math.random() * twoHandGestures.length)];
    
    return {
      type: randomGesture,
      confidence: Math.random() * 0.2 + 0.6 // 0.6-0.8
    };
  }
  
  /**
   * ポーズジェスチャー認識
   */
  private recognizePoseGesture(pose: Pose): { type: GestureType; confidence: number } | null {
    // TODO: 全身ポーズ解析
    const poseGestures: GestureType[] = ['arms_up', 'lean_left', 'lean_right', 'jump'];
    const randomGesture = poseGestures[Math.floor(Math.random() * poseGestures.length)];
    
    return {
      type: randomGesture,
      confidence: Math.random() * 0.3 + 0.5 // 0.5-0.8
    };
  }
  
  /**
   * ジェスチャーフィルタリング
   */
  private filterGesture(gesture: GestureType, confidence: number): { type: GestureType; confidence: number } | null {
    // バッファにconfidenceを追加
    if (!this.gestureBuffer.has(gesture)) {
      this.gestureBuffer.set(gesture, []);
    }
    
    const buffer = this.gestureBuffer.get(gesture)!;
    buffer.push(confidence);
    
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
    
    // 平均confidence計算
    const avgConfidence = buffer.reduce((a, b) => a + b) / buffer.length;
    
    // 閾値チェック
    if (buffer.length >= 3 && avgConfidence > 0.7) {
      return { type: gesture, confidence: avgConfidence };
    }
    
    return null;
  }
  
  /**
   * VJアクション実行
   */
  private executeVJAction(gestureResult: GestureRecognitionResult): void {
    const mapping = this.gestureMappings.find(m => m.gesture === gestureResult.gesture);
    if (!mapping) return;
    
    // クールダウンチェック
    const lastTime = this.lastGestureTime.get(gestureResult.gesture) || 0;
    if (Date.now() - lastTime < mapping.cooldown) return;
    
    // 感度チェック
    if (gestureResult.confidence < mapping.sensitivity) return;
    
    // 必要な要素チェック
    const hasRequiredElements = mapping.requires.every(req => {
      switch (req) {
        case 'left_hand':
          return gestureResult.hands.some(h => h.handedness === 'Left');
        case 'right_hand':
          return gestureResult.hands.some(h => h.handedness === 'Right');
        case 'both_hands':
          return gestureResult.hands.length >= 2;
        case 'pose':
          return gestureResult.pose !== undefined;
        default:
          return true;
      }
    });
    
    if (!hasRequiredElements) return;
    
    // アクション実行
    this.lastGestureTime.set(gestureResult.gesture, Date.now());
    
    if (this.onVJActionCallback) {
      this.onVJActionCallback(mapping.action);
    }
    
    console.log('[AIGesture] VJ Action executed:', {
      gesture: gestureResult.gesture,
      action: mapping.action,
      confidence: gestureResult.confidence
    });
  }
  
  /**
   * モックポーズ検出（開発用）
   */
  private async mockPoseDetection(_canvas: HTMLCanvasElement): Promise<any[]> {
    // 開発用のモック実装
    return Math.random() > 0.7 ? [{
      landmarks: Array(33).fill(0).map(() => ({
        x: Math.random(),
        y: Math.random(),
        visibility: Math.random()
      })),
      confidence: Math.random() * 0.3 + 0.7
    }] : [];
  }
  
  /**
   * モック手検出（開発用）
   */
  private async mockHandDetection(_canvas: HTMLCanvasElement): Promise<any[]> {
    // 開発用のモック実装
    return Math.random() > 0.6 ? [{
      landmarks: Array(21).fill(0).map(() => ({
        x: Math.random(),
        y: Math.random()
      })),
      handedness: Math.random() > 0.5 ? 'Right' : 'Left',
      confidence: Math.random() * 0.3 + 0.7
    }] : [];
  }
  
  /**
   * ジェスチャーマッピング追加
   */
  addGestureMapping(mapping: VJGestureMapping): void {
    this.gestureMappings.push(mapping);
  }
  
  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<GestureRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * コールバック設定
   */
  onGesture(callback: (result: GestureRecognitionResult) => void): void {
    this.onGestureCallback = callback;
  }
  
  onVJAction(callback: (action: VJGestureAction) => void): void {
    this.onVJActionCallback = callback;
  }
  
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }
  
  /**
   * 認識状態取得
   */
  isRecognitionActive(): boolean {
    return this.animationFrame !== null;
  }
  
  /**
   * 対応状況チェック
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  /**
   * リソース解放
   */
  dispose(): void {
    this.stopRecognition();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.video = null;
    this.canvas = null;
    this.poseModel = null;
    this.handModel = null;
    this.onGestureCallback = undefined;
    this.onVJActionCallback = undefined;
    this.onErrorCallback = undefined;
    
    // メモリリーク防止
    this.gestureHistory = [];
    this.lastGestureTime.clear();
    this.gestureBuffer.clear();
  }
}

// React Hook
export function useAIGestureRecognition(config?: Partial<GestureRecognitionConfig>) {
  const [isRecognizing, setIsRecognizing] = React.useState(false);
  const [lastGesture, setLastGesture] = React.useState<GestureRecognitionResult | null>(null);
  const [lastAction, setLastAction] = React.useState<VJGestureAction | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  const recognizerRef = React.useRef<AIGestureRecognition | null>(null);
  
  React.useEffect(() => {
    recognizerRef.current = new AIGestureRecognition(config);
    
    recognizerRef.current.onGesture((gesture) => {
      setLastGesture(gesture);
      setError(null);
    });
    
    recognizerRef.current.onVJAction((action) => {
      setLastAction(action);
    });
    
    recognizerRef.current.onError((err) => {
      setError(err.message);
      setIsRecognizing(false);
    });
    
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.dispose();
      }
    };
  }, [config]);
  
  const startRecognition = React.useCallback(async () => {
    if (!recognizerRef.current) return;
    
    try {
      await recognizerRef.current.initialize();
      recognizerRef.current.startRecognition();
      setIsRecognizing(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recognition failed');
      setIsRecognizing(false);
    }
  }, []);
  
  const stopRecognition = React.useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stopRecognition();
      setIsRecognizing(false);
    }
  }, []);
  
  return {
    isRecognizing,
    lastGesture,
    lastAction,
    error,
    startRecognition,
    stopRecognition,
    isSupported: AIGestureRecognition.isSupported(),
  };
}