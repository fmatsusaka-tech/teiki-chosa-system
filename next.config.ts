import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubPages ? "/teiki-chosa-system" : "",
  assetPrefix: isGitHubPages ? "/teiki-chosa-system/" : "",
};

export default nextConfig;
