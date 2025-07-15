exports.handler = async (event) => {
  console.log('Metrics function triggered', event);
  
  // Metrics collection logic would go here
  // For now, just return success
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Metrics collection completed',
      timestamp: new Date().toISOString(),
      environment: process.env.STAGE || 'unknown'
    })
  };
};