exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Health check passed',
      timestamp: new Date().toISOString(),
      environment: process.env.STAGE || 'unknown'
    })
  };
};