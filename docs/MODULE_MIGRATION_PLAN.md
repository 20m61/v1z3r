# srcからmodulesへの移行計画

## 概要
`src/components`配下のコンポーネントを適切な`modules`配下に移行し、モジュラーアーキテクチャを完成させる。

## 現状分析

### src/components の構成
```
src/components/
├── AudioAnalyzer.tsx          # 音声解析
├── ControlPanel.tsx           # コントロールパネル  
├── LayerManager.tsx           # レイヤー管理
├── LyricsControl.tsx          # 歌詞制御
├── LyricsVisualizer.tsx       # 歌詞表示
├── PresetShare.tsx            # プリセット共有
├── SpeechRecognizer.tsx       # 音声認識
├── VisualEffects.tsx          # ビジュアルエフェクト
└── ui/                        # 基本UIコンポーネント
    ├── Button.tsx
    ├── ColorPicker.tsx
    ├── Slider.tsx
    └── Tabs.tsx
```

### modules の現状
```
modules/
├── lyrics-engine/             # 歌詞関連機能
├── preset-storage/            # プリセット保存機能
├── sync-core/                 # 同期機能
├── visual-renderer/           # ビジュアル描画
└── vj-controller/             # 制御インターフェース
```

## 移行マップ

### Phase 1: 重複コンポーネントの統合 (優先度: 高)

| srcコンポーネント | 移行先モジュール | 重複状況 | アクション |
|------------------|----------------|----------|-----------|
| `ControlPanel.tsx` | `vj-controller` | ✅ 重複あり | src版を削除、modules版を使用 |
| `AudioAnalyzer.tsx` | `vj-controller` | ✅ 重複あり | src版を削除、modules版を使用 |
| `LayerManager.tsx` | `vj-controller` | ❌ src版のみ | modules版に移行 |
| `LyricsControl.tsx` | `lyrics-engine` | ✅ 重複あり | src版を削除、modules版を使用 |
| `LyricsVisualizer.tsx` | `lyrics-engine` | ✅ 重複あり | src版を削除、modules版を使用 |
| `SpeechRecognizer.tsx` | `lyrics-engine` | ✅ 重複あり | src版を削除、modules版を使用 |

### Phase 2: 単一コンポーネントの移行 (優先度: 中)

| srcコンポーネント | 移行先モジュール | 理由 |
|------------------|----------------|------|
| `VisualEffects.tsx` | `visual-renderer` | ビジュアル描画に関連 |
| `PresetShare.tsx` | `preset-storage` | プリセット機能に関連 |

### Phase 3: UIコンポーネントの統合 (優先度: 低)

| srcコンポーネント | 移行先モジュール | 理由 |
|------------------|----------------|------|
| `ui/Button.tsx` | `vj-controller` | ✅ 重複あり |
| `ui/ColorPicker.tsx` | `vj-controller` | ✅ 重複あり |
| `ui/Slider.tsx` | `vj-controller` | ✅ 重複あり |
| `ui/Tabs.tsx` | `vj-controller` | ✅ 重複あり |

## 実装手順

### Step 1: 依存関係の分析
1. 各コンポーネントの import/export を調査
2. 相互依存関係をマップ化
3. 移行順序を決定

### Step 2: モジュール間のインターフェース統一
1. 共通の型定義を `shared/types` に移動
2. モジュール間通信の仕様を策定
3. エクスポート/インポートパスを統一

### Step 3: 段階的移行
1. **Week 1**: Phase 1 - 重複コンポーネントの統合
2. **Week 2**: Phase 2 - 単一コンポーネントの移行  
3. **Week 3**: Phase 3 - UIコンポーネントの統合

### Step 4: テストとドキュメント更新
1. 移行後のテスト実行と修正
2. import パスの更新
3. ドキュメントの更新

## リスク管理

### 高リスク
- **循環依存**: モジュール間の循環参照を避ける
- **テスト破綻**: 移行に伴うテストの修正が必要

### 対策
- 移行前に依存関係グラフを作成
- 移行後に全テストを実行して検証
- 段階的リリースで影響を最小化

## 成功指標

### 技術指標
- [ ] src/components ディレクトリの完全削除
- [ ] 全テストが正常に動作
- [ ] モジュール間の循環依存がゼロ
- [ ] ビルド時間の短縮

### 品質指標  
- [ ] コードの重複率 < 5%
- [ ] モジュールの独立性スコア > 80%
- [ ] ドキュメントカバレッジ > 90%

## 次ステップ

1. **即座に実行**: ControlPanel の移行試験
2. **1週間以内**: Phase 1 の完了
3. **2週間以内**: Phase 2 の完了
4. **3週間以内**: 全移行の完了

---

*このドキュメントは移行の進捗に応じて更新されます。*