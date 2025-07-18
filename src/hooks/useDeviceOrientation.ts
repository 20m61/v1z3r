/**
 * Device Orientation and Viewport Hook
 * Handles orientation changes and viewport adjustments for iOS
 */

import { useState, useEffect, useCallback } from 'react';
import { iosDetector } from '@/utils/iosDetection';
import { errorHandler } from '@/utils/errorHandler';

export type OrientationType = 'portrait' | 'landscape' | 'portrait-secondary' | 'landscape-secondary';

export interface DeviceOrientationState {
  orientation: OrientationType;
  angle: number;
  isLandscape: boolean;
  isPortrait: boolean;
  viewport: {
    width: number;
    height: number;
    visualViewport: {
      width: number;
      height: number;
      scale: number;
      offsetLeft: number;
      offsetTop: number;
    };
  };
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  keyboardVisible: boolean;
  keyboardHeight: number;
}

export interface DeviceMotionState {
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  accelerationIncludingGravity: {
    x: number;
    y: number;
    z: number;
  };
  rotationRate: {
    alpha: number;
    beta: number;
    gamma: number;
  };
  interval: number;
  hasPermission: boolean;
  isSupported: boolean;
}

export const useDeviceOrientation = () => {
  const [orientationState, setOrientationState] = useState<DeviceOrientationState>({
    orientation: 'portrait',
    angle: 0,
    isLandscape: false,
    isPortrait: true,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      visualViewport: {
        width: window.visualViewport?.width || window.innerWidth,
        height: window.visualViewport?.height || window.innerHeight,
        scale: window.visualViewport?.scale || 1,
        offsetLeft: window.visualViewport?.offsetLeft || 0,
        offsetTop: window.visualViewport?.offsetTop || 0,
      },
    },
    safeArea: iosDetector.getSafeAreaInsets(),
    keyboardVisible: false,
    keyboardHeight: 0,
  });

  const [motionState, setMotionState] = useState<DeviceMotionState>({
    acceleration: { x: 0, y: 0, z: 0 },
    accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
    rotationRate: { alpha: 0, beta: 0, gamma: 0 },
    interval: 0,
    hasPermission: false,
    isSupported: 'DeviceMotionEvent' in window,
  });

  // Get orientation type from angle
  const getOrientationType = useCallback((angle: number): OrientationType => {
    if (angle >= -45 && angle < 45) return 'portrait';
    if (angle >= 45 && angle < 135) return 'landscape-secondary';
    if (angle >= 135 || angle < -135) return 'portrait-secondary';
    return 'landscape';
  }, []);

  // Update orientation state
  const updateOrientationState = useCallback(() => {
    const angle = (screen.orientation?.angle || (window as any).orientation) ?? 0;
    const orientation = getOrientationType(angle);
    const isLandscape = orientation.includes('landscape');
    const isPortrait = orientation.includes('portrait');

    // Visual viewport information
    const visualViewport = {
      width: window.visualViewport?.width || window.innerWidth,
      height: window.visualViewport?.height || window.innerHeight,
      scale: window.visualViewport?.scale || 1,
      offsetLeft: window.visualViewport?.offsetLeft || 0,
      offsetTop: window.visualViewport?.offsetTop || 0,
    };

    // Detect keyboard visibility (approximation)
    const keyboardHeight = window.innerHeight - visualViewport.height;
    const keyboardVisible = keyboardHeight > 100; // Threshold for keyboard detection

    setOrientationState(prev => ({
      ...prev,
      orientation,
      angle,
      isLandscape,
      isPortrait,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualViewport,
      },
      safeArea: iosDetector.getSafeAreaInsets(),
      keyboardVisible,
      keyboardHeight: keyboardVisible ? keyboardHeight : 0,
    }));
  }, [getOrientationType]);

  // Request device motion permission (iOS 13+)
  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (!motionState.isSupported) {
      return false;
    }

    try {
      // Check if permission is needed (iOS 13+)
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        const granted = permission === 'granted';
        
        setMotionState(prev => ({
          ...prev,
          hasPermission: granted,
        }));
        
        return granted;
      } else {
        // Permission not needed on older iOS or other platforms
        setMotionState(prev => ({
          ...prev,
          hasPermission: true,
        }));
        
        return true;
      }
    } catch (error) {
      errorHandler.error('Failed to request device motion permission', error as Error);
      return false;
    }
  }, [motionState.isSupported]);

  // Handle device motion events
  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    if (!motionState.hasPermission) return;

    setMotionState(prev => ({
      ...prev,
      acceleration: {
        x: event.acceleration?.x || 0,
        y: event.acceleration?.y || 0,
        z: event.acceleration?.z || 0,
      },
      accelerationIncludingGravity: {
        x: event.accelerationIncludingGravity?.x || 0,
        y: event.accelerationIncludingGravity?.y || 0,
        z: event.accelerationIncludingGravity?.z || 0,
      },
      rotationRate: {
        alpha: event.rotationRate?.alpha || 0,
        beta: event.rotationRate?.beta || 0,
        gamma: event.rotationRate?.gamma || 0,
      },
      interval: event.interval || 0,
    }));
  }, [motionState.hasPermission]);

  // Setup event listeners
  useEffect(() => {
    updateOrientationState();

    // Orientation change listeners
    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated
      setTimeout(updateOrientationState, 100);
    };

    const handleResize = () => {
      updateOrientationState();
    };

    const handleVisualViewportChange = () => {
      updateOrientationState();
    };

    // Add event listeners
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    // Device motion listeners
    if (motionState.isSupported && motionState.hasPermission) {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      }
      
      if (motionState.isSupported) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, [updateOrientationState, handleDeviceMotion, motionState.isSupported, motionState.hasPermission]);

  // Lock orientation (if supported)
  const lockOrientation = useCallback(async (orientation: OrientationType): Promise<boolean> => {
    if (!screen.orientation || !('lock' in screen.orientation)) {
      return false;
    }

    try {
      await (screen.orientation as any).lock(orientation);
      return true;
    } catch (error) {
      errorHandler.warn('Failed to lock orientation', error as Error);
      return false;
    }
  }, []);

  // Unlock orientation
  const unlockOrientation = useCallback(() => {
    if (screen.orientation && 'unlock' in screen.orientation) {
      (screen.orientation as any).unlock();
    }
  }, []);

  // Get CSS transform for orientation compensation
  const getOrientationTransform = useCallback((): string => {
    const { angle } = orientationState;
    
    switch (angle) {
      case 90:
        return 'rotate(-90deg)';
      case -90:
        return 'rotate(90deg)';
      case 180:
        return 'rotate(180deg)';
      default:
        return 'rotate(0deg)';
    }
  }, [orientationState]);

  // Get CSS variables for safe area and viewport
  const getCSSVariables = useCallback((): Record<string, string> => {
    const { safeArea, viewport } = orientationState;
    
    return {
      '--safe-area-top': `${safeArea.top}px`,
      '--safe-area-bottom': `${safeArea.bottom}px`,
      '--safe-area-left': `${safeArea.left}px`,
      '--safe-area-right': `${safeArea.right}px`,
      '--viewport-width': `${viewport.width}px`,
      '--viewport-height': `${viewport.height}px`,
      '--visual-viewport-width': `${viewport.visualViewport.width}px`,
      '--visual-viewport-height': `${viewport.visualViewport.height}px`,
      '--keyboard-height': `${orientationState.keyboardHeight}px`,
    };
  }, [orientationState]);

  return {
    orientation: orientationState,
    motion: motionState,
    requestMotionPermission,
    lockOrientation,
    unlockOrientation,
    getOrientationTransform,
    getCSSVariables,
  };
};

export default useDeviceOrientation;