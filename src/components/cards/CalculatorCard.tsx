"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import SafeIcon from "../common/SafeIcon";
import * as FiIcons from "react-icons/fi";

const { FiCpu, FiStar, FiArrowRight } = FiIcons;

interface CalculatorCardProps {
  calc: any; // We'll define a stricter type later
  index?: number;
}

const CalculatorCard: React.FC<CalculatorCardProps> = ({ calc, index = 0 }) => {
  // Construct the link manually since we don't have the 'settings' context yet
  // In Next.js, we usually stick to a standard structure like /calculators/[slug]
  const calcLink = `/calculators/${calc.slug}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="h-full"
    >
      <Link
        href={calcLink}
        className="group flex flex-col h-full bg-white dark:bg-neutral-800 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-200 dark:border-neutral-700"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform duration-300">
            <SafeIcon
              icon={calc.icon || FiCpu}
              className="w-6 h-6"
            />
          </div>
          {calc.is_featured && (
            <div className="flex items-center space-x-1 text-yellow-500">
              <FiStar className="w-3 h-3" />
              <span className="text-xs font-medium">Featured</span>
            </div>
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {calc.name}
        </h3>
        
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4 flex-grow line-clamp-2">
          {calc.description || "Professional calculator tool."}
        </p>

        {/* Footer of the card */}
        <div className="mt-auto flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
          <span className="inline-block px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-md text-xs font-medium">
            {calc.category_name || "General"}
          </span>
          <FiArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>
    </motion.div>
  );
};

export default CalculatorCard;