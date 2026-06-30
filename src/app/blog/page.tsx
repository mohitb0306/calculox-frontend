// (Update) Calculox_Frontend/src/app/blog/page.tsx

import React from "react";
import { Metadata } from "next";
import ClientBlogPage from "./client";
import { 
  getPageBySlug, 
  getPublishedPosts, 
  getBlogCategories,
  getSiteSettings
} from "@/lib/content";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
// IMPORT ADDED: WebPageSchema
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";

// Force dynamic rendering to ensure new posts/settings appear immediately
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Parallel fetch for performance
  const [page, settings] = await Promise.all([
    getPageBySlug("blog"),
    getSiteSettings()
  ]);

  // Dynamic Global Settings
  const sep = settings.seo_separator || '-';
  const siteName = settings.siteName || "Calculox";
  
  // Dynamic Title Construction
  // If page.meta_title is empty, fallback to "Blog [SEP] SiteName"
  const title = page?.meta_title || `Blog ${sep} ${siteName}`;
  const description = page?.meta_description || "Insights, tutorials, and tips for making better decisions.";

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: "website",
      // Include image explicitly in standard OG meta tags for social scraping
      images: page?.featured_image_url ? [{ url: page.featured_image_url }] : [],
    }
  };
}

export default async function BlogPage() {
  // Parallel Data Fetching
  const [pageData, postsData, categories, settings] = await Promise.all([
    getPageBySlug("blog"),
    getPublishedPosts(1, 100), 
    getBlogCategories(),
    getSiteSettings()
  ]);

  // SEO ENHANCEMENT: Force CollectionPage schema if no custom schema is provided from DB
  const schemaData = {
    ...pageData,
    schema_json: pageData?.schema_json?.length ? pageData.schema_json : [{ type: "CollectionPage" }]
  };

  // PHASE 4 FIX: Ensure absolute URLs without triple slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://calculox.com').replace(/\/$/, '');
  const collectionItems = postsData.posts.map((post: any) => ({
      name: post.title || post.name || "",
      url: `${baseUrl}/blog/${post.slug}`
  }));

  return (
    <>
      <WebPageSchema 
          data={schemaData} 
          settings={settings} 
          currentPath="/blog" 
          collectionItems={collectionItems}
          aboutTopic="Articles"
      />
      <BreadcrumbSchema 
          data={pageData} 
          settings={settings} 
          currentPath="/blog" 
      />

      <ClientBlogPage 
        initialPageData={pageData}
        initialPosts={postsData.posts}
        categories={categories}
        settings={settings}
      />
    </>
  );
}