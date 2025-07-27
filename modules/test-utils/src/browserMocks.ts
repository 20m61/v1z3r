/**
 * Browser API mocks for testing environment
 */

/**
 * Setup common browser API mocks
 */
export function setupBrowserMocks() {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock localStorage and sessionStorage
  const storageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  global.localStorage = storageMock;
  global.sessionStorage = storageMock;

  // Mock fetch
  global.fetch = jest.fn();

  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock crypto API
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      subtle: {
        digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
  });

  return storageMock;
}

/**
 * Mock navigator without defineProperty errors
 */
export function mockNavigator(navigatorMock: any) {
  const originalNavigator = global.navigator;
  global.navigator = navigatorMock;
  return originalNavigator;
}

/**
 * Mock document without defineProperty errors  
 */
export function mockDocument(documentMock: any) {
  const originalDocument = global.document;
  global.document = documentMock;
  return originalDocument;
}

/**
 * Reset global objects safely
 */
export function resetGlobals(originalNavigator: any, originalDocument: any) {
  global.navigator = originalNavigator;
  global.document = originalDocument;
}