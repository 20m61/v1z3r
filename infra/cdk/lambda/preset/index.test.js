const { handler } = require('./index');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDynamoDB = {
    scan: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  const mockS3 = {
    getObject: jest.fn().mockReturnThis(),
    putObject: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDynamoDB)
    },
    S3: jest.fn(() => mockS3)
  };
});

describe('Preset Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRESET_TABLE = 'test-preset-table';
    process.env.PRESET_BUCKET = 'test-preset-bucket';
    process.env.STAGE = 'test';
  });

  describe('OPTIONS requests', () => {
    it('should handle CORS preflight requests', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        path: '/presets'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
    });
  });

  describe('GET /presets', () => {
    it('should list all presets', async () => {
      const mockPresets = [
        { presetId: 'preset-1', name: 'Test Preset 1', version: 1 },
        { presetId: 'preset-2', name: 'Test Preset 2', version: 1 }
      ];

      const AWS = require('aws-sdk');
      const mockDynamoDB = new AWS.DynamoDB.DocumentClient();
      mockDynamoDB.promise.mockResolvedValue({
        Items: mockPresets
      });

      const event = {
        httpMethod: 'GET',
        path: '/presets'
      };

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.presets).toHaveLength(2);
      expect(mockDynamoDB.scan).toHaveBeenCalledWith({
        TableName: 'test-preset-table',
        ProjectionExpression: 'presetId, #n, description, tags, createdAt, updatedAt, #v',
        ExpressionAttributeNames: {
          '#n': 'name',
          '#v': 'version'
        }
      });
    });

    it('should handle DynamoDB errors', async () => {
      const AWS = require('aws-sdk');
      const mockDynamoDB = new AWS.DynamoDB.DocumentClient();
      mockDynamoDB.promise.mockRejectedValue(new Error('DynamoDB error'));

      const event = {
        httpMethod: 'GET',
        path: '/presets'
      };

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(500);
      expect(body.error).toBe('Failed to list presets');
    });
  });

  describe('POST /presets', () => {
    it('should create a new preset', async () => {
      const AWS = require('aws-sdk');
      const mockDynamoDB = new AWS.DynamoDB.DocumentClient();
      const mockS3 = new AWS.S3();
      
      mockDynamoDB.promise.mockResolvedValue({});
      mockS3.promise.mockResolvedValue({});

      const event = {
        httpMethod: 'POST',
        path: '/presets',
        body: JSON.stringify({
          name: 'New Preset',
          description: 'Test preset',
          data: { effects: [] }
        })
      };

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.message).toBe('Preset created successfully');
      expect(body.preset.name).toBe('New Preset');
      expect(mockS3.putObject).toHaveBeenCalled();
      expect(mockDynamoDB.put).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/presets',
        body: JSON.stringify({
          description: 'Missing name and data'
        })
      };

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toBe('Missing required fields: name, data');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON body', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/presets',
        body: 'invalid json'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });

    it('should handle missing request fields', async () => {
      const event = {};

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toBe('Invalid request format');
    });
  });
});