import React from 'react';
import { generateBreadcrumbs } from '@/lib/generateBreadcrumbs';
import { getSetting, getCanonicalUrl } from '@/lib/schemaHelpers';

interface SchemaProps {
  data?: any;
  settings?: any;
  currentPath: string; // Critical: Passed from Server Page
}

const BreadcrumbSchema = ({ data = {}, settings = {}, currentPath }: SchemaProps) => {

  // 1. Generate the structure
  // We pass currentPath explicitly because usePathname() isn't available in Server Components
  // CRITICAL: We pass `isSchema: true` so the generator NEVER truncates the post title.
  const crumbs = generateBreadcrumbs(settings, currentPath, data, true);

  // 2. Validation
  if (!crumbs || crumbs.length === 0) {
    return null;
  }

  // 3. Generate dynamic base URL for the @id linkage (FIXED: Fetches from database settings)
  // Extracts the Live Frontend URL defined in cPanel, falls back to env var, safely strips trailing slashes
  const rawBaseUrl = getSetting(settings, ['seo_local_url', 'app_url'], process.env.NEXT_PUBLIC_APP_URL || '');
  const baseUrl = getCanonicalUrl(rawBaseUrl).replace(/\/$/, '');
  
  const cleanCurrentPath = currentPath.replace(/^\/|\/$/g, '');
  const fullPageUrl = cleanCurrentPath ? `${baseUrl}/${cleanCurrentPath}` : baseUrl;
  
  // 4. Construct JSON-LD
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${fullPageUrl}#breadcrumb`,
    "itemListElement": crumbs.map((crumb, index) => {
      let itemUrl;
      if (crumb.url) {
        const cleanPath = crumb.url.startsWith('/') ? crumb.url : `/${crumb.url}`;
        itemUrl = `${baseUrl}${cleanPath}`;
      } else {
        // Fallback for current page if url is null
        const cleanCurrent = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
        itemUrl = `${baseUrl}${cleanCurrent}`;
      }

      return {
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.label,
        "item": itemUrl
      };
    })
  };
  
  // 5. Inject script (SECURITY UPGRADE: Escapes < to prevent breakout)
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData).replace(/</g, '\\u003c') }}
    />
  );
};

export default BreadcrumbSchema;