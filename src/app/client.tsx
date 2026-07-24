"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, useSpring, animate } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import { 
  ArrowRight, Check, PieChart, Lock, Cloud, 
  Star, Layout, DollarSign, TrendingUp 
} from "lucide-react";
import { FiCpu } from "react-icons/fi"; 

import { PageContent, CalculatorContent, PostContent } from "@/lib/content";
import { getCalculatorLink } from "@/utils/urlHelper";
import PostCard from "@/components/cards/PostCard"; 
import { normalizePageContent } from "@/lib/utils"; // <--- GLOBAL SECURITY IMPORT

// --- DEFAULTS ---
const DEFAULTS = {
    heroBadge: "Professional Grade",
    mainHeading: "Professional Calculators for Every Need",
    subheading: "Access 20+ premium calculators designed for accuracy, speed, and professional reliability.",
    heroBtnStart: "Start Calculating",
    heroBtnDashboard: "Go to Dashboard",
    heroFreeText: "It's free to use!",
    
    popCalcBadge: "Most Used Tools",
    popCalcHeading: "Popular Calculators",
    popCalcSubheading: "Choose from our most used professional calculators to get accurate results in seconds.",
    popCalcBtn: "View All Tools",
    
    featuresBadge: "Why Choose Calculox",
    featuresHeading: "Engineered for Real-World Use",
    featuresSubheading: "From daily estimates to critical decisions, we delivers dependable results you can trust.",
    
    testimonialsBadge: "Trusted by Pros",
    testimonialsHeading: "What Our Users Say",
    testimonialsSubheading: "Join thousands of professionals who rely on our tools for their daily financial and business decisions.",
    
    blogBadge: "Knowledge Hub",
    blogHeading: "Latest Insights",
    blogSubheading: "Refine your expertise in calculations while keeping pace with the latest industry standards and practices.",
    blogBtn: "View all articles"
};

// --- DEFAULT TESTIMONIALS ---
const DEFAULT_TESTIMONIALS = [
  {
    name: "Sarah Jenkins",
    role: "Financial Analyst",
    text: "The precision of these calculators is unmatched. I use the EMI estimator daily for client consultations. It's become an essential part of my toolkit.",
    rating: "5"
  },
  {
    name: "David Chen",
    role: "Small Business Owner",
    text: "Finally, a tool that makes complex business math simple. The visual breakdowns help me explain ROI to my investors clearly.",
    rating: "5"
  },
  {
    name: "Elena Rodriguez",
    role: "Mortgage Broker",
    text: "Fast, accurate, and looks professional. My clients love the interactive charts. It builds trust immediately.",
    rating: "5"
  },
  {
    name: "Michael Ross",
    role: "Tech Entrepreneur",
    text: "The UI is incredible. Most calculator sites are cluttered and ugly. CalcPro is a breath of fresh air. Professional grade indeed.",
    rating: "5"
  },
  {
    name: "James Wilson",
    role: "Real Estate Agent",
    text: "I can run numbers on the go on my phone and they look perfect. The responsive design is flawless.",
    rating: "5"
  }
];

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

// --- FEATURES DATA ---
const FEATURES = [
  {
    title: "Institutional Precision",
    description: "Verified formulas ensured for 100% accuracy in every result.",
    icon: Check,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100/50 dark:bg-emerald-500/10",
    gradientClass: "from-emerald-50/50 dark:from-emerald-900/10",
    beamColor: "#10b981",
    shadowColor: "group-hover:shadow-emerald-500/10"
  },
  {
    title: "Visual Intelligence",
    description: "Interactive charts and reports that turn complex data into visual stories.",
    icon: PieChart,
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-100/50 dark:bg-purple-500/10",
    gradientClass: "from-purple-50/50 dark:from-purple-900/10",
    beamColor: "#a855f7",
    shadowColor: "group-hover:shadow-purple-500/10"
  },
  {
    title: "Privacy-First Security",
    description: "We use bank-level encryption to keep your private data and history secure.",
    icon: Lock,
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-100/50 dark:bg-rose-500/10",
    gradientClass: "from-rose-50/50 dark:from-rose-900/10",
    beamColor: "#f43f5e",
    shadowColor: "group-hover:shadow-rose-500/10"
  },
  {
    title: "Cloud-Synced History",
    description: "Save your calculation history and access your data on any device, anytime.",
    icon: Cloud,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100/50 dark:bg-blue-500/10",
    gradientClass: "from-blue-50/50 dark:from-blue-900/10",
    beamColor: "#3b82f6",
    shadowColor: "group-hover:shadow-blue-500/10"
  }
];

