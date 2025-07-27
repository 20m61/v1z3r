# プルリクエストガイドライン

## 目的
効率的なコードレビューと品質維持のため、適切なサイズのプルリクエスト作成を推進します。

## PR サイズの基準

### 理想的なPRサイズ
- **変更行数**: 200-400行以下
- **変更ファイル数**: 10ファイル以下
- **レビュー時間**: 30分以内で完了可能

### PRタイプ別の推奨サイズ

| PRタイプ | 推奨行数 | 最大行数 | 例 |
|---------|---------|---------|---|
| バグ修正 | 10-50 | 100 | エラー処理の修正 |
| 小機能追加 | 50-200 | 400 | 新しいボタンの追加 |
| リファクタリング | 100-300 | 500 | コンポーネントの整理 |
| 新機能実装 | 200-400 | 800 | 新しいモジュール |
| 設定変更 | 10-100 | 200 | CI/CD設定の更新 |

## 大規模変更の分割方法

### 1. 機能単位での分割
```
❌ 悪い例: 「VJアプリケーション全体の実装」（26,000行）

✅ 良い例:
- PR #1: 基本的なプロジェクト構造とセットアップ（200行）
- PR #2: visual-rendererモジュールの基本実装（400行）
- PR #3: WebGLレンダリング機能の追加（300行）
- PR #4: vj-controllerモジュールの実装（350行）
- ...
```

### 2. レイヤー別の分割
```
1. インフラストラクチャ層
   - AWS CDKスタックの定義
   - CI/CD設定

2. バックエンド層
   - APIエンドポイント
   - データモデル

3. フロントエンド層
   - UIコンポーネント
   - 状態管理

4. テスト層
   - ユニットテスト
   - E2Eテスト
```

### 3. 段階的な実装
```
Phase 1: MVP（最小限の動作）
- 基本的な機能のみ実装
- 必須のテストのみ

Phase 2: 機能拡張
- 追加機能の実装
- エラーハンドリング

Phase 3: 最適化
- パフォーマンス改善
- UX向上
```

## PRの作成手順

### 1. 事前準備
- [ ] 機能の設計ドキュメントを作成
- [ ] タスクを小さな単位に分解
- [ ] 依存関係を明確化

### 2. ブランチ戦略
```bash
# 機能全体のベースブランチ
git checkout -b feature/vj-application

# 個別のPR用サブブランチ
git checkout -b feature/vj-application/visual-renderer
git checkout -b feature/vj-application/controller
git checkout -b feature/vj-application/sync-core
```

### 3. コミット戦略
- 1つのコミット = 1つの論理的な変更
- コミットメッセージは明確に
- 適切な粒度でコミット

## PRテンプレート

```markdown
## 概要
<!-- 変更の概要を2-3文で説明 -->

## 変更内容
<!-- 具体的な変更内容をリスト形式で -->
- [ ] 機能A の実装
- [ ] テストの追加
- [ ] ドキュメントの更新

## 変更の種類
- [ ] バグ修正
- [ ] 新機能
- [ ] リファクタリング
- [ ] ドキュメント
- [ ] その他

## テスト
<!-- 実施したテストを記載 -->
- [ ] ユニットテスト追加/更新
- [ ] 手動テスト実施
- [ ] E2Eテスト確認

## スクリーンショット
<!-- UIの変更がある場合は必須 -->

## レビューポイント
<!-- レビュアーに特に見てほしい箇所 -->

## 関連Issue/PR
<!-- 関連するIssueやPRへのリンク -->
- Fixes #123
- Related to #456
```

## レビュープロセス

### レビュアーの責任
1. **30分以内**でレビュー完了を目指す
2. 建設的なフィードバックを提供
3. ブロッカーとなる問題を明確に指摘

### 作成者の責任
1. PR作成前にセルフレビュー実施
2. CIがグリーンになってからレビュー依頼
3. レビューコメントに迅速に対応

## 大規模PRが必要な場合

### 許容される例外
1. **初期セットアップ**: プロジェクトの初期構築
2. **自動生成コード**: OpenAPIやGraphQLスキーマからの生成
3. **大規模リファクタリング**: 事前に合意済みの場合

### 例外時の対応
1. 事前にチームと相談
2. PRを複数のコミットに分割し、コミット単位でレビュー
3. ペアプログラミングやモブレビューの実施

## ツールとの連携

### 1. GitHub設定
```yaml
# .github/settings.yml
repository:
  default_branch: main

labels:
  - name: size/XS
    description: "< 10 lines"
    color: "00ff00"
  - name: size/S
    description: "10-100 lines"
    color: "7fff00"
  - name: size/M
    description: "100-500 lines"
    color: "ffff00"
  - name: size/L
    description: "500-1000 lines"
    color: "ff7f00"
  - name: size/XL
    description: "> 1000 lines"
    color: "ff0000"
```

### 2. CI/CDでのチェック
```yaml
# .github/workflows/pr-size-check.yml
name: PR Size Check
on: pull_request

jobs:
  size-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check PR size
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request;
            if (pr.additions + pr.deletions > 800) {
              core.setFailed('PR is too large. Please split into smaller PRs.');
            }
```

## ベストプラクティス

### Do's ✅
- 早期に頻繁にPRを作成
- 機能フラグを使用して段階的にリリース
- レビュー前にセルフレビューを実施
- 明確なPRタイトルと説明を記載

### Don'ts ❌
- 複数の機能を1つのPRに含める
- "WIP"のまま長期間放置
- レビューコメントを無視
- テストなしでPRを作成

## 参考リンク
- [Google's Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [Best Practices for Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
- [The Art of Small Pull Requests](https://www.swarmia.com/blog/art-of-small-pull-requests/)

## 更新履歴
- 2025-07-05: 初版作成