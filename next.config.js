/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Conditional configuration based on environment
  ...(process.env.EXPORT_MODE === 'true' && {
    output: 'export',
    basePath: '/v1z3r',
    assetPrefix: '/v1z3r/',
    trailingSlash: true,
  }),
  // Docker standalone output for production
  ...(process.env.NODE_ENV === 'production' && process.env.DOCKER_BUILD === 'true' && {
    output: 'standalone',
  }),
  // Ensure consistent images configuration
  images: { 
    unoptimized: true,
    // Consistent path prefix for all environments
    path: process.env.EXPORT_MODE === 'true' ? '/v1z3r/_next/image' : '/_next/image'
  },
  
  // Exclude modules and infrastructure from compilation
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules',
        '**/modules/**',
        '**/infra/**',
        '**/tests/**',
        '**/.git/**'
      ]
    }
    
    // Exclude modules from compilation
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      exclude: [
        /node_modules/,
        /modules/,
        /infra/,
        /tests/
      ]
    })
    
    return config
  }
};

module.exports = nextConfig;
