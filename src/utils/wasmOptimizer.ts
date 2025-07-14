/**
 * WebAssembly Optimization Utilities
 * Provides high-performance computing capabilities for audio and visual processing
 */

import { errorHandler } from './errorHandler';

export interface WasmModuleConfig {
  name: string;
  url: string;
  integrity?: string; // SRI hash for security
  imports?: Record<string, unknown>;
  memory?: {
    initial: number;
    maximum?: number;
    shared?: boolean;
  };
}

export interface AudioProcessingConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
}

/**
 * WebAssembly module manager with caching and fallback support
 */
export class WasmModuleManager {
  private modules = new Map<string, WebAssembly.Instance>();
  private loading = new Map<string, Promise<WebAssembly.Instance>>();
  private supported: boolean;
  private memoryInstances = new Map<string, WebAssembly.Memory>();

  constructor() {
    this.supported = this.checkWasmSupport();
  }

  /**
   * Check WebAssembly support
   */
  private checkWasmSupport(): boolean {
    try {
      if (typeof WebAssembly === 'object' &&
          typeof WebAssembly.instantiate === 'function' &&
          typeof WebAssembly.Module === 'function' &&
          typeof WebAssembly.Instance === 'function') {
        
        // Test basic WASM functionality
        const wasmModule = new WebAssembly.Module(
          new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
        );
        return wasmModule instanceof WebAssembly.Module;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Load and instantiate WebAssembly module
   */
  async loadModule(config: WasmModuleConfig): Promise<WebAssembly.Instance | null> {
    if (!this.supported) {
      errorHandler.warn('WebAssembly not supported, falling back to JavaScript implementation');
      return null;
    }

    // Check if already loaded
    if (this.modules.has(config.name)) {
      return this.modules.get(config.name)!;
    }

    // Check if currently loading
    if (this.loading.has(config.name)) {
      return this.loading.get(config.name)!;
    }

    // Start loading
    const loadPromise = this.instantiateModule(config);
    this.loading.set(config.name, loadPromise);

    try {
      const instance = await loadPromise;
      this.modules.set(config.name, instance);
      this.loading.delete(config.name);
      
      errorHandler.info(`WebAssembly module ${config.name} loaded successfully`);
      return instance;
    } catch (error) {
      this.loading.delete(config.name);
      errorHandler.error(`Failed to load WebAssembly module ${config.name}`, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get loaded module
   */
  getModule(name: string): WebAssembly.Instance | null {
    return this.modules.get(name) || null;
  }

  /**
   * Instantiate WebAssembly module
   */
  private async instantiateModule(config: WasmModuleConfig): Promise<WebAssembly.Instance> {
    // Create memory if specified
    let memory: WebAssembly.Memory | undefined;
    if (config.memory) {
      memory = new WebAssembly.Memory({
        initial: config.memory.initial,
        maximum: config.memory.maximum,
        shared: config.memory.shared || false
      });
    }

    // Default imports
    const defaultImports = {
      env: {
        memory: memory || new WebAssembly.Memory({ initial: 256 }),
        __linear_memory_base: 0,
        __table_base: 0,
        abort: () => {
          throw new Error('WebAssembly module aborted');
        },
        // Math functions
        cos: Math.cos,
        sin: Math.sin,
        tan: Math.tan,
        acos: Math.acos,
        asin: Math.asin,
        atan: Math.atan,
        atan2: Math.atan2,
        exp: Math.exp,
        log: Math.log,
        sqrt: Math.sqrt,
        pow: Math.pow,
        floor: Math.floor,
        ceil: Math.ceil,
        fabs: Math.abs,
        // Console functions for debugging
        console_log: (value: number) => console.log(`WASM Log: ${value}`),
        console_error: (value: number) => console.error(`WASM Error: ${value}`)
      }
    };

    // Merge with custom imports
    const imports = { ...defaultImports, ...config.imports };

    // Validate URL
    if (!this.isValidUrl(config.url)) {
      throw new Error('Invalid WASM module URL');
    }

    // Fetch and instantiate with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(config.url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/wasm'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
      }

      const bytes = await response.arrayBuffer();
      
      // Verify integrity if provided
      if (config.integrity) {
        const isValid = await this.verifyIntegrity(bytes, config.integrity);
        if (!isValid) {
          throw new Error('WASM module integrity check failed');
        }
      }
      
      const result = await WebAssembly.instantiate(bytes, imports);
      
      // Store memory reference if created
      if (memory) {
        this.memoryInstances.set(config.name, memory);
      }
      
      return result.instance;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('WASM module fetch timeout');
      }
      throw error;
    }
  }

  /**
   * Check if module is available
   */
  isModuleLoaded(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get WebAssembly support status
   */
  isSupported(): boolean {
    return this.supported;
  }
  
  /**
   * Validate URL for security
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window?.location?.origin || 'http://localhost');
      // Only allow HTTPS in production or local files
      return parsed.protocol === 'https:' || 
             parsed.protocol === 'http:' && parsed.hostname === 'localhost' ||
             parsed.protocol === 'file:';
    } catch {
      return false;
    }
  }
  
  /**
   * Verify integrity of WASM module
   */
  private async verifyIntegrity(bytes: ArrayBuffer, expectedHash: string): Promise<boolean> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));
      return `sha256-${hashBase64}` === expectedHash;
    } catch (error) {
      errorHandler.warn('Failed to verify WASM integrity', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Dispose of module and free memory
   */
  disposeModule(name: string): void {
    this.modules.delete(name);
    this.loading.delete(name);
    
    const memory = this.memoryInstances.get(name);
    if (memory) {
      // Memory will be garbage collected
      this.memoryInstances.delete(name);
    }
  }
  
  /**
   * Dispose all modules
   */
  disposeAll(): void {
    this.modules.clear();
    this.loading.clear();
    this.memoryInstances.clear();
  }
}

/**
 * High-performance audio processor using WebAssembly
 */
export class WasmAudioProcessor {
  private wasmManager: WasmModuleManager;
  private audioModule: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private inputBuffer: Float32Array | null = null;
  private outputBuffer: Float32Array | null = null;
  private fallbackProcessor: ((input: Float32Array) => Float32Array) | null = null;

  constructor() {
    this.wasmManager = new WasmModuleManager();
  }

  /**
   * Initialize audio processor
   */
  async initialize(config: AudioProcessingConfig): Promise<boolean> {
    try {
      // Create memory for audio processing
      this.memory = new WebAssembly.Memory({ 
        initial: 256, 
        maximum: 1024 
      });
      
      this.audioModule = await this.wasmManager.loadModule({
        name: 'audio-processor',
        url: '/wasm/audio-processor.wasm',
        integrity: process.env.NEXT_PUBLIC_WASM_AUDIO_INTEGRITY,
        memory: {
          initial: 256,
          maximum: 1024
        },
        imports: {
          env: {
            memory: this.memory
          }
        }
      });

      if (!this.audioModule || !this.memory) {
        // Set up JavaScript fallback
        this.setupFallback();
        return false;
      }

      // Initialize buffers
      const bufferSize = config.bufferSize * config.channels;
      this.inputBuffer = new Float32Array(this.memory.buffer, 0, bufferSize);
      this.outputBuffer = new Float32Array(this.memory.buffer, bufferSize * 4, bufferSize);

      // Initialize WASM module
      const exports = this.audioModule.exports as {
        initialize?: (sampleRate: number, bufferSize: number, channels: number) => void;
        process_audio?: (inputPtr: number, outputPtr: number, length: number) => number;
        fft_analysis?: (inputPtr: number, outputPtr: number, fftSize: number) => number;
      };
      
      if (exports.initialize) {
        exports.initialize(config.sampleRate, config.bufferSize, config.channels);
      }

      return true;
    } catch (error) {
      errorHandler.error('Failed to initialize WASM audio processor', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Process audio buffer with FFT analysis
   */
  processAudio(inputData: Float32Array): Float32Array | null {
    if (!this.audioModule) {
      // Use fallback if available
      if (this.fallbackProcessor) {
        try {
          return this.fallbackProcessor(inputData);
        } catch (error) {
          errorHandler.error('Fallback audio processing error', error instanceof Error ? error : new Error(String(error)));
          return null;
        }
      }
      return null;
    }

    try {
      if (!this.inputBuffer || !this.outputBuffer) {
        return null;
      }
      
      // Copy input data to WASM memory
      this.inputBuffer.set(inputData);

      // Call WASM processing function
      const exports = this.audioModule.exports as {
        process_audio?: (inputPtr: number, outputPtr: number, length: number) => number;
      };
      
      if (exports.process_audio) {
        const result = exports.process_audio(0, inputData.length * 4, inputData.length);
        
        if (result === 0) { // Success
          return new Float32Array(this.outputBuffer.slice(0, inputData.length));
        }
      }

      return null;
    } catch (error) {
      errorHandler.error('WASM audio processing error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get frequency spectrum analysis
   */
  getFrequencySpectrum(audioData: Float32Array, fftSize: number = 2048): Float32Array | null {
    if (!this.audioModule || !this.inputBuffer || !this.outputBuffer) {
      return null;
    }

    try {
      const exports = this.audioModule.exports as any;
      if (exports.fft_analysis) {
        // Copy audio data to WASM memory
        this.inputBuffer.set(audioData);
        
        const result = exports.fft_analysis(0, audioData.length * 4, fftSize);
        
        if (result === 0) {
          return new Float32Array(this.outputBuffer.slice(0, fftSize / 2));
        }
      }

      return null;
    } catch (error) {
      errorHandler.error('WASM FFT analysis error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Check if WASM audio processor is available
   */
  isAvailable(): boolean {
    return this.audioModule !== null || this.fallbackProcessor !== null;
  }
  
  /**
   * Set up JavaScript fallback for audio processing
   */
  private setupFallback(): void {
    this.fallbackProcessor = (input: Float32Array): Float32Array => {
      // Simple pass-through for demonstration
      // In real implementation, this would contain JS audio processing
      return new Float32Array(input);
    };
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    this.audioModule = null;
    this.memory = null;
    this.inputBuffer = null;
    this.outputBuffer = null;
    this.fallbackProcessor = null;
    
    if (this.wasmManager) {
      this.wasmManager.disposeModule('audio-processor');
    }
  }
}

/**
 * High-performance visual effects processor using WebAssembly
 */
export class WasmVisualProcessor {
  private wasmManager: WasmModuleManager;
  private visualModule: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private imageBuffer: Uint8ClampedArray | null = null;
  private fallbackProcessor: ((imageData: ImageData, effectType: string, intensity: number) => ImageData | null) | null = null;

  constructor() {
    this.wasmManager = new WasmModuleManager();
  }

  /**
   * Initialize visual processor
   */
  async initialize(width: number, height: number): Promise<boolean> {
    try {
      // Create memory for visual processing
      this.memory = new WebAssembly.Memory({ 
        initial: 512, 
        maximum: 2048 
      });
      
      this.visualModule = await this.wasmManager.loadModule({
        name: 'visual-processor',
        url: '/wasm/visual-processor.wasm',
        integrity: process.env.NEXT_PUBLIC_WASM_VISUAL_INTEGRITY,
        memory: {
          initial: 512,
          maximum: 2048
        },
        imports: {
          env: {
            memory: this.memory
          }
        }
      });

      if (!this.visualModule || !this.memory) {
        // Set up JavaScript fallback
        this.setupFallback();
        return false;
      }

      // Initialize image buffer
      const bufferSize = width * height * 4; // RGBA
      this.imageBuffer = new Uint8ClampedArray(this.memory.buffer, 0, bufferSize);

      // Initialize WASM module
      const exports = this.visualModule.exports as {
        initialize?: (width: number, height: number) => void;
        [key: string]: unknown;
      };
      
      if (exports.initialize) {
        exports.initialize(width, height);
      }

      return true;
    } catch (error) {
      errorHandler.error('Failed to initialize WASM visual processor', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Apply visual effects to image data
   */
  applyEffect(imageData: ImageData, effectType: string, intensity: number): ImageData | null {
    if (!this.visualModule) {
      // Use fallback if available
      if (this.fallbackProcessor) {
        try {
          return this.fallbackProcessor(imageData, effectType, intensity);
        } catch (error) {
          errorHandler.error('Fallback visual processing error', error instanceof Error ? error : new Error(String(error)));
          return null;
        }
      }
      return null;
    }

    try {
      if (!this.imageBuffer) {
        return null;
      }
      
      // Copy image data to WASM memory
      this.imageBuffer.set(imageData.data);

      // Apply effect
      const exports = this.visualModule.exports as Record<string, unknown>;
      const effectFunction = exports[`effect_${effectType}`] as ((ptr: number, width: number, height: number, intensity: number) => number) | undefined;
      
      if (effectFunction) {
        const result = effectFunction(0, imageData.width, imageData.height, intensity);
        
        if (result === 0) {
          const outputData = new Uint8ClampedArray(this.imageBuffer.slice(0, imageData.data.length));
          return new ImageData(outputData, imageData.width, imageData.height);
        }
      }

      return null;
    } catch (error) {
      errorHandler.error('WASM visual effect error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Check if WASM visual processor is available
   */
  isAvailable(): boolean {
    return this.visualModule !== null || this.fallbackProcessor !== null;
  }
  
  /**
   * Set up JavaScript fallback for visual processing
   */
  private setupFallback(): void {
    this.fallbackProcessor = (imageData: ImageData, effectType: string, intensity: number): ImageData | null => {
      // Simple brightness adjustment as fallback
      if (effectType === 'brightness') {
        const data = new Uint8ClampedArray(imageData.data);
        const factor = 1 + (intensity / 100);
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * factor);     // R
          data[i + 1] = Math.min(255, data[i + 1] * factor); // G
          data[i + 2] = Math.min(255, data[i + 2] * factor); // B
          // Alpha channel (i + 3) unchanged
        }
        
        return new ImageData(data, imageData.width, imageData.height);
      }
      
      return null;
    };
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    this.visualModule = null;
    this.memory = null;
    this.imageBuffer = null;
    this.fallbackProcessor = null;
    
    if (this.wasmManager) {
      this.wasmManager.disposeModule('visual-processor');
    }
  }
}

// Global instances
export const wasmAudioProcessor = new WasmAudioProcessor();
export const wasmVisualProcessor = new WasmVisualProcessor();

// Cleanup function
export function cleanupWasmProcessors(): void {
  wasmAudioProcessor.dispose();
  wasmVisualProcessor.dispose();
}