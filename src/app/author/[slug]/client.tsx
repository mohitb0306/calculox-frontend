"use client";

import React from "react";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import PostCard from "@/components/cards/PostCard";
import { Check, User } from "lucide-react";

// --- BULLETPROOF NATIVE ICONS ---
// Bypasses lucide-react version mismatches by defining standard SVGs directly
const LinkedinIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

const XIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props} stroke="none">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const FacebookIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const InstagramIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const YoutubeIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const GithubIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

const GlobeIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);
// --------------------------------

interface AuthorData {
  author: {
    id: number;
    name: string;
    slug: string;
    role: string;
    bio: string;
    social_links: Record<string, string>;
    profile_image_url: string | null;
  };
  posts: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
  };
}

// --- ENTERPRISE SECURITY FIX: SAFE URL PARSER (OWASP A03: XSS Prevention) ---
// This function strictly normalizes and validates the URL against malicious javascript: URIs.
// It fails securely to '#' if the URL is invalid or attempting an exploit.
const getSafeUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
};
// -----------------------------------------------------------------------------

export default function ClientAuthorPage({ data, settings }: { data: AuthorData; settings: any }) {
  const { author, posts, pagination } = data;
  const authorInitials = author.name.split(" ").map(n => n[0]).join("").substring(0, 2);

  // Securely map to the native SVGs
  const getSocialIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('linkedin')) return LinkedinIcon;
    if (p.includes('twitter') || p.includes('x') || p === 'x') return XIcon;
    if (p.includes('facebook')) return FacebookIcon;
    if (p.includes('instagram')) return InstagramIcon;
    if (p.includes('youtube')) return YoutubeIcon;
    if (p.includes('github')) return GithubIcon;
    return GlobeIcon;
  };

  return (
    <main className="pb-24 bg-neutral-50 dark:bg-neutral-900 min-h-screen font-inter">
      <div className="h-64 sm:h-80 bg-gradient-to-r from-slate-900 via-primary-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-32 sm:-mt-40">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-700 p-8 sm:p-12">
          
          <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start text-center sm:text-left">
            <div className="shrink-0 relative">
              {author.profile_image_url ? (
                <img 
                    src={author.profile_image_url} 
                    alt={author.name} 
                    className="w-40 h-40 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-lg bg-neutral-100 dark:bg-neutral-700"
                />
              ) : (
                <div className="w-40 h-40 rounded-full flex items-center justify-center border-4 border-white dark:border-neutral-800 shadow-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-5xl font-bold uppercase">
                  {authorInitials}
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-primary-500 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-800 shadow-sm" title="Verified Expert">
                  <SafeIcon icon={Check} className="w-4 h-4" />
                </div>
            </div>

            <div className="flex-1 pt-2">
                <div className="uppercase tracking-widest text-primary-600 dark:text-primary-400 font-bold text-xs mb-2">
                    {author.role} {/* <-- REMOVED HARDCODED "GUEST AUTHOR", REPLACED WITH DYNAMIC ROLE */}
                </div>
 
                <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white mb-4">
                    {author.name}
                </h1>
                
                {Object.keys(author.social_links).length > 0 && (
                    <div className="flex gap-3 justify-center sm:justify-start">
                    {Object.entries(author.social_links).map(([platform, url]) => (
                        <a 
                          key={platform}
                          href={getSafeUrl(url as string)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          title={platform}
                          className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors border border-neutral-200 dark:border-neutral-600"
                        >
                            <SafeIcon icon={getSocialIcon(platform)} className="w-4 h-4" />
                         </a>
                    ))}
                  </div>
                )}
            </div>
          </div>

           {author.bio && (
            <>
              <hr className="my-10 border-neutral-100 dark:border-neutral-700" />
              <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">About the Author</h2>
                  <div className="prose dark:prose-invert prose-lg text-neutral-600 dark:text-neutral-400 max-w-none leading-relaxed whitespace-pre-wrap">
                      {author.bio}
                  </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="flex items-center justify-between mb-8 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Recent Articles</h3>
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
                {pagination.totalPosts} {pagination.totalPosts === 1 ? 'Article' : 'Articles'}
            </span>
        </div>

        {posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post, index) => (
                    <PostCard key={post.id} post={post} index={index} settings={settings} />
                ))}
            </div>
             
            {pagination.totalPages > 1 && (
              <div className="mt-12 flex justify-center gap-2">
                {Array.from({ length: pagination.totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Link
                      key={pageNum}
                      href={`/author/${author.slug}?page=${pageNum}`} 
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-colors ${
                        pagination.currentPage === pageNum 
                          ? 'bg-primary-600 text-white shadow-md' 
                          : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <SafeIcon icon={User} className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">No Articles Yet</h4>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                {author.name} hasn't published any articles yet. Check back later for their insights.
              </p>
          </div>
        )}
      </div>
    </main>
  );
}