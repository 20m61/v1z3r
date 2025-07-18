/**
 * Advanced Particle System with WebGPU Compute Shaders
 * Handles millions of particles with GPU-based physics
 */

import { webgpuService } from './webgpuService';
import { errorHandler } from '@/utils/errorHandler';

export interface ParticleSystemConfig {
  particleCount: number;
  workgroupSize?: number;
  emitterPosition?: [number, number, number];
  emitterRadius?: number;
  gravity?: number;
  damping?: number;
  audioReactivity?: number;
  colorMode?: 'spectrum' | 'gradient' | 'theme';
  lifespan?: number;
  speed?: number;
  spread?: number;
}

export interface ParticleUniforms {
  time: number;
  deltaTime: number;
  audioData: Float32Array;
  emitterPosition: Float32Array;
  gravity: number;
  damping: number;
  audioReactivity: number;
  lifespan: number;
  speed: number;
  spread: number;
}

const PARTICLE_COMPUTE_SHADER = `
struct Particle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  color: vec4<f32>,
  life: f32,
  size: f32,
  _padding: vec2<f32>,
};

struct Uniforms {
  time: f32,
  deltaTime: f32,
  particleCount: u32,
  audioReactivity: f32,
  emitterPosition: vec3<f32>,
  gravity: f32,
  damping: f32,
  lifespan: f32,
  speed: f32,
  spread: f32,
  _padding: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;
@group(0) @binding(2) var<storage, read> audioData: array<f32, 256>;

fn rand(seed: vec2<f32>) -> f32 {
  return fract(sin(dot(seed, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn noise3D(p: vec3<f32>) -> f32 {
  let s = vec3<f32>(7.0, 157.0, 113.0);
  let ip = floor(p);
  var fp = fract(p);
  fp = fp * fp * (3.0 - 2.0 * fp);
  
  var result = 0.0;
  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 2; j++) {
      for (var k = 0; k < 2; k++) {
        let offset = vec3<f32>(f32(i), f32(j), f32(k));
        let h = dot(ip + offset, s);
        let n = fract(sin(h) * 43758.5453);
        let w = fp - offset;
        let weight = w.x * w.y * w.z;
        result += n * weight;
      }
    }
  }
  
  return result;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= uniforms.particleCount) {
    return;
  }
  
  var particle = particles[index];
  
  // Update life
  particle.life -= uniforms.deltaTime / uniforms.lifespan;
  
  // Respawn dead particles
  if (particle.life <= 0.0) {
    let seed = vec2<f32>(f32(index), uniforms.time);
    let theta = rand(seed) * 6.28318;
    let phi = rand(seed + vec2<f32>(1.0, 0.0)) * 3.14159;
    let r = rand(seed + vec2<f32>(2.0, 0.0)) * uniforms.spread;
    
    particle.position = uniforms.emitterPosition + vec3<f32>(
      r * sin(phi) * cos(theta),
      r * cos(phi),
      r * sin(phi) * sin(theta)
    );
    
    let speed = uniforms.speed * (0.5 + rand(seed + vec2<f32>(3.0, 0.0)) * 0.5);
    particle.velocity = normalize(particle.position - uniforms.emitterPosition) * speed;
    particle.life = 1.0;
    particle.size = 0.5 + rand(seed + vec2<f32>(4.0, 0.0)) * 1.5;
  }
  
  // Audio reactivity
  let audioIndex = u32(f32(index % 256));
  let audioValue = audioData[audioIndex];
  let audioForce = audioValue * uniforms.audioReactivity;
  
  // Apply forces
  let noiseForce = vec3<f32>(
    noise3D(particle.position * 0.1 + vec3<f32>(uniforms.time * 0.1, 0.0, 0.0)),
    noise3D(particle.position * 0.1 + vec3<f32>(0.0, uniforms.time * 0.1, 0.0)),
    noise3D(particle.position * 0.1 + vec3<f32>(0.0, 0.0, uniforms.time * 0.1))
  ) * 2.0 - 1.0;
  
  particle.velocity += noiseForce * audioForce * uniforms.deltaTime;
  particle.velocity.y -= uniforms.gravity * uniforms.deltaTime;
  particle.velocity *= 1.0 - uniforms.damping * uniforms.deltaTime;
  
  // Update position
  particle.position += particle.velocity * uniforms.deltaTime;
  
  // Update color based on velocity and audio
  let speed_normalized = length(particle.velocity) / (uniforms.speed * 2.0);
  particle.color = vec4<f32>(
    0.5 + 0.5 * sin(uniforms.time + speed_normalized * 3.14159),
    0.5 + 0.5 * sin(uniforms.time * 1.3 + audioValue * 3.14159),
    0.5 + 0.5 * sin(uniforms.time * 0.7 + particle.life * 3.14159),
    particle.life
  );
  
  // Size modulation
  particle.size *= 1.0 + audioValue * 0.5;
  
  particles[index] = particle;
}
`;

