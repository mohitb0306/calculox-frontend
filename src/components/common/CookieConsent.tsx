"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import toast from 'react-hot-toast';

const { FiX, FiShield, FiSettings } = FiIcons;

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const CookieConsent = () => {
  // Two distinct UI states
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    essential: true, // Strictly necessary, legally always true
    analytics: false, // Must default to false for GDPR
    marketing: false, // Must default to false for GDPR
    functional: false // Must default to false for GDPR
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const consent = localStorage.getItem('cookieConsent');
    const savedPreferences = localStorage.getItem('cookiePreferences');
    
    if (consent && savedPreferences) {
      setCookiePreferences(JSON.parse(savedPreferences));
    } else {
      // Show the bottom banner initially after a slight delay
      const timer = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Prevent Background Scrolling when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup function to ensure scrolling is restored if component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleAcceptAll = () => {
    const preferences = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    savePreferences(preferences);
  };

  const handleDeclineAll = () => {
    const preferences = {
      essential: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    savePreferences(preferences);
  };

  const handleSavePreferences = () => {
    savePreferences(cookiePreferences);
  };

  const savePreferences = (preferences: CookiePreferences) => {
    localStorage.setItem('cookieConsent', 'set');
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    
    // Dispatch event to trigger script injection immediately in ThirdPartyScripts
    window.dispatchEvent(new Event("cookieConsentUpdated"));

    // Close both UIs
    setShowBanner(false);
    setShowModal(false);
    
    toast.success('Privacy preferences updated successfully', { id: 'cookie-toast' });
  };

  const handleTogglePreference = (key: keyof CookiePreferences) => {
    if (key === 'essential') return;
    setCookiePreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const openSettings = () => {
    setShowBanner(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowBanner(true); // Return the user to the banner state since no choice was saved
  };

  if (!mounted) return null;

  return (
    <>
      {/* LAYER 1: The Bottom Floating Banner */}
      <AnimatePresence>
        {showBanner && !showModal && (
          <motion.div
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="fixed bottom-0 left-0 right-0 z-[9990] p-4 sm:p-6 pointer-events-none"
          >
            <div className="max-w-7xl mx-auto bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-2xl rounded-2xl p-5 sm:px-8 sm:py-6 flex flex-col lg:flex-row items-center justify-between gap-6 pointer-events-auto">
              
              <div className="flex-1 max-w-3xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                  <SafeIcon icon={FiShield} className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  We value your privacy
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Allow Cookies", you consent to our use of cookies. Read our <Link href="/privacy-policy" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Privacy Policy</Link>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
                <button
                  onClick={handleDeclineAll}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={openSettings}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <SafeIcon icon={FiSettings} className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                >
                  Allow Cookies
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LAYER 2: The Central Preference Center Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="w-full max-w-2xl bg-white dark:bg-[#111] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <SafeIcon icon={FiSettings} className="w-4 h-4" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Privacy Preferences</h2>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                  aria-label="Close modal"
                >
                  <SafeIcon icon={FiX} className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                  We use cookies and similar tracking technologies to optimize your experience. Below, you can manage your consent preferences for different categories of cookies. Review our <Link href="/privacy-policy" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Privacy Policy</Link> for detailed information on how we handle your data.
                </p>

                <div className="space-y-3">
                  {/* 1. Essential */}
                  <div className="flex items-start justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                    <div className="pr-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Strictly Necessary Cookies</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Required for the site to function securely (e.g., session routing, CSRF protection). These do not store personally identifiable information and cannot be disabled in our systems.
                      </p>
                    </div>
                    <div className="shrink-0 mt-1 flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">Always Active</span>
                      <div className="w-11 h-6 bg-indigo-500/40 rounded-full relative cursor-not-allowed">
                        <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Personalization / Functional */}
                  <div 
                    className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors cursor-pointer group"
                    onClick={() => handleTogglePreference('functional')}
                  >
                    <div className="pr-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Functional Cookies</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enables personalization such as remembering your preferred calculator units (Metric/Imperial), saved theme settings (Dark/Light), and recently accessed tools.
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${cookiePreferences.functional ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        {/* --- THE FIX: Changed translate-x-5.5 to translate-x-5 --- */}
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-300 ${cookiePreferences.functional ? 'translate-x-5 left-0.5' : 'translate-x-0 left-0.5'}`}></div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Analytics */}
                  <div 
                    className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors cursor-pointer group"
                    onClick={() => handleTogglePreference('analytics')}
                  >
                    <div className="pr-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Performance Cookies</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Allows us to collect anonymous, aggregated data on calculator usage, measure error rates on complex formulas, and track traffic sources to optimize platform performance.
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${cookiePreferences.analytics ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        {/* --- THE FIX: Changed translate-x-5.5 to translate-x-5 --- */}
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-300 ${cookiePreferences.analytics ? 'translate-x-5 left-0.5' : 'translate-x-0 left-0.5'}`}></div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Marketing */}
                  <div 
                    className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors cursor-pointer group"
                    onClick={() => handleTogglePreference('marketing')}
                  >
                    <div className="pr-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Targeting Cookies</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Set by our advertising partners to build a profile of your interests and deliver relevant advertisements on other websites based on the tools you use here.
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${cookiePreferences.marketing ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        {/* --- THE FIX: Changed translate-x-5.5 to translate-x-5 --- */}
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-300 ${cookiePreferences.marketing ? 'translate-x-5 left-0.5' : 'translate-x-0 left-0.5'}`}></div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="w-full sm:w-auto px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
                >
                  Save Preferences
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CookieConsent;