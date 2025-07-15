/**
 * AI-Powered Style Transfer System for v1z3r
 * Real-time visual style adaptation based on music analysis
 */

import * as tf from '@tensorflow/tfjs';
import { MusicFeatures, VisualParameters } from './aiMusicAnalyzer';

export interface StyleTransferConfig {
  enableRealTimeTransfer: boolean;
  maxResolution: number;
  targetFPS: number;
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra';
  enableTensorOptimization: boolean;
  batchSize: number;
  useWebGL: boolean;
  enableQuantization: boolean;
}

export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  category: 'abstract' | 'geometric' | 'organic' | 'minimal' | 'retro' | 'futuristic';
  colorProfile: ColorProfile;
  textureParams: TextureParams;
  motionParams: MotionParams;
  effectParams: EffectParams;
  musicAffinity: MusicAffinity;
}

export interface ColorProfile {
  primaryHue: number;
  secondaryHue: number;
  saturationRange: [number, number];
  brightnessRange: [number, number];
  contrastLevel: number;
  colorTemperature: number;
  colorHarmony: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary';
}

export interface TextureParams {
  roughness: number;
  metallic: number;
  emission: number;
  normalIntensity: number;
  patternScale: number;
  patternType: 'noise' | 'fractal' | 'cellular' | 'grid' | 'organic';
}

export interface MotionParams {
  flowSpeed: number;
  turbulence: number;
  rotationSpeed: number;
  scaleVariation: number;
  positionNoise: number;
  timeWarp: number;
}

export interface EffectParams {
  bloomIntensity: number;
  glowRadius: number;
  distortionAmount: number;
  chromaticAberration: number;
  vignette: number;
  filmGrain: number;
}

export interface MusicAffinity {
  tempoRange: [number, number];
  energyRange: [number, number];
  valenceRange: [number, number];
  genrePreference: string[];
  instrumentalPreference: number;
  acousticPreference: number;
}

export interface StyleTransferResult {
  styledVisuals: ImageData;
  confidence: number;
  processingTime: number;
  styleName: string;
  appliedParams: VisualParameters;
}

/**
 * Pre-defined Visual Styles
 */
