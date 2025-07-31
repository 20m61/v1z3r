# Phase 2: 構造的改善計画

**開始日**: 2025年7月30日  
**目標**: モジュールアーキテクチャ統一、重複解消、テスト安定化

## 🎯 Phase 2 目標

1. **モジュールアーキテクチャ統一**: `/src/components/` と `/modules/*/src/components/` の重複解消
2. **依存関係最適化**: `@vj-app/*` パッケージへの完全移行
3. **テストスイート安定化**: 統合テスト成功率向上
4. **型定義統一**: 分散した型定義の一元化

## 📊 現状分析

### 重複コンポーネント一覧
```
src/components/              modules/*/src/components/
├── AudioAnalyzer.tsx       ← vj-controller/AudioAnalyzer.tsx
├── LayerManager.tsx        ← vj-controller/LayerManager.tsx  
├── LyricsControl.tsx       ← lyrics-engine/LyricsControl.tsx
├── LyricsVisualizer.tsx    ← lyrics-engine/LyricsVisualizer.tsx
├── SpeechRecognizer.tsx    ← lyrics-engine/SpeechRecognizer.tsx
└── ui/
    ├── Button.tsx          ← ui-components/Button.tsx
    ├── ColorPicker.tsx     ← ui-components/ColorPicker.tsx
    └── Slider.tsx          ← ui-components/Slider.tsx
```

### 統合戦略

#### 🏗️ Architecture Decision: modules/ を権威ソースとする

**理由**:
1. モジュール間の疎結合設計に適合
2. 再利用性の向上
3. 型安全性の確保
4. テスタビリティの向上

#### 📦 統合優先順位

##### Priority 1: UI Components (即座実行)
```typescript
// Before: 重複インポート
import { Button } from '@/components/ui/Button';
import { Button } from '@vj-app/ui-components';

// After: 統一インポート  
import { Button } from '@vj-app/ui-components';
```

##### Priority 2: Feature Components
```typescript
// 移行対象
src/components/AudioAnalyzer.tsx → @vj-app/vj-controller
src/components/LayerManager.tsx → @vj-app/vj-controller
```

##### Priority 3: Specialized Components
```typescript
// 移行対象
src/components/LyricsControl.tsx → @vj-app/lyrics-engine
src/components/VisualEffects.tsx → @vj-app/visual-renderer
```

## 🔧 実装手順

### Step 1: UI Components 統合 (15分)

1. **src/components/ui/ 削除準備**
```bash
# 依存関係確認
grep -r "from '@/components/ui" src/
grep -r "from '../ui'" src/components/

# 置換実行
find src/ -name "*.tsx" -exec sed -i "s/@\/components\/ui/@vj-app\/ui-components/g" {} \;
```

2. **削除実行**
```bash
rm -rf src/components/ui/
```

### Step 2: Feature Components 統合 (30分)

#### AudioAnalyzer 統合
```bash
# 1. 依存関係を @vj-app/vj-controller に移行
# 2. src/components/AudioAnalyzer.tsx 削除
# 3. インポートを置換
find src/ -name "*.tsx" -exec sed -i "s/@\/components\/AudioAnalyzer/@vj-app\/vj-controller/g" {} \;
```

#### LayerManager 統合  
```bash
# 同様の手順で統合
```

### Step 3: テスト統合 (20分)

```bash
# 重複テストファイル統合
# src/components/__tests__/ → modules/*/src/components/__tests__/
```

### Step 4: 型定義統合 (15分)

```typescript
// 分散型定義を modules/types/src/ に集約
// 各モジュールからの参照を統一
```

## 🧪 テスト安定化計画

### 統合テスト修正項目

#### modules.test.ts 修正
```typescript
// 1. Mock設定の改善
const mockCanvas = {
  getContext: jest.fn().mockReturnValue(mockContext),
  // ...other methods
};

// 2. ID生成の統一
const MOCK_PRESET_ID = 'preset-123';
const mockRepository = {
  create: jest.fn().mockResolvedValue({ id: MOCK_PRESET_ID }),
  // ...
};
```

#### AudioContext Mock改善
```typescript
// aiVJMaster.test.ts 修正
const mockAudioContext = {
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 2048,
    smoothingTimeConstant: 0.0,
    // ...all required properties
  }),
};
```

#### WebGPU Mock強化
```typescript
// dynamicImports.test.tsx 修正
Object.defineProperty(global.navigator, 'gpu', {
  value: {
    requestAdapter: jest.fn().mockResolvedValue(mockAdapter),
  },
  configurable: true,
});
```

## 📋 検証チェックリスト

### ✅ ビルド検証
- [ ] `yarn build:modules` 成功
- [ ] `yarn type-check` エラー0件
- [ ] `yarn build` 成功
- [ ] バンドルサイズ < 2MB

### ✅ テスト検証
- [ ] UI コンポーネントテスト 100% 成功
- [ ] 統合テスト成功率 > 80%
- [ ] E2E テスト基本フロー成功

### ✅ 機能検証
- [ ] 開発サーバー起動 (`yarn dev`)
- [ ] 基本UI表示確認
- [ ] コンポーネント相互作用確認

## 🎯 成功指標

### Phase 2 完了条件
1. **重複コンポーネント削除率**: 100%
2. **統合テスト成功率**: 85%+ (現在: ~70%)
3. **ビルドエラー**: 0件
4. **型エラー**: 0件
5. **バンドルサイズ削減**: 10%+

### 品質向上指標
- **開発体験**: インポート文の一貫性
- **保守性**: 単一責任の原則適用
- **テスタビリティ**: モック設定の簡素化
- **パフォーマンス**: 重複排除によるサイズ最適化

## ⚠️ リスク軽減策

### 高リスク項目
1. **大量インポート変更**: 段階的実行で影響最小化
2. **テスト破綻**: 各ステップ後の検証実施
3. **機能回帰**: 動作確認の徹底

### 緊急時対応
1. **ロールバック**: `git checkout -- .` でステップ単位復旧
2. **段階的修正**: 1コンポーネントずつの細かい修正
3. **テスト駆動**: 修正前にテスト期待値調整

---

**開始時刻**: 2025年7月30日 現在  
**推定完了**: 90分後  
**次フェーズ**: Phase 3 - 品質・パフォーマンス向上

🤖 Generated with [Claude Code](https://claude.ai/code)