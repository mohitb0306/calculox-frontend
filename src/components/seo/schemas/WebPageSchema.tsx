import React from 'react';
import { getSetting, getCanonicalUrl, normalizeSocialUrl, formatIsoDateWithOffset, hydrateSchemaObject } from '@/lib/schemaHelpers';

interface WebPageSchemaProps {
  data: any;
  settings: any;
  currentPath: string;
  collectionItems?: { name: string; url: string; }[];
  aboutTopic?: string;
}

const WebPageSchema = ({ 
  data = {}, 
  settings = {}, 
  currentPath, 
  collectionItems = [], 
  aboutTopic = "" 
}: WebPageSchemaProps) => {
  
  // --- ENVIRONMENT & SETTINGS ---
  const siteUrl = getCanonicalUrl(getSetting(settings, ['seo_local_url', 'app_url'], process.env.NEXT_PUBLIC_APP_URL || ""));
  const siteName = getSetting(settings, ['seo_site_name', 'siteName', 'site_name'], 'Calculox');
  const siteDesc = getSetting(settings, ['siteDescription', 'site_description'], '');
  let siteLogo = getSetting(settings, ['seo_site_logo', 'site_logo'], '');
  if (!siteLogo) siteLogo = `${siteUrl}/logo.png`;
  
  const logoWidth = Number(getSetting(settings, ['seo_site_logo_width'], '250')) || 250;
  const logoHeight = Number(getSetting(settings, ['seo_site_logo_height'], '60')) || 60;
  const seoSeparator = getSetting(settings, ['seo_separator', 'separator'], '-');
  const siteTimezone = getSetting(settings, ['site_timezone', 'timezone', 'time_zone'], 'UTC');

  // --- SAMEAS GENERATION (Only applied to Organization) ---
  const standardSocialLinks = [
    normalizeSocialUrl(getSetting(settings, ['seo_social_facebook', 'social_facebook']), 'https://www.facebook.com/'),
    normalizeSocialUrl(getSetting(settings, ['seo_social_twitter', 'social_twitter']), 'https://twitter.com/'),
    normalizeSocialUrl(getSetting(settings, ['seo_social_linkedin', 'social_linkedin']), 'https://www.linkedin.com/company/'),
    normalizeSocialUrl(getSetting(settings, ['seo_social_instagram', 'social_instagram']), 'https://www.instagram.com/'),
    normalizeSocialUrl(getSetting(settings, ['seo_social_youtube', 'social_youtube']), 'https://www.youtube.com/'),
    normalizeSocialUrl(getSetting(settings, ['seo_social_wikipedia']), 'https://en.wikipedia.org/wiki/')
  ];
  const rawAdditional = getSetting(settings, ['seo_social_additional_profiles'], '');
  const additionalProfiles = rawAdditional
      .split('\n')
      .map((url: string) => normalizeSocialUrl(url.trim()))
      .filter(Boolean);
  const socialLinks = Array.from(new Set([...standardSocialLinks, ...additionalProfiles])).filter(Boolean);

  // --- PATH NORMALIZATION & ROUTING ---
  const normalizedPath = currentPath.replace(/^\/|\/$/g, '');
  const fullUrl = normalizedPath ? `${siteUrl}/${normalizedPath}` : siteUrl;

  const isHomepage = normalizedPath === '' || normalizedPath === 'home';
  const aboutSlug = getSetting(settings, ['seo_page_for_about']);
  const contactSlug = getSetting(settings, ['seo_page_for_contact']);
  
  // FIX: Dynamic Page Type Routing including CollectionPage
  let pageType = "WebPage";
  if (aboutSlug && normalizedPath === aboutSlug.replace(/^\/|\/$/g, '')) {
      pageType = "AboutPage";
  } else if (contactSlug && normalizedPath === contactSlug.replace(/^\/|\/$/g, '')) {
      pageType = "ContactPage";
  } else if (collectionItems && collectionItems.length > 0) {
      pageType = "CollectionPage";
  }

  // =========================================================================
  // --- SYNCHRONIZED CASCADING IMAGE ENGINE ---
  // =========================================================================
  let rawTitle = data.meta_title || data.title || data.name || "";
  const title = rawTitle.replace(/%sep%/gi, seoSeparator).trim();
  
  let rawDescription = data.meta_description || data.excerpt || data.description || "";
  const description = rawDescription.replace(/%sep%/gi, seoSeparator).trim();
  
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

  const formattedNow = formatIsoDateWithOffset(new Date().toISOString(), siteTimezone) || new Date().toISOString();
  const rawPubDate = data.published_date || data.created_at;
  const rawModDate = data.updated_at || rawPubDate;
  
  const datePub = formatIsoDateWithOffset(rawPubDate, siteTimezone) || formattedNow;
  const dateMod = formatIsoDateWithOffset(rawModDate, siteTimezone) || datePub;

  // --- HYDRATION VARIABLES DICTIONARY ---
  const replacementVars: Record<string, any> = {
      url: fullUrl,
      seo_title: title,
      seo_description: description,
      featured_image_url: imageUrl,
      featured_image_width: imgWidth,
      featured_image_height: imgHeight,
      sitename: siteName,
      siteurl: siteUrl,
      sitelogo: siteLogo,
      sitelogo_width: logoWidth,
      sitelogo_height: logoHeight,
      sitedesc: siteDesc,
      currentyear: new Date().getFullYear().toString()
  };

  const schemas: any[] = [];

  // =========================================================================
  // --- 1. ORGANIZATION SCHEMA ---
  // =========================================================================
  if (isHomepage || pageType === "AboutPage" || pageType === "ContactPage") {
    const rawOrgSchema = getSetting(settings, ['seo_local_json_ld']);
    if (rawOrgSchema && rawOrgSchema.trim() !== "") {
      try {
        const parsedOrg = JSON.parse(rawOrgSchema);
        const hydratedOrg = hydrateSchemaObject(parsedOrg, replacementVars);
        
        if (!hydratedOrg["@id"]) {
            hydratedOrg["@id"] = `${siteUrl}/#organization`;
        }

        if (socialLinks.length > 0) {
            let existingSameAs: string[] = [];
            if (hydratedOrg.sameAs) {
                if (Array.isArray(hydratedOrg.sameAs)) existingSameAs = hydratedOrg.sameAs;
                else if (typeof hydratedOrg.sameAs === 'string') existingSameAs = [hydratedOrg.sameAs];
            }
            hydratedOrg.sameAs = Array.from(new Set([...existingSameAs, ...socialLinks]));
        }
        
        schemas.push(hydratedOrg);
      } catch (e) {
        console.error("SEO Error: Invalid Organization JSON-LD.", e);
      }
    }
  }

  // =========================================================================
  // --- 2. WEBSITE SCHEMA ---
  // =========================================================================
  if (isHomepage) {
    try {
      let rawSchema = getSetting(settings, ['seo_website_json_ld']);
      let parsedWebSiteSchema;

      if (!rawSchema || rawSchema.trim() === "") {
        const defaultWebSiteSchema: any = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          "name": "%sitename%",
          "url": "%siteurl%",
          "description": "%sitedesc%"
        };
        // Removed redundant sameAs mapping for WebSite
        parsedWebSiteSchema = defaultWebSiteSchema;
      } else {
        parsedWebSiteSchema = JSON.parse(rawSchema);
      }
      
      const hydratedWebSite = hydrateSchemaObject(parsedWebSiteSchema, replacementVars);
      if (!hydratedWebSite["@id"]) {
          hydratedWebSite["@id"] = `${siteUrl}/#website`;
      }
      schemas.push(hydratedWebSite);
    } catch (e) {
      console.error("SEO Error: Invalid WebSite JSON-LD.", e);
    }
  }

  // =========================================================================
  // --- 3. DYNAMIC ENTITY GENERATION ---
  // =========================================================================
  let mainEntity: any = undefined;
  if (collectionItems && collectionItems.length > 0) {
      mainEntity = {
          "@type": "ItemList",
          "itemListElement": collectionItems.map((item, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": item.name,
              "url": getCanonicalUrl(item.url)
          }))
      };
  }

  let aboutEntity: any = undefined;
  if (aboutTopic && aboutTopic.trim() !== "") {
      aboutEntity = { "@type": "Thing", "name": aboutTopic };
  }

  // =========================================================================
  // --- 4. WEBPAGE SCHEMA (Respects schema_enabled toggle) ---
  // =========================================================================
  if (data.schema_enabled !== false) {
      const defaultPageSchema: any = {
          "@context": "https://schema.org",
          "@type": pageType,
          "@id": `${fullUrl}#webpage`,
          "name": title,
          "description": description,
          "url": fullUrl,
          "inLanguage": "en",
          "datePublished": datePub,
          "dateModified": dateMod,
          "image": {
              "@type": "ImageObject",
              "@id": `${fullUrl}#primaryimage`,
              "url": imageUrl,
              "width": imgWidth,
              "height": imgHeight
          },
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
      
      if (mainEntity) defaultPageSchema["mainEntity"] = mainEntity;
      if (aboutEntity) defaultPageSchema["about"] = aboutEntity;

      schemas.push(defaultPageSchema);
  }

  if (schemas.length === 0) return null;
  
  return (
    <>
      {schemas.map((schema, index) => (
        <script 
          key={`webpage-schema-${index}`} 
          type="application/ld+json" 
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} 
        />
      ))}
    </>
  );
};

export default WebPageSchema;