export const VISUAL_STYLES: Record<string, VisualStyle> = {
  'synthwave': {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Retro-futuristic neon aesthetics',
    category: 'retro',
    colorProfile: {
      primaryHue: 315, // Magenta
      secondaryHue: 180, // Cyan
      saturationRange: [0.8, 1.0],
      brightnessRange: [0.3, 0.9],
      contrastLevel: 0.8,
      colorTemperature: 0.2,
      colorHarmony: 'complementary',
    },
    textureParams: {
      roughness: 0.1,
      metallic: 0.8,
      emission: 0.6,
      normalIntensity: 0.3,
      patternScale: 2.0,
      patternType: 'grid',
    },
    motionParams: {
      flowSpeed: 0.5,
      turbulence: 0.3,
      rotationSpeed: 0.1,
      scaleVariation: 0.2,
      positionNoise: 0.1,
      timeWarp: 0.8,
    },
    effectParams: {
      bloomIntensity: 0.8,
      glowRadius: 0.6,
      distortionAmount: 0.2,
      chromaticAberration: 0.3,
      vignette: 0.4,
      filmGrain: 0.2,
    },
    musicAffinity: {
      tempoRange: [120, 140],
      energyRange: [0.6, 0.9],
      valenceRange: [0.4, 0.8],
      genrePreference: ['electronic', 'synthwave', 'retrowave'],
      instrumentalPreference: 0.8,
      acousticPreference: 0.1,
    },
  },
  
  'organic_flow': {
    id: 'organic_flow',
    name: 'Organic Flow',
    description: 'Natural, fluid organic patterns',
    category: 'organic',
    colorProfile: {
      primaryHue: 120, // Green
      secondaryHue: 60, // Yellow
      saturationRange: [0.4, 0.7],
      brightnessRange: [0.2, 0.8],
      contrastLevel: 0.4,
      colorTemperature: 0.6,
      colorHarmony: 'analogous',
    },
    textureParams: {
      roughness: 0.6,
      metallic: 0.1,
      emission: 0.2,
      normalIntensity: 0.8,
      patternScale: 1.5,
      patternType: 'organic',
    },
    motionParams: {
      flowSpeed: 0.3,
      turbulence: 0.7,
      rotationSpeed: 0.05,
      scaleVariation: 0.4,
      positionNoise: 0.5,
      timeWarp: 0.3,
    },
    effectParams: {
      bloomIntensity: 0.3,
      glowRadius: 0.2,
      distortionAmount: 0.5,
      chromaticAberration: 0.1,
      vignette: 0.2,
      filmGrain: 0.05,
    },
    musicAffinity: {
      tempoRange: [80, 120],
      energyRange: [0.3, 0.7],
      valenceRange: [0.5, 0.8],
      genrePreference: ['ambient', 'chillout', 'downtempo'],
      instrumentalPreference: 0.6,
      acousticPreference: 0.7,
    },
  },
  
  'geometric_precision': {
    id: 'geometric_precision',
    name: 'Geometric Precision',
    description: 'Sharp, mathematical geometric forms',
    category: 'geometric',
    colorProfile: {
      primaryHue: 240, // Blue
      secondaryHue: 0, // Red
      saturationRange: [0.6, 0.9],
      brightnessRange: [0.4, 0.9],
      contrastLevel: 0.9,
      colorTemperature: 0.3,
      colorHarmony: 'split-complementary',
    },
    textureParams: {
      roughness: 0.0,
      metallic: 0.9,
      emission: 0.4,
      normalIntensity: 0.2,
      patternScale: 0.8,
      patternType: 'grid',
    },
    motionParams: {
      flowSpeed: 0.8,
      turbulence: 0.1,
      rotationSpeed: 0.3,
      scaleVariation: 0.1,
      positionNoise: 0.05,
      timeWarp: 0.9,
    },
    effectParams: {
      bloomIntensity: 0.6,
      glowRadius: 0.4,
      distortionAmount: 0.1,
      chromaticAberration: 0.2,
      vignette: 0.1,
      filmGrain: 0.0,
    },
    musicAffinity: {
      tempoRange: [140, 180],
      energyRange: [0.8, 1.0],
      valenceRange: [0.6, 0.9],
      genrePreference: ['techno', 'house', 'trance'],
      instrumentalPreference: 0.9,
      acousticPreference: 0.2,
    },
  },
  
  'minimal_zen': {
    id: 'minimal_zen',
    name: 'Minimal Zen',
    description: 'Clean, minimal aesthetic',
    category: 'minimal',
    colorProfile: {
      primaryHue: 0, // White/Gray
      secondaryHue: 200, // Light Blue
      saturationRange: [0.0, 0.3],
      brightnessRange: [0.6, 0.95],
      contrastLevel: 0.2,
      colorTemperature: 0.5,
      colorHarmony: 'monochromatic',
    },
    textureParams: {
      roughness: 0.2,
      metallic: 0.0,
      emission: 0.1,
      normalIntensity: 0.1,
      patternScale: 4.0,
      patternType: 'noise',
    },
    motionParams: {
      flowSpeed: 0.1,
      turbulence: 0.1,
      rotationSpeed: 0.02,
      scaleVariation: 0.05,
      positionNoise: 0.02,
      timeWarp: 0.1,
    },
    effectParams: {
      bloomIntensity: 0.1,
      glowRadius: 0.1,
      distortionAmount: 0.02,
      chromaticAberration: 0.0,
      vignette: 0.05,
      filmGrain: 0.0,
    },
    musicAffinity: {
      tempoRange: [60, 100],
      energyRange: [0.1, 0.5],
      valenceRange: [0.3, 0.7],
      genrePreference: ['ambient', 'meditation', 'classical'],
      instrumentalPreference: 0.8,
      acousticPreference: 0.8,
    },
  },
  
  'abstract_expressionism': {
    id: 'abstract_expressionism',
    name: 'Abstract Expressionism',
    description: 'Dynamic, expressive abstract art',
    category: 'abstract',
    colorProfile: {
      primaryHue: 30, // Orange
      secondaryHue: 270, // Purple
      saturationRange: [0.5, 1.0],
      brightnessRange: [0.2, 0.9],
      contrastLevel: 0.7,
      colorTemperature: 0.4,
      colorHarmony: 'triadic',
    },
    textureParams: {
      roughness: 0.8,
      metallic: 0.3,
      emission: 0.3,
      normalIntensity: 0.9,
      patternScale: 3.0,
      patternType: 'fractal',
    },
    motionParams: {
      flowSpeed: 0.6,
      turbulence: 0.9,
      rotationSpeed: 0.2,
      scaleVariation: 0.8,
      positionNoise: 0.7,
      timeWarp: 0.5,
    },
    effectParams: {
      bloomIntensity: 0.5,
      glowRadius: 0.3,
      distortionAmount: 0.6,
      chromaticAberration: 0.2,
      vignette: 0.3,
      filmGrain: 0.1,
    },
    musicAffinity: {
      tempoRange: [90, 160],
      energyRange: [0.4, 0.8],
      valenceRange: [0.2, 0.9],
      genrePreference: ['experimental', 'jazz', 'progressive'],
      instrumentalPreference: 0.7,
      acousticPreference: 0.4,
    },
  },
};

