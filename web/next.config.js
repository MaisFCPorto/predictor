/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination:
            "https://predictor-porto-api.predictorporto.workers.dev/api/:path*",
        },
      ];
    },
  };
  
  module.exports = nextConfig;
  