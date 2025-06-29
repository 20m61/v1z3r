# GitHub Secrets Configuration Guide

このドキュメントでは、v1z3r VJアプリケーションのCI/CDパイプラインで使用するGitHub Secretsの設定方法を説明します。

## Secretsの設定方法

1. GitHubリポジトリページで `Settings` → `Secrets and variables` → `Actions` にアクセス
2. `New repository secret` をクリック
3. 以下の各Secretを設定

---

## 必須Secrets

### AWS関連

#### `AWS_ACCESS_KEY_ID`
**説明**: AWS リソースへのアクセス用のアクセスキーID  
**用途**: CDKデプロイ、S3アップロード、DynamoDB操作  
**取得方法**:
1. AWS Console にログイン
2. `IAM` → `Users` → 対象ユーザー → `Security credentials`
3. `Create access key` をクリック
4. `Command Line Interface (CLI)` を選択
5. 生成されたAccess Key IDをコピー

**必要なIAM権限**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "apigateway:*",
        "iam:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### `AWS_SECRET_ACCESS_KEY`
**説明**: AWS アクセスキーに対応するシークレットキー  
**用途**: AWS認証の完了  
**取得方法**: 上記と同じ手順で、Secret Access Keyをコピー

#### `AWS_REGION`
**説明**: AWSリソースをデプロイするリージョン  
**用途**: CDKデプロイ先の指定  
**設定値例**: `ap-northeast-1` (東京)、`us-east-1` (バージニア北部)

#### `AWS_DEPLOY_ROLE_STAGING`
**説明**: ステージング環境デプロイ用のIAMロールARN  
**用途**: セキュアなデプロイメント実行  
**形式例**: `arn:aws:iam::123456789012:role/VJ-Deploy-Staging-Role`

#### `AWS_DEPLOY_ROLE_PROD`
**説明**: 本番環境デプロイ用のIAMロールARN  
**用途**: セキュアなデプロイメント実行  
**形式例**: `arn:aws:iam::123456789012:role/VJ-Deploy-Production-Role`

---

### GitHub関連

#### `GITHUB_TOKEN`
**説明**: GitHub API アクセス用のパーソナルアクセストークン  
**用途**: CI/CDパイプライン、リポジトリ操作  
**取得方法**:
1. GitHub Settings → `Developer settings` → `Personal access tokens` → `Tokens (classic)`
2. `Generate new token (classic)` をクリック
3. 必要なスコープを選択:
   - `repo` (フルアクセス)
   - `read:org` (組織情報読み取り)
   - `workflow` (ワークフロー操作)
4. トークンをコピー（一度しか表示されません）

**注意**: デフォルトの`GITHUB_TOKEN`は自動提供されますが、権限が限定的です。

