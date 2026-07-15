import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Calculox Enterprise Edge Middleware
 * Purpose: Securely intercepts edge traffic, queries the normalized PHP redirection API,
 * and seamlessly enforces standard redirects (301/302) and terminal rewrites (410/451).
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Normalize the path by removing the leading slash to match the database architecture
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

  if (!cleanPath) {
    return NextResponse.next();
  }

  try {
    // Resolve the internal API boundary
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.calculox.com/api';
    
    // Security & Performance: Implement a strict AbortController to prevent Edge Worker exhaustion 
    // if the backend database experiences high latency or a micro-outage.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second maximum execution allowance

    // Query the normalized API payload securely
    const response = await fetch(`${apiUrl}/public/check_redirect.php?path=${encodeURIComponent(cleanPath)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
      // Architectural Optimization: Cache the redirect check for 60 seconds at the edge.
      // This prevents a sudden traffic spike on a 410 URL from DDOSing your MariaDB backend.
      next: { revalidate: 60 } 
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();

      // Ensure the API successfully returned a positive redirect match
      if (json.success && json.data && json.data.has_redirect) {
        const { status_code, target_url } = json.data;

        // ----------------------------------------------------------------------
        // TERMINAL STATUS CODES (SEO COMPLIANCE & LEGAL)
        // ----------------------------------------------------------------------
        // We rewrite the URL silently to serve the custom error pages while 
        // forcing the exact HTTP status code back to Googlebot and the browser.
        
        if (status_code === 410) {
          return NextResponse.rewrite(new URL('/content-gone', request.url), { status: 410 });
        }
        
        if (status_code === 451) {
          return NextResponse.rewrite(new URL('/legal-block', request.url), { status: 451 });
        }

        // ----------------------------------------------------------------------
        // STANDARD FORWARDING STATUS CODES (301, 302, 307, 308)
        // ----------------------------------------------------------------------
        // We execute a standard browser-level location header redirect.
        
        const validRedirectCodes = [301, 302, 303, 307, 308];
        if (validRedirectCodes.includes(status_code) && target_url) {
          // Guarantee absolute URL formation to prevent host-header injection attacks
          let finalUrl = target_url;
          if (!target_url.startsWith('http://') && !target_url.startsWith('https://')) {
            finalUrl = new URL(target_url, request.url).toString();
          }
          return NextResponse.redirect(finalUrl, status_code);
        }
      }
    }
  } catch (error) {
    // Fail-Open Security Posture:
    // If the API request times out or fails, we silently log it and let the user proceed.
    // This ensures your Next.js application stays online even if the PHP backend restarts.
    console.error('[Middleware] Redirection check failed:', error);
  }

  // If no redirect is found, permit the Next.js router to handle the page normally.
  return NextResponse.next();
}

// Config blocks the middleware from intercepting static assets, images, and API routes.
// This preserves server performance and significantly lowers bandwidth costs.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)',
  ],
};
