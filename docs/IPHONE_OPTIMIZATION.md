# iPhone最適化ドキュメント

## 概要

v1z3rのiPhone最適化により、iOS/Safariの特有の制約に対応し、モバイルデバイスで最高のパフォーマンスとユーザー体験を提供します。

## 主要機能

### 📱 デバイス検出・最適化
- **自動デバイス検出**: iPhone/iPad/iPod touchの自動識別
- **モデル識別**: 画面サイズとUser-Agentによる精密なモデル検出
- **パフォーマンス分析**: デバイス性能に基づく最適化設定
- **Safe Area対応**: ノッチ付きデバイスの安全エリア自動調整

### 🎵 iOS特化オーディオ処理
- **ユーザー操作必須対応**: iOS AudioContextの制約に適応
- **最適化された設定**: デバイス別の最適なオーディオ設定
- **音声中断処理**: 電話着信などの音声中断への対応
- **バッテリー最適化**: バックグラウンド時の音声処理自動停止

### 👆 タッチ最適化UI
- **マルチタッチ対応**: 最大5点同時タッチでの高度なコントロール
- **ジェスチャー認識**: スワイプ、ピンチ、タップの直感的な操作
- **触覚フィードバック**: Haptic Engine対応でのフィードバック
- **フローティングコントロール**: 必要時のみ表示される最小限UI

### 📐 画面向き・ビューポート対応
- **動的レイアウト**: 縦横画面の自動対応
- **キーボード検出**: 仮想キーボード表示時の自動調整
- **Visual Viewport対応**: iOS Safari独自のビューポート処理
- **画面回転対応**: スムーズな画面回転アニメーション

## アーキテクチャ

### コアコンポーネント

#### iOS Detection (`iosDetection.ts`)
```typescript
// 使用例
const deviceInfo = iosDetector.detectDevice();
console.log(deviceInfo.model); // "iPhone 14 Pro"
console.log(deviceInfo.performanceProfile); // "high"
console.log(deviceInfo.hasNotch); // true
```

#### iOS Audio Handler (`iosAudioHandler.ts`)
```typescript
// 使用例
await iosAudioHandler.initialize();
await iosAudioHandler.unlockAudioContext();
await iosAudioHandler.startMicrophone();
```

#### Touch Controls (`TouchControls.tsx`)
```typescript
// 使用例
<TouchControls
  onParameterChange={(param, value) => {
    console.log(`${param}: ${value}`);
  }}
/>
```

#### Device Orientation Hook (`useDeviceOrientation.ts`)
```typescript
// 使用例
const { orientation, motion, requestMotionPermission } = useDeviceOrientation();
```

### パフォーマンス最適化

#### Mobile Performance Optimizer (`mobilePerformanceOptimizer.ts`)
- **適応品質調整**: リアルタイムFPS監視による自動品質調整
- **バッテリー最適化**: バッテリー残量に応じた省電力モード
- **熱管理**: CPU使用率監視による過熱防止
- **メモリ管理**: JavaScriptヒープサイズ監視

```typescript
// 使用例
const optimizer = mobilePerformanceOptimizer;
await optimizer.initialize();

// 品質プリセット設定
optimizer.setQualityPreset('high'); // 'low', 'medium', 'high'

// パフォーマンス指標取得
const metrics = optimizer.getMetrics();
console.log(`FPS: ${metrics.currentFPS}`);
console.log(`CPU: ${metrics.cpuUsage * 100}%`);
```

## サポートデバイス

### iPhone
- **iPhone 15 シリーズ**: 最高品質 (100万パーティクル@60fps)
- **iPhone 14 シリーズ**: 高品質 (50万パーティクル@60fps)
- **iPhone 13 シリーズ**: 高品質 (50万パーティクル@60fps)
- **iPhone 12 シリーズ**: 高品質 (50万パーティクル@60fps)
- **iPhone 11 シリーズ**: 中品質 (25万パーティクル@30fps)
- **iPhone X シリーズ**: 中品質 (25万パーティクル@30fps)
- **iPhone SE/6-8 シリーズ**: 低品質 (10万パーティクル@30fps)

### iPad
- **iPad Pro**: 最高品質 (WebGL2対応)
- **iPad Air**: 高品質
- **iPad (第9世代以降)**: 中品質
- **iPad mini**: 中品質

### iOS バージョン
- **iOS 16+**: 全機能対応
- **iOS 15**: 基本機能対応
- **iOS 14**: 制限付き対応
- **iOS 13**: 最小限対応

## 使用方法

### 基本セットアップ
```tsx
import { MobileVisualizerLayout } from '@/components/mobile/MobileVisualizerLayout';

function App() {
  return (
    <MobileVisualizerLayout>
      <YourVisualizer />
    </MobileVisualizerLayout>
  );
}
```

