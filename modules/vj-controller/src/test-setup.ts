import '@testing-library/jest-dom'

// Mock Web APIs
global.matchMedia = global.matchMedia || function (query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }
}

// Mock Speech Recognition
global.webkitSpeechRecognition = global.webkitSpeechRecognition || function() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    continuous: false,
    interimResults: false,
    lang: 'en-US',
    maxAlternatives: 1,
  }
}

// Mock getUserMedia for microphone
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    })),
  },
  writable: true,
})

// Mock ResizeObserver
global.ResizeObserver = global.ResizeObserver || function(callback) {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }
}

// Mock requestAnimationFrame
global.requestAnimationFrame = global.requestAnimationFrame || function(callback) {
  return setTimeout(callback, 16)
}

global.cancelAnimationFrame = global.cancelAnimationFrame || function(id) {
  clearTimeout(id)
}

// Mock IntersectionObserver
global.IntersectionObserver = global.IntersectionObserver || function(callback) {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock console methods to reduce noise in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})