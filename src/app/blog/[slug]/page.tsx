import { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import ClientBlogPost from "./client";
import { getPostBySlug, getPublishedPosts, getSiteSettings, checkRedirectRule } from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";
import FaqSchema from "@/components/seo/schemas/FaqSchema";
import StructureSchema from "@/components/seo/schemas/StructureSchema"; // NEW

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    getPostBySlug(slug),
    getSiteSettings()
  ]);

  // STRICT SEO FIX: Delegate 404 routing to constructMetadata to secure robots tags
  if (!post) {
    return constructMetadata({
      data: { title: "Post Not Found" },
      settings,
      type: "404",
      path: `/blog/${slug}`
    });
  }

  return constructMetadata({
    data: post,
    settings,
    type: "post",
    path: `/blog/${slug}`
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;

  // --- PHASE 3: ON-DEMAND REDIRECT INTERCEPTOR (BLOG) ---
  const redirectRule = await checkRedirectRule(`blog/${slug}`);
  if (redirectRule && redirectRule.has_redirect && redirectRule.target_url) {
    if (redirectRule.status_code === 301 || redirectRule.status_code === 308) {
      permanentRedirect(redirectRule.target_url);
    } else {
      redirect(redirectRule.target_url);
    }
  }

  const [post, settings] = await Promise.all([
    getPostBySlug(slug),
    getSiteSettings()
  ]);

  if (!post) {
    notFound();
  }

  let sidebarPosts = post.related_posts || [];
  if (!sidebarPosts.length) {
     const { posts: recentPosts } = await getPublishedPosts(1, 4);
     sidebarPosts = recentPosts.filter((p: any) => p.id !== post.id).slice(0, 3);
  }

  // --- PREPARE DATA FOR SCHEMA ---
  const breadcrumbData = {
    title: post.title,
    category_name: post.category_name,
    category_slug: post.category_slugs ? post.category_slugs.split(',')[0] : undefined
  };

  return (
    <>
      {/* --- ADDED STRUCTURE SCHEMA (Article/BlogPosting) --- */}
      <StructureSchema 
          data={post} 
          settings={settings} 
          currentPath={`/blog/${slug}`} 
      />

      {/* --- ADDED BREADCRUMB SCHEMA --- */}
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/blog/${slug}`} 
      />
      
      {/* --- THE FIX: Changed from post.faqs to post.faq_json --- */}
      <FaqSchema faqs={post.faq_json} />

      <ClientBlogPost 
        post={post} 
        relatedPosts={sidebarPosts} 
        settings={settings}
      />
    </>
  );
}