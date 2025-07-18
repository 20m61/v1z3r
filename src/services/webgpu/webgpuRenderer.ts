/**
 * WebGPU Renderer for v1z3r
 * Integrates with existing Three.js renderer for enhanced performance
 */

import * as THREE from 'three';
import { webgpuService } from './webgpuService';
import { ParticleSystem } from './particleSystem';
import { errorHandler } from '@/utils/errorHandler';

export interface WebGPURenderTarget {
  texture: GPUTexture;
  view: GPUTextureView;
  format: GPUTextureFormat;
  width: number;
  height: number;
}

export interface WebGPURendererConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: GPUPowerPreference;
  maxParticles?: number;
  enablePostProcessing?: boolean;
}

export interface RenderStats {
  frameTime: number;
  drawCalls: number;
  triangles: number;
  particles: number;
  gpuTime?: number;
}

// Vertex shader for rendering particles
const PARTICLE_VERTEX_SHADER = `
struct Uniforms {
  mvpMatrix: mat4x4<f32>,
  viewMatrix: mat4x4<f32>,
  projectionMatrix: mat4x4<f32>,
  time: f32,
  resolution: vec2<f32>,
  _padding: f32,
};

struct Particle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  color: vec4<f32>,
  life: f32,
  size: f32,
  _padding: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) pointSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

@vertex
fn main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  var output: VertexOutput;
  
  let particle = particles[instanceIndex];
  
  // Billboard quad vertices
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0)
  );
  
  let position = positions[vertexIndex];
  let size = particle.size * (0.5 + particle.life * 0.5);
  
  // Calculate view-aligned billboard
  let viewPos = uniforms.viewMatrix * vec4<f32>(particle.position, 1.0);
  viewPos.x += position.x * size;
  viewPos.y += position.y * size;
  
  output.position = uniforms.projectionMatrix * viewPos;
  output.color = particle.color;
  output.uv = position * 0.5 + 0.5;
  output.pointSize = size;
  
  return output;
}
`;

// Fragment shader for rendering particles
const PARTICLE_FRAGMENT_SHADER = `
struct FragmentInput {
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) pointSize: f32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let center = vec2<f32>(0.5);
  let dist = distance(input.uv, center);
  
  // Soft particle edges
  let alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  
  // Glow effect
  let glow = exp(-dist * 4.0) * 0.5;
  
  var finalColor = input.color;
  finalColor.a *= alpha;
  finalColor.rgb += glow * finalColor.rgb;
  
  return finalColor;
}
`;

