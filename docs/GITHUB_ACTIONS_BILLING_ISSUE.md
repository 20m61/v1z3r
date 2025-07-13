# GitHub Actions 課金問題対応ガイド

## 現在の状況

GitHub Actionsが以下のエラーで実行できません：
```
The job was not started because recent account payments have failed or your spending limit needs to be increased.
```

## 緊急対応手順

### 1. 課金設定の確認
1. GitHubにログインし、[課金設定](https://github.com/settings/billing)にアクセス
2. 支払い方法を確認・更新
3. 使用制限の設定を確認

### 2. 手動CI/CDの実行
GitHub Actionsが利用できない間は手動でCI/CDを実行：

```bash
# 手動CI検証スクリプトを実行
./scripts/manual-ci-check.sh
```

このスクリプトは以下を実行します：
- TypeScript型チェック
- ESLint
- ユニットテスト
- ビルド検証
- モジュールビルド

### 3. 一時的なワークフロー

#### プルリクエストの検証
```bash
# PRブランチで実行
git checkout feature/deployment-verification
./scripts/manual-ci-check.sh
```

#### デプロイ前の検証
```bash
# メインブランチで実行
git checkout main
./scripts/manual-ci-check.sh
yarn build
```

## 根本的な解決策

### 課金問題の解決
1. **支払い方法の更新**
   - 有効なクレジットカードの登録
   - 残高不足の解消

2. **使用制限の調整**
   - GitHub Actions使用制限の増額
   - 組織レベルでの制限確認

3. **プランの見直し**
   - 必要に応じてGitHub Proまたは組織プランへのアップグレード

### 代替ソリューション

#### 1. セルフホストランナー
```yaml
# .github/workflows/ci-selfhosted.yml
jobs:
  test:
    runs-on: self-hosted
```

#### 2. 外部CI/CDサービス
- CircleCI
- Travis CI
- GitLab CI/CD

#### 3. ローカル開発環境の強化
- pre-commitフックの設定
- ローカルビルド・テストの自動化

## 予防策

### 1. 課金監視
```bash
# 月次使用量確認スクリプトの設定
gh api /user/settings/billing/actions
```

### 2. 効率的なワークフロー
- 不要なワークフロー実行の削減
- キャッシュの活用
- 条件付き実行の設定

### 3. 通知設定
- 課金アラートの設定
- 使用量上限に近づいた際の通知

## チェックリスト

### 即座に実行すべき項目
- [ ] 課金設定ページで支払い状況を確認
- [ ] 手動CI検証スクリプトでPRの品質を確認
- [ ] 支払い方法を更新（必要に応じて）

### 中期的な対応
- [ ] セルフホストランナーの検討
- [ ] ワークフロー効率化の実装
- [ ] 課金監視の自動化

### 長期的な改善
- [ ] 代替CI/CDソリューションの評価
- [ ] 開発プロセスの見直し
- [ ] コスト最適化戦略の策定

## 関連リソース

- [GitHub Actions課金について](https://docs.github.com/ja/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [使用制限の管理](https://docs.github.com/ja/billing/managing-billing-for-github-actions/managing-your-spending-limit-for-github-actions)
- [セルフホストランナー](https://docs.github.com/ja/actions/hosting-your-own-runners)