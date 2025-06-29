// Test setup for Sync Core module

// Mock WebSocket for testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any

// Mock setTimeout and setInterval for testing
jest.useFakeTimers()

// Mock crypto for Node.js environment
if (typeof crypto === 'undefined') {
  const crypto = require('crypto')
  global.crypto = crypto
}

// Mock performance for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
  } as any
}

// Suppress console logs during tests unless specifically testing logging
const originalConsole = { ...console }
beforeAll(() => {
  console.log = jest.fn()
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  Object.assign(console, originalConsole)
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})