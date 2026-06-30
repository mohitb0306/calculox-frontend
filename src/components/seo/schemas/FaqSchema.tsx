import React from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSchemaProps {
  faqs?: string | FaqItem[] | null;
}

export default function FaqSchema({ faqs }: FaqSchemaProps) {
  if (!faqs) return null;

  let parsedFaqs: FaqItem[] = [];

  // Handle both stringified JSON (from DB) and raw arrays
  if (typeof faqs === 'string') {
    try {
      parsedFaqs = JSON.parse(faqs);
    } catch (e) {
      console.error("Failed to parse FAQs for schema", e);
      return null;
    }
  } else if (Array.isArray(faqs)) {
    parsedFaqs = faqs;
  }

  // Bailout if the parsed array is empty
  if (!parsedFaqs || parsedFaqs.length === 0) return null;

  // --- THE FIX: Math-Safe HTML Stripper ---
  const stripHtml = (html: string) => {
    if (!html) return "";
    
    // 1. Replace closing block tags with a space so words don't mash together
    let text = html.replace(/<\/(p|div|h[1-6]|li|ul|ol|br)>/gi, ' ');
    
    // 2. Safely remove actual HTML tags without destroying math symbols (<, >)
    // This regex only matches tags that start with a letter (e.g., <p>, <span>)
    text = text.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, '');
    
    // 3. Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": parsedFaqs.map((faq) => ({
      "@type": "Question",
      "name": stripHtml(faq.question),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": stripHtml(faq.answer)
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}