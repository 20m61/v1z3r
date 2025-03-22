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
const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

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
  
  const {
    isLyricsEnabled,
    updateCurrentLyrics,
    updateNextLyrics,
    lyricsConfidence,
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
    for (let i = 0; i < result.length; i++) {
      const { transcript, confidence } = result[i];
      const filteredText = filterNoise(transcript.trim());
      
      // 信頼性が高く、ノイズではない場合に採用
      if (filteredText && confidence > bestConfidence && confidence >= minConfidence) {
        bestText = filteredText;
        bestConfidence = confidence;
      }
    }
    
    return { text: bestText, confidence: bestConfidence };
  };

  useEffect(() => {
    // Web Speech APIのサポート確認
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech Recognition API is not supported in this browser.');
      return;
    }
    
    setIsSupported(true);
    
    // 音声認識インスタンスの作成
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
    
    // コンポーネントがマウントされたときに自動起動
    if (autoStart && isLyricsEnabled) {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start speech recognition', e);
      }
    }
    
    // クリーンアップ
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  // isLyricsEnabledが変更されたときにも再評価
  }, [lang, continuous, autoStart, interimResults, maxAlternatives, noiseFilter, minConfidence, isLyricsEnabled]);
  
  // 外部からの手動制御用
  const startListening = () => {
    if (!isSupported || isListening || !recognitionRef.current) return;
    
    try {
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
  
  // isLyricsEnabledの変更を監視
  useEffect(() => {
    if (isLyricsEnabled && !isListening && isSupported) {
      startListening();
    } else if (!isLyricsEnabled && isListening) {
      stopListening();
    }
  }, [isLyricsEnabled]);
  
  // UI表示なし（バックグラウンドで動作）
  return null;
};

export default SpeechRecognizer;
