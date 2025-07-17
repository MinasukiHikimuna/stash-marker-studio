/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        // Parse STASH_URL to get protocol, hostname and port
        protocol: process.env.STASH_URL
          ? new URL(process.env.STASH_URL).protocol.replace(":", "")
          : "http",
        hostname: process.env.STASH_URL
          ? new URL(process.env.STASH_URL).hostname
          : "localhost",
        // Only include port if it exists in the URL
        ...(process.env.STASH_URL && new URL(process.env.STASH_URL).port
          ? { port: new URL(process.env.STASH_URL).port }
          : {}),
      },
    ],
    unoptimized: true, // Since we're dealing with local Stash server images
  },
};

export default nextConfig;
