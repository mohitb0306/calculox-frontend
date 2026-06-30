import { Metadata } from "next";
import { notFound } from "next/navigation";
import TagArchiveClient from "@/components/content/TagArchiveClient";
import { fetchAPI } from "@/services/api";
import { getSiteSettings } from "@/lib/content";
import { constructMetadata } from "@/lib/seo";
import BreadcrumbSchema from "@/components/seo/schemas/BreadcrumbSchema";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getTagData(slug: string, type: 'post' | 'calculator') {
  try {
    const endpoint = type === 'calculator'
      ? `/public/get_public_calculators.php?tag=${slug}`
      : `/public/get_public_posts.php?tag=${slug}`;
      
    const res = await fetchAPI(endpoint, { method: "GET", cache: "no-store" });
    
    if (res.success) {
      return {
        items: type === 'calculator' ? res.data.calculators : res.data.posts,
        tagDetails: res.data.tag_details
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTagData(slug, 'post');
  const settings = await getSiteSettings();

  // STRICT SEO FIX: Bailout to 404 Schema
  if (!data || !data.tagDetails) {
    return constructMetadata({
      data: { title: "Tag Not Found" },
      settings,
      type: "404",
      path: `/blog/tag/${slug}`
    });
  }

  return constructMetadata({
    data: { title: `${data.tagDetails.name} Articles` },
    settings,
    type: "tag-archive",
    context: { name: data.tagDetails.name },
    path: `/blog/tag/${slug}`
  });
}

export default async function BlogTagPage({ params }: PageProps) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([
    getTagData(slug, 'post'),
    getSiteSettings()
  ]);
  
  if (!data || !data.tagDetails) {
    notFound();
  }

  const breadcrumbData = {
      context: { name: data.tagDetails.name }
  };
  
  return (
    <>
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/blog/tag/${slug}`} 
      />

      <TagArchiveClient 
        slug={slug}
        tagName={data.tagDetails.name}
        type="post"
        items={data.items}
        settings={settings}
      />
    </>
  );
}