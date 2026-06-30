/**
 * Generates SEO-friendly links for Next.js
 */

// 1. Get the fixed base for calculators
export const getCalculatorBase = () => {
    return 'calculators';
};

// 2. Build link for a calculator
export const getCalculatorLink = (slug: string) => {
    return `/calculators/${slug}`;
};

// 3. Build link for a Blog Post
export const getPostLink = (post: any) => {
    if (!post) return '/blog';
    
    const slug = post.slug || post.id;
    return `/blog/${slug}`;
};