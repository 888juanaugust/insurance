/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'unpdf'],
  experimental: {
    // Policy PDFs routinely run to a few MB. Server Actions default to a 1 MB
    // body, which rejects the upload before the action can report anything
    // useful, so this sits just above the limit the upload form enforces.
    serverActions: { bodySizeLimit: '16mb' },
  },
};

export default nextConfig;
