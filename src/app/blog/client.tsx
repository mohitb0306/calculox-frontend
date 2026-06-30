"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import PostCard from "@/components/cards/PostCard";
import { PageContent, PostContent, Category } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs"; // <--- IMPORTED

const { FiSearch, FiFolder, FiFileText, FiSend, FiMail, FiEdit } = FiIcons;

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

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-20 px-6 rounded-[2.5rem] bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]"
  >
    <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 dark:border-white/5">
      <SafeIcon icon={FiEdit} className="w-8 h-8 text-slate-400" />
    </div>
    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
      No Articles Found
    </h2>
    <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium max-w-md mx-auto">
      We couldn&apos;t find any articles matching your current search or category filters.
    </p>
  </motion.div>
);

interface ClientBlogPageProps {
  initialPageData: PageContent | null;
  initialPosts: PostContent[];
  categories: Category[];
  settings: any;
}

const ClientBlogPage = ({ initialPageData, initialPosts, categories, settings }: ClientBlogPageProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // --- 1. PARSE GHOST CONTENT ---
  const content = useMemo(() => {
    if (!initialPageData?.content) return {};
    try {
      return typeof initialPageData.content === 'string' 
        ? JSON.parse(initialPageData.content) 
        : initialPageData.content;
    } catch (e) {
      return {};
    }
  }, [initialPageData]);

  // Defaults fallback
  const DEFAULTS = {
    pageHeading: "Calculox Blog",
    pageSubheading: "Professional insights, technical guides, and strategic advice for data-driven decisions.",
    newsletterHeading: "Institutional Intelligence",
    newsletterSubheading: "Join 50,000+ professionals receiving our weekly analysis on financial accuracy and tool updates.",
    newsletterPrivacy: "Strict privacy policy. Unsubscribe with one click."
  };

  const get = (key: string, fallback: string) => {
    return (content[key] && content[key].toString().trim() !== "") ? content[key] : fallback;
  };

  // --- 2. CATEGORY SORTING ---
  const sortedCategories = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    const children = categories.filter((c) => c.parent_id);
    
    let result: Array<{ slug: string; name: string; id: number | string; parent_id?: number | null }> = 
        [{ slug: "all", name: "All Articles", id: 'all' }];
    
    parents.forEach((parent) => {
      result.push(parent);
      const myChildren = children.filter((c) => c.parent_id === parent.id);
      result = [...result, ...myChildren];
    });
    return result;
  }, [categories]);

  // --- 3. POST FILTERING ---
  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      const matchesSearch = 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const postCategorySlugs = post.category_slugs ? post.category_slugs.split(",") : [];
      const matchesCategory = activeCategory === "all" || postCategorySlugs.includes(activeCategory);
      
      return matchesCategory && matchesSearch;
    });
  }, [initialPosts, activeCategory, searchQuery]);

  // --- 4. BREADCRUMBS DATA ---
  const breadcrumbData = {
    title: "Blog",
    slug: "blog"
  };

  return (
    <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
              Expert Insights
            </motion.span>
            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
              {get('pageHeading', DEFAULTS.pageHeading)}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              {get('pageSubheading', DEFAULTS.pageSubheading)}
            </motion.p>
            
            {/* --- BREADCRUMBS ADDED --- */}
            <motion.div variants={fadeInUp} className="flex justify-center mt-8 w-full">
               <Breadcrumbs data={breadcrumbData} settings={settings} className="flex justify-center" />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* --- FILTER & GRID SECTION --- */}
      <section className="py-12 md:py-20 bg-white dark:bg-[#050505]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Search and Filters */}
          <div className="mb-16 space-y-10">
            <div className="max-w-xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SafeIcon icon={FiSearch} className="h-5 w-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-4 pl-12 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {sortedCategories.map((category) => {
                const isActive = activeCategory === category.slug;
                return (
                  <button
                    key={category.slug}
                    onClick={() => setActiveCategory(category.slug)}
                    className={`px-5 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 flex items-center gap-2 border ${
                      isActive
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl scale-105"
                        : "bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 border-slate-200 dark:border-white/5"
                    }`}
                  >
                    {category.slug === "all" ? (
                       <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
                    ) : (category as any).parent_id ? (
                       <SafeIcon icon={FiFolder} className="w-3.5 h-3.5 opacity-60" />
                    ) : null}
                    <span>{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
            <AnimatePresence mode="popLayout">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post, index) => (
                  <PostCard 
                      key={post.id} 
                      post={post} 
                      index={index} 
                      settings={settings}
                  />
                ))
              ) : (
                <div className="col-span-full">
                  <EmptyState />
                  <div className="text-center mt-8">
                    <button
                      onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                    >
                      Reset all filters
                    </button>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* --- NEWSLETTER SECTION --- */}
      <SectionDivider />
      <section className="py-24 bg-white dark:bg-[#050505] relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-[3rem] p-8 md:p-16 text-center overflow-hidden bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10"
          >
            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="w-14 h-14 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                <SafeIcon icon={FiMail} className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                {get('newsletterHeading', DEFAULTS.newsletterHeading)}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">
                {get('newsletterSubheading', DEFAULTS.newsletterSubheading)}
              </p>
              <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter professional email"
                  className="flex-grow px-5 py-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium shadow-sm"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:shadow-xl transition-all font-bold flex items-center justify-center gap-2"
                >
                  <span>Subscribe</span>
                  <SafeIcon icon={FiSend} className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-6 font-bold uppercase tracking-widest">
                {get('newsletterPrivacy', DEFAULTS.newsletterPrivacy)}
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default ClientBlogPage;