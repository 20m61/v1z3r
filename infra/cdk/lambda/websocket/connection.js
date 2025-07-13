const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('WebSocket connection event:', JSON.stringify(event, null, 2));
  
  const { eventType, connectionId, domainName, stage } = event.requestContext;
  const sessionTableName = process.env.SESSION_TABLE_NAME;
  
  try {
    if (eventType === 'CONNECT') {
      // Store connection in session table
      const sessionData = {
        sessionId: connectionId,
        connectionId,
        status: 'connected',
        createdAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hour TTL
        domainName,
        stage
      };
      
      await dynamodb.send(new PutCommand({
        TableName: sessionTableName,
        Item: sessionData
      }));
      
      console.log('Connection stored:', connectionId);
      
    } else if (eventType === 'DISCONNECT') {
      // Remove connection from session table
      await dynamodb.send(new DeleteCommand({
        TableName: sessionTableName,
        Key: { sessionId: connectionId }
      }));
      
      console.log('Connection removed:', connectionId);
    }
    
    return {
      statusCode: 200,
      body: 'OK'
    };
    
  } catch (error) {
    console.error('Connection handler error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};