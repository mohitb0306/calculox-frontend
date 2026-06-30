import React from 'react';
import {
  getSetting,
  getCanonicalUrl,
  normalizeSocialUrl,
  formatIsoDateWithOffset
} from '../../../lib/schemaHelpers';

interface CalculatorSchemaProps {
  data: any;
  settings: any;
  currentPath: string;
}

const CalculatorSchema = ({ data = {}, settings = {}, currentPath }: CalculatorSchemaProps) => {

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

  // --- PERFORMANCE BOOST: Removed redundant sameAs social links generation ---
  // The SoftwareApplication publisher node relies entirely on the Knowledge Graph @id linkage to the main Organization.

  // --- PATH NORMALIZATION ---
  const normalizedPath = currentPath.replace(/^\/|\/$/g, '');
  const fullUrl = normalizedPath ? `${siteUrl}/${normalizedPath}` : siteUrl;
  const schemas: any[] = [];

  const rawMetaTitle = data.meta_title === "%title%" ? "" : (data.meta_title || "");
  const title = rawMetaTitle || data.title || data.name || "";
  const description = data.meta_description || data.excerpt || data.description || "";

  // --- IMAGE ENGINE ---
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
  } else if (socialTwitterImage) {
      imageUrl = socialTwitterImage;
  } else {
      imageUrl = globalDefaultImage;
  }

  const rawPubDate = data.published_date || data.created_at;
  const rawModDate = data.updated_at || rawPubDate;

  const formattedNow = formatIsoDateWithOffset(new Date().toISOString(), siteTimezone) || new Date().toISOString();
  const datePub = formatIsoDateWithOffset(rawPubDate, siteTimezone) || formattedNow;
  const dateMod = formatIsoDateWithOffset(rawModDate, siteTimezone) || datePub;

  // =========================================================================
  // --- INTELLIGENT APPLICATION CATEGORY MAPPING ---
  // =========================================================================
  // Google recommends specific applicationCategory strings based on intent.
  const getAppCategory = (dbCategoryName: string) => {
    const lowerCat = (dbCategoryName || "").toLowerCase();
    if (lowerCat.includes('health') || lowerCat.includes('fitness') || lowerCat.includes('bmi') || lowerCat.includes('diet')) {
        return "HealthApplication";
    }
    if (lowerCat.includes('finance') || lowerCat.includes('bank') || lowerCat.includes('loan') || lowerCat.includes('mortgage') || lowerCat.includes('tax')) {
        return "FinanceApplication";
    }
    if (lowerCat.includes('math') || lowerCat.includes('education') || lowerCat.includes('science') || lowerCat.includes('physics')) {
        return "EducationalApplication";
    }
    if (lowerCat.includes('business') || lowerCat.includes('commerce')) {
        return "BusinessApplication";
    }
    
    // Default fallback if no specific keywords match
    return "UtilitiesApplication";
  };

  const resolvedAppCategory = getAppCategory(data.primary_category_name || data.category_name);

  // --- AUTOMATED SOFTWARE APPLICATION SCHEMA (GRAPH LINKED) ---
  const defaultCalcSchema: any = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${fullUrl}#software`,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${fullUrl}#webpage`
      },
      "name": title,
      "description": description,
      "url": fullUrl,
      "applicationCategory": resolvedAppCategory,
      "operatingSystem": "Any",
      "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
      },
      "image": {
          "@type": "ImageObject",
          "@id": `${fullUrl}#primaryimage`,
          "url": imageUrl,
          "width": imgWidth,
          "height": imgHeight
      },
      "datePublished": datePub,
      "dateModified": dateMod,
      "isPartOf": { 
          "@type": "WebSite", 
          "@id": `${siteUrl}/#website` 
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
      }
  };

  schemas.push(defaultCalcSchema);

  if (schemas.length === 0) return null;

  // SECURITY UPGRADE: Safely escapes the < character specifically for JSON-LD script blocks
  return (
    <>
      {schemas.map((schema, index) => (
        <script 
            key={`calculator-schema-${index}`} 
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  );
};

export default CalculatorSchema;