/**
 * Comprehensive DOM and Window API mock for testing
 * Provides complete browser environment mock implementation
 */

// Mock Service Worker Registration
export interface MockServiceWorkerRegistration {
  scope: string;
  installing: MockServiceWorker | null;
  waiting: MockServiceWorker | null;
  active: MockServiceWorker | null;
  update: jest.Mock;
  unregister: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

export interface MockServiceWorker {
  state: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant';
  scriptURL: string;
  postMessage: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
}

// Create mock Service Worker
export const createServiceWorkerMock = (state: MockServiceWorker['state'] = 'activated'): MockServiceWorker => ({
  state,
  scriptURL: '/sw.js',
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
});

// Create mock Service Worker Registration
export const createServiceWorkerRegistrationMock = (): MockServiceWorkerRegistration => ({
  scope: '/',
  installing: null,
  waiting: null,
  active: createServiceWorkerMock('activated'),
  update: jest.fn().mockResolvedValue(undefined),
  unregister: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
});

// Mock Navigator with Service Worker
export const createNavigatorMock = () => ({
  serviceWorker: {
    register: jest.fn().mockResolvedValue(createServiceWorkerRegistrationMock()),
    ready: Promise.resolve(createServiceWorkerRegistrationMock()),
    controller: createServiceWorkerMock('activated'),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getRegistration: jest.fn().mockResolvedValue(createServiceWorkerRegistrationMock()),
    getRegistrations: jest.fn().mockResolvedValue([createServiceWorkerRegistrationMock()])
  },
  userAgent: 'Mozilla/5.0 (Test Browser)',
  language: 'en-US',
  onLine: true,
  permissions: {
    query: jest.fn().mockResolvedValue({ state: 'granted' })
  }
});

// Mock Document with enhanced functionality
export const createDocumentMock = () => {
  const elements = new Map<string, HTMLElement>();
  let elementIdCounter = 0;
  
  const createElement = jest.fn((tagName: string) => {
    const element: any = {
      id: `mock-element-${elementIdCounter++}`,
      tagName: tagName.toUpperCase(),
      setAttribute: jest.fn((name: string, value: string) => {
        element[name] = value;
      }),
      getAttribute: jest.fn((name: string) => element[name]),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn().mockReturnValue(false),
        toggle: jest.fn()
      }
    };
    
    // Canvas-specific properties
    if (tagName.toLowerCase() === 'canvas') {
      element.width = 300;
      element.height = 150;
      element.getContext = jest.fn((contextType: string) => {
        if (contextType === '2d') {
          return {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            fillRect: jest.fn(),
            strokeRect: jest.fn(),
            clearRect: jest.fn(),
            beginPath: jest.fn(),
            closePath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            drawImage: jest.fn(),
            getImageData: jest.fn().mockReturnValue({
              data: new Uint8ClampedArray(4),
              width: 1,
              height: 1
            }),
            putImageData: jest.fn()
          };
        }
        return null;
      });
    }
    
    // Link-specific properties
    if (tagName.toLowerCase() === 'link') {
      element.rel = '';
      element.as = '';
      element.href = '';
      element.crossOrigin = '';
    }
    
    elements.set(element.id, element);
    return element;
  });
  
  return {
    createElement,
    createTextNode: jest.fn((text: string) => ({ nodeValue: text })),
    createDocumentFragment: jest.fn(() => ({
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([])
    })),
    getElementById: jest.fn((id: string) => elements.get(id) || null),
    getElementsByClassName: jest.fn(() => []),
    getElementsByTagName: jest.fn(() => []),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([]),
    head: {
      appendChild: jest.fn(),
      removeChild: jest.fn()
    },
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      style: {}
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    location: {
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      reload: jest.fn()
    }
  };
};

