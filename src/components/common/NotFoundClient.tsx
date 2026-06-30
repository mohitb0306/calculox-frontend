"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function NotFoundClient() {
  const pathname = usePathname();
  const hasLogged = useRef(false);

  useEffect(() => {
    if (hasLogged.current) return;
    
    const logError = async () => {
      try {
        // Construct the full URI being accessed
        const fullUri = window.location.pathname + window.location.search;
        
        // Fire-and-forget request to the PHP backend
        // We use the full API URL strictly from env to ensure it hits the correct environment
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        
        await fetch(`${apiUrl}/public/log_404.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: fullUri }),
          keepalive: true // Ensure request completes even if user navigates away
        });
        
        hasLogged.current = true;
      } catch (error) {
        console.error("Background 404 logging failed:", error);
      }
    };

    logError();
  }, [pathname]);

  return null; // This component renders nothing visually
}