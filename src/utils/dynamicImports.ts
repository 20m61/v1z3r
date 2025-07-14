/**
 * Dynamic Import Utilities with Enhanced Loading Strategies
 * Provides intelligent code splitting and progressive loading
 */

import React from 'react';
import { errorHandler } from './errorHandler';

export interface DynamicImportOptions {
  timeout?: number;
  retries?: number;
  fallback?: () => Promise<any>;
  preload?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

export interface LoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  error: Error | null;
  progress: number;
}

/**
 * Enhanced dynamic import with retry logic and error handling
 */
export async function dynamicImportWithRetry<T>(
  importFn: () => Promise<T>,
  options: DynamicImportOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 2,
    fallback
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Dynamic import timeout after ${timeout}ms`));
        }, timeout);
      });

      // Race between import and timeout
      const result = await Promise.race([
        importFn(),
        timeoutPromise
      ]);

      errorHandler.info('Dynamic import successful', {
        attempt: attempt + 1,
        totalAttempts: retries + 1
      });

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      errorHandler.warn(`Dynamic import attempt ${attempt + 1} failed`, lastError, {
        attempt: attempt + 1,
        totalAttempts: retries + 1,
        willRetry: attempt < retries
      });

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed, try fallback
  if (fallback) {
    try {
      errorHandler.info('Attempting fallback import');
      return await fallback();
    } catch (fallbackError) {
      errorHandler.error('Fallback import also failed', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
    }
  }

  throw lastError || new Error('Dynamic import failed');
}

/**
 * Progressive loading manager for heavy components
 */
export class ProgressiveLoader {
  private loadingStates = new Map<string, LoadingState>();
  private loadedModules = new Map<string, any>();
  private preloadQueue: Array<{ key: string; importFn: () => Promise<any>; priority: string }> = [];

  constructor() {
    // Start processing preload queue
    this.processPreloadQueue();
  }

  /**
   * Register a module for progressive loading
   */
  register<T>(
    key: string,
    importFn: () => Promise<T>,
    options: DynamicImportOptions = {}
  ): void {
    this.loadingStates.set(key, {
      isLoading: false,
      isLoaded: false,
      error: null,
      progress: 0
    });

    if (options.preload) {
      this.preloadQueue.push({
        key,
        importFn,
        priority: options.priority || 'normal'
      });
      
      // Sort by priority
      this.preloadQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      });
    }
  }

  /**
   * Load a module with progress tracking
   */
  async load<T>(key: string, importFn?: () => Promise<T>): Promise<T> {
    // Check if already loaded
    if (this.loadedModules.has(key)) {
      return this.loadedModules.get(key);
    }

    // Check if currently loading
    const state = this.loadingStates.get(key);
    if (state?.isLoading) {
      // Wait for existing load to complete
      return this.waitForLoad<T>(key);
    }

    if (!importFn) {
      throw new Error(`Import function not provided for module: ${key}`);
    }

    // Start loading
    this.updateLoadingState(key, {
      isLoading: true,
      isLoaded: false,
      error: null,
      progress: 0
    });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        const currentState = this.loadingStates.get(key);
        if (currentState && currentState.progress < 90) {
          this.updateLoadingState(key, {
            ...currentState,
            progress: Math.min(currentState.progress + 10, 90)
          });
        }
      }, 100);

      const loadedModule = await dynamicImportWithRetry(importFn, {
        timeout: 30000,
        retries: 2
      });

      clearInterval(progressInterval);

      // Cache the loaded module
      this.loadedModules.set(key, loadedModule);

      this.updateLoadingState(key, {
        isLoading: false,
        isLoaded: true,
        error: null,
        progress: 100
      });

      return loadedModule;

    } catch (error) {
      this.updateLoadingState(key, {
        isLoading: false,
        isLoaded: false,
        error: error instanceof Error ? error : new Error(String(error)),
        progress: 0
      });

      throw error;
    }
  }

  /**
   * Get loading state for a module
   */
  getLoadingState(key: string): LoadingState | null {
    return this.loadingStates.get(key) || null;
  }

  /**
   * Preload modules based on priority
   */
  private async processPreloadQueue(): Promise<void> {
    // Wait for initial page load
    if (typeof window !== 'undefined') {
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(void 0);
        } else {
          window.addEventListener('load', () => resolve(void 0), { once: true });
        }
      });

      // Process high priority items immediately
      const highPriority = this.preloadQueue.filter(item => item.priority === 'high');
      for (const item of highPriority) {
        this.preloadInBackground(item);
      }

      // Process normal priority items after a delay
      setTimeout(() => {
        const normalPriority = this.preloadQueue.filter(item => item.priority === 'normal');
        normalPriority.forEach(item => this.preloadInBackground(item));
      }, 2000);

      // Process low priority items when idle
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          const lowPriority = this.preloadQueue.filter(item => item.priority === 'low');
          lowPriority.forEach(item => this.preloadInBackground(item));
        });
      }
    }
  }

  private preloadInBackground(item: { key: string; importFn: () => Promise<any> }): void {
    this.load(item.key, item.importFn).catch(error => {
      errorHandler.warn(`Background preload failed for ${item.key}`, error);
    });
  }

  private waitForLoad<T>(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const checkState = () => {
        const state = this.loadingStates.get(key);
        if (!state) {
          reject(new Error(`Module ${key} not found`));
          return;
        }

        if (state.isLoaded) {
          resolve(this.loadedModules.get(key));
        } else if (state.error) {
          reject(state.error);
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();
    });
  }

  private updateLoadingState(key: string, newState: Partial<LoadingState>): void {
    const currentState = this.loadingStates.get(key) || {
      isLoading: false,
      isLoaded: false,
      error: null,
      progress: 0
    };

    this.loadingStates.set(key, { ...currentState, ...newState });
  }
}

// Global progressive loader instance
export const progressiveLoader = new ProgressiveLoader();

/**
 * HOC for dynamic component loading with loading state
 */
export function withDynamicLoading<P extends Record<string, any>>(
  key: string,
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  LoadingComponent?: React.ComponentType<{ progress: number }>,
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>
) {
  return function DynamicComponent(props: P) {
    const [state, setState] = React.useState<LoadingState>({
      isLoading: true,
      isLoaded: false,
      error: null,
      progress: 0
    });
    const [Component, setComponent] = React.useState<React.ComponentType<P> | null>(null);

    React.useEffect(() => {
      let mounted = true;

      const loadComponent = async () => {
        try {
          const loadedModule = await progressiveLoader.load(key, importFn);
          if (mounted) {
            setComponent(() => loadedModule.default);
            setState({
              isLoading: false,
              isLoaded: true,
              error: null,
              progress: 100
            });
          }
        } catch (error) {
          if (mounted) {
            setState({
              isLoading: false,
              isLoaded: false,
              error: error instanceof Error ? error : new Error(String(error)),
              progress: 0
            });
          }
        }
      };

      // Update state based on progressive loader
      const interval = setInterval(() => {
        if (mounted) {
          const loaderState = progressiveLoader.getLoadingState(key);
          if (loaderState) {
            setState(loaderState);
          }
        }
      }, 100);

      loadComponent();

      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }, []);

    if (state.error && ErrorComponent) {
      return React.createElement(ErrorComponent, {
        error: state.error,
        retry: () => {
          setState({
            isLoading: true,
            isLoaded: false,
            error: null,
            progress: 0
          });
          progressiveLoader.load(key, importFn);
        }
      });
    }

    if (state.isLoading && LoadingComponent) {
      return React.createElement(LoadingComponent, { progress: state.progress });
    }

    if (Component) {
      return React.createElement(Component, props);
    }

    return null;
  };
}

// React is now imported at the top of the file