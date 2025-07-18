/**
 * WebGPU Performance Benchmark Suite
 * Comprehensive benchmarking for WebGPU capabilities and performance
 */

import { webgpuService } from './webgpuService';
import { webgpuDetector } from '@/utils/webgpuDetection';
import { errorHandler } from '@/utils/errorHandler';

export interface BenchmarkResult {
  name: string;
  duration: number;
  throughput?: number;
  memoryUsage?: number;
  gpuUtilization?: number;
  success: boolean;
  error?: string;
}

export interface ComprehensiveBenchmark {
  timestamp: number;
  deviceInfo: {
    vendor: string;
    architecture: string;
    limits: Record<string, number>;
  };
  results: BenchmarkResult[];
  overallScore: number;
  recommendations: string[];
}

export class WebGPUBenchmark {
  private device: GPUDevice | null = null;
  private results: BenchmarkResult[] = [];
  
  async initialize(): Promise<void> {
    try {
      const webgpu = await webgpuService.initialize();
      this.device = webgpu.device;
      
      errorHandler.info('WebGPU benchmark initialized');
    } catch (error) {
      errorHandler.error('Failed to initialize WebGPU benchmark', error as Error);
      throw error;
    }
  }
  
  /**
   * Run comprehensive benchmark suite
   */
  async runComprehensiveBenchmark(): Promise<ComprehensiveBenchmark> {
    if (!this.device) {
      throw new Error('WebGPU device not initialized');
    }
    
    this.results = [];
    
    // Basic operation benchmarks
    await this.benchmarkBufferOperations();
    await this.benchmarkTextureOperations();
    await this.benchmarkComputeShaders();
    await this.benchmarkMemoryBandwidth();
    
    // Advanced benchmarks
    await this.benchmarkParticleSystem();
    await this.benchmarkComplexShaders();
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    
    // Get device info
    const capabilities = await webgpuDetector.detectCapabilities();
    const deviceInfo = {
      vendor: capabilities.adapterInfo?.vendor || 'Unknown',
      architecture: capabilities.adapterInfo?.architecture || 'Unknown',
      limits: {
        maxBufferSize: capabilities.limits?.maxBufferSize || 0,
        maxTextureSize: capabilities.limits?.maxTextureDimension2D || 0,
        maxComputeWorkgroups: capabilities.limits?.maxComputeWorkgroupsPerDimension || 0,
      },
    };
    
    return {
      timestamp: Date.now(),
      deviceInfo,
      results: [...this.results],
      overallScore,
      recommendations,
    };
  }
  
