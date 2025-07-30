/**
 * NDI Streaming Panel Component
 * UI for NDI streaming configuration and monitoring
 */

import React, { useState, useEffect } from 'react';
import {
  ndiStreamingService,
  NDIConfig,
  NDISource,
  NDIReceiver,
  NDIMetrics,
} from '@/services/streaming/ndiStreaming';
import { errorHandler } from '@/utils/errorHandler';

interface NDIStreamingPanelProps {
  onCanvasUpdate?: (canvas: HTMLCanvasElement) => void;
  className?: string;
}

export const NDIStreamingPanel: React.FC<NDIStreamingPanelProps> = ({
  onCanvasUpdate,
  className = '',
}) => {
  const [config, setConfig] = useState<NDIConfig>(ndiStreamingService.getConfig());
  const [metrics, setMetrics] = useState<NDIMetrics>(ndiStreamingService.getMetrics());
  const [sources, setSources] = useState<NDISource[]>([]);
  const [receivers, setReceivers] = useState<NDIReceiver[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'sources' | 'receivers' | 'metrics'>(
    'config'
  );
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  useEffect(() => {
    initializeNDI();
    return () => {
      ndiStreamingService.dispose();
    };
  }, []);

  const initializeNDI = async () => {
    try {
      setConnectionStatus('connecting');

      // Set up callbacks
      ndiStreamingService.setCallbacks({
        onStreamStart: () => {
          setIsStreaming(true);
          errorHandler.info('NDI streaming started');
        },
        onStreamStop: () => {
          setIsStreaming(false);
          errorHandler.info('NDI streaming stopped');
        },
        onSourceDiscovered: source => {
          setSources(prev => [...prev.filter(s => s.id !== source.id), source]);
          errorHandler.info(`NDI source discovered: ${source.name}`);
        },
        onReceiverConnected: receiver => {
          setReceivers(prev => [...prev.filter(r => r.id !== receiver.id), receiver]);
          errorHandler.info(`NDI receiver connected: ${receiver.name}`);
        },
        onReceiverDisconnected: receiver => {
          setReceivers(prev => prev.filter(r => r.id !== receiver.id));
          errorHandler.info(`NDI receiver disconnected: ${receiver.name}`);
        },
        onMetricsUpdate: newMetrics => {
          setMetrics(newMetrics);
        },
      });

      // Initialize NDI service
      await ndiStreamingService.initialize();

      setSources(ndiStreamingService.getDiscoveredSources());
      setReceivers(ndiStreamingService.getConnectedReceivers());
      setIsInitialized(true);
      setConnectionStatus('connected');
    } catch (error) {
      errorHandler.error('Failed to initialize NDI', error as Error);
      setConnectionStatus('disconnected');
    }
  };

  const handleConfigChange = (newConfig: Partial<NDIConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    ndiStreamingService.setConfig(updatedConfig);
  };

  const handleStartStreaming = async () => {
    try {
      await ndiStreamingService.startStreaming();
    } catch (error) {
      errorHandler.error('Failed to start NDI streaming', error as Error);
    }
  };

  const handleStopStreaming = () => {
    ndiStreamingService.stopStreaming();
  };

  const handleCanvasUpdate = (canvas: HTMLCanvasElement) => {
    if (isStreaming) {
      ndiStreamingService.updateCanvas(canvas);
    }
    onCanvasUpdate?.(canvas);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatBandwidth = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB/s`;
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const renderConfigTab = () => (
    <div className="space-y-6">
      {/* Stream Settings */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Stream Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Source Name</label>
            <input
              type="text"
              value={config.sourceName}
              onChange={e => handleConfigChange({ sourceName: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter source name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Group Name</label>
            <input
              type="text"
              value={config.groupName}
              onChange={e => handleConfigChange({ groupName: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter group name..."
            />
          </div>
        </div>
      </div>

      {/* Video Settings */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Video Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
            <select
              value={config.resolution}
              onChange={e => handleConfigChange({ resolution: e.target.value as any })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1080p">1080p (1920x1080)</option>
              <option value="720p">720p (1280x720)</option>
              <option value="480p">480p (854x480)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Frame Rate</label>
            <select
              value={config.frameRate}
              onChange={e => handleConfigChange({ frameRate: parseInt(e.target.value) as any })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">30 FPS</option>
              <option value="60">60 FPS</option>
              <option value="120">120 FPS</option>
            </select>
          </div>
        </div>

        {config.resolution === 'custom' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Custom Width</label>
              <input
                type="number"
                value={config.customWidth || 1920}
                onChange={e => handleConfigChange({ customWidth: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="320"
                max="4096"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Custom Height</label>
              <input
                type="number"
                value={config.customHeight || 1080}
                onChange={e => handleConfigChange({ customHeight: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="240"
                max="2160"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audio Settings */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Audio Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.enableAudio}
                onChange={e => handleConfigChange({ enableAudio: e.target.checked })}
                className="rounded"
              />
              Enable Audio
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Sample Rate</label>
            <select
              value={config.audioSampleRate}
              onChange={e =>
                handleConfigChange({ audioSampleRate: parseInt(e.target.value) as any })
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!config.enableAudio}
            >
              <option value="48000">48 kHz</option>
              <option value="44100">44.1 kHz</option>
              <option value="32000">32 kHz</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h4 className="text-lg font-medium text-white mb-4">Advanced Settings</h4>
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.enableAlpha}
                onChange={e => handleConfigChange({ enableAlpha: e.target.checked })}
                className="rounded"
              />
              Enable Alpha Channel
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.clockSync}
                onChange={e => handleConfigChange({ clockSync: e.target.checked })}
                className="rounded"
              />
              Clock Synchronization
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.multicast}
                onChange={e => handleConfigChange({ multicast: e.target.checked })}
                className="rounded"
              />
              Multicast
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bandwidth Limit: {config.bandwidth} Mbps
            </label>
            <input
              type="range"
              min="1"
              max="1000"
              value={config.bandwidth}
              onChange={e => handleConfigChange({ bandwidth: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 Mbps</span>
              <span>1000 Mbps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSourcesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-white">Discovered Sources</h4>
        <span className="text-sm text-gray-400">{sources.length} sources</span>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-gray-400">No NDI sources discovered</span>
          <p className="text-sm text-gray-500 mt-2">
            Make sure other NDI sources are running on your network
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div key={source.id} className="p-4 bg-gray-800 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📺</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-white">{source.name}</h5>
                    <p className="text-sm text-gray-400">
                      {source.ipAddress}:{source.port} • {source.resolution} @ {source.frameRate}fps
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      source.active ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    {source.active ? 'Active' : 'Inactive'}
                  </span>
                  {source.hasAudio && (
                    <span className="px-2 py-1 text-xs bg-blue-600 rounded">Audio</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReceiversTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-white">Connected Receivers</h4>
        <span className="text-sm text-gray-400">{receivers.length} receivers</span>
      </div>

      {receivers.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-gray-400">No receivers connected</span>
          <p className="text-sm text-gray-500 mt-2">Start streaming to see connected receivers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receivers.map(receiver => (
            <div key={receiver.id} className="p-4 bg-gray-800 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📡</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-white">{receiver.name}</h5>
                    <p className="text-sm text-gray-400">
                      {receiver.ipAddress} • {formatBandwidth(receiver.bandwidth)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      receiver.connected ? 'bg-green-600' : 'bg-red-600'
                    }`}
                  >
                    {receiver.connected ? 'Connected' : 'Disconnected'}
                  </span>
                  <span className="px-2 py-1 text-xs bg-blue-600 rounded">
                    {receiver.quality}% quality
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMetricsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-2">Stream Status</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span
                className={`font-medium ${metrics.isStreaming ? 'text-green-400' : 'text-gray-400'}`}
              >
                {metrics.isStreaming ? 'Streaming' : 'Stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime:</span>
              <span className="text-white">{formatUptime(metrics.uptime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Clients:</span>
              <span className="text-white">{metrics.connectedClients}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-2">Performance</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Bandwidth:</span>
              <span className="text-white">{formatBandwidth(metrics.bandwidth)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Latency:</span>
              <span className="text-white">{metrics.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Quality:</span>
              <span className="text-white">{metrics.quality}%</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-2">Video Stats</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Frames Sent:</span>
              <span className="text-white">{metrics.framesSent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Dropped Frames:</span>
              <span
                className={`font-medium ${metrics.droppedFrames > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {metrics.droppedFrames}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <h5 className="font-medium text-white mb-2">Audio Stats</h5>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Samples Sent:</span>
              <span className="text-white">{metrics.audioSamplesSent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sample Rate:</span>
              <span className="text-white">{config.audioSampleRate / 1000}kHz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isInitialized && connectionStatus === 'disconnected') {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <span className="text-2xl mb-4 block">📡</span>
          <h3 className="text-xl font-bold text-white mb-2">NDI Not Available</h3>
          <p className="text-gray-400 mb-4">
            NDI streaming requires a WebRTC-enabled browser and network access.
          </p>
          <button
            onClick={initializeNDI}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📡</span>
          NDI Streaming
        </h3>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-green-400'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
              }`}
            ></div>
            <span className={`text-sm ${getStatusColor(connectionStatus)}`}>
              {connectionStatus}
            </span>
          </div>

          <button
            onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
            disabled={!isInitialized || connectionStatus !== 'connected'}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isStreaming
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600'
            }`}
          >
            {isStreaming ? 'Stop Stream' : 'Start Stream'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        {[
          { id: 'config', label: 'Configuration', icon: '⚙️' },
          { id: 'sources', label: 'Sources', icon: '📺' },
          { id: 'receivers', label: 'Receivers', icon: '📡' },
          { id: 'metrics', label: 'Metrics', icon: '📊' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'sources' && renderSourcesTab()}
        {activeTab === 'receivers' && renderReceiversTab()}
        {activeTab === 'metrics' && renderMetricsTab()}
      </div>
    </div>
  );
};

export default NDIStreamingPanel;
