/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pagesでのサブディレクトリ設定
  basePath: process.env.NODE_ENV === 'production' ? '/v1z3r' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/v1z3r/' : '',
  // 静的エクスポートの場合は以下を追加
  trailingSlash: true
};

module.exports = nextConfig;
