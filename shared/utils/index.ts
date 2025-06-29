/**
 * Shared utility functions for VJ Application modules
 */

export * from './eventBus'

/**
 * Performance utilities
 */
export const performance = {
  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    return function (this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  },

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>
    return function (this: any, ...args: Parameters<T>) {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  },

  /**
   * Request animation frame with fallback
   */
  requestAnimationFrame: (callback: FrameRequestCallback): number => {
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame ||
           ((callback) => window.setTimeout(callback, 1000 / 60))
  },

  /**
   * Cancel animation frame with fallback
   */
  cancelAnimationFrame: (id: number): void => {
    const cancel = window.cancelAnimationFrame || 
                   window.webkitCancelAnimationFrame ||
                   window.clearTimeout
    cancel(id)
  },

  /**
   * Get memory usage information
   */
  getMemoryUsage: (): number => {
    return (performance as any).memory?.usedJSHeapSize || 0
  },

  /**
   * Measure execution time
   */
  measureTime: <T>(name: string, fn: () => T): T => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    console.log(`${name} took ${end - start} milliseconds`)
    return result
  },
}

/**
 * Audio utilities
 */
export const audio = {
  /**
   * Check if Web Audio API is supported
   */
  isSupported: (): boolean => {
    return !!(window.AudioContext || (window as any).webkitAudioContext)
  },

  /**
   * Create audio context with browser compatibility
   */
  createContext: (): AudioContext => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    return new AudioContextClass()
  },

  /**
   * Convert frequency data to volume
   */
  getVolume: (frequencies: Uint8Array): number => {
    let sum = 0
    for (let i = 0; i < frequencies.length; i++) {
      sum += frequencies[i]
    }
    return sum / frequencies.length / 255
  },

  /**
   * Apply smoothing to audio data
   */
  smoothData: (current: Float32Array, previous: Float32Array, smoothing: number): Float32Array => {
    const smoothed = new Float32Array(current.length)
    for (let i = 0; i < current.length; i++) {
      smoothed[i] = previous[i] * smoothing + current[i] * (1 - smoothing)
    }
    return smoothed
  },

  /**
   * Detect beats in frequency data
   */
  detectBeat: (frequencies: Uint8Array, threshold: number = 128): boolean => {
    // Simple beat detection using low frequencies
    const bassRange = frequencies.slice(0, Math.floor(frequencies.length * 0.1))
    const averageBass = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length
    return averageBass > threshold
  },
}

/**
 * Color utilities
 */
export const color = {
  /**
   * Convert HSL to RGB
   */
  hslToRgb: (h: number, s: number, l: number): [number, number, number] => {
    h /= 360
    s /= 100
    l /= 100

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h * 6) % 2 - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0

    if (0 <= h && h < 1/6) {
      r = c; g = x; b = 0
    } else if (1/6 <= h && h < 2/6) {
      r = x; g = c; b = 0
    } else if (2/6 <= h && h < 3/6) {
      r = 0; g = c; b = x
    } else if (3/6 <= h && h < 4/6) {
      r = 0; g = x; b = c
    } else if (4/6 <= h && h < 5/6) {
      r = x; g = 0; b = c
    } else if (5/6 <= h && h < 1) {
      r = c; g = 0; b = x
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ]
  },

  /**
   * Convert RGB to hex
   */
  rgbToHex: (r: number, g: number, b: number): string => {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  },

  /**
   * Generate color from frequency data
   */
  frequencyToColor: (frequencies: Uint8Array): string => {
    const bassValue = frequencies.slice(0, Math.floor(frequencies.length * 0.33))
      .reduce((sum, val) => sum + val, 0) / (Math.floor(frequencies.length * 0.33) * 255)
    
    const midValue = frequencies.slice(Math.floor(frequencies.length * 0.33), Math.floor(frequencies.length * 0.66))
      .reduce((sum, val) => sum + val, 0) / (Math.floor(frequencies.length * 0.33) * 255)
    
    const trebleValue = frequencies.slice(Math.floor(frequencies.length * 0.66))
      .reduce((sum, val) => sum + val, 0) / (Math.floor(frequencies.length * 0.34) * 255)

    const hue = (bassValue * 120 + midValue * 240 + trebleValue * 360) % 360
    const saturation = Math.max(bassValue, midValue, trebleValue) * 100
    const lightness = 50 + (bassValue + midValue + trebleValue) * 20

    const [r, g, b] = color.hslToRgb(hue, saturation, lightness)
    return color.rgbToHex(r, g, b)
  },
}

/**
 * Math utilities
 */
export const math = {
  /**
   * Clamp value between min and max
   */
  clamp: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max)
  },

  /**
   * Linear interpolation
   */
  lerp: (start: number, end: number, t: number): number => {
    return start + (end - start) * t
  },

  /**
   * Map value from one range to another
   */
  map: (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
  },

  /**
   * Generate random number between min and max
   */
  random: (min: number = 0, max: number = 1): number => {
    return Math.random() * (max - min) + min
  },

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  /**
   * Calculate distance between two points
   */
  distance: (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  },

  /**
   * Calculate angle between two points
   */
  angle: (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.atan2(y2 - y1, x2 - x1)
  },
}

/**
 * Storage utilities
 */
export const storage = {
  /**
   * Get item from localStorage with JSON parsing
   */
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue || null
    } catch (error) {
      console.error(`Error getting item from localStorage: ${key}`, error)
      return defaultValue || null
    }
  },

  /**
   * Set item in localStorage with JSON stringification
   */
  set: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error(`Error setting item in localStorage: ${key}`, error)
      return false
    }
  },

  /**
   * Remove item from localStorage
   */
  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error removing item from localStorage: ${key}`, error)
      return false
    }
  },

  /**
   * Clear all localStorage
   */
  clear: (): boolean => {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing localStorage', error)
      return false
    }
  },

  /**
   * Check if localStorage is available
   */
  isAvailable: (): boolean => {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, 'test')
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  },
}

/**
 * Device utilities
 */
export const device = {
  /**
   * Check if device is mobile
   */
  isMobile: (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  },

  /**
   * Check if device is tablet
   */
  isTablet: (): boolean => {
    return /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(navigator.userAgent)
  },

  /**
   * Check if device is desktop
   */
  isDesktop: (): boolean => {
    return !device.isMobile() && !device.isTablet()
  },

  /**
   * Get device pixel ratio
   */
  getPixelRatio: (): number => {
    return window.devicePixelRatio || 1
  },

  /**
   * Check if device supports touch
   */
  hasTouch: (): boolean => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  /**
   * Get viewport dimensions
   */
  getViewport: (): { width: number; height: number } => {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  },
}

/**
 * Format utilities
 */
export const format = {
  /**
   * Format bytes to human readable string
   */
  bytes: (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  },

  /**
   * Format milliseconds to human readable string
   */
  duration: (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  },

  /**
   * Format number with specified decimal places
   */
  number: (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals)
  },
}

/**
 * Validation utilities
 */
export const validate = {
  /**
   * Check if value is a valid email
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Check if value is a valid URL
   */
  url: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  /**
   * Check if value is within range
   */
  range: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max
  },

  /**
   * Check if string is not empty
   */
  notEmpty: (str: string): boolean => {
    return str.trim().length > 0
  },
}