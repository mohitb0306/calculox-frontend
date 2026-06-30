import { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { 
  getCalculatorBySlug, 
  getPublicCalculators, 
  getSiteSettings,
  checkRedirectRule
} from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
import CalculatorClientPage from "./client";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
import FaqSchema from "@/components/seo/schemas/FaqSchema";
// IMPORT UPDATED: Replaced StructureSchema with our new dedicated CalculatorSchema
import CalculatorSchema from "@/components/seo/schemas/CalculatorSchema";

export async function generateStaticParams() {
  const calculators = await getPublicCalculators();
  return calculators.map((calc) => ({
    slug: calc.slug,
  }));
}

export const revalidate = 60;

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const calculator = await getCalculatorBySlug(slug);
  const settings = await getSiteSettings();

  // STRICT SEO FIX: Bailout and apply 404 schema if calculator doesn't exist
  if (!calculator) {
    return constructMetadata({
      data: { title: "Calculator Not Found" },
      settings,
      type: "404",
      path: `/calculators/${slug}`
    });
  }

  return constructMetadata({
      data: calculator,
      settings,
      type: "calculator",
      path: `/calculators/${slug}`
  });
}

export default async function CalculatorPage({ params }: PageProps) {
  const { slug } = await params;

  // --- PHASE 3: ON-DEMAND REDIRECT INTERCEPTOR (CALCULATORS) ---
  const redirectRule = await checkRedirectRule(`calculators/${slug}`);
  if (redirectRule && redirectRule.has_redirect && redirectRule.target_url) {
    if (redirectRule.status_code === 301 || redirectRule.status_code === 308) {
      permanentRedirect(redirectRule.target_url);
    } else {
      redirect(redirectRule.target_url);
    }
  }

  const [calculator, allCalculators, settings] = await Promise.all([
      getCalculatorBySlug(slug),
      getPublicCalculators(),
      getSiteSettings()
  ]);

  if (!calculator) {
    notFound();
  }

  // --- PREPARE DATA FOR SCHEMA ---
  const breadcrumbData = {
      title: calculator.name,
      primary_category_name: calculator.category_names?.split('||')[0],
      primary_category_slug: calculator.category_slugs?.split('||')[0]
  };

  return (
    <>
      {/* --- ADDED CALCULATOR SCHEMA (SoftwareApplication) --- */}
      <CalculatorSchema 
          data={calculator} 
          settings={settings} 
          currentPath={`/calculators/${slug}`} 
      />

      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/calculators/${slug}`} 
      />

      {/* --- THE FIX: Changed from calculator.faqs to calculator.faq_json --- */}
      <FaqSchema faqs={calculator.faq_json} />

      <CalculatorClientPage 
        calculator={calculator} 
        allCalculators={allCalculators} 
        settings={settings}
      />
    </>
  );
}