/**
 * Advanced Post-Processing Pipeline for v1z3r
 * Real-time visual effects and enhancement system
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { TAARenderPass } from 'three/examples/jsm/postprocessing/TAARenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { MusicFeatures, VisualParameters } from './aiMusicAnalyzer';

export interface PostProcessingConfig {
  enableBloom: boolean;
  enableSSAO: boolean;
  enableMotionBlur: boolean;
  enableChromaticAberration: boolean;
  enableFilmGrain: boolean;
  enableColorGrading: boolean;
  enableGlitch: boolean;
  enableTAA: boolean;
  enableSMAA: boolean;
  audioReactivity: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  debugMode: boolean;
}

export interface PostProcessingState {
  enabled: boolean;
  currentPreset: string;
  customParams: Record<string, number>;
  performanceMetrics: {
    renderTime: number;
    passCount: number;
    memoryUsage: number;
  };
}

export interface AudioReactiveParams {
  bloomIntensity: number;
  glitchStrength: number;
  chromaticAberration: number;
  filmGrainIntensity: number;
  colorTemperature: number;
  saturation: number;
  contrast: number;
  vignette: number;
}

/**
 * Custom Audio-Reactive Bloom Pass
 */
export class AudioReactiveBloomPass extends UnrealBloomPass {
  private audioReactivity: number = 1.0;
  private baseThreshold: number = 0.3;
  private baseStrength: number = 0.5;
  private baseRadius: number = 0.8;

  constructor(resolution: THREE.Vector2, strength: number, radius: number, threshold: number) {
    super(resolution, strength, radius, threshold);
  }

  setAudioReactivity(reactivity: number): void {
    this.audioReactivity = reactivity;
  }

  updateFromAudio(musicFeatures: MusicFeatures): void {
    const energyMultiplier = 1 + musicFeatures.energy * this.audioReactivity;
    const beatMultiplier = musicFeatures.beatStrength && musicFeatures.beatStrength.length > 0 
      ? 1 + musicFeatures.beatStrength[musicFeatures.beatStrength.length - 1] * this.audioReactivity * 0.5
      : 1;

    this.threshold = this.baseThreshold * (1 - musicFeatures.energy * 0.3);
    this.strength = this.baseStrength * energyMultiplier * beatMultiplier;
    this.radius = this.baseRadius * (1 + musicFeatures.rhythmComplexity * 0.2);
  }
}

/**
 * Custom Chromatic Aberration Pass
 */
