import { Metadata } from 'next';
import { replaceVariables, capitalizeTitle } from './metaHelpers';

interface SeoProps {
  data: any;
  // The page/post data from DB
  settings: any;    // Global settings from DB
  type: 'post' | 'page' | 'calculator' | 'blog-category' | 'calculator-category' | 'tag-archive' | '404' | 'search' | 'auth-login' | 'auth-register' | 'auth-reset' | 'date-archive' | 'author-archive' | 'homepage';
  context?: any;    // Extra data (e.g. category name)
  path?: string;
  // Current URL path
}

// 🚀 ENTERPRISE SMO FIX: Dynamic MIME Type Parser
// Reads the file extension from the URL to provide crawlers with the exact image type
const getImageMimeType = (url: string): string | undefined => {
  if (!url) return undefined;
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0]; // Strip query parameters if any
  
  switch (extension) {
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'image/jpeg'; // Standard safe fallback
  }
};

export function constructMetadata({ data = {}, settings = {}, type, context = {}, path = '' }: SeoProps): Metadata {
  
  const siteName = settings.siteName || "Calculox";
  
  // ARCHITECTURE FIX: Single Source of Truth (Environment -> Hard Fallback)
  // Strip trailing slashes to prevent Canonical double-slash (e.g. calculox.com//blog)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || "https://calculox.com";
  const baseUrl = envUrl.replace(/\/$/, ""); 
  const currentUrl = `${baseUrl}${path}`;

  // =========================================================
  // 1. TITLE LOGIC
  // =========================================================
  const generateTitle = () => {
    if (data.meta_title && String(data.meta_title).trim() !== "") {
      return replaceVariables(data.meta_title, data, settings, context);
    }

    const keyMap: Record<string, string> = {
      post: "seo_post_title_template",
      page: "seo_page_title_template",
      calculator: "seo_calc_title_template",
      "blog-category": "seo_tax_blog_category_title_template",
      "calculator-category": "seo_tax_calc_category_title_template",
      "tag-archive": "seo_tax_tag_title_template",
      404: "seo_special_404_title",
      search: "seo_special_search_title",
      "auth-login": "seo_auth_login_title",
      "auth-register": "seo_auth_register_title",
      "auth-reset": "seo_auth_reset_title",
      "date-archive": "seo_archive_date_title",
      "author-archive": "seo_archive_author_title",
    };

    const templateKey = keyMap[type];
    if (templateKey && settings[templateKey]) {
      return replaceVariables(settings[templateKey], data, settings, context);
    }

    if (type === 'homepage') {
        return siteName;
    }

    const pageTitle = data.title || data.name || context.name || siteName;
    const separator = settings.seo_separator || "-";
    return pageTitle === siteName
      ? siteName
      : `${pageTitle} ${separator} ${siteName}`;
  };

  let title = generateTitle();

  if (settings.seo_capitalize_titles === true || settings.seo_capitalize_titles === 'true') {
      title = capitalizeTitle(title);
  }

  // =========================================================
  // 2. DESCRIPTION LOGIC
  // =========================================================
  const generateDescription = () => {
    if (data.meta_description && String(data.meta_description).trim() !== "") {
      return replaceVariables(data.meta_description, data, settings, context);
    }
    if (data.description && String(data.description).trim() !== "") {
      return data.description;
    }
    
    const keyMap: Record<string, string> = {
      post: "seo_post_desc_template",
      page: "seo_page_desc_template",
      calculator: "seo_calc_desc_template",
      "blog-category": "seo_tax_blog_category_desc_template",
      "calculator-category": "seo_tax_calc_category_desc_template",
      "tag-archive": "seo_tax_tag_desc_template",
      // NEW: Added Auth Pages Description Mapping to pull from DB settings
      "auth-login": "seo_auth_login_description",
      "auth-register": "seo_auth_register_description",
      "auth-reset": "seo_auth_reset_description",
    };
    const templateKey = keyMap[type];
    if (templateKey && settings[templateKey]) {
      return replaceVariables(settings[templateKey], data, settings, context);
    }
    return data.excerpt || settings.seo_global_description || "";
  };

  const description = generateDescription();

  // =========================================================
  // 3. SOCIAL TEXT FALLBACKS (WITH SYNC LOGIC)
  // =========================================================
  const ogTitle = (data.og_title && String(data.og_title).trim() !== "") ? data.og_title : title;
  const ogDescription = (data.og_description && String(data.og_description).trim() !== "") ? data.og_description : description;
  
  // DB Sync State parsing
  const isTwitterSync = (data.twitter_sync === undefined || data.twitter_sync === null) 
      ? true 
      : Boolean(Number(data.twitter_sync));

  const twitterTitle = isTwitterSync
      ? ogTitle // Sync ON (A): FB -> Meta -> Post
      : ((data.twitter_title && String(data.twitter_title).trim() !== "") ? data.twitter_title : title); // Sync OFF (B): Twitter -> Meta -> Post

  const twitterDescription = isTwitterSync
      ? ogDescription // Sync ON (A): FB -> Meta -> Post
      : ((data.twitter_description && String(data.twitter_description).trim() !== "") ? data.twitter_description : description); // Sync OFF (B): Twitter -> Meta -> Post

  // =========================================================
  // 4. IMAGE LOGIC (FIXED HARDCODED DIMENSIONS & ADDED MIME TYPE)
  // =========================================================
  const buildImageObject = (url: string, width: any, height: any, altSource: string, fallbackAlt: string) => ({
      url: url,
      width: Number(width) || 1200,
      height: Number(height) || 630,
      alt: altSource || fallbackAlt,
      type: getImageMimeType(url) // 🚀 Injects og:image:type automatically
  });
  
  const ogImages = [];
  if (data.og_image && String(data.og_image).trim() !== "") {
    ogImages.push(buildImageObject(data.og_image, data.og_image_width, data.og_image_height, data.og_image_alt, title));
  } else if (data.featured_image_url) {
    ogImages.push(buildImageObject(data.featured_image_url, data.featured_image_width, data.featured_image_height, data.featured_image_alt, title));
  } else if (settings.seo_social_default_og_image) {
    const globalAlt = settings.seo_social_default_og_image_alt || siteName;
    ogImages.push(buildImageObject(settings.seo_social_default_og_image, settings.seo_social_default_og_image_width, settings.seo_social_default_og_image_height, globalAlt, siteName));
  }

  let twitterImages = [];
  if (isTwitterSync) {
    twitterImages = ogImages; // Sync ON: Mirror Facebook Images completely
  } else {
    if (data.twitter_image && String(data.twitter_image).trim() !== "") {
      twitterImages.push(buildImageObject(data.twitter_image, data.twitter_image_width, data.twitter_image_height, data.twitter_image_alt, title));
    } else {
      twitterImages = ogImages; // Fallback to OG/Featured if no custom twitter image is set
    }
  }

  // =========================================================
  // 5. ROBOTS CASCADING LOGIC (FIXED)
  // =========================================================
  const getRobots = () => {
    // --- 0. ENTERPRISE SHIELD: MASTER OVERRIDE ---
    const isGlobalSearchEnabled = settings?.seo_global_search_visibility === true || settings?.seo_global_search_visibility === 'true' || settings?.seo_global_search_visibility === '1' || settings?.seo_global_search_visibility === 1;
    
    if (!isGlobalSearchEnabled) {
        return {
            index: false,
            follow: false,
            nocache: true,
            googleBot: {
                index: false,
                follow: false,
                noimageindex: true,
                'max-video-preview': -1,
                'max-image-preview': 'none',
                'max-snippet': -1,
            }
        };
    }

    // --- CLEAN, INDUSTRY-STANDARD 404 TAGS ---
    if (type === '404') {
        return {
            index: false,
            follow: true,
            googleBot: {
                index: false,
                follow: true,
            }
        };
    }

    const keyMap: Record<string, string> = {
      post: "seo_post_robots_",
      page: "seo_page_robots_",
      calculator: "seo_calc_robots_",
      "blog-category": "seo_tax_blog_category_robots_",
      "calculator-category": "seo_tax_calc_category_robots_",
      "tag-archive": "seo_tax_tag_robots_",
      "auth-login": "seo_auth_login_robots_",
      "auth-register": "seo_auth_register_robots_",
      "auth-reset": "seo_auth_reset_robots_",
    };
    const templatePrefix = keyMap[type] || null;

    const toBool = (val: any) => val === true || val === "true" || val === 1 || val === "1";

    const getDirective = (dataKey: string, settingSuffix: string) => {
      if (data && data[dataKey] !== undefined && data[dataKey] !== null) return toBool(data[dataKey]);
      if (templatePrefix) {
        const customEnabled = settings[`${templatePrefix}custom_enabled`];
        if (toBool(customEnabled)) {
          if (settings[`${templatePrefix}${settingSuffix}`] !== undefined) {
             return toBool(settings[`${templatePrefix}${settingSuffix}`]);
          }
        }
      }
      return toBool(settings?.[`seo_robots_global_${settingSuffix}`]);
    };

    const getAdvanced = (dataKey: string, settingSuffix: string, fallback: any) => {
       if (data && data[dataKey] !== undefined && data[dataKey] !== null) return data[dataKey];
       if (templatePrefix) {
           const customEnabled = settings[`${templatePrefix}custom_enabled`];
           if (toBool(customEnabled)) {
               return settings[`${templatePrefix}${settingSuffix}`];
           }
       }
       return settings?.[`seo_robots_global_${settingSuffix}`] ?? fallback;
    };
    
    // Check if index is disabled OR if it's explicitly a search page
    const isNoIndex = getDirective("no_index", "noindex") || type === 'search';
    const isNoFollow = getDirective("no_follow", "nofollow");

    const robots: any = {
      index: !isNoIndex,
      follow: !isNoFollow,
    };

    // SERVER-SIDE CASCADING LOCKOUT
    // Only generate advanced tags and rules if the page is actually permitted to be indexed
    if (!isNoIndex) {
        const isNoArchive = getDirective("no_archive", "noarchive");
        const isNoImageIndex = getDirective("no_image_index", "noimageindex");
        const isNoSnippet = getDirective("no_snippet", "nosnippet");

        if (isNoArchive) {
            robots.noarchive = true;
            robots.nocache = true;
        }
        
        if (isNoSnippet) robots.nosnippet = true;
        if (isNoImageIndex) robots.noimageindex = true;

        const googleBot: any = {};
        
        // Only generate max-* directives if snippets are allowed
        if (!isNoSnippet) {
           googleBot['max-video-preview'] = getAdvanced("max_video_preview", "max_video_preview", -1);
           googleBot['max-snippet'] = getAdvanced("max_snippet", "max_snippet", -1);
           
           // Only generate max-image-preview if images are allowed to be indexed
           if (!isNoImageIndex) {
               const imgPreview = getAdvanced("max_image_preview", "max_image_preview", "large");
               if (imgPreview !== 'none') {
                   googleBot['max-image-preview'] = imgPreview;
               }
           }
        }

        if (Object.keys(googleBot).length > 0) {
            robots.googleBot = googleBot;
        }
    }

    return robots;
  };

  const icons: any = {};
  if (settings.site_icon) {
     icons.icon = settings.site_icon;
     icons.apple = settings.site_icon;
  }

  // =========================================================
  // 6. KEYWORDS FORMATTING (Aesthetic Space Fix)
  // =========================================================
  const rawKeywords = data.focus_keywords || data.focusKeywords;
  let formattedKeywords: string | undefined = undefined;

  if (Array.isArray(rawKeywords)) {
      formattedKeywords = rawKeywords.map(k => String(k).trim()).filter(Boolean).join(', ');
  } else if (typeof rawKeywords === 'string' && rawKeywords.trim() !== '') {
      formattedKeywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean).join(', ');
  }

  // =========================================================
  // 7. RETURN METADATA & INJECT FACEBOOK TAGS
  // =========================================================
  
  // Custom non-standard meta tags (fb:app_id and fb:admins)
  const customOtherMeta: Record<string, string> = {};
  if (settings.seo_social_fb_app_id && String(settings.seo_social_fb_app_id).trim() !== "") {
      customOtherMeta['fb:app_id'] = String(settings.seo_social_fb_app_id).trim();
  }
  if (settings.seo_social_fb_admin_id && String(settings.seo_social_fb_admin_id).trim() !== "") {
      customOtherMeta['fb:admins'] = String(settings.seo_social_fb_admin_id).trim();
  }
  
  // Standard OpenGraph Tags
  const openGraphData: any = {
    title: ogTitle,
    description: ogDescription,
    url: currentUrl,
    siteName: siteName,
    images: ogImages,
    locale: 'en_US',
    type: type === 'post' ? 'article' : 'website',
  };

  // Inject Facebook Authorship exclusively for articles/posts
  if (type === 'post' && settings.seo_social_fb_authorship && String(settings.seo_social_fb_authorship).trim() !== "") {
      openGraphData.authors = [String(settings.seo_social_fb_authorship).trim()];
  }

  return {
    title: title,
    description: description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: data.canonical_url || currentUrl,
    },
    keywords: formattedKeywords,
    robots: getRobots(),
    icons: icons,
    openGraph: openGraphData,
    twitter: {
      card: settings.seo_social_twitter_card_type || 'summary_large_image',
      title: twitterTitle,
      description: twitterDescription,
      images: twitterImages,
      creator: settings.seo_social_twitter ? `@${String(settings.seo_social_twitter).replace(/@/g, '')}` : undefined,
    },
    // The "other" property handles custom <meta> tags that Next.js doesn't natively map
    other: Object.keys(customOtherMeta).length > 0 ? customOtherMeta : undefined,
  };
}
