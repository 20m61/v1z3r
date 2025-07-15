import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
const SyntaxHighlighter = require('react-syntax-highlighter').Prism
const vscDarkPlus = require('react-syntax-highlighter/dist/cjs/styles/prism').vscDarkPlus

export default function Developer() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Developer <span className="gradient-text">Guide</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12">
            v1z3rの開発環境構築からモジュール開発、デプロイまでの完全ガイド。
          </p>

          {/* Development Setup */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">開発環境のセットアップ</h2>
            
            <div className="card mb-6">
              <h3 className="text-xl font-semibold mb-4">必要なツール</h3>
              <ul className="space-y-2 text-gray-400">
                <li>• Node.js v18+ (nvm推奨)</li>
                <li>• Yarn v1.22+</li>
                <li>• Git</li>
                <li>• VSCode (推奨エディタ)</li>
                <li>• AWS CLI (インフラ開発用)</li>
              </ul>
            </div>

            <div className="card mb-6">
              <h3 className="text-xl font-semibold mb-4">VSCode拡張機能</h3>
              <SyntaxHighlighter language="json" style={vscDarkPlus} className="rounded-lg">
{`{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "styled-components.vscode-styled-components"
  ]
}`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Project Structure */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">プロジェクト構造</h2>
            
            <div className="card">
              <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`v1z3r/
├── src/                    # メインアプリケーション
│   ├── components/         # UIコンポーネント
│   ├── pages/             # Next.jsページ
│   ├── store/             # Zustand状態管理
│   └── utils/             # ユーティリティ関数
├── modules/               # モジュラーアーキテクチャ
│   ├── visual-renderer/   # レンダリングエンジン
│   ├── vj-controller/     # コントロールUI
│   ├── sync-core/         # WebSocket同期
│   ├── preset-storage/    # AWS統合
│   └── lyrics-engine/     # 音声認識
├── infra/                 # AWS CDKインフラ
│   └── cdk/              
├── tests/                 # テストスイート
│   ├── unit/             
│   ├── integration/      
│   └── e2e/              
└── docs/                  # ドキュメント`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Module Development */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">モジュール開発</h2>
            
            <div className="card mb-6">
              <h3 className="text-xl font-semibold mb-4">新しいモジュールの作成</h3>
              <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg mb-4">
{`# モジュールディレクトリを作成
mkdir -p modules/my-module
cd modules/my-module

# package.jsonを作成
yarn init -y`}
              </SyntaxHighlighter>

              <h4 className="font-medium mb-2 mt-6">モジュールのpackage.json</h4>
              <SyntaxHighlighter language="json" style={vscDarkPlus} className="rounded-lg">
{`{
  "name": "@vj-app/my-module",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "three": "^0.157.0"
  }
}`}
              </SyntaxHighlighter>
            </div>

            <div className="card">
              <h3 className="text-xl font-semibold mb-4">モジュール間の依存関係</h3>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// modules/my-module/src/index.ts
import { VisualRenderer } from '@vj-app/visual-renderer';
import { SyncClient } from '@vj-app/sync-core';

export class MyModule {
  private renderer: VisualRenderer;
  private sync: SyncClient;

  constructor(config: MyModuleConfig) {
    this.renderer = new VisualRenderer(config.canvas);
    this.sync = new SyncClient(config.syncUrl);
  }

  async init() {
    await this.renderer.init();
    await this.sync.connect();
  }
}`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Testing */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">テスト戦略</h2>
            
            <div className="card mb-6">
              <h3 className="text-xl font-semibold mb-4">ユニットテスト</h3>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// src/utils/__tests__/audioAnalyzer.test.ts
import { AudioAnalyzer } from '../audioAnalyzer';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  test('detects beat correctly', () => {
    const mockData = new Float32Array(1024).fill(0.8);
    const result = analyzer.analyze(mockData);
    
    expect(result.beatDetected).toBe(true);
    expect(result.average).toBeCloseTo(0.8);
  });
});`}
              </SyntaxHighlighter>
            </div>

            <div className="card">
              <h3 className="text-xl font-semibold mb-4">E2Eテスト</h3>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// tests/e2e/vj-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('complete VJ workflow', async ({ page }) => {
  // アプリケーションを起動
  await page.goto('http://localhost:3000');
  
  // VJアプリケーションを開始
  await page.click('text=Launch VJ Application');
  
  // エフェクトを選択
  await page.click('[data-testid="effects-tab"]');
  await page.click('[data-testid="effect-particles"]');
  
  // パラメータを調整
  await page.locator('[data-testid="intensity-slider"]').fill('0.8');
  
  // ビジュアルが表示されることを確認
  await expect(page.locator('canvas')).toBeVisible();
});`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* AWS Deployment */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">AWS展開</h2>
            
            <div className="card mb-6">
              <h3 className="text-xl font-semibold mb-4">CDKスタック構成</h3>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// infra/cdk/lib/vj-unified-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class VjUnifiedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3バケット（静的ホスティング）
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true
    });

    // DynamoDB（プリセット保存）
    const presetsTable = new dynamodb.Table(this, 'PresetsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'presetId', type: dynamodb.AttributeType.STRING }
    });

    // API Gateway（WebSocket）
    const webSocketApi = new apigateway.WebSocketApi(this, 'WebSocketApi', {
      connectRouteOptions: { integration: connectIntegration },
      disconnectRouteOptions: { integration: disconnectIntegration }
    });
  }
}`}
              </SyntaxHighlighter>
            </div>

            <div className="card">
              <h3 className="text-xl font-semibold mb-4">デプロイコマンド</h3>
              <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# 開発環境へのデプロイ
