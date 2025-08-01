/**
 * Tests for image optimization utility
 * @jest-environment jsdom
 */

import { 
  generateResponsiveImages,
  preloadCriticalImages,
  ImageLazyLoader,
  canvasToOptimizedBlob,
  getImageDimensions
} from '../imageOptimization';
import { setupDOMMocks, cleanupDOMMocks } from '../../__mocks__/domMock';

// Set up comprehensive DOM mocks
beforeEach(() => {
  setupDOMMocks();
  
  // Enhance canvas mock for image optimization tests
  const originalCreateElement = document.createElement;
  (document.createElement as jest.Mock).mockImplementation((tagName: string) => {
    const element = originalCreateElement.call(document, tagName);
    
    if (tagName === 'canvas') {
      element.toBlob = jest.fn((callback) => {
        callback(new Blob(['mock-image-data'], { type: 'image/webp' }));
      });
      element.toDataURL = jest.fn((type) => {
        if (type === 'image/webp') {
          return 'data:image/webp;base64,mockdata';
        }
        if (type === 'image/avif') {
          return 'data:image/avif;base64,mockdata';
        }
        return 'data:image/png;base64,mockdata';
      });
    }
    
    return element;
  });
  
  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '0px',
    thresholds: [0],
  })) as any;
});

afterEach(() => {
  cleanupDOMMocks();
  jest.clearAllMocks();
});

// Mock Image constructor
global.Image = jest.fn(() => {
  const mockImg = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    src: '',
    width: 1920,
    height: 1080,
    naturalWidth: 1920,
    naturalHeight: 1080,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  
  // Auto-trigger load when src is set
  Object.defineProperty(mockImg, 'src', {
    set: function(value: string) {
      // Use immediate execution for tests
      if (this.onload) {
        this.onload();
      }
    },
    get: function() {
      return '';
    }
  });
  
  return mockImg;
}) as any;

describe('imageOptimization', () => {
  // beforeEach and afterEach are already defined globally

  describe('generateResponsiveImages', () => {
    it('generates responsive images with default settings', () => {
      const result = generateResponsiveImages('/test/image.jpg');
      
      expect(result).toEqual({
        src: expect.stringContaining('/test/image'),
        srcSet: expect.stringContaining('320w'),
        sizes: expect.any(String),
        format: expect.any(String),
        width: expect.any(Number),
        height: expect.any(Number),
      });
    });

    it('throws error for invalid image source', () => {
      expect(() => generateResponsiveImages('')).toThrow('Invalid image source path');
    });

    it('throws error for image without extension', () => {
      expect(() => generateResponsiveImages('image-no-ext')).toThrow('Image source must have a file extension');
    });

    it('accepts custom options', () => {
      const options = {
        quality: 90,
        format: 'webp' as const,
        sizes: ['640w', '1280w'],
      };
      
      const result = generateResponsiveImages('/test/image.png', options);
      
      expect(result.format).toBe('webp');
      expect(result.srcSet).toContain('640w');
      expect(result.srcSet).toContain('1280w');
    });
  });

  describe('preloadCriticalImages', () => {
    it('creates preload links for images', () => {
      // Mock document and window are already set up
      const images = ['/image1.jpg', '/image2.webp', '/image3.avif'];
      
      preloadCriticalImages(images);
      
      expect(document.createElement).toHaveBeenCalledWith('link');
      expect(document.head.appendChild).toHaveBeenCalledTimes(3);
    });

    it('handles empty image array', () => {
      jest.clearAllMocks(); // Clear previous calls
      preloadCriticalImages([]);
      
      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('does nothing in server environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      preloadCriticalImages(['/image.jpg']);
      
      expect(document.createElement).not.toHaveBeenCalled();
      
      global.window = originalWindow;
    });
  });

  describe('ImageLazyLoader', () => {
    it('creates instance without errors', () => {
      const loader = new ImageLazyLoader();
      expect(loader).toBeInstanceOf(ImageLazyLoader);
    });

    it('handles server environment gracefully', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      const loader = new ImageLazyLoader();
      expect(loader).toBeInstanceOf(ImageLazyLoader);
      
      global.window = originalWindow;
    });

    it('observes image elements', () => {
      const loader = new ImageLazyLoader();
      const mockImg = document.createElement('img') as HTMLImageElement;
      
      loader.observe(mockImg);
      
      // Should not throw
      expect(() => loader.observe(mockImg)).not.toThrow();
    });
  });

  describe('canvasToOptimizedBlob', () => {
    it('converts canvas to optimized blob', async () => {
      const mockCanvas = document.createElement('canvas') as HTMLCanvasElement;
      
      const result = await canvasToOptimizedBlob(mockCanvas);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/webp');
    });

    it('handles canvas conversion errors', async () => {
      const mockCanvas = {
        toBlob: jest.fn((callback) => {
          callback(null); // Simulate failure
        }),
      } as unknown as HTMLCanvasElement;
      
      await expect(canvasToOptimizedBlob(mockCanvas)).rejects.toThrow();
    });
  });

  describe('getImageDimensions', () => {
    it('returns image dimensions', async () => {
      const result = await getImageDimensions('/test/image.jpg');
      
      expect(result).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it('handles image load errors', async () => {
      // Mock Image to simulate error
      const originalImage = global.Image;
      global.Image = jest.fn(() => {
        const mockImg = {
          onload: null,
          onerror: null,
          src: '',
        };
        
        Object.defineProperty(mockImg, 'src', {
          set: function() {
            if (this.onerror) {
              this.onerror();
            }
          },
        });
        
        return mockImg;
      }) as any;
      
      await expect(getImageDimensions('/invalid/image.jpg')).rejects.toThrow();
      
      global.Image = originalImage;
    });
  });

  describe('format detection', () => {
    it('detects webp support', () => {
      const result = generateResponsiveImages('/test/image.jpg');
      
      // Should return a valid format
      expect(['webp', 'avif', 'jpg']).toContain(result.format);
    });

    it('falls back gracefully when canvas fails', () => {
      // Mock canvas to throw error
      const originalCreateElement = mockDocument.createElement;
      (mockDocument.createElement as jest.Mock).mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          throw new Error('Canvas not supported');
        }
        return originalCreateElement(tagName);
      });
      
      const result = generateResponsiveImages('/test/image.jpg');
      expect(result.format).toBe('jpg');
      
      // Restore original implementation
      mockDocument.createElement = originalCreateElement;
    });
  });
});