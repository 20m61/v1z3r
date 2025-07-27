/**
 * Comprehensive TensorFlow.js Mocks for Testing
 * Provides complete mock implementations for all TensorFlow.js APIs used in the project
 */

// Mock tensor creation functions
export const mockTensor = {
  data: jest.fn().mockResolvedValue(new Float32Array([0.8, 0.1, 0.05, 0.05])),
  dispose: jest.fn(),
  shape: [1, 4],
  dtype: 'float32' as const,
  rank: 2,
  size: 4,
  print: jest.fn(),
  reshape: jest.fn().mockReturnThis(),
  expandDims: jest.fn().mockReturnThis(),
  squeeze: jest.fn().mockReturnThis(),
};

// Mock model creation and layers
export const mockModel = {
  add: jest.fn(),
  compile: jest.fn(),
  predict: jest.fn(() => mockTensor),
  fit: jest.fn().mockResolvedValue({
    history: {
      loss: [0.5, 0.3, 0.1],
      val_loss: [0.6, 0.4, 0.2],
    },
  }),
  evaluate: jest.fn().mockResolvedValue([0.1, 0.95]),
  save: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn(),
  summary: jest.fn(),
  layers: [],
  trainableWeights: [],
  nonTrainableWeights: [],
  weights: [],
  inputs: [mockTensor],
  outputs: [mockTensor],
};

// Mock layer creation functions that return layers for tf.sequential().add()
export const mockLayers = {
  dense: jest.fn((config: any) => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `dense_${Math.random()}`,
      trainable: true,
      units: config?.units || 128,
      activation: config?.activation || 'relu',
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'Dense'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn(() => [null, config?.units || 128]),
      getConfig: jest.fn(() => config || {}),
    };
    return layer;
  }),
  
  lstm: jest.fn((config: any) => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `lstm_${Math.random()}`,
      trainable: true,
      units: config?.units || 64,
      returnSequences: config?.returnSequences || false,
      dropout: config?.dropout || 0,
      recurrentDropout: config?.recurrentDropout || 0,
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'LSTM'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn(() => [null, config?.units || 64]),
      getConfig: jest.fn(() => config || {}),
    };
    return layer;
  }),
  
  conv1d: jest.fn((config: any) => ({
    apply: jest.fn().mockReturnValue(mockTensor),
    name: `conv1d_${Math.random()}`,
    trainable: true,
    filters: config?.filters || 32,
    kernelSize: config?.kernelSize || 3,
    activation: config?.activation || 'relu',
    dispose: jest.fn(),
  })),
  
  maxPooling1d: jest.fn((config: any) => ({
    apply: jest.fn().mockReturnValue(mockTensor),
    name: `max_pooling1d_${Math.random()}`,
    trainable: false,
    poolSize: config?.poolSize || 2,
    strides: config?.strides || 2,
    dispose: jest.fn(),
  })),
  
  flatten: jest.fn(() => ({
    apply: jest.fn().mockReturnValue(mockTensor),
    name: `flatten_${Math.random()}`,
    trainable: false,
    dispose: jest.fn(),
  })),
  
  dropout: jest.fn((config: any) => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `dropout_${Math.random()}`,
      trainable: false,
      rate: config?.rate || 0.2,
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'Dropout'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn((inputShape: any) => inputShape),
      getConfig: jest.fn(() => config || {}),
    };
    return layer;
  }),
  
  batchNormalization: jest.fn(() => ({
    apply: jest.fn().mockReturnValue(mockTensor),
    name: `batch_normalization_${Math.random()}`,
    trainable: true,
    dispose: jest.fn(),
  })),
  
  inputLayer: jest.fn((config: any) => ({
    apply: jest.fn().mockReturnValue(mockTensor),
    name: `input_${Math.random()}`,
    trainable: false,
    inputShape: config?.inputShape || [128],
    dispose: jest.fn(),
  })),
  
  // Additional layers used in the codebase
  conv2d: jest.fn((config: any) => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `conv2d_${Math.random()}`,
      trainable: true,
      filters: config?.filters || 32,
      kernelSize: config?.kernelSize || 3,
      activation: config?.activation || 'relu',
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'Conv2D'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn(() => [null, null, null, config?.filters || 32]),
      getConfig: jest.fn(() => config || {}),
    };
    return layer;
  }),
  
  reshape: jest.fn((config: any) => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `reshape_${Math.random()}`,
      trainable: false,
      targetShape: config?.targetShape || [1],
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'Reshape'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn(() => config?.targetShape || [1]),
      getConfig: jest.fn(() => config || {}),
    };
    return layer;
  }),
  
  multiply: jest.fn(() => {
    const layer = {
      apply: jest.fn().mockReturnValue(mockTensor),
      name: `multiply_${Math.random()}`,
      trainable: false,
      dispose: jest.fn(),
      getClassName: jest.fn(() => 'Multiply'),
      build: jest.fn(),
      call: jest.fn(() => mockTensor),
      computeOutputShape: jest.fn((inputShape: any) => inputShape[0]),
      getConfig: jest.fn(() => ({})),
    };
    return layer;
  }),
};

