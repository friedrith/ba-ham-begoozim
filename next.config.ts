import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Invite previews depend on the URL, and link scrapers Next doesn't list only read <head>.
  htmlLimitedBots: /.*/,
}

export default nextConfig