export class ParticleSystem {
  private device: GPUDevice | null = null;
  private config: Required<ParticleSystemConfig>;
  private particleBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private audioBuffer: GPUBuffer | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniforms: ParticleUniforms;
  private lastTime: number = 0;

  constructor(config: ParticleSystemConfig) {
    this.config = {
      particleCount: config.particleCount,
      workgroupSize: config.workgroupSize || 256,
      emitterPosition: config.emitterPosition || [0, 0, 0],
      emitterRadius: config.emitterRadius || 1,
      gravity: config.gravity ?? 9.8,
      damping: config.damping ?? 0.1,
      audioReactivity: config.audioReactivity ?? 1.0,
      colorMode: config.colorMode || 'spectrum',
      lifespan: config.lifespan ?? 5.0,
      speed: config.speed ?? 10.0,
      spread: config.spread ?? 5.0,
    };

    this.uniforms = {
      time: 0,
      deltaTime: 0,
      audioData: new Float32Array(256),
      emitterPosition: new Float32Array(this.config.emitterPosition),
      gravity: this.config.gravity,
      damping: this.config.damping,
      audioReactivity: this.config.audioReactivity,
      lifespan: this.config.lifespan,
      speed: this.config.speed,
      spread: this.config.spread,
    };
  }

  async initialize(): Promise<void> {
    try {
      const webgpu = await webgpuService.initialize();
      this.device = webgpu.device;

      // Create buffers
      this.createBuffers();
      
      // Create compute pipeline
      this.createComputePipeline();
      
      // Initialize particles
      this.initializeParticles();

      errorHandler.info('Particle system initialized', {
        particleCount: this.config.particleCount,
        capabilities: webgpu.capabilities,
      });
    } catch (error) {
      errorHandler.error('Failed to initialize particle system', error as Error);
      throw error;
    }
  }

