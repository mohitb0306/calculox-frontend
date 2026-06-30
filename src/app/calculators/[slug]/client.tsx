"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import toast from "react-hot-toast";
import { fetchAPI } from "@/services/api";
import { renderCalculatorComponent } from "@/components/calculators/Registry";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { normalizeHtml } from "@/lib/utils";
import RichTextRenderer from "@/components/common/RichTextRenderer"; // <-- ADDED INTERCEPTOR

// Data
import { CalculatorContent } from "@/lib/content";
import { getVisuals } from "@/data/calculatorData";

const {
  FiArrowLeft, FiBookmark, FiShare2, FiSave, FiCheck,
  FiChevronDown, FiChevronUp, FiTag, FiUser, FiCpu,
  FiClock
} = FiIcons;

interface ClientProps {
  calculator: CalculatorContent;
  allCalculators: CalculatorContent[];
  settings: any;
}

const FaqItem = ({ faq }: { faq: any }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {faq.question}
        </h3>
        <div className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'bg-transparent text-neutral-400'}`}>
            <SafeIcon
                icon={isOpen ? FiChevronUp : FiChevronDown}
                className={`flex-shrink-0 w-5 h-5 transition-transform duration-300`}
            />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div 
              className="px-6 pb-6 pt-2 text-neutral-600 dark:text-neutral-400 prose dark:prose-invert max-w-none text-base leading-relaxed [&>p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: normalizeHtml(faq.answer) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function CalculatorClientPage({ calculator, allCalculators, settings }: ClientProps) {
  // --- FIX: Stubbed user state for public frontend (resolves AuthContext missing module) ---
  const user: any = null;
  const isLoading = false;

  // We use this state to hold the full data fetched client-side (including tags/faq which might be lazy loaded or structure differently)
  // However, since we pass 'calculator' prop from server, we initialize with it.
  const [pageData, setPageData] = useState<any>(calculator);
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hasPerformedCalculation, setHasPerformedCalculation] = useState(false);
  
  const getCalculationDataHandler = useRef<(() => any) | null>(null);

  // Get Visuals
  const currentVisuals = getVisuals(calculator.slug);

  // --- 1. Fetch Full Data Client Side (to ensure tags/faqs are fully populated if server prop is partial) ---
  useEffect(() => {
    const fetchFullData = async () => {
        try {
            const res = await fetchAPI(`/public/get_public_calculator.php?slug=${calculator.slug}`, { method: 'GET' });
            if (res.success) {
                setPageData(res.data);
            }
        } catch (e) {
            console.error("Failed to refresh calculator data", e);
        }
    };
    fetchFullData();
  }, [calculator.slug]);

  // --- 2. Load Bookmark Status ---
  useEffect(() => {
    if (user && user.id) {
      const checkBookmark = async () => {
        try {
          const res = await fetchAPI(`/public/get_bookmarks.php?userId=${user.id}`, { method: 'GET' });
          if (res.success && res.bookmarks) {
            const isSaved = res.bookmarks.includes(calculator.slug) || res.bookmarks.includes(String(calculator.id));
            setIsBookmarked(isSaved);
          }
        } catch (error) {
          console.error("Bookmark fetch error", error);
        }
      };
      checkBookmark();
    }
  }, [user, calculator.id, calculator.slug]);

  const registerSaveHandler = useCallback((handler: () => any) => {
    getCalculationDataHandler.current = handler;
  }, []);

  const handleCalculationComplete = useCallback(() => {
    if (!hasPerformedCalculation) setHasPerformedCalculation(true);
  }, [hasPerformedCalculation]);

  const handleBookmark = async () => {
    if (!user) {
      toast.error("Please log in to manage bookmarks.");
      return;
    }
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      const res = await fetchAPI("/public/toggle_bookmark.php", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, calculatorId: calculator.slug }),
      });

      if (res.success) {
        toast.success(res.message);
        setIsBookmarked(res.bookmarked);
      } else {
        setIsBookmarked(previousState);
        toast.error(res.message);
      }
    } catch (error) {
      setIsBookmarked(previousState);
      toast.error("Failed to update bookmark.");
    }
  };

  const handleSaveToHistory = async () => {
    if (!user) {
      toast.error("Please log in to save your history.");
      return;
    }

    if (getCalculationDataHandler.current) {
      setSaveState("saving");
      const calculationData = getCalculationDataHandler.current();

      if (!calculationData) {
        toast.error("Please perform a valid calculation first.");
        setSaveState("idle");
        return;
      }

      try {
        const res = await fetchAPI("/public/save_calculation.php", {
          method: "POST",
          body: JSON.stringify({ userId: user.id, ...calculationData }),
        });

        if (res.success) {
          toast.success("Calculation saved!");
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        } else if (res.limit_reached) {
          toast.error(res.message, { duration: 6000 });
          setSaveState("idle");
        } else {
          toast.error(res.message || "Failed to save.");
          setSaveState("idle");
        }
      } catch (error) {
        toast.error("Save failed. Please try again.");
        setSaveState("idle");
      }
    } else {
      toast.error("This calculator is not yet configured for saving.");
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: calculator.name,
        text: calculator.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const relatedCalculators = allCalculators
    .filter(c => c.id !== calculator.id && c.category_id === calculator.category_id)
    .slice(0, 3);

  const finalRelated = relatedCalculators.length > 0 ? relatedCalculators : allCalculators.slice(0, 3);

  const faqs = Array.isArray(pageData.faq_json) ? pageData.faq_json : [];
  const descriptionHtml = pageData.content || "";

  // --- DYNAMIC BREADCRUMB DATA ---
  const categoryName = (calculator as any).primary_category_name 
    || calculator.category_names?.split('||')[0] 
    || "General";
    
  const categorySlug = (calculator as any).primary_category_slug 
    || calculator.category_slugs?.split('||')[0] 
    || "general";

  const breadcrumbData = {
    title: calculator.name,
    category_name: categoryName,
    category_slug: categorySlug
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Dynamic Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs data={breadcrumbData} type="calculator" settings={settings} />
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/calculators"
              className="group flex items-center space-x-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 group-hover:border-primary-500 dark:group-hover:border-primary-500 transition-colors">
                <SafeIcon icon={FiArrowLeft} className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              </div>
              <span>Back to Calculators</span>
            </Link>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleShare} 
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-primary-600 hover:border-primary-200 dark:hover:border-primary-800 transition-all shadow-sm"
                title="Share"
              >
                <SafeIcon icon={FiShare2} className="w-5 h-5" />
              </button>

              <button
                onClick={handleBookmark}
                className={`p-2.5 rounded-xl border transition-all shadow-sm ${
                  isBookmarked
                    ? "bg-primary-50 border-primary-200 text-primary-600 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-400"
                    : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-primary-600 hover:border-primary-200"
                }`}
                title="Bookmark"
              >
                <SafeIcon icon={FiBookmark} className="w-5 h-5" />
              </button>

              {user && (
                 <button
                  onClick={handleSaveToHistory}
                  disabled={saveState !== "idle"}
                  className={`p-2.5 rounded-xl border transition-all shadow-sm disabled:opacity-60 ${
                    saveState === "saved"
                      ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400"
                      : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-primary-600 hover:border-primary-200"
                  }`}
                  title="Save Calculation"
                >
                  <SafeIcon
                    icon={saveState === "saved" ? FiCheck : FiSave}
                    className="w-5 h-5"
                  />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-start md:items-center space-x-6">
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br ${currentVisuals.color} flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0`}>
              <SafeIcon
                icon={currentVisuals.icon}
                className="w-10 h-10 md:w-12 md:h-12 text-white"
              />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                    {calculator.name}
                 </h1>
                 {calculator.is_featured && (
                     <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                         <SafeIcon icon={FiIcons.FiStar} className="w-3 h-3 fill-current" /> Featured
                     </span>
                 )}
              </div>
              <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed">
                {calculator.description}
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <div className="p-6 md:p-8">
                  {renderCalculatorComponent(calculator.slug, {
                      onRegisterSaveHandler: registerSaveHandler,
                      onCalculationComplete: handleCalculationComplete
                  })}
                </div>
                
                {pageData?.tags && pageData.tags.length > 0 && (
                    <div className="px-6 md:px-8 pb-8 pt-2">
                        <div className="flex flex-wrap gap-2 items-center">
                            <SafeIcon icon={FiTag} className="text-neutral-400 w-4 h-4" />
                            {pageData.tags.map((tag: any, idx: number) => (
                                <Link 
                                    key={idx}
                                    href={`/calculators/tag/${tag.slug}`}
                                    className="text-xs font-medium px-2.5 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                                >
                                    {tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                {descriptionHtml && (
                <div className="p-8 border-b border-neutral-200 dark:border-neutral-700">
                    {/* --- SECURE RICH TEXT RENDERER IMPLEMENTATION --- */}
                    <div
                        className="prose prose-lg dark:prose-invert max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:shadow-md"
                    >
                        <RichTextRenderer content={normalizeHtml(descriptionHtml)} />
                    </div>
                </div>
                )}

                {faqs.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white px-8 py-6 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
                        Frequently Asked Questions
                    </h2>
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {faqs.map((faq: any, index: number) => (
                        <FaqItem key={index} faq={faq} />
                        ))}
                    </div>
                </div>
                )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
                 <SafeIcon icon={FiCpu} className="w-5 h-5 text-primary-600" />
                 Related Calculators
              </h3>
              <div className="space-y-4">
                {finalRelated.map((calc) => {
                  const itemVisuals = getVisuals(calc.slug);
                  return (
                    <Link
                      key={calc.id}
                      href={`/calculators/${calc.slug}`}
                      className="flex items-center space-x-4 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-all group border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700"
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${itemVisuals.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-300`}>
                        <SafeIcon icon={itemVisuals.icon} className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {calc.name}
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                          {calc.category_names?.split('||')[0] || "Finance"}
                        </p>
                      </div>
                      <SafeIcon icon={FiIcons.FiChevronRight} className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {!user && !isLoading && (
              <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-white dark:from-indigo-900/20 dark:via-blue-900/10 dark:to-neutral-800 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800/50 shadow-sm relative overflow-hidden animate-fade-in">
                <div className="relative z-10 text-center">
                    <div className="w-12 h-12 bg-white dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md ring-4 ring-indigo-50 dark:ring-indigo-900/40">
                        <SafeIcon icon={FiUser} className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    Save Your Work
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
                    Create a free account to save calculation history, bookmark favorite tools, and access premium features.
                    </p>
                    <Link
                    href="/login"
                    className="block w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transform hover:-translate-y-0.5"
                    >
                    Sign In / Register
                    </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}