import { NextResponse } from 'next/server';

// [ENTERPRISE FIX 1] Force Next.js to run this live, never at build-time.
// This prevents Coolify Docker networking failures during the build step.
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable static cache to guarantee live data fetching

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://calculox.com';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.calculox.com';
  const internalToken = process.env.INTERNAL_API_TOKEN || '';

  // ========================================================================
  // GRACEFUL FAILOVER DEFAULTS
  // ========================================================================
  const defaultRobots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

  try {
    // 1. SECURE TUNNEL CONNECTION
    // THE FIX: Removed the extra hardcoded '/api' to align with the NEXT_PUBLIC_API_URL variable
    const response = await fetch(`${apiUrl}/public/get_seo_config.php`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Accept': 'application/json'
      },
      // [ENTERPRISE FIX 2] Force fetch to bypass Next.js internal fetch cache
      cache: 'no-store',
      signal: AbortSignal.timeout(10000) // 10-second absolute timeout
    });

    if (!response.ok) {
      throw new Error(`API Offline or Rejected Token. HTTP Status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('API returned malformed SEO data.');
    }

    const {
      seo_global_search_visibility,
      seo_robots_custom_enable,
      seo_robots_custom_content
    } = result.data;

    // ========================================================================
    // 2. SEO DECISION ENGINE
    // ========================================================================
    
    // Strict boolean parsing for maximum safety
    const isIndexingEnabled = seo_global_search_visibility === true || seo_global_search_visibility === '1' || seo_global_search_visibility === 'true';
    const isCustomRobotsEnabled = seo_robots_custom_enable === true || seo_robots_custom_enable === '1' || seo_robots_custom_enable === 'true';

    // Scenario A: Global visibility is explicitly disabled in cPanel
    if (!isIndexingEnabled) {
      return new NextResponse("User-agent: *\nDisallow: /\n", {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Scenario B: Custom rules are enabled in cPanel
    if (isCustomRobotsEnabled && seo_robots_custom_content && seo_robots_custom_content.trim() !== '') {
      let output = seo_robots_custom_content.trim();
      
      if (!output.toLowerCase().includes('sitemap:')) {
        output += `\n\nSitemap: ${baseUrl}/sitemap.xml`;
      }
      return new NextResponse(output, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Scenario C: Default Safe Mode
    return new NextResponse(defaultRobots, {
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error: any) {
    // ========================================================================
    // 3. FAILOVER EXECUTION WITH DEBUG GLASS WINDOW
    // ========================================================================
    console.error('SEO Tunnel Error: Serving fallback SEO rules.', error);
    
    // [ENTERPRISE FIX 3] Inject the exact error reason into the output so we can see it live!
    const debugOutput = `${defaultRobots}\n# ==========================================\n# SYSTEM DIAGNOSTIC ERROR: \n# ${error.message}\n# ==========================================`;
    
    return new NextResponse(debugOutput, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