yarn infra:dev

# ステージング環境
yarn infra:staging

# 本番環境
yarn infra:prod

# スタックの削除
yarn infra:destroy`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Performance Optimization */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">パフォーマンス最適化</h2>
            
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">メモリ管理</h3>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// src/utils/memoryManager.ts
export class MemoryManager {
  private pools: Map<string, any[]> = new Map();

  // オブジェクトプールの実装
  getFromPool<T>(type: string, factory: () => T): T {
    const pool = this.pools.get(type) || [];
    
    if (pool.length > 0) {
      return pool.pop() as T;
    }
    
    return factory();
  }

  returnToPool(type: string, obj: any) {
    const pool = this.pools.get(type) || [];
    pool.push(obj);
    this.pools.set(type, pool);
  }

  // Three.jsジオメトリの再利用
  reuseGeometry(geometry: THREE.BufferGeometry) {
    geometry.dispose();
    this.returnToPool('geometry', geometry);
  }
}`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Contributing */}
          <section>
            <h2 className="text-3xl font-bold mb-8">コントリビューション</h2>
            
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">プルリクエストのガイドライン</h3>
              <ol className="space-y-3 text-gray-400">
                <li>
                  <strong className="text-white">1. Issue作成</strong>
                  <p>まず関連するIssueを作成し、実装方針を議論します。</p>
                </li>
                <li>
                  <strong className="text-white">2. ブランチ作成</strong>
                  <p><code className="text-vj-accent">feature/your-feature-name</code>形式でブランチを作成。</p>
                </li>
                <li>
                  <strong className="text-white">3. テスト作成</strong>
                  <p>新機能には必ずテストを追加してください（カバレッジ70%以上）。</p>
                </li>
                <li>
                  <strong className="text-white">4. コミット規約</strong>
                  <p>Conventional Commits形式：<code className="text-vj-primary">feat:</code>, <code className="text-vj-secondary">fix:</code>, <code className="text-vj-accent">docs:</code></p>
                </li>
                <li>
                  <strong className="text-white">5. PR作成</strong>
                  <p>テンプレートに従って詳細な説明を記載。</p>
                </li>
              </ol>

              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-300">
                  <strong>注意:</strong> GitHub Actionsが無効の場合は、<code className="text-vj-accent">./scripts/manual-ci-check.sh</code>でローカルCI検証を実行してください。
                </p>
              </div>
            </div>
          </section>
        </motion.div>
      </div>
    </Layout>
  )
}