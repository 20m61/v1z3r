// Simple Lambda function for testing
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const PRESET_TABLE = process.env.PRESET_TABLE;
const PRESET_BUCKET = process.env.PRESET_BUCKET;
const STAGE = process.env.STAGE;

// Helper function to generate response
const response = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers
  },
  body: JSON.stringify(body)
});

// Lambda handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, pathParameters, body, queryStringParameters } = event;
  
  try {
    // Validate request
    if (!httpMethod || !path) {
      return response(400, { error: 'Invalid request format' });
    }
    
    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return response(200, {});
    }
    
    // Simple test endpoints
    if (path === '/presets') {
      if (httpMethod === 'GET') {
        // List presets (simple scan)
        const params = {
          TableName: PRESET_TABLE,
          Limit: 10
        };
        
        const result = await dynamodb.scan(params).promise();
        return response(200, { 
          presets: result.Items || [],
          count: result.Items ? result.Items.length : 0,
          table: PRESET_TABLE
        });
      } else if (httpMethod === 'POST') {
        // Create preset
        const preset = JSON.parse(body);
        const timestamp = Date.now();
        const presetId = `preset-${timestamp}`;
        
        if (!preset.name) {
          return response(400, { error: 'Missing required field: name' });
        }
        
        const item = {
          presetId,
          version: 1,
          name: preset.name,
          description: preset.description || '',
          data: preset.data || {},
          createdAt: timestamp,
          updatedAt: timestamp
        };
        
        const params = {
          TableName: PRESET_TABLE,
          Item: item
        };
        
        await dynamodb.put(params).promise();
        
        return response(201, {
          message: 'Preset created successfully',
          preset: item
        });
      }
    }
    
    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return response(500, { 
      error: 'Internal server error',
      details: error.message,
      table: PRESET_TABLE
    });
  }
};