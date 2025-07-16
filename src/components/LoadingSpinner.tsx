/**
 * Loading Spinner Component
 * Simple loading indicator for async components
 */

import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-black">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-400 border-opacity-20 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );
}