export class ChromaticAberrationPass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uOffset: { value: 0.005 },
        uMultiplier: { value: 1.0 },
        uTime: { value: 0.0 },
        uAudioReactivity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uOffset;
        uniform float uMultiplier;
        uniform float uTime;
        uniform float uAudioReactivity;
        varying vec2 vUv;

        void main() {
          vec2 offset = vec2(uOffset * uMultiplier, 0.0);
          
          // Audio-reactive offset modulation
          float audioOffset = sin(uTime * 5.0) * uAudioReactivity * 0.01;
          offset += audioOffset;
          
          vec4 cr = texture2D(tDiffuse, vUv + offset);
          vec4 cga = texture2D(tDiffuse, vUv);
          vec4 cb = texture2D(tDiffuse, vUv - offset);
          
          gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
        }
      `,
    });
  }

  updateFromAudio(musicFeatures: MusicFeatures): void {
    this.uniforms.uMultiplier.value = 1 + musicFeatures.energy * 2;
    this.uniforms.uTime.value = performance.now() * 0.001;
    this.uniforms.uAudioReactivity.value = musicFeatures.rhythmComplexity;
  }
}

/**
 * Custom SSAO Pass
 */
export class SSAOPass extends ShaderPass {
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        uCameraNear: { value: camera.near },
        uCameraFar: { value: camera.far },
        uProjectionMatrix: { value: camera.projectionMatrix },
        uViewMatrix: { value: camera.matrixWorldInverse },
        uSamples: { value: 16 },
        uRadius: { value: 0.5 },
        uIntensity: { value: 1.0 },
        uBias: { value: 0.025 },
        uNoiseScale: { value: 4.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D tNormal;
        uniform float uCameraNear;
        uniform float uCameraFar;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform int uSamples;
        uniform float uRadius;
        uniform float uIntensity;
        uniform float uBias;
        uniform float uNoiseScale;
        uniform float uTime;
        varying vec2 vUv;

        float readDepth(vec2 coord) {
          float fragCoordZ = texture2D(tDepth, coord).x;
          float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
          return viewZToOrthographicDepth(viewZ, uCameraNear, uCameraFar);
        }

        vec3 getViewPosition(vec2 screenPosition, float depth) {
          vec4 clipSpacePosition = vec4(screenPosition * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 viewSpacePosition = inverse(uProjectionMatrix) * clipSpacePosition;
          return viewSpacePosition.xyz / viewSpacePosition.w;
        }

        vec3 getViewNormal(vec2 coord) {
          return normalize(texture2D(tNormal, coord).xyz * 2.0 - 1.0);
        }

        float random(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        void main() {
          vec2 texelSize = 1.0 / textureSize(tDiffuse, 0);
          float depth = readDepth(vUv);
          
          if (depth >= 1.0) {
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
          }

          vec3 viewPos = getViewPosition(vUv, depth);
          vec3 viewNormal = getViewNormal(vUv);
          
          float occlusion = 0.0;
          float sampleCount = float(uSamples);
          
          for (int i = 0; i < 16; i++) {
            if (i >= uSamples) break;
            
            vec2 sampleUV = vUv + vec2(
              random(vUv + float(i) * 0.1 + uTime * 0.01) * 2.0 - 1.0,
              random(vUv + float(i) * 0.2 + uTime * 0.02) * 2.0 - 1.0
            ) * uRadius * texelSize;
            
            float sampleDepth = readDepth(sampleUV);
            vec3 samplePos = getViewPosition(sampleUV, sampleDepth);
            
            vec3 sampleDir = normalize(samplePos - viewPos);
            float NdotS = max(dot(viewNormal, sampleDir), 0.0);
            float VdotS = max(dot(normalize(-viewPos), sampleDir), 0.0);
            
            float ao = step(uBias, length(samplePos - viewPos)) * NdotS * VdotS;
            occlusion += ao;
          }
          
          occlusion = 1.0 - (occlusion / sampleCount) * uIntensity;
          
          vec4 color = texture2D(tDiffuse, vUv);
          gl_FragColor = vec4(color.rgb * occlusion, color.a);
        }
      `,
    });
  }

  updateFromAudio(musicFeatures: MusicFeatures): void {
    this.uniforms.uIntensity.value = 1.0 + musicFeatures.energy * 0.5;
    this.uniforms.uRadius.value = 0.5 + musicFeatures.rhythmComplexity * 0.3;
    this.uniforms.uTime.value = performance.now() * 0.001;
  }
}

/**
 * Custom Color Grading Pass
 */
export class ColorGradingPass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uContrast: { value: 1.0 },
        uSaturation: { value: 1.0 },
        uBrightness: { value: 0.0 },
        uGamma: { value: 1.0 },
        uHue: { value: 0.0 },
        uTemperature: { value: 0.0 },
        uTint: { value: 0.0 },
        uVignette: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uBrightness;
        uniform float uGamma;
        uniform float uHue;
        uniform float uTemperature;
        uniform float uTint;
        uniform float uVignette;
        uniform float uTime;
        varying vec2 vUv;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        vec3 temperatureToRGB(float temp) {
          temp = clamp(temp, -1.0, 1.0) * 0.5 + 0.5;
          return vec3(
            smoothstep(0.0, 0.5, temp),
            smoothstep(0.0, 1.0, temp) * smoothstep(1.0, 0.0, temp),
            smoothstep(0.5, 1.0, temp)
          );
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          // Brightness and contrast
          color.rgb = ((color.rgb - 0.5) * uContrast + 0.5) + uBrightness;
          
          // Gamma correction
          color.rgb = pow(color.rgb, vec3(1.0 / uGamma));
          
          // Temperature adjustment
          vec3 tempColor = temperatureToRGB(uTemperature);
          color.rgb = mix(color.rgb, color.rgb * tempColor, abs(uTemperature));
          
          // Tint
          color.rgb = mix(color.rgb, vec3(dot(color.rgb, vec3(0.299, 0.587, 0.114))), -uTint);
          
          // Hue and saturation
          vec3 hsv = rgb2hsv(color.rgb);
          hsv.x = mod(hsv.x + uHue, 1.0);
          hsv.y *= uSaturation;
          color.rgb = hsv2rgb(hsv);
          
          // Vignette
          if (uVignette > 0.0) {
            vec2 coord = vUv - 0.5;
            float dist = length(coord);
            float vignetteFactor = smoothstep(0.0, 0.7, dist);
            color.rgb = mix(color.rgb, color.rgb * (1.0 - uVignette), vignetteFactor);
          }
          
          gl_FragColor = color;
        }
      `,
    });
  }

  updateFromAudio(musicFeatures: MusicFeatures): void {
    this.uniforms.uSaturation.value = 1.0 + musicFeatures.energy * 0.5;
    this.uniforms.uContrast.value = 1.0 + musicFeatures.rhythmComplexity * 0.3;
    this.uniforms.uHue.value = (musicFeatures.spectralCentroid / 8000) * 0.1;
    this.uniforms.uTemperature.value = (musicFeatures.valence - 0.5) * 0.5;
    this.uniforms.uTime.value = performance.now() * 0.001;
  }
}

/**
 * Custom Motion Blur Pass
 */
export class MotionBlurPass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        tPreviousFrame: { value: null },
        uBlurAmount: { value: 0.8 },
        uTime: { value: 0.0 },
        uAudioReactivity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tPreviousFrame;
        uniform float uBlurAmount;
        uniform float uTime;
        uniform float uAudioReactivity;
        varying vec2 vUv;

        void main() {
          vec4 currentFrame = texture2D(tDiffuse, vUv);
          vec4 previousFrame = texture2D(tPreviousFrame, vUv);
          
          // Audio-reactive blur strength
          float audioBlur = sin(uTime * 3.0) * uAudioReactivity * 0.1;
          float blurStrength = uBlurAmount + audioBlur;
          
          gl_FragColor = mix(currentFrame, previousFrame, blurStrength);
        }
      `,
    });
  }

  updateFromAudio(musicFeatures: MusicFeatures): void {
    this.uniforms.uBlurAmount.value = 0.8 + musicFeatures.energy * 0.2;
    this.uniforms.uTime.value = performance.now() * 0.001;
    this.uniforms.uAudioReactivity.value = musicFeatures.rhythmComplexity;
  }
}

