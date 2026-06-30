"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import FloatingSearch from "./FloatingSearch";
import { Category, SystemSlugMap } from "@/lib/content";

// Icons (Removed user-specific icons like FiUser, FiLogOut, FiSettings)
const {
  FiSun, FiMoon, FiMenu, FiX, FiCpu, FiSearch, 
  FiChevronDown, FiGrid, FiFileText,
} = FiIcons;

interface NavbarProps {
  calculatorCategories?: Category[];
  blogCategories?: Category[];
  settings?: any;
  slugs?: SystemSlugMap; // Added Type
}

// 1. Rename the main function to NavbarInner
const NavbarInner = ({ 
  calculatorCategories = [], 
  blogCategories = [], 
  settings = {}, 
  slugs // Destructure slugs
}: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<any>({});

  const { isDark, toggleTheme } = useTheme();
  
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const dropdownTimeout = useRef<any>(null);

  // --- Dynamic Categories (Top 5) ---
  const topCalcCats = calculatorCategories.slice(0, 5);
  const topBlogCats = blogCategories.slice(0, 5);

  // --- HELPER: Get Dynamic Slug ---
  // Safely fallback to the default key if the map isn't loaded for some reason
  const getSlug = (key: keyof SystemSlugMap, defaultVal: string) => {
    return slugs?.[key] ? `/${slugs[key]}` : `/${defaultVal}`;
  };

  const aboutLink = getSlug('about', 'about');
  const faqLink = getSlug('faq', 'faq');
  const contactLink = getSlug('contact', 'contact');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    // OPTIMIZATION: passive: true significantly improves scroll performance in Lighthouse
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
  }, [pathname, searchParams]);

  const handleMouseEnter = (menu: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 150);
  };

  const toggleMobileSubmenu = (menu: string) => {
    setMobileExpanded((prev: any) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const NavLink = ({ to, label }: { to: string; label: string }) => {
    const isActive = pathname === to;
    return (
      <Link
        href={to}
        className={`relative px-3 py-2 text-[15px] font-medium transition-all duration-200 rounded-lg group ${
          isActive
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10"
            : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/50 dark:hover:bg-white/5"
        }`}
      >
        {label}
      </Link>
    );
  };

  // --- RESPONSIVE LOGO STYLE LOGIC (SECURITY FIX APPLIED) ---
  const logoId = "site-header-logo";
  
  // Strict Numeric Coercion: Prevents CSS Injection/XSS by forcing all DB inputs to evaluate as numbers.
  const h_mobile = Number(settings?.site_logo_height_header_mobile) || 28;
  const h_tablet = Number(settings?.site_logo_height_header_tablet) || 32;
  const h_desktop = Number(settings?.site_logo_height_header_desktop) || 40;

  const rawBrightness = Number(settings?.site_logo_brightness);
  const rawOpacity = Number(settings?.site_logo_opacity);
  const rawGrayscale = Number(settings?.site_logo_grayscale);

  const safe_brightness = isNaN(rawBrightness) ? 100 : rawBrightness;
  const safe_opacity = isNaN(rawOpacity) ? 100 : rawOpacity;
  const safe_grayscale = isNaN(rawGrayscale) ? 0 : rawGrayscale;

  const filters = `
    brightness(${safe_brightness}%) 
    opacity(${safe_opacity}%) 
    grayscale(${safe_grayscale}%)
  `;

  return (
    <>
      {/* SECURITY FIX: Replaced dangerouslySetInnerHTML with native React style blocks */}
      <style>{`
        #${logoId} { 
          height: ${h_mobile}px; 
          width: auto; 
          filter: ${filters}; 
          object-fit: contain;
          max-width: 100%;
        }
        @media (min-width: 768px) { 
          #${logoId} { height: ${h_tablet}px; } 
        }
        @media (min-width: 1024px) { 
          #${logoId} { height: ${h_desktop}px; } 
        }
      `}</style>

      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/60 shadow-sm"
            : "bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 transition-all duration-300">
            
            {/* Logo Section */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              {settings?.site_logo ? (
                 <img
                  id={logoId}
                  src={settings.site_logo}
                  alt={settings.siteName || "Your Site Name"}
                  fetchPriority="high"
                  decoding="async"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <>
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
                    <SafeIcon icon={FiCpu} className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white font-mulish">
                    {settings.siteName || "Your Site Name"}
                  </span>
                </>
              )}
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              <NavLink to="/" label="Home" />

              {/* Calculators Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter("calculators")}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium transition-all rounded-lg group ${
                    activeDropdown === "calculators" || pathname.startsWith("/calculators")
                      ? "text-indigo-600 bg-indigo-50/80 dark:bg-indigo-900/20"
                      : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                  onClick={() => router.push("/calculators")}
                >
                  <span>Calculators</span>
                  <SafeIcon
                    icon={FiChevronDown}
                    className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === "calculators" ? "rotate-180" : "text-neutral-400"
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {activeDropdown === "calculators" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" as const }}
                      style={{ transformOrigin: "top" }}
                      className="absolute left-0 mt-2 w-72 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden p-2"
                    >
                      <Link
                        href="/calculators"
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100">
                          <SafeIcon icon={FiGrid} className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                            View All Tools
                          </span>
                          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Explore our full suite
                          </span>
                        </div>
                      </Link>
                      <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-2 mx-2" />
                      <div className="px-2 pb-1">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-2 block">
                          Categories
                        </span>
                        {topCalcCats.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/calculators/category/${cat.slug}`}
                            className="block px-2 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Blog Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter("blog")}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium transition-all rounded-lg group ${
                    activeDropdown === "blog" || pathname.startsWith("/blog")
                      ? "text-indigo-600 bg-indigo-50/80 dark:bg-indigo-900/20"
                      : "text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                  onClick={() => router.push("/blog")}
                >
                  <span>Blog</span>
                  <SafeIcon
                    icon={FiChevronDown}
                    className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === "blog" ? "rotate-180" : "text-neutral-400"
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {activeDropdown === "blog" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: "easeOut" as const }}
                      style={{ transformOrigin: "top" }}
                      className="absolute left-0 mt-2 w-72 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden p-2"
                    >
                      <Link
                        href="/blog"
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100">
                          <SafeIcon icon={FiFileText} className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                            All Articles
                          </span>
                          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Latest news & guides
                          </span>
                        </div>
                      </Link>
                       <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-2 mx-2" />
                       <div className="px-2 pb-1">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-2 mb-2 block">
                          Topics
                        </span>
                        {topBlogCats.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/blog/category/${cat.slug}`}
                            className="block px-2 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* DYNAMIC NAVIGATION LINKS */}
              <NavLink to={aboutLink} label="About" />
              <NavLink to={faqLink} label="FAQ" />
              <NavLink to={contactLink} label="Contact" />
            </div>

            {/* Actions (Search, Theme) */}
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setSearchModalOpen(true)}
                className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-all duration-200"
                aria-label="Search"
              >
                <SafeIcon icon={FiSearch} className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-all duration-200"
                aria-label="Toggle Theme"
              >
                <SafeIcon
                  icon={isDark ? FiSun : FiMoon}
                  className="w-5 h-5"
                />
              </button>

              {/* Mobile Menu Button */}
              <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <SafeIcon icon={isOpen ? FiX : FiMenu} className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* --- MOBILE DRAWER --- */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              exit={{ opacity: 0, height: 0 }} 
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ transformOrigin: "top" }}
              className="lg:hidden bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xl"
            >
              <div className="px-4 pt-4 pb-8 space-y-1">
                <Link href="/" className="block px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800">Home</Link>
                
                {/* Calculators Mobile Dropdown */}
                <button onClick={() => toggleMobileSubmenu("calculators")} className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50">
                  <span className="flex items-center gap-3"><SafeIcon icon={FiIcons.FiCpu} className="w-4 h-4 text-indigo-500" /> Calculators</span>
                  <SafeIcon icon={FiChevronDown} className={`w-4 h-4 transition-transform ${mobileExpanded.calculators ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {mobileExpanded.calculators && (
                    <motion.div 
                      initial={{ height: 0 }} 
                      animate={{ height: "auto" }} 
                      exit={{ height: 0 }} 
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="pl-4 border-l-2 border-neutral-100 ml-4 space-y-1 my-1 overflow-hidden"
                    >
                      <Link href="/calculators" className="block px-3 py-2 rounded-lg text-sm text-indigo-600 font-medium bg-indigo-50/50">View All</Link>
                      {topCalcCats.map((cat) => (
                        <Link key={cat.id} href={`/calculators/category/${cat.slug}`} className="block px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:text-indigo-600">
                          {cat.name}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Blog Mobile Dropdown */}
                <button onClick={() => toggleMobileSubmenu("blog")} className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50">
                  <span className="flex items-center gap-3"><SafeIcon icon={FiFileText} className="w-4 h-4 text-blue-500" /> Blog</span>
                  <SafeIcon icon={FiChevronDown} className={`w-4 h-4 transition-transform ${mobileExpanded.blog ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {mobileExpanded.blog && (
                    <motion.div 
                      initial={{ height: 0 }} 
                      animate={{ height: "auto" }} 
                      exit={{ height: 0 }} 
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="pl-4 border-l-2 border-neutral-100 ml-4 space-y-1 my-1 overflow-hidden"
                    >
                      <Link href="/blog" className="block px-3 py-2 rounded-lg text-sm text-indigo-600 font-medium bg-indigo-50/50">View All</Link>
                      {topBlogCats.map((cat) => (
                        <Link key={cat.id} href={`/blog/category/${cat.slug}`} className="block px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:text-indigo-600">
                          {cat.name}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* DYNAMIC MOBILE LINKS */}
                <Link href={aboutLink} className="block px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50">About</Link>
                <Link href={faqLink} className="block px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50">FAQ</Link>
                <Link href={contactLink} className="block px-3 py-3 rounded-lg text-base font-medium text-neutral-900 dark:text-white hover:bg-neutral-50">Contact</Link>
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <FloatingSearch isOpen={searchModalOpen} setIsOpen={setSearchModalOpen} />
    </>
  );
};

// 2. Wrap the NavbarInner inside a Suspense boundary for Next.js 16 Static Generation
const Navbar = (props: NavbarProps) => {
  return (
    <Suspense fallback={
      <div className="h-16 md:h-20 w-full fixed top-0 left-0 right-0 z-50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-transparent shadow-none" />
    }>
      <NavbarInner {...props} />
    </Suspense>
  );
};

export default Navbar;