/**
 * AI Style Transfer Engine
 */
export class AIStyleTransferEngine {
  private config: StyleTransferConfig;
  private tfModel: tf.LayersModel | null = null;
  private styleEmbeddings: Map<string, tf.Tensor> = new Map();
  private currentStyle: VisualStyle | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isModelLoaded: boolean = false;
  private processingQueue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;

  constructor(config: Partial<StyleTransferConfig> = {}) {
    this.config = {
      enableRealTimeTransfer: true,
      maxResolution: 512,
      targetFPS: 30,
      qualityLevel: 'medium',
      enableTensorOptimization: true,
      batchSize: 1,
      useWebGL: true,
      enableQuantization: true,
      ...config,
    };

    // Create canvas for image processing
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.maxResolution;
    this.canvas.height = this.config.maxResolution;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Initialize the style transfer engine
   */
  async initialize(): Promise<void> {
    console.log('[AIStyleTransferEngine] Initializing...');

    try {
      // Configure TensorFlow.js for optimal performance
      await this.configureTensorFlow();

      // Load or create the style transfer model
      await this.loadStyleTransferModel();

      // Pre-compute style embeddings
      await this.precomputeStyleEmbeddings();

      this.isModelLoaded = true;
      console.log('[AIStyleTransferEngine] Initialization complete');
    } catch (error) {
      console.error('[AIStyleTransferEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Configure TensorFlow.js for optimal performance
   */
  private async configureTensorFlow(): Promise<void> {
    // Set backend based on configuration
    if (this.config.useWebGL) {
      await tf.setBackend('webgl');
    } else {
      await tf.setBackend('cpu');
    }

    // Enable performance optimizations
    if (this.config.enableTensorOptimization) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_LAZILY_UNPACK', true);
      tf.env().set('WEBGL_CONV_IM2COL', true);
    }

    console.log(`[AIStyleTransferEngine] TensorFlow backend: ${tf.getBackend()}`);
  }

  /**
   * Load or create the style transfer model
   */
  private async loadStyleTransferModel(): Promise<void> {
    try {
      // In production, load a pre-trained style transfer model
      // For now, create a simplified model for demonstration
      this.tfModel = await this.createStyleTransferModel();
      
      console.log('[AIStyleTransferEngine] Style transfer model loaded');
    } catch (error) {
      console.error('[AIStyleTransferEngine] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Create a simplified style transfer model
   */
  private async createStyleTransferModel(): Promise<tf.LayersModel> {
    // Simplified neural style transfer architecture
    const contentInput = tf.input({ shape: [null, null, 3], name: 'content' });
    const styleInput = tf.input({ shape: [256], name: 'style' });

    // Content feature extraction
    let content = tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
    }).apply(contentInput) as tf.SymbolicTensor;

    content = tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
    }).apply(content) as tf.SymbolicTensor;

    // Style conditioning
    const styleExpanded = tf.layers.dense({
      units: 64,
      activation: 'relu',
    }).apply(styleInput) as tf.SymbolicTensor;

    const styleReshaped = tf.layers.reshape({
      targetShape: [1, 1, 64],
    }).apply(styleExpanded) as tf.SymbolicTensor;

    // Apply style conditioning to content
    const contentStyled = tf.layers.multiply().apply([content, styleReshaped]) as tf.SymbolicTensor;

    // Decoder
    let output = tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
    }).apply(contentStyled) as tf.SymbolicTensor;

    output = tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
    }).apply(output) as tf.SymbolicTensor;

    output = tf.layers.conv2d({
      filters: 3,
      kernelSize: 3,
      padding: 'same',
      activation: 'tanh',
    }).apply(output) as tf.SymbolicTensor;

    const model = tf.model({
      inputs: [contentInput, styleInput],
      outputs: output,
    });

    // Compile model
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });

    return model;
  }

  /**
   * Pre-compute style embeddings for all available styles
   */
  private async precomputeStyleEmbeddings(): Promise<void> {
    console.log('[AIStyleTransferEngine] Pre-computing style embeddings...');

    for (const [styleId, style] of Object.entries(VISUAL_STYLES)) {
      const embedding = this.createStyleEmbedding(style);
      this.styleEmbeddings.set(styleId, embedding);
    }

    console.log(`[AIStyleTransferEngine] Pre-computed ${this.styleEmbeddings.size} style embeddings`);
  }

  /**
   * Create style embedding from visual style parameters
   */
  private createStyleEmbedding(style: VisualStyle): tf.Tensor {
    const embedding = [
      // Color profile (8 values)
      style.colorProfile.primaryHue / 360,
      style.colorProfile.secondaryHue / 360,
      style.colorProfile.saturationRange[0],
      style.colorProfile.saturationRange[1],
      style.colorProfile.brightnessRange[0],
      style.colorProfile.brightnessRange[1],
      style.colorProfile.contrastLevel,
      style.colorProfile.colorTemperature,

      // Texture parameters (6 values)
      style.textureParams.roughness,
      style.textureParams.metallic,
      style.textureParams.emission,
      style.textureParams.normalIntensity,
      style.textureParams.patternScale / 5, // Normalize
      this.encodePatternType(style.textureParams.patternType),

      // Motion parameters (6 values)
      style.motionParams.flowSpeed,
      style.motionParams.turbulence,
      style.motionParams.rotationSpeed,
      style.motionParams.scaleVariation,
      style.motionParams.positionNoise,
      style.motionParams.timeWarp,

      // Effect parameters (6 values)
      style.effectParams.bloomIntensity,
      style.effectParams.glowRadius,
      style.effectParams.distortionAmount,
      style.effectParams.chromaticAberration,
      style.effectParams.vignette,
      style.effectParams.filmGrain,
    ];

    // Pad to 256 dimensions
    while (embedding.length < 256) {
      embedding.push(0);
    }

    return tf.tensor1d(embedding.slice(0, 256));
  }

  /**
   * Encode pattern type to numeric value
   */
  private encodePatternType(patternType: string): number {
    const types = ['noise', 'fractal', 'cellular', 'grid', 'organic'];
    return types.indexOf(patternType) / types.length;
  }

  /**
   * Select optimal style based on music features
   */
  selectStyleFromMusic(musicFeatures: MusicFeatures): VisualStyle {
    let bestStyle: VisualStyle = VISUAL_STYLES.minimal_zen;
    let bestScore = -1;

    for (const style of Object.values(VISUAL_STYLES)) {
      const score = this.calculateStyleScore(style, musicFeatures);
      if (score > bestScore) {
        bestScore = score;
        bestStyle = style;
      }
    }

    return bestStyle;
  }

  /**
   * Calculate style affinity score based on music features
   */
  private calculateStyleScore(style: VisualStyle, musicFeatures: MusicFeatures): number {
    let score = 0;

    const { musicAffinity } = style;

    // Tempo matching
    if (musicFeatures.tempo >= musicAffinity.tempoRange[0] && 
        musicFeatures.tempo <= musicAffinity.tempoRange[1]) {
      score += 0.3;
    }

    // Energy matching
    if (musicFeatures.energy >= musicAffinity.energyRange[0] && 
        musicFeatures.energy <= musicAffinity.energyRange[1]) {
      score += 0.3;
    }

    // Valence matching
    if (musicFeatures.valence >= musicAffinity.valenceRange[0] && 
        musicFeatures.valence <= musicAffinity.valenceRange[1]) {
      score += 0.2;
    }

    // Instrumental preference
    score += 0.1 * (1 - Math.abs(musicFeatures.instrumentalness - musicAffinity.instrumentalPreference));

    // Acoustic preference
    score += 0.1 * (1 - Math.abs(musicFeatures.acousticness - musicAffinity.acousticPreference));

    return score;
  }

  /**
   * Apply style transfer to visual content
   */
  async applyStyleTransfer(
    inputImage: ImageData,
    targetStyle: VisualStyle,
    musicFeatures: MusicFeatures
  ): Promise<StyleTransferResult> {
    if (!this.isModelLoaded || !this.tfModel) {
      throw new Error('Style transfer model not loaded');
    }

    const startTime = performance.now();

    try {
      // Resize input image if necessary
      const resizedImage = this.resizeImage(inputImage, this.config.maxResolution);

      // Convert to tensor
      const contentTensor = tf.browser.fromPixels(resizedImage).expandDims(0);
      const normalizedContent = contentTensor.div(127.5).sub(1); // Normalize to [-1, 1]

      // Get style embedding
      const styleEmbedding = this.styleEmbeddings.get(targetStyle.id);
      if (!styleEmbedding) {
        throw new Error(`Style embedding not found for ${targetStyle.id}`);
      }

      // Adapt style based on music features
      const adaptedStyleEmbedding = this.adaptStyleToMusic(styleEmbedding, musicFeatures);

      // Apply style transfer
      const styledTensor = this.tfModel.predict([
        normalizedContent,
        adaptedStyleEmbedding.expandDims(0)
      ]) as tf.Tensor;

      // Denormalize output
      const denormalizedOutput = styledTensor.add(1).mul(127.5).clipByValue(0, 255);

      // Convert back to ImageData
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = resizedImage.width;
      outputCanvas.height = resizedImage.height;
      
      await tf.browser.toPixels(denormalizedOutput.squeeze() as tf.Tensor3D, outputCanvas);
      
      const outputCtx = outputCanvas.getContext('2d')!;
      const styledImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

      // Cleanup tensors
      contentTensor.dispose();
      normalizedContent.dispose();
      adaptedStyleEmbedding.dispose();
      styledTensor.dispose();
      denormalizedOutput.dispose();

      const processingTime = performance.now() - startTime;

      return {
        styledVisuals: styledImageData,
        confidence: 0.8, // Placeholder confidence
        processingTime,
        styleName: targetStyle.name,
        appliedParams: this.convertStyleToVisualParams(targetStyle, musicFeatures),
      };

    } catch (error) {
      console.error('[AIStyleTransferEngine] Style transfer failed:', error);
      throw error;
    }
  }

  /**
   * Adapt style embedding based on music features
   */
  private adaptStyleToMusic(styleEmbedding: tf.Tensor, musicFeatures: MusicFeatures): tf.Tensor {
    // Create music feature vector
    const musicVector = tf.tensor1d([
      musicFeatures.energy,
      musicFeatures.valence,
      musicFeatures.tempo / 200, // Normalize
      musicFeatures.spectralCentroid / 8000, // Normalize
      musicFeatures.rhythmComplexity,
      musicFeatures.syncopation,
    ]);

    // Expand to match style embedding dimensions
    const expandedMusicVector = musicVector.tile([Math.floor(256 / 6)]).slice([0], [256]);

    // Blend style embedding with music features
    const adaptedEmbedding = styleEmbedding.mul(0.8).add(expandedMusicVector.mul(0.2));

    musicVector.dispose();
    expandedMusicVector.dispose();

    return adaptedEmbedding;
  }

  /**
   * Resize image to target resolution
   */
  private resizeImage(imageData: ImageData, maxSize: number): ImageData {
    const scale = Math.min(maxSize / imageData.width, maxSize / imageData.height);
    
    if (scale >= 1) {
      return imageData; // No resize needed
    }

    const newWidth = Math.floor(imageData.width * scale);
    const newHeight = Math.floor(imageData.height * scale);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    const resizedCtx = resizedCanvas.getContext('2d')!;
    
    resizedCtx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    
    return resizedCtx.getImageData(0, 0, newWidth, newHeight);
  }

  /**
   * Convert visual style to visual parameters
   */
  private convertStyleToVisualParams(style: VisualStyle, musicFeatures: MusicFeatures): VisualParameters {
    const baseParams = {
      // Color parameters
      hue: style.colorProfile.primaryHue,
      saturation: (style.colorProfile.saturationRange[0] + style.colorProfile.saturationRange[1]) / 2,
      brightness: (style.colorProfile.brightnessRange[0] + style.colorProfile.brightnessRange[1]) / 2,
      colorTemperature: style.colorProfile.colorTemperature,

      // Motion parameters
      speed: style.motionParams.flowSpeed,
      intensity: musicFeatures.energy,
      complexity: style.motionParams.turbulence,
      smoothness: 1 - style.motionParams.positionNoise,

      // Effect parameters
      particleDensity: style.effectParams.bloomIntensity,
      particleSize: style.effectParams.glowRadius,
      waveAmplitude: musicFeatures.energy,
      geometryComplexity: style.motionParams.scaleVariation,

      // Style parameters
      visualStyle: style.category,
      effectType: 'particles' as const,
      blendMode: 'normal' as const,

      // Temporal parameters
      transitionSpeed: style.motionParams.timeWarp,
      synchronization: 0.8,
      anticipation: 0.5,
    };

    return baseParams;
  }

  /**
   * Get available styles
   */
  getAvailableStyles(): VisualStyle[] {
    return Object.values(VISUAL_STYLES);
  }

  /**
   * Get style by ID
   */
  getStyleById(id: string): VisualStyle | null {
    return VISUAL_STYLES[id] || null;
  }

  /**
   * Set current style
   */
  setCurrentStyle(style: VisualStyle): void {
    this.currentStyle = style;
  }

  /**
   * Get current style
   */
  getCurrentStyle(): VisualStyle | null {
    return this.currentStyle;
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Get processing performance stats
   */
  getPerformanceStats(): {
    averageProcessingTime: number;
    targetFPS: number;
    actualFPS: number;
    memoryUsage: number;
  } {
    return {
      averageProcessingTime: 50, // Placeholder
      targetFPS: this.config.targetFPS,
      actualFPS: 25, // Placeholder
      memoryUsage: tf.memory().numBytes,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StyleTransferConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.tfModel) {
      this.tfModel.dispose();
      this.tfModel = null;
    }

    this.styleEmbeddings.forEach(embedding => embedding.dispose());
    this.styleEmbeddings.clear();

    this.isModelLoaded = false;
    this.currentStyle = null;
  }
}

/**
 * Factory function to create and initialize style transfer engine
 */
export async function createStyleTransferEngine(
  config?: Partial<StyleTransferConfig>
): Promise<AIStyleTransferEngine> {
  const engine = new AIStyleTransferEngine(config);
  await engine.initialize();
  return engine;
}