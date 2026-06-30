// (Update) Calculox_Frontend/src/app/blog/category/[slug]/page.tsx

import { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientBlogCategory from "./client";
import { getPublishedPosts, getBlogCategories, getSiteSettings } from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
// IMPORT ADDED: WebPageSchema
import WebPageSchema from "@/components/seo/schemas/WebPageSchema";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getBlogCategories();
  const currentCategory = categories.find((c) => c.slug === slug);
  const settings = await getSiteSettings();

  // STRICT SEO FIX: Bailout to 404 Schema
  if (!currentCategory) {
    return constructMetadata({
      data: { title: "Category Not Found" },
      settings,
      type: "404",
      path: `/blog/category/${slug}`
    });
  }

  return constructMetadata({
    data: currentCategory, // Automatically passes the new featured_image_url to meta tags
    settings,
    type: "blog-category",
    context: { name: currentCategory.name, description: currentCategory.description },
    path: `/blog/category/${slug}`
  });
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { slug } = await params;

  const [postsData, categories, settings] = await Promise.all([
    getPublishedPosts(1, 100),
    getBlogCategories(),
    getSiteSettings()
  ]);

  const currentCategory = categories.find((c) => c.slug === slug);

  if (!currentCategory) {
    notFound();
  }

  const parentCategory = currentCategory.parent_id 
      ? categories.find(c => c.id === currentCategory.parent_id) 
      : undefined;

  const breadcrumbData = {
      title: currentCategory.name,
      parent_category_name: parentCategory?.name,
      parent_category_slug: parentCategory?.slug
  };

  // SEO ENHANCEMENT: Force CollectionPage schema for the category archive
  const schemaData = {
    ...currentCategory,
    // EXPLICIT MAPPING: Ensure the new featured image takes precedence in the schema payload
    featured_image_url: currentCategory.featured_image_url || undefined,
    schema_json: currentCategory?.schema_json?.length ? currentCategory.schema_json : [{ type: "CollectionPage" }]
  };
  
  // PHASE 4 FIX: Filter posts for this category and format strict absolute URLs
  const categoryPosts = postsData.posts.filter((post: any) => {
    const slugsString = post.category_slugs || "";
    const slugs = slugsString.split(",").map((s: string) => s.trim());
    return slugs.includes(currentCategory.slug);
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://calculox.com').replace(/\/$/, '');
  const collectionItems = categoryPosts.map((post: any) => ({
      name: post.title || post.name || "",
      url: `${baseUrl}/blog/${post.slug}`
  }));

  return (
    <>
      <WebPageSchema 
          data={schemaData} 
          settings={settings} 
          currentPath={`/blog/category/${slug}`} 
          collectionItems={collectionItems}
          aboutTopic={currentCategory.name}
      />
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/blog/category/${slug}`} 
      />

      <ClientBlogCategory 
        currentCategory={currentCategory}
        initialPosts={postsData.posts}
        categories={categories}
        settings={settings}
      />
    </>
  );
}