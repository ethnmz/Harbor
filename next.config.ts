import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-app "Set up database" route runs migrations, which read the SQL files at runtime.
  outputFileTracingIncludes: {
    "/api/setup": ["./drizzle/**/*"],
  },
};

export default nextConfig;