export class WebGPURenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement;
  private config: Required<WebGPURendererConfig>;
  
  private renderPipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  
  private particleSystem: ParticleSystem | null = null;
  private renderTarget: WebGPURenderTarget | null = null;
  private depthTexture: GPUTexture | null = null;
  
  private stats: RenderStats = {
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    particles: 0,
  };
  
  private lastFrameTime: number = 0;
  private threeCamera: THREE.Camera | null = null;
  
  constructor(config: WebGPURendererConfig) {
    this.canvas = config.canvas;
    this.config = {
      canvas: config.canvas,
      antialias: config.antialias ?? true,
      alpha: config.alpha ?? true,
      powerPreference: config.powerPreference ?? 'high-performance',
      maxParticles: config.maxParticles ?? 1000000,
      enablePostProcessing: config.enablePostProcessing ?? true,
    };
  }
  
  async initialize(): Promise<void> {
    try {
      const webgpu = await webgpuService.initialize();
      this.device = webgpu.device;
      
      // Get canvas context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        throw new Error('Failed to get WebGPU context');
      }
      
      // Configure context
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: this.config.alpha ? 'premultiplied' : 'opaque',
      });
      
      // Create render target
      this.createRenderTarget();
      
      // Create render pipeline
      this.createRenderPipeline();
      
      // Initialize particle system
      this.particleSystem = new ParticleSystem({
        particleCount: this.config.maxParticles,
        emitterPosition: [0, 0, 0],
        gravity: 9.8,
        damping: 0.1,
        audioReactivity: 1.0,
        lifespan: 5.0,
        speed: 10.0,
        spread: 5.0,
      });
      
      await this.particleSystem.initialize();
      
      errorHandler.info('WebGPU renderer initialized', {
        device: webgpu.device.label,
        format: presentationFormat,
        maxParticles: this.config.maxParticles,
      });
    } catch (error) {
      errorHandler.error('Failed to initialize WebGPU renderer', error as Error);
      throw error;
    }
  }
  
  private createRenderTarget(): void {
    if (!this.device || !this.context) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    const format = navigator.gpu.getPreferredCanvasFormat();
    
    // Create depth texture
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    this.renderTarget = {
      texture: this.context.getCurrentTexture(),
      view: this.context.getCurrentTexture().createView(),
      format,
      width,
      height,
    };
  }
  
  private createRenderPipeline(): void {
    if (!this.device) return;
    
    // Create uniform buffer
    this.uniformBuffer = webgpuService.createBuffer(
      256, // 4x4 matrices + extras
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    
    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });
    
    // Create render pipeline
    this.renderPipeline = webgpuService.createRenderPipeline(
      PARTICLE_VERTEX_SHADER,
      PARTICLE_FRAGMENT_SHADER,
      {
        bindGroupLayouts: [bindGroupLayout],
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        depthStencil: {
          depthWriteEnabled: false,
          depthCompare: 'less',
          format: 'depth24plus',
        },
        targets: [{
          format: navigator.gpu.getPreferredCanvasFormat(),
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one',
              operation: 'add',
            },
          },
        }],
      }
    );
    
    // Create bind group
    if (this.particleSystem) {
      this.bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: this.particleSystem.getParticleBuffer()! },
          },
        ],
      });
    }
  }
  
  /**
   * Set Three.js camera for matrix calculations
   */
  setCamera(camera: THREE.Camera): void {
    this.threeCamera = camera;
  }
  
  /**
   * Update particle system
   */
  updateParticles(deltaTime: number, audioData?: Float32Array): void {
    if (this.particleSystem) {
      this.particleSystem.update(deltaTime, audioData);
      this.stats.particles = this.particleSystem.getParticleCount();
    }
  }
  
  /**
   * Render frame
   */
  render(): void {
    if (!this.device || !this.context || !this.renderPipeline || !this.bindGroup) {
      return;
    }
    
    const frameStartTime = performance.now();
    
    // Update render target
    this.renderTarget = {
      texture: this.context.getCurrentTexture(),
      view: this.context.getCurrentTexture().createView(),
      format: navigator.gpu.getPreferredCanvasFormat(),
      width: this.canvas.width,
      height: this.canvas.height,
    };
    
    // Update uniforms
    this.updateUniforms();
    
    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();
    
    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.renderTarget.view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    
    // Draw particles
    if (this.particleSystem) {
      renderPass.setPipeline(this.renderPipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      
      const particleCount = this.particleSystem.getParticleCount();
      renderPass.draw(6, particleCount); // 6 vertices per particle (quad)
      
      this.stats.drawCalls = 1;
      this.stats.triangles = particleCount * 2;
    }
    
    renderPass.end();
    
    // Submit
    webgpuService.submit([commandEncoder.finish()]);
    
    // Update stats
    const frameEndTime = performance.now();
    this.stats.frameTime = frameEndTime - frameStartTime;
    this.lastFrameTime = frameEndTime;
  }
  
  private updateUniforms(): void {
    if (!this.threeCamera || !this.uniformBuffer) return;
    
    // Update camera matrices
    this.threeCamera.updateMatrixWorld();
    
    const projectionMatrix = this.threeCamera.projectionMatrix;
    const viewMatrix = this.threeCamera.matrixWorldInverse;
    const mvpMatrix = new THREE.Matrix4();
    mvpMatrix.multiplyMatrices(projectionMatrix, viewMatrix);
    
    // Create uniform data
    const uniformData = new Float32Array(64); // 256 bytes / 4 bytes per float
    
    // MVP matrix (16 floats)
    mvpMatrix.toArray(uniformData, 0);
    
    // View matrix (16 floats)
    viewMatrix.toArray(uniformData, 16);
    
    // Projection matrix (16 floats)
    projectionMatrix.toArray(uniformData, 32);
    
    // Time (1 float)
    uniformData[48] = performance.now() / 1000;
    
    // Resolution (2 floats)
    uniformData[49] = this.canvas.width;
    uniformData[50] = this.canvas.height;
    
    // Write to buffer
    webgpuService.writeBuffer(this.uniformBuffer, uniformData);
  }
  
  /**
   * Handle canvas resize
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Recreate depth texture
    if (this.device) {
      if (this.depthTexture) {
        this.depthTexture.destroy();
      }
      
      this.depthTexture = this.device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
  }
  
  /**
   * Get render statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }
  
  /**
   * Update particle system configuration
   */
  updateParticleConfig(config: Partial<import('./particleSystem').ParticleSystemConfig>): void {
    if (this.particleSystem) {
      this.particleSystem.updateConfig(config);
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.particleSystem) {
      this.particleSystem.destroy();
    }
    
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.renderPipeline = null;
    this.context = null;
    this.device = null;
  }
}

// Export types for particle system config
export type { ParticleSystemConfig } from './particleSystem';