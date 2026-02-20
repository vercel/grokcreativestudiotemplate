import workflowNext from "workflow/next";
const { withWorkflow } = workflowNext;

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year — images are immutable (UUID-keyed)
    qualities: [60, 75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
    ],
  },
};

export default withWorkflow(nextConfig);