// --- COLOR THEMES ---
const CALC_THEMES = [
  { 
    hoverBorder: "group-hover:border-indigo-500/30",
    orb: "bg-indigo-500",
    iconBg: "bg-indigo-50 dark:bg-indigo-500/10",
    iconColor: "text-indigo-600 dark:text-indigo-300",
    tagBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-100 dark:border-indigo-500/30",
    glow: "group-hover:shadow-indigo-500/15"
  },
  { 
    hoverBorder: "group-hover:border-emerald-500/30",
    orb: "bg-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    tagBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/30",
    glow: "group-hover:shadow-emerald-500/15"
  },
  { 
    hoverBorder: "group-hover:border-amber-500/30",
    orb: "bg-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-300",
    tagBg: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-100 dark:border-amber-500/30",
    glow: "group-hover:shadow-amber-500/15"
  },
  { 
    hoverBorder: "group-hover:border-rose-500/30",
    orb: "bg-rose-500",
    iconBg: "bg-rose-50 dark:bg-rose-500/10",
    iconColor: "text-rose-600 dark:text-rose-300",
    tagBg: "bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-100 dark:border-rose-500/30",
    glow: "group-hover:shadow-rose-500/15"
  }
];

// --- COMPONENTS ---

const TestimonialCard = ({ name, role, text, image, rating }: any) => {
  const getInitials = (n: string) => {
    if (!n) return "U";
    const parts = n.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="w-[80vw] sm:w-[380px] flex-shrink-0 p-6 sm:p-8 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group">
      <div className="flex gap-1 mb-4 text-amber-400">
        {[...Array(parseInt(rating) || 5)].map((_, i) => (
          <SafeIcon key={i} icon={Star} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
        ))}
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 font-medium min-h-[72px] sm:min-h-[80px]">
        &quot;{text}&quot;
      </p>
      <div className="flex items-center gap-3">
        {image ? (
          <img 
            src={image} 
            alt={name} 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-lg border-2 border-white dark:border-slate-800"
          />
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
            {getInitials(name)}
          </div>
        )}
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{role}</p>
        </div>
      </div>
    </div>
  );
};

