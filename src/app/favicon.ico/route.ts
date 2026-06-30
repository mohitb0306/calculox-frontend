import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/content';

// Revalidate this route every 1 hour (3600 seconds) to ensure high performance
// while keeping the icon reasonably fresh if changed in cPanel.
export const revalidate = 3600; 

export async function GET() {
  try {
    // 1. Fetch Global Settings from Database
    const settings = await getSiteSettings();
    const siteIconUrl = settings?.site_icon;

    // 2. Intercept & Stream the Uploaded Icon
    if (siteIconUrl && typeof siteIconUrl === 'string') {
      
      // Basic URL validation to prevent malformed fetches
      let isValidUrl = true;
      try {
        new URL(siteIconUrl);
      } catch (e) {
        isValidUrl = false;
      }

      if (isValidUrl) {
        const imageResponse = await fetch(siteIconUrl, {
          // Prevent the Next.js server from hanging infinitely if the PHP server is slow
          signal: AbortSignal.timeout(5000) 
        });

        if (imageResponse.ok) {
          const buffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get('content-type') || 'image/x-icon';

          // Stream the image back to the browser exactly like a physical file
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              // Cache aggressively in the user's browser and edge CDN for 24 hours
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
            },
          });
        }
      }
    }

    // 3. The Fallback (If no icon is set in cPanel or the fetch fails)
    // Returns a microscopic, transparent 16x16 SVG to prevent 404 errors in browser consoles
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="transparent"/></svg>`;
    
    return new NextResponse(fallbackSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });

  } catch (error) {
    console.error('SEO Error: Failed to generate dynamic favicon:', error);
    
    // Fallback on severe error
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="transparent"/></svg>`;
    return new NextResponse(errorSvg, {
      status: 200, // Return 200 to satisfy dumb bots even on error
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  }
}