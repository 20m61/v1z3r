/**
 * Input validation utilities for VJ Application
 * 
 * This module provides comprehensive validation for audio data, user parameters,
 * and other inputs to ensure security and data integrity.
 */

import { EffectType } from '@/store/visualizerStore';

// Validation error types
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Audio data validation
export interface AudioDataConstraints {
  minLength: number;
  maxLength: number;
  minValue: number;
  maxValue: number;
}

const AUDIO_DATA_CONSTRAINTS: AudioDataConstraints = {
  minLength: 32,
  maxLength: 8192,
  minValue: 0,
  maxValue: 255,
};

/**
 * Validates audio data array
 */
export function validateAudioData(data: Uint8Array | undefined): Uint8Array {
  if (!data) {
    throw new ValidationError('Audio data is required', 'audioData');
  }

  if (!(data instanceof Uint8Array)) {
    throw new ValidationError('Audio data must be a Uint8Array', 'audioData');
  }

  if (data.length < AUDIO_DATA_CONSTRAINTS.minLength) {
    throw new ValidationError(
      `Audio data too short. Minimum length: ${AUDIO_DATA_CONSTRAINTS.minLength}`,
      'audioData'
    );
  }

  if (data.length > AUDIO_DATA_CONSTRAINTS.maxLength) {
    throw new ValidationError(
      `Audio data too long. Maximum length: ${AUDIO_DATA_CONSTRAINTS.maxLength}`,
      'audioData'
    );
  }

  // Validate individual values
  for (let i = 0; i < data.length; i++) {
    if (data[i] < AUDIO_DATA_CONSTRAINTS.minValue || data[i] > AUDIO_DATA_CONSTRAINTS.maxValue) {
      throw new ValidationError(
        `Invalid audio data value at index ${i}: ${data[i]}`,
        'audioData'
      );
    }
  }

  return data;
}

// User parameter validation
export interface ParameterConstraints {
  opacity: { min: number; max: number };
  sensitivity: { min: number; max: number };
  colorTheme: RegExp;
  effectType: EffectType[];
  speed: { min: number; max: number };
}

const PARAMETER_CONSTRAINTS: ParameterConstraints = {
  opacity: { min: 0, max: 1 },
  sensitivity: { min: 0.1, max: 5.0 },
  colorTheme: /^#[0-9a-fA-F]{6}$/,
  effectType: ['spectrum', 'waveform', 'particles', 'lyrics', 'camera'],
  speed: { min: 0.1, max: 3.0 },
};

/**
 * Validates opacity value
 */
export function validateOpacity(opacity: number): number {
  if (typeof opacity !== 'number' || isNaN(opacity)) {
    throw new ValidationError('Opacity must be a number', 'opacity');
  }

  if (opacity < PARAMETER_CONSTRAINTS.opacity.min || opacity > PARAMETER_CONSTRAINTS.opacity.max) {
    throw new ValidationError(
      `Opacity must be between ${PARAMETER_CONSTRAINTS.opacity.min} and ${PARAMETER_CONSTRAINTS.opacity.max}`,
      'opacity'
    );
  }

  return opacity;
}

/**
 * Validates sensitivity value
 */
export function validateSensitivity(sensitivity: number): number {
  if (typeof sensitivity !== 'number' || isNaN(sensitivity)) {
    throw new ValidationError('Sensitivity must be a number', 'sensitivity');
  }

  if (sensitivity < PARAMETER_CONSTRAINTS.sensitivity.min || sensitivity > PARAMETER_CONSTRAINTS.sensitivity.max) {
    throw new ValidationError(
      `Sensitivity must be between ${PARAMETER_CONSTRAINTS.sensitivity.min} and ${PARAMETER_CONSTRAINTS.sensitivity.max}`,
      'sensitivity'
    );
  }

  return sensitivity;
}

/**
 * Validates color theme hex string
 */
export function validateColorTheme(colorTheme: string): string {
  if (typeof colorTheme !== 'string') {
    throw new ValidationError('Color theme must be a string', 'colorTheme');
  }

  if (!PARAMETER_CONSTRAINTS.colorTheme.test(colorTheme)) {
    throw new ValidationError('Color theme must be a valid hex color (e.g., #ff0000)', 'colorTheme');
  }

  return colorTheme;
}

/**
 * Validates effect type
 */
export function validateEffectType(effectType: string): EffectType {
  if (typeof effectType !== 'string') {
    throw new ValidationError('Effect type must be a string', 'effectType');
  }

  if (!PARAMETER_CONSTRAINTS.effectType.includes(effectType as EffectType)) {
    throw new ValidationError(
      `Effect type must be one of: ${PARAMETER_CONSTRAINTS.effectType.join(', ')}`,
      'effectType'
    );
  }

  return effectType as EffectType;
}

/**
 * Validates speed value
 */
export function validateSpeed(speed: number): number {
  if (typeof speed !== 'number' || isNaN(speed)) {
    throw new ValidationError('Speed must be a number', 'speed');
  }

  if (speed < PARAMETER_CONSTRAINTS.speed.min || speed > PARAMETER_CONSTRAINTS.speed.max) {
    throw new ValidationError(
      `Speed must be between ${PARAMETER_CONSTRAINTS.speed.min} and ${PARAMETER_CONSTRAINTS.speed.max}`,
      'speed'
    );
  }

  return speed;
}

