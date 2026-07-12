// (Update) Calculox_Frontend/src/app/layout.tsx

import type { Metadata } from "next";
import { Inter, Mulish } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/context/ThemeContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FeedbackWidget from "@/components/common/FeedbackWidget";
import CookieConsent from "@/components/common/CookieConsent"; 
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";
import { ThemeScript } from "@/components/theme/ThemeScript";

// --- Data & SEO ---
import { 
  getCalculatorCategories, 
  getBlogCategories, 
  getSiteSettings,
  getSystemSlugs
} from "@/lib/content";

import ThirdPartyScripts from "@/components/seo/ThirdPartyScripts";
import LowercaseRedirect from "@/components/seo/LowercaseRedirect";
import { constructMetadata } from "@/lib/seo";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: "swap",
});

const mulish = Mulish({ 
  subsets: ["latin"], 
  variable: "--font-mulish",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  const metadata = constructMetadata({
    data: {
      title: settings.siteName || "Calculox",
      meta_description: settings.siteDescription || "Professional Calculators",
      og_type: "website" 
    },
    settings,
    type: "page", 
    path: "/"
  });

  if (settings.integration_gsc_code) {
    metadata.verification = {
      google: settings.integration_gsc_code,
    };
  }

  // --- ENTERPRISE FIX: THE SEO SHIELD ---
  // Master Global Indexing Toggle: Strictly blocks search engines if visibility is disabled
  // in the cPanel, overriding all page-level settings to prevent dummy data leakage.
  // Combines environment layer fallback for Defense in Depth.
  const isGlobalSearchEnabled = settings?.seo_global_search_visibility === true || settings?.seo_global_search_visibility === 'true' || settings?.seo_global_search_visibility === '1' || settings?.seo_global_search_visibility === 1;

  if (!isGlobalSearchEnabled || process.env.NEXT_PUBLIC_APP_ENV === 'staging' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
    metadata.robots = {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        'max-video-preview': -1,
        'max-image-preview': 'none',
        'max-snippet': -1,
      },
    };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- PARALLEL DATA FETCHING ---
  const [calculatorCategories, blogCategories, settings, slugs] = await Promise.all([
    getCalculatorCategories(),
    getBlogCategories(),
    getSiteSettings(),
    getSystemSlugs()
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      {/* SEO FIX: Removed hardcoded global SiteSchema injection from layout */}
      <body 
        className={cn(
          "min-h-screen bg-white dark:bg-[#050505] font-sans antialiased",
          inter.variable,
          mulish.variable
        )}
        suppressHydrationWarning={true}
      >
      
        <ThemeScript />
        <LowercaseRedirect />

        {/* SECURITY FIX: AuthProvider completely removed to eliminate ghost code dependency */}
        <ThemeProvider>
          <div className="flex flex-col min-h-screen">
            
            {/* --- PASS SLUGS TO NAVBAR --- */}
            <Navbar 
              calculatorCategories={calculatorCategories} 
              blogCategories={blogCategories} 
              settings={settings}
              slugs={slugs} 
            />
            
            <main className="flex-grow pt-16 md:pt-20">
              {children}
            </main>
            
            {/* --- PASS SLUGS TO FOOTER --- */}
            <Footer 
              settings={settings} 
              slugs={slugs} 
            />

          </div>
          
          <FeedbackWidget />
          <CookieConsent /> 
          <Toaster position="top-right" />
          
          <ThirdPartyScripts settings={settings} />
          
        </ThemeProvider>
      </body>
    </html>
  );
}
