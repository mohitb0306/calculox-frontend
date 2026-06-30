"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import { PageContent } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import FaqSchema from "@/components/seo/schemas/FaqSchema";
import { normalizeHtml } from "@/lib/utils"; // <--- ADDED SECURITY IMPORT
import { 
  ChevronDown, Search, HelpCircle, ArrowRight, MessageSquare 
} from "lucide-react";

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

interface FAQItem {
  question: string;
  answer: string;
  categoryId?: string;
}

interface FAQCategory {
  id: string;
  name: string;
  faqs: FAQItem[];
}

interface FaqTemplateProps {
  data: PageContent;
  settings?: any;
}

const FaqTemplate = ({ data, settings }: FaqTemplateProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const content = useMemo(() => {
    if (!data?.content) return {};
    try {
      return typeof data.content === 'string' 
        ? JSON.parse(data.content) 
        : data.content;
    } catch (e) {
      return {};
    }
  }, [data]);

  const DEFAULTS = {
    pageHeading: "Frequently Asked Questions",
    pageSubheading: "Instant answers to common questions about our professional tools and account features.",
    categories: [
      {
        id: 'general', name: 'General', faqs: [
          { question: "What is CalcPro?", answer: "CalcPro is a comprehensive suite of professional-grade calculators designed for finance, health, and business professionals requiring institutional accuracy." },
          { question: "Is my data secure?", answer: "Yes. We use bank-level encryption to ensure that your calculation history and private data remain strictly confidential." }
        ]
      },
      {
        id: 'accounts', name: 'Accounts', faqs: [
          { question: "How do I manage my subscription?", answer: "You can manage your billing, upgrade, or cancel your subscription directly from your Account Dashboard settings." }
        ]
      }
    ],
    ctaHeading: "Still have questions?",
    ctaSubheading: "Our support team is ready to assist you with technical inquiries or customized tool requests."
  };
  
  const categories: FAQCategory[] = (content.categories && content.categories.length > 0) 
    ? content.categories 
    : DEFAULTS.categories;

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getFilteredFaqs = () => {
    if (!categories.length) return [];

    if (searchQuery) {
      return categories
        .flatMap((cat) => (cat.faqs || []).map(faq => ({ ...faq, categoryId: cat.id })))
        .filter(
          (faq) =>
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    const activeCatData = categories.find((cat) => cat.id === activeCategory);
    return activeCatData ? (activeCatData.faqs || []).map(faq => ({ ...faq, categoryId: activeCatData.id })) : [];
  };

  const filteredFaqs = getFilteredFaqs();

  // --- BREADCRUMBS DATA ---
  const breadcrumbData = {
    title: data.title || "FAQ", // Use DB Title
    slug: data.slug || "faq"
  };

  // --- ADDED: AGGREGATE ALL FAQS FOR SCHEMA ---
  const allFaqsForSchema = useMemo(() => {
    return categories.flatMap(cat => cat.faqs || []);
  }, [categories]);

  return (
    <div className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden">
      
      {/* --- ADDED FAQ SCHEMA --- */}
      <FaqSchema faqs={allFaqsForSchema} />
        
      {/* HERO */}
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
              {content.pageHeading || DEFAULTS.pageHeading}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              {content.pageSubheading || DEFAULTS.pageSubheading}
            </motion.p>
            
            {/* --- BREADCRUMBS INJECTED --- */}
            <motion.div variants={fadeInUp} className="flex justify-center mt-6 w-full">
                <Breadcrumbs data={breadcrumbData} settings={settings} className="flex justify-center" />
            </motion.div>

          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* SEARCH & CATEGORIES */}
      <section className="py-12 bg-white dark:bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative mb-10">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SafeIcon icon={Search} className="h-5 w-5 text-slate-400" />
            </div>
           
             <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-4 pl-12 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm text-sm font-medium dark:text-white"
            />
          </div>

          {!searchQuery && (
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${
                    activeCategory === category.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl"
                      : "bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => {
                const itemId = `${faq.categoryId}-${index}`;
                const isOpen = openItems[itemId];
                return (
                  <motion.div
                    key={itemId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group bg-white dark:bg-[#0a0a0a] rounded-2xl border transition-all duration-500 ${
                       isOpen 
                        ? "border-indigo-500/50 shadow-2xl dark:shadow-none" 
                        : "border-slate-200/60 dark:border-white/5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]"
                    } overflow-hidden`}
                  >
                    <button
                      className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none"
                      onClick={() => toggleItem(itemId)}
                    >
                       <div className="flex items-center gap-4">
                        <div className={`w-1 h-6 rounded-full transition-all duration-500 ${isOpen ? 'bg-indigo-500' : 'bg-transparent'}`} />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                          {faq.question}
                        </h3>
                      </div>
                      <SafeIcon
                        icon={ChevronDown}
                        className={`flex-shrink-0 text-slate-400 transition-transform duration-500 ${
                          isOpen ? "rotate-180 text-indigo-500" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                       {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: "easeOut" as const }}
                        >
                           {/* SECURITY FIX APPLIED HERE: Upgraded to safely handle rich HTML output */}
                           <div 
                             className="px-11 pb-6 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed prose dark:prose-invert max-w-none"
                             dangerouslySetInnerHTML={{ __html: normalizeHtml(faq.answer) }}
                           />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                  <SafeIcon icon={Search} className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">
                  No results found for &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <SectionDivider />
      <section className="py-24 bg-white dark:bg-[#050505]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-[2.5rem] p-8 md:p-16 text-center overflow-hidden bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)] pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="w-14 h-14 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-white/5">
                <SafeIcon icon={MessageSquare} className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                {content.ctaHeading || DEFAULTS.ctaHeading}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">
                {content.ctaSubheading || DEFAULTS.ctaSubheading}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/contact"
                  className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:shadow-xl transition-all font-bold flex items-center justify-center gap-2"
                >
                  <SafeIcon icon={MessageSquare} className="w-4 h-4" />
                  <span>Contact Support</span>
                </Link>
                <Link
                  href="/calculators"
                  className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl hover:shadow-xl transition-all font-bold border border-slate-200 dark:border-white/5 flex items-center justify-center gap-2"
                >
                  <span>Try Calculators</span>
                  <SafeIcon icon={ArrowRight} className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FaqTemplate;