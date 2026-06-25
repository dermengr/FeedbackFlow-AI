/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma in serverless/edge needs to opt out of bundling optimizations
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure native deps are not bundled
      config.externals = [...(config.externals || []), "bcryptjs"];
    }
    return config;
  },
};

export default nextConfig;
