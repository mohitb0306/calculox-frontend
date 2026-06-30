import React from 'react';
import { getSetting, getCanonicalUrl, formatIsoDateWithOffset } from '@/lib/schemaHelpers';

interface StructureSchemaProps {
  data: any;
  settings: any;
  currentPath: string;
}

const StructureSchema = ({ data = {}, settings = {}, currentPath }: StructureSchemaProps) => {
  
  // --- EARLY EXIT: Check the new schema_enabled flag ---
  if (data.schema_enabled === false) {
    return null;
  }

  // --- ENVIRONMENT & SETTINGS ---
  const siteUrl = getCanonicalUrl(getSetting(settings, ['seo_local_url', 'app_url'], process.env.NEXT_PUBLIC_APP_URL || ""));
  const siteName = getSetting(settings, ['seo_site_name', 'siteName', 'site_name'], 'Calculox');
  
  let siteLogo = getSetting(settings, ['seo_site_logo', 'site_logo'], '');
  if (!siteLogo) siteLogo = `${siteUrl}/logo.png`;
  const logoWidth = Number(getSetting(settings, ['seo_site_logo_width'], '250')) || 250;
  const logoHeight = Number(getSetting(settings, ['seo_site_logo_height'], '60')) || 60;
  const siteTimezone = getSetting(settings, ['site_timezone', 'timezone', 'time_zone'], 'UTC');
  
  // --- PATH NORMALIZATION ---
  const normalizedPath = currentPath.replace(/^\/|\/$/g, '');
  const fullUrl = normalizedPath ? `${siteUrl}/${normalizedPath}` : siteUrl;
  const schemas: any[] = [];

  // =========================================================================
  // --- SYNCHRONIZED CASCADING IMAGE ENGINE ---
  // =========================================================================
  const title = data.meta_title || data.title || data.name || "";
  const description = data.meta_description || data.excerpt || "";
  let globalDefaultImage = getSetting(settings, ['seo_social_default_og_image', 'seo_default_og_image', 'seo_og_image'], '');
  if (!globalDefaultImage) globalDefaultImage = `${siteUrl}/default-og-image.jpg`;

  const socialOgImage = data.og_image || data.ogImage || "";
  const socialTwitterImage = data.twitter_image || data.twitterImage || "";

  let imageUrl = "";
  let imgWidth: number | undefined = undefined;
  let imgHeight: number | undefined = undefined;

  if (data.featured_image_url) {
      imageUrl = data.featured_image_url;
      imgWidth = data.featured_image_width ? Number(data.featured_image_width) : undefined;
      imgHeight = data.featured_image_height ? Number(data.featured_image_height) : undefined;
  } else if (socialOgImage) {
      imageUrl = socialOgImage;
      imgWidth = (data.og_image_width || data.ogImageWidth) ? Number(data.og_image_width || data.ogImageWidth) : undefined;
      imgHeight = (data.og_image_height || data.ogImageHeight) ? Number(data.og_image_height || data.ogImageHeight) : undefined;
  } else if (socialTwitterImage) {
      imageUrl = socialTwitterImage;
      imgWidth = (data.twitter_image_width || data.twitterImageWidth) ? Number(data.twitter_image_width || data.twitterImageWidth) : undefined;
      imgHeight = (data.twitter_image_height || data.twitterImageHeight) ? Number(data.twitter_image_height || data.twitterImageHeight) : undefined;
  } else {
      imageUrl = globalDefaultImage;
      const gWidth = getSetting(settings, ['seo_social_default_og_image_width', 'seo_default_og_image_width']);
      const gHeight = getSetting(settings, ['seo_social_default_og_image_height', 'seo_default_og_image_height']);
      imgWidth = gWidth ? Number(gWidth) : undefined;
      imgHeight = gHeight ? Number(gHeight) : undefined;
  }

  const rawPubDate = data.published_date || data.created_at;
  const rawModDate = data.updated_at || rawPubDate;
  const formattedNow = formatIsoDateWithOffset(new Date().toISOString(), siteTimezone) || new Date().toISOString();
  const datePub = formatIsoDateWithOffset(rawPubDate, siteTimezone) || formattedNow;
  const dateMod = formatIsoDateWithOffset(rawModDate, siteTimezone) || datePub;
  
  const articleSection = data.primary_category_name || (data.primary_category?.name) || data.category_name || "General";
  
  // --- ENTERPRISE FIX: Dynamic Author URL Generation ---
  // If an author slug exists, build the specific author page URL. Otherwise, fallback to the site URL.
  const authorUrl = data.author_slug ? `${siteUrl}/author/${data.author_slug}` : siteUrl;

  // --- AUTOMATED ARTICLE SCHEMA (NOW GRAPH LINKED) ---
  const defaultArticleSchema: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${fullUrl}#article`,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${fullUrl}#webpage`
    },
    "headline": title,
    "description": description,
    "image": {
      "@type": "ImageObject",
      "@id": `${fullUrl}#primaryimage`,
      "url": imageUrl,
      "width": imgWidth,
      "height": imgHeight
    },
    "datePublished": datePub,
    "dateModified": dateMod,
    "inLanguage": "en",
    "isPartOf": {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`
    },
    "author": {
      "@type": "Person",
      "name": data.author_name || siteName,
      "url": authorUrl // <-- DYNAMIC FIX APPLIED HERE
    },
    "publisher": {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": siteName,
      "logo": {
        "@type": "ImageObject",
        "url": siteLogo,
        "width": logoWidth,
        "height": logoHeight
      }
    },
    "articleSection": articleSection,
    "url": fullUrl
  };

  schemas.push(defaultArticleSchema);

  if (schemas.length === 0) {
    return null;
  }

  // SECURITY UPGRADE: Safely escapes the < character specifically for JSON-LD script blocks
  return (
    <>
      {schemas.map((schema, index) => (
        <script 
            key={`structure-schema-${index}`} 
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
};

export default StructureSchema;