"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import { Calendar, Clock, Image as ImageIcon } from "lucide-react";
import { PostContent } from "@/lib/content";
import { formatDateTime } from "@/utils/dateFormatter";
import { getPostLink } from "@/utils/urlHelper";

interface PostCardProps {
  post: PostContent;
  index?: number;
  settings?: any; // Added settings prop
}

const PostCard = ({ post, index = 0, settings = {} }: PostCardProps) => {
  
  // --- DATE LOGIC ---
  const getDisplayDate = () => {
    const parse = (d: string | undefined) => d ? new Date(d.replace(' ', 'T') + 'Z') : null;
    
    const published = parse(post.published_date);
    const updated = parse(post.updated_at);

    // If updated date exists and is newer than published date (with 60s tolerance)
    if (updated && published && updated.getTime() > published.getTime() + 60000) {
      return post.updated_at;
    }
    return post.published_date;
  };

  const dateToDisplay = getDisplayDate();
  const formattedDate = formatDateTime(dateToDisplay, settings);

  // --- LINK LOGIC ---
  const postLink = getPostLink(post, settings);

  // Clean category name (remove commas if multiple)
  const categoryName = post.category_name ? post.category_name.split(',')[0] : "Blog";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group bg-white dark:bg-neutral-800 rounded-xl overflow-hidden shadow-md border border-neutral-200 dark:border-neutral-700 flex flex-col h-full transform hover:translate-y-[-5px] hover:shadow-lg transition-all duration-300"
    >
      <Link href={postLink} className="block">
        <div className="relative h-48 overflow-hidden bg-neutral-200 dark:bg-neutral-700">
          {post.featured_image_url ? (
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
              <SafeIcon icon={ImageIcon} className="w-8 h-8 opacity-50" />
            </div>
          )}
        </div>
      </Link>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          <span className="flex items-center">
            <SafeIcon icon={Calendar} className="mr-1.5 w-3.5 h-3.5" />
            {formattedDate}
          </span>
          <span className="mx-2">•</span>
          <span className="flex items-center">
            <SafeIcon icon={Clock} className="mr-1.5 w-3.5 h-3.5" />
            {post.read_time || 5} min read
          </span>
        </div>

        <div className="mb-2">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            {categoryName}
          </span>
        </div>

        <Link href={postLink}>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {post.title}
          </h3>
        </Link>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-3 flex-grow text-sm leading-relaxed">
          {post.excerpt}
        </p>
      </div>
    </motion.div>
  );
};

export default PostCard;