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

async function getTagData(slug: string) {
  try {
    const res = await fetchAPI(`/public/get_public_calculators.php?tag=${slug}`, { 
        method: "GET", 
        cache: "no-store" 
    });
    
    if (res.success) {
      return {
        items: res.data.calculators,
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
  const data = await getTagData(slug);
  const settings = await getSiteSettings();

  // STRICT SEO FIX: Bailout and apply 404 schema if tag doesn't exist
  if (!data || !data.tagDetails) {
    return constructMetadata({
      data: { title: "Tag Not Found" },
      settings,
      type: "404",
      path: `/calculators/tag/${slug}`
    });
  }

  return constructMetadata({
    data: { title: `${data.tagDetails.name} Calculators` },
    settings,
    type: "tag-archive",
    context: { name: data.tagDetails.name },
    path: `/calculators/tag/${slug}`
  });
}

export default async function CalculatorTagPage({ params }: PageProps) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([
    getTagData(slug),
    getSiteSettings()
  ]);
  
  if (!data || !data.tagDetails) {
    notFound();
  }

  // Data for Breadcrumb Generation
  const breadcrumbData = {
      context: { name: data.tagDetails.name }
  };
  
  return (
    <>
      <BreadcrumbSchema 
          data={breadcrumbData} 
          settings={settings} 
          currentPath={`/calculators/tag/${slug}`} 
      />

      <TagArchiveClient 
        slug={slug}
        tagName={data.tagDetails.name}
        type="calculator"
        items={data.items}
        settings={settings}
      />
    </>
  );
}