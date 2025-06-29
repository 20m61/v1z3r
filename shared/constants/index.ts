/**
 * Shared constants for VJ Application modules
 */

// ====================
// Performance Constants
// ====================

export const PERFORMANCE = {
  TARGET_FPS: 60,
  MIN_FPS: 30,
  MAX_FPS: 120,
  FRAME_TIME_MS: 16.67, // 60fps
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  MEMORY_CRITICAL_THRESHOLD: 500 * 1024 * 1024, // 500MB
  AUDIO_LATENCY_TARGET: 20, // ms
  RENDER_LATENCY_TARGET: 16, // ms
} as const

// ====================
// Audio Constants
// ====================

export const AUDIO = {
  SAMPLE_RATE: 44100,
  FFT_SIZE: 2048,
  SMOOTHING_TIME_CONSTANT: 0.8,
  MIN_DECIBELS: -100,
  MAX_DECIBELS: -30,
  FREQUENCY_BIN_COUNT: 1024,
  VOLUME_SMOOTHING: 0.9,
  PITCH_SMOOTHING: 0.85,
} as const

// ====================
// Visual Constants
// ====================

export const VISUAL = {
  DEFAULT_CANVAS_WIDTH: 1920,
  DEFAULT_CANVAS_HEIGHT: 1080,
  MIN_CANVAS_WIDTH: 320,
  MIN_CANVAS_HEIGHT: 240,
  MAX_CANVAS_WIDTH: 3840,
  MAX_CANVAS_HEIGHT: 2160,
  DEFAULT_PIXEL_RATIO: 1,
  MAX_PIXEL_RATIO: 3,
  
  // Particle system limits
  MAX_PARTICLES: {
    LOW: 100,
    MEDIUM: 500,
    HIGH: 1000,
    ULTRA: 2000,
  },
  
  // Effect parameters
  SENSITIVITY_RANGE: [0.1, 5.0],
  SPEED_RANGE: [0.1, 3.0],
  OPACITY_RANGE: [0.0, 1.0],
} as const

// ====================
// WebSocket Constants
// ====================

export const WEBSOCKET = {
  RECONNECT_INTERVAL: 3000, // ms
  MAX_RECONNECT_ATTEMPTS: 5,
  HEARTBEAT_INTERVAL: 30000, // ms
  CONNECTION_TIMEOUT: 10000, // ms
  MESSAGE_QUEUE_SIZE: 100,
  
  // Message types
  MESSAGE_TYPES: {
    CONNECT: 'CONNECT',
    DISCONNECT: 'DISCONNECT',
    EVENT: 'EVENT',
    HEARTBEAT: 'HEARTBEAT',
    ERROR: 'ERROR',
  },
} as const

// ====================
// Event Constants
// ====================

export const EVENTS = {
  // Audio events
  AUDIO_DATA: 'AUDIO_DATA',
  AUDIO_START: 'AUDIO_START',
  AUDIO_STOP: 'AUDIO_STOP',
  AUDIO_ERROR: 'AUDIO_ERROR',
  
  // Visual events
  PARAMETER_UPDATE: 'PARAMETER_UPDATE',
  LAYER_UPDATE: 'LAYER_UPDATE',
  EFFECT_CHANGE: 'EFFECT_CHANGE',
  PRESET_LOAD: 'PRESET_LOAD',
  PRESET_SAVE: 'PRESET_SAVE',
  
  // Voice events
  VOICE_COMMAND: 'VOICE_COMMAND',
  VOICE_START: 'VOICE_START',
  VOICE_STOP: 'VOICE_STOP',
  VOICE_ERROR: 'VOICE_ERROR',
  
  // Sync events
  DEVICE_CONNECT: 'DEVICE_CONNECT',
  DEVICE_DISCONNECT: 'DEVICE_DISCONNECT',
  SYNC_STATE: 'SYNC_STATE',
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  
  // Performance events
  PERFORMANCE_UPDATE: 'PERFORMANCE_UPDATE',
  QUALITY_CHANGE: 'QUALITY_CHANGE',
  
  // Error events
  ERROR: 'ERROR',
  WARNING: 'WARNING',
} as const

// ====================
// Storage Constants
// ====================

export const STORAGE = {
  MAX_PRESETS: 100,
  MAX_HISTORY_ITEMS: 50,
  PRESET_NAME_MAX_LENGTH: 50,
  PRESET_DESCRIPTION_MAX_LENGTH: 200,
  
  // Local storage keys
  KEYS: {
    PRESETS: 'vj_presets',
    SETTINGS: 'vj_settings',
    HISTORY: 'vj_history',
    SESSION: 'vj_session',
    CACHE: 'vj_cache',
  },
  
  // Cache durations (ms)
  CACHE_DURATION: {
    PRESETS: 24 * 60 * 60 * 1000, // 24 hours
    SETTINGS: 7 * 24 * 60 * 60 * 1000, // 7 days
    TEMPORARY: 60 * 60 * 1000, // 1 hour
  },
} as const

