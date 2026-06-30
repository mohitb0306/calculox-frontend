import { Metadata } from "next";
import ClientHome from "./client";
import { 
  getPageBySlug, 
  getPublicCalculators, 
  getPublishedPosts, 
  getSiteSettings
} from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
// IMPORT UPDATED: WebPageSchema now exclusively handles all Homepage JSON-LD
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([
    getPageBySlug("home"),
    getSiteSettings()
  ]);
  
  if (!page) return {};

  return constructMetadata({
    data: page,
    settings,
    type: "homepage",
    path: "/"
  });
}

export default async function HomePage() {
  const [pageData, calculators, { posts: recentPosts }, settings] = await Promise.all([
    getPageBySlug("home"),
    getPublicCalculators(),
    getPublishedPosts(1, 3),
    getSiteSettings() 
  ]);

  // Filter Featured Calculators
  const featuredCalculators = calculators
    .filter(c => c.is_featured === 1 || c.is_featured === true)
    .slice(0, 4);

  return (
    <>
      {/* COMPONENT UPDATED: 
        WebPageSchema now outputs the WebSite, WebPage, AND Organization schemas.
        SiteSchema has been completely removed to prevent duplicates.
      */}
      <WebPageSchema data={pageData} settings={settings} currentPath="/" />
      
      <ClientHome 
        initialData={pageData} 
        featuredCalculators={featuredCalculators}
        recentPosts={recentPosts}
        settings={settings}
      />
    </>
  );
}