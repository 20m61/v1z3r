/**
 * Logger utility for controlling console output based on environment and device
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private logLevel: LogLevel;
  private isMobile: boolean;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Set log level based on environment and device
    if (this.isMobile) {
      // Minimal logging on mobile to improve performance
      this.logLevel = LogLevel.ERROR;
    } else if (this.isDevelopment) {
      // Full logging in development
      this.logLevel = LogLevel.DEBUG;
    } else {
      // Limited logging in production
      this.logLevel = LogLevel.WARN;
    }
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  error(message: string, ...args: any[]) {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(message, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log('[DEBUG]', message, ...args);
    }
  }

  // Specialized loggers for specific modules
  webgpu(message: string, ...args: any[]) {
    // WebGPU warnings are expected on mobile, suppress them
    if (!this.isMobile) {
      this.warn(`[WebGPU] ${message}`, ...args);
    }
  }

  audio(message: string, ...args: any[]) {
    // Audio issues are common on mobile, only log errors
    if (this.isMobile && this.logLevel >= LogLevel.ERROR) {
      console.error(`[Audio] ${message}`, ...args);
    } else {
      this.info(`[Audio] ${message}`, ...args);
    }
  }

  performance(message: string, ...args: any[]) {
    // Performance logs only in development
    if (this.isDevelopment) {
      this.debug(`[Performance] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();