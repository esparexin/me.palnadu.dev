import type {NextConfig} from 'next';

/**
 * Cloudinary is the only remote image host the administration bundle may render
 * (ADR-0010 §4). A wildcard would turn the image optimizer into an open proxy.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{protocol: 'https', hostname: 'res.cloudinary.com'}],
  },
};

export default nextConfig;
