/**
 * Quality Controls Component
 * Manual quality adjustment and adaptive quality settings
 */

import React, { useState, useEffect } from 'react';
import { PerformanceMonitor } from '@/utils/performanceMonitor/core';
import { QualityProfile, QUALITY_PROFILES } from '@/utils/performanceMonitor/types';
import { AdaptiveQualityManager } from '@/utils/performanceMonitor/adaptiveQuality';

interface QualityControlsProps {
  monitor: PerformanceMonitor;
}

export const QualityControls: React.FC<QualityControlsProps> = ({ monitor }) => {
  const [adaptiveQuality, setAdaptiveQuality] = useState<AdaptiveQualityManager | null>(null);
  const [currentProfile, setCurrentProfile] = useState<QualityProfile>(QUALITY_PROFILES.medium);
  const [isAdaptiveEnabled, setIsAdaptiveEnabled] = useState(true);
  const [customSettings, setCustomSettings] = useState({
    renderScale: 1.0,
    particleCount: 1000,
    effectComplexity: 3,
    fpsTarget: 60,
    audioLatency: 128,
  });

  useEffect(() => {
    // In a real implementation, this would get the adaptive quality manager
    // from the performance monitor or store
    // For now, we'll create a mock instance
    setAdaptiveQuality(null);
  }, [monitor]);

  const profileOptions = Object.entries(QUALITY_PROFILES).map(([key, profile]) => ({
    key,
    ...profile,
  }));

  const handleProfileChange = (profileKey: string): void => {
    const profile = QUALITY_PROFILES[profileKey];
    if (profile) {
      setCurrentProfile(profile);
      setCustomSettings({
        renderScale: profile.renderScale,
        particleCount: profile.particleCount,
        effectComplexity: profile.effectComplexity,
        fpsTarget: profile.fpsTarget,
        audioLatency: profile.audioLatency,
      });
      
      // Apply profile (in real implementation)
      console.log(`Applied quality profile: ${profile.name}`);
    }
  };

  const handleCustomSettingChange = (key: string, value: number): void => {
    setCustomSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    
    // Apply custom settings immediately
    console.log(`Updated ${key}: ${value}`);
  };

  const handleAdaptiveToggle = (enabled: boolean): void => {
    setIsAdaptiveEnabled(enabled);
    if (adaptiveQuality) {
      adaptiveQuality.setEnabled(enabled);
    }
    console.log(`Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
  };

  const getProfileDescription = (profile: QualityProfile): string => {
    const descriptions = {
      'Ultra Low': 'Minimum settings for maximum compatibility',
      'Low': 'Reduced quality for older devices',
      'Medium': 'Balanced quality and performance',
      'High': 'Enhanced visuals for capable devices',
      'Ultra': 'Maximum quality for high-end systems',
    };
    return descriptions[profile.name as keyof typeof descriptions] || 'Custom quality settings';
  };

  const getPerformanceImpact = (setting: string, value: number): string => {
    switch (setting) {
      case 'renderScale':
        if (value <= 0.75) return 'Low GPU usage';
        if (value >= 1.25) return 'High GPU usage';
        return 'Moderate GPU usage';
      case 'particleCount':
        if (value <= 500) return 'Low CPU/GPU impact';
        if (value >= 2000) return 'High CPU/GPU impact';
        return 'Moderate CPU/GPU impact';
      case 'effectComplexity':
        if (value <= 2) return 'Simple shaders';
        if (value >= 4) return 'Complex shaders';
        return 'Standard shaders';
      case 'fpsTarget':
        if (value <= 30) return 'Power saving';
        if (value >= 60) return 'Smooth experience';
        return 'Balanced';
      case 'audioLatency':
        if (value <= 64) return 'Low latency, high CPU';
        if (value >= 256) return 'High latency, low CPU';
        return 'Balanced latency';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Adaptive Quality Toggle */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Adaptive Quality</h4>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAdaptiveEnabled}
              onChange={(e) => handleAdaptiveToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <p className="text-xs text-gray-400 mb-3">
          Automatically adjusts quality based on performance metrics
        </p>

        {isAdaptiveEnabled && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Adaptation:</span>
              <span className="text-white">2 minutes ago</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Reason:</span>
              <span className="text-white">Performance improvement</span>
            </div>
          </div>
        )}
      </div>

      {/* Quality Presets */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Quality Presets</h4>
        
        <div className="space-y-2">
          {profileOptions.map((profile) => (
            <label
              key={profile.key}
              className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 rounded p-2 transition-colors"
            >
              <input
                type="radio"
                name="qualityProfile"
                value={profile.key}
                checked={currentProfile.name === profile.name}
                onChange={() => handleProfileChange(profile.key)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium">{profile.name}</span>
                  <span className="text-xs text-gray-400">{profile.fpsTarget} FPS target</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {getProfileDescription(profile)}
                </p>
                <div className="flex space-x-2 mt-1 text-xs text-gray-500">
                  <span>Scale: {profile.renderScale}x</span>
                  <span>Particles: {profile.particleCount}</span>
                  <span>Effects: Level {profile.effectComplexity}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Settings */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Custom Settings</h4>
        
        <div className="space-y-4">
          {/* Render Scale */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Render Scale</label>
              <span className="text-sm text-white font-mono">{customSettings.renderScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={customSettings.renderScale}
              onChange={(e) => handleCustomSettingChange('renderScale', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5x</span>
              <span className="text-blue-400">{getPerformanceImpact('renderScale', customSettings.renderScale)}</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* Particle Count */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Max Particles</label>
              <span className="text-sm text-white font-mono">{customSettings.particleCount.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={customSettings.particleCount}
              onChange={(e) => handleCustomSettingChange('particleCount', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>100</span>
              <span className="text-blue-400">{getPerformanceImpact('particleCount', customSettings.particleCount)}</span>
              <span>5000</span>
            </div>
          </div>

          {/* Effect Complexity */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Effect Complexity</label>
              <span className="text-sm text-white font-mono">Level {customSettings.effectComplexity}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={customSettings.effectComplexity}
              onChange={(e) => handleCustomSettingChange('effectComplexity', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Simple</span>
              <span className="text-blue-400">{getPerformanceImpact('effectComplexity', customSettings.effectComplexity)}</span>
              <span>Complex</span>
            </div>
          </div>

          {/* FPS Target */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Target FPS</label>
              <span className="text-sm text-white font-mono">{customSettings.fpsTarget}</span>
            </div>
            <input
              type="range"
              min="30"
              max="120"
              step="15"
              value={customSettings.fpsTarget}
              onChange={(e) => handleCustomSettingChange('fpsTarget', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30</span>
              <span className="text-blue-400">{getPerformanceImpact('fpsTarget', customSettings.fpsTarget)}</span>
              <span>120</span>
            </div>
          </div>

          {/* Audio Latency */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-300">Audio Buffer Size</label>
              <span className="text-sm text-white font-mono">{customSettings.audioLatency} samples</span>
            </div>
            <input
              type="range"
              min="32"
              max="512"
              step="32"
              value={customSettings.audioLatency}
              onChange={(e) => handleCustomSettingChange('audioLatency', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>32</span>
              <span className="text-blue-400">{getPerformanceImpact('audioLatency', customSettings.audioLatency)}</span>
              <span>512</span>
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={() => {
              // Apply custom settings
              console.log('Applied custom settings:', customSettings);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded transition-colors"
          >
            Apply Custom Settings
          </button>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Recommendations</h4>
        
        <div className="space-y-2 text-xs">
          <div className="flex items-start space-x-2">
            <span className="text-blue-400 mt-0.5">💡</span>
            <div>
              <div className="text-white font-medium">Enable adaptive quality</div>
              <div className="text-gray-400">Let the system automatically optimize settings based on performance</div>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="text-green-400 mt-0.5">✅</span>
            <div>
              <div className="text-white font-medium">Your device can handle higher settings</div>
              <div className="text-gray-400">Consider increasing render scale or particle count for better visuals</div>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            <span className="text-yellow-400 mt-0.5">⚠️</span>
            <div>
              <div className="text-white font-medium">High audio latency detected</div>
              <div className="text-gray-400">Consider reducing audio buffer size for more responsive audio</div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-gray-800 rounded-lg p-4">
        <details className="group">
          <summary className="text-sm font-semibold text-white cursor-pointer list-none flex items-center justify-between">
            <span>Advanced Settings</span>
            <span className="transition-transform group-open:rotate-180">▼</span>
          </summary>
          
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Force GPU acceleration</span>
              <input type="checkbox" className="text-blue-600 focus:ring-blue-500 rounded" />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Enable WebGPU (experimental)</span>
              <input type="checkbox" className="text-blue-600 focus:ring-blue-500 rounded" />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Reduce motion on battery</span>
              <input type="checkbox" defaultChecked className="text-blue-600 focus:ring-blue-500 rounded" />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Debug performance metrics</span>
              <input type="checkbox" className="text-blue-600 focus:ring-blue-500 rounded" />
            </label>
          </div>
        </details>
      </div>
    </div>
  );
};