/**
 * AI Style Transfer Service
 * Real-time video style transfer using TensorFlow.js
 */

import * as tf from '@tensorflow/tfjs';
import { errorHandler } from '@/utils/errorHandler';

export interface StyleTransferConfig {
  styleName: string;
  styleUrl: string;
  strength: number; // 0.0 - 1.0
  enabled: boolean;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight';
}

export interface StyleTransferMetrics {
  processingTime: number;
  fps: number;
  modelLoaded: boolean;
  currentStyle: string;
  memoryUsage: number;
}

export class StyleTransferService {
  private static instance: StyleTransferService | null = null;
  private model: tf.GraphModel | null = null;
  private isModelLoaded = false;
  private isProcessing = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private styleCache = new Map<string, tf.Tensor>();
  private currentConfig: StyleTransferConfig = {
    styleName: 'none',
    styleUrl: '',
    strength: 0.5,
    enabled: false,
    blendMode: 'normal',
  };
  private metrics: StyleTransferMetrics = {
    processingTime: 0,
    fps: 0,
    modelLoaded: false,
    currentStyle: 'none',
    memoryUsage: 0,
  };

  // Pre-defined artistic styles
  private readonly presetStyles = {
    'van-gogh': {
      name: 'Van Gogh',
      url: '/models/style-transfer/van-gogh.jpg',
      description: 'Swirling, expressive brushstrokes',
    },
    'picasso': {
      name: 'Picasso',
      url: '/models/style-transfer/picasso.jpg',
      description: 'Cubist geometric forms',
    },
    'monet': {
      name: 'Monet',
      url: '/models/style-transfer/monet.jpg',
      description: 'Impressionist light and color',
    },
    'kandinsky': {
      name: 'Kandinsky',
      url: '/models/style-transfer/kandinsky.jpg',
      description: 'Abstract geometric patterns',
    },
    'wave': {
      name: 'Great Wave',
      url: '/models/style-transfer/wave.jpg',
      description: 'Japanese woodblock print style',
    },
    'neon': {
      name: 'Neon',
      url: '/models/style-transfer/neon.jpg',
      description: 'Cyberpunk neon aesthetics',
    },
  };

  private constructor() {
    this.initializeCanvas();
  }

  static getInstance(): StyleTransferService {
    if (!StyleTransferService.instance) {
      StyleTransferService.instance = new StyleTransferService();
    }
    return StyleTransferService.instance;
  }

  private initializeCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Initialize the style transfer model
   */
  async initialize(): Promise<void> {
    try {
      errorHandler.info('Loading style transfer model...');
      
      // Load pre-trained style transfer model
      // Using a lightweight model for real-time processing
      this.model = await tf.loadGraphModel('/models/style-transfer/model.json');
      
      this.isModelLoaded = true;
      this.metrics.modelLoaded = true;
      
      errorHandler.info('Style transfer model loaded successfully');
    } catch (error) {
      errorHandler.error('Failed to load style transfer model', error as Error);
      
      // Fall back to simple filter-based effects
      this.initializeFallbackEffects();
    }
  }

  /**
   * Initialize fallback effects for when ML model fails
   */
  private initializeFallbackEffects(): void {
    errorHandler.info('Using fallback CSS filter effects');
    this.isModelLoaded = false;
    this.metrics.modelLoaded = false;
  }

  /**
   * Apply style transfer to video frame
   */
  async applyStyleTransfer(
    inputCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement
  ): Promise<void> {
    if (!this.currentConfig.enabled || this.isProcessing) {
      // Pass through unchanged
      this.copyCanvas(inputCanvas, outputCanvas);
      return;
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      if (this.isModelLoaded && this.model) {
        await this.applyMLStyleTransfer(inputCanvas, outputCanvas);
      } else {
        await this.applyFallbackStyleTransfer(inputCanvas, outputCanvas);
      }
    } catch (error) {
      errorHandler.error('Style transfer failed', error as Error);
      this.copyCanvas(inputCanvas, outputCanvas);
    } finally {
      this.isProcessing = false;
      this.metrics.processingTime = performance.now() - startTime;
      this.metrics.fps = 1000 / this.metrics.processingTime;
      this.updateMemoryUsage();
    }
  }

  /**
   * Apply ML-based style transfer
   */
  private async applyMLStyleTransfer(
    inputCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement
  ): Promise<void> {
    if (!this.model) return;

    // Convert canvas to tensor
    const inputTensor = tf.browser.fromPixels(inputCanvas)
      .expandDims(0)
      .div(255.0);

    // Get or load style tensor
    let styleTensor = this.styleCache.get(this.currentConfig.styleName);
    if (!styleTensor) {
      styleTensor = await this.loadStyleTensor(this.currentConfig.styleUrl);
      this.styleCache.set(this.currentConfig.styleName, styleTensor);
    }

    // Apply style transfer
    const styledTensor = this.model.predict({
      content: inputTensor,
      style: styleTensor,
    }) as tf.Tensor;

    // Blend with original based on strength
    const blendedTensor = this.blendTensors(
      inputTensor,
      styledTensor,
      this.currentConfig.strength
    );

    // Convert back to canvas
    await tf.browser.toPixels(blendedTensor.squeeze(), outputCanvas);

    // Cleanup
    inputTensor.dispose();
    styledTensor.dispose();
    blendedTensor.dispose();
  }

  /**
   * Apply fallback CSS filter-based style transfer
   */
  private async applyFallbackStyleTransfer(
    inputCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement
  ): Promise<void> {
    if (!this.ctx) return;

    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    // Copy input to output
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.drawImage(inputCanvas, 0, 0);

    // Apply style-specific filters
    const filters = this.getStyleFilters(this.currentConfig.styleName);
    outputCtx.filter = filters;

    // Apply blend mode
    outputCtx.globalCompositeOperation = this.currentConfig.blendMode;

    // Draw with filters applied
    outputCtx.drawImage(inputCanvas, 0, 0);

    // Reset context
    outputCtx.filter = 'none';
    outputCtx.globalCompositeOperation = 'source-over';
  }

  /**
   * Get CSS filters for fallback styles
   */
  private getStyleFilters(styleName: string): string {
    const strength = this.currentConfig.strength;
    
    switch (styleName) {
      case 'van-gogh':
        return `contrast(${1 + strength * 0.5}) saturate(${1 + strength * 0.8}) hue-rotate(${strength * 20}deg)`;
      case 'picasso':
        return `contrast(${1 + strength * 0.8}) saturate(${1 - strength * 0.3}) sepia(${strength * 0.3})`;
      case 'monet':
        return `blur(${strength * 2}px) brightness(${1 + strength * 0.2}) saturate(${1 + strength * 0.5})`;
      case 'kandinsky':
        return `contrast(${1 + strength * 0.6}) saturate(${1 + strength * 0.9}) hue-rotate(${strength * 90}deg)`;
      case 'wave':
        return `contrast(${1 + strength * 0.4}) saturate(${1 - strength * 0.2}) sepia(${strength * 0.6})`;
      case 'neon':
        return `brightness(${1 + strength * 0.5}) saturate(${1 + strength * 1.5}) contrast(${1 + strength * 0.8})`;
      default:
        return 'none';
    }
  }

  /**
   * Load style tensor from image URL
   */
  private async loadStyleTensor(styleUrl: string): Promise<tf.Tensor> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tensor = tf.browser.fromPixels(img)
          .expandDims(0)
          .div(255.0);
        resolve(tensor);
      };
      img.onerror = reject;
      img.src = styleUrl;
    });
  }

  /**
   * Blend two tensors based on strength
   */
  private blendTensors(
    original: tf.Tensor,
    styled: tf.Tensor,
    strength: number
  ): tf.Tensor {
    return original.mul(1 - strength).add(styled.mul(strength));
  }

  /**
   * Copy canvas content
   */
  private copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(source, 0, 0);
    }
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryUsage(): void {
    if (tf.memory) {
      this.metrics.memoryUsage = tf.memory().numBytes;
    }
  }

  /**
   * Set style transfer configuration
   */
  setConfig(config: Partial<StyleTransferConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };
    this.metrics.currentStyle = this.currentConfig.styleName;
    
    errorHandler.info('Style transfer config updated', {
      style: this.currentConfig.styleName,
      strength: this.currentConfig.strength,
      enabled: this.currentConfig.enabled,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): StyleTransferConfig {
    return { ...this.currentConfig };
  }

  /**
   * Get available preset styles
   */
  getPresetStyles(): Record<string, any> {
    return this.presetStyles;
  }

  /**
   * Get current metrics
   */
  getMetrics(): StyleTransferMetrics {
    return { ...this.metrics };
  }

  /**
   * Enable/disable style transfer
   */
  setEnabled(enabled: boolean): void {
    this.currentConfig.enabled = enabled;
    errorHandler.info(`Style transfer ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set style strength
   */
  setStrength(strength: number): void {
    this.currentConfig.strength = Math.max(0, Math.min(1, strength));
    errorHandler.info(`Style transfer strength set to ${this.currentConfig.strength}`);
  }

  /**
   * Set blend mode
   */
  setBlendMode(mode: StyleTransferConfig['blendMode']): void {
    this.currentConfig.blendMode = mode;
    errorHandler.info(`Blend mode set to ${mode}`);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }

    // Dispose cached style tensors
    for (const tensor of this.styleCache.values()) {
      tensor.dispose();
    }
    this.styleCache.clear();

    this.isModelLoaded = false;
    this.metrics.modelLoaded = false;
    
    errorHandler.info('Style transfer service disposed');
  }
}

// Export singleton instance
export const styleTransferService = StyleTransferService.getInstance();