// Mock Window object
export const createWindowMock = () => {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    document: createDocumentMock(),
    navigator: createNavigatorMock(),
    location: {
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      reload: jest.fn(),
      replace: jest.fn()
    },
    localStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    },
    sessionStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0
    },
    addEventListener: jest.fn((type: string, listener: Function) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(listener);
    }),
    removeEventListener: jest.fn((type: string, listener: Function) => {
      if (listeners.has(type)) {
        listeners.get(type)!.delete(listener);
      }
    }),
    dispatchEvent: jest.fn((event: any) => {
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach(listener => listener(event));
      }
      return true;
    }),
    requestAnimationFrame: jest.fn((callback: Function) => {
      setTimeout(() => callback(performance.now()), 16);
      return 1;
    }),
    cancelAnimationFrame: jest.fn(),
    matchMedia: jest.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn()
    })),
    getComputedStyle: jest.fn(() => ({
      getPropertyValue: jest.fn()
    })),
    alert: jest.fn(),
    confirm: jest.fn().mockReturnValue(true),
    prompt: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
    scrollTo: jest.fn(),
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    performance: {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn().mockReturnValue([]),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
      getEntries: jest.fn().mockReturnValue([]),
      getEntriesByName: jest.fn().mockReturnValue([]),
      clearResourceTimings: jest.fn(),
      setResourceTimingBufferSize: jest.fn(),
      timeOrigin: Date.now(),
      timing: {} as PerformanceTiming,
      navigation: {} as PerformanceNavigation,
      eventCounts: new Map(),
      onresourcetimingbufferfull: null,
      toJSON: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    } as unknown as Performance,
    fetch: jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
      blob: jest.fn().mockResolvedValue(new Blob())
    })
  };
};

// Setup global DOM mocks
export const setupDOMMocks = () => {
  const windowMock = createWindowMock();
  const documentMock = windowMock.document;
  
  // Setup global window properties - check if already exists
  try {
    if (!global.window) {
      Object.defineProperty(global, 'window', {
        value: windowMock,
        writable: true,
        configurable: true
      });
    } else {
      // If window already exists, try to replace it
      if (Object.getOwnPropertyDescriptor(global, 'window')?.configurable !== false) {
        delete (global as any).window;
        Object.defineProperty(global, 'window', {
          value: windowMock,
          writable: true,
          configurable: true
        });
      } else {
        // Force replacement if not configurable
        (global as any).window = windowMock;
      }
    }
  } catch (error) {
    // Fallback: force assign
    (global as any).window = windowMock;
  }
  
  // Setup global document
  try {
    if (!global.document) {
      Object.defineProperty(global, 'document', {
        value: documentMock,
        writable: true,
        configurable: true
      });
    } else {
      if (Object.getOwnPropertyDescriptor(global, 'document')?.configurable !== false) {
        delete (global as any).document;
        Object.defineProperty(global, 'document', {
          value: documentMock,
          writable: true,
          configurable: true
        });
      } else {
        (global as any).document = documentMock;
      }
    }
  } catch (error) {
    (global as any).document = documentMock;
  }
  
  // Setup global navigator
  if (!global.navigator || global.navigator.constructor.name === 'Navigator') {
    Object.defineProperty(global, 'navigator', {
      value: windowMock.navigator,
      writable: true,
      configurable: true
    });
  } else {
    (global as any).navigator = windowMock.navigator;
  }
  
  // Setup other global properties
  global.localStorage = windowMock.localStorage;
  global.sessionStorage = windowMock.sessionStorage;
  global.requestAnimationFrame = windowMock.requestAnimationFrame;
  global.cancelAnimationFrame = windowMock.cancelAnimationFrame;
  global.performance = windowMock.performance;
  
  // Setup Image constructor
  // @ts-ignore
  global.Image = jest.fn().mockImplementation(() => ({
    src: '',
    onload: null,
    onerror: null,
    width: 0,
    height: 0,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));
  
  // Setup URL constructor
  // @ts-ignore
  global.URL = {
    createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
    revokeObjectURL: jest.fn()
  };
};

// Cleanup function
export const cleanupDOMMocks = () => {
  // @ts-ignore
  delete global.window;
  // @ts-ignore
  delete global.document;
  // @ts-ignore
  delete global.navigator;
  // @ts-ignore
  delete global.localStorage;
  // @ts-ignore
  delete global.sessionStorage;
  // @ts-ignore
  delete global.requestAnimationFrame;
  // @ts-ignore
  delete global.cancelAnimationFrame;
  // @ts-ignore
  delete global.performance;
  // @ts-ignore
  delete global.Image;
  // @ts-ignore
  delete global.URL;
};