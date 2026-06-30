import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from "isomorphic-dompurify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely normalizes and sanitizes a raw HTML string.
 */
export const normalizeHtml = (html: string | undefined): string => {
  if (!html) return "";

  const sanitizedHtml = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: [
      'data-type', 'data-bg', 'data-text', 'data-hover-bg', 'data-hover-text',
      'data-hover-effect', 'data-bold', 'data-italic', 'data-underline',
      'data-px', 'data-py', 'data-align', 'data-colwidth', 'target', 'rel', 
      'class', 'style', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'
    ],
  });

  let cleanHtml = sanitizedHtml.replace(/<div[^>]*class=["']tableWrapper["'][^>]*>(\s*<table[\s\S]*?<\/table>\s*)<\/div>/gi, '$1');
  return cleanHtml.replace(/(<table[\s\S]*?<\/table>)/gi, '<div class="tableWrapper w-full overflow-x-auto">$1</div>');
};

/**
 * Smart Normalizer: Safely applies XSS sanitization and Table Wrapping
 * whether the backend sends a raw string or a parsed JSON object.
 */
export const normalizePageContent = (rawContent: any): any => {
  if (!rawContent) return rawContent;
  
  // If it is a raw HTML string, normalize directly
  if (typeof rawContent === 'string') {
    return normalizeHtml(rawContent);
  }
  
  // If it is a parsed JSON object, iterate and securely normalize string properties
  if (typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    const normalizedObj: Record<string, any> = {};
    for (const key in rawContent) {
      if (typeof rawContent[key] === 'string') {
        normalizedObj[key] = normalizeHtml(rawContent[key]);
      } else {
        normalizedObj[key] = rawContent[key];
      }
    }
    return normalizedObj;
  }
  
  return rawContent;
};