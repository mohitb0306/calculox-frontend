import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import ClientAuthorPage from "./client";

// ENTERPRISE FIX: Force Next.js to bypass aggressive 404 caching
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug?: string; id?: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const resolvedParams = await props.params;
    const identifier = resolvedParams.slug || resolvedParams.id;
    
    if (!identifier || identifier === 'undefined') {
        return { 
            title: "Author | CalcPro", 
            robots: { index: false, follow: false } 
        };
    }

    // DIRECT DIAL: Native fetch via Environment Variable
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/get_public_author.php?slug=${identifier}`, { cache: 'no-store' });
    const data = await res.json();
    
    // Validate the unlocked data
    if (!data || !data.success) {
        return { 
            title: "Author Not Found | CalcPro",
            robots: { index: false, follow: false }
        };
    }

    const author = data.data.author;
    const seoTemplate = data.data.seo_template || {};
    
    const siteName = seoTemplate.siteName || "CalcPro";
    const titleTemplate = seoTemplate.seo_author_title || "%author_name% | %sitename%";
    const descTemplate = seoTemplate.seo_author_description || "Read %expertise% and articles written by %author_name% on %sitename%.";

    // Dynamic Parsing Function
    const parseSeoString = (str: string) => {
        if (!str) return "";
        return str
            .replace(/%author_name%/g, author.name || "Author")
            
            // --- ENTERPRISE FIX: Fallback logic for Expertise if empty to preserve sentence grammar ---
            .replace(/%expertise%/g, author.expertise || "expert insights")
            
            .replace(/%sitename%/g, siteName)
            .replace(/%sep%/g, "-")
            .replace(/%title%/g, author.name || "Author")
            .replace(/%currentyear%/g, new Date().getFullYear().toString());
    };

    const parsedTitle = parseSeoString(titleTemplate);
    let parsedDesc = parseSeoString(descTemplate);

    // [ENTERPRISE FIX] Strict DOMPurify stripping for XSS prevention in meta tags
    parsedDesc = DOMPurify.sanitize(parsedDesc, { ALLOWED_TAGS: [] }).substring(0, 155);

    return {
      title: parsedTitle,
      description: parsedDesc,
      // MANDATORY OVERRIDE: Enforcing noindex on Author Pages to protect crawl budget
      robots: {
        index: false,
        follow: true,
        nocache: true,
        googleBot: {
            index: false,
            follow: true,
            noimageindex: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
      },
      openGraph: {
        title: parsedTitle,
        description: parsedDesc,
        images: author.profile_image_url ? [{ url: author.profile_image_url }] : [],
        type: "profile",
      },
    };
  } catch (error) {
    return { 
        title: "Author Profile | CalcPro",
        robots: { index: false, follow: false }
    };
  }
}

export default async function AuthorPage(props: Props) {
  try {
    const resolvedParams = await props.params;
    const resolvedSearchParams = await props.searchParams;
    const identifier = resolvedParams.slug || resolvedParams.id;

    if (!identifier || identifier === 'undefined') {
      notFound();
    }

    const page = resolvedSearchParams?.page ? parseInt(resolvedSearchParams.page as string) : 1;

    // DIRECT DIAL: Native fetch via Environment Variable
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/get_public_author.php?slug=${identifier}&page=${page}&limit=9`, { cache: 'no-store' });
    const response = await res.json(); 
    
    // Secure Evaluation: If the author slug is mistyped, PHP returns success: false, triggering Next.js 404
    if (!response || !response.success) {
      notFound();
    }

    // Safely attempt to fetch global bootstrap settings
    let settings = {};
    try {
        const setRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/get_public_bootstrap.php`, { cache: 'no-store' });
        const setData = await setRes.json();
        if (setData && setData.success) {
            settings = setData.data;
        }
    } catch (e) {
        // Settings fail gracefully; core page still loads
    }

    // Render the premium UI
    return <ClientAuthorPage data={response.data} settings={settings} />;
  } catch (error) {
    notFound();
  }
}