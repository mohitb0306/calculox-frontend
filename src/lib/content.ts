import { fetchAPI } from "@/services/api";

// --- Interfaces ---

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number | null;
  meta_title?: string;      // Required for Category SEO
  meta_description?: string; // Required for Category SEO
  featured_image_url?: string; // ADDED for TS 6 Strictness
  schema_json?: any;           // ADDED for TS 6 Strictness
}

export interface CalculatorContent {
  id: number;
  slug: string;
  name: string;
  description: string;
  content: string;
  icon?: string;
  is_featured?: boolean | number;
  category_names?: string;
  category_slugs?: string; 
  meta_title?: string;
  meta_description?: string;
  category_id?: number;
  created_at: string;
  faq_json?: any;              // ADDED for TS 6 Strictness
}

export interface PostContent {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  featured_image_url?: string;
  published_date: string; // Maps to created_at from DB
  updated_at: string;
  author_name: string;
  author_short_description?: string; // <-- NEW FIELD MAPPED SECURELY
  category_name: string;
  category_slug?: string;      // ADDED for TS 6 Strictness
  category_slugs?: string;
  read_time?: number;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  related_posts?: PostContent[]; 
  faq_json?: any;              // ADDED for TS 6 Strictness
  og_image?: string;           // ADDED for TS 6 Strictness
}

export interface PageContent {
  id: number;
  slug: string;
  title: string;
  page_key?: string;
  content: string;
  categories?: any[];
  meta_title?: string;
  meta_description?: string;
  updated_at?: string;
  featured_image_url?: string; // ADDED for TS 6 Strictness
  schema_json?: any;           // ADDED for TS 6 Strictness
  og_image?: string;           // ADDED for TS 6 Strictness
}

// --- NEW INTERFACE FOR SLUG MAPPING ---
export interface SystemSlugMap {
  about: string;
  contact: string;
  faq: string;
  "privacy-policy": string;
  "terms-of-service": string;
  "cookie-policy": string;
}

// --- NEW INTERFACE FOR REDIRECTION ---
export interface RedirectRule {
  has_redirect: boolean;
  target_url?: string;
  status_code?: number;
}

// --- Helper Functions ---

const isSuccess = (data: any) => {
  return data?.success === true || data?.status === 'success';
};

// --- API Fetching Functions ---

export async function getPageBySlug(slug: string): Promise<PageContent | null> {
  if (!slug) return null;
  try {
    const safeSlug = encodeURIComponent(slug);
    const data = await fetchAPI(`/public/get_public_page.php?slug=${safeSlug}`, {
      method: "GET",
      cache: "no-store", 
    });
    return isSuccess(data) ? data.data : null;
  } catch (error) {
    console.error(`Error fetching page [${slug}]:`, error);
    return null;
  }
}

export async function getCalculatorBySlug(slug: string): Promise<CalculatorContent | null> {
  if (!slug) return null;
  try {
    const safeSlug = encodeURIComponent(slug);
    const data = await fetchAPI(`/public/get_public_calculator.php?slug=${safeSlug}`, {
      method: "GET",
      cache: "no-store",
    });
    return isSuccess(data) ? data.data : null;
  } catch (error) {
    console.error(`Error fetching calculator [${slug}]:`, error);
    return null;
  }
}

export async function getPostBySlug(slug: string): Promise<PostContent | null> {
  if (!slug) return null;
  try {
    const safeSlug = encodeURIComponent(slug);
    const response = await fetchAPI(`/public/get_public_post.php?slug=${safeSlug}`, {
      method: "GET",
      cache: "no-store",
    });
    return isSuccess(response) ? response.data : null;
  } catch (error) {
    console.error(`Error fetching post [${slug}]:`, error);
    return null;
  }
}

export async function getPublishedPosts(page = 1, limit = 100) {
  try {
    const response = await fetchAPI(`/public/get_public_posts.php?page=${page}&limit=${limit}`, {
      method: "GET",
      cache: "no-store",
    });
    if (isSuccess(response)) {
      const apiData = response.data || {};
      let postsData = [];
      if (Array.isArray(apiData)) {
        postsData = apiData;
      } else if (apiData.posts && Array.isArray(apiData.posts)) {
        postsData = apiData.posts;
      }

      const cleanPosts = postsData.filter((p: any) => p !== null && p !== undefined);
      return { 
        posts: cleanPosts, 
        pagination: apiData.pagination || {} 
      };
    }
    return { posts: [], pagination: {} };
  } catch (error) {
    console.error("Error fetching posts:", error);
    return { posts: [], pagination: {} };
  }
}

