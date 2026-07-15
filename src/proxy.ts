import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Ignore Next.js internal files, images, API routes, and our custom error pages
  // SECURITY FIX: Added /legal-block and /content-gone to prevent infinite routing loops
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/' ||
    pathname === '/legal-block' ||
    pathname === '/content-gone'
  ) {
    return NextResponse.next();
  }

  try {
    // 2. Clean the URL path to match your cPanel Redirection database format
    const cleanPath = pathname.replace(/^\/+/, "");

    // 3. Define the PHP Backend URL 
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.calculox.com/api';
    const fetchUrl = `${baseUrl}/public/check_redirect.php?path=${encodeURIComponent(cleanPath)}`;

    // SECURITY FIX: Implement a strict 3-second timeout to prevent Edge Worker exhaustion
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // 4. Ask the backend if a redirect rule exists for this typo/broken link
    const res = await fetch(fetchUrl, {
      method: 'GET',
      // PERFORMANCE FIX: Cache database responses at the edge for 60 seconds to prevent DDoS
      next: { revalidate: 60 },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();

      // 5. If a rule is found, process it!
      if (data.success && data.data && data.data.has_redirect) {
        const rule = data.data;

        // --- THE ENTERPRISE FIX: Handle 410 and 451 Stop Signs ---
        if (rule.status_code === 410 || rule.status_code === 451) {
          
          // Determine which premium UI and status text to use
          const isLegal = rule.status_code === 451;
          const uiPath = isLegal ? '/legal-block' : '/content-gone';
          const statusText = isLegal ? "Unavailable For Legal Reasons" : "Gone";

          // Step A: Internally fetch the beautifully designed React layout
          // DOCKER FIX: Use 127.0.0.1:3000 to bypass live server public loopback restrictions
          const internalUrl = `http://127.0.0.1:3000${uiPath}`;
          const uiResponse = await fetch(internalUrl);
          const html = await uiResponse.text();
          
          // Step B: Return that layout directly from the Edge, explicitly forcing the status
          return new NextResponse(html, {
            status: rule.status_code,
            statusText: statusText,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Robots-Tag': 'noindex, noarchive',
              'Cache-Control': 's-maxage=60, stale-while-revalidate',
            },
          });
        }

        // --- EXISTING: Handle Standard Redirects (301, 302, 307, 308) ---
        if (rule.target_url) {
          // SECURITY FIX: Ensure the target is a fully qualified URL to prevent Host Header Injection
          let target = rule.target_url;
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = new URL(target, request.url).toString();
          }

          // Apply 308 for Permanent Moves, 307 for Temporary
          const statusCode = rule.status_code === 301 || rule.status_code === 308 ? 308 : 307;

          return NextResponse.redirect(target, statusCode);
        }
      }
    }
  } catch (error) {
    // If the local PHP server is offline or busy, silently allow the user to proceed
    console.error('Proxy failed to check rule:', error);
  }

  // 6. If no redirect rule exists, let them enter the website normally
  return NextResponse.next();
}

// Configure the Proxy to patrol all paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
