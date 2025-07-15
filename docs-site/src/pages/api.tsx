import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
const SyntaxHighlighter = require('react-syntax-highlighter').Prism
const vscDarkPlus = require('react-syntax-highlighter/dist/cjs/styles/prism').vscDarkPlus

export default function API() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            API <span className="gradient-text">Reference</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12">
            v1z3rのモジュールAPIリファレンス。カスタムエフェクトや拡張機能の開発に活用してください。
          </p>

          {/* Core Modules */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Core Modules</h2>

            {/* Visual Renderer */}
            <div className="card mb-8">
              <h3 className="text-2xl font-semibold mb-4 text-vj-primary">@vj-app/visual-renderer</h3>
              <p className="text-gray-400 mb-6">WebGL/Three.jsベースのビジュアルレンダリングエンジン</p>
              
              <h4 className="text-lg font-medium mb-3">VisualRenderer Class</h4>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg mb-6">
{`import { VisualRenderer } from '@vj-app/visual-renderer';

const renderer = new VisualRenderer({
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  width: 1920,
  height: 1080,
  antialias: true
});

// Initialize renderer
await renderer.init();

// Set effect
renderer.setEffect('particles', {
  count: 10000,
  color: '#ff00ff',
  speed: 1.0
});

// Update with audio data
renderer.updateAudioData(audioData);

// Render frame
renderer.render();`}
              </SyntaxHighlighter>

              <h4 className="text-lg font-medium mb-3">Methods</h4>
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-vj-accent">init(): Promise&lt;void&gt;</code>
                  <p className="text-gray-400 mt-2">レンダラーを初期化します。WebGLコンテキストの作成とリソースのロードを行います。</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-vj-accent">setEffect(type: EffectType, params?: EffectParams): void</code>
                  <p className="text-gray-400 mt-2">エフェクトタイプとパラメータを設定します。</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-vj-accent">updateAudioData(data: AudioData): void</code>
                  <p className="text-gray-400 mt-2">オーディオデータを更新し、エフェクトに反映させます。</p>
                </div>
              </div>
            </div>

            {/* VJ Controller */}
            <div className="card mb-8">
              <h3 className="text-2xl font-semibold mb-4 text-vj-secondary">@vj-app/vj-controller</h3>
              <p className="text-gray-400 mb-6">Reactベースのコントロールインターフェース</p>
              
              <SyntaxHighlighter language="tsx" style={vscDarkPlus} className="rounded-lg mb-6">
{`import { ControlPanel, useController } from '@vj-app/vj-controller';

function MyVJApp() {
  const { params, updateParam, setEffect } = useController();

  return (
    <ControlPanel
      onParamChange={(name, value) => updateParam(name, value)}
      onEffectChange={(effect) => setEffect(effect)}
      audioAnalyzer={audioAnalyzer}
    />
  );
}`}
              </SyntaxHighlighter>

              <h4 className="text-lg font-medium mb-3">Hooks</h4>
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-vj-accent">useController()</code>
                  <p className="text-gray-400 mt-2">コントローラーの状態と操作関数を提供するReact Hook</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-vj-accent">useAudioAnalyzer()</code>
                  <p className="text-gray-400 mt-2">オーディオ解析データへのアクセスを提供するHook</p>
                </div>
              </div>
            </div>

            {/* Sync Core */}
            <div className="card mb-8">
              <h3 className="text-2xl font-semibold mb-4 text-vj-accent">@vj-app/sync-core</h3>
              <p className="text-gray-400 mb-6">WebSocketベースのリアルタイム同期システム</p>
              
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg mb-6">
{`import { SyncClient } from '@vj-app/sync-core';

const sync = new SyncClient({
  serverUrl: 'wss://api.v1z3r.app',
  roomId: 'live-session-001',
  reconnect: true
});

// Connect to room
await sync.connect();

// Send parameter update
sync.sendUpdate({
  type: 'param',
  name: 'intensity',
  value: 0.8
});

// Listen for updates
sync.on('update', (data) => {
  console.log('Received:', data);
});`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* Custom Effects */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Creating Custom Effects</h2>
            
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">カスタムシェーダーエフェクト</h3>
              
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg mb-6">
{`import { Effect, ShaderMaterial } from '@vj-app/visual-renderer';

export class MyCustomEffect extends Effect {
  private material: ShaderMaterial;

  constructor() {
    super('my-custom-effect');
    
    this.material = new ShaderMaterial({
      vertexShader: \`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform float time;
        uniform float audioLevel;
        varying vec2 vUv;
        
        void main() {
          vec3 color = vec3(vUv.x, vUv.y, audioLevel);
          color *= sin(time * 2.0) * 0.5 + 0.5;
          gl_FragColor = vec4(color, 1.0);
        }
      \`,
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 }
      }
    });
  }

  update(deltaTime: number, audioData: AudioData) {
    this.material.uniforms.time.value += deltaTime;
    this.material.uniforms.audioLevel.value = audioData.average;
  }
}`}
              </SyntaxHighlighter>

              <h4 className="text-lg font-medium mb-3">エフェクトの登録</h4>
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// Register custom effect
renderer.registerEffect(new MyCustomEffect());

// Use the effect
renderer.setEffect('my-custom-effect');`}
              </SyntaxHighlighter>
            </div>
          </section>

          {/* WebSocket API */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">WebSocket API</h2>
            
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">メッセージフォーマット</h3>
              
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg mb-6">
{`// Client -> Server
interface ClientMessage {
  type: 'join' | 'update' | 'leave';
  roomId: string;
  data?: {
    paramName?: string;
    paramValue?: any;
    effectType?: string;
  };
}

// Server -> Client
interface ServerMessage {
  type: 'joined' | 'update' | 'userJoined' | 'userLeft' | 'error';
  userId?: string;
  data?: any;
  timestamp: number;
}`}
              </SyntaxHighlighter>

              <h4 className="text-lg font-medium mb-3">接続フロー</h4>
              <ol className="space-y-3 text-gray-400">
                <li>1. WebSocket接続を確立</li>
                <li>2. <code className="text-vj-primary">join</code>メッセージでルームに参加</li>
                <li>3. パラメータ更新時に<code className="text-vj-secondary">update</code>メッセージを送信</li>
                <li>4. 他のクライアントからの更新を受信して反映</li>
              </ol>
            </div>
          </section>

          {/* Types */}
          <section>
            <h2 className="text-3xl font-bold mb-8">Type Definitions</h2>
            
            <div className="card">
              <SyntaxHighlighter language="typescript" style={vscDarkPlus} className="rounded-lg">
{`// Effect Types
export type EffectType = 
  | 'particles'
  | 'waves' 
  | 'fractal'
  | 'kaleidoscope'
  | 'tunnel'
  | 'grid'
  | 'sphere'
  | 'custom';

// Audio Data
export interface AudioData {
  frequencyData: Float32Array;
  timeDomainData: Float32Array;
  average: number;
  peak: number;
  bass: number;
  mid: number;
  treble: number;
  beatDetected: boolean;
}

// Effect Parameters
export interface EffectParams {
  intensity?: number;
  speed?: number;
  color?: string | number;
  scale?: number;
  complexity?: number;
  audioReactive?: boolean;
  [key: string]: any;
}

// Layer Configuration
export interface LayerConfig {
  id: string;
  effectType: EffectType;
  params: EffectParams;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
}`}
              </SyntaxHighlighter>
            </div>
          </section>
        </motion.div>
      </div>
    </Layout>
  )
}