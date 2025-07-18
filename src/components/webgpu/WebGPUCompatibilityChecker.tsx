/**
 * WebGPU Compatibility Checker Component
 * Provides graceful fallback UI when WebGPU is not supported
 */

import React, { useEffect, useState } from 'react';
import { webgpuDetector, WebGPUCapabilities } from '@/utils/webgpuDetection';
import { errorHandler } from '@/utils/errorHandler';

interface WebGPUCompatibilityCheckerProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ capabilities: WebGPUCapabilities | null }>;
  onCapabilitiesDetected?: (capabilities: WebGPUCapabilities) => void;
}

const DefaultFallback: React.FC<{ capabilities: WebGPUCapabilities | null }> = ({ capabilities }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4 text-red-500">WebGPU Not Available</h1>
        
        <div className="mb-8 text-lg text-gray-300">
          <p className="mb-4">
            Your browser does not support WebGPU, which is required for advanced visual effects in v1z3r.
          </p>
          
          {capabilities && capabilities.fallbackRequired && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h2 className="text-xl font-semibold mb-2">Compatibility Details</h2>
              <ul className="text-left space-y-1">
                <li>✗ WebGPU Support: Not Available</li>
                <li>✗ Compute Shaders: {capabilities.computeShaderSupport ? 'Available' : 'Not Available'}</li>
                <li>Performance Rating: {capabilities.performanceRating}</li>
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-900 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Recommended Browsers</h2>
            <ul className="space-y-2 text-left">
              <li>• Chrome/Edge 113+ (with WebGPU enabled)</li>
              <li>• Chrome Canary (latest)</li>
              <li>• Firefox Nightly (with WebGPU enabled in about:config)</li>
            </ul>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Enable WebGPU in Chrome</h2>
            <ol className="space-y-2 text-left text-sm">
              <li>1. Navigate to chrome://flags</li>
              <li>2. Search for &quot;WebGPU&quot;</li>
              <li>3. Enable &quot;Unsafe WebGPU&quot;</li>
              <li>4. Restart your browser</li>
            </ol>
          </div>
        </div>

        <div className="mt-8">
          <a 
            href="https://github.com/gpuweb/gpuweb/wiki/Implementation-Status"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Check WebGPU Browser Support
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            For the best experience, we recommend using a modern browser with WebGPU support enabled.
            WebGPU provides hardware-accelerated graphics and compute capabilities for advanced visual effects.
          </p>
        </div>
      </div>
    </div>
  );
};

export const WebGPUCompatibilityChecker: React.FC<WebGPUCompatibilityCheckerProps> = ({
  children,
  fallback: FallbackComponent = DefaultFallback,
  onCapabilitiesDetected,
}) => {
  const [isChecking, setIsChecking] = useState(true);
  const [capabilities, setCapabilities] = useState<WebGPUCapabilities | null>(null);

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        setIsChecking(true);
        const detectedCapabilities = await webgpuDetector.detectCapabilities();
        setCapabilities(detectedCapabilities);
        
        if (onCapabilitiesDetected) {
          onCapabilitiesDetected(detectedCapabilities);
        }

        if (!detectedCapabilities.isSupported) {
          errorHandler.warn('WebGPU not supported', new Error(`WebGPU not supported - User Agent: ${navigator.userAgent}`));
        } else {
          errorHandler.info('WebGPU capabilities detected', new Error(`WebGPU detected - Performance: ${detectedCapabilities.performanceRating}`));
        }
      } catch (error) {
        errorHandler.error('Failed to detect WebGPU capabilities', error as Error);
        setCapabilities({
          isSupported: false,
          powerPreference: 'high-performance',
          fallbackRequired: true,
          performanceRating: 'poor',
          computeShaderSupport: false,
          recommendedConfig: {
            powerPreference: 'high-performance',
            forceFallbackAdapter: false,
            enableComputeShaders: false,
            maxTextureSize: 2048,
            maxBufferSize: 128 * 1024 * 1024,
            maxComputeWorkgroupSize: 64,
            preferredFormat: 'bgra8unorm',
            enableDebug: false,
          },
        });
      } finally {
        setIsChecking(false);
      }
    };

    checkWebGPU();

    return () => {
      // No cleanup needed for detector
    };
  }, [onCapabilitiesDetected]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking WebGPU compatibility...</p>
        </div>
      </div>
    );
  }

  if (capabilities && !capabilities.isSupported) {
    return <FallbackComponent capabilities={capabilities} />;
  }

  return <>{children}</>;
};

// Hook for accessing WebGPU capabilities
export const useWebGPUCapabilities = () => {
  const [capabilities, setCapabilities] = useState<WebGPUCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    webgpuDetector.detectCapabilities()
      .then(setCapabilities)
      .catch((error) => {
        errorHandler.error('Failed to get WebGPU capabilities', error);
        setCapabilities(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { capabilities, isLoading };
};