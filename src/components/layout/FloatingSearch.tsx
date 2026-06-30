"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { calculatorData } from '@/data/calculatorData';

const { FiSearch, FiX } = FiIcons;

interface FloatingSearchProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const FloatingSearch = ({ isOpen, setIsOpen }: FloatingSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const scrollPositionRef = useRef(0);

  // --- Scroll Locking Logic (Matches Old Project) ---
  useEffect(() => {
    if (isOpen) {
      scrollPositionRef.current = window.scrollY;
      
      requestAnimationFrame(() => {
        document.body.style.cssText = `
          position: fixed !important;
          top: -${scrollPositionRef.current}px !important;
          width: 100% !important;
          overflow: hidden !important;
        `;
        
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 50);
      });
    } else {
      const scrollY = scrollPositionRef.current;
      document.body.style.cssText = '';
      window.scrollTo(0, scrollY);
    }

    return () => {
      if (isOpen) {
        document.body.style.cssText = '';
        window.scrollTo(0, scrollPositionRef.current);
      }
    };
  }, [isOpen]);

  // --- Search Logic ---
  useEffect(() => {
    if (query.trim()) {
      const filtered = calculatorData.filter(calc => 
        calc.name.toLowerCase().includes(query.toLowerCase()) || 
        calc.description.toLowerCase().includes(query.toLowerCase()) || 
        calc.category.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered.slice(0, 5));
    } else {
      setResults([]);
    }
  }, [query]);

  const handleResultClick = (calc: any) => {
    const slug = calc.slug || calc.id;
    router.push(`/calculators/${slug}`);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: 0.15,
            ease: "easeOut" as const
          }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-20"
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            willChange: 'opacity' // GPU Acceleration
          }}
          onClick={handleOutsideClick}
          role="dialog" // Accessibility Enhancement
          aria-modal="true" // Accessibility Enhancement
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.15,
              ease: "easeOut" as const
            }}
            style={{ 
              transformOrigin: "top", // Prevents scaling jitter
              willChange: "transform, opacity" // GPU Acceleration
            }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center space-x-3">
                <SafeIcon icon={FiSearch} className="w-5 h-5 text-neutral-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Search calculators..."
                  className="flex-1 bg-transparent border-none outline-none text-neutral-900 dark:text-white placeholder-neutral-500 text-sm"
                  aria-label="Search calculators"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 p-1 rounded transition-colors flex-shrink-0"
                  aria-label="Close search"
                >
                  <SafeIcon icon={FiX} className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-64 overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                  {results.map((calc) => (
                    <button
                      key={calc.id}
                      onClick={() => handleResultClick(calc)}
                      className="w-full text-left p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150 group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${calc.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-150`}>
                          <SafeIcon icon={calc.icon} className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                            {calc.name}
                          </h3>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                            {calc.category}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.trim() ? (
                <div className="p-6 text-center">
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">
                    No results found for &quot;{query}&quot;
                  </p>
                  <button
                    onClick={() => setQuery('')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    Start typing to search calculators
                  </p>
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