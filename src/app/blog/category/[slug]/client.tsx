"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import PostCard from "@/components/cards/PostCard";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { PostContent, Category } from "@/lib/content";
import { Layers, ArrowRight } from "lucide-react";

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

// FIX: Updated interface to match exactly what page.tsx is passing
interface ClientCategoryProps {
  initialPosts: PostContent[];
  currentCategory: Category;
  categories: Category[];
  settings: any;
}

// FIX: Mapped incoming props to local variables
const ClientBlogCategory = ({ initialPosts, currentCategory, categories, settings }: ClientCategoryProps) => {
  
  // Filter posts for this category
  const categoryPosts = useMemo(() => {
    if (!currentCategory || !initialPosts) return [];
    return initialPosts.filter((post) => {
      const slugsString = post.category_slugs || "";
      const slugs = slugsString.split(",").map(s => s.trim());
      return slugs.includes(currentCategory.slug);
    });
  }, [initialPosts, currentCategory]);

  // Find Parent for Breadcrumbs
  const parentCategory = useMemo(() => {
    if (!currentCategory || !currentCategory.parent_id) return null;
    return categories.find((c) => c.id === currentCategory.parent_id);
  }, [currentCategory, categories]);

  const breadcrumbData = {
    title: currentCategory?.name || "",
    category_name: parentCategory?.name,
    category_slug: parentCategory?.slug
  };

  if (!currentCategory) return null; // Failsafe

  return (
    <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            
            <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
              Knowledge Hub Archive
            </motion.span>

            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
              {currentCategory.name}
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto font-medium">
              {currentCategory.description || `Explore our latest articles, professional guides, and insights regarding ${currentCategory.name}.`}
            </motion.p>

            <motion.div variants={fadeInUp} className="w-full flex justify-center mt-8">
               <Breadcrumbs 
                 data={breadcrumbData} 
                 settings={settings} 
                 className="flex justify-center" 
               />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* --- CONTENT GRID --- */}
      <section className="py-16 md:py-24 bg-white dark:bg-[#050505]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {categoryPosts.length > 0 ? (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
            >
              {categoryPosts.map((post, index) => (
                <PostCard 
                    key={post.id} 
                    post={post} 
                    index={index} 
                    settings={settings}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 px-6 rounded-[2.5rem] bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]"
            >
              <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                <SafeIcon icon={Layers} className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Articles Found</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">We are currently updating our archive for this category.</p>
              <Link href="/blog" className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all">
                Browse All Articles <SafeIcon icon={ArrowRight} className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
};

export default ClientBlogCategory;