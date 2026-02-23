import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["@fatsolutions/tongo-sdk"],
  webpack: (config) => {
    // Workaround: Tongo SDK provers reference ../../src/utils (TS source)
    // instead of ../utils (compiled JS). Alias the broken path.
    const sdkRoot = path.dirname(
      require.resolve("@fatsolutions/tongo-sdk/package.json")
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.join(sdkRoot, "src", "utils")]: path.join(
        sdkRoot,
        "dist",
        "utils.js"
      ),
    };
    return config;
  },
};

export default nextConfig;
