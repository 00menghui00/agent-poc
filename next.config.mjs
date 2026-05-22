/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/agent-poc',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
