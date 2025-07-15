/**
 * AI VJ Master Controller for v1z3r
 * Orchestrates all AI and WebGPU components for unified VJ performance
 */

import * as THREE from 'three';
import { V1z3rRenderer } from './webgpuRenderer';
import { AIMusicalAnalyzer, MusicFeatures, VisualParameters } from './aiMusicAnalyzer';
import { AIStyleTransferEngine, VisualStyle } from './aiStyleTransfer';
import { WebGPUParticleSystem } from './webgpuParticles';
import { ProfessionalMIDIManager } from './professionalMIDI';
import { webgpuDetector } from './webgpuDetection';

export interface AIVJConfig {
  canvas: HTMLCanvasElement;
  audioContext: AudioContext;
  enableWebGPU: boolean;
  enableAI: boolean;
  enableMIDI: boolean;
  enableStyleTransfer: boolean;
  enableParticles: boolean;
  performanceMode: 'quality' | 'performance' | 'balanced';
  targetFPS: number;
  maxParticles: number;
  aiUpdateInterval: number;
  styleTransferQuality: 'low' | 'medium' | 'high';
  debugMode: boolean;
}

export interface AIVJState {
  isInitialized: boolean;
  isWebGPUEnabled: boolean;
  isAIEnabled: boolean;
  isMIDIEnabled: boolean;
  currentStyle: VisualStyle | null;
  currentVisualParams: VisualParameters | null;
  currentMusicFeatures: MusicFeatures | null;
  performanceMetrics: PerformanceMetrics;
  connectedControllers: number;
  lastUpdate: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  aiProcessingTime: number;
  renderTime: number;
  particleCount: number;
  memoryUsage: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
}

export interface AIVJEvent {
  type: 'style_change' | 'parameter_update' | 'beat_detected' | 'midi_input' | 'performance_warning';
  timestamp: number;
  data: any;
}

/**
 * AI VJ Master Controller
 */
export class AIVJMaster {
  private config: AIVJConfig;
  private state: AIVJState;
  private eventListeners: Map<string, Array<(event: AIVJEvent) => void>> = new Map();

  // Core components
  private renderer: V1z3rRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private musicAnalyzer: AIMusicalAnalyzer | null = null;
  private styleTransferEngine: AIStyleTransferEngine | null = null;
  private particleSystem: WebGPUParticleSystem | null = null;
  private midiManager: ProfessionalMIDIManager | null = null;

  // Audio processing
  private audioContext: AudioContext;
  private audioSource: AudioNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioData: Float32Array = new Float32Array(1024);

  // Animation and timing
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private lastAIUpdate: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  // Performance monitoring
  private performanceMonitor: {
    frameTimings: number[];
    aiTimings: number[];
    renderTimings: number[];
    maxSamples: number;
  };

  constructor(config: Partial<AIVJConfig> = {}) {
    this.config = {
      canvas: document.createElement('canvas'),
      audioContext: new AudioContext(),
      enableWebGPU: true,
      enableAI: true,
      enableMIDI: true,
      enableStyleTransfer: true,
      enableParticles: true,
      performanceMode: 'balanced',
      targetFPS: 60,
      maxParticles: 50000,
      aiUpdateInterval: 100, // 100ms
      styleTransferQuality: 'medium',
      debugMode: false,
      ...config,
    };

    this.audioContext = this.config.audioContext;
    this.state = this.initializeState();
    this.performanceMonitor = {
      frameTimings: [],
      aiTimings: [],
      renderTimings: [],
      maxSamples: 100,
    };
  }

  /**
   * Initialize the AI VJ Master system
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      console.warn('[AIVJMaster] Already initialized');
      return;
    }

    console.log('[AIVJMaster] Initializing AI VJ Master...');
    const startTime = performance.now();

    try {
      // Initialize renderer
      await this.initializeRenderer();

      // Initialize Three.js scene
      this.initializeScene();

      // Initialize audio processing
      await this.initializeAudioProcessing();

      // Initialize AI components
      if (this.config.enableAI) {
        await this.initializeAI();
      }

      // Initialize MIDI
      if (this.config.enableMIDI) {
        await this.initializeMIDI();
      }

      // Initialize particle system
      if (this.config.enableParticles && this.state.isWebGPUEnabled) {
        await this.initializeParticleSystem();
      }

      // Setup event handlers
      this.setupEventHandlers();

      // Start animation loop
      this.startAnimationLoop();

      this.state.isInitialized = true;
      const initTime = performance.now() - startTime;
      
      console.log(`[AIVJMaster] Initialization complete in ${initTime.toFixed(2)}ms`);
      this.emitEvent('initialization_complete', { initTime });

    } catch (error) {
      console.error('[AIVJMaster] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize renderer with WebGPU support
   */
  private async initializeRenderer(): Promise<void> {
    this.renderer = new V1z3rRenderer({
      canvas: this.config.canvas,
      enableWebGPU: this.config.enableWebGPU,
      powerPreference: this.config.performanceMode === 'performance' ? 'high-performance' : 'low-power',
      antialias: this.config.performanceMode !== 'performance',
      debugMode: this.config.debugMode,
    });

    const { renderer, isWebGPU } = await this.renderer.initialize();
    this.state.isWebGPUEnabled = isWebGPU;

    console.log(`[AIVJMaster] Renderer initialized: ${isWebGPU ? 'WebGPU' : 'WebGL'}`);
  }