/**
 * Main Post-Processing Pipeline
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private config: PostProcessingConfig;
  private state: PostProcessingState;

  // Render targets
  private renderTarget: THREE.WebGLRenderTarget;
  private depthTarget: THREE.WebGLRenderTarget;
  private normalTarget: THREE.WebGLRenderTarget;
  private previousFrameTarget: THREE.WebGLRenderTarget;

  // Passes
  private renderPass: RenderPass;
  private taaPass: TAARenderPass;
  private smaaPass: SMAAPass;
  private bloomPass: AudioReactiveBloomPass;
  private ssaoPass: SSAOPass;
  private chromaticAberrationPass: ChromaticAberrationPass;
  private colorGradingPass: ColorGradingPass;
  private motionBlurPass: MotionBlurPass;
  private filmPass: FilmPass;
  private glitchPass: GlitchPass;

  // Performance monitoring
  private performanceMonitor = {
    frameTime: 0,
    lastFrameTime: 0,
    passTimings: new Map<string, number>(),
  };

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: Partial<PostProcessingConfig> = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = {
      enableBloom: true,
      enableSSAO: true,
      enableMotionBlur: true,
      enableChromaticAberration: true,
      enableFilmGrain: true,
      enableColorGrading: true,
      enableGlitch: false,
      enableTAA: true,
      enableSMAA: true,
      audioReactivity: 1.0,
      quality: 'high',
      debugMode: false,
      ...config,
    };

    this.state = {
      enabled: true,
      currentPreset: 'default',
      customParams: {},
      performanceMetrics: {
        renderTime: 0,
        passCount: 0,
        memoryUsage: 0,
      },
    };

    this.initializeRenderTargets();
    this.initializePasses();
    this.setupComposer();
  }

  /**
   * Initialize render targets
   */
  private initializeRenderTargets(): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    const pixelRatio = this.renderer.getPixelRatio();
    const width = size.width * pixelRatio;
    const height = size.height * pixelRatio;

    // Main render target
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
    });

    // Depth target
    this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.FloatType,
      format: THREE.DepthFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // Normal target
    this.normalTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });

    // Previous frame target for motion blur
    this.previousFrameTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
  }

  /**
   * Initialize all passes
   */
  private initializePasses(): void {
    // Basic render pass
    this.renderPass = new RenderPass(this.scene, this.camera);

    // Anti-aliasing passes
    if (this.config.enableTAA) {
      this.taaPass = new TAARenderPass(this.scene, this.camera);
    }

    if (this.config.enableSMAA) {
      this.smaaPass = new SMAAPass(
        this.renderer.getSize(new THREE.Vector2()).width * this.renderer.getPixelRatio(),
        this.renderer.getSize(new THREE.Vector2()).height * this.renderer.getPixelRatio()
      );
    }

    // Bloom pass
    if (this.config.enableBloom) {
      this.bloomPass = new AudioReactiveBloomPass(
        new THREE.Vector2(256, 256),
        0.5,
        0.8,
        0.3
      );
    }

    // SSAO pass
    if (this.config.enableSSAO) {
      this.ssaoPass = new SSAOPass(this.scene, this.camera);
    }

    // Chromatic aberration pass
    if (this.config.enableChromaticAberration) {
      this.chromaticAberrationPass = new ChromaticAberrationPass();
    }

    // Color grading pass
    if (this.config.enableColorGrading) {
      this.colorGradingPass = new ColorGradingPass();
    }

    // Motion blur pass
    if (this.config.enableMotionBlur) {
      this.motionBlurPass = new MotionBlurPass();
    }

    // Film grain pass
    if (this.config.enableFilmGrain) {
      this.filmPass = new FilmPass(0.5, 0.125, 2048, false);
    }

    // Glitch pass
    if (this.config.enableGlitch) {
      this.glitchPass = new GlitchPass();
    }
  }

  /**
   * Setup effect composer
   */
  private setupComposer(): void {
    this.composer = new EffectComposer(this.renderer, this.renderTarget);

    // Add passes in order
    this.composer.addPass(this.renderPass);

    if (this.config.enableTAA && this.taaPass) {
      this.composer.addPass(this.taaPass);
    }

    if (this.config.enableSSAO && this.ssaoPass) {
      this.composer.addPass(this.ssaoPass);
    }

    if (this.config.enableBloom && this.bloomPass) {
      this.composer.addPass(this.bloomPass);
    }

    if (this.config.enableMotionBlur && this.motionBlurPass) {
      this.composer.addPass(this.motionBlurPass);
    }

    if (this.config.enableChromaticAberration && this.chromaticAberrationPass) {
      this.composer.addPass(this.chromaticAberrationPass);
    }

    if (this.config.enableColorGrading && this.colorGradingPass) {
      this.composer.addPass(this.colorGradingPass);
    }

    if (this.config.enableFilmGrain && this.filmPass) {
      this.composer.addPass(this.filmPass);
    }

    if (this.config.enableGlitch && this.glitchPass) {
      this.composer.addPass(this.glitchPass);
    }

    if (this.config.enableSMAA && this.smaaPass) {
      this.composer.addPass(this.smaaPass);
    }

    // Update pass count
    this.state.performanceMetrics.passCount = this.composer.passes.length;
  }

  /**
   * Update pipeline with music features
   */
  updateFromMusic(musicFeatures: MusicFeatures, visualParams: VisualParameters): void {
    const audioReactiveParams = this.calculateAudioReactiveParams(musicFeatures, visualParams);

    // Update individual passes
    if (this.bloomPass) {
      this.bloomPass.updateFromAudio(musicFeatures);
      this.bloomPass.strength = audioReactiveParams.bloomIntensity;
    }

    if (this.chromaticAberrationPass) {
      this.chromaticAberrationPass.updateFromAudio(musicFeatures);
      this.chromaticAberrationPass.uniforms.uMultiplier.value = audioReactiveParams.chromaticAberration;
    }

    if (this.colorGradingPass) {
      this.colorGradingPass.updateFromAudio(musicFeatures);
      this.colorGradingPass.uniforms.uSaturation.value = audioReactiveParams.saturation;
      this.colorGradingPass.uniforms.uContrast.value = audioReactiveParams.contrast;
      this.colorGradingPass.uniforms.uTemperature.value = audioReactiveParams.colorTemperature;
      this.colorGradingPass.uniforms.uVignette.value = audioReactiveParams.vignette;
    }

    if (this.motionBlurPass) {
      this.motionBlurPass.updateFromAudio(musicFeatures);
    }

    if (this.ssaoPass) {
      this.ssaoPass.updateFromAudio(musicFeatures);
    }

    if (this.filmPass) {
      this.filmPass.uniforms.intensity.value = audioReactiveParams.filmGrainIntensity;
    }

    if (this.glitchPass) {
      this.glitchPass.enabled = audioReactiveParams.glitchStrength > 0.5;
    }
  }

  /**
   * Calculate audio-reactive parameters
   */
  private calculateAudioReactiveParams(
    musicFeatures: MusicFeatures,
    visualParams: VisualParameters
  ): AudioReactiveParams {
    const beatMultiplier = musicFeatures.beatStrength && musicFeatures.beatStrength.length > 0
      ? musicFeatures.beatStrength[musicFeatures.beatStrength.length - 1]
      : 0;

    return {
      bloomIntensity: 0.5 + musicFeatures.energy * 1.5 + beatMultiplier * 0.5,
      glitchStrength: musicFeatures.rhythmComplexity * musicFeatures.energy,
      chromaticAberration: 1 + musicFeatures.energy * 2 + beatMultiplier * 0.5,
      filmGrainIntensity: 0.1 + musicFeatures.energy * 0.3,
      colorTemperature: (musicFeatures.valence - 0.5) * 0.8,
      saturation: 1 + musicFeatures.energy * 0.5,
      contrast: 1 + musicFeatures.rhythmComplexity * 0.3,
      vignette: musicFeatures.energy * 0.3,
    };
  }

  /**
   * Render the post-processing pipeline
   */
  render(deltaTime: number): void {
    if (!this.state.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const startTime = performance.now();

    // Update previous frame for motion blur
    if (this.motionBlurPass) {
      this.motionBlurPass.uniforms.tPreviousFrame.value = this.previousFrameTarget.texture;
    }

    // Render through composer
    this.composer.render(deltaTime);

    // Copy current frame to previous frame buffer
    this.renderer.copyFramebufferToTexture(
      new THREE.Vector2(0, 0),
      this.previousFrameTarget.texture
    );

    // Update performance metrics
    this.performanceMonitor.frameTime = performance.now() - startTime;
    this.state.performanceMetrics.renderTime = this.performanceMonitor.frameTime;
  }

  /**
   * Resize pipeline
   */
  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    
    // Resize render targets
    this.renderTarget.setSize(width, height);
    this.depthTarget.setSize(width, height);
    this.normalTarget.setSize(width, height);
    this.previousFrameTarget.setSize(width, height);

    // Update SMAA pass
    if (this.smaaPass) {
      this.smaaPass.setSize(width, height);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PostProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Rebuild composer if needed
    if (this.hasStructuralChanges(newConfig)) {
      this.setupComposer();
    }
  }

  /**
   * Check if configuration changes require composer rebuild
   */
  private hasStructuralChanges(newConfig: Partial<PostProcessingConfig>): boolean {
    const structuralKeys = [
      'enableBloom',
      'enableSSAO',
      'enableMotionBlur',
      'enableChromaticAberration',
      'enableFilmGrain',
      'enableColorGrading',
      'enableGlitch',
      'enableTAA',
      'enableSMAA',
    ];

    return structuralKeys.some(key => newConfig[key as keyof PostProcessingConfig] !== undefined);
  }

  /**
   * Apply preset
   */
  applyPreset(presetName: string): void {
    const presets = {
      default: {
        enableBloom: true,
        enableSSAO: true,
        enableMotionBlur: true,
        enableChromaticAberration: true,
        enableFilmGrain: true,
        enableColorGrading: true,
        enableGlitch: false,
        audioReactivity: 1.0,
      },
      minimal: {
        enableBloom: false,
        enableSSAO: false,
        enableMotionBlur: false,
        enableChromaticAberration: false,
        enableFilmGrain: false,
        enableColorGrading: true,
        enableGlitch: false,
        audioReactivity: 0.5,
      },
      intense: {
        enableBloom: true,
        enableSSAO: true,
        enableMotionBlur: true,
        enableChromaticAberration: true,
        enableFilmGrain: true,
        enableColorGrading: true,
        enableGlitch: true,
        audioReactivity: 2.0,
      },
      retro: {
        enableBloom: true,
        enableSSAO: false,
        enableMotionBlur: true,
        enableChromaticAberration: true,
        enableFilmGrain: true,
        enableColorGrading: true,
        enableGlitch: false,
        audioReactivity: 1.5,
      },
    };

    const preset = presets[presetName as keyof typeof presets];
    if (preset) {
      this.updateConfig(preset);
      this.state.currentPreset = presetName;
    }
  }

  /**
   * Get current state
   */
  getState(): PostProcessingState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.state.performanceMetrics {
    return { ...this.state.performanceMetrics };
  }

  /**
   * Enable/disable pipeline
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.composer.dispose();
    this.renderTarget.dispose();
    this.depthTarget.dispose();
    this.normalTarget.dispose();
    this.previousFrameTarget.dispose();

    // Dispose individual passes
    const passes = [
      this.renderPass,
      this.taaPass,
      this.smaaPass,
      this.bloomPass,
      this.ssaoPass,
      this.chromaticAberrationPass,
      this.colorGradingPass,
      this.motionBlurPass,
      this.filmPass,
      this.glitchPass,
    ];

    passes.forEach(pass => {
      if (pass && pass.dispose) {
        pass.dispose();
      }
    });
  }
}

/**
 * Factory function to create post-processing pipeline
 */
export function createPostProcessingPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  config?: Partial<PostProcessingConfig>
): PostProcessingPipeline {
  return new PostProcessingPipeline(renderer, scene, camera, config);
}