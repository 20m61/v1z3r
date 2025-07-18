/**
 * Touch-Optimized UI Controls for Mobile/iOS
 * Provides intuitive touch interactions for visual parameters
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useVisualizerStore } from '@/store/visualizerStore';
import { iosDetector } from '@/utils/iosDetection';

interface TouchControlsProps {
  className?: string;
  onParameterChange?: (param: string, value: number) => void;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  timestamp: number;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  className = '',
  onParameterChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const {
    sensitivity,
    setSensitivity,
    colorTheme,
    setColorTheme,
    currentEffectType,
    setEffectType,
  } = useVisualizerStore();

  const deviceInfo = iosDetector.detectDevice();
  const safeArea = iosDetector.getSafeAreaInsets();

  // Update visualizer parameters based on touch input
  const handleParameterUpdate = useCallback((points: TouchPoint[]) => {
    if (points.length === 0) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    // Single touch - control sensitivity and color hue
    if (points.length === 1) {
      const point = points[0];
      const normalizedX = point.x / width;
      const normalizedY = 1 - (point.y / height); // Invert Y for intuitive control
      
      // Update sensitivity (vertical movement)
      const newSensitivity = Math.max(0.1, Math.min(3.0, normalizedY * 3.0));
      setSensitivity(newSensitivity);
      
      // Update color hue (horizontal movement)
      const hue = Math.floor(normalizedX * 360);
      const newColor = `hsl(${hue}, 70%, 50%)`;
      setColorTheme(newColor);
      
      if (onParameterChange) {
        onParameterChange('sensitivity', newSensitivity);
        onParameterChange('hue', hue);
      }
    }
    
    // Multi-touch - advanced controls
    else if (points.length >= 2) {
      const point1 = points[0];
      const point2 = points[1];
      
      // Calculate distance between touches (pinch/zoom)
      const distance = Math.sqrt(
        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
      );
      
      // Normalize distance to 0-1 range
      const maxDistance = Math.sqrt(width * width + height * height);
      const normalizedDistance = distance / maxDistance;
      
      // Use distance for sensitivity control
      const newSensitivity = Math.max(0.1, Math.min(3.0, normalizedDistance * 4.0));
      setSensitivity(newSensitivity);
      
      // Calculate center point for color control
      const centerX = (point1.x + point2.x) / 2;
      const centerY = (point1.y + point2.y) / 2;
      const normalizedCenterX = centerX / width;
      const normalizedCenterY = 1 - (centerY / height);
      
      // Update color based on center position
      const hue = Math.floor(normalizedCenterX * 360);
      const saturation = Math.floor(normalizedCenterY * 100);
      const newColor = `hsl(${hue}, ${saturation}%, 50%)`;
      setColorTheme(newColor);
      
      if (onParameterChange) {
        onParameterChange('sensitivity', newSensitivity);
        onParameterChange('hue', hue);
        onParameterChange('saturation', saturation);
      }
    }
  }, [dimensions, onParameterChange, setSensitivity, setColorTheme]);

  // Initialize touch area dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateDimensions, 100);
    });

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsActive(true);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const newTouchPoints: TouchPoint[] = [];
    
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      newTouchPoints.push({
        id: touch.identifier,
        x,
        y,
        startX: x,
        startY: y,
        timestamp: Date.now(),
      });
    }
    
    setTouchPoints(newTouchPoints);
    handleParameterUpdate(newTouchPoints);
  }, [handleParameterUpdate]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updatedTouchPoints: TouchPoint[] = [];
    
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const existingPoint = touchPoints.find(p => p.id === touch.identifier);
      
      if (existingPoint) {
        updatedTouchPoints.push({
          ...existingPoint,
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }
    }
    
    setTouchPoints(updatedTouchPoints);
    handleParameterUpdate(updatedTouchPoints);
  }, [touchPoints, handleParameterUpdate]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const remainingPoints = touchPoints.filter(point => 
      Array.from(e.touches).some(touch => touch.identifier === point.id)
    );
    
    setTouchPoints(remainingPoints);
    
    if (remainingPoints.length === 0) {
      setIsActive(false);
    }
  }, [touchPoints]);

  // Handle gesture recognition
  const handleGesture = useCallback((e: React.TouchEvent) => {
    // Implement swipe detection for effect switching
    if (touchPoints.length === 1) {
      const point = touchPoints[0];
      const deltaX = point.x - point.startX;
      const deltaY = point.y - point.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > 50) { // Minimum swipe distance
        const angle = Math.atan2(deltaY, deltaX);
        const direction = Math.abs(angle) < Math.PI / 4 ? 'horizontal' : 'vertical';
        
        if (direction === 'horizontal') {
          // Horizontal swipe - change effect
          if (deltaX > 0) {
            // Swipe right - next effect
            const effects = ['particles', 'waveform', 'spectrum', 'lyrics'];
            const currentIndex = effects.indexOf(currentEffectType);
            const nextIndex = (currentIndex + 1) % effects.length;
            setEffectType(effects[nextIndex] as any);
          } else {
            // Swipe left - previous effect
            const effects = ['particles', 'waveform', 'spectrum', 'lyrics'];
            const currentIndex = effects.indexOf(currentEffectType);
            const prevIndex = (currentIndex - 1 + effects.length) % effects.length;
            setEffectType(effects[prevIndex] as any);
          }
        }
      }
    }
  }, [touchPoints, currentEffectType, setEffectType]);

  // Render touch feedback
  const renderTouchFeedback = () => {
    return touchPoints.map((point, index) => (
      <div
        key={point.id}
        className="absolute pointer-events-none"
        style={{
          left: point.x - 20,
          top: point.y - 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          border: '2px solid rgba(255, 255, 255, 0.8)',
          transform: `scale(${isActive ? 1.2 : 1})`,
          transition: 'transform 0.2s ease',
        }}
      />
    ));
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full touch-none select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
        paddingLeft: safeArea.left,
        paddingRight: safeArea.right,
      }}
    >
      {/* Touch feedback */}
      {renderTouchFeedback()}
      
      {/* Usage instructions */}
      {!isActive && touchPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/60 text-sm">
            <div className="mb-2">🎨 Touch to control visuals</div>
            <div className="text-xs">
              Single touch: Sensitivity & Color<br />
              Multi-touch: Advanced controls<br />
              Swipe: Change effects
            </div>
          </div>
        </div>
      )}
      
      {/* Performance indicator */}
      {deviceInfo.performanceProfile === 'low' && (
        <div className="absolute top-4 left-4 bg-yellow-500/80 text-black px-2 py-1 rounded text-xs">
          Performance Mode: {deviceInfo.performanceProfile}
        </div>
      )}
    </div>
  );
};

export default TouchControls;