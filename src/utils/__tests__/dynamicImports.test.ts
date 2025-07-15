/**
 * Tests for dynamic imports utility
 */

import { loadModule, preloadModules, clearCache, getLoadingProgress } from '../dynamicImports';

// Mock dynamic imports
const mockModule = { default: { test: 'module' } };
const failingModule = () => Promise.reject(new Error('Failed to load'));

jest.mock('@vj-app/visual-renderer', () => mockModule, { virtual: true });
jest.mock('@vj-app/sync-core', () => mockModule, { virtual: true });
jest.mock('@vj-app/preset-storage', () => mockModule, { virtual: true });
jest.mock('@vj-app/failing-module', () => ({ default: failingModule }), { virtual: true });

describe('dynamicImports', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearCache();
  });

  describe('loadModule', () => {
    it('loads a module successfully', async () => {
      const loadedModule = await loadModule('visual-renderer');
      expect(loadedModule).toEqual(mockModule);
    });

    it('caches loaded modules', async () => {
      const module1 = await loadModule('visual-renderer');
      const module2 = await loadModule('visual-renderer');
      
      expect(module1).toBe(module2); // Same reference
    });

    it('tracks loading progress', async () => {
      const progressCallback = jest.fn();
      
      await loadModule('sync-core', {
        onProgress: progressCallback,
      });
      
      // Should have been called with progress updates
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        percent: expect.any(Number),
        loaded: expect.any(Boolean),
      }));
    });

    it('retries on failure', async () => {
      let attempts = 0;
      const retryModule = jest.fn(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Retry test'));
        }
        return Promise.resolve(mockModule);
      });
      
      jest.doMock('@vj-app/retry-module', () => ({ default: retryModule }), { virtual: true });
      
      const loadedModule = await loadModule('retry-module', { retries: 2 });
      expect(loadedModule).toEqual(mockModule);
      expect(retryModule).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries', async () => {
      await expect(
        loadModule('failing-module', { retries: 2 })
      ).rejects.toThrow('Failed to load module after 3 attempts');
    });

    it('respects timeout option', async () => {
      const slowModule = () => new Promise((resolve) => {
        setTimeout(() => resolve(mockModule), 200);
      });
      
      jest.doMock('@vj-app/slow-module', () => ({ default: slowModule }), { virtual: true });
      
      await expect(
        loadModule('slow-module', { timeout: 100 })
      ).rejects.toThrow('timeout');
    });
  });

  describe('preloadModules', () => {
    it('preloads multiple modules', async () => {
      const modules = await preloadModules(['visual-renderer', 'sync-core']);
      
      expect(modules).toHaveLength(2);
      expect(modules[0]).toEqual(mockModule);
      expect(modules[1]).toEqual(mockModule);
    });

    it('continues loading even if one fails', async () => {
      const modules = await preloadModules([
        'visual-renderer',
        'failing-module',
        'sync-core',
      ]);
      
      expect(modules).toHaveLength(3);
      expect(modules[0]).toEqual(mockModule);
      expect(modules[1]).toBeNull(); // Failed module
      expect(modules[2]).toEqual(mockModule);
    });

    it('reports overall progress', async () => {
      const progressCallback = jest.fn();
      
      await preloadModules(
        ['visual-renderer', 'sync-core', 'preset-storage'],
        { onProgress: progressCallback }
      );
      
      // Should report progress for each module
      const progressCalls = progressCallback.mock.calls;
      const lastCall = progressCalls[progressCalls.length - 1];
      
      expect(lastCall[0]).toEqual({
        total: 3,
        loaded: 3,
        failed: 0,
        percent: 100,
      });
    });
  });

  describe('getLoadingProgress', () => {
    it('returns current loading progress', async () => {
      const loadPromise = loadModule('visual-renderer');
      
      // Check progress during loading
      const progress = getLoadingProgress();
      expect(progress).toEqual(expect.objectContaining({
        'visual-renderer': expect.objectContaining({
          status: expect.stringMatching(/loading|loaded/),
          progress: expect.any(Number),
        }),
      }));
      
      await loadPromise;
      
      // Check progress after loading
      const finalProgress = getLoadingProgress();
      expect(finalProgress['visual-renderer'].status).toBe('loaded');
      expect(finalProgress['visual-renderer'].progress).toBe(100);
    });
  });

  describe('clearCache', () => {
    it('clears module cache', async () => {
      // Load a module
      const module1 = await loadModule('visual-renderer');
      expect(module1).toEqual(mockModule);
      
      // Clear cache
      clearCache();
      
      // Loading progress should be empty
      const progress = getLoadingProgress();
      expect(Object.keys(progress)).toHaveLength(0);
    });

    it('allows reloading after cache clear', async () => {
      await loadModule('visual-renderer');
      clearCache();
      
      // Should be able to load again
      const reloadedModule = await loadModule('visual-renderer');
      expect(reloadedModule).toEqual(mockModule);
    });
  });

  describe('error handling', () => {
    it('provides meaningful error messages', async () => {
      await expect(
        loadModule('non-existent-module')
      ).rejects.toThrow(/Cannot find module|Failed to load/);
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      jest.doMock('@vj-app/network-fail', () => {
        throw networkError;
      }, { virtual: true });
      
      await expect(
        loadModule('network-fail')
      ).rejects.toThrow(/Network error|Failed to load/);
    });
  });
});