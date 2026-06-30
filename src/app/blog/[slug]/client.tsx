"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import RichTextRenderer from "@/components/common/RichTextRenderer"; // <-- ADDED INTERCEPTOR
import { PostContent } from "@/lib/content";
import { normalizeHtml } from "@/lib/utils";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Share2,
  Bookmark,
  ThumbsUp,
  Tag,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const LoadingSkeleton = () => (
  <div className="animate-pulse bg-neutral-50 dark:bg-neutral-900 min-h-screen">
    <div className="relative bg-neutral-900 h-96">
      <div className="absolute inset-0 bg-gray-700 opacity-50"></div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md p-8">
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded-md w-1/4 mb-8"></div>
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded-md w-full mb-4"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded-md w-full"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded-md w-3/4"></div>
            </div>
          </div>
        </div>
        <aside className="lg:w-1/3 space-y-8">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md p-6 h-48"></div>
        </aside>
      </div>
    </div>
  </div>
);

const FaqItem = ({ faq }: { faq: any }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors pr-4">
          {faq.question}
        </h3>
        <div className={`p-2 rounded-full transition-colors ${isOpen ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'bg-transparent text-neutral-400'}`}>
             <SafeIcon
                icon={isOpen ? ChevronUp : ChevronDown}
                className={`flex-shrink-0 w-5 h-5 transition-transform duration-300`}
            />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div 
              className="px-6 pb-6 pt-2 text-neutral-600 dark:text-neutral-400 prose dark:prose-invert max-w-none text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: normalizeHtml(faq.answer) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ClientBlogPostProps {
  post: PostContent | null;
  relatedPosts?: PostContent[];
  settings: any;
}

