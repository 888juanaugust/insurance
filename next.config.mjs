/** @type {import('next').NextConfig} */

/*
 * Headers every response carries. The Content-Security-Policy is set in
 * src/middleware.ts because it needs a nonce that differs per response;
 * everything that is the same for every response lives here.
 */
const production = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // Browsers that have seen HTTPS once refuse plain HTTP for a year after.
  ...(production
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
  // Belt and braces with the CSP's frame-ancestors, for browsers that only read this.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The application asks for none of these; say so.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'unpdf'],
  poweredByHeader: false,
  experimental: {
    // Policy PDFs routinely run to a few MB. Server Actions default to a 1 MB
    // body, which rejects the upload before the action can report anything
    // useful, so this sits just above the limit the upload form enforces.
    serverActions: { bodySizeLimit: '16mb' },
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
