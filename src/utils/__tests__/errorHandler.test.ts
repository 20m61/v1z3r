import { errorHandler, LogLevel, ErrorCategory } from '../errorHandler';

describe('ErrorHandler', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('error logging', () => {
    it('should log error with ErrorInfo object', () => {
      const errorInfo = {
        category: ErrorCategory.AUDIO,
        level: LogLevel.ERROR,
        message: 'Test error message',
        error: new Error('Test error'),
        context: { user: 'test-user' }
      };
      
      errorHandler.logError(errorInfo);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*\[audio\].*Test error message/),
        expect.objectContaining({ user: 'test-user' }),
        expect.objectContaining({ name: 'Error', message: 'Test error' })
      );
    });

    it('should log simple error', () => {
      const error = new Error('Simple test error');
      
      errorHandler.error('Simple test error', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*\[unknown\].*Simple test error/),
        undefined,
        expect.objectContaining({ name: 'Error', message: 'Simple test error' })
      );
    });

    it('should handle warnings', () => {
      errorHandler.warn('Test warning', { data: 'test' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\].*\[unknown\].*Test warning/),
        undefined,
        expect.objectContaining({ data: 'test' })
      );
    });

    it('should handle info messages', () => {
      errorHandler.info('Test info', { data: 'test' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\].*\[unknown\].*Test info/),
        expect.objectContaining({ data: 'test' })
      );
    });
  });


  describe('basic functionality', () => {
    it('should exist and have basic methods', () => {
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler.error).toBe('function');
      expect(typeof errorHandler.warn).toBe('function');
      expect(typeof errorHandler.info).toBe('function');
      expect(typeof errorHandler.logError).toBe('function');
    });
  });

  describe('error categorization', () => {
    it('should handle audio category errors', () => {
      const audioError = {
        category: ErrorCategory.AUDIO,
        level: LogLevel.ERROR,
        message: 'Audio device not found',
        error: new Error('AudioContext failed')
      };
      
      errorHandler.logError(audioError);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*\[audio\].*Audio device not found/),
        undefined,
        expect.objectContaining({ name: 'Error', message: 'AudioContext failed' })
      );
    });

    it('should handle visual category errors', () => {
      const visualError = {
        category: ErrorCategory.VISUAL,
        level: LogLevel.ERROR,
        message: 'WebGL context lost',
        error: new Error('WebGL error')
      };
      
      errorHandler.logError(visualError);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*\[visual\].*WebGL context lost/),
        undefined,
        expect.objectContaining({ name: 'Error', message: 'WebGL error' })
      );
    });

    it('should handle network category errors', () => {
      const networkError = {
        category: ErrorCategory.NETWORK,
        level: LogLevel.ERROR,
        message: 'Connection failed',
        error: new Error('Failed to fetch')
      };
      
      errorHandler.logError(networkError);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\].*\[network\].*Connection failed/),
        undefined,
        expect.objectContaining({ name: 'Error', message: 'Failed to fetch' })
      );
    });
  });

  describe('log levels', () => {
    it('should handle different log levels appropriately', () => {
      // Test WARN level
      const warningInfo = {
        category: ErrorCategory.PERFORMANCE,
        level: LogLevel.WARN,
        message: 'High memory usage detected'
      };
      
      errorHandler.logError(warningInfo);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\].*\[performance\].*High memory usage detected/),
        undefined,
        undefined
      );
    });

    it('should handle INFO level messages', () => {
      errorHandler.info('Application started', { version: '1.0.0' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\]/),
        expect.objectContaining({ version: '1.0.0' })
      );
    });
  });

});