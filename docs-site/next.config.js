/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/v1z3r' : '',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}