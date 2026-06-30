"use client";

import React from "react";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import { Tag, Folder, ArrowRight } from "lucide-react";
import { PostContent } from "@/lib/content";

interface PostSidebarProps {
  categories?: string[];
  recentPosts?: PostContent[];
}

const PostSidebar = ({ categories = [], recentPosts = [] }: PostSidebarProps) => {
  return (
    <div className="space-y-10">
      
      {/* Categories Widget */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-white/5 flex items-center justify-center">
            <SafeIcon icon={Folder} className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">Categories</h3>
        </div>
        <div className="space-y-2">
          {categories.map((cat) => (
            <Link 
              key={cat} 
              href={`/blog?category=${encodeURIComponent(cat)}`}
              className="flex items-center justify-between group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {cat}
              </span>
              <SafeIcon icon={ArrowRight} className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Posts Widget */}
      {recentPosts.length > 0 && (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-white/5 flex items-center justify-center">
              <SafeIcon icon={Tag} className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Articles</h3>
          </div>
          <div className="space-y-6">
            {recentPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                  {post.title}
                </h4>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  {new Date(post.published_date).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostSidebar;