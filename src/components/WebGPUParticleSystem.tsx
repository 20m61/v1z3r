/**
 * WebGPU-accelerated Particle System Component
 * High-performance particle rendering with compute shaders
 */

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useVisualizerStore } from '@/store/visualizerStore';
import { getWebGPUPerformanceMonitor } from '@/utils/webgpuPerformanceMonitor';

interface ParticleSystemProps {
  count?: number;
  audioData?: Uint8Array;
  enabled?: boolean;
}

// Particle data structure matching WGSL shader
interface Particle {
  position: Float32Array;
  velocity: Float32Array;
  color: Float32Array;
  life: number;
  size: number;
  audioInfluence: number;
  _padding: number;
}

export default function WebGPUParticleSystem({
  count = 10000,
  audioData,
  enabled = true
}: ParticleSystemProps) {
  const { gl, camera } = useThree();
  const { colorTheme, sensitivity } = useVisualizerStore();
  
  const meshRef = useRef<THREE.Points>(null);
  const computeRef = useRef<GPUComputePipeline | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const bufferRef = useRef<GPUBuffer | null>(null);
  const perfMonitor = useRef(getWebGPUPerformanceMonitor());
  
  // Initialize WebGPU
  useEffect(() => {
    if (!enabled || !navigator.gpu) return;
    
    const initWebGPU = async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        
        if (!adapter) {
          console.warn('WebGPU adapter not available');
          return;
        }
        
        const device = await adapter.requestDevice({
          requiredFeatures: ['timestamp-query'],
          requiredLimits: {
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
          }
        });
        
        deviceRef.current = device;
        
        // Initialize performance monitor
        await perfMonitor.current.initialize(device);
        
        // Load compute shader
        const computeShaderModule = device.createShaderModule({
          label: 'Particle Compute Shader',
          code: await fetch('/shaders/particleCompute.wgsl').then(r => r.text())
        });
        
        // Create compute pipeline
        computeRef.current = device.createComputePipeline({
          label: 'Particle Compute Pipeline',
          layout: 'auto',
          compute: {
            module: computeShaderModule,
            entryPoint: 'main',
          }
        });
        
        // Create particle buffer
        const particleSize = 16 * 4; // 16 floats per particle
        const bufferSize = count * particleSize;
        
        bufferRef.current = device.createBuffer({
          label: 'Particle Buffer',
          size: bufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        
        // Initialize particles
        initializeParticles(device, bufferRef.current, count);
        
      } catch (error) {
        console.error('WebGPU initialization failed:', error);
      }
    };
    
    initWebGPU();
    
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
      // Capture perfMonitor ref value to avoid stale closure
      const currentMonitor = perfMonitor.current;
      if (currentMonitor) {
        currentMonitor.dispose();
      }
    };
  }, [enabled, count]);
  
  // Initialize particle data
  const initializeParticles = (device: GPUDevice, buffer: GPUBuffer, count: number) => {
    const particleArray = new Float32Array(count * 16);
    
    for (let i = 0; i < count; i++) {
      const offset = i * 16;
      
      // Position
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 10 + Math.random() * 20;
      
      particleArray[offset + 0] = radius * Math.sin(phi) * Math.cos(theta);
      particleArray[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particleArray[offset + 2] = radius * Math.cos(phi);
      
      // Velocity
      particleArray[offset + 3] = 0;
      particleArray[offset + 4] = 0;
      particleArray[offset + 5] = 0;
      
      // Color (RGBA)
      particleArray[offset + 6] = 1;
      particleArray[offset + 7] = 1;
      particleArray[offset + 8] = 1;
      particleArray[offset + 9] = 1;
      
      // Life
      particleArray[offset + 10] = 1 + Math.random() * 3;
      
      // Size
      particleArray[offset + 11] = 1 + Math.random() * 2;
      
      // Audio influence
      particleArray[offset + 12] = 0.5 + Math.random() * 0.5;
      
      // Padding
      particleArray[offset + 13] = 0;
    }
    
    device.queue.writeBuffer(buffer, 0, particleArray);
  };
  
  // Three.js geometry and material
  const [geometry, material] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      map: createParticleTexture()
    });
    
    return [geometry, material];
  }, [count]);
  
  // Create particle texture
  const createParticleTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
  };
  
  // Animation frame update
  useFrame((state, delta) => {
    if (!enabled || !meshRef.current || !deviceRef.current || !computeRef.current || !bufferRef.current) {
      return;
    }
    
    const device = deviceRef.current;
    
    // Prepare simulation parameters
    const params = new Float32Array([
      delta,                    // deltaTime
      state.clock.elapsedTime, // time
      audioData ? getAudioLevel(audioData) : 0.5, // audioLevel
      audioData ? getAudioFrequency(audioData) : 0.5, // audioFrequency
      0, -9.8, 0,              // gravity
      Math.sin(state.clock.elapsedTime * 0.5) * 2, 0, 0, // windForce
      Math.sin(state.clock.elapsedTime) * 10,     // attractorPosition.x
      Math.cos(state.clock.elapsedTime) * 10,     // attractorPosition.y
      0,                                           // attractorPosition.z
      5 * sensitivity,         // attractorStrength
      2,                       // turbulence
      0.98,                    // damping
      count                    // particleCount
    ]);
    
    const paramsBuffer = device.createBuffer({
      size: params.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(paramsBuffer, 0, params);
    
    // Prepare audio data buffer
    const audioBuffer = device.createBuffer({
      size: 512 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    if (audioData) {
      const audioFloats = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        audioFloats[i] = (audioData[i] || 0) / 255;
      }
      device.queue.writeBuffer(audioBuffer, 0, audioFloats);
    }
    
    // Create bind group
    const bindGroup = device.createBindGroup({
      layout: computeRef.current.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferRef.current } },
        { binding: 1, resource: { buffer: paramsBuffer } },
        { binding: 2, resource: { buffer: audioBuffer } }
      ]
    });
    
    // Run compute pass
    const commandEncoder = device.createCommandEncoder();
    
    // Begin performance monitoring
    perfMonitor.current.beginFrame(commandEncoder);
    
    const computePass = commandEncoder.beginComputePass();
    perfMonitor.current.beginComputePass(computePass);
    
    computePass.setPipeline(computeRef.current);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(count / 64));
    
    perfMonitor.current.endComputePass(computePass);
    computePass.end();
    
    // Read back particle data
    const readBuffer = device.createBuffer({
      size: bufferRef.current.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    commandEncoder.copyBufferToBuffer(
      bufferRef.current, 0,
      readBuffer, 0,
      bufferRef.current.size
    );
    
    // End performance monitoring
    perfMonitor.current.endFrame(commandEncoder);
    
    device.queue.submit([commandEncoder.finish()]);
    
    // Update performance metrics
    perfMonitor.current.updateParticleMetrics(
      count,
      bufferRef.current.size,
      delta * 1000
    );
    
    // Update Three.js geometry
    readBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const data = new Float32Array(readBuffer.getMappedRange());
      updateGeometry(data);
      readBuffer.unmap();
      readBuffer.destroy();
    });
    
    // Cleanup temporary buffers
    paramsBuffer.destroy();
    audioBuffer.destroy();
  });
  
  // Update Three.js geometry from GPU data
  const updateGeometry = (data: Float32Array) => {
    if (!meshRef.current) return;
    
    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;
    const sizes = geometry.attributes.size.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const offset = i * 16;
      const posOffset = i * 3;
      
      // Position
      positions[posOffset] = data[offset];
      positions[posOffset + 1] = data[offset + 1];
      positions[posOffset + 2] = data[offset + 2];
      
      // Color
      colors[posOffset] = data[offset + 6];
      colors[posOffset + 1] = data[offset + 7];
      colors[posOffset + 2] = data[offset + 8];
      
      // Size
      sizes[i] = data[offset + 11];
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
  };
  
  // Audio analysis helpers
  const getAudioLevel = (audioData: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i];
    }
    return sum / (audioData.length * 255);
  };
  
  const getAudioFrequency = (audioData: Uint8Array): number => {
    // Simple frequency detection (find dominant frequency bin)
    let maxValue = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < audioData.length / 2; i++) {
      if (audioData[i] > maxValue) {
        maxValue = audioData[i];
        maxIndex = i;
      }
    }
    
    return maxIndex / (audioData.length / 2);
  };
  
  if (!enabled) return null;
  
  return (
    <points ref={meshRef} geometry={geometry} material={material} />
  );
}