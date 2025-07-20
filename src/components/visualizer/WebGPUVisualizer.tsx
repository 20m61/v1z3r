/**
 * WebGPU-Accelerated Visualizer Component
 * High-performance visual rendering with AI-driven effects
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { useVisualizerStore } from '@/store/visualizerStore';
import { errorHandler } from '@/utils/errorHandler';

// WebGPU and AI components (will be loaded dynamically at runtime)
let WebGPURenderer: any = null;
let MusicToVisualEngine: any = null;

// Dynamically import components when needed
const loadWebGPUComponents = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    const webgpuModule = await import('@/services/webgpu/webgpuRenderer');
    WebGPURenderer = webgpuModule.WebGPURenderer;
  } catch (error) {
    errorHandler.warn('Failed to load WebGPU renderer:', error as Error);
  }
  
  try {
    const musicModule = await import('@/services/ai/musicToVisualEngine');
    MusicToVisualEngine = musicModule.MusicToVisualEngine;
  } catch (error) {
    errorHandler.warn('Failed to load music engine:', error as Error);
  }
};

interface WebGPUVisualizerProps {
  className?: string;
  onError?: (error: Error) => void;
}

export const WebGPUVisualizer: React.FC<WebGPUVisualizerProps> = ({
  className = '',
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const webgpuRendererRef = useRef<any>(null);
  const musicEngineRef = useRef<any>(null);
  const threeSceneRef = useRef<THREE.Scene | null>(null);
  const threeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [renderStats, setRenderStats] = useState({
    fps: 0,
    frameTime: 0,
    particles: 0,
  });
  
  // Store state
  const {
    isAudioAnalyzing,
    audioContext,
    audioSource,
    sensitivity,
    colorTheme,
    currentEffectType,
  } = useVisualizerStore();
  
  // Settings state
  const settings = useMemo(() => ({
    sensitivity,
    colorTheme,
    currentEffectType,
  }), [sensitivity, colorTheme, currentEffectType]);
  
  // Check WebGPU support
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);
  const [fallbackToWebGL, setFallbackToWebGL] = useState(false);

  useEffect(() => {
    const checkWebGPUSupport = async () => {
      if (typeof window === 'undefined') {
        return false;
      }

      // Load WebGPU components first
      await loadWebGPUComponents();

      try {
        if (!navigator.gpu) {
          return false;
        }

        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
      } catch (error) {
        errorHandler.warn('WebGPU not supported, will fallback to WebGL:', error as Error);
        return false;
      }
    };

    checkWebGPUSupport().then((supported) => {
      setWebgpuSupported(supported);
      if (!supported) {
        setFallbackToWebGL(true);
      }
    });
  }, []);

  // Initialize WebGPU and Three.js
  const initialize = useCallback(async () => {
    if (!canvasRef.current || !containerRef.current || webgpuSupported === null) return;
    
    try {
      // Create Three.js scene and camera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 50);
      
      threeSceneRef.current = scene;
      threeCameraRef.current = camera;
      
      // Initialize renderer (WebGPU or fallback)
      if (webgpuSupported && !fallbackToWebGL && WebGPURenderer) {
        try {
          const webgpuRenderer = new WebGPURenderer({
            canvas: canvasRef.current,
            antialias: true,
            powerPreference: 'high-performance',
            maxParticles: 1000000,
            enablePostProcessing: true,
          });
          
          await webgpuRenderer.initialize();
          webgpuRenderer.setCamera(camera);
          webgpuRendererRef.current = webgpuRenderer;
          
          errorHandler.info('WebGPU renderer initialized successfully');
        } catch (webgpuError) {
          errorHandler.warn('WebGPU initialization failed, falling back to WebGL:', webgpuError as Error);
          setFallbackToWebGL(true);
          
          // Create basic WebGL renderer as fallback
          const fallbackRenderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
          });
          fallbackRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
          webgpuRendererRef.current = fallbackRenderer as any;
        }
      } else {
        // Use WebGL fallback
        const fallbackRenderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          antialias: true,
        });
        fallbackRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        webgpuRendererRef.current = fallbackRenderer as any;
        errorHandler.info('Using WebGL renderer as fallback');
      }
      
      // Initialize music analysis engine if available
      if (audioContext && MusicToVisualEngine) {
        try {
          const musicEngine = new MusicToVisualEngine(audioContext);
          await musicEngine.initialize();
          musicEngineRef.current = musicEngine;
          
          // Connect audio source if available
          if (audioSource) {
            musicEngine.connectSource(audioSource);
          }
        } catch (audioError) {
          errorHandler.warn('Music engine initialization failed:', audioError as Error);
        }
      }
      
      setIsInitialized(true);
      errorHandler.info('Visualizer initialized successfully');
    } catch (error) {
      errorHandler.error('Failed to initialize visualizer', error as Error);
      if (onError) {
        onError(error as Error);
      }
    }
  }, [audioContext, audioSource, onError, webgpuSupported, fallbackToWebGL]);
  
  // Handle resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !threeCameraRef.current || !webgpuRendererRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    threeCameraRef.current.aspect = width / height;
    threeCameraRef.current.updateProjectionMatrix();
    
    webgpuRendererRef.current.resize(width, height);
  }, []);
  
  // Animation loop
  const animate = useCallback(() => {
    if (!isInitialized || !webgpuRendererRef.current) return;
    
    const startTime = performance.now();
    
    // Extract audio features and generate visual parameters
    if (isAudioAnalyzing && musicEngineRef.current) {
      const audioFeatures = musicEngineRef.current.extractAudioFeatures();
      const visualParams = musicEngineRef.current.generateVisualParameters(audioFeatures);
      
      // Update particle system based on visual parameters
      webgpuRendererRef.current.updateParticleConfig({
        gravity: visualParams.gravity,
        audioReactivity: settings.sensitivity,
        spread: visualParams.particleSpread,
        speed: visualParams.particleSpeed,
        lifespan: visualParams.particleLifespan,
      });
      
      // Update camera based on audio
      if (threeCameraRef.current && visualParams.cameraMovement) {
        threeCameraRef.current.position.x += visualParams.cameraMovement[0] * 0.1;
        threeCameraRef.current.position.y += visualParams.cameraMovement[1] * 0.1;
        threeCameraRef.current.position.z += visualParams.cameraMovement[2] * 0.1;
        
        // Smooth camera return to center
        threeCameraRef.current.position.lerp(new THREE.Vector3(0, 0, 50), 0.05);
        threeCameraRef.current.lookAt(0, 0, 0);
      }
    }
    
    // Update particles
    const deltaTime = Math.min((performance.now() - startTime) / 1000, 0.1); // Cap at 100ms
    webgpuRendererRef.current.updateParticles(deltaTime);
    
    // Render frame
    webgpuRendererRef.current.render();
    
    // Update stats
    const stats = webgpuRendererRef.current.getStats();
    setRenderStats({
      fps: Math.round(1000 / Math.max(stats.frameTime, 1)),
      frameTime: stats.frameTime,
      particles: stats.particles,
    });
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isInitialized, isAudioAnalyzing, settings]);
  
  // Initialize on mount
  useEffect(() => {
    initialize();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (webgpuRendererRef.current) {
        webgpuRendererRef.current.destroy();
      }
      
      if (musicEngineRef.current) {
        musicEngineRef.current.destroy();
      }
    };
  }, [initialize]);
  
  // Start/stop animation loop
  useEffect(() => {
    if (isInitialized) {
      animate();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, animate]);
  
  // Handle resize
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);
  
  // Update audio connection
  useEffect(() => {
    if (musicEngineRef.current && audioSource) {
      musicEngineRef.current.connectSource(audioSource);
    }
  }, [audioSource]);
  
  // Show loading state while checking WebGPU support
  if (webgpuSupported === null) {
    return (
      <div className={`relative w-full h-full ${className} flex items-center justify-center bg-black`}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Checking graphics support...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      
      {/* Renderer type indicator */}
      {fallbackToWebGL && (
        <div className="absolute top-4 left-4 bg-yellow-900/80 border border-yellow-500/50 rounded-lg p-2 text-yellow-200 text-xs">
          Using WebGL fallback
        </div>
      )}
      
      {/* Performance stats overlay */}
      <div className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded text-xs font-mono">
        <div>Renderer: {fallbackToWebGL ? 'WebGL' : 'WebGPU'}</div>
        <div>FPS: {renderStats.fps}</div>
        <div>Frame: {renderStats.frameTime.toFixed(2)}ms</div>
        <div>Particles: {renderStats.particles.toLocaleString()}</div>
      </div>
      
      {/* Loading indicator */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white">
              Initializing {fallbackToWebGL ? 'WebGL' : 'WebGPU'} renderer...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Export a version that works with dynamic imports
export default WebGPUVisualizer;