/**
 * WebGL and WebGPU mocks for testing
 */

/**
 * Mock WebGL context
 */
export function createMockWebGLContext() {
  return {
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 300,
    drawingBufferHeight: 150,
    getContextAttributes: jest.fn(() => ({})),
    isContextLost: jest.fn(() => false),
    getExtension: jest.fn(() => null),
    getSupportedExtensions: jest.fn(() => []),
    getParameter: jest.fn(),
    getError: jest.fn(() => 0),
    createShader: jest.fn(),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn(() => true),
    createProgram: jest.fn(),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn(() => true),
    useProgram: jest.fn(),
    createBuffer: jest.fn(),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    createTexture: jest.fn(),
    bindTexture: jest.fn(),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    createFramebuffer: jest.fn(),
    bindFramebuffer: jest.fn(),
    framebufferTexture2D: jest.fn(),
    viewport: jest.fn(),
    clear: jest.fn(),
    clearColor: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    drawArrays: jest.fn(),
    drawElements: jest.fn(),
  };
}

/**
 * Mock HTMLCanvasElement methods
 */
export function setupCanvasMocks() {
  HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return createMockWebGLContext();
    }
    if (contextType === '2d') {
      return {
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        // Add missing properties for full compatibility
        canvas: document.createElement('canvas'),
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
      } as any;
    }
    return null;
  }) as any;

  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,test');
  HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
    x: 0,
    y: 0,
    width: 300,
    height: 150,
    top: 0,
    left: 0,
    bottom: 150,
    right: 300,
    toJSON: jest.fn(),
  })) as any;
}

/**
 * Mock WebGPU API
 */
export function mockWebGPU() {
  const originalNavigator = global.navigator;
  
  const mockAdapter = {
    requestDevice: jest.fn().mockResolvedValue({
      createShaderModule: jest.fn(),
      createRenderPipeline: jest.fn(),
      createBuffer: jest.fn(),
      createTexture: jest.fn(),
      queue: {
        submit: jest.fn(),
        writeBuffer: jest.fn(),
      },
    }),
  };

  global.navigator = {
    ...originalNavigator,
    gpu: {
      requestAdapter: jest.fn().mockResolvedValue(mockAdapter),
    },
  } as any;

  return originalNavigator;
}

/**
 * Mock Audio APIs
 */
export function setupAudioMocks() {
  global.AudioContext = jest.fn().mockImplementation(() => ({
    createAnalyser: jest.fn(() => ({
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createOscillator: jest.fn(() => ({
      frequency: { value: 440 },
      type: 'sine',
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    destination: {},
    sampleRate: 44100,
    currentTime: 0,
    resume: jest.fn().mockResolvedValue(undefined),
    suspend: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }));

  global.MediaDevices = jest.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: jest.fn(() => []),
      }),
    },
  });
}