/**
 * Generates the correct route paths and link builders.
 * Enforces strict, SEO-friendly flat URLs matching the Next.js App Router.
 */

// 1. Get the fixed base for Calculators
export const getCalculatorBase = () => {
    return 'calculators'; 
};

// 2. Build a link for a specific calculator
// ADDED `settings?: any` to support Footer and Layout calls
export const getCalculatorLink = (slug: string, settings?: any) => {
    return `/calculators/${slug}`;
};

// 3. Build a link for a Blog Post
// ADDED `settings?: any` to support PostCard and layout calls
export const getPostLink = (post: any, settings?: any) => {
    // --- Immediate safety check ---
    if (!post || !post.slug) {
        return '/blog';
    }

    // Always use the strict SEO-friendly flat slug
    return `/blog/${post.slug}`;
};