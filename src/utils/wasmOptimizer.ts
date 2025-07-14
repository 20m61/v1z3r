/**
 * WebAssembly Optimization Utilities
 * Provides high-performance computing capabilities for audio and visual processing
 */

import { errorHandler } from './errorHandler';

export interface WasmModuleConfig {
  name: string;
  url: string;
  imports?: Record<string, any>;
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

    // Fetch and instantiate
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
    }

    const bytes = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, imports);
    
    return result.instance;
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
}

/**
 * High-performance audio processor using WebAssembly
 */
export class WasmAudioProcessor {
  private wasmManager: WasmModuleManager;
  private audioModule: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory;
  private inputBuffer: Float32Array;
  private outputBuffer: Float32Array;

  constructor() {
    this.wasmManager = new WasmModuleManager();
    this.memory = new WebAssembly.Memory({ initial: 256 });
    this.inputBuffer = new Float32Array(0);
    this.outputBuffer = new Float32Array(0);
  }

  /**
   * Initialize audio processor
   */
  async initialize(config: AudioProcessingConfig): Promise<boolean> {
    try {
      this.audioModule = await this.wasmManager.loadModule({
        name: 'audio-processor',
        url: '/wasm/audio-processor.wasm',
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

      if (!this.audioModule) {
        return false;
      }

      // Initialize buffers
      const bufferSize = config.bufferSize * config.channels;
      this.inputBuffer = new Float32Array(this.memory.buffer, 0, bufferSize);
      this.outputBuffer = new Float32Array(this.memory.buffer, bufferSize * 4, bufferSize);

      // Initialize WASM module
      const exports = this.audioModule.exports as any;
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
      return null;
    }

    try {
      // Copy input data to WASM memory
      this.inputBuffer.set(inputData);

      // Call WASM processing function
      const exports = this.audioModule.exports as any;
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
    if (!this.audioModule) {
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
    return this.audioModule !== null;
  }
}

/**
 * High-performance visual effects processor using WebAssembly
 */
export class WasmVisualProcessor {
  private wasmManager: WasmModuleManager;
  private visualModule: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory;
  private imageBuffer: Uint8ClampedArray;

  constructor() {
    this.wasmManager = new WasmModuleManager();
    this.memory = new WebAssembly.Memory({ initial: 512 });
    this.imageBuffer = new Uint8ClampedArray(0);
  }

  /**
   * Initialize visual processor
   */
  async initialize(width: number, height: number): Promise<boolean> {
    try {
      this.visualModule = await this.wasmManager.loadModule({
        name: 'visual-processor',
        url: '/wasm/visual-processor.wasm',
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

      if (!this.visualModule) {
        return false;
      }

      // Initialize image buffer
      const bufferSize = width * height * 4; // RGBA
      this.imageBuffer = new Uint8ClampedArray(this.memory.buffer, 0, bufferSize);

      // Initialize WASM module
      const exports = this.visualModule.exports as any;
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
      return null;
    }

    try {
      // Copy image data to WASM memory
      this.imageBuffer.set(imageData.data);

      // Apply effect
      const exports = this.visualModule.exports as any;
      const effectFunction = exports[`effect_${effectType}`];
      
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
    return this.visualModule !== null;
  }
}

// Global instances
export const wasmAudioProcessor = new WasmAudioProcessor();
export const wasmVisualProcessor = new WasmVisualProcessor();