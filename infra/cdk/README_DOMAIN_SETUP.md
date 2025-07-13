# v1z3r ドメイン設定ガイド

## 概要
v1z3rプロジェクトで`v1z3r.sc4pe.net`サブドメインを使用するための設定手順です。

## 変更内容

### 1. ドメイン設定の更新
- 開発環境: `localhost:3000` (CloudFrontなし、コスト削減)
- ステージング環境: `staging.v1z3r.sc4pe.net`
- 本番環境: `v1z3r.sc4pe.net`

### 2. コスト最適化
- 開発環境ではCloudFrontを無効化（S3直接アクセス）
- ステージング環境のバックアップを無効化
- Route53のホストゾーンは既存の`sc4pe.net`を利用

## デプロイ手順

### 1. 開発環境（ローカルテスト用）
```bash
cd infra/cdk
cdk deploy --all --context stage=dev
```

### 2. ステージング環境
```bash
cd infra/cdk
cdk deploy --all --context stage=staging --profile staging
```

### 3. 本番環境
```bash
cd infra/cdk
cdk deploy --all --context stage=prod --profile prod
```

## DNS設定の確認

デプロイ前に、Route53で以下のレコードが作成されることを確認してください：

### ステージング環境
- `staging.v1z3r.sc4pe.net` → CloudFront Distribution

### 本番環境
- `v1z3r.sc4pe.net` → CloudFront Distribution
- `www.v1z3r.sc4pe.net` → CloudFront Distribution

## コスト削減のポイント

1. **開発環境**
   - CloudFront無効化でディストリビューション費用を削減
   - S3の静的ホスティングのみ使用

2. **ステージング環境**
   - バックアップ無効化でストレージコストを削減
   - CloudFrontはPriceClass100（北米・欧州のみ）を使用

3. **本番環境**
   - 必要な機能のみ有効化
   - CloudFrontのログは90日で自動削除

## 注意事項

1. ACM証明書は`us-east-1`リージョンで作成される必要があります（CloudFront用）
2. 初回デプロイ時はDNS検証のため、証明書の発行に時間がかかる場合があります
3. `sc4pe.net`のRoute53ホストゾーンへの書き込み権限が必要です

## トラブルシューティング

### 証明書の検証が失敗する場合
```bash
# Route53のホストゾーンIDを確認
aws route53 list-hosted-zones | grep -A2 "sc4pe.net"

# 手動でCNAMEレコードを追加（ACMコンソールから取得）
aws route53 change-resource-record-sets --hosted-zone-id Z0281489QLSEH8WJ4U8S \
  --change-batch file://dns-validation.json
```

### デプロイが失敗する場合
```bash
# スタックの状態を確認
cdk list --context stage=prod

# 個別のスタックをデプロイ
cdk deploy VjConfigStack-prod --context stage=prod --profile prod
cdk deploy VjStorageStack-prod --context stage=prod --profile prod
cdk deploy VjApiStack-prod --context stage=prod --profile prod
cdk deploy VjStaticHostingStack-prod --context stage=prod --profile prod
```