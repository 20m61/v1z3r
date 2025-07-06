import React, { useEffect, useRef, useState } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';

// Web Speech API用の型定義
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length?: number; // TypeScript エラー対策
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

// Web Speech APIのブラウザ間の差異を吸収
interface SpeechRecognitionType {
  new (): any;
  prototype: any;
}

// Window型を拡張
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionType;
    webkitSpeechRecognition?: SpeechRecognitionType;
  }
}

// クライアントサイドでのみSpeechRecognitionを初期化
const getSpeechRecognition = (): SpeechRecognitionType | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
};

interface SpeechRecognizerProps {
  lang?: string;
  continuous?: boolean;
  autoStart?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  noiseFilter?: boolean;
  minConfidence?: number;
}

const SpeechRecognizer: React.FC<SpeechRecognizerProps> = ({
  lang = 'ja-JP',
  continuous = true,
  autoStart = true,
  interimResults = true,
  maxAlternatives = 3,
  noiseFilter = true,
  minConfidence = 0.3,
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const recognitionInitializedRef = useRef<boolean>(false);
  
  const {
    isLyricsEnabled,
    updateCurrentLyrics,
    updateNextLyrics,
  } = useVisualizerStore();

  // 音声データのノイズフィルタリング
  const filterNoise = (text: string): string => {
    if (!noiseFilter) return text;
    
    // 一般的なノイズや意味のない言葉をフィルタリング
    const noisePatterns = [
      /^(あー|えー|うー|おー|んー)+$/i,
      /^([.,!?]|…)+$/,
      /^(\s|　)+$/,
      /^(uh|um|eh|oh|hmm|erm)+$/i,
    ];
    
    if (noisePatterns.some(pattern => pattern.test(text))) {
      return '';
    }
    
    // 短すぎる認識結果は信頼性が低い可能性
    if (text.length < 2) {
      return '';
    }
    
    return text;
  };

  // 最適な認識結果を選択
  const selectBestResult = (results: SpeechRecognitionResultList, resultIndex: number): { text: string, confidence: number } => {
    const result = results[resultIndex];
    let bestText = '';
    let bestConfidence = 0;
    
    // 各候補から最も信頼性の高いものを選択
    // SpeechRecognitionResultの型定義に問題があるため、安全に処理する
    for (let i = 0; i < (Object.keys(result).length - 1); i++) {
      try {
        const { transcript, confidence } = result[i];
        const filteredText = filterNoise(transcript.trim());
        
        // 信頼性が高く、ノイズではない場合に採用
        if (filteredText && confidence > bestConfidence && confidence >= minConfidence) {
          bestText = filteredText;
          bestConfidence = confidence;
        }
      } catch (e) {
        console.error('Error processing recognition result:', e);
      }
    }
    
    return { text: bestText, confidence: bestConfidence };
  };
  
  // Web Speech APIの初期化と設定
  const initializeRecognition = () => {
    if (recognitionInitializedRef.current) return true;
    
    // サーバーサイドレンダリング対策
    if (typeof window === 'undefined') return false;
    
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech Recognition API is not supported in this browser.');
      return false;
    }
    
    setIsSupported(true);
    
    // 音声認識インスタンスの作成
    try {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      
      // 設定
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = maxAlternatives;
      
      // 結果イベントのハンドラー
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!isLyricsEnabled) return;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          if (result.isFinal) {
            const { text, confidence } = selectBestResult(event.results, i);
            if (text) {
              updateCurrentLyrics(text, confidence);
            }
          } else {
            // 暫定的な結果（まだ確定していない発話）
            const { text } = selectBestResult(event.results, i);
            if (text) {
              updateNextLyrics(text);
            }
          }
        }
      };
      
      // エラーハンドラー
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setError(event.error);
        setIsListening(false);
      };
      
      // 音声認識が終了したときの処理
      recognition.onend = () => {
        setIsListening(false);
        
        // 継続モードの場合は自動的に再起動
        if (continuous && isLyricsEnabled) {
          try {
            recognition.start();
            setIsListening(true);
          } catch (e) {
            console.error('Failed to restart speech recognition', e);
          }
        }
      };
      
      recognitionInitializedRef.current = true;
      return true;
    } catch (e) {
      console.error('Failed to initialize speech recognition', e);
      setError('Failed to initialize speech recognition');
      return false;
    }
  };

  // 外部からの手動制御用
  const startListening = () => {
    if (!isSupported || isListening) return;
    
    if (!recognitionInitializedRef.current) {
      if (!initializeRecognition()) return;
    }
    
    try {
      // 認識オブジェクトの存在確認
      if (!recognitionRef.current) {
        if (!initializeRecognition() || !recognitionRef.current) return;
      }
      
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (e) {
      console.error('Failed to start speech recognition', e);
      setError('Failed to start speech recognition');
    }
  };
  
  const stopListening = () => {
    if (!isSupported || !isListening || !recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Failed to stop speech recognition', e);
    }
  };
  
  // コンポーネントがマウントされたときに初期化
  useEffect(() => {
    // SSR対応
    if (typeof window === 'undefined') return; 
    
    // 初回マウント時にのみ初期化を行う
    if (!recognitionInitializedRef.current) {
      const initialized = initializeRecognition();
      
      // 初期化成功 & 自動開始設定 & 歌詞機能有効なら開始
      if (initialized && autoStart && isLyricsEnabled) {
        startListening();
      }
    }
    
    // コンポーネントのクリーンアップ
    return () => {
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // すでに停止している場合のエラーを無視
        }
      }
    };
  }, [autoStart, initializeRecognition, isListening, isLyricsEnabled, startListening]);
  
  // isLyricsEnabledの変更を監視
  useEffect(() => {
    // SSR対応
    if (typeof window === 'undefined') return;
    
    if (isLyricsEnabled && !isListening && isSupported) {
      startListening();
    } else if (!isLyricsEnabled && isListening) {
      stopListening();
    }
  }, [isLyricsEnabled, isListening, isSupported, startListening, stopListening]);
  
  // UI表示なし（バックグラウンドで動作）
  return null;
};

export default SpeechRecognizer;
