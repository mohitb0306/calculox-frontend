'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
          error_message: 'GLOBAL FATAL: ' + (error.message || 'Next.js Root Layout Crash'),
          stack_trace: error.stack || 'No stack trace available',
          url_endpoint: window.location.href,
        };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        await fetch(`${apiUrl}/public/log_telemetry.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        // Failsafe
      }
    };

    logError();
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 text-center font-sans">
          <div className="max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Critical System Error</h2>
            <p className="text-gray-600 mb-8">
              A core component failed to load. The issue has been automatically reported.
            </p>
            <button
              onClick={() => reset()}
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Reload System
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}