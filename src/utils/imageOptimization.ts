/**
 * Image Optimization Utilities
 * Provides WebP/AVIF conversion and responsive image handling
 */

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

  // Extract file extension and name
  const lastDotIndex = baseSrc.lastIndexOf('.');
  const baseName = baseSrc.substring(0, lastDotIndex);
  const originalExt = baseSrc.substring(lastDotIndex + 1);

  // Determine optimal format based on browser support
  const getOptimalFormat = (): string => {
    if (format !== 'auto') return format;
    
    // Check browser support
    if (typeof window !== 'undefined') {
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
export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private images: Set<HTMLImageElement> = new Set();

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
    const dataSrc = img.dataset.src;
    const dataSrcSet = img.dataset.srcset;

    if (dataSrc) {
      img.src = dataSrc;
      img.removeAttribute('data-src');
    }

    if (dataSrcSet) {
      img.srcset = dataSrcSet;
      img.removeAttribute('data-srcset');
    }

    img.classList.remove('lazy');
    img.classList.add('loaded');

    if (this.observer) {
      this.observer.unobserve(img);
    }
    this.images.delete(img);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.images.clear();
    }
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

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      `image/${format}`,
      quality
    );
  });
}

/**
 * Get image dimensions without loading the full image
 */
export function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    img.src = src;
  });
}