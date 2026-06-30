"use client";

import React, { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

interface ScriptItem {
  id: number | string;
  name: string;
  code: string;
  enabled: boolean;
}

interface ThirdPartyScriptsProps {
  settings: any;
}

const ThirdPartyScripts = ({ settings }: ThirdPartyScriptsProps) => {
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(false);
  const [hasMarketingConsent, setHasMarketingConsent] = useState(false);
  
  const headerScriptInjectedRef = useRef(false);
  const footerScriptInjectedRef = useRef(false);

  // --- 1. State Sync & Event Listener ---
  useEffect(() => {
    const syncConsentState = () => {
      const prefsStr = localStorage.getItem('cookiePreferences');
      if (prefsStr) {
        try {
          const prefs = JSON.parse(prefsStr);
          setHasAnalyticsConsent(!!prefs.analytics);
          setHasMarketingConsent(!!prefs.marketing);
        } catch (e) {
          console.error("Failed to parse cookie preferences", e);
        }
      }
    };

    // Initial check on mount
    syncConsentState();

    // Listen for updates from CookieConsent.tsx
    window.addEventListener("cookieConsentUpdated", syncConsentState);
    return () => window.removeEventListener("cookieConsentUpdated", syncConsentState);
  }, []);

  // --- Helper: Parse Scripts from JSON string ---
  const getEnabledScripts = (jsonString: string): string => {
    if (!jsonString) return "";

    try {
      const parsed = JSON.parse(jsonString);

      if (Array.isArray(parsed)) {
        return parsed
          .filter((s: ScriptItem) => s.enabled === true)
          .map((s: ScriptItem) => s.code)
          .join('\n');
      }
    } catch (e) {
      // Legacy support for raw string
      return jsonString;
    }
    return "";
  };

  // --- Helper: Inject Raw HTML (Safe Injection) ---
  const injectRawHtml = (htmlString: string, location: 'head' | 'body') => {
    if (!htmlString || !htmlString.trim()) return;

    try {
      const range = document.createRange();
      range.selectNode(document.body);
      const fragment = range.createContextualFragment(htmlString);

      if (location === 'head') {
        document.head.appendChild(fragment);
      } else {
        document.body.appendChild(fragment);
      }
    } catch (e) {
      console.error(`[ThirdPartyScripts] Failed to inject ${location} scripts:`, e);
    }
  };

  // --- 2. Dynamic Custom Script Injection ---
  // We assume custom scripts added via cPanel are Marketing/Tracking tools (e.g. Meta Pixel)
  useEffect(() => {
    if (hasMarketingConsent) {
      if (!headerScriptInjectedRef.current && settings?.integration_header_scripts) {
        const headerCode = getEnabledScripts(settings.integration_header_scripts);
        injectRawHtml(headerCode, 'head');
        headerScriptInjectedRef.current = true;
      }

      if (!footerScriptInjectedRef.current && settings?.integration_footer_scripts) {
        const footerCode = getEnabledScripts(settings.integration_footer_scripts);
        injectRawHtml(footerCode, 'body');
        footerScriptInjectedRef.current = true;
      }
    }
  }, [settings, hasMarketingConsent]);

  // --- 3. Google Analytics 4 (Native Next.js Script) ---
  const gaId = settings?.integration_ga4_id;

  return (
    <>
      {/* ONLY load Google Analytics if user explicitly toggled Analytics to ON */}
      {hasAnalyticsConsent && gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}
    </>
  );
};

export default ThirdPartyScripts;