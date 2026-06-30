// Define the base URL from our environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL;

type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

/**
 * A centralized fetch wrapper for Next.js (App Router)
 * Designed for public, unauthenticated API requests.
 */
export async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  // 1. Construct Headers
  const headers: any = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 2. Make the Request
  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      // Default to 'no-store' to prevent stale data in Next.js caching,
      // unless the caller explicitly asks for caching.
      cache: options.cache || "no-store", 
    });

    // 3. Handle Errors
    if (!res.ok) {
      // Try to parse the error message from the PHP API
      const errorData = await res.json().catch(() => ({}));

      // GRACEFUL 404 HANDLING:
      // If the API explicitly returns a 404 (Not Found), we return the payload
      // instead of throwing a hard error.
      // This prevents 'lib/content.ts' from logging
      // an exception, which stops Next.js from throwing the red error overlay.
      if (res.status === 404) {
          return errorData;
      }

      // For actual crashes (500s) we still throw an error
      throw new Error(errorData.message || `API Error: ${res.status}`);
    }

    // 4. Return JSON
    return await res.json();

  } catch (error) {
    console.error(`[API Fetch Error] ${url}:`, error);
    throw error;
  }
}