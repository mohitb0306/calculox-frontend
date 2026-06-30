"use client";

import React from 'react';
import parse, { DOMNode, Element, HTMLReactParserOptions, domToReact, attributesToProps } from 'html-react-parser';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';

// --- SMART URL FORMATTER ---
// Analyzes URLs and forces absolute HTTPS paths if the user forgot them
const formatSmartUrl = (url: string) => {
  if (!url) return '';
  const trimmed = url.trim();

  // --- ENTERPRISE SEC FIX: PROTOCOL SMUGGLING PREVENTION ---
  // Strictly block dangerous URI schemes before any further processing
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
      return '#'; // Nullify dangerous links
  }

  if (
    /^https?:\/\//i.test(trimmed) || 
    trimmed.startsWith('mailto:') || 
    trimmed.startsWith('tel:') || 
    trimmed.startsWith('/') || 
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

interface RichTextRendererProps {
  content: string;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({ content }) => {
  
  // --- NEW: LCP Tracker ---
  // This resets to 0 every time a blog post loads.
  // It tracks which image we are currently parsing.
  let imageRenderCount = 0;

  const options: HTMLReactParserOptions = {
    replace: (domNode: DOMNode) => {
      if (domNode instanceof Element) {
        
        // --- ENTERPRISE SEC FIX: ATTRIBUTE SCRUBBER ---
        // Strip all inline event handlers (on*) as a defense-in-depth measure
        const cleanAttribs = { ...domNode.attribs };
        Object.keys(cleanAttribs).forEach(key => {
            if (key.toLowerCase().startsWith('on')) {
                delete cleanAttribs[key];
            }
        });
        domNode.attribs = cleanAttribs;

        // --- 1. GLOBAL LINK INTERCEPTOR ---
        if (domNode.name === 'a') {
          const { href, ...restAttribs } = domNode.attribs;
          if (href) {
            const fixedHref = formatSmartUrl(href);
            const props = attributesToProps(restAttribs);
            
            return (
              <a href={fixedHref} {...props}>
                {domToReact(domNode.children as DOMNode[], options)}
              </a>
            );
          }
        }

        // --- 2. IMAGE INTERCEPTOR (LCP Optimized) ---
        if (domNode.name === 'img') {
          const { src, alt, width, height, class: className } = domNode.attribs;
          if (!src) return <></>;

          // Secure URL resolution based on Environment - Never rely on hardcoded paths
          const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');

          const isInternal = 
            src.startsWith(apiBaseUrl) ||
            src.startsWith('/') ||
            src.startsWith('uploads/');

          if (!isInternal) {
            return undefined;
          }

          let finalSrc = src;
          if (src.startsWith('uploads/')) {
             finalSrc = `${apiBaseUrl}/${src}`;
          } else if (src.startsWith('/')) {
             try {
               const apiOrigin = new URL(apiBaseUrl).origin;
               finalSrc = `${apiOrigin}${src}`;
             } catch (e) {
               finalSrc = src;
             }
          }

          let parsedWidth = width ? parseInt(width, 10) : 800;
          let parsedHeight = height ? parseInt(height, 10) : 450;
          if (isNaN(parsedWidth) || parsedWidth <= 0) parsedWidth = 800;
          if (isNaN(parsedHeight) || parsedHeight <= 0) parsedHeight = 450;

          // --- NEW: LCP Prioritization Logic ---
          // If this is the very first image in the content, it is likely "Above the Fold".
          const isFirstImage = imageRenderCount === 0;
          imageRenderCount++; // Increment the counter so the next image gets lazy-loaded

          return (
            <Image
              src={finalSrc}
              alt={alt || 'Calculox Content Image'}
              width={parsedWidth}
              height={parsedHeight}
              className={className || 'rounded-xl shadow-lg my-4'}
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
              // If it's the first image, prioritize it (loads instantly, no lazy loading).
              // If it's not the first image, let Next.js lazy load it by default.
              priority={isFirstImage} 
              decoding="async"
            />
          );
        }
        
        // --- 3. SCRIPT STRIPPER ---
        if (domNode.name === 'script') {
           return <></>;
        }
      }
    },
  };

  // --- ENTERPRISE SEC FIX: DOMPURIFY INTEGRATION ---
  // Sanitize the raw HTML string BEFORE it is parsed into React elements.
  // We explicitly allow iframes (for YouTube embeds) but ensure they are safe.
  const sanitizedContent = DOMPurify.sanitize(content, {
    ADD_TAGS: ['iframe'], 
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'] 
  });

  return <>{parse(sanitizedContent, options)}</>;
};

export default RichTextRenderer;