import '@testing-library/jest-dom'

// Mock Web APIs that are not available in jsdom
global.matchMedia = global.matchMedia || function (query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }
}

// Mock Web Audio API
global.AudioContext = global.AudioContext || function() {
  return {
    createAnalyser: jest.fn(() => ({
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    resume: jest.fn(),
    close: jest.fn(),
    state: 'running',
  }
}

// Mock getUserMedia
global.navigator.mediaDevices = global.navigator.mediaDevices || {}
global.navigator.mediaDevices.getUserMedia = global.navigator.mediaDevices.getUserMedia || jest.fn(() => 
  Promise.resolve({
    getTracks: () => [{ stop: jest.fn() }]
  })
)

// Mock Speech Recognition
global.webkitSpeechRecognition = global.webkitSpeechRecognition || function() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }
}

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

// Mock WebGL for visual renderer tests
global.HTMLCanvasElement.prototype.getContext = jest.fn((contextId) => {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return {
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      useProgram: jest.fn(),
      getAttribLocation: jest.fn(() => 0),
      getUniformLocation: jest.fn(() => ({})),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      uniform1f: jest.fn(),
      uniform2f: jest.fn(),
      uniform3f: jest.fn(),
      uniform4f: jest.fn(),
      uniformMatrix4fv: jest.fn(),
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      createBuffer: jest.fn(() => ({})),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      canvas: { width: 800, height: 600 },
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      COLOR_BUFFER_BIT: 16384,
      DEPTH_BUFFER_BIT: 256,
      TRIANGLES: 4,
    }
  }
  return null
})

// Mock WebSocket for sync core tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}))

// Mock PermissionStatus API
global.PermissionStatus = function() {
  return {
    state: 'granted',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }
}

// Mock Permissions API
global.navigator.permissions = global.navigator.permissions || {
  query: jest.fn(() => Promise.resolve({ state: 'granted' }))
}

// Note: AWS SDK mocks are handled in individual test files to avoid dependency issues

// Mock WebGPU API
global.GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
}

global.GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
}

global.GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
}

global.GPUColorWrite = {
  RED: 0x1,
  GREEN: 0x2,
  BLUE: 0x4,
  ALPHA: 0x8,
  ALL: 0xF,
}

// Mock react-icons for better test readability
jest.mock('react-icons/fi', () => ({
  FiChevronUp: () => <span data-testid="icon-chevron-up">▲</span>,
  FiChevronDown: () => <span data-testid="icon-chevron-down">▼</span>,
  FiSettings: () => <span data-testid="icon-settings">⚙</span>,
  FiLayers: () => <span data-testid="icon-layers">📋</span>,
  FiMusic: () => <span data-testid="icon-music">🎵</span>,
  FiFolder: () => <span data-testid="icon-folder">📁</span>,
  FiMic: () => <span data-testid="icon-mic">🎤</span>,
  FiVideo: () => <span data-testid="icon-video">📹</span>,
  FiSave: () => <span data-testid="icon-save">💾</span>,
  FiShare: () => <span data-testid="icon-share">📤</span>,
  FiSliders: () => <span data-testid="icon-sliders">🎛</span>,
  FiPlusCircle: () => <span data-testid="icon-plus-circle">➕</span>,
  FiEye: () => <span data-testid="icon-eye">👁</span>,
  FiEyeOff: () => <span data-testid="icon-eye-off">🙈</span>,
  FiTrash2: () => <span data-testid="icon-trash">🗑</span>,
  FiMove: () => <span data-testid="icon-move">🔄</span>,
}))

// Suppress specific warnings from TensorFlow.js and Three.js
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  
  // Suppress TensorFlow.js warnings
  if (typeof message === 'string') {
    if (message.includes('Platform browser has already been set') ||
        message.includes('backend was already registered') ||
        message.includes('kernel') && message.includes('already registered') ||
        message.includes('Multiple instances of Three.js being imported')) {
      return;
    }
  }
  
  // Call original console.warn for other warnings
  originalWarn.call(console, ...args);
};