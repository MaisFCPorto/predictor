import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // não falha build se houver avisos de lint
    ignoreDuringBuilds: true,
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
