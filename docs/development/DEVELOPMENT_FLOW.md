# V1Z3R Development Flow

## 環境構成

### 1. **Local Development Environment**
- **URL**: `http://localhost:3000`
- **用途**: 開発者個人の開発環境
- **特徴**: 
  - ホットリロード有効
  - 詳細なエラーログ
  - 外部APIへの接続は無効（モック使用）
  - 高速起動・高速ビルド

### 2. **Dev Environment (Development)**
- **URL**: `https://dev.v1z3r.sc4pe.net`
- **API**: `https://vphbflpav3.execute-api.ap-northeast-1.amazonaws.com/dev/`
- **用途**: 開発チームでの統合テスト、機能確認
- **特徴**:
  - 統合AWS環境
  - 実際のAWSサービスとの連携
  - CI/CDパイプラインでの自動デプロイ
  - デバッグ情報有効

### 3. **Production Environment**
- **URL**: `https://v1z3r.sc4pe.net`
- **API**: `https://izn3rhan4m.execute-api.ap-northeast-1.amazonaws.com/prod/`
- **用途**: 本番環境
- **特徴**:
  - 本番用AWS環境
  - 最適化されたビルド
  - 監視・ロギング有効
  - 高可用性設定

## Git Branch Strategy

### Branch Structure
```
main (production ready)
├── develop (development integration)
├── feature/feature-name (feature development)
├── hotfix/hotfix-name (production hotfixes)
└── release/version-name (release preparation)
```

### Development Flow
1. **Feature Development**
   - `feature/feature-name` ブランチを `develop` から作成
   - 機能開発・テスト
   - `develop` ブランチへのPR作成

2. **Integration**
   - `develop` ブランチで統合テスト
   - Dev環境への自動デプロイ
   - 品質チェック

3. **Release**
   - `release/version-name` ブランチを `develop` から作成
   - 最終テスト・調整
   - `main` ブランチへのマージ
   - Production環境への自動デプロイ

4. **Hotfix**
   - `hotfix/hotfix-name` ブランチを `main` から作成
   - 緊急修正
   - `main` と `develop` の両方にマージ

## Development Workflow

### 1. **ローカル開発**
```bash
# 環境構築
yarn install
yarn build:modules

# 開発サーバー起動
yarn dev

# テスト実行
yarn test
yarn test:e2e
```

### 2. **開発環境デプロイ**
```bash
# Dev環境へのデプロイ
yarn deploy:dev

# インフラ更新
yarn infra:dev
```

### 3. **本番環境デプロイ**
```bash
# Production環境へのデプロイ
yarn deploy:prod

# インフラ更新
yarn infra:prod
```

## Environment Variables

### Local Development
```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_ENABLE_CLOUD_STORAGE=false
```

### Dev Environment
```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=https://dev.v1z3r.sc4pe.net
NEXT_PUBLIC_API_URL=https://vphbflpav3.execute-api.ap-northeast-1.amazonaws.com/dev/
NEXT_PUBLIC_ENABLE_CLOUD_STORAGE=true
```

### Production Environment
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://v1z3r.sc4pe.net
NEXT_PUBLIC_API_URL=https://izn3rhan4m.execute-api.ap-northeast-1.amazonaws.com/prod/
NEXT_PUBLIC_ENABLE_CLOUD_STORAGE=true
```

## Quality Gates

### Pre-commit Checks
- ESLint
- TypeScript type checking
- Unit tests
- Module builds

### PR Checks
- All pre-commit checks
- E2E tests
- Build validation
- Performance tests

### Pre-deploy Checks
- Full test suite
- Security scan
- Bundle size analysis
- Performance benchmarks

## Monitoring & Logging

### Development Environment
- CloudWatch Logs
- Error tracking
- Performance metrics
- Debug information

### Production Environment
- CloudWatch Monitoring
- Error alerting
- Performance monitoring
- Usage analytics

## Security

### Development
- Local secrets management
- HTTPS enforcement
- CORS configuration
- Input validation

### Production
- AWS IAM roles
- Encrypted storage
- SSL/TLS encryption
- Security headers

## Performance

### Development
- Fast refresh
- Quick builds
- Memory optimization
- Hot module replacement

### Production
- CDN caching
- Code splitting
- Bundle optimization
- Image optimization

## CI/CD Pipeline

### On Push to Feature Branch
1. Run tests
2. Build application
3. Deploy to preview environment (optional)

### On PR to Develop
1. Run full test suite
2. Build and validate
3. Deploy to dev environment
4. Run E2E tests

### On Merge to Main
1. Run production tests
2. Build production bundle
3. Deploy to production
4. Run smoke tests
5. Monitor deployment

## Tools & Scripts

### Development
- `yarn dev` - Start development server
- `yarn test` - Run tests
- `yarn type-check` - Type checking
- `yarn lint` - Code linting

### Build & Deploy
- `yarn build` - Build application
- `yarn deploy:dev` - Deploy to dev
- `yarn deploy:prod` - Deploy to production

### Infrastructure
- `yarn infra:dev` - Deploy dev infrastructure
- `yarn infra:prod` - Deploy prod infrastructure
- `yarn infra:destroy` - Destroy infrastructure

### Module Management
- `yarn build:modules` - Build all modules
- `yarn test:modules` - Test all modules