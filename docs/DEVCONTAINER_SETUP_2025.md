# DevContainer Setup for v1z3r - 2025

## 概要

v1z3r VJアプリケーションの開発環境をVS Code Dev Containerとして構築しました。Anthropicの[Claude Code DevContainerガイド](https://docs.anthropic.com/ja/docs/claude-code/devcontainer)に基づき、セキュリティとパフォーマンスを重視した設定を実装しています。

## 🚀 主な特徴

### 1. セキュリティ強化
- **コンテナ分離**: Dockerによる開発環境の完全分離
- **最小権限の原則**: デバッグに必要な最小限の機能のみ許可
- **非rootユーザー実行**: `vscode`ユーザーとして動作
- **ブリッジネットワーク**: サービス間の安全な通信

### 2. 開発効率の向上
- **自動セットアップ**: `yarn install`と`yarn build:modules`を自動実行
- **VS Code拡張機能**: ESLint、Prettier、TypeScript等を自動インストール
- **パフォーマンス最適化**: node_modulesとビルドキャッシュに名前付きボリューム使用
- **サービス依存管理**: RedisとPostgreSQLの自動起動順序制御

### 3. 統合サービス
- **Redis**: セッション管理とキャッシュ（オプション）
- **PostgreSQL**: 将来のデータベース需要に対応（オプション）
- **自動接続**: サービス間の接続を自動設定

## 📁 ファイル構成

```
.devcontainer/
├── devcontainer.json      # メイン設定ファイル
├── docker-compose.yml     # マルチサービス構成
├── Dockerfile            # コンテナイメージ定義
├── init-container.sh     # 軽量な初期化スクリプト
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
- **Node.jsツール**: TypeScript, PM2, concurrently（最小構成）
- **メディア処理**: ffmpeg, libvips（VJアプリケーション用）

### VS Code拡張機能
- コード品質: ESLint, Prettier
- フレームワーク: React snippets, Tailwind CSS
- テスト: Jest Runner
- Git: GitLens, Git Graph
- AWS: AWS Toolkit
- その他: Path Intellisense, Todo Highlight

## 🔒 セキュリティ設定

### コンテナセキュリティ
- **分離**: 各サービスは独立したコンテナで実行
- **最小権限**: デバッグに必要なSYS_PTRACEのみ許可
- **非root実行**: vsCodeユーザーでの実行
- **ネットワーク**: Dockerブリッジネットワークによる制御

### アクセス制御
標準的なDocker環境での開発用途：
- パッケージレジストリ (npm, yarn)
- Gitリポジトリ (GitHub, GitLab, Bitbucket)
- AWSサービス (S3, DynamoDB, Lambda等)
- 開発ポート (3000, 6379, 5432)

## 🚨 既知の制限事項

1. **JSONコメント**: `devcontainer.json`にはコメントが含まれていますが、これはVS Code専用の拡張仕様です
2. **初回ビルド**: 初回のコンテナビルドとボリューム作成に時間がかかる場合があります
3. **Docker要件**: 8GB以上のRAMとDocker Desktop/Engineが必要です

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
- Dockerブリッジネットワークでサービス間通信を最適化
- ポートフォワーディングによる外部アクセス制御

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

1. **パフォーマンス最適化**: ビルド時間のさらなる短縮
2. **CI/CD統合**: GitHub ActionsでのDevContainer利用
3. **マルチアーキテクチャサポート**: ARM64対応
4. **テスト自動化**: E2Eテストの統合

## 🤝 貢献方法

DevContainer設定を更新する際は：
1. ローカルで変更をテスト
2. test-devcontainer.shで検証
3. READMEを更新
4. PRを作成し、詳細な説明を記載

---

**作成日**: 2025年1月29日  
**最終更新**: 2025年1月29日（セキュリティとパフォーマンス改善）  
**作成者**: Claude Code System  
**参考**: [Anthropic Claude Code DevContainer Guide](https://docs.anthropic.com/ja/docs/claude-code/devcontainer)

## 📋 変更履歴

### 2025年1月29日 - 設定改善
- **アーキテクチャ**: hostネットワーク→bridgeネットワークに変更
- **セキュリティ**: 複雑なファイアウォール設定を軽量化
- **初期化**: init-firewall.sh → init-container.sh に簡素化
- **依存関係**: サービス起動順序の自動制御を追加
- **設定統合**: 重複設定の整理とクリーンアップ