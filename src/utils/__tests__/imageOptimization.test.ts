/**
 * Tests for image optimization utility
 */

import { 
  optimizeImage, 
  generateSrcSet, 
  preloadImages,
  convertToWebP,
  convertToAVIF,
  ImageOptimizer 
} from '../imageOptimization';

// Mock canvas API
const mockCanvas = {
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 100,
      height: 100,
    })),
  })),
  toBlob: jest.fn((callback) => {
    callback(new Blob(['mock-image-data'], { type: 'image/webp' }));
  }),
  toDataURL: jest.fn(() => 'data:image/webp;base64,mockdata'),
  width: 0,
  height: 0,
};

// Mock document.createElement
const originalCreateElement = document.createElement;
beforeAll(() => {
  (document.createElement as any) = jest.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    return originalCreateElement.call(document, tagName);
  });
});

afterAll(() => {
  document.createElement = originalCreateElement;
});

// Mock Image constructor
global.Image = jest.fn(() => {
  const mockImg = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    src: '',
    naturalWidth: 1920,
    naturalHeight: 1080,
    width: 1920,
    height: 1080,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  
  // Auto-trigger load when src is set
  Object.defineProperty(mockImg, 'src', {
    set: function(value: string) {
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    },
    get: function() {
      return '';
    }
  });
  
  return mockImg;
}) as any;

