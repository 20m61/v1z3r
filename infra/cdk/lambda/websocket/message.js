const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
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
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { action, data } = body;
    
    console.log('Message action:', action, 'data:', data);
    
    switch (action) {
      case 'ping':
        // Simple ping/pong for heartbeat
        await apiGatewayManagementApi.postToConnection({
          ConnectionId: connectionId,
          Data: JSON.stringify({ action: 'pong', timestamp: new Date().toISOString() })
        }).promise();
        break;
        
      case 'sync':
        // Sync VJ state with other connected clients
        // Get all connected sessions
        const sessions = await dynamodb.scan({
          TableName: sessionTableName,
          FilterExpression: 'attribute_exists(connectionId) AND connectionId <> :currentConnection',
          ExpressionAttributeValues: {
            ':currentConnection': connectionId
          }
        }).promise();
        
        // Broadcast sync data to other connections
        const broadcastPromises = sessions.Items.map(async (session) => {
          try {
            await apiGatewayManagementApi.postToConnection({
              ConnectionId: session.connectionId,
              Data: JSON.stringify({
                action: 'sync',
                data: data,
                fromConnection: connectionId,
                timestamp: new Date().toISOString()
              })
            }).promise();
          } catch (error) {
            if (error.statusCode === 410) {
              // Connection is stale, remove it
              await dynamodb.delete({
                TableName: sessionTableName,
                Key: { sessionId: session.sessionId }
              }).promise();
            }
            console.error('Error broadcasting to connection:', session.connectionId, error);
          }
        });
        
        await Promise.all(broadcastPromises);
        break;
        
      case 'preset-share':
        // Share preset with other connected clients
        const allSessions = await dynamodb.scan({
          TableName: sessionTableName,
          FilterExpression: 'attribute_exists(connectionId) AND connectionId <> :currentConnection',
          ExpressionAttributeValues: {
            ':currentConnection': connectionId
          }
        }).promise();
        
        const sharePromises = allSessions.Items.map(async (session) => {
          try {
            await apiGatewayManagementApi.postToConnection({
              ConnectionId: session.connectionId,
              Data: JSON.stringify({
                action: 'preset-shared',
                preset: data,
                fromConnection: connectionId,
                timestamp: new Date().toISOString()
              })
            }).promise();
          } catch (error) {
            if (error.statusCode === 410) {
              await dynamodb.delete({
                TableName: sessionTableName,
                Key: { sessionId: session.sessionId }
              }).promise();
            }
            console.error('Error sharing preset:', error);
          }
        });
        
        await Promise.all(sharePromises);
        break;
        
      default:
        console.log('Unknown action:', action);
        await apiGatewayManagementApi.postToConnection({
          ConnectionId: connectionId,
          Data: JSON.stringify({
            action: 'error',
            message: 'Unknown action',
            timestamp: new Date().toISOString()
          })
        }).promise();
    }
    
    return {
      statusCode: 200,
      body: 'OK'
    };
    
  } catch (error) {
    console.error('Message handler error:', error);
    
    try {
      await apiGatewayManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          action: 'error',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        })
      }).promise();
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
    
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};