  /**
   * Benchmark buffer operations (create, write, read)
   */
  private async benchmarkBufferOperations(): Promise<void> {
    const testName = 'Buffer Operations';
    const startTime = performance.now();
    
    try {
      const bufferSize = 1024 * 1024; // 1MB
      const testData = new Float32Array(bufferSize / 4);
      
      // Fill with test data
      for (let i = 0; i < testData.length; i++) {
        testData[i] = Math.random();
      }
      
      // Create buffer
      const buffer = webgpuService.createBuffer(
        bufferSize,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      );
      
      // Write data
      webgpuService.writeBuffer(buffer, testData);
      
      // Wait for completion
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const throughput = bufferSize / (duration / 1000); // bytes per second
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      buffer.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Benchmark texture operations
   */
  private async benchmarkTextureOperations(): Promise<void> {
    const testName = 'Texture Operations';
    const startTime = performance.now();
    
    try {
      const textureSize = 1024;
      
      // Create texture
      const texture = webgpuService.createTexture({
        size: [textureSize, textureSize],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      
      // Create test data
      const textureData = new Uint8Array(textureSize * textureSize * 4);
      for (let i = 0; i < textureData.length; i++) {
        textureData[i] = Math.floor(Math.random() * 256);
      }
      
      // Write texture data
      this.device!.queue.writeTexture(
        { texture },
        textureData,
        { bytesPerRow: textureSize * 4 },
        { width: textureSize, height: textureSize }
      );
      
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const throughput = textureData.length / (duration / 1000);
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      texture.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Benchmark compute shader performance
   */
  private async benchmarkComputeShaders(): Promise<void> {
    const testName = 'Compute Shaders';
    const startTime = performance.now();
    
    try {
      const arraySize = 1024 * 1024; // 1M elements
      const inputData = new Float32Array(arraySize);
      
      // Fill with test data
      for (let i = 0; i < inputData.length; i++) {
        inputData[i] = Math.random();
      }
      
      // Create compute shader
      const computeShader = `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let index = global_id.x;
          if (index >= arrayLength(&data)) {
            return;
          }
          
          // Perform complex computation
          let x = data[index];
          let result = sin(x) * cos(x * 2.0) + sqrt(abs(x));
          data[index] = result;
        }
      `;
      
      const pipeline = webgpuService.createComputePipeline(computeShader);
      
      // Create buffer
      const buffer = webgpuService.createBuffer(
        arraySize * 4,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      );
      
      webgpuService.writeBuffer(buffer, inputData);
      
      // Create bind group
      const bindGroup = this.device!.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer },
        }],
      });
      
      // Execute compute shader
      const commandEncoder = this.device!.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(arraySize / 64));
      computePass.end();
      
      webgpuService.submit([commandEncoder.finish()]);
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const throughput = arraySize / (duration / 1000); // operations per second
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      buffer.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Benchmark memory bandwidth
   */
  private async benchmarkMemoryBandwidth(): Promise<void> {
    const testName = 'Memory Bandwidth';
    const startTime = performance.now();
    
    try {
      const bufferSize = 64 * 1024 * 1024; // 64MB
      const testData = new Float32Array(bufferSize / 4);
      
      // Fill with test data
      for (let i = 0; i < testData.length; i++) {
        testData[i] = Math.random();
      }
      
      const buffer = webgpuService.createBuffer(
        bufferSize,
        GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      );
      
      // Perform multiple writes to measure bandwidth
      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        webgpuService.writeBuffer(buffer, testData);
      }
      
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const totalBytes = bufferSize * iterations;
      const throughput = totalBytes / (duration / 1000); // bytes per second
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      buffer.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Benchmark particle system performance
   */
  private async benchmarkParticleSystem(): Promise<void> {
    const testName = 'Particle System';
    const startTime = performance.now();
    
    try {
      const particleCount = 100000;
      const particleSize = 16 * 4; // 16 floats per particle
      
      // Create particle buffer
      const particleBuffer = webgpuService.createBuffer(
        particleCount * particleSize,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      );
      
      // Initialize particles
      const particleData = new Float32Array(particleCount * 16);
      for (let i = 0; i < particleCount; i++) {
        const offset = i * 16;
        // Position
        particleData[offset + 0] = Math.random() * 100 - 50;
        particleData[offset + 1] = Math.random() * 100 - 50;
        particleData[offset + 2] = Math.random() * 100 - 50;
        // Velocity
        particleData[offset + 3] = Math.random() * 10 - 5;
        particleData[offset + 4] = Math.random() * 10 - 5;
        particleData[offset + 5] = Math.random() * 10 - 5;
        // Color
        particleData[offset + 6] = Math.random();
        particleData[offset + 7] = Math.random();
        particleData[offset + 8] = Math.random();
        particleData[offset + 9] = 1.0;
        // Life and size
        particleData[offset + 10] = Math.random();
        particleData[offset + 11] = Math.random() * 2 + 0.5;
      }
      
      webgpuService.writeBuffer(particleBuffer, particleData);
      
      // Simple particle update shader
      const updateShader = `
        struct Particle {
          position: vec3<f32>,
          velocity: vec3<f32>,
          color: vec4<f32>,
          life: f32,
          size: f32,
          _padding: vec2<f32>,
        };
        
        @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let index = global_id.x;
          if (index >= arrayLength(&particles)) {
            return;
          }
          
          var particle = particles[index];
          particle.position += particle.velocity * 0.016; // 60 FPS
          particle.life -= 0.016;
          
          if (particle.life <= 0.0) {
            particle.life = 1.0;
            particle.position = vec3<f32>(0.0);
          }
          
          particles[index] = particle;
        }
      `;
      
      const pipeline = webgpuService.createComputePipeline(updateShader);
      
      const bindGroup = this.device!.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: particleBuffer },
        }],
      });
      
