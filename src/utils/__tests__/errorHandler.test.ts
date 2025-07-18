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
        expect.stringMatching(/\[ERROR\]/),
        expect.stringMatching(/Test error message/),
        expect.any(Error),
        expect.objectContaining({ user: 'test-user' })
      );
    });

    it('should log simple error', () => {
      const error = new Error('Simple test error');
      
      errorHandler.error('Simple test error', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\]/),
        expect.stringMatching(/Simple test error/),
        error,
        undefined
      );
    });

    it('should handle warnings', () => {
      errorHandler.warn('Test warning', { data: 'test' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\]/),
        expect.stringMatching(/Test warning/),
        expect.objectContaining({ data: 'test' })
      );
    });

    it('should handle info messages', () => {
      errorHandler.info('Test info', { data: 'test' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\]/),
        expect.stringMatching(/Test info/),
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

});