# セキュリティ改善推奨事項

## 短期対応（次のリリース向け）

### 1. Deploy用IAMユーザーのSecretsManager移行
- 現在：CloudFormation出力でアクセスキー表示
- 改善：AWS Secrets Managerでアクセスキー管理
- 影響：CI/CDパイプラインのセキュリティ向上

### 2. 開発環境URLのパラメータ化
- 現在：ハードコードされた静的URL（jej6yzkbeb）
- 改善：SSM Parameter StoreまたはCfnParameterで管理
- 影響：環境間の移植性向上

## 中期対応（将来のアップグレード向け）

### 3. S3バケット命名の改善
- 現在：アカウントID含有（vj-frontend-dev-822063948773）
- 改善：より機密性の高い命名規則採用
- 影響：本番環境での情報漏洩リスク軽減

### 4. CloudFront導入によるセキュリティ強化
- 現在：S3ダイレクトアクセス
- 改善：CloudFront + OAI/OACでアクセス制御
- 影響：コンテンツ配信のセキュリティ向上

## 実装優先度

1. **High**: SecretsManager移行（次回デプロイ時）
2. **Medium**: URLパラメータ化（v1.1.0）
3. **Low**: バケット命名改善（メジャーアップデート時）
4. **Low**: CloudFront導入（本番運用開始時）

これらの改善事項は、現在の機能実装には影響せず、段階的に導入可能です。