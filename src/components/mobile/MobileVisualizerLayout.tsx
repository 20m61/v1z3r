/**
 * Mobile Visualizer Layout
 * Responsive layout optimized for iPhone screens
 */

import React, { useState, useEffect } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';
import { iosDetector } from '@/utils/iosDetection';
import { iosAudioHandler } from '@/services/audio/iosAudioHandler';
import { mobilePerformanceOptimizer } from '@/services/mobile/mobilePerformanceOptimizer';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';
import TouchControls from './TouchControls';
import PWAInstallPrompt from './PWAInstallPrompt';
import { errorHandler } from '@/utils/errorHandler';

interface MobileVisualizerLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileControlsState {
  showControls: boolean;
  showSettings: boolean;
  showPerformanceStats: boolean;
  isFullscreen: boolean;
  audioPermissionGranted: boolean;
  motionPermissionGranted: boolean;
}

export const MobileVisualizerLayout: React.FC<MobileVisualizerLayoutProps> = ({
  children,
  className = '',
}) => {
  const [controlsState, setControlsState] = useState<MobileControlsState>({
    showControls: false,
    showSettings: false,
    showPerformanceStats: false,
    isFullscreen: false,
    audioPermissionGranted: false,
    motionPermissionGranted: false,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState(
    mobilePerformanceOptimizer.getMetrics()
  );

  const { orientation, requestMotionPermission, getCSSVariables } = useDeviceOrientation();
  const deviceInfo = iosDetector.detectDevice();
  const safeArea = iosDetector.getSafeAreaInsets();

  const {
    isAudioAnalyzing,
    setAudioAnalyzing,
    isMicrophoneEnabled,
    setMicrophoneEnabled,
    sensitivity,
    setSensitivity,
    colorTheme,
    setColorTheme,
    currentEffectType,
    setEffectType,
  } = useVisualizerStore();

  // Initialize mobile optimizations
  useEffect(() => {
    const initializeMobile = async () => {
      try {
        // Initialize iOS-specific optimizations
        iosDetector.initializeIOSOptimizations();
        
        // Initialize audio handler
        await iosAudioHandler.initialize();
        iosAudioHandler.setupAudioInterruptionHandling();
        
        // Initialize performance optimizer
        await mobilePerformanceOptimizer.initialize();
        
        setIsInitialized(true);
        errorHandler.info('Mobile visualizer initialized');
      } catch (error) {
        errorHandler.error('Failed to initialize mobile visualizer', error as Error);
      }
    };

    initializeMobile();

    // Cleanup on unmount
    return () => {
      iosAudioHandler.destroy();
      mobilePerformanceOptimizer.destroy();
    };
  }, []);

  // Update performance metrics
  useEffect(() => {
    const updateMetrics = () => {
      setPerformanceMetrics(mobilePerformanceOptimizer.getMetrics());
    };

    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle audio permission
  const handleAudioPermission = async () => {
    try {
      await iosAudioHandler.unlockAudioContext();
      await iosAudioHandler.startMicrophone();
      
      setControlsState(prev => ({ ...prev, audioPermissionGranted: true }));
      setMicrophoneEnabled(true);
      setAudioAnalyzing(true);
      
      errorHandler.info('Audio permission granted');
    } catch (error) {
      errorHandler.error('Failed to get audio permission', error as Error);
    }
  };

  // Handle motion permission
  const handleMotionPermission = async () => {
    try {
      const granted = await requestMotionPermission();
      setControlsState(prev => ({ ...prev, motionPermissionGranted: granted }));
      
      if (granted) {
        errorHandler.info('Motion permission granted');
      }
    } catch (error) {
      errorHandler.error('Failed to get motion permission', error as Error);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = async () => {
    try {
      if (!controlsState.isFullscreen) {
        await document.documentElement.requestFullscreen();
        setControlsState(prev => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setControlsState(prev => ({ ...prev, isFullscreen: false }));
      }
    } catch (error) {
      errorHandler.warn('Fullscreen not supported', error as Error);
    }
  };

  // Handle parameter changes from touch controls
  const handleParameterChange = (param: string, value: number) => {
    // Update performance optimizer with frame timing
    mobilePerformanceOptimizer.updateFrameMetrics(16.67); // Assume 60 FPS for now
  };

  // Get layout styles based on orientation and device
  const getLayoutStyles = (): React.CSSProperties => {
    const cssVariables = getCSSVariables();
    
    return {
      ...cssVariables,
      paddingTop: `max(${safeArea.top}px, var(--safe-area-inset-top))`,
      paddingBottom: `max(${safeArea.bottom}px, var(--safe-area-inset-bottom))`,
      paddingLeft: `max(${safeArea.left}px, var(--safe-area-inset-left))`,
      paddingRight: `max(${safeArea.right}px, var(--safe-area-inset-right))`,
      height: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitTapHighlightColor: 'transparent',
    };
  };

  // Render permission prompts
  const renderPermissionPrompts = () => {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
        <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Permissions Required
          </h2>
          
          <div className="space-y-4">
            {!controlsState.audioPermissionGranted && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  🎵 Audio Access
                </h3>
                <p className="text-sm text-blue-800 mb-3">
                  Required for audio-reactive visuals and microphone input
                </p>
                <button
                  onClick={handleAudioPermission}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-medium"
                >
                  Enable Audio
                </button>
              </div>
            )}
            
            {!controlsState.motionPermissionGranted && (
              <div className="bg-green-50 rounded-xl p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  📱 Motion Access
                </h3>
                <p className="text-sm text-green-800 mb-3">
                  Optional: Enables motion-controlled effects
                </p>
                <button
                  onClick={handleMotionPermission}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-lg font-medium"
                >
                  Enable Motion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render control panel
  const renderControlPanel = () => {
    if (!controlsState.showControls) return null;

    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 z-30">
        <div className="grid grid-cols-2 gap-4">
          {/* Effect Type */}
          <div>
            <label className="block text-xs text-white/80 mb-1">Effect</label>
            <select
              value={currentEffectType}
              onChange={(e) => setEffectType(e.target.value as any)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="particles">Particles</option>
              <option value="waveform">Waveform</option>
              <option value="spectrum">Spectrum</option>
              <option value="lyrics">Lyrics</option>
            </select>
          </div>

          {/* Sensitivity */}
          <div>
            <label className="block text-xs text-white/80 mb-1">
              Sensitivity: {sensitivity.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Color Theme */}
          <div>
            <label className="block text-xs text-white/80 mb-1">Color</label>
            <input
              type="color"
              value={colorTheme}
              onChange={(e) => setColorTheme(e.target.value)}
              className="w-full h-10 rounded-lg border-none"
            />
          </div>

          {/* Fullscreen */}
          <div>
            <label className="block text-xs text-white/80 mb-1">View</label>
            <button
              onClick={handleFullscreenToggle}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
            >
              {controlsState.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render performance stats
  const renderPerformanceStats = () => {
    if (!controlsState.showPerformanceStats) return null;

    return (
      <div className="absolute top-16 right-4 bg-black/80 backdrop-blur-sm rounded-xl p-3 z-30">
        <div className="text-xs text-white/80 space-y-1">
          <div>FPS: {performanceMetrics.currentFPS.toFixed(0)}</div>
          <div>CPU: {(performanceMetrics.cpuUsage * 100).toFixed(0)}%</div>
          <div>Memory: {(performanceMetrics.memoryUsage * 100).toFixed(0)}%</div>
          <div>Battery: {(performanceMetrics.batteryLevel * 100).toFixed(0)}%</div>
          <div>Thermal: {performanceMetrics.thermalState}</div>
        </div>
      </div>
    );
  };

  // Render floating action button
  const renderFloatingActionButton = () => {
    return (
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => setControlsState(prev => ({ ...prev, showControls: !prev.showControls }))}
          className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    );
  };

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Initializing Mobile Visualizer...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative bg-black ${className}`}
        style={getLayoutStyles()}
      >
        {/* Main visualizer content */}
        <div className="absolute inset-0">
          {children}
        </div>

        {/* Touch controls overlay */}
        <div className="absolute inset-0 z-10">
          <TouchControls onParameterChange={handleParameterChange} />
        </div>

        {/* UI Elements */}
        {renderFloatingActionButton()}
        {renderControlPanel()}
        {renderPerformanceStats()}

        {/* Permission prompts */}
        {(!controlsState.audioPermissionGranted || !controlsState.motionPermissionGranted) && 
         renderPermissionPrompts()}

        {/* Device info overlay */}
        <div className="absolute bottom-4 left-4 text-xs text-white/60 z-20">
          <div>{deviceInfo.model}</div>
          <div>{orientation.orientation}</div>
          <div>{orientation.viewport.width}x{orientation.viewport.height}</div>
        </div>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt
        onInstall={() => errorHandler.info('PWA installation guided')}
        onDismiss={() => errorHandler.info('PWA installation dismissed')}
      />
    </>
  );
};

export default MobileVisualizerLayout;