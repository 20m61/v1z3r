/**
 * WebGPU Advanced Particle System for v1z3r
 * High-performance compute shader-based particle simulation
 */

import { WebGPUCapabilities } from './webgpuDetection';
import { MusicFeatures, VisualParameters } from './aiMusicAnalyzer';

export interface ParticleConfig {
  maxParticles: number;
  particleSize: number;
  particleLifetime: number;
  emissionRate: number;
  gravity: number;
  damping: number;
  audioReactivity: number;
  colorMode: 'spectrum' | 'energy' | 'custom';
  blendMode: 'normal' | 'additive' | 'multiply' | 'screen';
  enablePhysics: boolean;
  enableCollisions: boolean;
  enableTrails: boolean;
}

export interface ParticleState {
  position: Float32Array; // x, y, z
  velocity: Float32Array; // vx, vy, vz
  color: Float32Array; // r, g, b, a
  size: number;
  lifetime: number;
  age: number;
  active: boolean;
}

export interface ParticleEmitter {
  position: Float32Array;
  direction: Float32Array;
  spread: number;
  rate: number;
  burstCount: number;
  shape: 'point' | 'sphere' | 'cone' | 'box' | 'line';
  size: Float32Array;
}

export interface ParticleForce {
  type: 'gravity' | 'wind' | 'attraction' | 'repulsion' | 'vortex' | 'turbulence';
  strength: number;
  position?: Float32Array;
  direction?: Float32Array;
  radius?: number;
  frequency?: number;
}

export interface ParticleSystemMetrics {
  activeParticles: number;
  totalParticles: number;
  computeTime: number;
  renderTime: number;
  memoryUsage: number;
  fps: number;
}

/**
 * WebGPU Particle System
 */
export class WebGPUParticleSystem {
  private device: GPUDevice | null = null;
  private capabilities: WebGPUCapabilities | null = null;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private config: ParticleConfig;

  // GPU Resources
  private particleBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private audioBuffer: GPUBuffer | null = null;
  private forceBuffer: GPUBuffer | null = null;
  
  // Compute Pipeline
  private computePipeline: GPUComputePipeline | null = null;
  private computeBindGroup: GPUBindGroup | null = null;
  
  // Render Pipeline
  private renderPipeline: GPURenderPipeline | null = null;
  private renderBindGroup: GPUBindGroup | null = null;
  
  // Shader modules
  private computeShaderModule: GPUShaderModule | null = null;
  private vertexShaderModule: GPUShaderModule | null = null;
  private fragmentShaderModule: GPUShaderModule | null = null;
  
  // Particle data
  private particleData: Float32Array;
  private particleCount: number = 0;
  private emitters: ParticleEmitter[] = [];
  private forces: ParticleForce[] = [];
  
