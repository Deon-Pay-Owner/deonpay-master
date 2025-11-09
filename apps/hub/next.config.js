/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Optimize CSS compilation for production
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
  // Ensure Tailwind CSS is properly compiled
  transpilePackages: [],
}

module.exports = nextConfig