export async function getBlogCategories(): Promise<Category[]> {
  try {
    const response = await fetchAPI(`/public/get_public_categories.php`, {
      method: "GET",
      cache: "no-store",
    });
    if (isSuccess(response) && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function getPublicCalculators(): Promise<CalculatorContent[]> {
  try {
    const response = await fetchAPI(`/public/get_public_calculators.php`, {
      method: "GET",
      cache: "no-store",
    });
    if (isSuccess(response)) {
        if(response.data && Array.isArray(response.data.calculators)) {
            return response.data.calculators;
        }
        if(Array.isArray(response.data)) {
             return response.data;
        }
    }
    return [];
  } catch (error) {
    console.error("Error fetching calculators:", error);
    return [];
  }
}

export async function getCalculatorCategories(): Promise<Category[]> {
  try {
      const timestamp = new Date().getTime();
      const response = await fetchAPI(`/public/get_public_bootstrap.php?t=${timestamp}`, {
          method: 'GET',
          cache: 'force-cache',
          next: { revalidate: 60 } 
      });
      if(isSuccess(response) && response.data?.calculatorCategories) {
          return response.data.calculatorCategories;
      }
      return [];
  } catch (error) {
      console.error("Error fetching calculator categories:", error);
      return [];
  }
}

export async function getSiteSettings() {
    try {
        const timestamp = new Date().getTime();
        const response = await fetchAPI(`/public/get_public_bootstrap.php?t=${timestamp}`, {
            method: 'GET',
            cache: 'force-cache', 
            next: { revalidate: 60 }
        });
        if(isSuccess(response)) {
            return response.data.settings || {};
        }
        return {};
    } catch(e) {
        return {};
    }
}

// --- NEW FUNCTION: Get System Slugs ---
export async function getSystemSlugs(): Promise<SystemSlugMap> {
  try {
    const timestamp = new Date().getTime();
    // Use the bootstrap endpoint which returns all page data including page_key mapping
    const response = await fetchAPI(`/public/get_public_bootstrap.php?t=${timestamp}`, {
      method: 'GET',
      cache: 'force-cache',
      next: { revalidate: 60 } // Recheck every minute for updates
    });
    
    // Default Fallbacks (Standard Slugs)
    const map: SystemSlugMap = {
      about: "about",
      contact: "contact",
      faq: "faq",
      "privacy-policy": "privacy-policy",
      "terms-of-service": "terms-of-service",
      "cookie-policy": "cookie-policy",
    };

    if (response.success && response.data?.pages) {
      const pages = response.data.pages;
      // Loop through pages and update map where page_key matches
      // pages is an object keyed by page_key (e.g. 'about': { slug: 'our-story', ... })
      Object.keys(pages).forEach((key) => {
        const page = pages[key];
        if (page && page.slug && map.hasOwnProperty(key)) {
          map[key as keyof SystemSlugMap] = page.slug;
        }
      });
    }

    return map;
  } catch (error) {
    console.error("Error fetching system slugs:", error);
    // Return defaults if API fails to prevent nav crash
    return {
      about: "about",
      contact: "contact",
      faq: "faq",
      "privacy-policy": "privacy-policy",
      "terms-of-service": "terms-of-service",
      "cookie-policy": "cookie-policy",
    };
  }
}

// --- NEW FUNCTION: Check Redirect Rules ---
export async function checkRedirectRule(path: string): Promise<RedirectRule | null> {
  if (!path) return null;
  try {
    const safePath = encodeURIComponent(path);
    // We strictly use cache: "no-store" because redirect rules are highly dynamic 
    // and need to be respected immediately upon creation in cPanel.
    const response = await fetchAPI(`/public/check_redirect.php?path=${safePath}`, {
      method: "GET",
      cache: "no-store", 
    });

    if (isSuccess(response)) {
      return response.data as RedirectRule;
    }
    return null;
  } catch (error) {
    console.error(`Error checking redirect for [${path}]:`, error);
    return null;
  }
}
