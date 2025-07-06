# V1Z3R デプロイメント後テスト

このドキュメントは、V1Z3Rアプリケーションのデプロイメント後テストプロセスとスクリプトについて説明します。

## 概要

デプロイメント後テストは、本番環境やステージング環境に正常にデプロイされたアプリケーションの動作を検証するプロセスです。

## テストスクリプト

### 1. デプロイメント全般テスト
```bash
# 基本的なデプロイメントテスト
ENVIRONMENT=dev ./scripts/test-deployment.sh

# ステージング環境でのテスト
ENVIRONMENT=staging ./scripts/test-deployment.sh

# 本番環境でのテスト
ENVIRONMENT=prod ./scripts/test-deployment.sh
```

**実行内容:**
- ヘルスチェックAPI (`/api/health`)
- アプリケーション本体の読み込み確認
- 各種APIエンドポイントの疎通確認
- 静的アセットの配信確認
- レスポンス時間の測定

### 2. VJ機能テスト
```bash
# VJ機能の動作確認
TARGET_URL=http://localhost:3000 ./scripts/test-vj-functionality.sh

# ステージング環境での VJ機能テスト
TARGET_URL=https://staging.v1z3r.com ./scripts/test-vj-functionality.sh
```

**実行内容:**
- VJアプリケーションの初期化確認
- Canvas/WebGL レンダリング機能の検証
- コントロールパネルインターフェイスの確認
- リアルタイム機能の動作確認
- パフォーマンスモニタリング機能の確認

### 3. AWS インフラテスト
```bash
# AWS リソースの状態確認
ENVIRONMENT=dev ./scripts/test-aws-deployment.sh

# 本番環境のAWSリソース確認
ENVIRONMENT=prod AWS_REGION=us-east-1 ./scripts/test-aws-deployment.sh
```

**実行内容:**
- CloudFormationスタックの状態確認
- S3バケットの存在確認
- Lambda関数の動作確認
- API Gatewayの設定確認
- DynamoDBテーブルの確認
- CloudWatchログの確認

## テスト環境設定

### 環境変数
```bash
# 基本設定
export ENVIRONMENT=dev|staging|prod
export AWS_REGION=us-east-1
export TARGET_URL=https://your-domain.com

# AWS設定
export AWS_PROFILE=your-profile
export STACK_PREFIX=Vj

# アプリケーション設定
export STAGING_URL=https://staging.v1z3r.com
export PROD_URL=https://v1z3r.com
```

### 前提条件
- AWS CLI がインストールされ、適切に設定されている
- 必要な権限でAWSアカウントにアクセス可能
- curl コマンドが利用可能
- bc コマンドが利用可能（パフォーマンス測定用）

## テスト結果の解釈

### 成功パターン
- ✅ テストが成功した場合
- ⚠️ 警告（動作するが最適でない場合）
- ℹ️ 情報（手動確認が必要な場合）

### 失敗パターン
- ❌ テストが失敗した場合
- エラーメッセージと共にプロセスが終了

## 手動テスト推奨事項

### UI/UX テスト
1. ブラウザでアプリケーションにアクセス
2. コントロールパネルの各操作を確認
3. リアルタイム視覚エフェクトの動作確認
4. オーディオ入出力の動作確認
5. プリセットの保存・読み込み機能確認

### パフォーマンステスト
1. 高負荷時の応答性確認
2. メモリ使用量の監視
3. CPU使用率の監視
4. ネットワーク帯域幅の監視

### セキュリティテスト
1. HTTPS 接続の確認
2. 認証・認可の動作確認
3. XSS/CSRF 対策の確認
4. APIエンドポイントのセキュリティ確認

## トラブルシューティング

### よくある問題

#### 1. ヘルスチェックが失敗する
- アプリケーションが正常に起動していない
- ロードバランサーの設定に問題がある
- セキュリティグループの設定に問題がある

#### 2. 静的アセットが読み込めない
- CDN の設定に問題がある
- S3バケットの権限設定に問題がある
- キャッシュの問題

#### 3. API エンドポイントが応答しない
- Lambda関数の問題
- API Gateway の設定問題
- DynamoDB の権限問題

### デバッグコマンド
```bash
# CloudWatch ログの確認
aws logs tail /aws/lambda/vj-api-function --follow

# API Gateway のテスト
aws apigateway test-invoke-method --rest-api-id YOUR_API_ID --resource-id YOUR_RESOURCE_ID --http-method GET

# DynamoDB テーブルの確認
aws dynamodb describe-table --table-name VjSessionTable-dev
```

## 継続的監視

### CloudWatch メトリクス
- Lambda 関数の実行時間・エラー率
- API Gateway のレスポンス時間・エラー率
- DynamoDB の読み取り・書き込み容量

### アラート設定
- エラー率が閾値を超えた場合のアラート
- レスポンス時間が閾値を超えた場合のアラート
- リソース使用率が閾値を超えた場合のアラート

## 結論

デプロイメント後テストは、アプリケーションの品質と可用性を確保するために重要なプロセスです。定期的にテストを実行し、問題を早期発見することで、ユーザーエクスペリエンスの向上につながります。