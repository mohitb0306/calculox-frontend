"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from "lucide-react";
import { generateBreadcrumbs } from '@/lib/generateBreadcrumbs';

interface BreadcrumbsProps {
  data?: any;
  settings?: any; // Now accepts settings
  type?: 'post' | 'calculator' | 'page';
  className?: string;
}

const Breadcrumbs = ({ data = {}, settings = {}, type = 'post', className = "w-full mb-6" }: BreadcrumbsProps) => {
  const pathname = usePathname();

  // 1. Calculate the crumbs
  const crumbs = generateBreadcrumbs(settings, pathname, data);

  // 2. Data Validation
  if (!crumbs || crumbs.length === 0) {
    return null;
  }

  // 3. VISUAL VISIBILITY CHECK (Ported from Old Project)
  const shouldRender = () => {
    // Helper within scope to check settings
    const getSetting = (key: string, fallback: boolean) => {
        const val = settings?.[key];
        if (typeof val === 'boolean') return val;
        // String handling for "true"/"false" from API
        if (val === 'true') return true;
        if (val === 'false') return false;
        return fallback;
    };
    
    const segments = pathname.split('/').filter(Boolean);

    // Identify Page Type
    const isCalculator = segments[0] === 'calculators' && segments.length > 1 && segments[1] !== 'category';
    const isBlog = segments[0] === 'blog' && segments.length > 1 && segments[1] !== 'category' && segments[1] !== 'tag'; 
    const isCalcCategory = segments[0] === 'calculators' && segments[1] === 'category';
    const isBlogCategory = segments[0] === 'blog' && segments[1] === 'category';
    const isTagArchive = pathname.includes('/tag/');
    
    const isStatic = !isCalculator && !isBlog && !isCalcCategory && !isBlogCategory && !isTagArchive && !data.is404 && !data.isSearch && segments.length > 0;

    // Check Settings
    if (isCalculator && getSetting('seo_breadcrumbs_show_calculators', true) === false) return false;
    if (isBlog && getSetting('seo_breadcrumbs_show_posts', true) === false) return false;
    if (isStatic && getSetting('seo_breadcrumbs_show_pages', true) === false) return false;
    if (isCalcCategory && getSetting('seo_breadcrumbs_show_calc_categories', true) === false) return false;
    if (isBlogCategory && getSetting('seo_breadcrumbs_show_blog_categories', true) === false) return false;
    
    // 🚀 ENTERPRISE FIX: Intercept the new 404 visibility setting
    if (data.is404 && getSetting('seo_breadcrumbs_show_404', true) === false) return false;

    return true;
  };

  if (!shouldRender()) {
      return null;
  }

  // 4. Get visual styles with Fallbacks
  const separator = settings?.seo_breadcrumbs_separator || '»';
  
  // Logic for Prefix:
  const showPrefix = settings?.seo_breadcrumbs_show_prefix !== false && settings?.seo_breadcrumbs_show_prefix !== 'false';
  const finalPrefix = settings?.seo_breadcrumbs_prefix || "You are here:";

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center text-sm text-neutral-500 dark:text-neutral-400 justify-inherit">
        
        {/* Optional Prefix Text */}
        {showPrefix && finalPrefix && (
          <li className="mr-2 font-medium text-neutral-400 dark:text-neutral-500">
            {finalPrefix}
          </li>
        )}

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={index} className="flex items-center">
              {/* Separator (don't show for first item) */}
              {index > 0 && (
                <span className="mx-2 text-neutral-400 select-none" aria-hidden="true">
                  {separator}
                </span>
              )}

              {/* Link vs Text Logic */}
              {crumb.url && !isLast ? (
                <Link
                  href={crumb.url}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span 
                  className={isLast ? "font-medium text-neutral-900 dark:text-white" : ""}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;