const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Preset function called:', JSON.stringify(event, null, 2));
  
  const { httpMethod, pathParameters, body, requestContext } = event;
  const presetTableName = process.env.PRESET_TABLE_NAME;
  
  // Extract user ID from API Gateway authorizer context
  // This assumes Cognito User Pool or custom authorizer is configured
  const userId = requestContext?.authorizer?.claims?.sub || 
                requestContext?.authorizer?.principalId || 
                'anonymous'; // Fallback for development only
  
  if (userId === 'anonymous' && process.env.ENVIRONMENT === 'production') {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
      },
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  try {
    switch (httpMethod) {
      case 'OPTIONS':
        return {
          statusCode: 200,
          headers,
          body: ''
        };

      case 'GET':
        if (pathParameters && pathParameters.presetId) {
          // Get specific preset
          const result = await dynamodb.send(new GetCommand({
            TableName: presetTableName,
            Key: {
              userId: userId,
              presetId: pathParameters.presetId
            }
          }));
          
          return {
            statusCode: result.Item ? 200 : 404,
            headers,
            body: JSON.stringify(result.Item || { error: 'Preset not found' })
          };
        } else {
          // List all presets for user
          const result = await dynamodb.send(new ScanCommand({
            TableName: presetTableName,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId
            }
          }));
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ presets: result.Items || [] })
          };
        }

      case 'POST':
        // Create new preset
        const createData = JSON.parse(body || '{}');
        const presetId = require('crypto').randomUUID();
        
        const newPreset = {
          userId: userId,
          presetId,
          name: createData.name || 'Untitled Preset',
          settings: createData.settings || {},
          isPublic: createData.isPublic || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await dynamodb.send(new PutCommand({
          TableName: presetTableName,
          Item: newPreset
        }));
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newPreset)
        };

      case 'PUT':
        // Update existing preset
        if (!pathParameters || !pathParameters.presetId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Preset ID required' })
          };
        }
        
        const updateData = JSON.parse(body || '{}');
        
        await dynamodb.send(new UpdateCommand({
          TableName: presetTableName,
          Key: {
            userId: userId,
            presetId: pathParameters.presetId
          },
          UpdateExpression: 'SET #name = :name, settings = :settings, isPublic = :isPublic, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#name': 'name'
          },
          ExpressionAttributeValues: {
            ':name': updateData.name,
            ':settings': updateData.settings,
            ':isPublic': updateData.isPublic || false,
            ':updatedAt': new Date().toISOString()
          }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Preset updated successfully' })
        };

      case 'DELETE':
        // Delete preset
        if (!pathParameters || !pathParameters.presetId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Preset ID required' })
          };
        }
        
        await dynamodb.send(new DeleteCommand({
          TableName: presetTableName,
          Key: {
            userId: userId,
            presetId: pathParameters.presetId
          }
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Preset deleted successfully' })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};