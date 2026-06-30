/**
 * Generates the breadcrumb hierarchy based on settings and current context.
 * * @param settings - The global settings object.
 * @param pathname - The current path string (from usePathname).
 * @param data - Context data (post/calculator details).
 * @param isSchema - Flag to indicate if this generation is for JSON-LD schema (prevents truncation).
 * @returns Array of { label, url } objects or null if disabled.
 */
export const generateBreadcrumbs = (settings: any, pathname: string, data: any = {}, isSchema: boolean = false) => {
  // Helper to get safe setting value with smart fallback
  const getSetting = (key: string, fallback: any) => {
      const val = settings?.[key];

      // Boolean check: explicit comparison because 'false' is valid but falsy
      if (typeof val === 'boolean') {
          return val;
      }

      // String boolean parsing from DB values
      if (val === 'true') return true;
      if (val === 'false') return false;

      // String check: if empty string, return fallback (requested behavior)
      // 'prefix' is the exception, it can be intentionally empty.
      if (key === 'seo_breadcrumbs_prefix') {
           return val !== undefined && val !== null ? val : fallback;
      }

      // Standard string fallback
      return val !== undefined && val !== null && val !== '' ? val : fallback;
  };

  // 1. Master Global Switch
  if (getSetting('seo_breadcrumbs_enable', true) === false) {
      return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; url: string | null }[] = [];

  // --- CONTEXT DETECTION ---
  const isCalcCategory = segments[0] === 'calculators' && segments[1] === 'category';
  const isBlogCategory = segments[0] === 'blog' && segments[1] === 'category';
  const isTagArchive = pathname.includes('/tag/');
  
  // Explicit check for Archive context
  const isArchive = isCalcCategory || isBlogCategory || isTagArchive || data.isSearch;

  // --- HELPER: Apply Archive Format ---
  const formatArchiveLabel = (name: string) => {
      const isEnabled = getSetting('seo_breadcrumbs_archive_format_enable', true);
      if (!isEnabled) {
          return name;
      }
      const format = getSetting('seo_breadcrumbs_archive_format', 'Archives for %s');
      return format.replace('%s', name);
  };

  // --- HELPER: Format Slug ---
  const formatSlug = (slug: string) => {
      if (!slug) return '';
      return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // --- HELPER: Check Segment ---
  const firstSegmentMatches = (segs: string[], term: string) => {
      return segs.length > 0 && segs[0].toLowerCase() === term;
  };

  // --- BUILD TRAIL ---

  // 1. Home Link
  if (getSetting('seo_breadcrumbs_show_home', true)) {
      crumbs.push({
          label: getSetting('seo_breadcrumbs_home_label', 'Home'),
          url: '/'
      });
  }

  // 2. Special Pages (404 / Search)
  if (data.is404) {
      crumbs.push({
          label: getSetting('seo_breadcrumbs_404_label', '404 Error: Page not found'),
          url: null
      });
      return crumbs;
  }

  if (data.isSearch) {
      const format = getSetting('seo_breadcrumbs_search_format', 'Results for %s');
      const label = format.replace('%s', data.query || '');
      crumbs.push({ label: label, url: null });
      return crumbs;
  }

  // 3. Category Logic Helper
  const addCategoryCrumb = (basePath: string) => {
      // A. Handle Parent Category (Level 1)
      const parentName = data.parent_category_name || data.parentCategory?.name || data.parent_category?.name;
      // Generate fallback slug if missing from API payload
      const parentSlug = data.parent_category_slug || data.parentCategory?.slug || data.parent_category?.slug || (parentName ? parentName.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : null);

      if (parentName) {
          const linkParentSetting = basePath === 'blog' ? 'seo_breadcrumbs_link_post_parent' : 'seo_breadcrumbs_link_calc_parent';
          const linkParent = getSetting(linkParentSetting, true);
          
          const parentUrl = (parentSlug && linkParent)
              ? `/${basePath}/category/${parentSlug}` 
              : null;
          crumbs.push({
              label: parentName,
              url: parentUrl
          });
      }

      // B. Handle Primary Category (Level 2 or Level 1 if no parent)
      const catName = data.primary_category_name || data.category_name || data.primaryCategory?.name || data.category?.name;
      const catSlug = data.primary_category_slug || data.category_slug || data.primaryCategory?.slug || data.category?.slug || (catName ? catName.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : null);

      if (catName) {
          const linkPrimarySetting = basePath === 'blog' ? 'seo_breadcrumbs_link_post_primary' : 'seo_breadcrumbs_link_calc_primary';
          const linkPrimary = getSetting(linkPrimarySetting, true);

          const catUrl = (catSlug && linkPrimary)
              ? `/${basePath}/category/${catSlug}` 
              : null;
          crumbs.push({
              label: catName,
              url: catUrl
          });
      }
  };

  // 4. Hierarchy Building
  
  // --- Calculator Category Archives ---
  if (isCalcCategory) {
      crumbs.push({ label: 'Calculators', url: '/calculators' });
      if (data.parent_category_name) {
           crumbs.push({ 
               label: data.parent_category_name, 
               url: `/${segments[0]}/category/${data.parent_category_slug}` 
           });
      }
      
      const currentCatName = data.title || formatSlug(segments[2]);
      crumbs.push({ label: formatArchiveLabel(currentCatName), url: null });
  }

  // --- Blog Category Archives ---
  else if (segments[0] === 'blog' && segments[1] === 'category') {
      crumbs.push({ label: 'Blog', url: '/blog' });
      if (data.parent_category_name) {
           crumbs.push({ 
               label: data.parent_category_name, 
               url: `/${segments[0]}/category/${data.parent_category_slug}` 
           });
      }
      const currentCatName = data.title || formatSlug(segments[2]);
      crumbs.push({ label: formatArchiveLabel(currentCatName), url: null });
  }

  // --- Single Calculators ---
  else if (firstSegmentMatches(segments, 'calculators') && segments.length > 1) {
      crumbs.push({ label: 'Calculators', url: '/calculators' });
      addCategoryCrumb('calculators');
      const calcName = data.name || data.title || formatSlug(segments[1]);
      crumbs.push({ label: calcName, url: null });
  }

  // --- Single Blog Posts ---
  else if (firstSegmentMatches(segments, 'blog')) {
      crumbs.push({ label: 'Blog', url: '/blog' });
      // If we are deeper than just /blog
      if (segments.length > 1) {
          addCategoryCrumb('blog');
          const postTitle = data.title || formatSlug(segments[1]);
          crumbs.push({ label: postTitle, url: null });
      }
  }

  // --- Tag Archives ---
  else if (isTagArchive) {
       const isCalculatorContext = pathname.includes('/calculators/');
       const contextLabel = isCalculatorContext ? 'Calculators' : 'Blog';
       const contextUrl = isCalculatorContext ? '/calculators' : '/blog';

       // 1. Root Context (e.g. Blog)
       crumbs.push({ label: contextLabel, url: contextUrl });

       // 2. Intermediate "Tag" Crumb
       crumbs.push({ label: "Tag", url: null });

       // 3. The Tag Name
       const tagName = data.context?.name || formatSlug(segments[segments.length - 1]);
       crumbs.push({ label: formatArchiveLabel(tagName), url: null });
  }

  // --- Static Pages ---
  else if (segments.length > 0) {
      const pageTitle = data.title || formatSlug(segments[0]);
      if (pageTitle) {
          crumbs.push({ label: pageTitle, url: null });
      }
  }

  // =========================================================================
  // 5. Handle "Hide Post Title" setting (STRICT FAILSAFE)
  // =========================================================================
  // We only target single blog posts (not archives, not calculators, not pages)
  const isSingleBlogPost = segments[0] === 'blog' && segments.length > 1 && !isArchive;

  // We only strip the title if this is NOT for schema rendering
  if (!isSchema && isSingleBlogPost && getSetting('seo_breadcrumbs_hide_post_title', false)) {
      if (crumbs.length > 0 && crumbs[crumbs.length - 1].url === null) {
          crumbs.pop();
      }
  }

  return crumbs;
};