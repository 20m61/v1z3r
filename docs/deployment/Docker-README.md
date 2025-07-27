# 🐳 v1z3r Docker Environment

Docker環境を使用してv1z3r VJアプリケーションをデプロイ・検証できます。

## 🚀 クイックスタート

### 開発環境（推奨）
```bash
# 簡単な開発環境を起動
docker-compose -f docker-compose.simple.yml up -d

# アプリケーションにアクセス
open http://localhost:3000
```

### 自動セットアップスクリプト
```bash
# スクリプトに実行権限を付与
chmod +x scripts/docker-setup.sh

# 開発環境を起動
./scripts/docker-setup.sh dev

# 本番環境を起動
./scripts/docker-setup.sh prod

# 完全なスタック（Nginx付き）を起動
./scripts/docker-setup.sh full
```

## 📋 利用可能な環境

### 1. 開発環境（ホットリロード付き）
```bash
docker-compose -f docker-compose.simple.yml up -d
```
- **ポート**: 3000
- **特徴**: ホットリロード、開発用設定
- **用途**: 開発・デバッグ

### 2. 本番環境
```bash
docker-compose up -d v1z3r-app
```
- **ポート**: 3000
- **特徴**: 最適化ビルド、本番用設定
- **用途**: 本番デプロイテスト

### 3. 完全スタック（Nginx付き）
```bash
docker-compose --profile production up -d
```
- **ポート**: 80, 443
- **特徴**: Nginx リバースプロキシ、SSL対応
- **用途**: 本番環境シミュレーション

## 🛠️ 管理コマンド

### 状態確認
```bash
# コンテナ状態確認
docker-compose ps

# ログ確認
docker-compose logs -f

# ヘルスチェック
curl http://localhost:3000/api/health
```

### サービス管理
```bash
# サービス停止
docker-compose down

# 完全クリーンアップ
docker-compose down -v --rmi all
docker system prune -f
```

### テスト実行
```bash
# コンテナ内でテスト実行
docker-compose exec v1z3r-simple yarn test

# E2Eテスト実行
docker-compose exec v1z3r-simple yarn test:e2e
```

## 📊 ヘルスチェック

アプリケーションの健康状態は以下のエンドポイントで確認できます：

```bash
curl http://localhost:3000/api/health
```

レスポンス例：
```json
{
  "status": "ok",
  "timestamp": "2025-06-29T14:07:31.943Z",
  "uptime": 15.34,
  "version": "0.1.0",
  "memory": {
    "used": 82,
    "total": 103,
    "percentage": 80
  }
}
```

## 🔧 カスタマイズ

### 環境変数
```bash
# docker-compose.yml に環境変数を追加
environment:
  - NODE_ENV=production
  - CUSTOM_API_URL=http://api.example.com
  - DEBUG=true
```

### ポート変更
```bash
# ポート3001で起動する場合
ports:
  - "3001:3000"
```

### ボリュームマウント
```bash
# ローカル開発用
volumes:
  - .:/app
  - /app/node_modules
```

## 🚨 トラブルシューティング

### よくある問題

1. **ポートが使用中**
   ```bash
   # ポートを変更して起動
   docker-compose up -d --scale v1z3r-simple=0
   # または既存のプロセスを停止
   lsof -ti:3000 | xargs kill
   ```

2. **メモリ不足**
   ```bash
   # Dockerリソース制限を確認・調整
   docker system df
   docker system prune -f
   ```

3. **依存関係エラー**
   ```bash
   # キャッシュクリア後に再ビルド
   docker-compose down -v
   docker-compose build --no-cache
   ```

### ログ確認
```bash
# 詳細ログ確認
docker-compose logs -f --tail=100 v1z3r-simple

# エラーのみ表示
docker-compose logs | grep -i error
```

## 🔒 セキュリティ

### 本番環境での推奨事項

1. **環境変数ファイル使用**
   ```bash
   # .env.production ファイルを作成
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   ```

2. **非rootユーザー実行**
   ```dockerfile
   USER nextjs  # Dockerfileで既に設定済み
   ```

3. **Nginxセキュリティヘッダー**
   ```nginx
   # docker/nginx.conf で設定済み
   add_header X-Frame-Options "SAMEORIGIN";
   add_header X-Content-Type-Options "nosniff";
   ```

## 📈 パフォーマンス

### 最適化のヒント

1. **マルチステージビルド使用** ✅
2. **生産依存関係のみインストール** ✅
3. **静的ファイルキャッシュ** ✅
4. **Gzip圧縮** ✅

### リソース制限
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
    reservations:
      cpus: '1'
      memory: 512M
```

## 🤝 サポート

問題が発生した場合：

1. **ログ確認**: `docker-compose logs -f`
2. **ヘルスチェック**: `curl http://localhost:3000/api/health`
3. **リソース確認**: `docker system df`
4. **完全リセット**: `./scripts/docker-setup.sh cleanup`

---

🎉 **v1z3r VJアプリケーションのDocker環境が正常に構築されました！**