  /**
   * Initialize Three.js scene
   */
  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.config.canvas.width / this.config.canvas.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(directionalLight);

    console.log('[AIVJMaster] Three.js scene initialized');
  }

  /**
   * Initialize audio processing
   */
  private async initializeAudioProcessing(): Promise<void> {
    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create analyser node
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.0;

      // Initialize audio data array
      this.audioData = new Float32Array(this.analyserNode.frequencyBinCount);

      console.log('[AIVJMaster] Audio processing initialized');
    } catch (error) {
      console.error('[AIVJMaster] Audio initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize AI components
   */
  private async initializeAI(): Promise<void> {
    try {
      // Initialize music analyzer
      this.musicAnalyzer = new AIMusicalAnalyzer(this.audioContext);
      await this.musicAnalyzer.initialize();

      // Connect to analyser node
      if (this.analyserNode) {
        this.musicAnalyzer.connect(this.analyserNode);
      }

      // Initialize style transfer engine
      if (this.config.enableStyleTransfer) {
        this.styleTransferEngine = new AIStyleTransferEngine({
          qualityLevel: this.config.styleTransferQuality,
          targetFPS: this.config.targetFPS,
          enableRealTimeTransfer: true,
        });
        await this.styleTransferEngine.initialize();
      }

      this.state.isAIEnabled = true;
      console.log('[AIVJMaster] AI components initialized');
    } catch (error) {
      console.error('[AIVJMaster] AI initialization failed:', error);
      this.state.isAIEnabled = false;
    }
  }

  /**
   * Initialize MIDI support
   */
  private async initializeMIDI(): Promise<void> {
    try {
      this.midiManager = new ProfessionalMIDIManager();
      await this.midiManager.initialize();

      // Setup MIDI event handlers
      this.midiManager.setParameterChangeHandler((parameter, value) => {
        this.handleMIDIParameterChange(parameter, value);
      });

      this.midiManager.setButtonPressHandler((button, velocity) => {
        this.handleMIDIButtonPress(button, velocity);
      });

      this.midiManager.setPadHitHandler((pad, velocity, pressure) => {
        this.handleMIDIPadHit(pad, velocity, pressure);
      });

      this.midiManager.setControllerConnectionHandlers(
        (controller) => {
          this.state.connectedControllers++;
          this.emitEvent('midi_controller_connected', { controller });
        },
        (controllerId) => {
          this.state.connectedControllers--;
          this.emitEvent('midi_controller_disconnected', { controllerId });
        }
      );

      this.state.isMIDIEnabled = true;
      console.log('[AIVJMaster] MIDI support initialized');
    } catch (error) {
      console.error('[AIVJMaster] MIDI initialization failed:', error);
      this.state.isMIDIEnabled = false;
    }
  }

  /**
   * Initialize particle system
   */
  private async initializeParticleSystem(): Promise<void> {
    if (!this.state.isWebGPUEnabled || !this.renderer) {
      console.warn('[AIVJMaster] WebGPU not available, skipping particle system');
      return;
    }

    try {
      const threeRenderer = this.renderer.getThreeRenderer();
      if (!threeRenderer) {
        throw new Error('Three.js renderer not available');
      }

      // Get WebGPU device from renderer
      const device = (threeRenderer as any)._device as GPUDevice;
      const capabilities = this.renderer.getCapabilities();

      if (!device || !capabilities) {
        throw new Error('WebGPU device not available');
      }

      this.particleSystem = new WebGPUParticleSystem(this.config.canvas, {
        maxParticles: this.config.maxParticles,
        enablePhysics: true,
        audioReactivity: 1.0,
        colorMode: 'spectrum',
        blendMode: 'additive',
      });

      await this.particleSystem.initialize(device, capabilities);
      
      console.log('[AIVJMaster] Particle system initialized');
    } catch (error) {
      console.error('[AIVJMaster] Particle system initialization failed:', error);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Resize handler
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Visibility change handler
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAnimation();
      } else {
        this.resumeAnimation();
      }
    });

    // Performance monitoring
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  /**
   * Start animation loop
   */
  private startAnimationLoop(): void {
    const animate = (timestamp: number) => {
      if (!this.state.isInitialized) return;

      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      // Update components
      this.update(deltaTime);

      // Render frame
      this.render();

      // Continue animation
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
    console.log('[AIVJMaster] Animation loop started');
  }

  /**
   * Update all components
   */
  private update(deltaTime: number): void {
    const frameStartTime = performance.now();

    // Update audio data
    this.updateAudioData();

    // Update AI components
    if (this.state.isAIEnabled && this.shouldUpdateAI()) {
      this.updateAI();
    }

    // Update particle system
    if (this.particleSystem && this.state.currentMusicFeatures) {
      this.particleSystem.update(deltaTime / 1000, this.audioData, this.state.currentMusicFeatures);
    }

    // Update scene based on visual parameters
    if (this.state.currentVisualParams) {
      this.updateScene(this.state.currentVisualParams);
    }

    // Record frame timing
    const frameTime = performance.now() - frameStartTime;
    this.recordFrameTiming(frameTime);

    this.state.lastUpdate = Date.now();
  }

  /**
   * Update audio data from analyser
   */
  private updateAudioData(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);

    // Convert to Float32Array
    for (let i = 0; i < bufferLength; i++) {
      this.audioData[i] = dataArray[i];
    }
  }

  /**
   * Check if AI should update based on interval
   */
  private shouldUpdateAI(): boolean {
    return Date.now() - this.lastAIUpdate >= this.config.aiUpdateInterval;
  }

  /**
   * Update AI components
   */
  private async updateAI(): Promise<void> {
    if (!this.musicAnalyzer) return;

    const aiStartTime = performance.now();

    try {
      // Analyze music
      const visualParams = await this.musicAnalyzer.analyzeRealtime();
      this.state.currentVisualParams = visualParams;
      this.state.currentMusicFeatures = this.musicAnalyzer.getCurrentFeatures();

      // Update style if needed
      if (this.styleTransferEngine && this.state.currentMusicFeatures) {
        const newStyle = this.styleTransferEngine.selectStyleFromMusic(this.state.currentMusicFeatures);
        if (newStyle !== this.state.currentStyle) {
          this.state.currentStyle = newStyle;
          this.styleTransferEngine.setCurrentStyle(newStyle);
          this.emitEvent('style_change', { style: newStyle });
        }
      }

      // Apply MIDI modifications
      if (this.midiManager && this.state.connectedControllers > 0) {
        const controllers = this.midiManager.getConnectedControllers();
        for (const controller of controllers) {
          this.state.currentVisualParams = this.midiManager.updateVisualParameters(
            controller.deviceName,
            this.state.currentVisualParams
          );
        }
      }

      this.lastAIUpdate = Date.now();
      
      // Record AI timing
      const aiTime = performance.now() - aiStartTime;
      this.recordAITiming(aiTime);

      this.emitEvent('parameter_update', { 
        visualParams: this.state.currentVisualParams,
        musicFeatures: this.state.currentMusicFeatures,
      });

    } catch (error) {
      console.error('[AIVJMaster] AI update failed:', error);
    }
  }

  /**
   * Update scene based on visual parameters
   */
  private updateScene(visualParams: VisualParameters): void {
    if (!this.scene) return;

    // Update scene background color
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHSL(
        visualParams.hue / 360,
        visualParams.saturation,
        visualParams.brightness * 0.1
      );
    }

    // Update camera position based on parameters
    if (this.camera) {
      const time = Date.now() * 0.001;
      const intensity = visualParams.intensity;
      
      this.camera.position.x = Math.sin(time * visualParams.speed) * intensity * 2;
      this.camera.position.y = Math.cos(time * visualParams.speed * 0.7) * intensity * 1.5;
      this.camera.position.z = 10 + Math.sin(time * visualParams.speed * 0.3) * intensity * 3;
      
      this.camera.lookAt(0, 0, 0);
    }

    // Update lighting based on parameters
    const lights = this.scene.children.filter(child => child instanceof THREE.Light);
    for (const light of lights) {
      if (light instanceof THREE.DirectionalLight) {
        light.intensity = 0.5 + visualParams.intensity * 0.5;
        light.color.setHSL(
          visualParams.hue / 360,
          visualParams.saturation * 0.5,
          0.8
        );
      }
    }
  }

  /**
   * Render frame
   */
  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    const renderStartTime = performance.now();

    // Render Three.js scene
    this.renderer.render(this.scene, this.camera);

    // Render particle system
    if (this.particleSystem && this.camera) {
      const viewMatrix = this.camera.matrixWorldInverse;
      const projectionMatrix = this.camera.projectionMatrix;
      const viewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(projectionMatrix, viewMatrix);
      
      this.particleSystem.render(new Float32Array(viewProjectionMatrix.elements));
    }

    // Record render timing
    const renderTime = performance.now() - renderStartTime;
    this.recordRenderTiming(renderTime);

    this.frameCount++;
  }

  /**
   * Handle MIDI parameter changes
   */
  private handleMIDIParameterChange(parameter: string, value: number): void {
    this.emitEvent('midi_input', {
      type: 'parameter_change',
      parameter,
      value,
    });

    // Apply parameter change to current visual parameters
    if (this.state.currentVisualParams) {
      this.applyParameterChange(parameter, value);
    }
  }

  /**
   * Handle MIDI button presses
   */
  private handleMIDIButtonPress(button: string, velocity: number): void {
    this.emitEvent('midi_input', {
      type: 'button_press',
      button,
      velocity,
    });

    // Handle preset changes
    if (button.startsWith('preset_')) {
      const presetNumber = parseInt(button.split('_')[1]);
      this.loadPreset(presetNumber);
    }
  }

  /**
   * Handle MIDI pad hits
   */
  private handleMIDIPadHit(pad: string, velocity: number, pressure?: number): void {
    this.emitEvent('midi_input', {
      type: 'pad_hit',
      pad,
      velocity,
      pressure,
    });

    // Trigger visual effects based on pad hits
    this.triggerPadEffect(pad, velocity, pressure);
  }

  /**
   * Apply parameter change to visual parameters
   */
  private applyParameterChange(parameter: string, value: number): void {
    if (!this.state.currentVisualParams) return;

    const parameterMapping: Record<string, keyof VisualParameters> = {
      'master_intensity': 'intensity',
      'master_brightness': 'brightness',
      'master_saturation': 'saturation',
      'master_speed': 'speed',
      'master_complexity': 'complexity',
      'effect_1_intensity': 'particleDensity',
      'effect_2_intensity': 'waveAmplitude',
      'layer_1_opacity': 'particleSize',
      'layer_2_opacity': 'geometryComplexity',
    };

    const mappedParameter = parameterMapping[parameter];
    if (mappedParameter) {
      (this.state.currentVisualParams as any)[mappedParameter] = value;
    }
  }

  /**
   * Load preset
   */
  private loadPreset(presetNumber: number): void {
    // Implementation would load preset from storage
    console.log(`[AIVJMaster] Loading preset ${presetNumber}`);
    
    // For now, just change to a different style
    if (this.styleTransferEngine) {
      const styles = this.styleTransferEngine.getAvailableStyles();
      const style = styles[presetNumber % styles.length];
      if (style) {
        this.state.currentStyle = style;
        this.styleTransferEngine.setCurrentStyle(style);
        this.emitEvent('style_change', { style });
      }
    }
  }

  /**
   * Trigger pad effect
   */
  private triggerPadEffect(pad: string, velocity: number, pressure?: number): void {
    // Implementation would trigger specific effects based on pad
    console.log(`[AIVJMaster] Pad effect triggered: ${pad}, velocity: ${velocity}`);
    
    // Example: Increase particle emission on pad hit
    if (this.particleSystem) {
      this.particleSystem.updateConfig({
        emissionRate: 2000 * velocity,
      });
    }
  }

  /**
   * Connect audio source
   */
  connectAudioSource(source: AudioNode): void {
    if (this.analyserNode) {
      source.connect(this.analyserNode);
      this.audioSource = source;
      console.log('[AIVJMaster] Audio source connected');
    }
  }

  /**
   * Disconnect audio source
   */
  disconnectAudioSource(): void {
    if (this.audioSource && this.analyserNode) {
      this.audioSource.disconnect(this.analyserNode);
      this.audioSource = null;
      console.log('[AIVJMaster] Audio source disconnected');
    }
  }

  /**
   * Handle resize
   */
  private handleResize(): void {
    if (!this.renderer || !this.camera) return;

    const { canvas } = this.config;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Pause animation
   */
  private pauseAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Resume animation
   */
  private resumeAnimation(): void {
    if (!this.animationId) {
      this.startAnimationLoop();
    }
  }

  /**
   * Record performance timings
   */
  private recordFrameTiming(time: number): void {
    this.performanceMonitor.frameTimings.push(time);
    if (this.performanceMonitor.frameTimings.length > this.performanceMonitor.maxSamples) {
      this.performanceMonitor.frameTimings.shift();
    }
  }

  private recordAITiming(time: number): void {
    this.performanceMonitor.aiTimings.push(time);
    if (this.performanceMonitor.aiTimings.length > this.performanceMonitor.maxSamples) {
      this.performanceMonitor.aiTimings.shift();
    }
  }

  private recordRenderTiming(time: number): void {
    this.performanceMonitor.renderTimings.push(time);
    if (this.performanceMonitor.renderTimings.length > this.performanceMonitor.maxSamples) {
      this.performanceMonitor.renderTimings.shift();
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const { frameTimings, aiTimings, renderTimings } = this.performanceMonitor;

    this.state.performanceMetrics = {
      fps: this.frameCount,
      frameTime: frameTimings.length > 0 ? frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length : 0,
      aiProcessingTime: aiTimings.length > 0 ? aiTimings.reduce((a, b) => a + b, 0) / aiTimings.length : 0,
      renderTime: renderTimings.length > 0 ? renderTimings.reduce((a, b) => a + b, 0) / renderTimings.length : 0,
      particleCount: this.particleSystem?.getMetrics().activeParticles || 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      gpuMemoryUsage: this.renderer?.getMetrics().gpuMemoryUsage || 0,
      cpuUsage: 0, // Would need additional monitoring
    };

    this.frameCount = 0;

    // Check for performance issues
    if (this.state.performanceMetrics.fps < this.config.targetFPS * 0.8) {
      this.emitEvent('performance_warning', {
        type: 'low_fps',
        fps: this.state.performanceMetrics.fps,
        target: this.config.targetFPS,
      });
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(type: string, data: any): void {
    const listeners = this.eventListeners.get(type) || [];
    const event: AIVJEvent = {
      type: type as any,
      timestamp: Date.now(),
      data,
    };

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[AIVJMaster] Event listener error for ${type}:`, error);
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type: string, listener: (event: AIVJEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: string, listener: (event: AIVJEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): AIVJState {
    return { ...this.state };
  }

  /**
   * Get audio context
   */
  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Get current visual parameters
   */
  getCurrentVisualParameters(): VisualParameters | null {
    return this.state.currentVisualParams;
  }

  /**
   * Get current music features
   */
  getCurrentMusicFeatures(): MusicFeatures | null {
    return this.state.currentMusicFeatures;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.state.performanceMetrics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIVJConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    if (newConfig.targetFPS && this.renderer) {
      // Update renderer target FPS
    }
    
    if (newConfig.maxParticles && this.particleSystem) {
      this.particleSystem.updateConfig({ maxParticles: newConfig.maxParticles });
    }
  }

  /**
   * Initialize default state
   */
  private initializeState(): AIVJState {
    return {
      isInitialized: false,
      isWebGPUEnabled: false,
      isAIEnabled: false,
      isMIDIEnabled: false,
      currentStyle: null,
      currentVisualParams: null,
      currentMusicFeatures: null,
      performanceMetrics: {
        fps: 0,
        frameTime: 0,
        aiProcessingTime: 0,
        renderTime: 0,
        particleCount: 0,
        memoryUsage: 0,
        gpuMemoryUsage: 0,
        cpuUsage: 0,
      },
      connectedControllers: 0,
      lastUpdate: Date.now(),
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose components
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.musicAnalyzer) {
      this.musicAnalyzer.dispose();
      this.musicAnalyzer = null;
    }

    if (this.styleTransferEngine) {
      this.styleTransferEngine.dispose();
      this.styleTransferEngine = null;
    }

    if (this.particleSystem) {
      this.particleSystem.dispose();
      this.particleSystem = null;
    }

    if (this.midiManager) {
      this.midiManager.dispose();
      this.midiManager = null;
    }

    // Clear event listeners
    this.eventListeners.clear();

    // Reset state
    this.state = this.initializeState();

    console.log('[AIVJMaster] Disposed');
  }
}

/**
 * Factory function to create and initialize AI VJ Master
 */
export async function createAIVJMaster(config?: Partial<AIVJConfig>): Promise<AIVJMaster> {
  const master = new AIVJMaster(config);
  await master.initialize();
  return master;
}