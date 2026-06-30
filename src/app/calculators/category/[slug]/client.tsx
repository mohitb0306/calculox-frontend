"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import CalculatorCard from "@/components/cards/CalculatorCard";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { Category, CalculatorContent } from "@/lib/content";
import { getVisuals } from "@/data/calculatorData";

const { FiCpu, FiArrowRight } = FiIcons;

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

interface ClientProps {
  category: Category;
  parentCategory?: Category;
  calculators: CalculatorContent[];
  settings: any;
}

const CalculatorCategoryClient = ({ category, parentCategory, calculators, settings }: ClientProps) => {
  
  const breadcrumbData = {
    title: category.name,
    category_name: parentCategory?.name,
    category_slug: parentCategory?.slug
  };

  const enhancedCalculators = calculators.map(calc => ({
    ...calc,
    ...getVisuals(calc.slug) 
  }));

  return (
    <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden min-h-screen">
      
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            
            <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
              Professional Toolset Archive
            </motion.span>

            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
              {category.name} Calculators
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto font-medium">
              {category.description || `Explore our high-precision ${category.name.toLowerCase()} calculators engineered for accuracy and professional decision-making.`}
            </motion.p>

            {/* --- FIX: CENTERED BREADCRUMBS --- */}
            <motion.div variants={fadeInUp} className="w-full flex justify-center mt-8">
              <Breadcrumbs 
                  data={breadcrumbData} 
                  type="calculator" 
                  settings={settings} 
                  className="flex justify-center"
              />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      <section className="py-16 md:py-24 bg-white dark:bg-[#050505]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {enhancedCalculators.length > 0 ? (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
            >
              {enhancedCalculators.map((calc, index) => (
                <CalculatorCard key={calc.id} calc={calc} index={index} />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 px-6 rounded-[2.5rem] bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]"
            >
              <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-100 dark:border-white/5">
                <SafeIcon icon={FiCpu} className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Calculators Found</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">We are currently deploying new institutional-grade tools to this category.</p>
              <Link href="/calculators" className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all">
                View All Tools <FiArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </main>
  );
};

export default CalculatorCategoryClient;