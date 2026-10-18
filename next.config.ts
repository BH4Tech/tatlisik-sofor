import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone on local network to access HMR and dev server resources
  allowedDevOrigins: ['192.168.1.93', 'http://192.168.1.93:3000', '172.20.10.4', 'http://172.20.10.4:3000'],
};

export default nextConfig;
