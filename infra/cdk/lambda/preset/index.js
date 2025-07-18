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

// Generate unique preset ID
const generatePresetId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `preset-${timestamp}-${random}`;
};

// List all presets
const listPresets = async () => {
  try {
    const params = {
      TableName: PRESET_TABLE,
      ProjectionExpression: 'presetId, #n, description, tags, createdAt, updatedAt, #v',
      ExpressionAttributeNames: {
        '#n': 'name',
        '#v': 'version'
      }
    };
    
    const result = await dynamodb.scan(params).promise();
    
    // Group by presetId and get latest version
    const presetsMap = {};
    result.Items.forEach(item => {
      if (!presetsMap[item.presetId] || item.version > presetsMap[item.presetId].version) {
        presetsMap[item.presetId] = item;
      }
    });
    
    const presets = Object.values(presetsMap);
    return response(200, { presets });
  } catch (error) {
    console.error('Error listing presets:', error);
    return response(500, { error: 'Failed to list presets' });
  }
};

// Get a specific preset
const getPreset = async (presetId, version) => {
  try {
    const params = {
      TableName: PRESET_TABLE,
      Key: {
        presetId,
        version: version || 1
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      // If no specific version requested, get latest
      if (!version) {
        const scanParams = {
          TableName: PRESET_TABLE,
          FilterExpression: 'presetId = :pid',
          ExpressionAttributeValues: {
            ':pid': presetId
          }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        if (scanResult.Items.length > 0) {
          // Sort by version and get latest
          const latest = scanResult.Items.sort((a, b) => b.version - a.version)[0];
          
          // Get the full preset data from S3
          if (latest.s3Key) {
            const s3Params = {
              Bucket: PRESET_BUCKET,
              Key: latest.s3Key
            };
            
            const s3Data = await s3.getObject(s3Params).promise();
            latest.data = JSON.parse(s3Data.Body.toString());
          }
          
          return response(200, { preset: latest });
        }
      }
      
      return response(404, { error: 'Preset not found' });
    }
    
    // Get the full preset data from S3 if stored there
    if (result.Item.s3Key) {
      const s3Params = {
        Bucket: PRESET_BUCKET,
        Key: result.Item.s3Key
      };
      
      const s3Data = await s3.getObject(s3Params).promise();
      result.Item.data = JSON.parse(s3Data.Body.toString());
    }
    
    return response(200, { preset: result.Item });
  } catch (error) {
    console.error('Error getting preset:', error);
    return response(500, { error: 'Failed to get preset' });
  }
};

// Create a new preset
const createPreset = async (body) => {
  try {
    const preset = JSON.parse(body);
    const presetId = generatePresetId();
    const timestamp = Date.now();
    
    // Validate required fields
    if (!preset.name || !preset.data) {
      return response(400, { error: 'Missing required fields: name, data' });
    }
    
    // Store large preset data in S3
    const s3Key = `${STAGE}/presets/${presetId}/v1.json`;
    const s3Params = {
      Bucket: PRESET_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(preset.data),
      ContentType: 'application/json'
    };
    
    await s3.putObject(s3Params).promise();
    
    // Store metadata in DynamoDB
    const item = {
      presetId,
      version: 1,
      name: preset.name,
      description: preset.description || '',
      tags: preset.tags || [],
      s3Key,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: preset.userId || 'anonymous'
    };
    
    const params = {
      TableName: PRESET_TABLE,
      Item: item
    };
    
    await dynamodb.put(params).promise();
    
    return response(201, { 
      message: 'Preset created successfully',
      preset: { ...item, data: preset.data }
    });
  } catch (error) {
    console.error('Error creating preset:', error);
    return response(500, { error: 'Failed to create preset' });
  }
};

// Update an existing preset (creates new version)
const updatePreset = async (presetId, body) => {
  try {
    const updates = JSON.parse(body);
    
    // Get the latest version of the preset
    const getLatestParams = {
      TableName: PRESET_TABLE,
      FilterExpression: 'presetId = :pid',
      ExpressionAttributeValues: {
        ':pid': presetId
      }
    };
    
    const scanResult = await dynamodb.scan(getLatestParams).promise();
    
    if (scanResult.Items.length === 0) {
      return response(404, { error: 'Preset not found' });
    }
    
    // Get the highest version
    const latestVersion = Math.max(...scanResult.Items.map(item => item.version));
    const latestPreset = scanResult.Items.find(item => item.version === latestVersion);
    
    // Create new version
    const newVersion = latestVersion + 1;
    const timestamp = Date.now();
    
    // Store updated data in S3 if provided
    let s3Key = latestPreset.s3Key;
    if (updates.data) {
      s3Key = `${STAGE}/presets/${presetId}/v${newVersion}.json`;
      const s3Params = {
        Bucket: PRESET_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(updates.data),
        ContentType: 'application/json'
      };
      
      await s3.putObject(s3Params).promise();
    }
    
    // Create new version in DynamoDB
    const item = {
      presetId,
      version: newVersion,
      name: updates.name || latestPreset.name,
      description: updates.description !== undefined ? updates.description : latestPreset.description,
      tags: updates.tags || latestPreset.tags,
      s3Key,
      createdAt: latestPreset.createdAt,
      updatedAt: timestamp,
      createdBy: updates.userId || latestPreset.createdBy
    };
    
    const params = {
      TableName: PRESET_TABLE,
      Item: item
    };
    
    await dynamodb.put(params).promise();
    
    return response(200, { 
      message: 'Preset updated successfully',
      preset: { ...item, data: updates.data }
    });
  } catch (error) {
    console.error('Error updating preset:', error);
    return response(500, { error: 'Failed to update preset' });
  }
};

// Delete a preset (soft delete - marks as deleted)
const deletePreset = async (presetId) => {
  try {
    // Get all versions of the preset
    const getParams = {
      TableName: PRESET_TABLE,
      FilterExpression: 'presetId = :pid',
      ExpressionAttributeValues: {
        ':pid': presetId
      }
    };
    
    const scanResult = await dynamodb.scan(getParams).promise();
    
    if (scanResult.Items.length === 0) {
      return response(404, { error: 'Preset not found' });
    }
    
    // Mark all versions as deleted
    const timestamp = Date.now();
    const updatePromises = scanResult.Items.map(item => {
      const updateParams = {
        TableName: PRESET_TABLE,
        Key: {
          presetId: item.presetId,
          version: item.version
        },
        UpdateExpression: 'SET deletedAt = :timestamp, #s = :status',
        ExpressionAttributeNames: {
          '#s': 'status'
        },
        ExpressionAttributeValues: {
          ':timestamp': timestamp,
          ':status': 'deleted'
        }
      };
      
      return dynamodb.update(updateParams).promise();
    });
    
    await Promise.all(updatePromises);
    
    return response(200, { message: 'Preset deleted successfully' });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return response(500, { error: 'Failed to delete preset' });
  }
};

// Lambda handler
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, pathParameters, body, queryStringParameters } = event;
  
  try {
    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return response(200, {});
    }
    
    // Route based on HTTP method and path
    if (path === '/presets') {
      switch (httpMethod) {
        case 'GET':
          return await listPresets();
        case 'POST':
          return await createPreset(body);
        default:
          return response(405, { error: 'Method not allowed' });
      }
    } else if (pathParameters && pathParameters.presetId) {
      const { presetId } = pathParameters;
      const version = queryStringParameters?.version ? parseInt(queryStringParameters.version) : null;
      
      switch (httpMethod) {
        case 'GET':
          return await getPreset(presetId, version);
        case 'PUT':
          return await updatePreset(presetId, body);
        case 'DELETE':
          return await deletePreset(presetId);
        default:
          return response(405, { error: 'Method not allowed' });
      }
    }
    
    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return response(500, { error: 'Internal server error' });
  }
};