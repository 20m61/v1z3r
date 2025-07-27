/**
 * Common mock setup utilities for testing
 */

// Store original console methods
export const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
};

// Common error messages to suppress
export const suppressedErrors = [
  'Warning: ReactDOM.render',
  'Not implemented: HTMLCanvasElement',
  'Error: Could not parse CSS stylesheet',
  'WebGPU is not supported',
  'WebGPU not available',
  'Failed to create WebGL context',
  'THREE.',
  'WebGL',
  'GPU',
];

export const suppressedWarnings = [
  'THREE.',
  'WebGL',
  'GPU',
  'react-icons',
];

/**
 * Setup console mocks with proper filtering
 */
export function setupConsoleMocks() {
  console.error = jest.fn((...args: any[]) => {
    const message = args[0]?.toString() || '';
    const shouldSuppress = suppressedErrors.some(error => message.includes(error));
    
    if (!shouldSuppress) {
      originalConsole.error.apply(console, args);
    }
  });
  
  console.warn = jest.fn((...args: any[]) => {
    const message = args[0]?.toString() || '';
    const shouldSuppress = suppressedWarnings.some(warning => message.includes(warning));
    
    if (!shouldSuppress) {
      originalConsole.warn.apply(console, args);
    }
  });
}

/**
 * Restore original console methods
 */
export function restoreConsoleMocks() {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.log = originalConsole.log;
}