      // Simulate 60 updates (1 second at 60 FPS)
      for (let frame = 0; frame < 60; frame++) {
        const commandEncoder = this.device!.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(Math.ceil(particleCount / 64));
        computePass.end();
        webgpuService.submit([commandEncoder.finish()]);
      }
      
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const throughput = (particleCount * 60) / (duration / 1000); // particles per second
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      particleBuffer.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Benchmark complex shader operations
   */
  private async benchmarkComplexShaders(): Promise<void> {
    const testName = 'Complex Shaders';
    const startTime = performance.now();
    
    try {
      const arraySize = 512 * 512; // 256K elements
      
      // Complex mathematical operations shader
      const complexShader = `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        
        fn mandelbrot(c: vec2<f32>) -> f32 {
          var z = vec2<f32>(0.0, 0.0);
          var i = 0;
          
          for (i = 0; i < 100; i++) {
            if (length(z) > 2.0) {
              break;
            }
            z = vec2<f32>(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
          }
          
          return f32(i) / 100.0;
        }
        
        @compute @workgroup_size(16, 16)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          let index = global_id.y * 512u + global_id.x;
          if (index >= arrayLength(&data)) {
            return;
          }
          
          let coord = vec2<f32>(f32(global_id.x), f32(global_id.y)) / 512.0;
          let c = (coord - 0.5) * 4.0;
          
          data[index] = mandelbrot(c);
        }
      `;
      
      const pipeline = webgpuService.createComputePipeline(complexShader);
      
      const buffer = webgpuService.createBuffer(
        arraySize * 4,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      );
      
      const bindGroup = this.device!.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer },
        }],
      });
      
      const commandEncoder = this.device!.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(32, 32); // 512x512 with 16x16 workgroups
      computePass.end();
      
      webgpuService.submit([commandEncoder.finish()]);
      await this.device!.queue.onSubmittedWorkDone();
      
      const duration = performance.now() - startTime;
      const throughput = arraySize / (duration / 1000);
      
      this.results.push({
        name: testName,
        duration,
        throughput,
        success: true,
      });
      
      // Cleanup
      buffer.destroy();
    } catch (error) {
      this.results.push({
        name: testName,
        duration: performance.now() - startTime,
        success: false,
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(): number {
    if (this.results.length === 0) return 0;
    
    const weights = {
      'Buffer Operations': 0.2,
      'Texture Operations': 0.15,
      'Compute Shaders': 0.25,
      'Memory Bandwidth': 0.2,
      'Particle System': 0.15,
      'Complex Shaders': 0.05,
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const result of this.results) {
      if (!result.success) continue;
      
      const weight = weights[result.name as keyof typeof weights] || 0.1;
      let score = 0;
      
      // Score based on performance characteristics
      if (result.throughput) {
        // Normalize throughput to 0-100 scale
        switch (result.name) {
          case 'Buffer Operations':
            score = Math.min(result.throughput / (1024 * 1024 * 1024), 1) * 100; // GB/s
            break;
          case 'Texture Operations':
            score = Math.min(result.throughput / (1024 * 1024 * 1024), 1) * 100; // GB/s
            break;
          case 'Compute Shaders':
            score = Math.min(result.throughput / (1024 * 1024 * 100), 1) * 100; // 100M ops/s
            break;
          case 'Memory Bandwidth':
            score = Math.min(result.throughput / (1024 * 1024 * 1024 * 10), 1) * 100; // 10 GB/s
            break;
          case 'Particle System':
            score = Math.min(result.throughput / (1024 * 1024 * 50), 1) * 100; // 50M particles/s
            break;
          case 'Complex Shaders':
            score = Math.min(result.throughput / (1024 * 1024), 1) * 100; // 1M ops/s
            break;
        }
      } else {
        // Score based on duration (lower is better)
        score = Math.max(0, 100 - result.duration / 10);
      }
      
      totalScore += score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
  
  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    for (const result of this.results) {
      if (!result.success) {
        recommendations.push(`Fix ${result.name}: ${result.error}`);
        continue;
      }
      
      // Generate specific recommendations based on performance
      if (result.name === 'Buffer Operations' && result.throughput && result.throughput < 1024 * 1024 * 1024) {
        recommendations.push('Consider using smaller buffer sizes or batching operations for better performance');
      }
      
      if (result.name === 'Particle System' && result.throughput && result.throughput < 1024 * 1024 * 10) {
        recommendations.push('Particle system performance is low - consider reducing particle count or optimizing compute shader');
      }
      
      if (result.name === 'Complex Shaders' && result.duration > 1000) {
        recommendations.push('Complex shader operations are slow - consider simplifying algorithms or using lower precision');
      }
    }
    
    // General recommendations
    const overallScore = this.calculateOverallScore();
    if (overallScore < 30) {
      recommendations.push('Overall performance is poor - consider falling back to WebGL or CPU-based rendering');
    } else if (overallScore < 60) {
      recommendations.push('Performance is moderate - some optimizations may be needed for complex scenes');
    } else if (overallScore >= 80) {
      recommendations.push('Excellent performance - can handle high-complexity visual effects');
    }
    
    return recommendations;
  }
  
  /**
   * Get individual benchmark result
   */
  getBenchmarkResult(name: string): BenchmarkResult | null {
    return this.results.find(r => r.name === name) || null;
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.results = [];
    this.device = null;
  }
}

// Export singleton instance
export const webgpuBenchmark = new WebGPUBenchmark();