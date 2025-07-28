# DevContainer Setup for v1z3r - 2025

## 概要

v1z3r VJアプリケーションの開発環境をVS Code Dev Containerとして構築しました。Anthropicの[Claude Code DevContainerガイド](https://docs.anthropic.com/ja/docs/claude-code/devcontainer)に基づき、セキュリティとパフォーマンスを重視した設定を実装しています。

## 🚀 主な特徴

### 1. セキュリティ強化
- **カスタムファイアウォール**: ホワイトリストベースのネットワークアクセス制御
- **最小権限の原則**: 必要なサービスのみへのアクセスを許可
- **非rootユーザー実行**: `vscode`ユーザーとして動作

### 2. 開発効率の向上
- **自動セットアップ**: `yarn install`と`yarn build:modules`を自動実行
- **VS Code拡張機能**: ESLint、Prettier、TypeScript等を自動インストール
- **パフォーマンス最適化**: node_modulesとビルドキャッシュに名前付きボリューム使用

### 3. 統合サービス
- **Redis**: セッション管理とキャッシュ（オプション）
- **PostgreSQL**: 将来のデータベース需要に対応（オプション）

## 📁 ファイル構成

```
.devcontainer/
├── devcontainer.json      # メイン設定ファイル
├── docker-compose.yml     # マルチサービス構成
├── Dockerfile            # コンテナイメージ定義
├── init-firewall.sh      # セキュリティファイアウォールスクリプト
├── test-devcontainer.sh  # 検証テストスクリプト
├── .env.devcontainer     # 環境変数テンプレート
├── .gitignore           # Git除外設定
└── README.md            # 詳細なセットアップ手順
```

## 🔧 技術仕様

### ベースイメージ
- Node.js 20 (mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm)

### インストール済みツール
- **開発ツール**: git, ZSH (Oh My Zsh), fzf, ripgrep, bat, vim
- **AWSツール**: AWS CLI, AWS CDK
- **Node.jsツール**: TypeScript, PM2, concurrently
- **メディア処理**: ffmpeg, libvips（VJアプリケーション用）

### VS Code拡張機能
- コード品質: ESLint, Prettier
- フレームワーク: React snippets, Tailwind CSS
- テスト: Jest Runner
- Git: GitLens, Git Graph
- AWS: AWS Toolkit
- その他: Path Intellisense, Todo Highlight

## 🔒 セキュリティ設定

### ネットワークアクセス制御
許可されたアクセス先：
- パッケージレジストリ (npm, yarn)
- Gitリポジトリ (GitHub, GitLab, Bitbucket)
- AWSサービス (S3, DynamoDB, Lambda, CloudFormation, STS)
- ローカル開発ポート (3000, 6379)

### ファイアウォールルール
- デフォルトポリシー: すべて拒否
- ホワイトリスト方式でのアクセス許可
- ドロップされたパケットのログ記録

## 🚨 既知の制限事項

1. **JSONコメント**: `devcontainer.json`にはコメントが含まれていますが、これはVS Code専用の拡張仕様です
2. **ファイアウォール**: 現在の設定では自動起動されません（手動実行が必要）
3. **ボリューム**: 初回ビルド時に時間がかかる場合があります

## 📊 パフォーマンス最適化

### ボリューム戦略
```yaml
volumes:
  - ../:/workspace:cached          # ソースコードはcachedマウント
  - node-modules:/workspace/node_modules  # 高速化のため名前付きボリューム
  - next-cache:/workspace/.next          # ビルドキャッシュも分離
  - yarn-cache:/home/vscode/.cache/yarn  # Yarnキャッシュの永続化
```

### ネットワークモード
- `network_mode: host`により、開発時のネットワークパフォーマンスを向上

## 🧪 検証方法

### 自動テストスクリプト
```bash
.devcontainer/test-devcontainer.sh
```

このスクリプトは以下を検証：
- 環境変数とツールのインストール
- プロジェクト設定の妥当性
- ネットワーク接続性
- ビルドプロセス

## 📝 使用方法

### 前提条件
1. VS Code インストール済み
2. Remote - Containers 拡張機能インストール済み
3. Docker Desktop (Windows/Mac) または Docker Engine (Linux)
4. 最低8GBのRAMをDockerに割り当て

### セットアップ手順
1. VS Codeでプロジェクトを開く
2. 「Reopen in Container」の通知をクリック
3. 初回ビルド完了を待つ（5-10分）
4. 自動的に開発サーバーが起動

## 🔄 今後の改善案

1. **ファイアウォールの自動化**: entrypointでの自動実行
2. **キャッシュ戦略の最適化**: ビルド時間のさらなる短縮
3. **CI/CD統合**: GitHub ActionsでのDevContainer利用
4. **マルチアーキテクチャサポート**: ARM64対応

## 🤝 貢献方法

DevContainer設定を更新する際は：
1. ローカルで変更をテスト
2. test-devcontainer.shで検証
3. READMEを更新
4. PRを作成し、詳細な説明を記載

---

**作成日**: 2025年1月29日  
**作成者**: Claude Code System  
**参考**: [Anthropic Claude Code DevContainer Guide](https://docs.anthropic.com/ja/docs/claude-code/devcontainer)