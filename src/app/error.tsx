'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const logError = async () => {
      try {
        const payload = {
          environment: 'frontend',
          severity: 'critical',
          error_message: error.message || 'Next.js Frontend Render Crash',
          stack_trace: error.stack || 'No stack trace available',
          url_endpoint: window.location.href,
        };

        // --- FIX APPLIED: Absolute URL Fallback Eliminated ---
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        await fetch(`${apiUrl}/public/log_telemetry.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error('Telemetry logging failed', e);
      }
    };

    logError();
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center font-sans">
      <div className="max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Pardon our dust!</h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          We encountered an unexpected technical issue while loading this page. Our telemetry system has securely logged the details for our engineers to review.
        </p>
        <button
          onClick={() => reset()}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}