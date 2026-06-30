"use client";

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

/**
 * LowercaseRedirectInner (Global SEO Enforcer)
 * ---------------------------------------
 * Google treats /Page and /page as duplicate content.
 * This component enforces strict lowercase URLs across the entire application.
 */
const LowercaseRedirectInner = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;

    // --- SECURITY & SYSTEM EXCLUSION LIST ---
    // These routes contain sensitive, case-sensitive hashes/tokens or system files.
    // We MUST NOT lowercase them, or functionality will break.
    const excludedPrefixes = [
        '/reset-password',   // Tokens are often base64 (case-sensitive)
        '/verify-email',     // Verification codes
        '/admin',            // Admin panel 
        '/api',              // API routes
        '/_next',            // Next.js system resources
        '/static',           // Static assets
        '/assets'            // Public assets
    ];

    const isExcluded = excludedPrefixes.some(prefix => pathname.startsWith(prefix));

    // Check if path has any uppercase characters
    if (!isExcluded && /[A-Z]/.test(pathname)) {
        const lowerPath = pathname.toLowerCase();
        const queryString = searchParams.toString();
        const fullPath = queryString ? `${lowerPath}?${queryString}` : lowerPath;
        
        // --- EXECUTE REDIRECT ---
        // 'replace' ensures the uppercase URL is removed from Browser History.
        console.log(`[SEO Normalizer] Redirecting ${pathname} -> ${lowerPath}`);
        router.replace(fullPath);
    }

  }, [pathname, searchParams, router]);

  return null; // This component renders nothing visually
};

// --- THE SUSPENSE WRAPPER FIX ---
const LowercaseRedirect = () => {
  return (
    <Suspense fallback={null}>
      <LowercaseRedirectInner />
    </Suspense>
  );
};

export default LowercaseRedirect;