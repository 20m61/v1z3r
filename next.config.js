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
  images: { unoptimized: true },
  
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