// Mock optimizers
export const mockOptimizers = {
  adam: jest.fn((config?: any) => ({
    learning_rate: config?.learning_rate || 0.001,
    beta1: config?.beta1 || 0.9,
    beta2: config?.beta2 || 0.999,
    epsilon: config?.epsilon || 1e-7,
    dispose: jest.fn(),
  })),
  
  sgd: jest.fn((config?: any) => ({
    learning_rate: config?.learning_rate || 0.01,
    momentum: config?.momentum || 0,
    dispose: jest.fn(),
  })),
  
  rmsprop: jest.fn((config?: any) => ({
    learning_rate: config?.learning_rate || 0.001,
    decay: config?.decay || 0.9,
    momentum: config?.momentum || 0,
    epsilon: config?.epsilon || 1e-7,
    dispose: jest.fn(),
  })),
};

// Mock loss functions
export const mockLosses = {
  meanSquaredError: jest.fn(),
  binaryCrossentropy: jest.fn(),
  categoricalCrossentropy: jest.fn(),
  sparseCategoricalCrossentropy: jest.fn(),
};

// Mock metrics
export const mockMetrics = {
  accuracy: jest.fn(),
  binaryAccuracy: jest.fn(),
  categoricalAccuracy: jest.fn(),
  sparseCategoricalAccuracy: jest.fn(),
  meanAbsoluteError: jest.fn(),
  meanSquaredError: jest.fn(),
};

// Mock activations
export const mockActivations = {
  relu: jest.fn(),
  sigmoid: jest.fn(),
  tanh: jest.fn(),
  softmax: jest.fn(),
  linear: jest.fn(),
  elu: jest.fn(),
  selu: jest.fn(),
  swish: jest.fn(),
};

