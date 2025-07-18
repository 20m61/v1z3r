/**
 * Advanced Features Page
 * Showcases Phase 7 advanced features with integrated UI
 */

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useVisualizerStore } from '@/store/visualizerStore';
import { errorHandler } from '@/utils/errorHandler';
import { advancedFeaturesErrorHandler } from '@/utils/advancedFeaturesErrorHandler';

// Dynamic imports for advanced components with loading states
const StyleTransferControls = dynamic(
  () => import('@/components/advanced/StyleTransferControls'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-400">Loading AI Style Transfer...</span>
      </div>
    )
  }
);

const SceneManipulationPanel = dynamic(
  () => import('@/components/advanced/SceneManipulationPanel'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <span className="ml-2 text-gray-400">Loading 3D Scene Controls...</span>
      </div>
    )
  }
);

const MidiControlPanel = dynamic(
  () => import('@/components/advanced/MidiControlPanel'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        <span className="ml-2 text-gray-400">Loading MIDI Controller...</span>
      </div>
    )
  }
);

const NDIStreamingPanel = dynamic(
  () => import('@/components/advanced/NDIStreamingPanel'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        <span className="ml-2 text-gray-400">Loading NDI Streaming...</span>
      </div>
    )
  }
);

const WebGPUVisualizer = dynamic(
  () => import('@/components/visualizer/WebGPUVisualizer'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Initializing WebGPU Visualizer...</p>
        </div>
      </div>
    )
  }
);

interface AdvancedFeaturesProps {
  userAgent: string;
}

