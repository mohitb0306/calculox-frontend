// (Update) Calculox_Frontend/src/app/calculators/page.tsx

import { Metadata } from "next";
import { getPublicCalculators, getCalculatorCategories, getSiteSettings, getPageBySlug } from "@/lib/content";
import CalculatorsClient from "./client";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";

// Revalidate page every 60 seconds
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [settings, pageData] = await Promise.all([
    getSiteSettings(),
    getPageBySlug("calculators").catch(() => null)
  ]);

  // Dynamic Global Settings
  const sep = settings?.seo_separator || '-';
  const siteName = settings?.siteName || "Calculox";
  
  // Dynamic Page Content with Fallbacks
  const defaultTitle = "All Calculators";
  const defaultDesc = "Browse our complete collection of institutional-grade calculators engineered for finance, health, and strategic business decisions.";

  const titleText = pageData?.meta_title || pageData?.title || defaultTitle;
  const title = `${titleText} ${sep} ${siteName}`;
  const description = pageData?.meta_description || defaultDesc;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: "website",
      // Include image explicitly in standard OG meta tags for social scraping
      images: pageData?.featured_image_url ? [{ url: pageData.featured_image_url }] : [],
    },
  };
}

export default async function CalculatorsPage() {
  // Parallel data fetching for performance
  const [calculators, categories, settings, pageData] = await Promise.all([
    getPublicCalculators(),
    getCalculatorCategories(),
    getSiteSettings(),
    getPageBySlug("calculators").catch(() => null)
  ]);

  // Fallback content to ensure safe rendering
  const safePageData = pageData || {
    title: "Calculators",
    meta_title: "All Calculators",
    meta_description: "Browse our complete collection of institutional-grade calculators engineered for finance, health, and strategic business decisions.",
    content: {
      badgeText: "Professional Toolkit",
      pageHeading: "All Calculators",
      pageSubheading: "Browse our complete collection of institutional-grade calculators engineered for finance, health, and strategic business decisions."
    }
  };

  // Construct a minimal data object for breadcrumbs
  const breadcrumbData = { title: safePageData.title || "Calculators" };

  // SEO ENHANCEMENT: Construct CollectionPage data for WebPageSchema with Dynamic Dates
  const schemaData = {
    ...safePageData, // <--- CRITICAL FIX: Ensure all image fields from the API flow straight into WebPageSchema
    title: safePageData.meta_title || safePageData.title || "Calculators",
    description: safePageData.meta_description || "Browse our complete collection of institutional-grade calculators.",
    schema_json: [{ type: "CollectionPage" }],
    // Typecast to any safely to extract database timestamps regardless of strict TS interfaces
    published_date: (safePageData as any).created_at || (safePageData as any).updated_at,
    updated_at: (safePageData as any).updated_at,
    created_at: (safePageData as any).created_at
  };

  // PHASE 4 FIX: Ensure absolute URLs without triple slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://calculox.com').replace(/\/$/, '');

  const collectionItems = calculators.map((calc: any) => ({
      name: calc.name || calc.title || "",
      url: `${baseUrl}/calculators/${calc.slug}`
  }));

  return (
    <>
      <WebPageSchema 
          data={schemaData} 
          settings={settings} 
          currentPath="/calculators" 
          collectionItems={collectionItems}
          aboutTopic="Professional Calculators"
      />
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath="/calculators" 
      />

      <CalculatorsClient 
        initialCalculators={calculators} 
        categories={categories}
        settings={settings}
        pageData={safePageData}
      />
    </>
  );
}