/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        // Parse NEXT_PUBLIC_STASH_URL to get protocol, hostname and port
        protocol: process.env.NEXT_PUBLIC_STASH_URL
          ? new URL(process.env.NEXT_PUBLIC_STASH_URL).protocol.replace(":", "")
          : "http",
        hostname: process.env.NEXT_PUBLIC_STASH_URL
          ? new URL(process.env.NEXT_PUBLIC_STASH_URL).hostname
          : "localhost",
        // Only include port if it exists in the URL
        ...(process.env.NEXT_PUBLIC_STASH_URL &&
        new URL(process.env.NEXT_PUBLIC_STASH_URL).port
          ? { port: new URL(process.env.NEXT_PUBLIC_STASH_URL).port }
          : {}),
      },
    ],
    unoptimized: true, // Since we're dealing with local Stash server images
  },
};

export default nextConfig;