### PWA インストール
```tsx
import { PWAInstallPrompt } from '@/components/mobile/PWAInstallPrompt';

function App() {
  return (
    <>
      <YourApp />
      <PWAInstallPrompt
        onInstall={() => console.log('PWA installed')}
        onDismiss={() => console.log('PWA dismissed')}
      />
    </>
  );
}
```

### モバイル専用ページ
```tsx
// pages/mobile-demo.tsx
import MobileVisualizerLayout from '@/components/mobile/MobileVisualizerLayout';

export default function MobileDemoPage() {
  return (
    <MobileVisualizerLayout>
      <WebGLVisualizer />
    </MobileVisualizerLayout>
  );
}
```

## パフォーマンス特性

### レンダリング性能
- **iPhone 15 Pro**: 100万パーティクル@60fps
- **iPhone 14 Pro**: 50万パーティクル@60fps
- **iPhone 12**: 25万パーティクル@60fps
- **iPhone 11**: 25万パーティクル@30fps
- **iPhone SE**: 10万パーティクル@30fps

### オーディオ処理
- **サンプリングレート**: 44.1-48kHz (デバイス依存)
- **バッファサイズ**: 512-2048サンプル (デバイス依存)
- **レイテンシ**: 10-50ms (デバイス依存)
- **FFT分析**: リアルタイム (2048サンプル)

### メモリ使用量
- **基本システム**: 20-50MB
- **パーティクル (100万個)**: 64MB追加
- **オーディオバッファ**: 4-8MB
- **テクスチャ**: 10-20MB

## 制約事項

### iOS Safari制約
- **WebGPU**: 未対応 (WebGL2で代替)
- **オーディオ**: ユーザー操作必須
- **フルスクリーン**: 制限付き対応
- **ファイルアクセス**: 制限あり
- **バックグラウンド**: 自動停止

### パフォーマンス制約
- **CPU使用率**: 95%以上で自動品質低下
- **メモリ**: 使用量80%以上で最適化
- **バッテリー**: 20%以下で省電力モード
- **温度**: 過熱検出で品質低下

## トラブルシューティング

### 音声が出ない
```typescript
// 解決方法
await iosAudioHandler.unlockAudioContext();
await iosAudioHandler.startMicrophone();
```

### パフォーマンスが低い
```typescript
// 品質を手動で下げる
mobilePerformanceOptimizer.setQualityPreset('low');
```

### 画面がカクつく
```typescript
// 適応品質を有効化
mobilePerformanceOptimizer.updateConfig({
  enableAdaptiveQuality: true,
  targetFPS: 30
});
```

### タッチが反応しない
```css
/* CSS最適化 */
.touch-element {
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}
```

## 開発者向けツール

### デバッグモード
```typescript
// 開発時のデバッグ情報表示
const deviceInfo = iosDetector.detectDevice();
console.log('Device Info:', deviceInfo);

const metrics = mobilePerformanceOptimizer.getMetrics();
console.log('Performance:', metrics);
```

### パフォーマンス監視
```typescript
// リアルタイムパフォーマンス監視
setInterval(() => {
  const metrics = mobilePerformanceOptimizer.getMetrics();
  console.log(`FPS: ${metrics.currentFPS.toFixed(0)}`);
  console.log(`CPU: ${(metrics.cpuUsage * 100).toFixed(0)}%`);
}, 1000);
```

### 品質調整
```typescript
// 手動品質調整
const qualitySettings = mobilePerformanceOptimizer.getQualitySettings();
qualitySettings.particleCount = 50000;
qualitySettings.renderScale = 0.8;
```

## 最適化のベストプラクティス

### 1. 段階的品質向上
```typescript
// 低品質から開始し、徐々に向上
optimizer.setQualityPreset('low');
setTimeout(() => {
  if (optimizer.getMetrics().averageFPS > 55) {
    optimizer.setQualityPreset('medium');
  }
}, 5000);
```

### 2. バッテリー配慮
```typescript
// バッテリー残量に応じた最適化
if (metrics.batteryLevel < 0.2) {
  optimizer.setQualityPreset('low');
}
```

### 3. メモリリーク防止
```typescript
// コンポーネントアンマウント時の確実なクリーンアップ
useEffect(() => {
  return () => {
    iosAudioHandler.destroy();
    mobilePerformanceOptimizer.destroy();
  };
}, []);
```

### 4. タッチ最適化
```typescript
// タッチイベントの適切な処理
const handleTouch = useCallback((e: TouchEvent) => {
  e.preventDefault(); // デフォルト動作を防止
  // カスタムタッチ処理
}, []);
```

## 今後の拡張予定

### 短期計画
- **iOS 17対応**: 新機能への対応
- **WebGPU準備**: Safari対応時の準備
- **Vision Pro対応**: 空間コンピューティング対応

### 中長期計画
- **Machine Learning**: Core ML統合
- **ARKit連携**: AR表示機能
- **SharePlay対応**: 共有体験機能

## ライセンス

この iPhone最適化機能は v1z3r プロジェクトの一部として同じライセンス条項に従います。