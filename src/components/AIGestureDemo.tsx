/**
 * AI Gesture Recognition Demo Component
 * ジェスチャー認識システムのデモンストレーション
 */

import React, { useState, useEffect } from 'react';
import { useAIGestureRecognition, GestureRecognitionResult, VJGestureAction, GestureType } from '@/utils/aiGestureRecognition';

interface GestureVisualizationProps {
  gesture: GestureRecognitionResult | null;
  action: VJGestureAction | null;
}

const GestureVisualization: React.FC<GestureVisualizationProps> = ({ gesture, action }) => {
  const getGestureEmoji = (gestureType: GestureType): string => {
    const emojiMap: Record<GestureType, string> = {
      // Hand gestures
      'fist': '✊',
      'open_palm': '✋',
      'peace': '✌️',
      'thumbs_up': '👍',
      'thumbs_down': '👎',
      'pointing': '👉',
      'ok_sign': '👌',
      'rock_on': '🤘',
      'call_me': '🤙',
      'stop': '🛑',
      
      // Two-hand gestures
      'clap': '👏',
      'spread_arms': '🤗',
      'hands_together': '🙏',
      'push_away': '🤚',
      'pull_in': '🫷',
      
      // Body poses
      'arms_up': '🙌',
      'arms_down': '🤲',
      'lean_left': '↖️',
      'lean_right': '↗️',
      'jump': '🦘',
      'squat': '🏋️',
      'dance_move': '💃',
      'air_drum': '🥁',
      'air_scratch': '🎧',
      
      // Special VJ gestures
      'cross_fade': '🎚️',
      'volume_knob': '🔊',
      'filter_sweep': '🎛️',
      'beat_drop': '💥'
    };
    
    return emojiMap[gestureType] || '🤔';
  };

  const getActionDescription = (action: VJGestureAction): string => {
    switch (action.type) {
      case 'EFFECT_CHANGE':
        return `エフェクト変更: ${action.target} → ${action.value}`;
      case 'VOLUME_CONTROL':
        return `音量制御: ${action.value > 0 ? '+' : ''}${action.value}`;
      case 'COLOR_ADJUST':
        return `色調整: ${action.target} → ${action.value}`;
      case 'BEAT_CONTROL':
        return `ビート制御: ${action.value}`;
      case 'LAYER_CONTROL':
        return `レイヤー制御: ${action.value}`;
      case 'CAMERA_CONTROL':
        return `カメラ制御: ${action.target} → ${action.value}`;
      default:
        return 'Unknown action';
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900 to-blue-900 p-6 rounded-lg text-white">
      <h3 className="text-xl font-bold mb-4">🎭 Gesture Recognition</h3>
      
      {gesture ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-6xl mb-2">
              {getGestureEmoji(gesture.gesture)}
            </div>
            <div className="text-2xl font-semibold">
              {gesture.gesture}
            </div>
            <div className="text-sm opacity-75">
              信頼度: {(gesture.confidence * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>検出時刻:</strong><br />
              {new Date(gesture.timestamp).toLocaleTimeString()}
            </div>
            <div>
              <strong>手の数:</strong><br />
              {gesture.hands.length}
            </div>
            <div>
              <strong>ポーズ検出:</strong><br />
              {gesture.pose ? '✅' : '❌'}
            </div>
            <div>
              <strong>処理遅延:</strong><br />
              {Date.now() - gesture.timestamp}ms
            </div>
          </div>
          
          {action && (
            <div className="mt-4 p-3 bg-black bg-opacity-30 rounded">
              <strong>🎯 VJアクション:</strong><br />
              {getActionDescription(action)}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">👋</div>
          <p>ジェスチャーを認識中...</p>
        </div>
      )}
    </div>
  );
};

export const AIGestureDemo: React.FC = () => {
  const {
    isRecognizing,
    lastGesture,
    lastAction,
    error,
    startRecognition,
    stopRecognition,
    isSupported
  } = useAIGestureRecognition({
    modelType: 'lite',
    enableBodyTracking: true,
    enableHandTracking: true,
    realTimeMode: true
  });

  const [gestureHistory, setGestureHistory] = useState<GestureRecognitionResult[]>([]);
  const [actionHistory, setActionHistory] = useState<VJGestureAction[]>([]);

  useEffect(() => {
    if (lastGesture) {
      setGestureHistory(prev => [lastGesture, ...prev.slice(0, 4)]);
    }
  }, [lastGesture]);

  useEffect(() => {
    if (lastAction) {
      setActionHistory(prev => [lastAction, ...prev.slice(0, 4)]);
    }
  }, [lastAction]);

  if (!isSupported) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <strong>⚠️ カメラアクセスがサポートされていません</strong>
        <p>このブラウザではジェスチャー認識機能を使用できません。</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          🤖 AI Gesture Recognition Demo
        </h2>
        <p className="text-gray-600">
          VJ操作のためのリアルタイムジェスチャー認識システム
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>エラー:</strong> {error}
        </div>
      )}

      <div className="flex justify-center space-x-4">
        <button
          onClick={startRecognition}
          disabled={isRecognizing}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRecognizing ? '🔴 認識中...' : '🎥 認識開始'}
        </button>
        
        <button
          onClick={stopRecognition}
          disabled={!isRecognizing}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⏹️ 認識停止
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* メインビジュアライゼーション */}
        <div className="lg:col-span-2">
          <GestureVisualization gesture={lastGesture} action={lastAction} />
        </div>

        {/* ジェスチャー履歴 */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">📋 ジェスチャー履歴</h3>
          <div className="space-y-2">
            {gestureHistory.length > 0 ? (
              gestureHistory.map((gesture, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {gesture.gesture === 'fist' ? '✊' : gesture.gesture === 'open_palm' ? '✋' : '👋'}
                    </span>
                    <span className="font-medium">{gesture.gesture}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {(gesture.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">ジェスチャーを認識すると履歴が表示されます</p>
            )}
          </div>
        </div>

        {/* VJアクション履歴 */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">🎯 VJアクション履歴</h3>
          <div className="space-y-2">
            {actionHistory.length > 0 ? (
              actionHistory.map((action, index) => (
                <div key={index} className="p-2 bg-blue-50 rounded">
                  <div className="font-medium text-blue-800">
                    {action.type.replace('_', ' ')}
                  </div>
                  <div className="text-sm text-blue-600">
                    {action.target ? `${action.target}: ` : ''}{action.value}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">VJアクションが実行されると履歴が表示されます</p>
            )}
          </div>
        </div>
      </div>

      {/* ジェスチャーガイド */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4">📖 ジェスチャーガイド</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { gesture: '✊', name: 'フィスト', action: 'パーティクル爆発' },
            { gesture: '✋', name: 'オープンパーム', action: 'ウェーブエフェクト' },
            { gesture: '✌️', name: 'ピース', action: 'スパイラル' },
            { gesture: '👍', name: 'サムズアップ', action: '音量アップ' },
            { gesture: '👎', name: 'サムズダウン', action: '音量ダウン' },
            { gesture: '👏', name: 'クラップ', action: 'ビート同期' },
            { gesture: '🙌', name: '両手上げ', action: 'エネルギー最大' },
            { gesture: '🤘', name: 'ロックオン', action: 'エフェクト強化' }
          ].map((item, index) => (
            <div key={index} className="text-center p-3 border rounded-lg hover:bg-gray-50">
              <div className="text-2xl mb-1">{item.gesture}</div>
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs text-gray-500">{item.action}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>💡 ヒント: カメラに向かってジェスチャーをしてください。認識精度は照明と背景によって変わります。</p>
      </div>
    </div>
  );
};