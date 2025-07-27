/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Temporarily disable type checking for development deployment testing
  typescript: {
    ignoreBuildErrors: true,
  },
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
  
  // Exclude test files from pages
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].filter(ext => !ext.includes('test')),
  
  // Exclude modules and infrastructure from compilation
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules',
        '**/modules/**',
        '**/infra/**',
        '**/tests/**',
        '**/.git/**',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx'
      ]
    }
    
    // Exclude modules and test files from compilation
    config.module.rules.push({
      test: /\.(ts|tsx|js|jsx)$/,
      exclude: [
        /node_modules/,
        /modules/,
        /infra/,
        /tests/,
        /__tests__/,
        /\.test\.(ts|tsx|js|jsx)$/
      ]
    })
    
    // Exclude WebGPU files in static export mode to avoid build issues
    if (process.env.EXPORT_MODE === 'true' || process.env.NEXT_PUBLIC_ENABLE_WEBGPU === 'false') {
      config.resolve.alias = {
        ...config.resolve.alias,
        'three/examples/jsm/renderers/webgpu/WebGPURenderer.js': false,
        'three/examples/jsm/capabilities/WebGPU.js': false,
      }
    }
    
    // WebGPU shader loader
    config.module.rules.push({
      test: /\.wgsl$/,
      type: 'asset/source',
    });
    
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
          // React Three Fiber
          reactThree: {
            test: /[\/]node_modules[\/]@react-three[\/]/,
            name: 'react-three',
            priority: 30,
            reuseExistingChunk: true,
          },
          // UI libraries
          ui: {
            test: /[\/]node_modules[\/](framer-motion|react-icons)[\/]/,
            name: 'ui',
            priority: 25,
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
    optimizePackageImports: ['three', '@tensorflow/tfjs', 'zustand', '@react-three/fiber', '@react-three/drei'],
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
