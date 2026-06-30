"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import CalculatorCard from "@/components/cards/CalculatorCard";
import PostCard from "@/components/cards/PostCard";
import { getVisuals } from "@/data/calculatorData";

const { FiTag, FiArrowLeft, FiLayers } = FiIcons;

interface TagArchiveProps {
  slug: string;
  tagName: string;
  type: "calculator" | "post";
  items: any[]; // Mixed array of Posts or Calculators
  settings: any;
}

const TagArchiveClient = ({ slug, tagName, type, items, settings }: TagArchiveProps) => {
  
  // Enhanced visuals for calculators
  const enhancedCalculators = type === 'calculator' 
    ? items.map(calc => ({ ...calc, ...getVisuals(calc.slug) }))
    : [];

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 min-h-screen py-12 font-inter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mb-4">
            <SafeIcon icon={FiTag} className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white capitalize mb-2">
            {tagName} {type === 'calculator' ? 'Calculators' : 'Articles'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Browse all {type === 'calculator' ? 'tools' : 'posts'} tagged with &quot;{tagName}&quot;
          </p>
        </div>

        {/* Back Link */}
        <div className="mb-8">
           <Link
              href={type === 'calculator' ? '/calculators' : '/blog'}
              className="inline-flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
           >
              <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
              <span>Back to {type === 'calculator' ? 'Calculators' : 'Blog'}</span>
           </Link>
        </div>

        {/* Grid Content */}
        {items.length > 0 ? (
          <div className={type === 'calculator' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          }>
            <AnimatePresence>
              {type === 'calculator' ? (
                enhancedCalculators.map((calc, index) => (
                  <CalculatorCard key={calc.id} calc={calc} index={index} />
                ))
              ) : (
                items.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} settings={settings} />
                ))
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 px-6 rounded-3xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
          >
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SafeIcon icon={FiLayers} className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">No Content Found</h3>
            <p className="text-neutral-500 dark:text-neutral-400">There are no items associated with this tag yet.</p>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default TagArchiveClient;