"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import SafeIcon from "@/components/common/SafeIcon";
import { 
  TrendingUp, Users, Award, Star, ArrowRight, 
  Layout, CheckCircle 
} from "lucide-react";
import { PageContent } from "@/lib/content";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

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

interface AboutTemplateProps {
  data: PageContent;
  settings?: any;
}

const AboutTemplate = ({ data, settings }: AboutTemplateProps) => {

  // Parse Content
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

  // --- GHOST CONTENT DEFAULTS ---
  const GHOST = {
    mainHeading: "About Calculox",
    subHeading: "Empowering through precision. Making professional-grade calculations accessible to everyone.",
    
    missionBadge: "OUR MISSION",
    missionTitle: "Calculations Built on Trust",
    missionParagraph: "At Calculox, we believe that professional-grade calculation tools should be accessible to everyone. Our mission is to empower individuals and businesses with accurate, reliable, and easy-to-use calculators that help them make informed decisions.",
    
    stats: [
      { label: "PREMIUM TOOLS", value: "20+", desc: "Former financial analyst with 15+ years experience in fintech." },
      { label: "ACTIVE USERS", value: "500K+", desc: "Computer science PhD with expertise in algorithm optimization." },
      { label: "ACCURACY RATE", value: "99.9%", desc: "Award-winning UX designer focused on creating intuitive interfaces." },
      { label: "USER RATING", value: "4.9/5", desc: "Certified financial planner ensuring calculation accuracy." }
    ],
    
    valuesBadge: "OUR CORE PRINCIPLES",
    valuesTitle: "Built on Uncompromising Principles",
    valuesSubheading: "These principles guide everything we do, from engineering our formulas to designing our interfaces.",
    values: [
      { title: "Institutional Accuracy", description: "Every formula is rigorously tested and validated by industry experts to ensure bank-level precision in every result.", beamColor: "#10b981", gradient: "from-emerald-50/50 dark:from-emerald-900/10" },
      { title: "Visual Intelligence", description: "We transform complex datasets into intuitive visual stories, making high-level math approachable for everyone.", beamColor: "#a855f7", gradient: "from-purple-50/50 dark:from-purple-900/10" },
      { title: "Privacy by Design", description: "Your data is yours alone. We implement high-level encryption to ensure your calculation history remains private and secure.", beamColor: "#f43f5e", gradient: "from-rose-50/50 dark:from-rose-900/10" },
    ],

    ctaBadge: "START YOUR JOURNEY",
    ctaHeading: "Join the Professional Network of Accurate Intelligence",
    ctaSubheading: "Experience institutional-grade precision for your daily calculations. Trusted by over 500,000 professionals worldwide for critical decision making.",
    ctaBtnPrimary: "Explore Calculators",
    ctaBtnSecondary: "View Pricing"
  };

  const get = (key: string, fallback: string) => {
    return (content[key] && content[key].toString().trim() !== "") ? content[key] : fallback;
  };

  // --- MAPPING ---
  const STAT_ICONS = [TrendingUp, Users, Award, Star];
  
  const statsList = STAT_ICONS.map((icon, i) => {
    const cms = (content.stats && content.stats[i]) ? content.stats[i] : {};
    const ghost = GHOST.stats[i];
    return {
      icon,
      value: (cms.value && cms.value.trim() !== "") ? cms.value : ghost.value,
      label: (cms.label && cms.label.trim() !== "") ? cms.label : ghost.label,
      desc: (cms.desc && cms.desc.trim() !== "") ? cms.desc : ghost.desc
    };
  });

  const valuesList = GHOST.values.map((ghost, i) => {
    const cms = (content.values && content.values[i]) ? content.values[i] : {};
    return {
      ...ghost,
      title: (cms.title && cms.title.trim() !== "") ? cms.title : ghost.title,
      description: (cms.description && cms.description.trim() !== "") ? cms.description : ghost.description
    };
  });

  // H1 Text (Visual Heading)
  const heading = get('mainHeading', GHOST.mainHeading);

  // Breadcrumb Data (Structure)
  const pageData = {
    title: data.title || heading, 
    slug: data.slug || 'about'
  };

  // Image Source for Mission Section
  const missionImage = data.og_image || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80";

  return (
    <>
      <style jsx global>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(100px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(100px) rotate(-360deg); }
        }
        .animate-orbit {
          animation: orbit 20s linear infinite;
        }
      `}</style>

      <div className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden">
        
        {/* HERO */}
        <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-16 bg-white dark:bg-[#050505]">
           <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
             <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
                
                <motion.h1 variants={fadeInUp} className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
                   {heading}
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                  {get('subHeading', GHOST.subHeading)}
                </motion.p>
                
                {/* --- BREADCRUMBS INJECTED --- */}
                <motion.div variants={fadeInUp} className="flex justify-center mt-6 w-full">
                    <Breadcrumbs data={pageData} settings={settings} className="flex justify-center" />
                </motion.div>

              </motion.div>
           </div>
        </section>

        <SectionDivider />

        {/* MISSION */}
        <section className="py-24 bg-white dark:bg-[#050505]">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
                <motion.span variants={fadeInUp} className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
                   {get('missionHeading', GHOST.missionBadge)}
                </motion.span>
                <motion.h2 variants={fadeInUp} className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
                  {get('missionTitle', GHOST.missionTitle)}
                </motion.h2>
                <motion.p variants={fadeInUp} className="text-base text-slate-600 dark:text-slate-400 mb-6 leading-relaxed whitespace-pre-wrap">
                  {get('missionParagraph1', GHOST.missionParagraph)}
                </motion.p>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-blue-600/20 rounded-[2.5rem] transform rotate-3 transition-transform group-hover:rotate-1"></div>
                <img
                  src={missionImage}
                  alt="Mission"
                  className="relative rounded-[2rem] shadow-2xl border border-white/20 dark:border-white/5 w-full h-auto object-cover transition-all duration-500"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <SectionDivider />
        <section className="bg-slate-50/50 dark:bg-white/[0.02] py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
              {statsList.map((stat, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="text-center">
                  <div className="flex justify-center mb-4">
                    <SafeIcon icon={stat.icon} className="w-6 h-6 text-indigo-500/50" />
                  </div>
                  <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-3">
                    {stat.label}
                  </div>
                  <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-[200px] mx-auto px-2">
                    {stat.desc}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* VALUES */}
        <SectionDivider />
        <section className="py-24 bg-white dark:bg-[#050505]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-4">
                  {get('valuesHeading', GHOST.valuesBadge)}
              </span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                {get('valuesTitle', GHOST.valuesTitle)}
              </h2>
              <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
                {get('valuesSubheading', GHOST.valuesSubheading)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {valuesList.map((value, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="group relative">
                  <div className={`relative h-full w-full rounded-2xl p-6 bg-white dark:bg-[#0a0a0a] border border-slate-200/60 dark:border-white/5 transition-all duration-500 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)] dark:shadow-none hover:shadow-2xl hover:-translate-y-1.5 overflow-hidden`}>
                     <div className={`absolute inset-0 bg-gradient-to-br ${value.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                     
                     <div className="mb-6 relative z-10">
                        <div className={`w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center relative shadow-sm border border-white dark:border-white/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                            <SafeIcon icon={CheckCircle} className="w-5 h-5 text-indigo-500" />
                        </div>
                     </div>

                     <div className="relative z-10">
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2.5 tracking-tight">
                             {value.title}
                         </h3>
                         <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed font-medium">
                             {value.description}
                         </p>
                     </div>
                     <div className="absolute bottom-0 left-0 w-0 h-1 transition-all duration-500 group-hover:w-full" style={{ backgroundColor: value.beamColor }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <SectionDivider />
        <section className="py-24 relative overflow-hidden bg-white dark:bg-[#050505]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full animate-orbit" />
            <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full animate-orbit" style={{ animationDirection: 'reverse', animationDuration: '25s' }} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-[3rem] p-8 md:p-20 text-center overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-none"
            >
              <div className="relative z-10 max-w-3xl mx-auto">
                <motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-8"
                >
                  {get('ctaBadge', GHOST.ctaBadge)}
                </motion.span>
                
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-8 tracking-tight leading-tight">
                   {get('ctaHeading', GHOST.ctaHeading)}
                </h2>
                
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 font-medium leading-relaxed">
                   {get('ctaSubheading', GHOST.ctaSubheading)}
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-5">
                  <Link 
                    href="/calculators" 
                    className="group inline-flex items-center justify-center px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all font-bold shadow-2xl shadow-slate-900/20 dark:shadow-none hover:-translate-y-1"
                  >
                     {get('ctaBtnPrimary', GHOST.ctaBtnPrimary)} <SafeIcon icon={ArrowRight} className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <Link 
                    href="/pricing" 
                    className="inline-flex items-center justify-center px-10 py-5 bg-white/80 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-all font-bold backdrop-blur-md hover:-translate-y-1"
                  >
                    <SafeIcon icon={Layout} className="mr-2 w-5 h-5" /> {get('ctaBtnSecondary', GHOST.ctaBtnSecondary)}
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

export default AboutTemplate;