describe('imageOptimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('optimizeImage', () => {
    it('optimizes image with default settings', async () => {
      const result = await optimizeImage('/test/image.jpg');
      
      expect(result).toEqual({
        original: '/test/image.jpg',
        optimized: expect.stringContaining('data:image/webp'),
        width: 1920,
        height: 1080,
        format: 'webp',
        size: expect.any(Number),
      });
    });

    it('resizes image to specified dimensions', async () => {
      mockCanvas.width = 800;
      mockCanvas.height = 600;
      
      const result = await optimizeImage('/test/image.jpg', {
        width: 800,
        height: 600,
      });
      
      expect(mockCanvas.getContext).toHaveBeenCalled();
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('maintains aspect ratio when resizing', async () => {
      const result = await optimizeImage('/test/image.jpg', {
        width: 800,
        maintainAspectRatio: true,
      });
      
      // Original is 1920x1080 (16:9)
      // Width 800 should give height 450
      expect(result.width).toBe(800);
      expect(result.height).toBe(450);
    });

    it('applies quality settings', async () => {
      await optimizeImage('/test/image.jpg', {
        quality: 0.7,
        format: 'jpeg',
      });
      
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
    });

    it('handles image loading errors', async () => {
      global.Image = jest.fn(() => ({
        onerror: null,
        addEventListener: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Failed to load')), 10);
          }
        }),
        removeEventListener: jest.fn(),
      })) as any;
      
      await expect(
        optimizeImage('/test/broken.jpg')
      ).rejects.toThrow('Failed to load image');
    });
  });

  describe('generateSrcSet', () => {
    it('generates srcset for responsive images', async () => {
      const srcset = await generateSrcSet('/test/image.jpg', {
        widths: [400, 800, 1200],
      });
      
      expect(srcset).toEqual([
        expect.objectContaining({ width: 400, url: expect.any(String) }),
        expect.objectContaining({ width: 800, url: expect.any(String) }),
        expect.objectContaining({ width: 1200, url: expect.any(String) }),
      ]);
    });

    it('generates srcset string format', async () => {
      const srcset = await generateSrcSet('/test/image.jpg', {
        widths: [400, 800],
        format: 'string',
      });
      
      expect(typeof srcset).toBe('string');
      expect(srcset).toMatch(/400w.*800w/);
    });

    it('includes 2x variants for retina', async () => {
      const srcset = await generateSrcSet('/test/image.jpg', {
        widths: [400],
        includeRetina: true,
      });
      
      expect(srcset).toHaveLength(2);
      expect(srcset[1].descriptor).toBe('2x');
      expect(srcset[1].width).toBe(800); // 2x of 400
    });
  });

  describe('preloadImages', () => {
    it('preloads multiple images', async () => {
      const urls = ['/image1.jpg', '/image2.jpg', '/image3.jpg'];
      const results = await preloadImages(urls);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.loaded)).toBe(true);
    });

    it('continues loading if some images fail', async () => {
      // Mock one image to fail
      let callCount = 0;
      global.Image = jest.fn(() => ({
        addEventListener: jest.fn((event, handler) => {
          callCount++;
          if (callCount === 2 && event === 'error') {
            setTimeout(() => handler(new Error('Failed')), 10);
          } else if (event === 'load') {
            setTimeout(() => handler(), 10);
          }
        }),
        removeEventListener: jest.fn(),
      })) as any;
      
      const urls = ['/image1.jpg', '/image2.jpg', '/image3.jpg'];
      const results = await preloadImages(urls);
      
      expect(results).toHaveLength(3);
      expect(results[0].loaded).toBe(true);
      expect(results[1].loaded).toBe(false);
      expect(results[2].loaded).toBe(true);
    });

    it('reports progress during preloading', async () => {
      const progressCallback = jest.fn();
      
      await preloadImages(
        ['/image1.jpg', '/image2.jpg'],
        { onProgress: progressCallback }
      );
      
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        loaded: expect.any(Number),
        total: 2,
        percent: expect.any(Number),
      }));
    });
  });

  describe('format conversion', () => {
    it('converts to WebP format', async () => {
      const result = await convertToWebP('/test/image.jpg');
      
      expect(result.format).toBe('webp');
      expect(result.url).toContain('data:image/webp');
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/webp',
        expect.any(Number)
      );
    });

    it('converts to AVIF format with fallback', async () => {
      // Mock AVIF not supported
      mockCanvas.toBlob.mockImplementationOnce((callback, type) => {
        if (type === 'image/avif') {
          callback(null);
        } else {
          callback(new Blob(['webp-data'], { type: 'image/webp' }));
        }
      });
      
      const result = await convertToAVIF('/test/image.jpg');
      
      // Should fallback to WebP
      expect(result.format).toBe('webp');
      expect(result.url).toBeDefined();
    });
  });

  describe('ImageOptimizer class', () => {
    it('creates optimizer instance with config', () => {
      const optimizer = new ImageOptimizer({
        defaultQuality: 0.8,
        defaultFormat: 'webp',
        maxWidth: 2000,
        maxHeight: 2000,
      });
      
      expect(optimizer).toBeInstanceOf(ImageOptimizer);
    });

    it('optimizes with instance config', async () => {
      const optimizer = new ImageOptimizer({
        defaultQuality: 0.9,
        defaultFormat: 'jpeg',
      });
      
      await optimizer.optimize('/test/image.jpg');
      
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
    });

    it('caches optimized images', async () => {
      const optimizer = new ImageOptimizer({ enableCache: true });
      
      const result1 = await optimizer.optimize('/test/image.jpg');
      const result2 = await optimizer.optimize('/test/image.jpg');
      
      // Should return same result from cache
      expect(result1).toBe(result2);
    });

    it('clears cache', async () => {
      const optimizer = new ImageOptimizer({ enableCache: true });
      
      await optimizer.optimize('/test/image.jpg');
      optimizer.clearCache();
      
      const cacheSize = optimizer.getCacheSize();
      expect(cacheSize).toBe(0);
    });

    it('respects cache size limit', async () => {
      const optimizer = new ImageOptimizer({ 
        enableCache: true,
        maxCacheSize: 2, // Only cache 2 images
      });
      
      await optimizer.optimize('/test/image1.jpg');
      await optimizer.optimize('/test/image2.jpg');
      await optimizer.optimize('/test/image3.jpg');
      
      const cacheSize = optimizer.getCacheSize();
      expect(cacheSize).toBe(2);
    });
  });

  describe('error handling', () => {
    it('handles invalid image URLs', async () => {
      await expect(
        optimizeImage('')
      ).rejects.toThrow('Invalid image URL');
    });

    it('handles canvas context errors', async () => {
      mockCanvas.getContext.mockReturnValueOnce(null);
      
      await expect(
        optimizeImage('/test/image.jpg')
      ).rejects.toThrow('Canvas context not available');
    });

    it('handles unsupported formats gracefully', async () => {
      const result = await optimizeImage('/test/image.jpg', {
        format: 'unsupported' as any,
      });
      
      // Should fallback to default format
      expect(result.format).toBe('webp');
    });
  });
});