const AdvancedFeaturesPage: React.FC<AdvancedFeaturesProps> = ({ userAgent }) => {
  const [activePanel, setActivePanel] = useState<'style' | 'scene' | 'midi' | 'ndi'>('style');
  const [isWebGPUSupported, setIsWebGPUSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [featureHealth, setFeatureHealth] = useState<{
    [key: string]: 'healthy' | 'degraded' | 'unavailable';
  }>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    setAudioContext,
    setAudioSource,
    setMicrophoneEnabled,
    setAudioAnalyzing,
    sensitivity,
    setSensitivity,
    colorTheme,
    setColorTheme,
    currentEffectType,
    setEffectType,
  } = useVisualizerStore();

  useEffect(() => {
    checkWebGPUSupport();
    setupAudioContext();
    updateFeatureHealth();
    
    // Monitor feature health every 30 seconds
    const healthInterval = setInterval(updateFeatureHealth, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  const updateFeatureHealth = useCallback(() => {
    setFeatureHealth({
      'AI Style Transfer': advancedFeaturesErrorHandler.getFeatureHealth('AI Style Transfer'),
      '3D Scene': advancedFeaturesErrorHandler.getFeatureHealth('3D Scene'),
      'MIDI': advancedFeaturesErrorHandler.getFeatureHealth('MIDI'),
      'NDI': advancedFeaturesErrorHandler.getFeatureHealth('NDI'),
      'WebGPU': advancedFeaturesErrorHandler.getFeatureHealth('WebGPU'),
    });
  }, []);

  const checkWebGPUSupport = async () => {
    if (typeof window !== 'undefined' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        setIsWebGPUSupported(!!adapter);
      } catch (error) {
        const webGPUError = advancedFeaturesErrorHandler.handleWebGPUError(error as Error, 'WebGPU detection');
        setIsWebGPUSupported(false);
      }
    }
  };

  const setupAudioContext = useCallback(async () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);
      errorHandler.info('Audio context initialized for advanced features');
    } catch (error) {
      errorHandler.error('Failed to initialize audio context', error as Error);
    }
  }, []);

  const handleParameterChange = (path: string, value: number) => {
    // Map MIDI/external parameter changes to visualizer state
    switch (path) {
      case 'visualizer.sensitivity':
        setSensitivity(value);
        break;
      case 'visualizer.colorTheme':
        // Convert 0-360 to hex color
        const hue = value;
        const color = `hsl(${hue}, 70%, 50%)`;
        setColorTheme(color);
        break;
      case 'visualizer.effectType':
        const effects = ['particles', 'waveform', 'spectrum', 'lyrics'];
        const effectIndex = Math.floor(value * (effects.length - 1));
        setEffectType(effects[effectIndex] as any);
        break;
      default:
        errorHandler.info(`Parameter change: ${path} = ${value}`);
    }
  };

  const handleToggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleTogglePanels = () => {
    setShowPanels(!showPanels);
  };

  const handleCanvasUpdate = (canvas: HTMLCanvasElement) => {
    // This would be used by NDI streaming to capture the canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(canvas, 0, 0);
      }
    }
  };

  const renderActivePanel = () => {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Loading panel...</span>
        </div>
      }>
        {activePanel === 'style' && (
          <StyleTransferControls
            onConfigChange={(config) => {
              errorHandler.info(`Style transfer config updated: ${config.styleName}`);
            }}
            className="h-full"
          />
        )}
        {activePanel === 'scene' && (
          <SceneManipulationPanel
            onSceneUpdate={(scene) => {
              errorHandler.info(`Scene updated: ${scene.children.length} objects`);
            }}
            className="h-full"
          />
        )}
        {activePanel === 'midi' && (
          <MidiControlPanel
            onParameterChange={handleParameterChange}
            className="h-full"
          />
        )}
        {activePanel === 'ndi' && (
          <NDIStreamingPanel
            onCanvasUpdate={handleCanvasUpdate}
            className="h-full"
          />
        )}
      </Suspense>
    );
  };

  return (
    <>
      <Head>
        <title>Advanced Features - v1z3r</title>
        <meta name="description" content="Advanced VJ features: AI Style Transfer, 3D Scene Manipulation, MIDI Control, and NDI Streaming" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        {/* Main Visualizer */}
        <div className="absolute inset-0">
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-full bg-black">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-lg">Initializing WebGPU Visualizer...</p>
                <p className="text-sm text-gray-400 mt-2">Loading GPU resources...</p>
              </div>
            </div>
          }>
            <WebGPUVisualizer
              className="w-full h-full"
            />
          </Suspense>
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-sm border-b border-gray-700/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Advanced Features</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isWebGPUSupported ? 'bg-green-400' : 'bg-yellow-400'
                }`}></div>
                <span className="text-sm text-gray-300">
                  {isWebGPUSupported ? 'WebGPU' : 'WebGL'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePanels}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                {showPanels ? 'Hide Panels' : 'Show Panels'}
              </button>
              <button
                onClick={handleToggleFullscreen}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>
        </div>

        {/* Control Panels */}
        {showPanels && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-sm border-t border-gray-700/50">
            <div className="p-4">
              {/* Panel Selector */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {[
                  { id: 'style', label: 'AI Style Transfer', icon: '🎨' },
                  { id: 'scene', label: '3D Scene', icon: '🎭' },
                  { id: 'midi', label: 'MIDI Control', icon: '🎹' },
                  { id: 'ndi', label: 'NDI Streaming', icon: '📡' },
                ].map((panel) => (
                  <button
                    key={panel.id}
                    onClick={() => setActivePanel(panel.id as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activePanel === panel.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">{panel.icon}</span>
                    {panel.label}
                  </button>
                ))}
              </div>

              {/* Active Panel */}
              <div className="max-h-96 overflow-y-auto">
                {renderActivePanel()}
              </div>
            </div>
          </div>
        )}

        {/* Quick Controls (Always Visible) */}
        <div className="absolute top-20 right-4 z-20 space-y-2">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
            <div className="space-y-2">
              {/* Sensitivity */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Sensitivity: {sensitivity.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none slider"
                />
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Color</label>
                <input
                  type="color"
                  value={colorTheme}
                  onChange={(e) => setColorTheme(e.target.value)}
                  className="w-full h-8 rounded border-none bg-transparent"
                />
              </div>

              {/* Effect Type */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Effect</label>
                <select
                  value={currentEffectType}
                  onChange={(e) => setEffectType(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                >
                  <option value="particles">Particles</option>
                  <option value="waveform">Waveform</option>
                  <option value="spectrum">Spectrum</option>
                  <option value="lyrics">Lyrics</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance Info */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
            <div className="text-xs text-gray-300 space-y-1">
              <div>Phase 7: Advanced Features</div>
              <div>WebGPU + AI + MIDI + NDI</div>
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <span className="text-green-400">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="absolute top-20 left-4 z-20 space-y-2">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50">
            <div className="text-xs text-gray-300 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  featureHealth['AI Style Transfer'] === 'healthy' ? 'bg-green-400' :
                  featureHealth['AI Style Transfer'] === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
                <span>AI Style Transfer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  featureHealth['3D Scene'] === 'healthy' ? 'bg-green-400' :
                  featureHealth['3D Scene'] === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
                <span>3D Scene Manipulation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  featureHealth['MIDI'] === 'healthy' ? 'bg-green-400' :
                  featureHealth['MIDI'] === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
                <span>MIDI 2.0 Control</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  featureHealth['NDI'] === 'healthy' ? 'bg-green-400' :
                  featureHealth['NDI'] === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></span>
                <span>NDI Streaming</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden canvas for NDI streaming */}
        <canvas
          ref={canvasRef}
          className="hidden"
          width={1920}
          height={1080}
        />

        {/* Loading overlay */}
        {!isWebGPUSupported && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white">Loading Advanced Features...</p>
              <p className="text-gray-400 text-sm mt-2">
                Initializing WebGPU renderer and AI services
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const userAgent = context.req.headers['user-agent'] || '';
  
  return {
    props: {
      userAgent,
    },
  };
};

export default AdvancedFeaturesPage;