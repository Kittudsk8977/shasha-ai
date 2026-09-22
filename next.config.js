/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Add your object storage / CDN hostname(s) here once provisioned,
    // e.g. { remotePatterns: [{ hostname: 'cdn.shasha.ai' }] }
    remotePatterns: []
  },
  experimental: {
    serverActions: { bodySizeLimit: '25mb' }
  }
};

module.exports = nextConfig;
