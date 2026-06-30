"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import CalculatorCard from "@/components/cards/CalculatorCard";
import * as FiIcons from "react-icons/fi";
import { CalculatorContent, Category } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

const { FiSearch, FiFolder, FiCpu } = FiIcons;

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
    className="text-center py-20 px-6 rounded-[2.5rem] bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)] col-span-full"
  >
    <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 dark:border-white/5">
      <SafeIcon icon={FiCpu} className="w-8 h-8 text-slate-400" />
    </div>
    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
      No Calculators Found
    </h2>
    <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium max-w-md mx-auto">
      We couldn't find any professional tools matching your current search or category filters.
    </p>
  </motion.div>
);

interface CalculatorsClientProps {
  initialCalculators: CalculatorContent[];
  categories: Category[];
  settings: any;
  pageData: any; // ADDED TO ACCEPT DYNAMIC CMS DATA
}

export default function CalculatorsClient({ initialCalculators, categories, settings, pageData }: CalculatorsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // --- HIERARCHY SORT LOGIC ---
  const sortedCategories = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    const children = categories.filter((c) => c.parent_id);
    
    let result: any[] = [{ slug: "all", name: "All Tools", id: 'all' }];

    parents.forEach((parent) => {
      result.push(parent);
      const myChildren = children.filter(
        (c) => Number(c.parent_id) === Number(parent.id)
      );
      result = [...result, ...myChildren];
    });

    const processedIds = result.map((r) => r.id);
    const orphans = children.filter((c) => !processedIds.includes(c.id));
    
    return [...result, ...orphans];
  }, [categories]);

  // --- FILTER LOGIC ---
  const filteredCalculators = useMemo(() => {
    return initialCalculators.filter((calc) => {
      const matchesSearch =
        calc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (calc.description &&
          calc.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const categorySlugs = calc.category_slugs ? calc.category_slugs.split(",") : [];
      
      const matchesCategory = activeCategory === "all" || categorySlugs.includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, initialCalculators]);

  // --- BREADCRUMBS DATA ---
  const breadcrumbData = {
    title: pageData?.title || "Calculators", // DYNAMIC
    slug: "calculators"
  };

  // --- DYNAMIC CONTENT MAPPING ---
  const badgeText = pageData?.content?.badgeText || "Professional Toolkit";
  const pageHeading = pageData?.content?.pageHeading || "All Calculators";
  const pageSubheading = pageData?.content?.pageSubheading || "Browse our complete collection of institutional-grade calculators engineered for finance, health, and strategic business decisions.";

  return (
    <div className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            {badgeText && (
                <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
                  {badgeText}
                </motion.span>
            )}
            
            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
              {pageHeading}
            </motion.h1>
            
            {pageSubheading && (
                <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
                  {pageSubheading}
                </motion.p>
            )}

            {/* --- BREADCRUMBS INJECTED --- */}
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
                  placeholder="Search for a specific tool..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-4 pl-12 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm font-medium dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {sortedCategories.map((category) => {
                const isActive = activeCategory === category.slug;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.slug)}
                    className={`px-5 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 flex items-center gap-2 border ${
                      isActive
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl scale-105"
                        : "bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 border-slate-200 dark:border-white/5"
                    }`}
                  >
                    {category.slug === "all" ? (
                       <SafeIcon icon={FiCpu} className="w-3.5 h-3.5" />
                    ) : (category as any).parent_id ? (
                        <SafeIcon icon={FiFolder} className="w-3.5 h-3.5 opacity-60" />
                    ) : null}
                    <span>{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 text-center text-[13px] font-bold uppercase tracking-widest text-slate-400"
          >
            Showing {filteredCalculators.length} professional tools
          </motion.p>

          {/* Calculators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <AnimatePresence mode="popLayout">
              {filteredCalculators.length > 0 ? (
                filteredCalculators.map((calc, index) => (
                  <CalculatorCard key={calc.id} calc={calc} index={index} />
                ))
              ) : (
                <EmptyState />
              )}
            </AnimatePresence>
            
            {filteredCalculators.length === 0 && (
                <div className="col-span-full text-center mt-4">
                  <button
                    onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
                    className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}