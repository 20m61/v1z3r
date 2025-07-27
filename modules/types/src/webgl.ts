/**
 * WebGL and WebGPU type definitions
 */

export interface WebGLContextConfig {
  antialias: boolean;
  alpha: boolean;
  premultipliedAlpha: boolean;
  preserveDrawingBuffer: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
}

export interface ShaderUniforms {
  time: number;
  resolution: [number, number];
  audioData: Float32Array;
  volume: number;
  colorTheme: [number, number, number];
  sensitivity: number;
}

export interface ParticleSystemConfig {
  particleCount: number;
  particleSize: number;
  velocity: [number, number, number];
  acceleration: [number, number, number];
  lifespan: number;
  colorStart: [number, number, number, number];
  colorEnd: [number, number, number, number];
}

export interface WebGPUAdapter {
  requestDevice(): Promise<WebGPUDevice>;
  features: Set<string>;
  limits: Record<string, number>;
}

export interface WebGPUDevice {
  createShaderModule(descriptor: { code: string }): WebGPUShaderModule;
  createRenderPipeline(descriptor: any): WebGPURenderPipeline;
  createBuffer(descriptor: { size: number; usage: number }): WebGPUBuffer;
  createTexture(descriptor: any): WebGPUTexture;
  queue: WebGPUQueue;
}

export interface WebGPUShaderModule {
  // WebGPU shader module interface
}

export interface WebGPURenderPipeline {
  // WebGPU render pipeline interface
}

export interface WebGPUBuffer {
  // WebGPU buffer interface
}

export interface WebGPUTexture {
  // WebGPU texture interface
}

export interface WebGPUQueue {
  submit(commandBuffers: any[]): void;
  writeBuffer(buffer: WebGPUBuffer, offset: number, data: ArrayBuffer): void;
}