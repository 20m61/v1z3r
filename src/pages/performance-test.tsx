/**
 * Performance Test Page
 * Demonstrates WebGPU optimization and performance monitoring
 */

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import AudioAnalyzer from '@/components/AudioAnalyzer';
import LoadingSpinner from '@/components/LoadingSpinner';

// Dynamic import temporarily disabled due to React Three Fiber compatibility
// const PerformanceDemo = dynamic(
//   () => import('@/components/PerformanceDemo'),
//   { 
//     ssr: false,
//     loading: () => <LoadingSpinner />
//   }
// );

// Temporary placeholder component
const PerformanceDemo = ({ audioData }: { audioData?: Uint8Array }) => (
  <div className="w-full h-full bg-black flex items-center justify-center text-white">
    <div className="text-center">
      <h2 className="text-2xl mb-4">Performance Demo</h2>
      <p className="text-gray-400">React Three Fiber integration coming soon...</p>
    </div>
  </div>
);

export default function PerformanceTestPage() {
  const [audioData, setAudioData] = useState<Uint8Array | undefined>();
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  const handleAudioData = (data: Uint8Array) => {
    setAudioData(data);
  };
  
  return (
    <>
      <Head>
        <title>v1z3r - Performance Test</title>
        <meta name="description" content="WebGPU Performance Optimization Demo" />
      </Head>
      
      <div className="w-screen h-screen bg-black overflow-hidden">
        {/* Audio Analyzer */}
        {isAudioEnabled && (
          <div className="hidden">
            <AudioAnalyzer 
              onAudioData={handleAudioData}
            />
          </div>
        )}
        
        {/* Performance Demo */}
        <PerformanceDemo audioData={audioData} />
        
        {/* Audio Enable Button */}
        {!isAudioEnabled && (
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => setIsAudioEnabled(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors"
            >
              Enable Audio Reactivity
            </button>
          </div>
        )}
      </div>
    </>
  );
}