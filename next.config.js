/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Conditional configuration based on environment
  ...(process.env.EXPORT_MODE === 'true' && {
    output: 'export',
    trailingSlash: true,
  }),
  // Docker standalone output for production
  ...(process.env.NODE_ENV === 'production' && process.env.DOCKER_BUILD === 'true' && {
    output: 'standalone',
  }),
  // Ensure consistent images configuration
  images: { 
    unoptimized: true,
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
    
    // Production bundle optimization
    if (process.env.NODE_ENV === 'production') {
      // Optimize code splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Three.js optimization
          three: {
            test: /[\\/]node_modules[\\/]three/,
            name: 'three',
            priority: 10,
            reuseExistingChunk: true,
          },
          // TensorFlow optimization
          tensorflow: {
            test: /[\\/]node_modules[\\/]@tensorflow/,
            name: 'tensorflow',
            priority: 10,
            reuseExistingChunk: true,
          },
          // React vendor bundle
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
            reuseExistingChunk: true,
          },
          // Common chunks
          commons: {
            minChunks: 2,
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      };

      // Minimize main bundle
      config.optimization.minimize = true;
    }
    
    return config
  },
  
  // Production performance optimizations
  experimental: {
    optimizeCss: false, // Disabled due to critters dependency issue
    optimizePackageImports: ['three', '@tensorflow/tfjs', 'zustand'],
  },
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*.webp',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*.avif',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  }
};

module.exports = nextConfig;
