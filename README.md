# v1z3r - AI-Powered Professional VJ Application

[English](#english) | [日本語](#japanese)

---

<a name="english"></a>
## 🌟 v1z3r - Next Generation VJ Software

v1z3r is a cutting-edge, AI-powered VJ (Visual Jockey) application with WebGPU acceleration, designed for professional live performances. It features real-time music analysis, intelligent visual adaptation, and industry-standard MIDI controller support.

📚 **[Documentation](https://20m61.github.io/v1z3r/)** | 🎮 **[Demo](https://v1z3r.sc4pe.net)** | 📦 **[NPM Packages](https://www.npmjs.com/org/vj-app)**

### 🚀 Key Features

#### AI & Machine Learning
- **AI Music Analysis**: Real-time tempo, key, mood, and structure detection with TensorFlow.js
- **Neural Style Transfer**: Dynamic visual style adaptation based on music characteristics
- **AI Beat Detection**: Machine learning-enhanced beat tracking with LSTM models
- **Intelligent Visual Mapping**: Automatic music-to-visual parameter generation

#### WebGPU & Performance
- **WebGPU Compute Shaders**: Hardware-accelerated particle simulation (100k+ particles)
- **Advanced Post-Processing**: Real-time bloom, SSAO, motion blur, and chromatic aberration
- **Automatic Fallback**: Seamless WebGL fallback when WebGPU unavailable
- **Memory Optimization**: Efficient resource management and pooling

#### Professional Integration
- **MIDI Controller Support**: Pioneer DDJ, Native Instruments Maschine, Ableton Push, Novation Launchpad
- **Touch-Sensitive Controls**: Velocity and pressure-sensitive pad support
- **Visual Feedback**: RGB LED feedback on compatible controllers
- **Professional Workflow**: Industry-standard parameter mapping

### ✨ Core Features

- **Modular Architecture**: Six independent modules for visual rendering, control, synchronization, storage, lyrics, and real-time collaboration
- **Real-time Audio Analysis**: Advanced FFT analysis, onset detection, and spectral features
- **WebGPU/WebGL Visual Effects**: Hardware-accelerated graphics with Three.js and compute shaders
- **Collaborative Sessions**: Real-time multi-device synchronization via WebSocket
- **Cloud Storage**: AWS-powered preset management with DynamoDB and S3
- **Production-Ready**: Comprehensive error handling, monitoring, and logging
- **Extensive Testing**: 300+ tests including AI/WebGPU feature coverage
- **TypeScript**: Full type safety across all modules

### 🛠️ Tech Stack

**Frontend**
- Next.js 14, React 18, TypeScript
- Three.js, WebGL2/WebGPU, Custom Shaders
- Tailwind CSS, Framer Motion
- Zustand State Management

**Backend & Infrastructure**
- AWS (CDK, Lambda, API Gateway, DynamoDB, S3)
- WebSocket API with auto-reconnection
- Socket.io for real-time collaboration

**Development**
- Yarn Workspaces (Monorepo)
- Jest, React Testing Library, Playwright
- ESLint, Prettier, Husky

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/20m61/v1z3r.git
cd v1z3r

# Install dependencies
yarn install

# Setup environment
cp .env.example .env.local

# Start development server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

### 📁 Project Structure

```
v1z3r/
├── modules/              # Modular architecture
│   ├── visual-renderer/  # WebGL/WebGPU visual engine
│   ├── vj-controller/    # React control interface
│   ├── sync-core/        # WebSocket synchronization
│   ├── preset-storage/   # AWS storage integration
│   └── lyrics-engine/    # Speech recognition
├── src/                  # Main application
│   ├── components/       # React components
│   ├── pages/           # Next.js pages
│   ├── store/           # Zustand store
│   └── utils/           # Utilities
├── infra/               # AWS CDK infrastructure
└── docs/                # Documentation
```

### 🧪 Testing

```bash
# Run all tests
yarn test

# Run specific test suites
yarn test:modules      # Module tests
yarn test:e2e         # E2E tests
yarn test:coverage    # Coverage report
```

### 🚀 Deployment

```bash
# Build for production
yarn build

# Deploy AWS infrastructure
yarn infra:prod
```

### 📖 Documentation

Comprehensive documentation available at [https://20m61.github.io/v1z3r/](https://20m61.github.io/v1z3r/)

### 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<a name="japanese"></a>
## 🌟 v1z3r - 次世代VJソフトウェア

v1z3rは、WebGPUアクセラレーションを搭載した最先端のAI駆動VJ（ビジュアルジョッキー）アプリケーションです。プロフェッショナルなライブパフォーマンス向けに設計され、リアルタイム音楽分析、インテリジェントなビジュアル適応、業界標準のMIDIコントローラーサポートを特徴としています。

📚 **[ドキュメント](https://20m61.github.io/v1z3r/)** | 🎮 **[デモ](https://v1z3r.sc4pe.net)** | 📦 **[NPMパッケージ](https://www.npmjs.com/org/vj-app)**

### 🚀 主な機能

#### AI・機械学習
- **AI音楽分析**: TensorFlow.jsによるリアルタイムのテンポ、キー、ムード、構造検出
- **ニューラルスタイル転送**: 音楽特性に基づく動的なビジュアルスタイル適応
- **AIビート検出**: LSTMモデルによる機械学習強化ビートトラッキング
- **インテリジェントビジュアルマッピング**: 音楽からビジュアルパラメータへの自動生成

#### WebGPU・パフォーマンス
- **WebGPUコンピュートシェーダー**: ハードウェアアクセラレーションによるパーティクルシミュレーション（10万以上のパーティクル）
- **高度なポストプロセッシング**: リアルタイムブルーム、SSAO、モーションブラー、色収差
- **自動フォールバック**: WebGPU非対応時のシームレスなWebGLフォールバック
- **メモリ最適化**: 効率的なリソース管理とプーリング

#### プロフェッショナル統合
- **MIDIコントローラーサポート**: Pioneer DDJ、Native Instruments Maschine、Ableton Push、Novation Launchpad
- **タッチセンシティブコントロール**: ベロシティおよび圧力感知パッドサポート
- **ビジュアルフィードバック**: 対応コントローラーでのRGB LEDフィードバック
- **プロフェッショナルワークフロー**: 業界標準のパラメータマッピング

### ✨ コア機能

- **モジュラーアーキテクチャ**: ビジュアルレンダリング、コントロール、同期、ストレージ、歌詞、リアルタイムコラボレーションのための6つの独立モジュール
- **リアルタイム音声解析**: 高度なFFT分析、オンセット検出、スペクトル特徴
- **WebGPU/WebGLビジュアルエフェクト**: Three.jsとコンピュートシェーダーによるハードウェアアクセラレーショングラフィックス
- **コラボレーティブセッション**: WebSocketによるリアルタイムマルチデバイス同期
- **クラウドストレージ**: DynamoDBとS3を使用したAWS駆動のプリセット管理
- **本番環境対応**: 包括的なエラーハンドリング、モニタリング、ロギング
- **広範なテスト**: AI/WebGPU機能カバレッジを含む300以上のテスト
- **TypeScript**: 全モジュールにわたる完全な型安全性

### 🛠️ 技術スタック

**フロントエンド**
- Next.js 14、React 18、TypeScript
- Three.js、WebGL2/WebGPU、カスタムシェーダー
- Tailwind CSS、Framer Motion
- Zustand状態管理

**バックエンド・インフラ**
- AWS (CDK、Lambda、API Gateway、DynamoDB、S3)
- 自動再接続機能付きWebSocket API
- リアルタイムコラボレーション用Socket.io

**開発環境**
- Yarn Workspaces（モノレポ）
- Jest、React Testing Library、Playwright
- ESLint、Prettier、Husky

### 🚀 クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/20m61/v1z3r.git
cd v1z3r

# 依存関係のインストール
yarn install

# 環境設定
cp .env.example .env.local

# 開発サーバーの起動
yarn dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションを確認できます。

### 📁 プロジェクト構造

```
v1z3r/
├── modules/              # モジュラーアーキテクチャ
│   ├── visual-renderer/  # WebGL/WebGPUビジュアルエンジン
│   ├── vj-controller/    # Reactコントロールインターフェース
│   ├── sync-core/        # WebSocket同期
│   ├── preset-storage/   # AWSストレージ統合
│   └── lyrics-engine/    # 音声認識
├── src/                  # メインアプリケーション
│   ├── components/       # Reactコンポーネント
│   ├── pages/           # Next.jsページ
│   ├── store/           # Zustandストア
│   └── utils/           # ユーティリティ
├── infra/               # AWS CDKインフラ
└── docs/                # ドキュメント
```

### 🧪 テスト

```bash
# 全テストの実行
yarn test

# 特定のテストスイートの実行
yarn test:modules      # モジュールテスト
yarn test:e2e         # E2Eテスト
yarn test:coverage    # カバレッジレポート
```

### 🚀 デプロイ

```bash
# 本番用ビルド
yarn build

# AWSインフラのデプロイ
yarn infra:prod
```

### 📖 ドキュメント

包括的なドキュメントは [https://20m61.github.io/v1z3r/](https://20m61.github.io/v1z3r/) でご覧いただけます。

### 📄 ライセンス

MITライセンス - 詳細は [LICENSE](LICENSE) をご覧ください。