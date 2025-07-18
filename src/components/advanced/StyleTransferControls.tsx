/**
 * Style Transfer Controls Component
 * UI for managing AI style transfer settings
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { styleTransferService, StyleTransferConfig } from '@/services/ai/styleTransfer';
import { errorHandler } from '@/utils/errorHandler';

interface StyleTransferControlsProps {
  onConfigChange?: (config: StyleTransferConfig) => void;
  className?: string;
}

export const StyleTransferControls: React.FC<StyleTransferControlsProps> = ({
  onConfigChange,
  className = '',
}) => {
  const [config, setConfig] = useState<StyleTransferConfig>(
    styleTransferService.getConfig()
  );
  const [metrics, setMetrics] = useState(styleTransferService.getMetrics());
  const [isLoading, setIsLoading] = useState(false);
  const [presetStyles] = useState(styleTransferService.getPresetStyles());

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(styleTransferService.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (newConfig: Partial<StyleTransferConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    styleTransferService.setConfig(updatedConfig);
    onConfigChange?.(updatedConfig);
  };

  const handleStyleSelect = async (styleKey: string) => {
    if (styleKey === 'none') {
      handleConfigChange({ 
        styleName: 'none', 
        styleUrl: '', 
        enabled: false 
      });
      return;
    }

    setIsLoading(true);
    try {
      const style = presetStyles[styleKey];
      handleConfigChange({
        styleName: styleKey,
        styleUrl: style.url,
        enabled: true,
      });
      
      errorHandler.info(`Style changed to ${style.name}`);
    } catch (error) {
      errorHandler.error('Failed to change style', error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStrengthChange = (strength: number) => {
    handleConfigChange({ strength });
  };

  const handleBlendModeChange = (blendMode: StyleTransferConfig['blendMode']) => {
    handleConfigChange({ blendMode });
  };

  const handleToggle = () => {
    handleConfigChange({ enabled: !config.enabled });
  };

  const getPerformanceColor = (fps: number) => {
    if (fps >= 30) return 'text-green-400';
    if (fps >= 15) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          AI Style Transfer
        </h3>
        
        <div className="flex items-center gap-4">
          {/* Performance Metrics */}
          <div className="text-sm text-gray-400">
            <span className={`font-mono ${getPerformanceColor(metrics.fps)}`}>
              {metrics.fps.toFixed(1)} FPS
            </span>
            <span className="ml-2">
              {metrics.processingTime.toFixed(1)}ms
            </span>
          </div>
          
          {/* Model Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              metrics.modelLoaded ? 'bg-green-400' : 'bg-yellow-400'
            }`}></div>
            <span className="text-sm text-gray-400">
              {metrics.modelLoaded ? 'AI Model' : 'Filters'}
            </span>
          </div>
          
          {/* Enable/Disable Toggle */}
          <button
            onClick={handleToggle}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              config.enabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            disabled={isLoading}
          >
            {config.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Style Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Artistic Style
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* None option */}
          <button
            onClick={() => handleStyleSelect('none')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              config.styleName === 'none'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            disabled={isLoading}
          >
            <div className="text-center">
              <div className="w-full h-16 bg-gray-700 rounded-md mb-2 flex items-center justify-center">
                <span className="text-gray-400">None</span>
              </div>
              <span className="text-sm text-white">Original</span>
            </div>
          </button>

          {/* Style presets */}
          {Object.entries(presetStyles).map(([key, style]) => (
            <button
              key={key}
              onClick={() => handleStyleSelect(key)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                config.styleName === key
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              disabled={isLoading}
              title={style.description}
            >
              <div className="text-center">
                <div className="w-full h-16 bg-gray-700 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                  <Image
                    src={style.url}
                    alt={style.name}
                    className="w-full h-full object-cover"
                    width={64}
                    height={64}
                    onError={(e) => {
                      // Fallback to text if image fails
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-gray-400 text-xs">{style.name}</span>
                </div>
                <span className="text-sm text-white">{style.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Style Strength */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Style Strength: {(config.strength * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.strength}
          onChange={(e) => handleStrengthChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none slider"
          disabled={!config.enabled || isLoading}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Subtle</span>
          <span>Strong</span>
        </div>
      </div>

      {/* Blend Mode */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Blend Mode
        </label>
        <select
          value={config.blendMode}
          onChange={(e) => handleBlendModeChange(e.target.value as StyleTransferConfig['blendMode'])}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!config.enabled || isLoading}
        >
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="softlight">Soft Light</option>
        </select>
      </div>

      {/* Advanced Settings */}
      <div className="border-t border-gray-700 pt-4">
        <details className="group">
          <summary className="text-sm font-medium text-gray-300 cursor-pointer mb-3 flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90">▶</span>
            Advanced Settings
          </summary>
          
          <div className="space-y-4 ml-6">
            {/* Memory Usage */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Memory Usage: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)} MB
              </label>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (metrics.memoryUsage / (256 * 1024 * 1024)) * 100)}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Processing Time */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Processing Time
              </label>
              <div className="text-sm font-mono text-gray-300">
                {metrics.processingTime.toFixed(2)}ms per frame
              </div>
            </div>

            {/* Quality Settings */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Quality Mode
              </label>
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!config.enabled || isLoading}
              >
                <option value="performance">Performance (256x256)</option>
                <option value="balanced">Balanced (512x512)</option>
                <option value="quality">Quality (1024x1024)</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <span className="text-white text-sm">Loading style...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleTransferControls;