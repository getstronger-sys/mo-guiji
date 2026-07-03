import type { NextConfig } from "next";

const GUARDRAIL_API = process.env.GUARDRAIL_API_URL ?? "http://127.0.0.1:8340";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/trajectories", destination: `${GUARDRAIL_API}/api/trajectories` },
      { source: "/api/trajectories/:id", destination: `${GUARDRAIL_API}/api/trajectories/:id` },
      { source: "/api/metrics", destination: `${GUARDRAIL_API}/api/metrics` },
      { source: "/api/guardrail/check", destination: `${GUARDRAIL_API}/api/guardrail/check` },
      { source: "/api/xai/status", destination: `${GUARDRAIL_API}/api/xai/status` },
      { source: "/api/xai/attribute", destination: `${GUARDRAIL_API}/api/xai/attribute` },
    ];
  },
};

export default nextConfig;
