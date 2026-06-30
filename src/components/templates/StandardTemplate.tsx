"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { PageContent } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { Calendar } from "lucide-react";
import SafeIcon from "@/components/common/SafeIcon";
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

interface StandardTemplateProps {
  data: PageContent;
  settings?: any;
}

const StandardTemplate = ({ data, settings }: StandardTemplateProps) => {
  
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

  const heading = data.title;
  const bodyHtml = content.mainContent || (typeof data.content === 'string' ? data.content : "");
  const updatedAt = data.updated_at ? new Date(data.updated_at).toLocaleDateString() : null;

  return (
    <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      {/* HERO */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            
            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight break-words">
              {heading}
            </motion.h1>
            
            {updatedAt && (
               <motion.div variants={fadeInUp} className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                 <SafeIcon icon={Calendar} className="w-4 h-4" />
                  <span>Last updated: {updatedAt}</span>
               </motion.div>
            )}

            <motion.div variants={fadeInUp} className="flex justify-center mt-8 w-full">
               <Breadcrumbs data={{ title: heading }} settings={settings} className="w-full flex justify-center" />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* BODY */}
      <section className="py-16 md:py-24 bg-white dark:bg-[#050505]">
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
                    className="
                      prose prose-slate dark:prose-invert max-w-none break-words
                      prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-p:leading-relaxed 
                      prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight 
                      prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:break-all prose-strong:text-slate-900 dark:prose-strong:text-white
                      prose-img:rounded-xl prose-img:shadow-lg
                      [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_.tableWrapper]:w-full [&_.tableWrapper]:overflow-x-auto [&_table]:w-full [&_table]:min-w-full
                    "
                 >
                    <RichTextRenderer content={bodyHtml as string} />
                 </div>
             </div>
           </motion.div>
        </div>
      </section>

    </main>
  );
};

export default StandardTemplate;