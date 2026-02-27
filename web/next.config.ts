import type { NextConfig } from "next";

const predictorBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const shopBase = (process.env.NEXT_PUBLIC_SHOP_API_URL || '').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  outputFileTracingRoot: require('path').join(__dirname, '..'),
  eslint: {
    // não falha build se houver avisos de lint
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const rules: { source: string; destination: string }[] = [];

    if (predictorBase) {
      rules.push({ source: '/api/:path*', destination: `${predictorBase}/api/:path*` });
    }

    if (shopBase) {
      rules.push({ source: '/shop/:path*', destination: `${shopBase}/shop/:path*` });
    }

    return rules;
  },
  images: {
    // se quiseres usar <Image/> depois
    remotePatterns: [
      { protocol: "https", hostname: "www.betano.pt" },
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  }
};

export default nextConfig;
