/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('onnxruntime-node');
    } else {
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }
    return config;
  },
}
module.exports = nextConfig