  private createBuffers(): void {
    if (!this.device) throw new Error('Device not initialized');

    // Particle buffer (16 floats per particle: pos(3), vel(3), color(4), life, size, padding(2))
    const particleSize = 16 * 4; // 16 floats * 4 bytes
    this.particleBuffer = webgpuService.createBuffer(
      this.config.particleCount * particleSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
      true
    );

    // Uniform buffer
    this.uniformBuffer = webgpuService.createBuffer(
      64, // 16 floats * 4 bytes
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );

    // Audio data buffer
    this.audioBuffer = webgpuService.createBuffer(
      256 * 4, // 256 floats * 4 bytes
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
  }

  private createComputePipeline(): void {
    if (!this.device) throw new Error('Device not initialized');

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'storage',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'read-only-storage',
          },
        },
      ],
    });

    // Create compute pipeline
    this.computePipeline = webgpuService.createComputePipeline(
      PARTICLE_COMPUTE_SHADER,
      [bindGroupLayout]
    );

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.particleBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.uniformBuffer!,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.audioBuffer!,
          },
        },
      ],
    });
  }

  private initializeParticles(): void {
    if (!this.particleBuffer) throw new Error('Particle buffer not created');

    const particleData = new Float32Array(this.config.particleCount * 16);
    
    for (let i = 0; i < this.config.particleCount; i++) {
      const offset = i * 16;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.config.emitterRadius;
      
      // Position
      particleData[offset + 0] = Math.cos(angle) * radius;
      particleData[offset + 1] = Math.random() * 2 - 1;
      particleData[offset + 2] = Math.sin(angle) * radius;
      
      // Velocity
      particleData[offset + 3] = (Math.random() - 0.5) * 2;
      particleData[offset + 4] = Math.random() * 2;
      particleData[offset + 5] = (Math.random() - 0.5) * 2;
      
      // Color (RGBA)
      particleData[offset + 6] = Math.random();
      particleData[offset + 7] = Math.random();
      particleData[offset + 8] = Math.random();
      particleData[offset + 9] = 1.0;
      
      // Life
      particleData[offset + 10] = Math.random();
      
      // Size
      particleData[offset + 11] = 0.5 + Math.random() * 1.5;
      
      // Padding
      particleData[offset + 12] = 0;
      particleData[offset + 13] = 0;
    }

    this.particleBuffer.unmap();
    webgpuService.writeBuffer(this.particleBuffer, particleData);
  }

  update(deltaTime: number, audioData?: Float32Array): void {
    if (!this.device || !this.computePipeline || !this.bindGroup) {
      return;
    }

    this.uniforms.time += deltaTime;
    this.uniforms.deltaTime = deltaTime;

    // Update audio data
    if (audioData && audioData.length >= 256) {
      this.uniforms.audioData.set(audioData.slice(0, 256));
      webgpuService.writeBuffer(this.audioBuffer!, this.uniforms.audioData);
    }

    // Update uniforms
    const uniformData = new Float32Array([
      this.uniforms.time,
      this.uniforms.deltaTime,
      this.config.particleCount,
      this.uniforms.audioReactivity,
      ...this.uniforms.emitterPosition,
      this.uniforms.gravity,
      this.uniforms.damping,
      this.uniforms.lifespan,
      this.uniforms.speed,
      this.uniforms.spread,
      0, 0, // padding
    ]);
    webgpuService.writeBuffer(this.uniformBuffer!, uniformData);

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();
    
    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.bindGroup);
    
    const workgroupCount = Math.ceil(this.config.particleCount / this.config.workgroupSize);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    // Submit
    webgpuService.submit([commandEncoder.finish()]);
  }

  getParticleBuffer(): GPUBuffer | null {
    return this.particleBuffer;
  }

  getParticleCount(): number {
    return this.config.particleCount;
  }

  updateConfig(config: Partial<ParticleSystemConfig>): void {
    Object.assign(this.config, config);
    
    // Update uniforms
    if (config.emitterPosition) {
      this.uniforms.emitterPosition = new Float32Array(config.emitterPosition);
    }
    if (config.gravity !== undefined) {
      this.uniforms.gravity = config.gravity;
    }
    if (config.damping !== undefined) {
      this.uniforms.damping = config.damping;
    }
    if (config.audioReactivity !== undefined) {
      this.uniforms.audioReactivity = config.audioReactivity;
    }
    if (config.lifespan !== undefined) {
      this.uniforms.lifespan = config.lifespan;
    }
    if (config.speed !== undefined) {
      this.uniforms.speed = config.speed;
    }
    if (config.spread !== undefined) {
      this.uniforms.spread = config.spread;
    }
  }

  destroy(): void {
    // Buffers are automatically destroyed when device is destroyed
    this.particleBuffer = null;
    this.uniformBuffer = null;
    this.audioBuffer = null;
    this.computePipeline = null;
    this.bindGroup = null;
    this.device = null;
  }
}