/**
 * Safe WebGPU Visualizer with Error Handling
 * Provides fallback mechanisms for WebGPU compatibility issues
 */

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { errorHandler } from '@/utils/errorHandler';

// Simple fallback visualizer component
const FallbackVisualizer: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`${className} bg-black flex items-center justify-center text-white`}>
      <div className="text-center p-8">
        <div className="animate-pulse rounded-full h-32 w-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 mx-auto mb-4"></div>
        <h3 className="text-xl font-semibold mb-2">Audio Visualizer</h3>
        <p className="text-gray-400">Compatible mode active</p>
      </div>
    </div>
  );
};

// Dynamically import the main WebGPU visualizer with error handling
const WebGPUVisualizer = dynamic(
  () => import('@/components/visualizer/WebGPUVisualizer').catch(() => ({
    default: FallbackVisualizer
  })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Initializing visualizer...</p>
        </div>
      </div>
    ),
  }
);

interface SafeWebGPUVisualizerProps {
  className?: string;
  onError?: (error: Error) => void;
}

export const SafeWebGPUVisualizer: React.FC<SafeWebGPUVisualizerProps> = ({
  className = '',
  onError,
}) => {
  const [hasError, setHasError] = useState(false);

  const handleError = (error: Error) => {
    errorHandler.error('WebGPU Visualizer error', error);
    setHasError(true);
    if (onError) {
      onError(error);
    }
  };

  if (hasError) {
    return <FallbackVisualizer className={className} />;
  }

  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => {
        handleError(error);
        return <FallbackVisualizer className={className} />;
      }}
    >
      <Suspense 
        fallback={
          <div className={`${className} bg-black flex items-center justify-center`}>
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-lg">Loading visualizer components...</p>
            </div>
          </div>
        }
      >
        <WebGPUVisualizer className={className} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default SafeWebGPUVisualizer;