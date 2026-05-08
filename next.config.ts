import type { NextConfig } from "next";

// 临时禁用 PWA 以排查缓存问题
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true, // 完全禁用 PWA
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig: NextConfig = {
  // 禁用开发工具指示器（移除左下角 N 字悬浮按钮）
  devIndicators: false,
  // 图片配置
  images: {
    unoptimized: true,
    // 配置允许的图片域名
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pindoutuzhi.tos-cn-beijing.volces.com',
      },
      {
        protocol: 'https',
        hostname: 'p9-aiop-sign.byteimg.com',
      },
      {
        protocol: 'https',
        hostname: 'code.coze.cn',
      },
    ],
  },
  // 开发环境允许的跨域请求
  allowedDevOrigins: ['dcd978ab-4c2b-45fc-b68d-90e2384e2776.dev.coze.site'],
};

export default withPWA(nextConfig);
