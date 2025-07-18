/**
 * Mobile Demo Page
 * Optimized experience for iPhone and mobile devices
 */

import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useVisualizerStore } from '@/store/visualizerStore';
import { iosDetector } from '@/utils/iosDetection';
import { errorHandler } from '@/utils/errorHandler';

// Dynamically import components to avoid SSR issues
const MobileVisualizerLayout = dynamic(
  () => import('@/components/mobile/MobileVisualizerLayout'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    ),
  }
);

// Use WebGPU visualizer with WebGL fallback for mobile compatibility
const WebGPUVisualizer = dynamic(
  () => import('@/components/visualizer/WebGPUVisualizer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    ),
  }
);

interface MobileDemoProps {
  userAgent: string;
  isIOS: boolean;
}

const MobileDemoPage: React.FC<MobileDemoProps> = ({ userAgent, isIOS }) => {
  const [isReady, setIsReady] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { setAudioContext, setAudioSource } = useVisualizerStore();

  // Initialize device detection
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        const info = iosDetector.detectDevice();
        setDeviceInfo(info);
        
        // Initialize optimizations for the detected device
        iosDetector.initializeIOSOptimizations();
        
        setIsReady(true);
        
        errorHandler.info('Mobile demo initialized', {
          model: info.model,
          performance: info.performanceProfile,
          features: info.audioConstraints,
        });
      } catch (err) {
        errorHandler.error('Failed to initialize mobile demo', err as Error);
        setError('Failed to initialize mobile features');
      }
    };

    initializeDevice();
  }, []);

  // Handle errors
  const handleError = (error: Error) => {
    errorHandler.error('Mobile visualizer error', error);
    setError(error.message);
  };

  // Get page metadata
  const getPageMetadata = () => {
    const title = isIOS ? 'v1z3r - iPhone Visualizer' : 'v1z3r - Mobile Visualizer';
    const description = isIOS 
      ? 'AI-powered music visualizer optimized for iPhone with touch controls and WebGL effects'
      : 'AI-powered music visualizer optimized for mobile devices with responsive design';

    return { title, description };
  };

  const { title, description } = getPageMetadata();

  // Render device compatibility warning
  const renderCompatibilityWarning = () => {
    if (!deviceInfo) return null;

    if (deviceInfo.performanceProfile === 'low') {
      return (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-white p-2 text-sm text-center z-50">
          Limited performance detected. Some features may be disabled for better experience.
        </div>
      );
    }

    return null;
  };

  // Render error screen
  const renderErrorScreen = () => {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold mb-4">Mobile Demo Error</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  };

  // Render loading screen
  const renderLoadingScreen = () => {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Initializing Mobile Experience...</p>
          <p className="text-sm text-gray-400 mt-2">
            Detecting device capabilities
          </p>
        </div>
      </div>
    );
  };

  if (error) {
    return renderErrorScreen();
  }

  if (!isReady || !deviceInfo) {
    return renderLoadingScreen();
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        
        {/* Mobile-specific meta tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="v1z3r" />
        
        {/* Touch icons */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* iOS-specific styles */}
        <style jsx global>{`
          /* iOS-specific CSS */
          html {
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
          }
          
          body {
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
            position: fixed;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
          
          /* Safe area support */
          @supports (padding: max(0px)) {
            .safe-area-inset-top {
              padding-top: max(1rem, env(safe-area-inset-top));
            }
            .safe-area-inset-bottom {
              padding-bottom: max(1rem, env(safe-area-inset-bottom));
            }
            .safe-area-inset-left {
              padding-left: max(1rem, env(safe-area-inset-left));
            }
            .safe-area-inset-right {
              padding-right: max(1rem, env(safe-area-inset-right));
            }
          }
          
          /* Touch optimization */
          * {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
          }
          
          button, input, select, textarea {
            -webkit-user-select: auto;
            -khtml-user-select: auto;
            -moz-user-select: auto;
            -ms-user-select: auto;
            user-select: auto;
          }
          
          /* Disable zoom on inputs */
          input[type="color"],
          input[type="date"],
          input[type="datetime"],
          input[type="datetime-local"],
          input[type="email"],
          input[type="month"],
          input[type="number"],
          input[type="password"],
          input[type="search"],
          input[type="tel"],
          input[type="text"],
          input[type="time"],
          input[type="url"],
          input[type="week"],
          select,
          textarea {
            font-size: 16px;
          }
          
          /* Performance optimizations */
          .visualizer-container {
            will-change: transform;
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
        `}</style>
      </Head>

      <div className="visualizer-container">
        {renderCompatibilityWarning()}
        
        <MobileVisualizerLayout>
          <WebGPUVisualizer />
        </MobileVisualizerLayout>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const userAgent = context.req.headers['user-agent'] || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  
  return {
    props: {
      userAgent,
      isIOS,
    },
  };
};

export default MobileDemoPage;