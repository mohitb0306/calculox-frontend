"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PageContent } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import RichTextRenderer from "@/components/common/RichTextRenderer"; // <-- ADDED INTERCEPTOR

// --- ANIMATIONS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const SectionDivider = () => (
  <div className="relative h-px w-full overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-indigo-500/20" />
  </div>
);

interface PolicyTemplateProps {
  data: PageContent;
  settings?: any;
}

const PolicyTemplate = ({ data, settings }: PolicyTemplateProps) => {
  
  // 1. Parse Content
  const content = useMemo(() => {
    if (!data?.content) return {};
    try {
      return typeof data.content === 'string' 
        ? JSON.parse(data.content) 
        : data.content;
    } catch (e) {
      return { mainContent: data.content };
    }
  }, [data]);

  // 2. Identify Page Type via key (defaults fallback)
  const pageKey = data.page_key || data.slug;

  const getDefaults = () => {
      const common = {
          badgeText: "Legal Documentation",
          lastUpdated: "May 31, 2025",
          regulatoryHeading: "Regulatory Docs:",
          bottomEmailAddress: "legal@calculox.com",
      };

      if (pageKey === 'privacy-policy') {
          return {
              ...common,
              pageHeading: "Privacy Policy",
              mainContent: "<p>Your privacy is important to us. It is Calculox's policy to respect your privacy regarding any information we may collect from you across our website.</p>",
              regLink1Label: "Terms of Service", regLink1Target: "terms-of-service",
              regLink2Label: "Cookie Policy", regLink2Target: "cookie-policy",
              bottomCtaText: "If you have any questions regarding our [data policies], please reach out to us at [Email]",
              bottomCtaLinkTarget: "cookie-policy"
          };
      }
      if (pageKey === 'terms-of-service') {
          return {
              ...common,
              pageHeading: "Terms of Service",
              mainContent: "<p>By accessing this website, you are agreeing to be bound by these terms of service, all applicable laws and regulations.</p>",
              regLink1Label: "Privacy Policy", regLink1Target: "privacy-policy",
              regLink2Label: "Cookie Policy", regLink2Target: "cookie-policy",
              bottomCtaText: "If you have any questions regarding our [terms], please reach out to us at [Email]",
              bottomCtaLinkTarget: "privacy-policy"
          };
      }
      // Cookie Policy
      return {
          ...common,
          pageHeading: "Cookie Policy",
          mainContent: "<p>This is the Cookie Policy for Calculox. We use cookies to improve your experience.</p>",
          regLink1Label: "Privacy Policy", regLink1Target: "privacy-policy",
          regLink2Label: "Terms of Service", regLink2Target: "terms-of-service",
          bottomCtaText: "If you have any questions regarding our [cookie policy], please reach out to us at [Email]",
          bottomCtaLinkTarget: "contact"
      };
  };

  const DEFAULTS = getDefaults();

  const get = (key: string, fallback: string) => {
    return (content[key] && content[key].toString().trim() !== "") ? content[key] : fallback;
  };

  // Content Heading (H1)
  const heading = get('pageHeading', DEFAULTS.pageHeading);
  
  const displayDate = get('lastUpdated', DEFAULTS.lastUpdated);
  const link1Target = get('regLink1Target', DEFAULTS.regLink1Target);
  const link2Target = get('regLink2Target', DEFAULTS.regLink2Target);
  const bottomTextRaw = get('bottomCtaText', DEFAULTS.bottomCtaText);
  const bottomEmail = get('bottomEmailAddress', DEFAULTS.bottomEmailAddress);
  const bottomLinkTarget = get('bottomCtaLinkTarget', DEFAULTS.bottomCtaLinkTarget);

  const processShortcode = (text: string, email: string, linkTarget: string) => {
    if (!text) return null;
    const parts = text.split(/(\[.*?\])/g);
    return (
      <span>
        {parts.map((part, i) => {
           if (part.toLowerCase() === '[email]') {
               return <a key={i} href={`mailto:${email}`} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline break-all">{email}</a>;
           }
           if (part.startsWith('[') && part.endsWith(']')) {
               const linkText = part.slice(1, -1);
               return <Link key={i} href={`/${linkTarget}`} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">{linkText}</Link>;
           }
           return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </span>
    );
  };

  // Breadcrumbs Data (Using DB Title)
  const pageData = {
    title: data.title || heading,
    slug: data.slug || pageKey
  };

  return (
    <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      {/* HERO */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
               {get('badgeText', DEFAULTS.badgeText)}
            </motion.span>
            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight break-words">
              {heading}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">
               Last updated: <span className="text-slate-900 dark:text-white">{displayDate}</span>
            </motion.p>
            
            {/* --- BREADCRUMBS INJECTED --- */}
            <motion.div variants={fadeInUp} className="flex justify-center mt-6 w-full">
                <Breadcrumbs data={pageData} settings={settings} className="flex justify-center" />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* CONTENT */}
      <section className="py-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] dark:shadow-none border border-slate-200/60 dark:border-white/5 overflow-hidden"
          >
            <div className="p-8 md:p-12 lg:p-16">
              {/* --- SECURE RICH TEXT RENDERER IMPLEMENTATION --- */}
              <div
                className="prose prose-slate dark:prose-invert max-w-none break-words
                  prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-relaxed 
                  prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight 
                  prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:break-all prose-strong:text-slate-900 dark:prose-strong:text-white
                  [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_.tableWrapper]:w-full [&_.tableWrapper]:overflow-x-auto [&_table]:w-full [&_table]:min-w-full"
              >
                 <RichTextRenderer content={get('mainContent', DEFAULTS.mainContent) as string} />
              </div>
              
              <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-6 items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {get('regulatoryHeading', DEFAULTS.regulatoryHeading)}
                </span>
                <div className="flex flex-wrap gap-4">
                  <Link href={`/${link1Target}`} className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                     {get('regLink1Label', DEFAULTS.regLink1Label)}
                  </Link>
                  <Link href={`/${link2Target}`} className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                    {get('regLink2Label', DEFAULTS.regLink2Label)}
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="mt-10 text-center px-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed break-words">
              {processShortcode(bottomTextRaw, bottomEmail, bottomLinkTarget)}
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default PolicyTemplate;