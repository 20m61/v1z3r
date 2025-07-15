/**
 * Production-optimized Next.js configuration
 * Enhanced for Phase 5 production optimization
 */

const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for production optimization
  experimental: {
    // Modern bundling improvements
    esmExternals: true,
    
    // Optimize font loading
    optimizeFonts: true,
    
    // Enable React 18 features
    reactStrictMode: true,
    
    // Server-side rendering optimizations
    serverMinification: true,
    
    // Optimize images
    images: {
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    },
  },

  // Compression and optimization
  compress: true,
  poweredByHeader: false,
  
  // Enhanced build optimization
  swcMinify: true,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['localhost', 'your-domain.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Headers for performance and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // Cache control for static assets
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  // Webpack optimization configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Production optimizations
    if (!dev) {
      // Bundle analyzer for production builds
      if (process.env.ANALYZE === 'true') {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: isServer ? 8888 : 8889,
            openAnalyzer: true,
          })
        );
      }

      // Advanced code splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // React and core libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              priority: 40,
              chunks: 'all',
            },
            
            // Three.js and WebGL libraries
            threejs: {
              test: /[\\/]node_modules[\\/](three|@types\/three)[\\/]/,
              name: 'threejs',
              priority: 30,
              chunks: 'async',
            },
            
            // Audio processing libraries
            audio: {
              test: /[\\/]node_modules[\\/].*audio.*[\\/]/,
              name: 'audio',
              priority: 25,
              chunks: 'async',
            },
            
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@headlessui|@heroicons|tailwindcss)[\\/]/,
              name: 'ui',
              priority: 20,
              chunks: 'all',
            },
            
            // Vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              chunks: 'all',
              reuseExistingChunk: true,
            },
            
            // Common chunks
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
        
        // Tree shaking optimization
        usedExports: true,
        sideEffects: false,
        
        // Minimize bundle size
        minimize: true,
      };

      // Module federation for micro-frontend architecture
      config.plugins.push(
        new webpack.container.ModuleFederationPlugin({
          name: 'v1z3r-main',
          remotes: {},
          shared: {
            react: { singleton: true },
            'react-dom': { singleton: true },
          },
        })
      );
    }

    // Resolve aliases for cleaner imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/store': path.resolve(__dirname, 'src/store'),
      '@/styles': path.resolve(__dirname, 'src/styles'),
    };

    // Performance hints
    config.performance = {
      hints: 'warning',
      maxEntrypointSize: 512000, // 500KB
      maxAssetSize: 512000, // 500KB
    };

    // Exclude heavy modules from SSR
    if (isServer) {
      config.externals = [
        ...config.externals,
        'three',
        'cannon',
        'canvas',
      ];
    }

    return config;
  },

  // Environment variables for runtime optimization
  env: {
    PERFORMANCE_MONITORING: process.env.NODE_ENV === 'production',
    BUNDLE_ANALYZE: process.env.ANALYZE === 'true',
  },

  // Output configuration for static deployment
  output: process.env.EXPORT_MODE === 'true' ? 'export' : undefined,
  trailingSlash: process.env.EXPORT_MODE === 'true',
  images: {
    ...nextConfig.images,
    unoptimized: process.env.EXPORT_MODE === 'true',
  },

  // Standalone mode for containerized deployment
  ...(process.env.DEPLOYMENT_MODE === 'standalone' && {
    output: 'standalone',
  }),
};

module.exports = nextConfig;