const ClientBlogPost = ({ post, relatedPosts = [], settings }: ClientBlogPostProps) => {
  const [loading, setLoading] = useState(!post);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (post) {
      setLoading(false);
      setLikeCount(Math.floor(Math.random() * 100) + 10);
    }
  }, [post]);

  const getDisplayDateInfo = () => {
    if (!post) return { dateStr: "", label: "Published" };

    // Explicitly safe UTC parsing
    const parse = (d: string) => d ? new Date(d.replace(' ', 'T') + 'Z') : null;
    const published = parse(post.published_date);
    const updated = parse(post.updated_at);

    if (updated && published && updated.getTime() > published.getTime() + 60000) {
       return { 
         dateStr: updated.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
         label: "Updated"
       };
    }

    return { 
      dateStr: published ? published.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
      label: "Published"
    };
  };

  const { dateStr, label: dateLabel } = getDisplayDateInfo();

  const handleShare = () => {
    if (typeof window !== "undefined") {
      if (navigator.share) {
        navigator.share({
          title: post?.title || "",
          text: post?.excerpt || "",
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard");
      }
    }
  };

  const handleLike = () => {
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    setIsLiked(!isLiked);
  };

  const handleBookmark = () => setIsBookmarked(!isBookmarked);

  if (loading || !post) {
    return <LoadingSkeleton />;
  }

  const categoryName = post.category_name ? post.category_name.split(",")[0] : "Blog";

  // Safe extraction of the new extended Author payload
  const authorName = post.author_name || "Content Editor";
  const authorInitials = authorName.split(" ").map((n: string) => n[0]).join("").substring(0, 2);
  const authorRole = (post as any).author_role || "Content Editor";
  
  // --- ENTERPRISE FIX: Smart Fallback Logic for Author Description ---
  const authorShortDescription = post.author_short_description;
  const authorBio = (post as any).author_bio;
  const displayDescription = authorShortDescription || authorBio;
  // -------------------------------------------------------------------

  const authorImageUrl = (post as any).author_image_url;
  const authorSocials = (post as any).author_social_links || {};
  const authorSlug = (post as any).author_slug; // Extract the slug securely

  const breadcrumbData = {
    title: post.title,
    category_name: categoryName,
    category_slug: post.category_slug || undefined,
  };

  const faqs = Array.isArray((post as any).faq_json) ? (post as any).faq_json : [];

  return (
    <>
      <Toaster position="bottom-right" />

      <div className="bg-neutral-50 dark:bg-neutral-900 min-h-screen font-inter">
        {/* --- HERO SECTION --- */}
        <div className="relative bg-neutral-900 text-white">
          <img
            src={post.featured_image_url || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"}
            alt={post.title}
            className="w-full h-96 object-cover opacity-40"
          />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-primary-500 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm">
                  {categoryName}
                </span>
                <span className="text-sm text-white/90 flex items-center bg-white/10 px-2 py-0.5 rounded">
                  <SafeIcon icon={Calendar} className="mr-1.5 w-3.5 h-3.5" />
                  <span className="mr-1 opacity-75">{dateLabel}:</span> {dateStr}
                </span>
                <span className="text-white/50 hidden sm:inline">•</span>
                <span className="text-sm text-white/80 flex items-center">
                  <SafeIcon icon={Clock} className="mr-1.5 w-4 h-4" />
                  {post.read_time || 5} min read
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight drop-shadow-sm">
                {post.title}
              </h1>

              {/* DYNAMIC AUTHOR HEAD (Clickable) */}
              <div className="flex items-center">
                {authorImageUrl ? (
                    authorSlug ? (
                      <Link href={`/author/${authorSlug}`}>
                        <img src={authorImageUrl} alt={authorName} className="w-12 h-12 rounded-full object-cover mr-4 shadow-inner border-2 border-white/20 hover:opacity-80 transition-opacity" />
                      </Link>
                    ) : (
                      <img src={authorImageUrl} alt={authorName} className="w-12 h-12 rounded-full object-cover mr-4 shadow-inner border-2 border-white/20" />
                    )
                ) : (
                   authorSlug ? (
                      <Link href={`/author/${authorSlug}`}>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white text-lg font-semibold mr-4 shadow-inner border-2 border-white/20 hover:opacity-80 transition-opacity">
                          {authorInitials}
                        </div>
                      </Link>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white text-lg font-semibold mr-4 shadow-inner border-2 border-white/20">
                        {authorInitials}
                      </div>
                    )
                )}
                <div>
                  <p className="font-medium text-white text-lg">
                    {authorSlug ? (
                      <Link href={`/author/${authorSlug}`} className="hover:text-primary-300 transition-colors">
                        {authorName}
                      </Link>
                    ) : (
                        authorName
                    )}
                  </p>
                  <p className="text-white/70 text-sm">{authorRole}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Breadcrumbs data={breadcrumbData} settings={settings} />

          <div className="flex flex-col lg:flex-row gap-8">
            <main className="lg:w-2/3 min-w-0">
              <article className="bg-white dark:bg-neutral-800 rounded-xl shadow-md p-6 md:p-8 mb-8 border border-neutral-200 dark:border-neutral-700 overflow-hidden break-words">
                <Link
                  href="/blog"
                  className="inline-flex items-center mb-8 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
                >
                  <SafeIcon icon={ArrowLeft} className="mr-2 h-4 w-4" /> Back to Blog
                </Link>

                <div
                  className="
                    prose 
                    dark:prose-invert 
                    prose-lg max-w-none 
                    prose-a:text-primary-600 dark:prose-a:text-primary-400 
                    hover:prose-a:text-primary-700 dark:hover:prose-a:text-primary-300
                    prose-img:rounded-xl prose-img:shadow-lg prose-img:max-w-full prose-img:h-auto
                    [&>pre]:overflow-x-auto [&>pre]:max-w-full
                  "
                >
                  <RichTextRenderer content={normalizeHtml(post.content)} />
                </div>

                {/* --- FAQ SECTION --- */}
                {faqs.length > 0 && (
                   <div className="mt-12 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-white px-6 md:px-8 py-6 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50">
                        Frequently Asked Questions
                      </h2>
                      <div className="divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-800">
                        {faqs.map((faq: any, index: number) => (
                          <FaqItem key={index} faq={faq} />
                        ))}
                      </div>
                   </div>
                )}

                {/* --- EXTENDED AUTHOR BIO BOX (Clickable) --- */}
                {displayDescription && (
                  <div className="mt-12 p-6 md:p-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row gap-6 items-start">
                    {authorImageUrl ? (
                      authorSlug ? (
                        <Link href={`/author/${authorSlug}`} className="shrink-0">
                          <img src={authorImageUrl} alt={authorName} className="w-20 h-20 rounded-full object-cover shadow-md border border-neutral-200 dark:border-neutral-700 hover:opacity-80 transition-opacity" />
                        </Link>
                      ) : (
                        <img src={authorImageUrl} alt={authorName} className="w-20 h-20 rounded-full object-cover shadow-md border border-neutral-200 dark:border-neutral-700 shrink-0" />
                      )
                    ) : (
                      authorSlug ? (
                        <Link href={`/author/${authorSlug}`} className="shrink-0">
                          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-2xl font-bold hover:opacity-80 transition-opacity">
                            {authorInitials}
                          </div>
                        </Link>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-2xl font-bold shrink-0">
                          {authorInitials}
                        </div>
                      )
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                        Written by {authorSlug ? (
                          <Link href={`/author/${authorSlug}`} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            {authorName}
                          </Link>
                        ) : (
                          authorName
                        )}
                      </h3>
                      <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3">{authorRole}</p>
                      
                      {/* --- ENTERPRISE FIX: RENDERS THE SHORT DESCRIPTION --- */}
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">
                        {displayDescription}
                      </p>
                      {/* ----------------------------------------------------- */}
                      
                      {/* Social Links */}
                      {Object.keys(authorSocials).length > 0 && (
                        <div className="flex flex-wrap gap-4 mt-2 pt-4 border-t border-neutral-200 dark:border-neutral-700/50">
                          {Object.entries(authorSocials).map(([platform, url]) => (
                            <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 capitalize transition-colors">
                              {platform}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* --- TAGS SECTION --- */}
                {post.tags && post.tags.length > 0 && (
                   <div className="mt-10 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex flex-wrap gap-2 items-center">
                        <SafeIcon icon={Tag} className="text-neutral-500 dark:text-neutral-400 mr-1 w-4 h-4" />
                        {post.tags.map((tag: any, index: number) => {
                          const tagName = typeof tag === "string" ? tag : tag.name;
                          const tagSlug = typeof tag === "string" ? tag.toLowerCase().replace(/ /g, '-') : tag.slug;
                          return (
                            <Link key={index} href={`/blog/tag/${tagSlug}`} className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full text-xs font-medium hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-300 transition-colors">
                              {tagName}
                            </Link>
                          );
                        })}
                      </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleLike}
                      className={`flex items-center space-x-1 px-4 py-2 rounded-full transition-colors ${isLiked ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                    >
                      <SafeIcon icon={ThumbsUp} className={`w-4 h-4 ${isLiked ? "text-primary-600 dark:text-primary-400" : ""}`} />
                      <span className="font-medium">{likeCount}</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                    <button
                      onClick={handleBookmark}
                      className={`p-2.5 rounded-full transition-colors ${isBookmarked ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                    >
                      <SafeIcon icon={Bookmark} className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    >
                      <SafeIcon icon={Share2} className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </article>
            </main>

            <aside className="lg:w-1/3 min-w-0 space-y-8">
              {relatedPosts && relatedPosts.length > 0 && (
                <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md p-6 border border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 border-b border-neutral-100 dark:border-neutral-700 pb-3">
                    Related Articles
                  </h3>
                  <div className="space-y-6">
                    {relatedPosts.map((relatedPost) => (
                      <Link key={relatedPost.slug} href={`/blog/${relatedPost.slug}`} className="flex items-start space-x-4 group">
                        <div className="flex-shrink-0 w-20 h-20 overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-700 relative">
                          {relatedPost.featured_image_url ? (
                            <img src={relatedPost.featured_image_url} alt={relatedPost.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                              <SafeIcon icon={ImageIcon} className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center">
                          <h4 className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-3 leading-snug">
                             {relatedPost.title}
                          </h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-primary-100 dark:border-primary-800">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                  Subscribe to Our Newsletter
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4 text-sm">
                  Get the latest articles delivered to your inbox.
                </p>
                <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-gradient-to-r from-primary-500 to-blue-600 text-white rounded-lg hover:from-primary-600 hover:to-blue-700 transition-all duration-200 font-medium text-sm shadow-sm"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientBlogPost;