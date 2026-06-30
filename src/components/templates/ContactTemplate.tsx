// (Update) Calculox_Frontend/src/components/templates/ContactTemplate.tsx

"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import { PageContent } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

import { 
  Mail, MessageSquare, HelpCircle, Zap, AlertCircle, 
  ArrowRight, ChevronRight 
} from "lucide-react";

// --- ANIMATIONS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const SectionDivider = () => (
  <div className="relative h-px w-full overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-indigo-500/20" />
  </div>
);

// Helper to replace [email] shortcode
const processShortcode = (text: string, email: string) => {
  const shortcodeRegex = /\[email( id)?\]/i;
  if (!text || !shortcodeRegex.test(text)) {
    return text;
  }
  const parts = text.split(shortcodeRegex);
  const prefix = parts[0];
  const suffix = parts.length > 2 ? parts[2] : parts[1];

  return (
    <>
      {prefix}
      <a
        href={`mailto:${email}`}
        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
      >
        {email}
      </a>
      {suffix}
    </>
  );
};

interface ContactTemplateProps {
  data: PageContent;
  settings?: any;
}

const ContactTemplate = ({ data, settings }: ContactTemplateProps) => {
  const [formCategory, setFormCategory] = useState("general");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse JSON content
  const content = useMemo(() => {
    if (!data?.content) return {};
    try {
      return typeof data.content === 'string' 
        ? JSON.parse(data.content) 
        : data.content;
    } catch (e) {
      return {};
    }
  }, [data]);

  const DEFAULTS = {
    pageHeading: "Get in Touch",
    contactIntro1: "For support, email us at [email]. We reply within 24 hours.",
    contactIntro2: "If you have a technical question, please include as many details as possible for a precise resolution.",
    formHeading: "Send Us a Message",
    formSubheading: "Our team of analysts typically responds within one business day.",
    emailAddress: "support@calculox.com",
    faqCtaHeading: "Looking for Quick Answers?",
    faqCtaSubheading: "Check our FAQ section for instant answers to common questions about using our calculators and features."
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      toast.success("Message sent successfully.");
      setFormData({ name: "", email: "", message: "" });
      setIsSubmitting(false);
    }, 1500);
  };

  const formCategories = [
    { id: "general", label: "General", icon: MessageSquare },
    { id: "help", label: "Tool Help", icon: HelpCircle },
    { id: "feature", label: "Request", icon: Zap },
    { id: "issue", label: "Report", icon: AlertCircle },
  ];

  const introText = content.contactIntro1 || DEFAULTS.contactIntro1;
  const emailAddress = content.emailAddress || DEFAULTS.emailAddress;

  // H1 Text (Content)
  const heading = content.pageHeading || DEFAULTS.pageHeading;

  // Breadcrumb Data (Structure)
  const pageData = {
      title: data.title || heading,
      slug: data.slug || 'contact'
  };

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />

      <div className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden">
        
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
              <motion.h1 variants={fadeInUp} className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
                {heading}
              </motion.h1>
              <motion.div variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 space-y-2 font-medium leading-relaxed">
                <p>{processShortcode(introText, emailAddress)}</p>
                <p className="max-w-2xl mx-auto">
                  {content.contactIntro2 || DEFAULTS.contactIntro2}
                </p>
              </motion.div>

               {/* --- BREADCRUMBS INJECTED --- */}
                <motion.div variants={fadeInUp} className="flex justify-center mt-6 w-full">
                    <Breadcrumbs data={pageData} settings={settings} className="flex justify-center" />
                </motion.div>

            </motion.div>
          </div>
        </section>

        <SectionDivider />

        {/* FORM SECTION */}
        <section className="py-20 bg-white dark:bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-[#0a0a0a] rounded-[2rem] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] dark:shadow-none border border-slate-200/60 dark:border-white/5 p-8 md:p-12 max-w-4xl mx-auto overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center gap-6 mb-10 border-b border-slate-100 dark:border-white/5 pb-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0">
                    <SafeIcon icon={Mail} className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {content.formHeading || DEFAULTS.formHeading}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      {content.formSubheading || DEFAULTS.formSubheading}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-4 block">
                      Subject Category
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {formCategories.map((cat) => (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setFormCategory(cat.id)}
                          className={`p-4 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 group ${
                            formCategory === cat.id
                              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 shadow-lg shadow-indigo-500/5"
                              : "border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                          }`}
                        >
                          <SafeIcon
                            icon={cat.icon}
                            className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                              formCategory === cat.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                            }`}
                          />
                          <span className={`text-[12px] font-bold tracking-tight ${
                             formCategory === cat.id ? "text-slate-900 dark:text-white" : "text-slate-500"
                          }`}>
                            {cat.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white text-sm font-medium"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white text-sm font-medium"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-900 dark:text-white text-sm font-medium resize-none"
                      placeholder="How can we assist you?"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-xl hover:shadow-2xl transition-all duration-300 font-bold flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Submit Inquiry</span>
                        <SafeIcon icon={ArrowRight} className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- FAQ CTA SECTION --- */}
        <SectionDivider />
        <section className="py-24 bg-white dark:bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-[2.5rem] p-8 md:p-16 text-center overflow-hidden bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10"
            >
              {/* Ambient glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)] pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="w-14 h-14 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-white/5">
                  <SafeIcon icon={HelpCircle} className="w-7 h-7 text-indigo-500" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                  {content.faqCtaHeading || DEFAULTS.faqCtaHeading}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">
                  {content.faqCtaSubheading || DEFAULTS.faqCtaSubheading}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/faq"
                    className="px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl hover:shadow-xl transition-all font-bold border border-slate-200 dark:border-white/5 flex items-center justify-center gap-2"
                  >
                    <SafeIcon icon={HelpCircle} className="w-4 h-4" />
                    <span>Browse FAQ</span>
                  </Link>
                  <Link
                    href="/calculators"
                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:shadow-xl transition-all font-bold flex items-center justify-center gap-2"
                  >
                    <span>Try Calculators</span>
                    <SafeIcon icon={ChevronRight} className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ContactTemplate;