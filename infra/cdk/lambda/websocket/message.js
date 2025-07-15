const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('WebSocket message event:', JSON.stringify(event, null, 2));
  
  const { connectionId, domainName, stage } = event.requestContext;
  const sessionTableName = process.env.SESSION_TABLE_NAME;
  const apiGatewayManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });
  
  // Enhanced logging
  console.log('WebSocket API Management endpoint:', `https://${domainName}/${stage}`);
  console.log('Connection ID:', connectionId);
  console.log('Full event:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { type, action, data } = body;
    
    // Support both old 'action' format and new 'type' format
    const messageType = type || action;
    console.log('Message type:', messageType, 'data:', data);
    
    switch (messageType) {
      case 'ping':
        // Simple ping/pong for heartbeat
        await apiGatewayManagementApi.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ 
            id: body.id || 'pong-' + Date.now(),
            type: 'pong', 
            timestamp: Date.now(),
            source: 'server',
            data: { timestamp: new Date().toISOString() }
          })
        }));
        break;
        
      case 'sync':
      case 'sync_state':
      case 'parameter_update':
      case 'layer_update':
      case 'preset_update':
      case 'broadcast':
        // Sync VJ state with other connected clients
        // Get all connected sessions
        const sessions = await dynamodb.send(new ScanCommand({
          TableName: sessionTableName,
          FilterExpression: 'attribute_exists(connectionId) AND connectionId <> :currentConnection',
          ExpressionAttributeValues: {
            ':currentConnection': connectionId
          }
        }));
        
        // Broadcast sync data to other connections
        const broadcastPromises = sessions.Items.map(async (session) => {
          try {
            await apiGatewayManagementApi.send(new PostToConnectionCommand({
              ConnectionId: session.connectionId,
              Data: JSON.stringify({
                id: 'sync-' + Date.now(),
                type: messageType,
                timestamp: Date.now(),
                source: connectionId,
                data: data,
                metadata: {
                  fromConnection: connectionId,
                  serverTimestamp: new Date().toISOString()
                }
              })
            }));
          } catch (error) {
            if (error.statusCode === 410) {
              // Connection is stale, remove it
              await dynamodb.send(new DeleteCommand({
                TableName: sessionTableName,
                Key: { sessionId: session.sessionId }
              }));
            }
            console.error('Error broadcasting to connection:', session.connectionId, error);
          }
        });
        
        await Promise.all(broadcastPromises);
        break;
        
      case 'preset-share':
      case 'join_room':
      case 'leave_room':
      case 'direct_message':
        // Share preset with other connected clients
        const allSessions = await dynamodb.send(new ScanCommand({
          TableName: sessionTableName,
          FilterExpression: 'attribute_exists(connectionId) AND connectionId <> :currentConnection',
          ExpressionAttributeValues: {
            ':currentConnection': connectionId
          }
        }));
        
        const sharePromises = allSessions.Items.map(async (session) => {
          try {
            await apiGatewayManagementApi.send(new PostToConnectionCommand({
              ConnectionId: session.connectionId,
              Data: JSON.stringify({
                id: 'share-' + Date.now(),
                type: messageType === 'preset-share' ? 'preset_shared' : messageType,
                timestamp: Date.now(),
                source: connectionId,
                data: data,
                metadata: {
                  fromConnection: connectionId,
                  serverTimestamp: new Date().toISOString()
                }
              })
            }));
          } catch (error) {
            if (error.statusCode === 410) {
              await dynamodb.send(new DeleteCommand({
                TableName: sessionTableName,
                Key: { sessionId: session.sessionId }
              }));
            }
            console.error('Error sharing preset:', error);
          }
        });
        
        await Promise.all(sharePromises);
        break;
        
      default:
        console.log('Unknown message type:', messageType);
        await apiGatewayManagementApi.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({
            id: 'error-' + Date.now(),
            type: 'error',
            timestamp: Date.now(),
            source: 'server',
            data: {
              message: 'Unknown message type: ' + messageType,
              originalMessage: body
            }
          })
        }));
    }
    
    return {
      statusCode: 200,
      body: 'OK'
    };
    
  } catch (error) {
    console.error('Message handler error:', error);
    
    try {
      await apiGatewayManagementApi.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          id: 'error-' + Date.now(),
          type: 'error',
          timestamp: Date.now(),
          source: 'server',
          data: {
            message: 'Internal server error',
            error: error.message
          }
        })
      }));
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
    
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};