// ====================
// UI Constants
// ====================

export const UI = {
  // Breakpoints (px)
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    XXL: 1536,
  },
  
  // Touch targets (px)
  TOUCH_TARGET_MIN: 44,
  TOUCH_TARGET_RECOMMENDED: 48,
  
  // Animation durations (ms)
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  
  // Z-index layers
  Z_INDEX: {
    BACKGROUND: 0,
    CONTENT: 1,
    OVERLAY: 10,
    MODAL: 50,
    TOAST: 100,
  },
} as const

// ====================
// API Constants
// ====================

export const API = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  TIMEOUT: 10000, // ms
  
  // Endpoints
  ENDPOINTS: {
    PRESETS: '/presets',
    SESSIONS: '/sessions',
    HEALTH: '/health',
    METRICS: '/metrics',
  },
  
  // HTTP status codes
  STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },
} as const

// ====================
// Voice Recognition Constants
// ====================

export const VOICE = {
  LANGUAGES: ['en-US', 'ja-JP', 'es-ES', 'fr-FR', 'de-DE'],
  DEFAULT_LANGUAGE: 'en-US',
  CONFIDENCE_THRESHOLD: 0.7,
  MAX_ALTERNATIVES: 3,
  INTERIM_RESULTS: true,
  CONTINUOUS: true,
  
  // Commands
  COMMANDS: {
    START: ['start', 'begin', '開始', 'はじめ'],
    STOP: ['stop', 'end', '停止', 'やめ'],
    SAVE: ['save', 'store', '保存', 'セーブ'],
    LOAD: ['load', 'open', '読み込み', 'ロード'],
    NEXT: ['next', 'forward', '次', 'つぎ'],
    PREVIOUS: ['previous', 'back', '前', 'まえ'],
  },
} as const

// ====================
// Error Codes
// ====================

export const ERROR_CODES = {
  // Audio errors
  AUDIO_NOT_SUPPORTED: 'AUDIO_NOT_SUPPORTED',
  MICROPHONE_DENIED: 'MICROPHONE_DENIED',
  AUDIO_CONTEXT_FAILED: 'AUDIO_CONTEXT_FAILED',
  
  // Visual errors
  WEBGL_NOT_SUPPORTED: 'WEBGL_NOT_SUPPORTED',
  CANVAS_NOT_FOUND: 'CANVAS_NOT_FOUND',
  RENDER_FAILED: 'RENDER_FAILED',
  
  // Network errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  API_ERROR: 'API_ERROR',
  
  // Storage errors
  STORAGE_FULL: 'STORAGE_FULL',
  SAVE_FAILED: 'SAVE_FAILED',
  LOAD_FAILED: 'LOAD_FAILED',
  
  // Voice errors
  SPEECH_NOT_SUPPORTED: 'SPEECH_NOT_SUPPORTED',
  VOICE_RECOGNITION_FAILED: 'VOICE_RECOGNITION_FAILED',
  
  // General errors
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  MODULE_ERROR: 'MODULE_ERROR',
  PERFORMANCE_DEGRADED: 'PERFORMANCE_DEGRADED',
} as const

// ====================
// Feature Flags
// ====================

export const FEATURES = {
  ENABLE_WEBGL2: true,
  ENABLE_OFFSCREEN_CANVAS: true,
  ENABLE_WORKERS: true,
  ENABLE_VOICE_RECOGNITION: true,
  ENABLE_MIDI: true,
  ENABLE_CLOUD_SYNC: true,
  ENABLE_ANALYTICS: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const

// ====================
// Default Configurations
// ====================

export const DEFAULT_CONFIG = {
  visual: {
    targetFPS: PERFORMANCE.TARGET_FPS,
    quality: 'high' as const,
    enableEffects: true,
    enableMotionBlur: true,
    enableAntiAliasing: true,
  },
  
  audio: {
    fftSize: AUDIO.FFT_SIZE,
    smoothingTimeConstant: AUDIO.SMOOTHING_TIME_CONSTANT,
    minDecibels: AUDIO.MIN_DECIBELS,
    maxDecibels: AUDIO.MAX_DECIBELS,
  },
  
  controller: {
    enableVoiceRecognition: true,
    enableMIDI: false,
    touchOptimized: false,
    theme: 'dark' as const,
    language: 'en-US',
  },
  
  sync: {
    reconnectInterval: WEBSOCKET.RECONNECT_INTERVAL,
    heartbeatInterval: WEBSOCKET.HEARTBEAT_INTERVAL,
    maxReconnectAttempts: WEBSOCKET.MAX_RECONNECT_ATTEMPTS,
    enableEncryption: false,
  },
} as const