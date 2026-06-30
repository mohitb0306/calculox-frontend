"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import SafeIcon from "./common/SafeIcon";
import * as FiIcons from "react-icons/fi";
// We will fetch real data later, for now we use an empty array or props
// import { calculatorData } from '../data/calculatorData'; 

const { FiSearch, FiX } = FiIcons;

interface FloatingSearchProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  calculators?: any[]; // Pass data in as props for now
}

const FloatingSearch: React.FC<FloatingSearchProps> = ({ isOpen, setIsOpen, calculators = [] }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle Search Logic
  useEffect(() => {
    if (query.trim() === "") {
      setResults([]);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = calculators.filter((calc) =>
        calc.name.toLowerCase().includes(lowerQuery) ||
        calc.description?.toLowerCase().includes(lowerQuery)
      );
      setResults(filtered.slice(0, 5)); // Limit to 5
    }
  }, [query, calculators]);

  // Focus Input on Open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden"; // Prevent scrolling
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  const handleNavigate = (slug: string) => {
    setIsOpen(false);
    router.push(`/calculators/${slug}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className="relative flex items-center px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <FiSearch className="w-5 h-5 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search calculators (e.g. BMI, Loan, GST)..."
                className="flex-1 ml-4 bg-transparent border-none focus:ring-0 text-lg text-neutral-900 dark:text-white placeholder-neutral-400"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="ml-4 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <FiX className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((calc) => (
                    <button
                      key={calc.id}
                      onClick={() => handleNavigate(calc.slug)}
                      className="w-full flex items-center px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                        <SafeIcon icon={calc.icon} className="w-5 h-5" />
                      </div>
                      <div className="ml-4 flex-1">
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600">
                          {calc.name}
                        </h4>
                        <p className="text-xs text-neutral-500 truncate">
                          {calc.description}
                        </p>
                      </div>
                      <FiIcons.FiArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="p-8 text-center text-neutral-500">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  Type to search for calculators...
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingSearch;