const AWS = require('aws-sdk');

// Simple auth handler for WebSocket connections
exports.handler = async (event) => {
  console.log('Auth event:', JSON.stringify(event, null, 2));
  
  const { headers, queryStringParameters, requestContext } = event;
  
  try {
    // Extract token from query parameters or headers
    const token = queryStringParameters?.token || headers?.Authorization?.replace('Bearer ', '');
    
    if (!token) {
      return {
        statusCode: 401,
        body: 'Unauthorized: No token provided'
      };
    }
    
    // TODO: Implement actual token validation
    // For now, accept any non-empty token in development
    const stage = process.env.STAGE || 'dev';
    
    if (stage === 'dev') {
      console.log('Dev mode: Accepting token:', token.substring(0, 10) + '...');
      return {
        statusCode: 200,
        body: 'Authorized',
        context: {
          userId: 'dev-user',
          permissions: ['read', 'write']
        }
      };
    }
    
    // Production token validation would go here
    // Example: JWT validation, API key lookup, etc.
    
    return {
      statusCode: 401,
      body: 'Unauthorized: Invalid token'
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
};