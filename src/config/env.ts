/**
 * Environment configuration with fallbacks
 */

// Helper function to safely get environment variables
function getEnvVar(key: string, defaultValue: string = ''): string {
  // In Next.js, process.env values are replaced at build time
  // Only NEXT_PUBLIC_ prefixed variables are available on the client
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return defaultValue;
}

export const config = {
  // Application URLs
  appUrl: getEnvVar('NEXT_PUBLIC_APP_URL', 'https://v1z3r-dev.sc4pe.net'),
  apiUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'https://vphbflpav3.execute-api.ap-northeast-1.amazonaws.com/dev'),
  websocketUrl: getEnvVar('NEXT_PUBLIC_WEBSOCKET_URL', 'wss://vphbflpav3.execute-api.ap-northeast-1.amazonaws.com/dev'),
  
  // Feature flags
  enableLyrics: getEnvVar('NEXT_PUBLIC_ENABLE_LYRICS', 'true') === 'true',
  enableCollaboration: getEnvVar('NEXT_PUBLIC_ENABLE_COLLABORATION', 'true') === 'true',
  enableCloudStorage: getEnvVar('NEXT_PUBLIC_ENABLE_CLOUD_STORAGE', 'false') === 'true',
  enableWebGPU: getEnvVar('NEXT_PUBLIC_ENABLE_WEBGPU', 'true') === 'true',
  
  // Error handling
  errorEndpoint: getEnvVar('NEXT_PUBLIC_ERROR_ENDPOINT', '/api/errors'),
  rumEndpoint: getEnvVar('NEXT_PUBLIC_RUM_ENDPOINT', '/api/rum'),
  rumEnabled: getEnvVar('NEXT_PUBLIC_RUM_ENABLED', 'false') === 'true',
  
  // Environment
  environment: getEnvVar('NODE_ENV', 'production'),
  isDevelopment: getEnvVar('NODE_ENV', 'production') === 'development',
  isProduction: getEnvVar('NODE_ENV', 'production') === 'production',
};

export default config;