/**
 * Advanced Features Error Handler
 * Comprehensive error handling for Phase 7 advanced features
 */

import { errorHandler } from './errorHandler';

export interface FeatureError {
  feature: string;
  message: string;
  error: Error | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userMessage?: string;
  recoveryAction?: () => void;
}

export class AdvancedFeaturesErrorHandler {
  private static instance: AdvancedFeaturesErrorHandler;
  private errorLog: FeatureError[] = [];
  private maxLogSize = 100;

  private constructor() {}

  static getInstance(): AdvancedFeaturesErrorHandler {
    if (!AdvancedFeaturesErrorHandler.instance) {
      AdvancedFeaturesErrorHandler.instance = new AdvancedFeaturesErrorHandler();
    }
    return AdvancedFeaturesErrorHandler.instance;
  }

  /**
   * Handle WebGPU related errors
   */
  handleWebGPUError(error: Error, context: string): FeatureError {
    const featureError: FeatureError = {
      feature: 'WebGPU',
      message: `WebGPU error in ${context}: ${error.message}`,
      error,
      severity: 'high',
      userMessage: 'WebGPU rendering encountered an issue. Falling back to WebGL.',
      recoveryAction: () => {
        // Fallback to WebGL
        errorHandler.info('Falling back to WebGL rendering');
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle MIDI controller errors
   */
  handleMIDIError(error: Error, context: string): FeatureError {
    const featureError: FeatureError = {
      feature: 'MIDI',
      message: `MIDI controller error in ${context}: ${error.message}`,
      error,
      severity: 'medium',
      userMessage: 'MIDI controller is not available. Please check your browser support and device connection.',
      recoveryAction: () => {
        // Disable MIDI features gracefully
        errorHandler.info('MIDI features disabled due to error');
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle NDI streaming errors
   */
  handleNDIError(error: Error, context: string): FeatureError {
    const featureError: FeatureError = {
      feature: 'NDI',
      message: `NDI streaming error in ${context}: ${error.message}`,
      error,
      severity: 'medium',
      userMessage: 'NDI streaming is not available. Please check your network connection and browser support.',
      recoveryAction: () => {
        // Disable NDI streaming
        errorHandler.info('NDI streaming disabled due to error');
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle AI Style Transfer errors
   */
  handleAIError(error: Error, context: string): FeatureError {
    const featureError: FeatureError = {
      feature: 'AI Style Transfer',
      message: `AI processing error in ${context}: ${error.message}`,
      error,
      severity: 'medium',
      userMessage: 'AI style transfer is not available. Using fallback CSS filters.',
      recoveryAction: () => {
        // Fallback to CSS filters
        errorHandler.info('Using CSS filter fallback for style transfer');
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle 3D Scene manipulation errors
   */
  handleSceneError(error: Error, context: string): FeatureError {
    const featureError: FeatureError = {
      feature: '3D Scene',
      message: `3D scene error in ${context}: ${error.message}`,
      error,
      severity: 'medium',
      userMessage: '3D scene manipulation encountered an issue. Some features may be limited.',
      recoveryAction: () => {
        // Reset scene to default state
        errorHandler.info('Resetting 3D scene to default state');
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle browser compatibility errors
   */
  handleCompatibilityError(feature: string, requiredAPI: string): FeatureError {
    const featureError: FeatureError = {
      feature,
      message: `Browser compatibility issue: ${requiredAPI} not supported`,
      error: null,
      severity: 'high',
      userMessage: `Your browser does not support ${requiredAPI}. Please use a modern browser like Chrome or Edge.`,
      recoveryAction: () => {
        // Disable feature and show upgrade message
        errorHandler.info(`Feature ${feature} disabled due to browser compatibility`);
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Handle performance issues
   */
  handlePerformanceError(feature: string, metric: string, value: number, threshold: number): FeatureError {
    const featureError: FeatureError = {
      feature,
      message: `Performance issue: ${metric} (${value}) exceeds threshold (${threshold})`,
      error: null,
      severity: 'low',
      userMessage: `${feature} performance is below optimal. Consider reducing quality settings.`,
      recoveryAction: () => {
        // Reduce quality settings
        errorHandler.info(`Reducing quality settings for ${feature}`);
      }
    };

    this.logError(featureError);
    return featureError;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(feature: string): string {
    const recentErrors = this.errorLog.filter(e => e.feature === feature);
    if (recentErrors.length === 0) return '';

    const latestError = recentErrors[recentErrors.length - 1];
    return latestError.userMessage || 'An unexpected error occurred.';
  }

  /**
   * Execute recovery action for a feature
   */
  executeRecovery(feature: string): void {
    const recentErrors = this.errorLog.filter(e => e.feature === feature);
    if (recentErrors.length === 0) return;

    const latestError = recentErrors[recentErrors.length - 1];
    if (latestError.recoveryAction) {
      try {
        latestError.recoveryAction();
      } catch (recoveryError) {
        errorHandler.error(`Recovery action failed for ${feature}`, recoveryError as Error);
      }
    }
  }

  /**
   * Check if feature has critical errors
   */
  hasFeatureCriticalErrors(feature: string): boolean {
    const recentErrors = this.errorLog.filter(e => 
      e.feature === feature && 
      e.severity === 'critical' &&
      Date.now() - this.getErrorTimestamp(e) < 300000 // 5 minutes
    );
    return recentErrors.length > 0;
  }

  /**
   * Get feature health status
   */
  getFeatureHealth(feature: string): 'healthy' | 'degraded' | 'unavailable' {
    const recentErrors = this.errorLog.filter(e => 
      e.feature === feature &&
      Date.now() - this.getErrorTimestamp(e) < 600000 // 10 minutes
    );

    if (recentErrors.length === 0) return 'healthy';

    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    const highErrors = recentErrors.filter(e => e.severity === 'high');

    if (criticalErrors.length > 0) return 'unavailable';
    if (highErrors.length > 2) return 'unavailable';
    if (recentErrors.length > 5) return 'degraded';

    return 'healthy';
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { [feature: string]: number } {
    const stats: { [feature: string]: number } = {};
    
    this.errorLog.forEach(error => {
      if (!stats[error.feature]) {
        stats[error.feature] = 0;
      }
      stats[error.feature]++;
    });

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): FeatureError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Private method to log errors
   */
  private logError(featureError: FeatureError): void {
    // Add timestamp
    (featureError as any).timestamp = Date.now();
    
    // Add to log
    this.errorLog.push(featureError);
    
    // Trim log if needed
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    // Log to main error handler
    switch (featureError.severity) {
      case 'critical':
        errorHandler.error(featureError.message, featureError.error || undefined);
        break;
      case 'high':
        errorHandler.error(featureError.message, featureError.error || undefined);
        break;
      case 'medium':
        errorHandler.warn(featureError.message, featureError.error || undefined);
        break;
      case 'low':
        errorHandler.info(featureError.message);
        break;
    }
  }

  /**
   * Get error timestamp
   */
  private getErrorTimestamp(error: FeatureError): number {
    return (error as any).timestamp || 0;
  }
}

// Export singleton instance
export const advancedFeaturesErrorHandler = AdvancedFeaturesErrorHandler.getInstance();