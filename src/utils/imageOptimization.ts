/**
 * Image Optimization Utilities
 * Provides WebP/AVIF conversion and responsive image handling
 */

import { errorHandler } from './errorHandler';

export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  sizes?: string[];
  lazy?: boolean;
}

export interface OptimizedImageData {
  src: string;
  srcSet: string;
  sizes: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Generate responsive image sources with WebP/AVIF support
 */
export function generateResponsiveImages(
  baseSrc: string,
  options: ImageOptimizationOptions = {}
): OptimizedImageData {
  const {
    quality = 80,
    format = 'auto',
    sizes = ['320w', '640w', '1024w', '1280w', '1920w'],
    lazy = true
  } = options;

  // Validate input
  if (!baseSrc || typeof baseSrc !== 'string') {
    throw new Error('Invalid image source path');
  }

  // Extract file extension and name
  const lastDotIndex = baseSrc.lastIndexOf('.');
  if (lastDotIndex === -1) {
    throw new Error('Image source must have a file extension');
  }
  
  const baseName = baseSrc.substring(0, lastDotIndex);
  const originalExt = baseSrc.substring(lastDotIndex + 1);

  // Determine optimal format based on browser support
  const getOptimalFormat = (): string => {
    if (format !== 'auto') return format;
    
    // Check browser support
    if (typeof window !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        // Check AVIF support
        if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
          return 'avif';
        }
        
        // Check WebP support
        if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
          return 'webp';
        }
      } catch (error) {
        errorHandler.warn('Failed to detect image format support', error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return originalExt;
  };

  const optimalFormat = getOptimalFormat();

  // Generate srcSet for different sizes
  const srcSet = sizes
    .map(size => {
      const width = parseInt(size.replace('w', ''));
      return `${baseName}-${width}.${optimalFormat} ${width}w`;
    })
    .join(', ');

  // Default src (largest size)
  const largestSize = Math.max(...sizes.map(s => parseInt(s.replace('w', ''))));
  const src = `${baseName}-${largestSize}.${optimalFormat}`;

  return {
    src,
    srcSet,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
    format: optimalFormat,
    width: largestSize,
    height: Math.round(largestSize * 0.75) // Assume 4:3 aspect ratio
  };
}

/**
 * Preload critical images
 */
export function preloadCriticalImages(images: string[]): void {
  if (typeof window === 'undefined') return;

  images.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    
    // Add format-specific attributes
    if (src.includes('.webp')) {
      link.type = 'image/webp';
    } else if (src.includes('.avif')) {
      link.type = 'image/avif';
    }
    
    document.head.appendChild(link);
  });
}

/**
 * Lazy loading observer for images
 */
// Cache format detection result
let cachedOptimalFormat: string | null = null;

function getCachedOptimalFormat(originalExt: string): string {
  if (cachedOptimalFormat !== null) {
    return cachedOptimalFormat;
  }
  
  if (typeof window !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      // Check AVIF support
      if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
        cachedOptimalFormat = 'avif';
        return 'avif';
      }
      
      // Check WebP support
      if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
        cachedOptimalFormat = 'webp';
        return 'webp';
      }
    } catch (error) {
      errorHandler.warn('Failed to detect image format support', error);
    }
  }
  
  cachedOptimalFormat = originalExt;
  return originalExt;
}

export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private images: Set<HTMLImageElement> = new Set();
  private loadHandlers = new Map<HTMLImageElement, () => void>();
  private errorHandlers = new Map<HTMLImageElement, () => void>();

  constructor(options: IntersectionObserverInit = {}) {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          this.loadImage(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01,
      ...options
    });
  }

  observe(img: HTMLImageElement): void {
    if (!this.observer) {
      // Fallback for browsers without IntersectionObserver
      this.loadImage(img);
      return;
    }

    this.images.add(img);
    this.observer.observe(img);
  }

  unobserve(img: HTMLImageElement): void {
    if (!this.observer) return;

    this.images.delete(img);
    this.observer.unobserve(img);
  }

  private loadImage(img: HTMLImageElement): void {
    try {
      const dataSrc = img.dataset.src;
      const dataSrcSet = img.dataset.srcset;

      // Add load and error handlers
      const loadHandler = () => {
        img.classList.remove('lazy');
        img.classList.add('loaded');
        this.cleanup(img);
      };
      
      const errorHandlerFn = () => {
        img.classList.remove('lazy');
        img.classList.add('error');
        errorHandler.error('Failed to load lazy image', new Error(`Image failed to load: ${dataSrc}`));
        this.cleanup(img);
      };
      
      this.loadHandlers.set(img, loadHandler);
      this.errorHandlers.set(img, errorHandlerFn);
      
      img.addEventListener('load', loadHandler, { once: true });
      img.addEventListener('error', errorHandlerFn, { once: true });

      if (dataSrc) {
        img.src = dataSrc;
        img.removeAttribute('data-src');
      }

      if (dataSrcSet) {
        img.srcset = dataSrcSet;
        img.removeAttribute('data-srcset');
      }
    } catch (error) {
      errorHandler.error('Error in loadImage', error instanceof Error ? error : new Error(String(error)));
      this.cleanup(img);
    }
  }
  
  private cleanup(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
    
    // Remove event handlers
    const loadHandler = this.loadHandlers.get(img);
    const errorHandlerFn = this.errorHandlers.get(img);
    
    if (loadHandler) {
      img.removeEventListener('load', loadHandler);
      this.loadHandlers.delete(img);
    }
    
    if (errorHandlerFn) {
      img.removeEventListener('error', errorHandlerFn);
      this.errorHandlers.delete(img);
    }
    
    this.images.delete(img);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up all event handlers
    this.images.forEach(img => {
      this.cleanup(img);
    });
    
    this.images.clear();
    this.loadHandlers.clear();
    this.errorHandlers.clear();
  }
}

/**
 * Convert canvas to optimized blob
 */
export async function canvasToOptimizedBlob(
  canvas: HTMLCanvasElement,
  options: { format?: string; quality?: number } = {}
): Promise<Blob | null> {
  const { format = 'webp', quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        `image/${format}`,
        quality
      );
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get image dimensions without loading the full image
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!src || typeof src !== 'string') {
      reject(new Error('Invalid image source'));
      return;
    }
    
    const img = new Image();
    let timeout: NodeJS.Timeout;
    
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
    
    img.onload = () => {
      cleanup();
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    // Add timeout
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Image load timeout: ${src}`));
    }, 10000); // 10 second timeout
    
    img.src = src;
  });
}