/**
 * PWA Install Prompt for iOS
 * Provides installation guidance for iPhone users
 */

import React, { useState, useEffect } from 'react';
import { iosDetector } from '@/utils/iosDetection';

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss,
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const deviceInfo = iosDetector.detectDevice();
    
    // Check if already installed as PWA
    const isPWA = deviceInfo.isPWA;
    setIsInstalled(isPWA);
    
    // Check if installation is possible
    const canInstallPWA = deviceInfo.isIOS && 
                         deviceInfo.isSafari && 
                         !isPWA &&
                         iosDetector.supportsFeature('pwa-install');
    
    setCanInstall(canInstallPWA);
    
    // Show prompt if not installed and can install
    if (canInstallPWA && !localStorage.getItem('pwa-prompt-dismissed')) {
      // Delay showing prompt to avoid interrupting initial experience
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }
  }, []);

  const handleInstall = () => {
    if (onInstall) {
      onInstall();
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    setShowPrompt(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleNotNow = () => {
    setShowPrompt(false);
  };

  if (isInstalled || !canInstall || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
        {/* App Icon */}
        <div className="mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Add v1z3r to Home Screen
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          Install v1z3r as an app for the best experience with offline access and full-screen visuals.
        </p>

        {/* Installation Steps */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div className="text-left">
                Tap the <strong>Share</strong> button at the bottom of Safari
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div className="text-left">
                Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div className="text-left">
                Tap <strong>&quot;Add&quot;</strong> in the top right corner
              </div>
            </div>
          </div>
        </div>

        {/* Share Icon Visual Guide */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span className="text-sm font-medium text-blue-600">Share Button</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleInstall}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Show Me How
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={handleNotNow}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Not Now
            </button>
            
            <button
              onClick={handleDismiss}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Don&apos;t Ask Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;