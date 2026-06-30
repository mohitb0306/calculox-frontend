// (Update) Calculox_Frontend/src/app/calculators/category/[slug]/page.tsx

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { 
  getCalculatorCategories, 
  getPublicCalculators,
  getSiteSettings
} from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
import CalculatorCategoryClient from "./client";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
// IMPORT ADDED: WebPageSchema
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";

export async function generateStaticParams() {
  const categories = await getCalculatorCategories();
  
  return categories.map((cat: any) => ({
    slug: cat.slug,
  }));
}

export const revalidate = 60;

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const categories = await getCalculatorCategories();
  const currentCategory = categories.find((c) => c.slug === slug);
  const settings = await getSiteSettings();

  // STRICT SEO FIX: Bailout and apply 404 schema if category doesn't exist
  if (!currentCategory) {
    return constructMetadata({
      data: { title: "Category Not Found" },
      settings,
      type: "404",
      path: `/calculators/category/${slug}`
    });
  }

  return constructMetadata({
    data: currentCategory, // Automatically passes the new featured_image_url to meta tags
    settings,
    type: "calculator-category",
    context: { name: currentCategory.name, description: currentCategory.description },
    path: `/calculators/category/${slug}`
  });
}

export default async function CalculatorCategoryPage({ params }: PageProps) {
  const { slug } = await params;

  const [categories, allCalculators, settings] = await Promise.all([
    getCalculatorCategories(),
    getPublicCalculators(),
    getSiteSettings()
  ]);

  const currentCategory = categories.find((c) => c.slug === slug);
  
  if (!currentCategory) {
    notFound();
  }

  const categoryCalculators = allCalculators.filter((calc: any) => {
      const slugs = calc.category_slugs ? calc.category_slugs.split(',') : [];
      return slugs.includes(slug);
  });

  const parentCategory = currentCategory.parent_id 
    ? categories.find((c) => c.id === currentCategory.parent_id) 
    : undefined;

  const breadcrumbData = {
      title: currentCategory.name,
      parent_category_name: parentCategory?.name,
      parent_category_slug: parentCategory?.slug
  };

  // SEO ENHANCEMENT: Force CollectionPage schema for the calculator category archive
  const schemaData = {
    ...currentCategory,
    // EXPLICIT MAPPING: Ensure the new featured image takes precedence in the schema payload
    featured_image_url: currentCategory.featured_image_url || undefined,
    schema_json: currentCategory?.schema_json?.length ? currentCategory.schema_json : [{ type: "CollectionPage" }]
  };
  
  // PHASE 4 FIX: Format strict absolute URLs for ItemList payload
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://calculox.com').replace(/\/$/, '');
  const collectionItems = categoryCalculators.map((calc: any) => ({
      name: calc.name || calc.title || "",
      url: `${baseUrl}/calculators/${calc.slug}`
  }));

  return (
    <>
      <WebPageSchema 
          data={schemaData} 
          settings={settings} 
          currentPath={`/calculators/category/${slug}`} 
          collectionItems={collectionItems}
          aboutTopic={currentCategory.name}
      />
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/calculators/category/${slug}`} 
      />

      <CalculatorCategoryClient 
        category={currentCategory} 
        calculators={categoryCalculators} 
        
        settings={settings}
      />
    </>
  );
}