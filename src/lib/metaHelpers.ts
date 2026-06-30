import { CalculatorContent, PageContent, PostContent } from "./content";

/**
 * Capitalizes the first letter of each word in a string.
 */
export const capitalizeTitle = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Replaces SEO variables like %title% with actual data.
 * 
 * @param template The string containing variables.
 * @param data The primary data object (Post, Page, Calculator).
 * @param settings The global settings object.
 * @param context Additional context (e.g., category name).
 */
export const replaceVariables = (
  template: string | undefined | null, 
  data: any = {}, 
  settings: any = {}, 
  context: any = {}
): string => {
  if (!template) return '';
  
  let result = template;
  
  // --- Global Variables ---
  result = result.replace(/%sitename%/g, settings.siteName || 'Calculox');
  result = result.replace(/%sitedesc%/g, settings.siteDescription || '');
  result = result.replace(/%sep%/g, settings.seo_separator || '-');
  result = result.replace(/%currentyear%/g, new Date().getFullYear().toString());

  // --- Content-Specific Variables ---
  result = result.replace(/%title%/g, data.title || data.name || '');
  
  // Handle Excerpt/Description priority
  const excerpt = data.excerpt || data.meta_description || data.description || '';
  // Limit excerpt length for replacement to avoid massive titles
  result = result.replace(/%excerpt%/g, excerpt.substring(0, 160));
  
  // --- Keywords ---
  result = result.replace(/%keywords%/g, data.focus_keywords || data.focusKeywords || '');

  // --- Taxonomy (Category/Tag) Variables ---
  result = result.replace(/%term%/g, context.name || '');
  result = result.replace(/%term_description%/g, context.description || '');

  // --- Archive & System Variables ---
  result = result.replace(/%date%/g, context.date || '');
  result = result.replace(/%search_query%/g, context.query || '');
  
  // Clean up any extra spaces
  return result.replace(/\s+/g, ' ').trim();
};