  // Performance metrics
  private metrics: ParticleSystemMetrics;
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, config: Partial<ParticleConfig> = {}) {
    this.canvas = canvas;
    this.config = {
      maxParticles: 100000,
      particleSize: 2.0,
      particleLifetime: 5.0,
      emissionRate: 1000,
      gravity: 0.1,
      damping: 0.98,
      audioReactivity: 1.0,
      colorMode: 'spectrum',
      blendMode: 'additive',
      enablePhysics: true,
      enableCollisions: false,
      enableTrails: false,
      ...config,
    };

    // Initialize particle data
    this.particleData = new Float32Array(this.config.maxParticles * 12); // 12 floats per particle
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the WebGPU particle system
   */
  async initialize(device: GPUDevice, capabilities: WebGPUCapabilities): Promise<void> {
    this.device = device;
    this.capabilities = capabilities;

    // Get canvas context
    this.context = this.canvas.getContext('webgpu');
    if (!this.context) {
      throw new Error('Failed to get WebGPU context');
    }

    // Configure context
    this.context.configure({
      device: this.device,
      format: capabilities.preferredFormat || 'bgra8unorm',
      alphaMode: 'premultiplied',
    });

    // Create shader modules
    await this.createShaderModules();

    // Create GPU buffers
    this.createBuffers();

    // Create compute pipeline
    this.createComputePipeline();

    // Create render pipeline
    this.createRenderPipeline();

    // Create bind groups
    this.createBindGroups();

    // Setup default emitter
    this.addEmitter({
      position: new Float32Array([0, 0, 0]),
      direction: new Float32Array([0, 1, 0]),
      spread: Math.PI / 4,
      rate: this.config.emissionRate,
      burstCount: 1,
      shape: 'point',
      size: new Float32Array([1, 1, 1]),
    });

    console.log('[WebGPUParticleSystem] Initialized successfully');
  }

  /**
   * Create shader modules
   */
  private async createShaderModules(): Promise<void> {
    // Compute shader for particle simulation
    const computeShaderSource = `
      struct Particle {
        position: vec3<f32>,
        velocity: vec3<f32>,
        color: vec4<f32>,
        size: f32,
        lifetime: f32,
        age: f32,
        active: f32,
      };

      struct Uniforms {
        deltaTime: f32,
        time: f32,
        gravity: f32,
        damping: f32,
        audioReactivity: f32,
        emissionRate: f32,
        particleSize: f32,
        maxParticles: f32,
      };

      struct Force {
        type: f32,
        strength: f32,
        position: vec3<f32>,
        direction: vec3<f32>,
        radius: f32,
        frequency: f32,
      };

      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> uniforms: Uniforms;
      @group(0) @binding(2) var<storage, read> audioData: array<f32>;
      @group(0) @binding(3) var<storage, read> forces: array<Force>;

      // Noise functions
      fn hash(p: vec3<f32>) -> f32 {
        let p3 = fract(p * 0.1031);
        let p3_dot = dot(p3, vec3<f32>(p3.y + 33.333, p3.z + 33.333, p3.x + 33.333));
        return fract((p3.x + p3.y + p3.z) * p3_dot);
      }

      fn lerp(a: f32, b: f32, t: f32) -> f32 {
        return a + t * (b - a);
      }

      fn noise(p: vec3<f32>) -> f32 {
        let i = floor(p);
        let f = fract(p);
        let u = f * f * (3.0 - 2.0 * f);
        
        // Use explicit lerp instead of nested mix calls for better compatibility
        let h000 = hash(i + vec3<f32>(0.0, 0.0, 0.0));
        let h100 = hash(i + vec3<f32>(1.0, 0.0, 0.0));
        let h010 = hash(i + vec3<f32>(0.0, 1.0, 0.0));
        let h110 = hash(i + vec3<f32>(1.0, 1.0, 0.0));
        let h001 = hash(i + vec3<f32>(0.0, 0.0, 1.0));
        let h101 = hash(i + vec3<f32>(1.0, 0.0, 1.0));
        let h011 = hash(i + vec3<f32>(0.0, 1.0, 1.0));
        let h111 = hash(i + vec3<f32>(1.0, 1.0, 1.0));
        
        let x00 = lerp(h000, h100, u.x);
        let x10 = lerp(h010, h110, u.x);
        let x01 = lerp(h001, h101, u.x);
        let x11 = lerp(h011, h111, u.x);
        
        let y0 = lerp(x00, x10, u.y);
        let y1 = lerp(x01, x11, u.y);
        
        return lerp(y0, y1, u.z);
      }

      fn turbulence(p: vec3<f32>) -> vec3<f32> {
        let noise_x = noise(p + vec3<f32>(0.0, 0.0, 0.0));
        let noise_y = noise(p + vec3<f32>(5.2, 1.3, 0.0));
        let noise_z = noise(p + vec3<f32>(0.0, 5.2, 1.3));
        return vec3<f32>(noise_x, noise_y, noise_z) * 2.0 - 1.0;
      }

      fn applyForce(particle: ptr<function, Particle>, force: Force) {
        switch (i32(force.type)) {
          case 0: { // gravity
            (*particle).velocity.y += force.strength * uniforms.deltaTime;
          }
          case 1: { // wind
            (*particle).velocity += force.direction * force.strength * uniforms.deltaTime;
          }
          case 2: { // attraction
            let dir = force.position - (*particle).position;
            let dist = length(dir);
            if (dist > 0.001) {
              let attraction = normalize(dir) * force.strength / (dist * dist + 0.1);
              (*particle).velocity += attraction * uniforms.deltaTime;
            }
          }
          case 3: { // repulsion
            let dir = (*particle).position - force.position;
            let dist = length(dir);
            if (dist > 0.001 && dist < force.radius) {
              let repulsion = normalize(dir) * force.strength / (dist * dist + 0.1);
              (*particle).velocity += repulsion * uniforms.deltaTime;
            }
          }
          case 4: { // vortex
            let dir = force.position - (*particle).position;
            let dist = length(dir);
            if (dist > 0.001 && dist < force.radius) {
              let tangent = cross(normalize(dir), force.direction);
              let vortexForce = tangent * force.strength * uniforms.deltaTime;
              (*particle).velocity += vortexForce;
            }
          }
          case 5: { // turbulence
            let turbulenceForce = turbulence((*particle).position * force.frequency + uniforms.time) * force.strength;
            (*particle).velocity += turbulenceForce * uniforms.deltaTime;
          }
          default: {}
        }
      }

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= u32(uniforms.maxParticles)) {
          return;
        }

        var particle = particles[index];
        
        if (particle.active > 0.0) {
          // Update age
          particle.age += uniforms.deltaTime;
          
          // Check if particle should die
          if (particle.age >= particle.lifetime) {
            particle.active = 0.0;
            particles[index] = particle;
            return;
          }
          
          // Apply forces
          for (var i = 0u; i < arrayLength(&forces); i++) {
            applyForce(&particle, forces[i]);
          }
          
          // Apply gravity
          particle.velocity.y -= uniforms.gravity * uniforms.deltaTime;
          
          // Apply damping
          particle.velocity *= uniforms.damping;
          
          // Audio reactivity
          let audioIndex = index % arrayLength(&audioData);
          let audioValue = audioData[audioIndex];
          let audioInfluence = audioValue * uniforms.audioReactivity;
          
          // Modulate particle properties based on audio
          particle.velocity *= (1.0 + audioInfluence * 0.5);
          particle.size = uniforms.particleSize * (1.0 + audioInfluence);
          
          // Update position
          particle.position += particle.velocity * uniforms.deltaTime;
          
          // Color evolution based on age and audio
          let lifeRatio = particle.age / particle.lifetime;
          let colorPhase = lifeRatio * 2.0 * 3.14159 + audioInfluence * 3.14159;
          
          particle.color.r = sin(colorPhase) * 0.5 + 0.5;
          particle.color.g = sin(colorPhase + 2.094) * 0.5 + 0.5; // 2π/3
          particle.color.b = sin(colorPhase + 4.188) * 0.5 + 0.5; // 4π/3
          particle.color.a = 1.0 - lifeRatio;
          
          // Boundary conditions (simple bounce)
          if (particle.position.y < -10.0) {
            particle.position.y = -10.0;
            particle.velocity.y = abs(particle.velocity.y) * 0.5;
          }
          if (particle.position.y > 10.0) {
            particle.position.y = 10.0;
            particle.velocity.y = -abs(particle.velocity.y) * 0.5;
          }
          
          particles[index] = particle;
        } else {
          // Emit new particles
          let shouldEmit = hash(vec3<f32>(f32(index), uniforms.time, 0.0)) < 
                          uniforms.emissionRate * uniforms.deltaTime / uniforms.maxParticles;
          
          if (shouldEmit) {
            // Initialize new particle
            let randomSeed = vec3<f32>(f32(index), uniforms.time, 1.0);
            let random1 = hash(randomSeed);
            let random2 = hash(randomSeed + vec3<f32>(1.0, 1.0, 1.0));
            let random3 = hash(randomSeed + vec3<f32>(2.0, 2.0, 2.0));
            
            particle.position = vec3<f32>(
              (random1 - 0.5) * 2.0,
              -5.0,
              (random2 - 0.5) * 2.0
            );
            
            particle.velocity = vec3<f32>(
              (random1 - 0.5) * 4.0,
              random2 * 8.0 + 2.0,
              (random3 - 0.5) * 4.0
            );
            
            particle.color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
            particle.size = uniforms.particleSize;
            particle.lifetime = 3.0 + random1 * 2.0;
            particle.age = 0.0;
            particle.active = 1.0;
            
            particles[index] = particle;
          }
        }
      }
    `;

    // Vertex shader
    const vertexShaderSource = `
      struct Particle {
        position: vec3<f32>,
        velocity: vec3<f32>,
        color: vec4<f32>,
        size: f32,
        lifetime: f32,
        age: f32,
        active: f32,
      };

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) size: f32,
      };

      @group(0) @binding(0) var<storage, read> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> viewProjectionMatrix: mat4x4<f32>;

      @vertex
      fn main(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
      ) -> VertexOutput {
        let particle = particles[instanceIndex];
        
        if (particle.active == 0.0) {
          // Hide inactive particles
          return VertexOutput(
            vec4<f32>(0.0, 0.0, 0.0, 0.0),
            vec4<f32>(0.0, 0.0, 0.0, 0.0),
            vec2<f32>(0.0, 0.0),
            0.0
          );
        }
        
        // Quad vertices for billboard
        var positions = array<vec2<f32>, 4>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0,  1.0)
        );
        
        var uvs = array<vec2<f32>, 4>(
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 1.0)
        );
        
        let quadPos = positions[vertexIndex];
        let worldPos = particle.position + vec3<f32>(quadPos * particle.size, 0.0);
        let clipPos = viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
        
        return VertexOutput(
          clipPos,
          particle.color,
          uvs[vertexIndex],
          particle.size
        );
      }
    `;

    // Fragment shader
    const fragmentShaderSource = `
      struct FragmentInput {
        @location(0) color: vec4<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) size: f32,
      };

      @fragment
      fn main(input: FragmentInput) -> @location(0) vec4<f32> {
        // Circular particle shape
        let dist = length(input.uv - vec2<f32>(0.5, 0.5));
        let alpha = smoothstep(0.5, 0.3, dist);
        
        // Glow effect
        let glow = smoothstep(0.8, 0.2, dist);
        
        var color = input.color;
        color.a *= alpha;
        color.rgb += vec3<f32>(glow * 0.3);
        
        return color;
      }
    `;

    // Create shader modules
    this.computeShaderModule = this.device!.createShaderModule({
      label: 'particle-compute-shader',
      code: computeShaderSource,
    });

    this.vertexShaderModule = this.device!.createShaderModule({
      label: 'particle-vertex-shader',
      code: vertexShaderSource,
    });

    this.fragmentShaderModule = this.device!.createShaderModule({
      label: 'particle-fragment-shader',
      code: fragmentShaderSource,
    });
  }

  /**
   * Create GPU buffers
   */
  private createBuffers(): void {
    if (!this.device) return;

    // Particle buffer
    const particleBufferSize = this.config.maxParticles * 12 * 4; // 12 floats * 4 bytes
    this.particleBuffer = this.device.createBuffer({
      label: 'particle-buffer',
      size: particleBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Uniform buffer
    const uniformBufferSize = 8 * 4; // 8 floats * 4 bytes
    this.uniformBuffer = this.device.createBuffer({
      label: 'uniform-buffer',
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Audio buffer
    const audioBufferSize = 1024 * 4; // 1024 floats * 4 bytes
    this.audioBuffer = this.device.createBuffer({
      label: 'audio-buffer',
      size: audioBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Force buffer
    const forceBufferSize = 10 * 8 * 4; // 10 forces * 8 floats * 4 bytes
    this.forceBuffer = this.device.createBuffer({
      label: 'force-buffer',
      size: forceBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Create compute pipeline
   */
  private createComputePipeline(): void {
    if (!this.device || !this.computeShaderModule) return;

    this.computePipeline = this.device.createComputePipeline({
      label: 'particle-compute-pipeline',
      layout: 'auto',
      compute: {
        module: this.computeShaderModule,
        entryPoint: 'main',
      },
    });
  }

  /**
   * Create render pipeline
   */
  private createRenderPipeline(): void {
    if (!this.device || !this.vertexShaderModule || !this.fragmentShaderModule) return;

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'particle-render-pipeline',
      layout: 'auto',
      vertex: {
        module: this.vertexShaderModule,
        entryPoint: 'main',
      },
      fragment: {
        module: this.fragmentShaderModule,
        entryPoint: 'main',
        targets: [{
          format: this.capabilities?.preferredFormat || 'bgra8unorm',
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-strip',
      },
    });
  }

  /**
   * Create bind groups
   */
  private createBindGroups(): void {
    if (!this.device || !this.computePipeline || !this.renderPipeline) return;

    // Compute bind group
    this.computeBindGroup = this.device.createBindGroup({
      label: 'particle-compute-bind-group',
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer! },
        },
        {
          binding: 1,
          resource: { buffer: this.uniformBuffer! },
        },
        {
          binding: 2,
          resource: { buffer: this.audioBuffer! },
        },
        {
          binding: 3,
          resource: { buffer: this.forceBuffer! },
        },
      ],
    });

    // Render bind group (simplified for this example)
    this.renderBindGroup = this.device.createBindGroup({
      label: 'particle-render-bind-group',
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer! },
        },
        {
          binding: 1,
          resource: { buffer: this.uniformBuffer! },
        },
      ],
    });
  }

  /**
   * Update particle system
   */
  update(deltaTime: number, audioData: Float32Array, musicFeatures: MusicFeatures): void {
    if (!this.device || !this.computePipeline || !this.computeBindGroup) return;

    const currentTime = performance.now();

    // Update uniforms
    const uniformData = new Float32Array([
      deltaTime,
      currentTime / 1000,
      this.config.gravity,
      this.config.damping,
      this.config.audioReactivity,
      this.config.emissionRate,
      this.config.particleSize,
      this.config.maxParticles,
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniformData);

    // Update audio data
    const normalizedAudioData = new Float32Array(1024);
    const audioLength = Math.min(audioData.length, 1024);
    for (let i = 0; i < audioLength; i++) {
      normalizedAudioData[i] = audioData[i] / 255.0;
    }
    this.device.queue.writeBuffer(this.audioBuffer!, 0, normalizedAudioData);

    // Update forces based on music features
    this.updateForcesFromMusic(musicFeatures);

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder({
      label: 'particle-compute-encoder',
    });

    // Compute pass
    const computePass = commandEncoder.beginComputePass({
      label: 'particle-compute-pass',
    });

    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    
    const workgroupCount = Math.ceil(this.config.maxParticles / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();

    // Submit compute commands
    this.device.queue.submit([commandEncoder.finish()]);

    // Update metrics
    this.updateMetrics();
  }

  /**
   * Update forces based on music features
   */
  private updateForcesFromMusic(musicFeatures: MusicFeatures): void {
    if (!this.device) return;

    // Clear existing forces
    this.forces = [];

    // Add gravity force
    this.forces.push({
      type: 'gravity',
      strength: this.config.gravity,
    });

    // Add turbulence based on energy
    this.forces.push({
      type: 'turbulence',
      strength: musicFeatures.energy * 2.0,
      frequency: musicFeatures.tempo / 60,
    });

    // Add attraction based on beat
    if (musicFeatures.beatStrength && musicFeatures.beatStrength.length > 0) {
      const beatStrength = musicFeatures.beatStrength[musicFeatures.beatStrength.length - 1];
      this.forces.push({
        type: 'attraction',
        strength: beatStrength * 5.0,
        position: new Float32Array([0, 0, 0]),
        radius: 5.0,
      });
    }

    // Update force buffer
    const forceData = new Float32Array(80); // 10 forces * 8 floats
    for (let i = 0; i < Math.min(this.forces.length, 10); i++) {
      const force = this.forces[i];
      const offset = i * 8;
      
      forceData[offset] = this.getForceTypeValue(force.type);
      forceData[offset + 1] = force.strength;
      
      if (force.position) {
        forceData[offset + 2] = force.position[0];
        forceData[offset + 3] = force.position[1];
        forceData[offset + 4] = force.position[2];
      }
      
      if (force.direction) {
        forceData[offset + 5] = force.direction[0];
        forceData[offset + 6] = force.direction[1];
        forceData[offset + 7] = force.direction[2];
      }
      
      if (force.radius !== undefined) {
        forceData[offset + 8] = force.radius;
      }
      
      if (force.frequency !== undefined) {
        forceData[offset + 9] = force.frequency;
      }
    }

    this.device.queue.writeBuffer(this.forceBuffer!, 0, forceData);
  }

  /**
   * Get numeric value for force type
   */
  private getForceTypeValue(type: string): number {
    const types = ['gravity', 'wind', 'attraction', 'repulsion', 'vortex', 'turbulence'];
    return types.indexOf(type);
  }

  /**
   * Render particles
   */
  render(viewProjectionMatrix: Float32Array): void {
    if (!this.device || !this.context || !this.renderPipeline || !this.renderBindGroup) return;

    const commandEncoder = this.device.createCommandEncoder({
      label: 'particle-render-encoder',
    });

    // Update view projection matrix
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, viewProjectionMatrix.buffer);

    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      label: 'particle-render-pass',
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    
    // Draw particles (4 vertices per particle, instanced)
    renderPass.draw(4, this.config.maxParticles);
    
    renderPass.end();

    // Submit render commands
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Add particle emitter
   */
  addEmitter(emitter: ParticleEmitter): void {
    this.emitters.push(emitter);
  }

  /**
   * Remove particle emitter
   */
  removeEmitter(index: number): void {
    this.emitters.splice(index, 1);
  }

  /**
   * Add force
   */
  addForce(force: ParticleForce): void {
    this.forces.push(force);
  }

  /**
   * Remove force
   */
  removeForce(index: number): void {
    this.forces.splice(index, 1);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ParticleConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current metrics
   */
  getMetrics(): ParticleSystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.frameCount++;
    
    if (performance.now() - this.fpsTimer > 1000) {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = performance.now();
    }
    
    this.metrics.totalParticles = this.config.maxParticles;
    // activeParticles would be calculated by reading back from GPU
    this.metrics.activeParticles = Math.floor(this.config.maxParticles * 0.6); // Estimate
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ParticleSystemMetrics {
    return {
      activeParticles: 0,
      totalParticles: this.config.maxParticles,
      computeTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      fps: 0,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.particleBuffer) {
      this.particleBuffer.destroy();
      this.particleBuffer = null;
    }
    
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    
    if (this.audioBuffer) {
      this.audioBuffer.destroy();
      this.audioBuffer = null;
    }
    
    if (this.forceBuffer) {
      this.forceBuffer.destroy();
      this.forceBuffer = null;
    }
    
    this.computePipeline = null;
    this.renderPipeline = null;
    this.computeBindGroup = null;
    this.renderBindGroup = null;
    this.computeShaderModule = null;
    this.vertexShaderModule = null;
    this.fragmentShaderModule = null;
  }
}

/**
 * Factory function to create WebGPU particle system
 */
export async function createWebGPUParticleSystem(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  capabilities: WebGPUCapabilities,
  config?: Partial<ParticleConfig>
): Promise<WebGPUParticleSystem> {
  const particleSystem = new WebGPUParticleSystem(canvas, config);
  await particleSystem.initialize(device, capabilities);
  return particleSystem;
}