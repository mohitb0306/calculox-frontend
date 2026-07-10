// File: Calculox_Frontend/next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enforces strict adherence to modern React lifecycles and catches hidden bugs
  reactStrictMode: true,

  // Compiler optimizations: Strips all console.log statements in the production build
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // --- ENTERPRISE FIX: ENFORCE STRICT HTTP SECURITY HEADERS GLOBALLY ---
  async headers() {
    return [
      {
        // Apply these headers to all routes in the application
        source: '/(.*)',
        headers: [
          {
            // Prevents the browser from guessing the content type (MIME-sniffing)
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Protects against Clickjacking by preventing the site from being framed
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // Enforces HTTPS routing only (HSTS)
            // OWASP FIX: Controlled by explicit operational flags to protect subdomains without locking staging environments.
            key: 'Strict-Transport-Security',
            value: process.env.HSTS_STRICT_SUBDOMAINS === 'true'
              ? (process.env.HSTS_PRELOAD_ENABLED === 'true'
                ? 'max-age=63072000; includeSubDomains; preload'
                : 'max-age=63072000; includeSubDomains')
              : 'max-age=63072000',
          },
          {
            // Protects against legacy XSS attacks
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // Controls how much referrer information is sent with requests
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Disables access to specific browser features/APIs to reduce attack surface
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },

  // 1. Image Optimization Domain Allowlist
  images: {
    // SSRF Protection Override for Local Development
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    
    // --- NEW FIX: PREVENT IMAGE DOWNLOADING ---
    // Forces the browser to open the optimized WebP/PNG in the tab ('inline')
    // instead of forcing a file download ('attachment').
    contentDispositionType: 'inline',

    minimumCacheTTL: 86400,
    remotePatterns: process.env.NEXT_PUBLIC_API_URL ? [
      {
        protocol: new URL(process.env.NEXT_PUBLIC_API_URL).protocol.replace(':', '') as 'http' | 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_API_URL).hostname,
        port: new URL(process.env.NEXT_PUBLIC_API_URL).port, 
        pathname: '/**', // Broadened securely to handle all assets from the verified backend domain
      }
    ] : [],
  },

  // 2. Rewrites (Proxying)
  async rewrites() {
    const PHP_BACKEND = `${process.env.NEXT_PUBLIC_API_URL}/public`;
    return [
      {
        source: '/robots.txt',
        destination: `${PHP_BACKEND}/robots.php`,
      },
      {
        source: '/sitemap.xml',
        destination: `${PHP_BACKEND}/sitemap.php?type=index`,
      },
      {
        source: '/:path*-sitemap.xml',
        destination: `${PHP_BACKEND}/sitemap.php?type=:path*`,
      },
      {
        source: '/main-sitemap.xsl',
        destination: `${PHP_BACKEND}/main-sitemap.php`,
      },
    ];
  },
};

export default nextConfig;
