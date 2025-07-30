/**
 * AI VJ Demo Component
 * Demonstrates integration of all advanced features
 */

import React, { useEffect, useRef, useState } from 'react';
import { createAIVJMaster, AIVJMaster, AIVJEvent } from '@/utils/aiVJMaster';
import { useVisualizerStore } from '@/store/visualizerStore';

interface AIVJDemoProps {
  className?: string;
}

interface PerformanceStats {
  fps: number;
  aiProcessingTime: number;
  particleCount: number;
  currentTempo: number;
  currentStyle: string;
  connectedControllers: number;
}

export const AIVJDemo: React.FC<AIVJDemoProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vjMasterRef = useRef<AIVJMaster | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    fps: 0,
    aiProcessingTime: 0,
    particleCount: 0,
    currentTempo: 120,
    currentStyle: 'minimal',
    connectedControllers: 0,
  });

  const { isPlaying, setIsPlaying, audioSource, setAudioContext } = useVisualizerStore();

  // Initialize AI VJ Master
  const initializeVJMaster = async () => {
    if (!canvasRef.current || isInitialized) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create audio context
      const audioContext = new AudioContext();
      setAudioContext(audioContext);

      // Create AI VJ Master
      const vjMaster = await createAIVJMaster({
        canvas: canvasRef.current,
        audioContext,
        enableWebGPU: true,
        enableAI: true,
        enableMIDI: true,
        enableStyleTransfer: true,
        enableParticles: true,
        performanceMode: 'balanced',
        targetFPS: 60,
        maxParticles: 50000,
        aiUpdateInterval: 100,
        styleTransferQuality: 'medium',
        debugMode: false,
      });

      vjMasterRef.current = vjMaster;

      // Setup event listeners
      vjMaster.addEventListener('initialization_complete', handleInitComplete);
      vjMaster.addEventListener('style_change', handleStyleChange);
      vjMaster.addEventListener('beat_detected', handleBeatDetected);
      vjMaster.addEventListener('midi_controller_connected', handleControllerConnected);
      vjMaster.addEventListener('performance_warning', handlePerformanceWarning);

      // Start performance monitoring
      startPerformanceMonitoring();

      setIsInitialized(true);
      console.log('[AIVJDemo] VJ Master initialized successfully');
    } catch (err) {
      console.error('[AIVJDemo] Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setIsLoading(false);
    }
  };

  // Event handlers
  const handleInitComplete = (event: AIVJEvent) => {
    console.log('[AIVJDemo] Initialization complete:', event.data);
  };

  const handleStyleChange = (event: AIVJEvent) => {
    console.log('[AIVJDemo] Style changed:', event.data.style);
    setPerformanceStats(prev => ({
      ...prev,
      currentStyle: event.data.style.name,
    }));
  };

  const handleBeatDetected = (event: AIVJEvent) => {
    // Could trigger visual effects here
    console.log('[AIVJDemo] Beat detected:', event.data);
  };

  const handleControllerConnected = (event: AIVJEvent) => {
    console.log('[AIVJDemo] Controller connected:', event.data.controller);
    setPerformanceStats(prev => ({
      ...prev,
      connectedControllers: prev.connectedControllers + 1,
    }));
  };

  const handlePerformanceWarning = (event: AIVJEvent) => {
    console.warn('[AIVJDemo] Performance warning:', event.data);
  };

  // Performance monitoring
  const startPerformanceMonitoring = () => {
    const updateStats = () => {
      if (!vjMasterRef.current) return;

      const metrics = vjMasterRef.current.getPerformanceMetrics();
      const state = vjMasterRef.current.getState();
      const musicFeatures = vjMasterRef.current.getCurrentMusicFeatures();

      setPerformanceStats({
        fps: Math.round(metrics.fps),
        aiProcessingTime: Math.round(metrics.aiProcessingTime * 100) / 100,
        particleCount: metrics.particleCount,
        currentTempo: musicFeatures?.tempo || 120,
        currentStyle: state.currentStyle?.name || 'minimal',
        connectedControllers: state.connectedControllers,
      });
    };

    setInterval(updateStats, 1000);
  };

  // Connect audio source
  useEffect(() => {
    if (!vjMasterRef.current || !audioSource) return;

    if (isPlaying) {
      vjMasterRef.current.connectAudioSource(audioSource);
    } else {
      vjMasterRef.current.disconnectAudioSource();
    }
  }, [isPlaying, audioSource]);

  // Handle microphone input
  const handleMicrophoneInput = async () => {
    if (!vjMasterRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = vjMasterRef.current.getAudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      vjMasterRef.current.connectAudioSource(source);
      setIsPlaying(true);
    } catch (err) {
      console.error('[AIVJDemo] Microphone access failed:', err);
      setError('Failed to access microphone');
    }
  };

  // Handle file input
  const handleFileInput = async (file: File) => {
    if (!vjMasterRef.current) return;

    try {
      const audioContext = vjMasterRef.current.getAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      vjMasterRef.current.connectAudioSource(source);
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error('[AIVJDemo] File playback failed:', err);
      setError('Failed to play audio file');
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (vjMasterRef.current) {
        vjMasterRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" style={{ background: '#000' }} />

      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-lg">
        <h3 className="text-lg font-bold mb-2">AI VJ Controller</h3>

        {!isInitialized ? (
          <button
            onClick={initializeVJMaster}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
          >
            {isLoading ? 'Initializing...' : 'Initialize AI VJ'}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleMicrophoneInput}
              className="block w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              Use Microphone
            </button>

            <label className="block">
              <span className="block mb-1 text-sm">Or upload audio file:</span>
              <input
                type="file"
                accept="audio/*"
                onChange={e => e.target.files?.[0] && handleFileInput(e.target.files[0])}
                className="block w-full text-sm"
              />
            </label>
          </div>
        )}

        {error && <div className="mt-2 text-red-400 text-sm">{error}</div>}
      </div>

      {/* Performance Stats */}
      {isInitialized && (
        <div className="absolute top-4 right-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm">
          <h4 className="font-bold mb-2">Performance</h4>
          <div className="space-y-1">
            <div>
              FPS: <span className="text-green-400">{performanceStats.fps}</span>
            </div>
            <div>
              AI Processing:{' '}
              <span className="text-yellow-400">{performanceStats.aiProcessingTime}ms</span>
            </div>
            <div>
              Particles:{' '}
              <span className="text-blue-400">
                {performanceStats.particleCount.toLocaleString()}
              </span>
            </div>
            <div>
              Tempo:{' '}
              <span className="text-purple-400">
                {Math.round(performanceStats.currentTempo)} BPM
              </span>
            </div>
            <div>
              Style: <span className="text-pink-400">{performanceStats.currentStyle}</span>
            </div>
            <div>
              MIDI Controllers:{' '}
              <span className="text-orange-400">{performanceStats.connectedControllers}</span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg max-w-md">
        <h4 className="font-bold mb-2">Instructions</h4>
        <ul className="text-sm space-y-1">
          <li>• Initialize the AI VJ system to begin</li>
          <li>• Use microphone input or upload an audio file</li>
          <li>• Connect MIDI controllers for live control</li>
          <li>• System automatically adapts visuals to music</li>
          <li>• WebGPU acceleration enabled (with WebGL fallback)</li>
        </ul>
      </div>
    </div>
  );
};

export default AIVJDemo;
