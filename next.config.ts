import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-5e6f060ff62c49fcb787dafead8bd8dd.r2.dev',
      },
    ],
  },
};

export default nextConfig;