#### `CODECOV_TOKEN`
**説明**: Codecov コードカバレッジサービス用トークン  
**用途**: テストカバレッジレポートのアップロード  
**取得方法**:
1. [Codecov](https://codecov.io) にGitHubアカウントでログイン
2. リポジトリを追加
3. Settings → Repository Upload Token をコピー

---

## セキュリティ・品質管理Secrets

#### `SNYK_TOKEN`
**説明**: Snyk セキュリティスキャンサービス用トークン  
**用途**: 依存関係の脆弱性スキャン  
**取得方法**:
1. [Snyk](https://snyk.io) にアカウント作成・ログイン
2. Account settings → General → Auth Token をコピー

#### `SONAR_TOKEN`
**説明**: SonarCloud コード品質分析用トークン  
**用途**: コード品質、セキュリティ分析  
**取得方法**:
1. [SonarCloud](https://sonarcloud.io) にGitHubアカウントでログイン
2. リポジトリをインポート
3. Administration → Security → Generate Token

---

## 通知・監視Secrets（オプション）

#### `SLACK_WEBHOOK_URL`
**説明**: Slack通知用のWebhook URL  
**用途**: デプロイ状況、エラー通知  
**取得方法**:
1. Slack ワークスペースで `Apps` → `Incoming Webhooks` を追加
2. チャンネルを選択
3. Webhook URLをコピー

#### `DISCORD_WEBHOOK_URL`
**説明**: Discord通知用のWebhook URL  
**用途**: デプロイ状況、エラー通知  
**取得方法**:
1. Discordサーバーの対象チャンネルで `設定` → `連携サービス`
2. `ウェブフック` → `ウェブフックを作成`
3. ウェブフックURLをコピー

#### `SENTRY_DSN`
**説明**: Sentry エラー監視サービス用DSN  
**用途**: 本番環境でのエラー追跡  
**取得方法**:
1. [Sentry](https://sentry.io) にアカウント作成
2. プロジェクトを作成（React/Next.js）
3. Settings → Client Keys (DSN) をコピー

---

## 外部サービス連携Secrets（オプション）

#### `OPENAI_API_KEY`
**説明**: OpenAI API アクセス用キー  
**用途**: AI機能、音声認識拡張  
**取得方法**:
1. [OpenAI Platform](https://platform.openai.com) にアカウント作成
2. API keys → Create new secret key
3. キーをコピー（一度しか表示されません）

---

## データベース・ストレージSecrets（オプション）

#### `DATABASE_URL`
**説明**: 本番データベース接続文字列  
**用途**: 外部データベース利用時  
**形式例**: `postgresql://username:password@host:port/database`

#### `REDIS_URL`
**説明**: Redis キャッシュサーバー接続URL  
**用途**: セッション管理、キャッシュ  
**形式例**: `redis://username:password@host:port`

---

## セキュリティのベストプラクティス

### 1. 最小権限の原則
- 各Secretには必要最小限の権限のみを付与
- 定期的な権限の見直し

### 2. ローテーション
- アクセスキーとトークンの定期的な更新
- 90日ごとの見直しを推奨

### 3. 監査
- Secret使用ログの定期確認
- 不審なアクセスの検出

### 4. 分離
- 開発/ステージング/本番環境で異なるSecret使用
- 環境ごとのアクセス制御

---

## トラブルシューティング

### よくある問題

1. **AWS権限エラー**
   - IAM権限が不足している場合は、上記の必要権限を確認
   - CloudFormationスタック作成権限が特に重要

2. **GitHub Token権限不足**
   - `repo`スコープが必要
   - Organization のリポジトリの場合は組織の承認が必要

3. **Codecov アップロード失敗**
   - トークンの有効性を確認
   - リポジトリの可視性設定を確認

### 設定確認方法

```bash
# AWS認証テスト
aws sts get-caller-identity

# GitHub トークンテスト
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# 環境変数確認（ローカル開発時）
echo $AWS_ACCESS_KEY_ID
```

#### `STAGING_URL`
**説明**: ステージング環境のアプリケーションURL  
**用途**: デプロイ後のスモークテスト  
**形式例**: `https://staging.v1z3r.example.com`

#### `PRODUCTION_URL`
**説明**: 本番環境のアプリケーションURL  
**用途**: デプロイ後のスモークテスト  
**形式例**: `https://v1z3r.example.com`

---

## 設定完了チェックリスト

### 最小構成（必須）
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `AWS_REGION`

### 推奨構成（CI/CD強化）
- [ ] `GITHUB_TOKEN`
- [ ] `CODECOV_TOKEN`
- [ ] `SNYK_TOKEN`
- [ ] `AWS_DEPLOY_ROLE_STAGING`
- [ ] `AWS_DEPLOY_ROLE_PROD`

### フル構成（監視・通知）
- [ ] 上記すべて
- [ ] `SLACK_WEBHOOK_URL`
- [ ] `SENTRY_DSN`
- [ ] `STAGING_URL`
- [ ] `PRODUCTION_URL`

---

## 関連ドキュメント

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [CI/CD Pipeline Configuration](./CI_CD_PIPELINE.md)
- [Deployment Guide](./DEPLOYMENT.md)