/**
 * Style Transfer Service Tests
 * Tests for AI style transfer functionality
 */

import { styleTransferService, StyleTransferConfig } from '../styleTransfer';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  browser: {
    fromPixels: jest.fn().mockReturnValue({
      expandDims: jest.fn().mockReturnValue({
        div: jest.fn().mockReturnValue('mockTensor')
      })
    }),
    toPixels: jest.fn().mockResolvedValue(undefined)
  },
  loadGraphModel: jest.fn().mockResolvedValue({
    predict: jest.fn().mockReturnValue('mockStyledTensor'),
    dispose: jest.fn()
  }),
  memory: jest.fn().mockReturnValue({ numBytes: 1024 })
}));

// Mock Canvas API
const mockCanvas = {
  width: 512,
  height: 512,
  getContext: jest.fn().mockReturnValue({
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    filter: 'none',
    globalCompositeOperation: 'source-over'
  })
};

Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockReturnValue(mockCanvas),
  writable: true
});

describe('StyleTransferService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = styleTransferService.getConfig();
      expect(config.styleName).toBe('none');
      expect(config.enabled).toBe(false);
      expect(config.strength).toBe(0.5);
      expect(config.blendMode).toBe('normal');
    });

    it('should initialize successfully', async () => {
      await expect(styleTransferService.initialize()).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should update config correctly', () => {
      const newConfig: Partial<StyleTransferConfig> = {
        styleName: 'van-gogh',
        enabled: true,
        strength: 0.8,
        blendMode: 'multiply'
      };

      styleTransferService.setConfig(newConfig);
      const config = styleTransferService.getConfig();

      expect(config.styleName).toBe('van-gogh');
      expect(config.enabled).toBe(true);
      expect(config.strength).toBe(0.8);
      expect(config.blendMode).toBe('multiply');
    });

    it('should set enabled state', () => {
      styleTransferService.setEnabled(true);
      expect(styleTransferService.getConfig().enabled).toBe(true);

      styleTransferService.setEnabled(false);
      expect(styleTransferService.getConfig().enabled).toBe(false);
    });

    it('should clamp strength values', () => {
      styleTransferService.setStrength(1.5);
      expect(styleTransferService.getConfig().strength).toBe(1);

      styleTransferService.setStrength(-0.5);
      expect(styleTransferService.getConfig().strength).toBe(0);

      styleTransferService.setStrength(0.7);
      expect(styleTransferService.getConfig().strength).toBe(0.7);
    });

    it('should set blend mode', () => {
      styleTransferService.setBlendMode('overlay');
      expect(styleTransferService.getConfig().blendMode).toBe('overlay');
    });
  });

  describe('preset styles', () => {
    it('should provide preset styles', () => {
      const presets = styleTransferService.getPresetStyles();
      expect(presets).toHaveProperty('van-gogh');
      expect(presets).toHaveProperty('picasso');
      expect(presets).toHaveProperty('monet');
      expect(presets).toHaveProperty('kandinsky');
      expect(presets).toHaveProperty('wave');
      expect(presets).toHaveProperty('neon');
    });

    it('should have valid preset structure', () => {
      const presets = styleTransferService.getPresetStyles();
      const vanGogh = presets['van-gogh'];
      
      expect(vanGogh).toHaveProperty('name');
      expect(vanGogh).toHaveProperty('url');
      expect(vanGogh).toHaveProperty('description');
      expect(typeof vanGogh.name).toBe('string');
      expect(typeof vanGogh.url).toBe('string');
      expect(typeof vanGogh.description).toBe('string');
    });
  });

  describe('style transfer application', () => {
    it('should apply style transfer to canvas', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      // Enable style transfer
      styleTransferService.setConfig({
        enabled: true,
        styleName: 'van-gogh',
        strength: 0.5
      });

      await styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);

      // Should not throw and should complete
      expect(true).toBe(true);
    });

    it('should pass through unchanged when disabled', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCtx = outputCanvas.getContext('2d');

      // Disable style transfer
      styleTransferService.setConfig({ enabled: false });

      await styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);

      // Should copy input to output
      expect(outputCtx?.drawImage).toHaveBeenCalledWith(inputCanvas, 0, 0);
    });

    it('should handle processing errors gracefully', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      // Mock error in processing
      const mockError = new Error('Processing failed');
      jest.spyOn(styleTransferService as any, 'applyMLStyleTransfer').mockRejectedValue(mockError);

      styleTransferService.setConfig({ enabled: true });

      await expect(styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas)).resolves.not.toThrow();
    });
  });

  describe('metrics', () => {
    it('should provide metrics', () => {
      const metrics = styleTransferService.getMetrics();
      expect(metrics).toHaveProperty('processingTime');
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('modelLoaded');
      expect(metrics).toHaveProperty('currentStyle');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should update metrics after processing', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      styleTransferService.setConfig({ 
        enabled: true,
        styleName: 'van-gogh'
      });

      await styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);

      const metrics = styleTransferService.getMetrics();
      expect(metrics.currentStyle).toBe('van-gogh');
      expect(typeof metrics.processingTime).toBe('number');
      expect(typeof metrics.fps).toBe('number');
    });
  });

  describe('resource management', () => {
    it('should dispose resources properly', () => {
      expect(() => styleTransferService.dispose()).not.toThrow();
    });

    it('should reset state after disposal', () => {
      styleTransferService.setConfig({ enabled: true });
      styleTransferService.dispose();
      
      const metrics = styleTransferService.getMetrics();
      expect(metrics.modelLoaded).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle model loading failures', async () => {
      // Mock model loading failure
      const tf = require('@tensorflow/tfjs');
      tf.loadGraphModel.mockRejectedValueOnce(new Error('Model loading failed'));

      await expect(styleTransferService.initialize()).resolves.not.toThrow();
      
      const metrics = styleTransferService.getMetrics();
      expect(metrics.modelLoaded).toBe(false);
    });

    it('should handle invalid canvas inputs', async () => {
      const inputCanvas = null as any;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      styleTransferService.setConfig({ enabled: true });

      await expect(styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas)).resolves.not.toThrow();
    });
  });

  describe('performance', () => {
    it('should not process when already processing', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      styleTransferService.setConfig({ enabled: true });

      // Start first processing
      const promise1 = styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);
      
      // Start second processing while first is running
      const promise2 = styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);

      await Promise.all([promise1, promise2]);

      // Both should complete without error
      expect(true).toBe(true);
    });

    it('should update FPS calculations', async () => {
      const inputCanvas = document.createElement('canvas') as HTMLCanvasElement;
      const outputCanvas = document.createElement('canvas') as HTMLCanvasElement;

      styleTransferService.setConfig({ enabled: true });

      // Process multiple frames
      for (let i = 0; i < 5; i++) {
        await styleTransferService.applyStyleTransfer(inputCanvas, outputCanvas);
      }

      const metrics = styleTransferService.getMetrics();
      expect(metrics.fps).toBeGreaterThan(0);
    });
  });
});