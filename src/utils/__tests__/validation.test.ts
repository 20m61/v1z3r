import {
  validateAudioData,
  validateOpacity,
  validateSensitivity,
  validateColorTheme,
  validateEffectType,
  validateSpeed,
  validateVJParameters,
  validateWebSocketMessage,
  validatePresetFile,
  validateURL,
  ValidationError,
  VALIDATION_CONSTRAINTS,
} from '../validation';

describe('Validation Utils', () => {
  describe('validateAudioData', () => {
    it('validates correct audio data', () => {
      const data = new Uint8Array(128).fill(100);
      expect(validateAudioData(data)).toBe(data);
    });

    it('throws error for undefined data', () => {
      expect(() => validateAudioData(undefined)).toThrow(ValidationError);
    });

    it('throws error for non-Uint8Array data', () => {
      expect(() => validateAudioData([1, 2, 3] as any)).toThrow(ValidationError);
    });

    it('throws error for data too short', () => {
      const data = new Uint8Array(16);
      expect(() => validateAudioData(data)).toThrow('Audio data too short');
    });

    it('throws error for data too long', () => {
      const data = new Uint8Array(10000);
      expect(() => validateAudioData(data)).toThrow('Audio data too long');
    });

    it('validates all values are within range', () => {
      // Since Uint8Array automatically clamps values to 0-255, 
      // this test validates that the validation function accepts valid data
      const data = new Uint8Array(128);
      data.fill(128); // Fill with valid values
      expect(() => validateAudioData(data)).not.toThrow();
    });
  });

  describe('validateOpacity', () => {
    it('validates correct opacity values', () => {
      expect(validateOpacity(0)).toBe(0);
      expect(validateOpacity(0.5)).toBe(0.5);
      expect(validateOpacity(1)).toBe(1);
    });

    it('throws error for non-number values', () => {
      expect(() => validateOpacity('0.5' as any)).toThrow(ValidationError);
      expect(() => validateOpacity(NaN)).toThrow(ValidationError);
    });

    it('throws error for values out of range', () => {
      expect(() => validateOpacity(-0.1)).toThrow('Opacity must be between');
      expect(() => validateOpacity(1.1)).toThrow('Opacity must be between');
    });
  });

  describe('validateSensitivity', () => {
    it('validates correct sensitivity values', () => {
      expect(validateSensitivity(0.1)).toBe(0.1);
      expect(validateSensitivity(1.0)).toBe(1.0);
      expect(validateSensitivity(5.0)).toBe(5.0);
    });

    it('throws error for values out of range', () => {
      expect(() => validateSensitivity(0.05)).toThrow('Sensitivity must be between');
      expect(() => validateSensitivity(5.1)).toThrow('Sensitivity must be between');
    });
  });

  describe('validateColorTheme', () => {
    it('validates correct hex colors', () => {
      expect(validateColorTheme('#ffffff')).toBe('#ffffff');
      expect(validateColorTheme('#000000')).toBe('#000000');
      expect(validateColorTheme('#ff0000')).toBe('#ff0000');
    });

    it('throws error for invalid hex colors', () => {
      expect(() => validateColorTheme('ffffff')).toThrow('Color theme must be a valid hex color');
      expect(() => validateColorTheme('#fff')).toThrow('Color theme must be a valid hex color');
      expect(() => validateColorTheme('#gggggg')).toThrow('Color theme must be a valid hex color');
    });

    it('throws error for non-string values', () => {
      expect(() => validateColorTheme(123 as any)).toThrow('Color theme must be a string');
    });
  });

  describe('validateEffectType', () => {
    it('validates correct effect types', () => {
      expect(validateEffectType('spectrum')).toBe('spectrum');
      expect(validateEffectType('waveform')).toBe('waveform');
      expect(validateEffectType('particles')).toBe('particles');
    });

    it('throws error for invalid effect types', () => {
      expect(() => validateEffectType('invalid')).toThrow('Effect type must be one of');
    });

    it('throws error for non-string values', () => {
      expect(() => validateEffectType(123 as any)).toThrow('Effect type must be a string');
    });
  });

  describe('validateSpeed', () => {
    it('validates correct speed values', () => {
      expect(validateSpeed(0.1)).toBe(0.1);
      expect(validateSpeed(1.0)).toBe(1.0);
      expect(validateSpeed(3.0)).toBe(3.0);
    });

    it('throws error for values out of range', () => {
      expect(() => validateSpeed(0.05)).toThrow('Speed must be between');
      expect(() => validateSpeed(3.1)).toThrow('Speed must be between');
    });
  });

  describe('validateVJParameters', () => {
    it('validates correct parameter set', () => {
      const params = {
        opacity: 0.8,
        sensitivity: 1.5,
        colorTheme: '#ff0000',
        effectType: 'spectrum',
        speed: 2.0,
      };

      const result = validateVJParameters(params);
      expect(result).toEqual(params);
    });

    it('validates partial parameter set', () => {
      const params = {
        opacity: 0.5,
        colorTheme: '#00ff00',
      };

      const result = validateVJParameters(params);
      expect(result).toEqual(params);
    });

    it('throws error for invalid parameters', () => {
      const params = {
        opacity: 1.5, // Invalid
        colorTheme: '#ff0000',
      };

      expect(() => validateVJParameters(params)).toThrow(ValidationError);
    });
  });

  describe('validateWebSocketMessage', () => {
    it('validates correct WebSocket message', () => {
      const message = {
        type: 'parameter_update',
        payload: { opacity: 0.5 },
        timestamp: Date.now(),
        userId: 'user-123',
      };

      const result = validateWebSocketMessage(message);
      expect(result).toEqual(message);
    });

    it('validates message without optional fields', () => {
      const message = {
        type: 'sync_request',
      };

      const result = validateWebSocketMessage(message);
      expect(result).toEqual(message);
    });

    it('throws error for missing type', () => {
      const message = {
        payload: { opacity: 0.5 },
      };

      expect(() => validateWebSocketMessage(message)).toThrow('WebSocket message must have a string type');
    });

    it('throws error for invalid type', () => {
      const message = {
        type: 'invalid_type',
      };

      expect(() => validateWebSocketMessage(message)).toThrow('Invalid WebSocket message type');
    });

    it('throws error for invalid timestamp', () => {
      const message = {
        type: 'parameter_update',
        timestamp: -1,
      };

      expect(() => validateWebSocketMessage(message)).toThrow('WebSocket message timestamp must be a positive number');
    });

    it('throws error for invalid userId', () => {
      const message = {
        type: 'parameter_update',
        userId: 'user@invalid!',
      };

      expect(() => validateWebSocketMessage(message)).toThrow('WebSocket message userId contains invalid characters');
    });
  });

  describe('validatePresetFile', () => {
    it('validates correct JSON file', () => {
      const file = new File(['{}'], 'preset.json', { type: 'application/json' });
      expect(validatePresetFile(file)).toBe(file);
    });

    it('throws error for file too large', () => {
      // Create a large file (mock)
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.json', { type: 'application/json' });
      expect(() => validatePresetFile(file)).toThrow('File too large');
    });

    it('throws error for invalid file type', () => {
      const file = new File(['data'], 'image.png', { type: 'image/png' });
      expect(() => validatePresetFile(file)).toThrow('Invalid file type');
    });

    it('throws error for invalid file extension', () => {
      const file = new File(['data'], 'preset.exe', { type: 'application/json' });
      expect(() => validatePresetFile(file)).toThrow('Invalid file extension');
    });
  });

  describe('validateURL', () => {
    it('validates correct HTTPS URL', () => {
      const url = 'https://example.com/api/endpoint';
      expect(validateURL(url)).toBe(url);
    });

    it('validates HTTP URL in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const url = 'http://localhost:3000/api';
      expect(validateURL(url)).toBe(url);

      process.env.NODE_ENV = originalEnv;
    });

    it('throws error for non-HTTPS URL in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const url = 'http://example.com/api';
      expect(() => validateURL(url)).toThrow('Only HTTPS URLs are allowed in production');

      process.env.NODE_ENV = originalEnv;
    });

    it('validates URL with allowed domains', () => {
      const url = 'https://api.example.com/endpoint';
      const allowedDomains = ['api.example.com', 'cdn.example.com'];
      expect(validateURL(url, allowedDomains)).toBe(url);
    });

    it('throws error for disallowed domain', () => {
      const url = 'https://malicious.com/endpoint';
      const allowedDomains = ['api.example.com'];
      expect(() => validateURL(url, allowedDomains)).toThrow('Domain not allowed');
    });

    it('throws error for invalid URL format', () => {
      expect(() => validateURL('not-a-url')).toThrow('Invalid URL format');
    });

    it('throws error for invalid protocol', () => {
      expect(() => validateURL('ftp://example.com/file')).toThrow('Only HTTP and HTTPS protocols are allowed');
    });
  });

  describe('ValidationError', () => {
    it('creates error with message and field', () => {
      const error = new ValidationError('Test message', 'testField');
      expect(error.message).toBe('Test message');
      expect(error.field).toBe('testField');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('VALIDATION_CONSTRAINTS', () => {
    it('exports all constraint constants', () => {
      expect(VALIDATION_CONSTRAINTS.AUDIO_DATA_CONSTRAINTS).toBeDefined();
      expect(VALIDATION_CONSTRAINTS.PARAMETER_CONSTRAINTS).toBeDefined();
      expect(VALIDATION_CONSTRAINTS.PRESET_FILE_CONSTRAINTS).toBeDefined();
      expect(VALIDATION_CONSTRAINTS.WEBSOCKET_MESSAGE_TYPES).toBeDefined();
    });
  });
});