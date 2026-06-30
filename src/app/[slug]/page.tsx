import { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import ClientDynamicPage from "./client";
import { getPageBySlug, getSiteSettings, checkRedirectRule } from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
// IMPORT UPDATED: Replaced StructureSchema with our new dedicated WebPageSchema
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [page, settings] = await Promise.all([
    getPageBySlug(slug),
    getSiteSettings()
  ]);

  // STRICT SEO FIX: Delegate 404 routing to constructMetadata to secure robots tags
  if (!page) {
    return constructMetadata({
      data: { title: "Page Not Found" },
      settings,
      type: "404",
      path: `/${slug}`
    });
  }

  return constructMetadata({
    data: page,
    settings,
    type: "page",
    path: `/${slug}`
  });
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;

  // --- PHASE 3: ON-DEMAND REDIRECT INTERCEPTOR ---
  // 1. Check the database for an active redirect rule for this specific slug
  const redirectRule = await checkRedirectRule(slug);
  
  // 2. If a valid rule exists, intercept the request and route the user immediately
  if (redirectRule && redirectRule.has_redirect && redirectRule.target_url) {
    if (redirectRule.status_code === 301 || redirectRule.status_code === 308) {
      permanentRedirect(redirectRule.target_url);
    } else {
      redirect(redirectRule.target_url);
    }
  }

  // 3. If no redirect exists, proceed with standard page fetching
  const [pageData, settings] = await Promise.all([
    getPageBySlug(slug),
    getSiteSettings()
  ]);

  if (!pageData) {
    notFound();
  }

  const currentPath = `/${slug}`;

  return (
    <>
      {/* --- WEBPAGE SCHEMA --- */}
      <WebPageSchema data={pageData} settings={settings} currentPath={currentPath} />
      
      {/* --- ADDED BREADCRUMB SCHEMA --- */}
      <BreadcrumbSchema data={pageData} settings={settings} currentPath={currentPath} />
      
      <ClientDynamicPage data={pageData} settings={settings} />
    </>
  );
}