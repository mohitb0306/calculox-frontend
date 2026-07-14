// calculox-frontend-main/src/app/robots.txt/route.ts
import { NextResponse } from 'next/server';

// CACHING: Next.js will cache this response and only ask the database once per hour.
export const revalidate = 3600;

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://calculox.com';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'https://api.calculox.com';
  const internalToken = process.env.INTERNAL_API_TOKEN || '';

  // ========================================================================
  // GRACEFUL FAILOVER DEFAULTS
  // If the API crashes or is unreachable, this guarantees your SEO stays alive.
  // ========================================================================
  const defaultRobots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

  try {
    // 1. SECURE TUNNEL CONNECTION
    const response = await fetch(`${apiUrl}/api/public/get_seo_config.php`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Accept': 'application/json'
      },
      // Fail fast: If the API takes longer than 10 seconds, abort to protect Next.js speed.
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`API Offline or Rejected Token: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success || !json.data) {
      throw new Error('Invalid JSON received');
    }

    const { seo_global_search_visibility, seo_robots_custom_enable, seo_robots_custom_content } = json.data;

    // ========================================================================
    // 2. APPLY ADMIN PANEL RULES (Preserving 100% Functionality)
    // ========================================================================

    // Scenario A: Global visibility is explicitly disabled in cPanel
    if (!seo_global_search_visibility) {
      return new NextResponse("User-agent: *\nDisallow: /\n", {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Scenario B: Custom rules are enabled in cPanel
    if (seo_robots_custom_enable && seo_robots_custom_content && seo_robots_custom_content.trim() !== '') {
      let output = seo_robots_custom_content.trim();
      
      // Safety check: ensure Sitemap is appended if they forgot it
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

  } catch (error) {
    // ========================================================================
    // 3. FAILOVER EXECUTION
    // Log the error silently, but serve the safe defaults to search engines.
    // ========================================================================
    console.error('SEO Tunnel Error: Serving fallback SEO rules.', error);
    return new NextResponse(defaultRobots, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
