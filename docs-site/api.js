"use strict";(()=>{var e={};e.id=237,e.ids=[237],e.modules={975:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{config:()=>o,default:()=>d,routeModule:()=>m});var s=t(3105),i=t(5244),n=t(1323),l=t(1528),c=e([l]);l=(c.then?(await c)():c)[0];let d=(0,n.l)(l,"default"),o=(0,n.l)(l,"config"),m=new s.PagesAPIRouteModule({definition:{kind:i.x.PAGES_API,page:"/api",pathname:"/api",bundlePath:"",filename:""},userland:l});r()}catch(e){r(e)}})},1528:(e,a,t)=>{t.a(e,async(e,r)=>{try{t.r(a),t.d(a,{default:()=>API});var s=t(997),i=t(2199),n=t(6197),l=e([i,n]);[i,n]=l.then?(await l)():l;let c=t(727).Prism,d=t(4794).vscDarkPlus;function API(){return s.jsx(i.Z,{children:s.jsx("div",{className:"container mx-auto px-4 py-16 max-w-6xl",children:(0,s.jsxs)(n.motion.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:.5},children:[(0,s.jsxs)("h1",{className:"text-4xl md:text-5xl font-bold mb-8",children:["API ",s.jsx("span",{className:"gradient-text",children:"Reference"})]}),s.jsx("p",{className:"text-xl text-gray-400 mb-12",children:"v1z3rのモジュールAPIリファレンス。カスタムエフェクトや拡張機能の開発に活用してください。"}),(0,s.jsxs)("section",{className:"mb-16",children:[s.jsx("h2",{className:"text-3xl font-bold mb-8",children:"Core Modules"}),(0,s.jsxs)("div",{className:"card mb-8",children:[s.jsx("h3",{className:"text-2xl font-semibold mb-4 text-vj-primary",children:"@vj-app/visual-renderer"}),s.jsx("p",{className:"text-gray-400 mb-6",children:"WebGL/Three.jsベースのビジュアルレンダリングエンジン"}),s.jsx("h4",{className:"text-lg font-medium mb-3",children:"VisualRenderer Class"}),s.jsx(c,{language:"typescript",style:d,className:"rounded-lg mb-6",children:`import { VisualRenderer } from '@vj-app/visual-renderer';

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
renderer.render();`}),s.jsx("h4",{className:"text-lg font-medium mb-3",children:"Methods"}),(0,s.jsxs)("div",{className:"space-y-4",children:[(0,s.jsxs)("div",{className:"bg-gray-900 rounded-lg p-4",children:[s.jsx("code",{className:"text-vj-accent",children:"init(): Promise<void>"}),s.jsx("p",{className:"text-gray-400 mt-2",children:"レンダラーを初期化します。WebGLコンテキストの作成とリソースのロードを行います。"})]}),(0,s.jsxs)("div",{className:"bg-gray-900 rounded-lg p-4",children:[s.jsx("code",{className:"text-vj-accent",children:"setEffect(type: EffectType, params?: EffectParams): void"}),s.jsx("p",{className:"text-gray-400 mt-2",children:"エフェクトタイプとパラメータを設定します。"})]}),(0,s.jsxs)("div",{className:"bg-gray-900 rounded-lg p-4",children:[s.jsx("code",{className:"text-vj-accent",children:"updateAudioData(data: AudioData): void"}),s.jsx("p",{className:"text-gray-400 mt-2",children:"オーディオデータを更新し、エフェクトに反映させます。"})]})]})]}),(0,s.jsxs)("div",{className:"card mb-8",children:[s.jsx("h3",{className:"text-2xl font-semibold mb-4 text-vj-secondary",children:"@vj-app/vj-controller"}),s.jsx("p",{className:"text-gray-400 mb-6",children:"Reactベースのコントロールインターフェース"}),s.jsx(c,{language:"tsx",style:d,className:"rounded-lg mb-6",children:`import { ControlPanel, useController } from '@vj-app/vj-controller';

function MyVJApp() {
  const { params, updateParam, setEffect } = useController();

  return (
    <ControlPanel
      onParamChange={(name, value) => updateParam(name, value)}
      onEffectChange={(effect) => setEffect(effect)}
      audioAnalyzer={audioAnalyzer}
    />
  );
}`}),s.jsx("h4",{className:"text-lg font-medium mb-3",children:"Hooks"}),(0,s.jsxs)("div",{className:"space-y-4",children:[(0,s.jsxs)("div",{className:"bg-gray-900 rounded-lg p-4",children:[s.jsx("code",{className:"text-vj-accent",children:"useController()"}),s.jsx("p",{className:"text-gray-400 mt-2",children:"コントローラーの状態と操作関数を提供するReact Hook"})]}),(0,s.jsxs)("div",{className:"bg-gray-900 rounded-lg p-4",children:[s.jsx("code",{className:"text-vj-accent",children:"useAudioAnalyzer()"}),s.jsx("p",{className:"text-gray-400 mt-2",children:"オーディオ解析データへのアクセスを提供するHook"})]})]})]}),(0,s.jsxs)("div",{className:"card mb-8",children:[s.jsx("h3",{className:"text-2xl font-semibold mb-4 text-vj-accent",children:"@vj-app/sync-core"}),s.jsx("p",{className:"text-gray-400 mb-6",children:"WebSocketベースのリアルタイム同期システム"}),s.jsx(c,{language:"typescript",style:d,className:"rounded-lg mb-6",children:`import { SyncClient } from '@vj-app/sync-core';

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
});`})]})]}),(0,s.jsxs)("section",{className:"mb-16",children:[s.jsx("h2",{className:"text-3xl font-bold mb-8",children:"Creating Custom Effects"}),(0,s.jsxs)("div",{className:"card",children:[s.jsx("h3",{className:"text-xl font-semibold mb-4",children:"カスタムシェーダーエフェクト"}),s.jsx(c,{language:"typescript",style:d,className:"rounded-lg mb-6",children:`import { Effect, ShaderMaterial } from '@vj-app/visual-renderer';

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
}`}),s.jsx("h4",{className:"text-lg font-medium mb-3",children:"エフェクトの登録"}),s.jsx(c,{language:"typescript",style:d,className:"rounded-lg",children:`// Register custom effect
renderer.registerEffect(new MyCustomEffect());

// Use the effect
renderer.setEffect('my-custom-effect');`})]})]}),(0,s.jsxs)("section",{className:"mb-16",children:[s.jsx("h2",{className:"text-3xl font-bold mb-8",children:"WebSocket API"}),(0,s.jsxs)("div",{className:"card",children:[s.jsx("h3",{className:"text-xl font-semibold mb-4",children:"メッセージフォーマット"}),s.jsx(c,{language:"typescript",style:d,className:"rounded-lg mb-6",children:`// Client -> Server
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
}`}),s.jsx("h4",{className:"text-lg font-medium mb-3",children:"接続フロー"}),(0,s.jsxs)("ol",{className:"space-y-3 text-gray-400",children:[s.jsx("li",{children:"1. WebSocket接続を確立"}),(0,s.jsxs)("li",{children:["2. ",s.jsx("code",{className:"text-vj-primary",children:"join"}),"メッセージでルームに参加"]}),(0,s.jsxs)("li",{children:["3. パラメータ更新時に",s.jsx("code",{className:"text-vj-secondary",children:"update"}),"メッセージを送信"]}),s.jsx("li",{children:"4. 他のクライアントからの更新を受信して反映"})]})]})]}),(0,s.jsxs)("section",{children:[s.jsx("h2",{className:"text-3xl font-bold mb-8",children:"Type Definitions"}),s.jsx("div",{className:"card",children:s.jsx(c,{language:"typescript",style:d,className:"rounded-lg",children:`// Effect Types
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
}`})})]})]})})})}r()}catch(e){r(e)}})},3105:(e,a,t)=>{e.exports=t(145)},145:e=>{e.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},2785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},6689:e=>{e.exports=require("react")},6405:e=>{e.exports=require("react-dom")},727:e=>{e.exports=require("react-syntax-highlighter")},4794:e=>{e.exports=require("react-syntax-highlighter/dist/cjs/styles/prism")},997:e=>{e.exports=require("react/jsx-runtime")},6197:e=>{e.exports=import("framer-motion")},7147:e=>{e.exports=require("fs")},2781:e=>{e.exports=require("stream")},7310:e=>{e.exports=require("url")},9796:e=>{e.exports=require("zlib")}};var a=require("../webpack-runtime.js");a.C(e);var __webpack_exec__=e=>a(a.s=e),t=a.X(0,[761,130,424,199],()=>__webpack_exec__(975));module.exports=t})();