/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pagesでのサブディレクトリ設定
  basePath: process.env.NODE_ENV === 'production' ? '/v1z3r' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/v1z3r/' : ''
};

module.exports = nextConfig;
