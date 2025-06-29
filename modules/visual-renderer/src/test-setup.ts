import '@testing-library/jest-dom'
import 'jest-canvas-mock'

// Mock WebGL context
const mockWebGLContext = {
  canvas: document.createElement('canvas'),
  drawingBufferWidth: 1920,
  drawingBufferHeight: 1080,
  viewport: jest.fn(),
  clearColor: jest.fn(),
  clear: jest.fn(),
  enable: jest.fn(),
  disable: jest.fn(),
  blendFunc: jest.fn(),
  createShader: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  createProgram: jest.fn(() => ({})),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  useProgram: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  getProgramParameter: jest.fn(() => true),
  getShaderInfoLog: jest.fn(() => ''),
  getProgramInfoLog: jest.fn(() => ''),
  createBuffer: jest.fn(() => ({})),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  getAttribLocation: jest.fn(() => 0),
  getUniformLocation: jest.fn(() => ({})),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  uniform1f: jest.fn(),
  uniform2f: jest.fn(),
  uniform3f: jest.fn(),
  uniform4f: jest.fn(),
  uniform1i: jest.fn(),
  uniformMatrix4fv: jest.fn(),
  drawArrays: jest.fn(),
  drawElements: jest.fn(),
  createTexture: jest.fn(() => ({})),
  bindTexture: jest.fn(),
  texImage2D: jest.fn(),
  texParameteri: jest.fn(),
  activeTexture: jest.fn(),
  generateMipmap: jest.fn(),
  // WebGL2 specific methods
  createVertexArray: jest.fn(() => ({})),
  bindVertexArray: jest.fn(),
  // Constants
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  STATIC_DRAW: 35044,
  FLOAT: 5126,
  TRIANGLES: 4,
  COLOR_BUFFER_BIT: 16384,
  DEPTH_BUFFER_BIT: 256,
  DEPTH_TEST: 2929,
  BLEND: 3042,
  SRC_ALPHA: 770,
  ONE_MINUS_SRC_ALPHA: 771,
  TEXTURE_2D: 3553,
  TEXTURE0: 33984,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  LINEAR: 9729,
}

// Store original getContext for restore
const originalGetContext = HTMLCanvasElement.prototype.getContext

// Mock getContext methods
HTMLCanvasElement.prototype.getContext = jest.fn((contextId): any => {
  if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') {
    return mockWebGLContext
  }
  if (contextId === '2d') {
    return {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      putImageData: jest.fn(),
      createImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
    }
  }
  return null
})

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16)
})

global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id)
})

// Mock performance.now
global.performance = global.performance || {}
global.performance.now = jest.fn(() => Date.now())

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock OffscreenCanvas
global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
})