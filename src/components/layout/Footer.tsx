"use client";

import React from "react";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import { getCalculatorLink } from "@/utils/urlHelper";
import { TextHoverEffect } from "@/components/common/TextHoverEffect";
import { SystemSlugMap } from "@/lib/content";

const { FiCpu, FiMail } = FiIcons;

interface FooterProps {
  settings?: any;
  slugs?: SystemSlugMap; // Added Type
}

const Footer = ({ settings = {}, slugs }: FooterProps) => {
  // Use settings from props or safe default
  const siteName = settings.siteName || "Your Site Name";
  const siteDesc = settings.siteDescription || "Your trusted companion for professional calculations.";
  
  // --- COPYRIGHT TEXT LOGIC ---
  const currentYear = new Date().getFullYear();
  const rawFooterText = settings.site_footer_text || "© %currentyear% %sitename%. All rights reserved.";
  
  const footerText = rawFooterText
    .replace(/%currentyear%/g, currentYear.toString())
    .replace(/%sitename%/g, siteName);

  // --- LOGO & STYLING LOGIC (SECURITY FIX APPLIED) ---
  const logoId = "site-footer-logo";
  
  // Strict Numeric Coercion: Prevents CSS Injection/XSS by forcing all DB inputs to evaluate as numbers.
  const h_mobile = Number(settings.site_logo_height_footer_mobile) || 28;
  const h_tablet = Number(settings.site_logo_height_footer_tablet) || 32;
  const h_desktop = Number(settings.site_logo_height_footer_desktop) || 40;

  const rawBrightness = Number(settings.site_logo_brightness);
  const rawOpacity = Number(settings.site_logo_opacity);
  const rawGrayscale = Number(settings.site_logo_grayscale);

  const safe_brightness = isNaN(rawBrightness) ? 100 : rawBrightness;
  const safe_opacity = isNaN(rawOpacity) ? 100 : rawOpacity;
  const safe_grayscale = isNaN(rawGrayscale) ? 0 : rawGrayscale;

  const filters = `
    brightness(${safe_brightness}%) 
    opacity(${safe_opacity}%) 
    grayscale(${safe_grayscale}%)
  `;

  // --- HELPER: Get Dynamic Slug ---
  const getSlug = (key: keyof SystemSlugMap, defaultVal: string) => {
    return slugs?.[key] ? `/${slugs[key]}` : `/${defaultVal}`;
  };

  // Links
  const footerLinks = {
    Calculators: [
      { name: "EMI Calculator", path: getCalculatorLink("emi", settings) },
      { name: "SIP Calculator", path: getCalculatorLink("sip", settings) },
      { name: "BMI Calculator", path: getCalculatorLink("bmi", settings) },
      { name: "GST Calculator", path: getCalculatorLink("gst", settings) },
      { name: "Loan Calculator", path: getCalculatorLink("loan", settings) },
    ],
    Company: [
      { name: "About Us", path: getSlug('about', 'about') },
      { name: "Blog", path: "/blog" },
      { name: "Contact", path: getSlug('contact', 'contact') },
      { name: "FAQ", path: getSlug('faq', 'faq') },
    ],
    Legal: [
      { name: "Privacy Policy", path: getSlug('privacy-policy', 'privacy-policy') },
      { name: "Terms of Service", path: getSlug('terms-of-service', 'terms-of-service') },
      { name: "Cookie Policy", path: getSlug('cookie-policy', 'cookie-policy') },
    ],
  };

  return (
    <footer className="bg-neutral-900 dark:bg-neutral-950 text-white relative overflow-hidden">
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

      {/* Background Gradient */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-black opacity-40 z-0 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              {settings.site_logo ? (
                <img
                  id={logoId}
                  src={settings.site_logo}
                  alt={siteName}
                  className="w-auto object-contain"
                />
              ) : (
                <>
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <SafeIcon icon={FiCpu} className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                    {siteName}
                  </span>
                </>
              )}
            </div>
            <p className="text-neutral-400 mb-6 max-w-md leading-relaxed text-sm">
              {siteDesc}
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 group cursor-pointer transition-all">
                <div className="p-2 bg-neutral-800 rounded-full group-hover:bg-neutral-700 transition-colors">
                  <SafeIcon icon={FiMail} className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="text-neutral-400 group-hover:text-white transition-colors text-sm">
                  {settings.seo_local_email || "support@yourdomain.com"}
                </span>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase opacity-80">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.path}
                      className="text-neutral-400 hover:text-white hover:translate-x-1 transition-all duration-200 text-left text-sm block"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* --- BRAND TEXT HOVER EFFECT --- */}
        <div className="relative w-full aspect-[4/1] md:aspect-[5/1] lg:aspect-[6/1] max-h-[30vh] flex items-center justify-center overflow-hidden mb-8">
            <div className="w-[120%] sm:w-full h-full flex items-center justify-center scale-90 sm:scale-100">
                <TextHoverEffect text={siteName.toUpperCase()} />
            </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-800 pt-8 mt-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-neutral-500 text-xs text-center md:text-left">
              {footerText}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