// Comprehensive parameter validation
export interface VJParameters {
  opacity?: number;
  sensitivity?: number;
  colorTheme?: string;
  effectType?: string;
  speed?: number;
}

/**
 * Validates all VJ parameters at once
 */
export function validateVJParameters(params: VJParameters): VJParameters {
  const validated: VJParameters = {};

  if (params.opacity !== undefined) {
    validated.opacity = validateOpacity(params.opacity);
  }

  if (params.sensitivity !== undefined) {
    validated.sensitivity = validateSensitivity(params.sensitivity);
  }

  if (params.colorTheme !== undefined) {
    validated.colorTheme = validateColorTheme(params.colorTheme);
  }

  if (params.effectType !== undefined) {
    validated.effectType = validateEffectType(params.effectType);
  }

  if (params.speed !== undefined) {
    validated.speed = validateSpeed(params.speed);
  }

  return validated;
}

// WebSocket message validation
export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
  userId?: string;
}

const WEBSOCKET_MESSAGE_TYPES = [
  'parameter_update',
  'audio_data',
  'sync_request',
  'sync_response',
  'user_join',
  'user_leave',
  'error',
];

/**
 * Validates WebSocket message format
 */
export function validateWebSocketMessage(message: any): WebSocketMessage {
  if (!message || typeof message !== 'object') {
    throw new ValidationError('WebSocket message must be an object', 'message');
  }

  if (!message.type || typeof message.type !== 'string') {
    throw new ValidationError('WebSocket message must have a string type', 'message.type');
  }

  if (!WEBSOCKET_MESSAGE_TYPES.includes(message.type)) {
    throw new ValidationError(
      `Invalid WebSocket message type: ${message.type}`,
      'message.type'
    );
  }

  // Validate timestamp if present
  if (message.timestamp !== undefined) {
    if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
      throw new ValidationError('WebSocket message timestamp must be a positive number', 'message.timestamp');
    }
  }

  // Validate userId if present
  if (message.userId !== undefined) {
    if (typeof message.userId !== 'string' || message.userId.length === 0) {
      throw new ValidationError('WebSocket message userId must be a non-empty string', 'message.userId');
    }

    // Basic sanitization - only allow alphanumeric and hyphens
    if (!/^[a-zA-Z0-9-_]+$/.test(message.userId)) {
      throw new ValidationError('WebSocket message userId contains invalid characters', 'message.userId');
    }
  }

  return message as WebSocketMessage;
}

// File upload validation
export interface FileConstraints {
  maxSize: number; // bytes
  allowedTypes: string[];
  allowedExtensions: string[];
}

const PRESET_FILE_CONSTRAINTS: FileConstraints = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['application/json', 'text/plain'],
  allowedExtensions: ['.json', '.txt'],
};

/**
 * Validates uploaded preset files
 */
export function validatePresetFile(file: File): File {
  if (!file) {
    throw new ValidationError('File is required', 'file');
  }

  // Check file size
  if (file.size > PRESET_FILE_CONSTRAINTS.maxSize) {
    throw new ValidationError(
      `File too large. Maximum size: ${PRESET_FILE_CONSTRAINTS.maxSize / 1024 / 1024}MB`,
      'file.size'
    );
  }

  // Check file type
  if (!PRESET_FILE_CONSTRAINTS.allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type: ${file.type}. Allowed types: ${PRESET_FILE_CONSTRAINTS.allowedTypes.join(', ')}`,
      'file.type'
    );
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!PRESET_FILE_CONSTRAINTS.allowedExtensions.includes(extension)) {
    throw new ValidationError(
      `Invalid file extension: ${extension}. Allowed extensions: ${PRESET_FILE_CONSTRAINTS.allowedExtensions.join(', ')}`,
      'file.extension'
    );
  }

  return file;
}

// URL validation for external resources
/**
 * Validates URLs for external resources
 */
export function validateURL(url: string, allowedDomains?: string[]): string {
  if (typeof url !== 'string') {
    throw new ValidationError('URL must be a string', 'url');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new ValidationError('Invalid URL format', 'url');
  }

  // Only allow HTTPS URLs in production
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
    throw new ValidationError('Only HTTPS URLs are allowed in production', 'url');
  }

  // Check allowed protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ValidationError('Only HTTP and HTTPS protocols are allowed', 'url');
  }

  // Check allowed domains if specified
  if (allowedDomains && allowedDomains.length > 0) {
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      throw new ValidationError(
        `Domain not allowed: ${parsedUrl.hostname}. Allowed domains: ${allowedDomains.join(', ')}`,
        'url'
      );
    }
  }

  return url;
}

// Export constraints for external use
export const VALIDATION_CONSTRAINTS = {
  AUDIO_DATA_CONSTRAINTS,
  PARAMETER_CONSTRAINTS,
  PRESET_FILE_CONSTRAINTS,
  WEBSOCKET_MESSAGE_TYPES,
} as const;