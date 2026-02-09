const nextConfig = {
    eslint: {
      ignoreDuringBuilds: true,
    },
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
  