// Main TensorFlow.js mock object
export const tensorflowMock = {
  // Model creation
  sequential: jest.fn(() => mockModel),
  model: jest.fn(() => mockModel),
  loadLayersModel: jest.fn().mockResolvedValue(mockModel),
  loadGraphModel: jest.fn().mockResolvedValue(mockModel),
  
  // Tensor creation
  tensor: jest.fn(() => mockTensor),
  tensor1d: jest.fn(() => mockTensor),
  tensor2d: jest.fn(() => mockTensor),
  tensor3d: jest.fn(() => mockTensor),
  tensor4d: jest.fn(() => mockTensor),
  zeros: jest.fn(() => mockTensor),
  ones: jest.fn(() => mockTensor),
  randomNormal: jest.fn(() => mockTensor),
  randomUniform: jest.fn(() => mockTensor),
  
  // Operations
  add: jest.fn(() => mockTensor),
  sub: jest.fn(() => mockTensor),
  mul: jest.fn(() => mockTensor),
  div: jest.fn(() => mockTensor),
  pow: jest.fn(() => mockTensor),
  sqrt: jest.fn(() => mockTensor),
  exp: jest.fn(() => mockTensor),
  log: jest.fn(() => mockTensor),
  sin: jest.fn(() => mockTensor),
  cos: jest.fn(() => mockTensor),
  abs: jest.fn(() => mockTensor),
  max: jest.fn(() => mockTensor),
  min: jest.fn(() => mockTensor),
  mean: jest.fn(() => mockTensor),
  sum: jest.fn(() => mockTensor),
  argMax: jest.fn(() => mockTensor),
  argMin: jest.fn(() => mockTensor),
  
  // Neural network operations
  conv1d: jest.fn(() => mockTensor),
  conv2d: jest.fn(() => mockTensor),
  maxPool: jest.fn(() => mockTensor),
  avgPool: jest.fn(() => mockTensor),
  dropout: jest.fn(() => mockTensor),
  batchNorm: jest.fn(() => mockTensor),
  
  // Activation functions
  relu: jest.fn(() => mockTensor),
  sigmoid: jest.fn(() => mockTensor),
  tanh: jest.fn(() => mockTensor),
  softmax: jest.fn(() => mockTensor),
  
  // Modules
  layers: mockLayers,
  train: {
    adam: mockOptimizers.adam,
    sgd: mockOptimizers.sgd,
    rmsprop: mockOptimizers.rmsprop,
  },
  losses: mockLosses,
  metrics: mockMetrics,
  activations: mockActivations,
  
  // Memory management
  dispose: jest.fn(),
  disposeVariables: jest.fn(),
  memory: jest.fn(() => ({
    numTensors: 0,
    numDataBuffers: 0,
    numBytes: 0,
    unreliable: false,
  })),
  
  // Environment
  backend: jest.fn(() => 'cpu'),
  setBackend: jest.fn().mockResolvedValue(true),
  ready: jest.fn().mockResolvedValue(undefined),
  version: {
    'tfjs-core': '4.0.0',
    'tfjs': '4.0.0',
  },
  
  // Browser-specific
  browser: {
    fromPixels: jest.fn(() => mockTensor),
    toPixels: jest.fn().mockResolvedValue(
      typeof ImageData !== 'undefined' 
        ? new ImageData(1, 1)
        : { data: new Uint8ClampedArray(4), width: 1, height: 1 }
    ),
  },
  
  // Node.js-specific
  node: {
    decodeImage: jest.fn(() => mockTensor),
  },
  
  // Utilities
  util: {
    shuffle: jest.fn(),
    createShuffledIndices: jest.fn(() => [0, 1, 2, 3]),
  },
  
  // Serialization
  io: {
    listModels: jest.fn().mockResolvedValue({}),
    removeModel: jest.fn().mockResolvedValue(undefined),
    copyModel: jest.fn().mockResolvedValue(undefined),
    moveModel: jest.fn().mockResolvedValue(undefined),
  },
};

// Export setup function
export function setupTensorFlowMocks() {
  // Reset all mocks
  Object.values(tensorflowMock).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      (mock as jest.Mock).mockReset();
    }
  });
  
  Object.values(mockLayers).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      (mock as jest.Mock).mockReset();
    }
  });
  
  // Setup default implementations
  tensorflowMock.sequential.mockReturnValue(mockModel);
  tensorflowMock.model.mockReturnValue(mockModel);
  tensorflowMock.tensor3d.mockReturnValue(mockTensor);
  tensorflowMock.tensor2d.mockReturnValue(mockTensor);
  tensorflowMock.tensor1d.mockReturnValue(mockTensor);
  
  return tensorflowMock;
}

// Export cleanup function
export function cleanupTensorFlowMocks() {
  jest.clearAllMocks();
}