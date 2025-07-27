/**
 * Tests for Service Worker registration utilities
 */

import {
  registerServiceWorker,
  unregisterServiceWorker,
  clearServiceWorkerCache
} from '../swRegistration';

describe('Service Worker Registration', () => {
  const originalWindow = global.window;
  const originalNavigator = global.navigator;
  const originalConsole = global.console;
  
  let mockRegistration: any;
  let mockServiceWorker: any;
  let mockNavigator: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock service worker registration
    mockRegistration = {
      addEventListener: jest.fn(),
      update: jest.fn(),
      installing: null,
      unregister: jest.fn().mockResolvedValue(true),
    };
    
    // Mock service worker
    mockServiceWorker = {
      register: jest.fn().mockResolvedValue(mockRegistration),
      getRegistrations: jest.fn().mockResolvedValue([mockRegistration]),
      controller: null,
    };
    
    // Mock navigator
    mockNavigator = {
      serviceWorker: mockServiceWorker,
    };
    
    // Set up global objects using delete and assignment
    delete (global as any).navigator;
    (global as any).navigator = mockNavigator;
    
    delete (global as any).window;
    (global as any).window = {
      confirm: jest.fn(),
      location: {
        reload: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    // Restore globals
    (global as any).window = originalWindow;
    (global as any).navigator = originalNavigator;
  });

  describe('registerServiceWorker', () => {
    it('should not register if window is undefined', async () => {
      (global as any).window = undefined;

      await registerServiceWorker();

      expect(mockServiceWorker.register).not.toHaveBeenCalled();
    });

    it('should not register if service worker is not supported', async () => {
      mockNavigator.serviceWorker = undefined;

      await registerServiceWorker();

      expect(mockServiceWorker.register).not.toHaveBeenCalled();
    });

    it('should not register in non-production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await registerServiceWorker();

      expect(mockServiceWorker.register).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should register service worker in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await registerServiceWorker();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw-enhanced.js', {
        scope: '/',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Service Worker registered successfully');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle registration errors', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValueOnce(error);

      await registerServiceWorker();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Service Worker registration failed:', error);

      process.env.NODE_ENV = originalEnv;
    });

    it('should set up update listener', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await registerServiceWorker();

      expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
        'updatefound',
        expect.any(Function)
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle service worker updates', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const mockNewWorker = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        state: 'installed',
      };
      
      mockRegistration.installing = mockNewWorker;
      mockNavigator.serviceWorker.controller = {};
      (global.window as any).confirm.mockReturnValue(true);

      await registerServiceWorker();

      // Get the updatefound callback
      const updatefoundCallback = mockRegistration.addEventListener.mock.calls
        .find(call => call[0] === 'updatefound')[1];
      
      // Trigger updatefound
      updatefoundCallback();

      // Get the statechange callback
      const statechangeCallback = mockNewWorker.addEventListener.mock.calls
        .find(call => call[0] === 'statechange')[1];
      
      // Trigger statechange
      statechangeCallback();

      expect((global.window as any).confirm).toHaveBeenCalledWith(
        '新しいバージョンが利用可能です。更新しますか？'
      );
      expect(mockNewWorker.postMessage).toHaveBeenCalledWith({ action: 'skipWaiting' });
      expect((global.window as any).location.reload).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not update if user declines', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const mockNewWorker = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        state: 'installed',
      };
      
      mockRegistration.installing = mockNewWorker;
      mockNavigator.serviceWorker.controller = {};
      (global.window as any).confirm.mockReturnValue(false);

      await registerServiceWorker();

      const updatefoundCallback = mockRegistration.addEventListener.mock.calls
        .find(call => call[0] === 'updatefound')[1];
      updatefoundCallback();

      const statechangeCallback = mockNewWorker.addEventListener.mock.calls
        .find(call => call[0] === 'statechange')[1];
      statechangeCallback();

      expect(mockNewWorker.postMessage).not.toHaveBeenCalled();
      expect((global.window as any).location.reload).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should set up periodic updates', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await registerServiceWorker();

      // Fast forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);

      expect(mockRegistration.update).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe.skip('unregisterServiceWorker', () => {
    it('should not unregister if window is undefined', async () => {
      (global as any).window = undefined;

      await unregisterServiceWorker();

      expect(mockServiceWorker.getRegistrations).not.toHaveBeenCalled();
    });

    it('should not unregister if service worker is not supported', async () => {
      mockNavigator.serviceWorker = undefined;

      await unregisterServiceWorker();

      expect(mockServiceWorker.getRegistrations).not.toHaveBeenCalled();
    });

    it('should unregister all service workers', async () => {
      const mockRegistration2 = {
        unregister: jest.fn().mockResolvedValue(true),
      };
      
      mockServiceWorker.getRegistrations.mockResolvedValueOnce([
        mockRegistration,
        mockRegistration2,
      ]);

      await unregisterServiceWorker();

      expect(mockServiceWorker.getRegistrations).toHaveBeenCalled();
      expect(mockRegistration.unregister).toHaveBeenCalled();
      expect(mockRegistration2.unregister).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Service Worker unregistered successfully');
    });

    it('should handle unregistration errors', async () => {
      const error = new Error('Unregistration failed');
      mockServiceWorker.getRegistrations.mockRejectedValueOnce(error);

      await unregisterServiceWorker();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Service Worker unregistration failed:', error);
    });
  });

  describe.skip('clearServiceWorkerCache', () => {
    it('should not clear cache if window is undefined', async () => {
      (global as any).window = undefined;

      await clearServiceWorkerCache();

      // Should not throw or call any methods
    });

    it('should not clear cache if service worker is not supported', async () => {
      mockNavigator.serviceWorker = undefined;

      await clearServiceWorkerCache();

      // Should not throw or call any methods
    });

    it('should not clear cache if no controller exists', async () => {
      mockNavigator.serviceWorker.controller = null;

      await clearServiceWorkerCache();

      // Should not throw or call any methods
    });

    it('should send clear cache message to controller', async () => {
      const mockController = {
        postMessage: jest.fn(),
      };
      
      mockNavigator.serviceWorker.controller = mockController;

      await clearServiceWorkerCache();

      expect(mockController.postMessage).toHaveBeenCalledWith({
        action: 'clearCache'
      });
    });
  });
});