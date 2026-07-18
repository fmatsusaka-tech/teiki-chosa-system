import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryName = "teiki-chosa-system";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubPages ? `/${repositoryName}` : "",
  assetPrefix: isGitHubPages ? `/${repositoryName}/` : "",
};

export default nextConfig;