const SimulatedCalculator = () => {
  const [step, setStep] = useState(0);
  const [displayResult, setDisplayResult] = useState(0);

  // Advanced 3D Parallax Tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["6deg", "-6deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-6deg", "6deg"]);
  
  // Depth effects for floating widgets
  const floatX1 = useTransform(mouseXSpring, [-0.5, 0.5], ["15px", "-15px"]);
  const floatY1 = useTransform(mouseYSpring, [-0.5, 0.5], ["-15px", "15px"]);
  const floatX2 = useTransform(mouseXSpring, [-0.5, 0.5], ["-15px", "15px"]);
  const floatY2 = useTransform(mouseYSpring, [-0.5, 0.5], ["15px", "-15px"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    const loop = setInterval(() => { setStep(prev => (prev + 1) % 3); }, 4000); 
    return () => clearInterval(loop);
  }, []);

  // Smooth Number Counter
  useEffect(() => {
     if (step === 2) {
        const controls = animate(0, 932.15, {
           duration: 1.2,
           ease: "easeOut",
           onUpdate: (val) => setDisplayResult(val)
        });
        return controls.stop;
     } else {
        setDisplayResult(0);
     }
  }, [step]);

  return (
    <motion.div 
        className="relative w-full max-w-[500px] mx-auto perspective-1000"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
        {/* PREMIUM UPGRADE: Institutional glow backdrop behind the calculator */}
        <motion.div 
            className="absolute inset-0 bg-gradient-to-tr from-indigo-500/30 via-purple-500/20 to-emerald-500/20 blur-[80px] rounded-full z-0 pointer-events-none" 
            animate={{ opacity: step === 1 ? 1 : 0.5 }}
            transition={{ duration: 1 }}
        />

        <motion.div 
            style={{ x: floatX1, y: floatY1, translateZ: 30 }}
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="hidden sm:flex absolute -top-6 -right-4 z-30 bg-white dark:bg-slate-800 p-3.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 items-center gap-3 ring-1 ring-slate-900/5"
        >
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <SafeIcon icon={Lock} className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Secure</p>
             </div>
        </motion.div>

        <motion.div 
            style={{ x: floatX2, y: floatY2, translateZ: 40 }}
            animate={{ y: [10, -10, 10] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="hidden sm:flex absolute -bottom-6 -left-4 z-30 bg-white dark:bg-slate-800 p-3.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 items-center gap-3 ring-1 ring-slate-900/5"
        >
             <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <SafeIcon icon={TrendingUp} className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efficiency</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white">+45%</p>
             </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ 
                y: [0, -15, 0],
                opacity: 1 
            }}
            transition={{ 
                opacity: { duration: 0.8 },
                y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
            }}
            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-white/60 dark:border-slate-700/50 relative z-20 ring-1 ring-slate-900/5 w-full"
            style={{ translateZ: 10 }}
        >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
                        <SafeIcon icon={DollarSign} className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="block text-sm font-bold text-slate-900 dark:text-white">EMI Estimator</span>
                        <span className="block text-[10px] text-slate-500 font-medium">Finance Tool</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1 mb-1 block">Loan Amount</label>
                    <div className="h-11 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-4 relative overflow-hidden transition-all focus-within:border-blue-500">
                        <span className="text-slate-400 text-sm mr-2 font-medium">$</span>
                        <span className="text-slate-900 dark:text-white font-mono font-bold text-base">
                            {step >= 1 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>50,000</motion.span>}
                        </span>
                        {step === 0 && <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className="h-5 w-0.5 bg-blue-600 absolute left-8" />}
                    </div>
                 </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1 mb-1 block">Rate %</label>
                        <div className="h-11 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-4 text-slate-900 dark:text-white font-mono font-bold text-base">
                           {step >= 1 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>4.5</motion.span>}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide ml-1 mb-1 block">Years</label>
                         <div className="h-11 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-4 text-slate-900 dark:text-white font-mono font-bold text-base">
                            {step >= 1 && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>5</motion.span>}
                        </div>
                    </div>
                </div>
            </div>

            <motion.div 
                className="mt-6 h-11 w-full bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center cursor-pointer overflow-hidden shadow-lg relative"
                animate={{ scale: step === 1 ? 0.98 : 1 }}
            >
                {step === 1 && (
                    <motion.div 
                        className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-400/20"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                )}
                <span className={`text-xs font-bold uppercase tracking-wide z-10 ${step === 2 ? 'text-emerald-400 dark:text-emerald-600' : 'text-white dark:text-slate-900'}`}>
                    {step === 0 ? "Calculate Now" : step === 1 ? "Processing..." : "View Results"}
                </span>
            </motion.div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                 <div className="flex justify-between items-end">
                     <div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Monthly Payment</span>
                        <div className="flex gap-1">
                            <div className="h-1.5 w-8 sm:w-10 bg-blue-500 rounded-full"></div>
                             <div className="h-1.5 w-2 sm:w-3 bg-emerald-500 rounded-full"></div>
                        </div>
                     </div>
                     <motion.span 
                        className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight"
                        animate={{ opacity: step === 2 ? 1 : 0.3, filter: step === 2 ? 'blur(0px)' : 'blur(4px)' }}
                     >
                         ${displayResult.toFixed(2)}
                     </motion.span>
                 </div>
             </div>
        </motion.div>
    </motion.div>
  );
};

interface ClientHomeProps {
  initialData: PageContent | null;
  featuredCalculators: CalculatorContent[];
  recentPosts: PostContent[];
  settings: any;
}

const ClientHome = ({ initialData, featuredCalculators, recentPosts, settings }: ClientHomeProps) => {
  const [heroNumber, setHeroNumber] = useState(0);

  // Parse content JSON securely via the global Normalizer
  const content = useMemo(() => {
    if (!initialData?.content) return {};
    try {
      const parsed = typeof initialData.content === 'string' 
        ? JSON.parse(initialData.content) 
        : initialData.content;
      return normalizePageContent(parsed); // <--- DEFENSE IN DEPTH APPLIED HERE
    } catch (e) {
      return {};
    }
  }, [initialData]);

  // Testimonials Logic
  const testimonialsList = (content.testimonials && content.testimonials.length > 0) 
      ? content.testimonials 
      : DEFAULT_TESTIMONIALS;
  
  const showTestimonials = content.showTestimonials !== false;
  const isMarquee = testimonialsList.length >= 4;

  useEffect(() => {
      const timer = setTimeout(() => setHeroNumber(20), 500);
      return () => clearTimeout(timer);
  }, []);

  const headingText = content.mainHeading || DEFAULTS.mainHeading;
  const headingParts = headingText.split(" ");
  const headingFirst = headingParts.slice(0, -2).join(" ");
  const headingLast = headingParts.slice(-2).join(" ");

  return (
    <>
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        .perspective-1000 { perspective: 1000px; }
      `}</style>

      <main className="font-inter antialiased text-slate-900 dark:text-slate-100 bg-white dark:bg-[#050505] overflow-x-hidden">
        
        {/* --- HERO SECTION --- */}
        <section className="relative overflow-visible pt-12 pb-16 lg:pt-24 lg:pb-24">
           <div className="absolute inset-0 bg-white dark:bg-[#050505] overflow-hidden">
               <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-gradient-to-r from-blue-100/40 via-purple-100/40 to-pink-100/40 dark:from-blue-900/10 dark:to-purple-900/10 rounded-full blur-[120px] opacity-70 animate-pulse"></div>
               <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-gradient-to-l from-emerald-100/40 to-teal-100/40 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-full blur-[120px] opacity-70 animate-pulse" style={{ animationDelay: '2s' }}></div>
           </div>
           
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                  <motion.div 
                    initial="hidden"
                    animate="visible"
                    variants={staggerContainer}
                    className="max-w-xl text-center lg:text-left flex-1 w-full"
                  >
                    {/* Badge Animation */}
                    <div className="relative inline-flex overflow-hidden rounded-full p-[3px] mb-6 focus:outline-none shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.02]">
                        <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#0000_0%,#0000_50%,#818cf8_75%,#a5b4fc_90%,#ffffff_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,#0000_0%,#0000_50%,#4338ca_75%,#6366f1_90%,#ffffff_100%)]" />
                        <span className="inline-flex h-full w-full cursor-default items-center justify-center rounded-full bg-white dark:bg-[#050505] px-5 py-2 text-sm font-medium text-slate-900 dark:text-white backdrop-blur-3xl gap-2.5 z-10">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                            </span>
                            <span className="text-[11px] font-bold tracking-widest uppercase text-slate-700 dark:text-slate-300">
                                {content.heroBadge || DEFAULTS.heroBadge}
                            </span>
                        </span>
                    </div>

                    <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] mb-5 text-slate-900 dark:text-white">
                        {headingFirst} <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 dark:from-indigo-400 dark:via-blue-400 dark:to-emerald-400">
                          {headingLast}
                         </span>
                    </motion.h1>

                    <motion.p variants={fadeInUp} className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
                        {(content.subheading || DEFAULTS.subheading).replace('20+', `${heroNumber}+`)}
                     </motion.p>

                    <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start">
                        <Link 
                           href="/calculators"
                           className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold text-white transition-all duration-200 bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-200 shadow-2xl shadow-slate-900/20 dark:shadow-none hover:-translate-y-0.5"
                        >
                           {content.heroBtnStart || DEFAULTS.heroBtnStart} <SafeIcon icon={ArrowRight} className="ml-2 w-4 h-4" />
                        </Link>

                        <span
                          className="inline-flex items-center justify-center py-3.5 text-sm font-bold text-slate-700 dark:text-white select-none"
                        >
                          <SafeIcon icon={Check} className="mr-2 w-4 h-4 text-emerald-500" /> {content.heroFreeText || DEFAULTS.heroFreeText}
                        </span>
                    </motion.div>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, x: 50 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ duration: 1, delay: 0.2, ease: "easeOut" as const }}
                   className="relative w-full max-w-xl flex-1 hidden lg:flex justify-center lg:justify-end"
                 >
                     <SimulatedCalculator />
                 </motion.div>
              </div>
           </div>
        </section>

        {/* --- POPULAR CALCULATORS --- */}
        <SectionDivider />
        <section className="py-20 bg-white dark:bg-[#050505] relative overflow-hidden">
            <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs mb-4">
                         {content.popCalcBadge || DEFAULTS.popCalcBadge}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                        {content.popularCalculatorsHeading || DEFAULTS.popCalcHeading}
                    </h2>
                    <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                        {content.popularCalculatorsSubheading || DEFAULTS.popCalcSubheading}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mb-12">
                    {featuredCalculators.map((calc, index) => {
                        const theme = CALC_THEMES[index % CALC_THEMES.length];
                        return (
                            <Link 
                                key={calc.id}
                                href={getCalculatorLink(calc.slug, settings)} // Using helper
                                className={`group relative flex flex-col h-full rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-white/10 hover:${theme.hoverBorder} transition-all duration-300 hover:-translate-y-1.5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] dark:shadow-none hover:shadow-2xl ${theme.glow} bg-slate-50/50 dark:bg-white/[0.03] backdrop-blur-xl overflow-hidden`}
                             >
                                <div className={`absolute -top-10 -right-10 w-32 h-32 ${theme.orb} rounded-full opacity-0 group-hover:opacity-10 blur-[50px] transition-all duration-500 group-hover:scale-150`}></div>
                                
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-6">
                                         <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition-transform duration-500 group-hover:scale-105 ${theme.iconBg} border border-white dark:border-white/5`}>
                                            <SafeIcon icon={calc.icon || FiCpu} className={`w-5 h-5 ${theme.iconColor}`} />
                                        </div>
                                        <div className="rounded-full p-2 text-slate-400/60 transition-all duration-300 group-hover:text-white group-hover:bg-indigo-600 border border-slate-200 dark:border-white/5 group-hover:border-indigo-500/50">
                                            <SafeIcon icon={ArrowRight} className="w-4 h-4" />
                                        </div>
                                     </div>
                                    
                                    <div className="mt-auto">
                                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                                            {calc.name}
                                         </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-5 font-medium">
                                             {calc.description}
                                        </p>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md transition-colors ${theme.tagBg}`}>
                                            {calc.category_names?.split(',')[0] || "Tool"}
                                        </span>
                                    </div>
                                 </div>
                            </Link>
                        );
                    })}
                </div>

                <div className="flex justify-center">
                    <Link 
                        href="/calculators" 
                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-full hover:bg-slate-700 dark:hover:bg-slate-200 transition-all transform hover:scale-105 shadow-xl shadow-slate-900/10"
                    >
                        {content.popCalcBtn || DEFAULTS.popCalcBtn}
                    </Link>
                </div>
            </div>
        </section>

        {/* --- FEATURES SECTION --- */}
        <SectionDivider />
        <section className="py-24 bg-white dark:bg-[#050505] relative overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="text-center max-w-3xl mx-auto mb-16">
                  <motion.span 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                     className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6"
                  >
                      {content.featuresBadge || DEFAULTS.featuresBadge}
                  </motion.span>
                  
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight"
                  >
                      {content.whyChooseUsHeading || DEFAULTS.featuresHeading}
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.1 }}
                    className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium"
                  >
                      {content.whyChooseUsSubheading || DEFAULTS.featuresSubheading}
                  </motion.p>
              </div>

              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                  {FEATURES.map((feature, index) => {
                      const dbFeature = content.features?.[index] || {};
                       return (
                      <motion.div 
                        key={index}
                        variants={fadeInUp}
                        className="group relative"
                      >
                         <div className={`relative h-full w-full rounded-2xl p-6 bg-white dark:bg-[#0a0a0a] border border-slate-200/60 dark:border-white/5 transition-all duration-500 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)] dark:shadow-none hover:shadow-2xl ${feature.shadowColor} hover:-translate-y-1.5 overflow-hidden`}>
                             <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradientClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                             
                              <div className="mb-6 relative z-10">
                                <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center relative shadow-sm border border-white dark:border-white/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                                    <SafeIcon icon={feature.icon} className={`w-5 h-5 ${feature.iconColor}`} />
                                    <div className={`absolute inset-0 rounded-xl ${feature.iconBg} animate-ping opacity-20 group-hover:block hidden`} />
                                </div>
                              </div>

                             <div className="relative z-10">
                                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2.5 tracking-tight transition-colors">
                                     {dbFeature.title || feature.title}
                                 </h3>
                                 <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed font-medium transition-colors">
                                     {dbFeature.description || feature.description}
                                 </p>
                             </div>
                             
                              <div 
                                className="absolute bottom-0 left-0 w-0 h-1 transition-all duration-500 group-hover:w-full"
                                style={{ backgroundColor: feature.beamColor }}
                              />
                         </div>
                      </motion.div>
                  )})}
                 </motion.div>
           </div>
        </section>

        {/* --- TESTIMONIALS --- */}
        {showTestimonials && (
            <>
            <SectionDivider />
            <section className="py-24 bg-white dark:bg-[#050505] relative overflow-hidden">
                 <div className="flex flex-col items-center gap-4 px-6 text-center mb-12">
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                        {content.testimonialsBadge || DEFAULTS.testimonialsBadge}
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                        {content.testimonialsHeading || DEFAULTS.testimonialsHeading}
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
                        {content.testimonialsSubheading || DEFAULTS.testimonialsSubheading}
                    </p>
                </div>

                <div className="relative w-full overflow-hidden">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-white dark:from-[#050505] to-transparent z-10" />
                     <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-white dark:from-[#050505] to-transparent z-10" />

                    {isMarquee ? (
                        <div className="flex animate-marquee gap-6 sm:gap-8 px-4">
                            <div className="flex gap-6 sm:gap-8 shrink-0">
                                {testimonialsList.map((testimonial: any, i: number) => (
                                     <TestimonialCard key={`a-${i}`} {...testimonial} />
                                ))}
                            </div>
                             <div className="flex gap-6 sm:gap-8 shrink-0" aria-hidden="true">
                                {testimonialsList.map((testimonial: any, i: number) => (
                                     <TestimonialCard key={`b-${i}`} {...testimonial} />
                                ))}
                            </div>
                        </div>
                     ) : (
                        <div className="flex flex-wrap justify-center gap-6 sm:gap-8 px-4 max-w-7xl mx-auto">
                            {testimonialsList.map((testimonial: any, i: number) => (
                                 <TestimonialCard key={`s-${i}`} {...testimonial} />
                            ))}
                        </div>
                    )}
                </div>
            </section>
            </>
        )}

        {/* --- BLOG SECTION --- */}
        <SectionDivider />
        {recentPosts.length > 0 && (
            <section className="py-24 bg-white dark:bg-[#050505] relative overflow-hidden">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                     <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs mb-4">
                             {content.blogBadge || DEFAULTS.blogBadge}
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                            {content.blogSectionHeading || DEFAULTS.blogHeading}
                        </h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                             {content.blogSectionSubheading || DEFAULTS.blogSubheading}
                        </p>
                        <Link href="/blog" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 transition-colors">
                            {content.blogBtn || DEFAULTS.blogBtn} <SafeIcon icon={ArrowRight} className="w-4 h-4 ml-2" />
                        </Link>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                         {recentPosts.map((post, index) => (
                             <PostCard 
                                key={post.id} 
                                post={post} 
                                index={index} 
                                settings={settings} 
                              />
                         ))}
                    </div>
                 </div>
            </section>
        )}
      </main>
    </>
  );
};

export default ClientHome;
