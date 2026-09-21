"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { calculateBMI, getBMIRanges, validateBMIInput, validateWaistInput, calculateWaistMetrics, getBMIInsight, getGenderContextNote, generateBMIGrid, BMIUnit, BMIRegion } from '@/utils/calculators/bmiLogic';
import type { ShareableReport } from '@/lib/reports/types';

const { FiTarget, FiTrendingUp, FiAlertCircle, FiInfo, FiHeart, FiArrowDown, FiBarChart2, FiImage, FiFileText, FiLoader, FiRotateCcw, FiCheckCircle, FiExternalLink, FiPercent, FiLayers, FiMaximize2, FiShield, FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown, FiDownload, FiSliders } = FiIcons;

interface BMICalculatorProps {
  onCalculationComplete?: () => void;
  /**
   * Fired whenever the current result changes — including becoming null when
   * there is no shareable result (no calculation yet, a validation error, or
   * the pregnancy safety disclaimer). A future header/toolbar component can
   * use this to receive the report and pass it into generateResultImage /
   * generateResultPdf without BMICalculator needing to know anything about
   * where those download/share icons live.
   */
  onReportChange?: (report: ShareableReport | null) => void;
  /** Triggers the PNG/PDF download for the current report — implemented by
   * the parent page (it owns generateResultImage/generateResultPdf), passed
   * down so BMICalculator can render its own download buttons in-flow with
   * the result. */
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  /** Which format is currently being generated, if any — drives the spinner
   * on whichever button was clicked and disables both while in progress. */
  downloadingFormat?: 'image' | 'pdf' | null;
  /** Triggers the page's native share sheet (falling back to copying the
   * link) — implemented by the parent page, same as onDownloadReport, since
   * it needs window.location and the calculator's title/description. */
  onShare?: () => void;
  /** Opens the user's mail client with the calculator link pre-filled. */
  onEmailShare?: () => void;
  /** Copies the calculator page's link to the clipboard. */
  onCopyLink?: () => void;
  /** Whether the link was just copied — briefly swaps the copy icon/label. */
  linkCopied?: boolean;
}

// --- DYNAMIC PREMIUM COLOR MAPPER ---
const getCategoryColors = (category: string) => {
  switch(category) {
    case 'Severe thinness': return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', grad: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800', border: 'border-indigo-500 dark:border-indigo-400', bgLight: 'bg-indigo-50 dark:bg-indigo-900/20', shadow: 'shadow-indigo-500/10', hex: '#4f46e5' };
    case 'Moderate thinness': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', grad: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800', border: 'border-blue-500 dark:border-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', shadow: 'shadow-blue-500/10', hex: '#2563eb' };
    case 'Mild thinness': return { text: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500', grad: 'from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-200 dark:border-sky-800', border: 'border-sky-500 dark:border-sky-400', bgLight: 'bg-sky-50 dark:bg-sky-900/20', shadow: 'shadow-sky-500/10', hex: '#0ea5e9' };
    case 'Underweight': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', grad: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800', border: 'border-blue-500 dark:border-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', shadow: 'shadow-blue-500/10', hex: '#3b82f6' };
    case 'Normal range': return { text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500', grad: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800', border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', shadow: 'shadow-green-500/10', hex: '#10b981' };
    case 'Overweight': 
    case 'Pre-obese': return { text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-500', grad: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800', border: 'border-yellow-500 dark:border-yellow-400', bgLight: 'bg-yellow-50 dark:bg-yellow-900/20', shadow: 'shadow-yellow-500/10', hex: '#eab308' };
    case 'Obese Class I': 
    case 'Obesity Class I': return { text: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-500', grad: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800', border: 'border-orange-500 dark:border-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20', shadow: 'shadow-orange-500/10', hex: '#f97316' };
    case 'Obese Class II': 
    case 'Obesity Class II': return { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-500', grad: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800', border: 'border-red-500 dark:border-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', shadow: 'shadow-red-500/10', hex: '#ef4444' };
    case 'Obese Class III': return { text: 'text-rose-700 dark:text-rose-500', bg: 'bg-rose-600', grad: 'from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-800', border: 'border-rose-500 dark:border-rose-400', bgLight: 'bg-rose-50 dark:bg-rose-900/20', shadow: 'shadow-rose-500/10', hex: '#be123c' };
    default: return { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-500', grad: 'from-neutral-50 to-neutral-100 dark:from-neutral-900/20 dark:to-neutral-800/20 border-neutral-200 dark:border-neutral-800', border: 'border-neutral-500 dark:border-neutral-400', bgLight: 'bg-neutral-50 dark:bg-neutral-900/20', shadow: 'shadow-neutral-500/10', hex: '#737373' };
  }
};

// --- RISK BADGE COLOR MAPPER ---
const getRiskBadgeClasses = (level: string) => {
  if (/high|substantially/i.test(level)) {
    return 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 border border-red-500/20';
  }
  if (/increased/i.test(level)) {
    return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20';
  }
  return 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 border border-green-500/20';
};

// --- SOURCES & REFERENCES ---
interface SourceEntry {
  metric: string;
  citation: string;
  url?: string;
  linkLabel?: string;
}

const BMI_SOURCES: SourceEntry[] = [
  {
    metric: 'BMI Formula',
    citation: "Adolphe Quetelet's Index (1832): weight (kg) \u00f7 height (m)\u00b2. The imperial constant (703) is CDC's standard rounded conversion factor.",
    url: 'https://www.cdc.gov/bmi/about/index.html',
    linkLabel: 'CDC \u2014 About Body Mass Index (BMI)',
  },
  {
    metric: 'Global (WHO) BMI Classification',
    citation: "WHO's 8-tier classification — Severe Thinness through Obese Class III — combines its 1995 Expert Committee report (Technical Report Series 854) with the 2000 report Obesity: Preventing and Managing the Global Epidemic (Technical Report Series 894), which added Pre-obese and split obesity into Classes I\u2013III.",
    url: 'https://apps.who.int/nutrition/landscape/help.aspx?menu=0&helpid=420',
    linkLabel: 'World Health Organization \u2014 BMI (NLiS)',
  },
  {
    metric: 'Asia-Pacific BMI Classification',
    citation: 'Lower cut-offs (Overweight from 23.0, Obese from 25.0) come from the WHO Regional Office for the Western Pacific, IASO and IOTF\u2019s 2000 consensus statement for Asian populations.',
    url: 'https://www.worldobesity.org/about/about-obesity/obesity-classification',
    linkLabel: 'WHO / IASO / IOTF (2000), reproduced by World Obesity Federation',
  },
  {
    metric: 'Healthy Weight Range',
    citation: "Computed as (Normal-BMI lower or upper bound) \u00d7 height (m)\u00b2 \u2014 the same method NIH/NHLBI-style calculators use to turn a BMI band into a weight range. It's a derived figure rather than its own published guideline, and uses the upper bound of whichever standard (WHO or Asia-Pacific) is currently selected.",
  },
  {
    metric: 'BMI Prime',
    citation: "BMI \u00f7 25, where 25 is WHO/CDC's fixed upper limit of the normal-BMI band. A widely used, dimensionless simplification of BMI \u2014 not itself a separately published WHO/CDC metric.",
  },
  {
    metric: 'Ponderal Index',
    citation: "Also called Rohrer's Index (Fritz Rohrer, 1921): weight (kg) \u00f7 height (m)\u00b3. An alternative to BMI that's less biased at height extremes.",
    url: 'https://www.measurement-toolkit.org/anthropometry/anthropometric-indices/ponderal',
    linkLabel: 'Measurement Toolkit \u2014 Ponderal Index',
  },
  {
    metric: 'Waist-to-Height Ratio Bands',
    citation: '0.40\u20130.49 (healthy), 0.50\u20130.59 (increased risk), and \u22650.60 (high risk) are NICE\u2019s official central-adiposity bands, current in guideline NG246 (2025). The additional <0.40 "Slim" band isn\u2019t part of NICE\u2019s guidance \u2014 it reflects Margaret Ashwell\u2019s original 1996 waist-to-height concept that NICE\u2019s own guidance builds on.',
    url: 'https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity',
    linkLabel: 'NICE Guideline NG246 \u2014 Waist-to-height ratio thresholds',
  },
  {
    metric: 'WHO Waist-Circumference Risk',
    citation: "World Health Organization's official sex-specific waist-circumference cut-offs: 94cm (men) / 80cm (women) for increased risk, 102cm (men) / 88cm (women) for substantially increased metabolic risk.",
    url: 'https://iris.who.int/handle/10665/44583',
    linkLabel: 'WHO Expert Consultation (2008) \u2014 Waist Circumference and Waist-Hip Ratio',
  },
];

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// Every field label in the input card uses these two classes so the form
// stays visually uniform (same weight, colour and spacing above each control).
// Section headings (h4) are intentionally bolder/greyer so the two levels
// read as distinct.
const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";

// --- ACCESSIBLE INFO TOOLTIP ---
const InfoTip: React.FC<{ text: string; widthClass?: string; align?: 'center' | 'start' | 'end' }> = ({
  text, widthClass = 'w-56', align = 'center',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const VIEWPORT_MARGIN = 8;
  const GAP_ABOVE_ICON = 8;

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    const tip = tooltipRef.current;
    if (!btn || !tip) return;

    const btnRect = btn.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left =
      align === 'start' ? btnRect.left
      : align === 'end' ? btnRect.right - tipRect.width
      : btnRect.left + btnRect.width / 2 - tipRect.width / 2;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      window.innerWidth - tipRect.width - VIEWPORT_MARGIN
    );

    let top = btnRect.top - GAP_ABOVE_ICON - tipRect.height;
    top = Math.max(top, VIEWPORT_MARGIN);

    setCoords({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        tooltipRef.current && !tooltipRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, updatePosition]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-expanded={open}
        aria-label="More information"
        className="cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <SafeIcon icon={FiInfo} className="w-4 h-4" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            visibility: coords ? 'visible' : 'hidden',
          }}
          className={`${widthClass} rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-xs font-medium leading-relaxed text-neutral-700 dark:text-neutral-200 shadow-lg pointer-events-none z-[100] text-center`}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};

// --- SEGMENTED TOGGLE ---
interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
}
function SegmentedToggle<T extends string>({
  value, onChange, options, groupId, ariaLabel, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedToggleOption<T>[];
  groupId: string;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  const prefersReducedMotion = useReducedMotion();
  const isSm = size === 'sm';
  return (
    <div
      className={`relative inline-flex bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-700/50 rounded-full ${
        isSm ? 'p-1' : 'flex w-full p-1.5'
      }`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-full transition-colors duration-150 cursor-pointer ${
              isSm ? 'px-3.5 py-1.5 text-xs' : 'flex-1 px-4 py-2.5 text-sm'
            } ${
              active ? 'text-white font-bold' : 'text-neutral-500 dark:text-neutral-400 font-semibold hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segment-pill-${groupId}`}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_2px_10px_-1px_rgba(99,102,241,0.55)]"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- NUMBER FIELD ---
const NumberField: React.FC<{
  id?: string;
  value: number | string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suffix: string;
  error?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  ariaLabel?: string;
}> = ({ id, value, onChange, onBlur, suffix, error, min, max, placeholder, ariaLabel }) => (
  <div
    className={`flex items-stretch w-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-150 bg-neutral-50 dark:bg-neutral-900/40 focus-within:ring-2 focus-within:ring-offset-0 ${
      error
        ? 'border-red-300 dark:border-red-500/60 focus-within:ring-red-400/50 focus-within:border-red-400'
        : 'border-neutral-200 dark:border-neutral-700 focus-within:ring-indigo-400/50 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/60'
    }`}
  >
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-label={ariaLabel}
      min={min}
      max={max}
      placeholder={placeholder}
      className={`flex-1 min-w-0 w-full pl-4 pr-2 py-3 bg-transparent text-neutral-900 dark:text-white font-semibold placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal focus:outline-none ${noSpinnerClass}`}
    />
    <span className="flex items-center flex-shrink-0 mr-1.5 my-1.5 px-2.5 rounded-lg text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-700/70 whitespace-nowrap">
      {suffix}
    </span>
  </div>
);

// --- SLOW, EASED "ANCHOR SCROLL" ---
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const slowScrollToElement = (element: HTMLElement, duration = 1800, topOffset = 24) => {
  const startY = window.scrollY;
  const targetY = element.getBoundingClientRect().top + window.scrollY - topOffset;
  const distance = targetY - startY;

  if (Math.abs(distance) < 1) return;

  const startTime = performance.now();

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(progress));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

const BMICalculator: React.FC<BMICalculatorProps> = ({ onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null, onShare, onEmailShare, onCopyLink, linkCopied = false }) => {
  const prefersReducedMotion = useReducedMotion();
  
  // State
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isAthletic, setIsAthletic] = useState<boolean>(false);
  const [isPregnant, setIsPregnant] = useState<boolean>(false);
  
  const [weight, setWeight] = useState<number | string>('');
  const [height, setHeight] = useState<number | string>('');
  const [waist, setWaist] = useState<number | string>('');
  
  // Split state for Imperial inputs
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');

  // --- CANONICAL (PRECISE, METRIC) SOURCE OF TRUTH ---
  // Display fields (height/weight/waist below) are rounded for a clean UI,
  // but rounding must never feed back into further conversions — otherwise
  // toggling units repeatedly drifts the value a little each time. So the
  // *true* measurement is kept here, in metric, at full precision, updated
  // only from what the user actually types. Unit toggles read from these
  // refs (never from the current, possibly-rounded, display state) to
  // recompute the display strings, so the underlying value never degrades.
  const heightCmRef = useRef<number | null>(null);
  const weightKgRef = useRef<number | null>(null);
  const waistCmRef = useRef<number | null>(null);

  // Single master unit toggle drives height, weight and waist together —
  // one Imperial/Metric switch for the whole form, matching the pattern
  // used by the Body Fat calculator.
  const [unit, setUnit] = useState<BMIUnit>('imperial');
  const heightUnit = unit;
  const weightUnit = unit;
  const waistUnit = unit;
  const [region, setRegion] = useState<BMIRegion>('who');
  
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [bmi, setBmi] = useState(0);
  const [category, setCategory] = useState('');
  const [idealWeight, setIdealWeight] = useState({ min: 0, max: 0 });
  const [bmiPrime, setBmiPrime] = useState(0);
  const [ponderalIndex, setPonderalIndex] = useState(0);
  const [whtr, setWhtr] = useState(0);
  const [whtrCategory, setWhtrCategory] = useState('');
  const [waistRiskLevel, setWaistRiskLevel] = useState('');
  
  const [weightError, setWeightError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [waistError, setWaistError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  const activeClassificationRowRef = useRef<HTMLDivElement | null>(null);
  const [classificationPulse, setClassificationPulse] = useState<boolean>(false);

  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [downloadMenuOpen]);

  useEffect(() => {
    if (downloadingFormat) setDownloadMenuOpen(false);
  }, [downloadingFormat]);

  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight) return true;
    if (heightUnit === 'metric' && !height) return true;
    if (heightUnit === 'imperial' && (!heightFt || !heightIn)) return true;
    return false;
  }, [age, weight, height, heightFt, heightIn, heightUnit]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !waist && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, waist, hasCalculated]);

  // Keep the canonical (metric, unrounded) refs in sync with whatever the
  // user actually types, converting once from the *current* display unit —
  // never from an already-rounded intermediate value.
  const syncHeightCanonicalMetric = (v: string) => {
    const n = parseFloat(v);
    heightCmRef.current = Number.isNaN(n) ? null : n;
  };
  const syncHeightCanonicalImperial = (ftStr: string, inStr: string) => {
    const ft = parseFloat(ftStr);
    const inc = parseFloat(inStr);
    if (Number.isNaN(ft) && Number.isNaN(inc)) { heightCmRef.current = null; return; }
    const totalInches = (Number.isNaN(ft) ? 0 : ft) * 12 + (Number.isNaN(inc) ? 0 : inc);
    heightCmRef.current = totalInches * 2.54;
  };
  const syncWeightCanonical = (v: string) => {
    const n = parseFloat(v);
    weightKgRef.current = Number.isNaN(n) ? null : (weightUnit === 'metric' ? n : n / 2.20462);
  };
  const syncWaistCanonical = (v: string) => {
    const n = parseFloat(v);
    waistCmRef.current = Number.isNaN(n) ? null : (waistUnit === 'metric' ? n : n * 2.54);
  };

  const resetCalculation = () => {
    setHasCalculated(false);
    setBmi(0);
    setCategory('');
    setIdealWeight({ min: 0, max: 0 });
    setBmiPrime(0);
    setPonderalIndex(0);
    setWhtr(0);
    setWhtrCategory('');
    setWaistRiskLevel('');
    
    setWeightError(null);
    setHeightError(null);
    setWaistError(null);
    setAgeError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setAge('');
    setGender('male');
    setIsAthletic(false);
    setIsPregnant(false);
    setWeight('');
    setHeight('');
    setWaist('');
    setHeightFt('');
    setHeightIn('');
    setUnit('imperial');
    setRegion('who');
    heightCmRef.current = null;
    weightKgRef.current = null;
    waistCmRef.current = null;
    
    setWeightError(null);
    setHeightError(null);
    setWaistError(null);
    setAgeError(null);
    
    resetCalculation();
  };

  const handleAgeBlur = () => {
    const raw = age.toString().trim();
    if (raw === '') { setAgeError(null); return; }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && !Number.isNaN(n) && (n < 20 || n > 120)) {
      setAgeError('Standard adult BMI calculations require an age between 20 and 120.');
    } else {
      setAgeError(null);
    }
  };

  const handleWaistBlur = () => {
    const raw = waist.toString().trim();
    if (raw === '') { setWaistError(null); return; }
    const wc = parseFloat(raw);
    if (Number.isNaN(wc) || wc <= 0) { setWaistError(null); return; }
    const validation = validateWaistInput(wc, waistUnit);
    setWaistError(validation.isValid ? null : (validation.error ?? 'Invalid waist circumference.'));
  };

  // Single master toggle — converts height, weight AND waist together in
  // one go, then flips the shared `unit` state once.
  //
  // Crucially, every value shown here is derived from the precise canonical
  // refs (metric, never rounded) rather than from the current display
  // state. If we instead re-converted from the previous rounded display
  // value each time, repeated toggling (imperial -> metric -> imperial...)
  // would compound rounding error and the calculated result would visibly
  // drift on every flip. Reading from the untouched canonical value means
  // toggling back and forth is always lossless — only the display rounds.
  const handleUnitToggle = (newUnit: BMIUnit) => {
    if (newUnit === unit) return;
    resetCalculation();

    // Height
    if (heightCmRef.current !== null) {
      if (newUnit === 'imperial') {
        const totalInches = heightCmRef.current / 2.54;
        let ft = Math.floor(totalInches / 12);
        let inch = Math.round(totalInches % 12);
        if (inch === 12) { inch = 0; ft += 1; }
        setHeightFt(ft); setHeightIn(inch);
      } else {
        setHeight(Math.round(heightCmRef.current));
      }
    }

    // Weight
    if (weightKgRef.current !== null) {
      setWeight(newUnit === 'imperial' ? Math.round(weightKgRef.current * 2.20462) : Math.round(weightKgRef.current));
    }

    // Waist (optional)
    if (waistCmRef.current !== null) {
      setWaist(newUnit === 'imperial' ? Math.round(waistCmRef.current / 2.54) : Math.round(waistCmRef.current));
    }

    setUnit(newUnit);
  };

  const activeHeight = useMemo(() => {
    if (heightUnit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    return (ft * 12) + inc;
  }, [heightUnit, height, heightFt, heightIn]);

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const w = parseFloat(weight.toString());
    const h = activeHeight; // in heightUnit's own units (total inches, or cm)
    const a = parseInt(age.toString(), 10);

    let isValid = true;

    if (Number.isNaN(a) || a < 20 || a > 120) {
      setAgeError('Standard adult BMI calculations require an age between 20 and 120.');
      isValid = false;
    } else {
      setAgeError(null);
    }

    // Height, weight, and waist can each be showing a different unit, but
    // calculateBMI/validateBMIInput/validateWaistInput/calculateWaistMetrics
    // take a single shared unit param — so we normalize each field to metric
    // independently, based on its own unit, and always call them with 'metric'.
    const wKg = weightUnit === 'metric' ? w : w / 2.20462;
    const hCm = heightUnit === 'metric' ? h : h * 2.54;

    const validation = validateBMIInput(wKg, hCm, 'metric');

    if (!validation.isValid) {
      // Limits expressed in each field's own displayed unit, so the error
      // messages below report in whatever unit that field is currently showing.
      const weightLimits = weightUnit === 'metric' ? { min: 1, max: 500, label: 'kg' } : { min: 2, max: 1100, label: 'lbs' };
      const heightLimits = heightUnit === 'metric' ? { min: 30, max: 300, label: 'cm' } : { min: 12, max: 118, label: 'in' };
      const weightInvalid = !Number.isFinite(w) || Number.isNaN(w) || w <= 0 || w < weightLimits.min || w > weightLimits.max;
      const heightInvalid = !Number.isFinite(h) || Number.isNaN(h) || h <= 0 || h < heightLimits.min || h > heightLimits.max;

      setWeightError(weightInvalid ? `Weight must be between ${weightLimits.min}-${weightLimits.max} ${weightLimits.label}.` : null);
      setHeightError(heightInvalid && !weightInvalid ? `Height must be between ${heightLimits.min}-${heightLimits.max} ${heightLimits.label}.` : null);
      isValid = false;
    } else {
      setWeightError(null);
      setHeightError(null);
    }

    if (!isValid) {
      setHasCalculated(false);
      return;
    }

    const wc = parseFloat(waist.toString());
    const hasWaistInput = !Number.isNaN(wc) && wc > 0;
    const wcCm = waistUnit === 'metric' ? wc : wc * 2.54;

    if (hasWaistInput) {
      const waistValidation = validateWaistInput(wcCm, 'metric');
      if (!waistValidation.isValid) {
        const waistLimits = waistUnit === 'metric' ? { min: 30, max: 300, label: 'cm' } : { min: 12, max: 118, label: 'in' };
        setWaistError(`Waist circumference must be between ${waistLimits.min}-${waistLimits.max} ${waistLimits.label}.`);
        setHasCalculated(false);
        return;
      }
    }
    setWaistError(null);

    const result = calculateBMI(wKg, hCm, 'metric', region);

    setBmi(result.bmi);
    setCategory(result.category);
    // idealWeight comes back in kg (we always call calculateBMI with 'metric');
    // convert to whichever unit Weight is currently showing.
    setIdealWeight({
      min: weightUnit === 'metric' ? result.idealWeightMin : result.idealWeightMin * 2.20462,
      max: weightUnit === 'metric' ? result.idealWeightMax : result.idealWeightMax * 2.20462,
    });
    setBmiPrime(result.bmiPrime);
    setPonderalIndex(result.ponderalIndex);

    if (hasWaistInput) {
      const waistMetrics = calculateWaistMetrics(wcCm, hCm, 'metric', gender);
      setWhtr(waistMetrics.whtr);
      setWhtrCategory(waistMetrics.whtrCategory);
      setWaistRiskLevel(waistMetrics.waistRiskLevel);
    } else {
      setWhtr(0);
      setWhtrCategory('');
      setWaistRiskLevel('');
    }

    setHasCalculated(true);

    if (onCalculationComplete) {
      onCalculationComplete();
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = actionButtonsRef.current;
        if (!el) return;
        if (prefersReducedMotion) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          slowScrollToElement(el, 1800);
        }
      });
    });
  };

  const bmiRanges = getBMIRanges(region);
  const currentColors = getCategoryColors(category);
  const hasError = Boolean(weightError || heightError || ageError || waistError);

  const activeRangeIndex = useMemo(() => {
    if (!hasCalculated) return -1;
    return bmiRanges.findIndex((r) => r.category === category);
  }, [bmiRanges, category, hasCalculated]);

  const minScale = 10;
  const maxScale = 50;
  const scaleRange = maxScale - minScale;

  const bmiToAngle = useMemo(() => (val: number) => {
    const clamped = Math.min(Math.max(val, minScale), maxScale);
    return ((clamped - minScale) / scaleRange) * 180;
  }, []);

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
      const angleInRadians = ((angle - 180) * Math.PI) / 180.0;
      return { x: cx + r * Math.cos(angleInRadians), y: cy + r * Math.sin(angleInRadians) };
    };
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const needleAngle = useMemo(() => (!hasCalculated || hasError) ? -90 : bmiToAngle(bmi) - 90, [hasCalculated, hasError, bmiToAngle, bmi]);

  const springConfig = prefersReducedMotion 
    ? { duration: 0 } 
    : { type: "spring" as const, stiffness: 50, damping: 12, mass: 0.8 };

  // Weight and height can each be showing a different unit, so normalize both
  // to metric independently before calling generateBMIGrid (which, like the
  // other bmiLogic functions, takes one shared unit param); the grid's own
  // weight/height axis values are converted back for display at render time.
  const gridData = useMemo(() => {
    if (!hasCalculated || hasError || bmi === 0) return null;
    const w = parseFloat(weight.toString());
    const wKg = weightUnit === 'metric' ? w : w / 2.20462;
    const hCm = heightUnit === 'metric' ? activeHeight : activeHeight * 2.54;
    return generateBMIGrid(wKg, hCm, 'metric', region);
  }, [hasCalculated, hasError, bmi, weight, weightUnit, activeHeight, heightUnit, region]);

  // gridData's axis values always come back in metric (kg / cm); these format
  // them back into whichever unit Weight/Height are each currently showing.
  const formatGridWeight = (wKg: number) =>
    weightUnit === 'metric' ? `${Math.round(wKg)} kg` : `${Math.round(wKg * 2.20462)} lbs`;
  const formatGridHeight = (hCm: number) => {
    if (heightUnit === 'metric') return `${Math.round(hCm)} cm`;
    const totalIn = Math.round(hCm / 2.54);
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn % 12;
    return `${ft}'${inch}"`;
  };

  // "Metric Units" / "Imperial Units" when Height, Weight, and (if present)
  // Waist all agree, otherwise "Mixed Units" — mirrors BMRCalculator.
  const unitsSummary = useMemo(() => {
    const wc = parseFloat(waist.toString());
    const activeUnits: BMIUnit[] = [heightUnit, weightUnit];
    if (!Number.isNaN(wc) && wc > 0) activeUnits.push(waistUnit);
    if (activeUnits.every((u) => u === 'metric')) return 'Metric Units';
    if (activeUnits.every((u) => u === 'imperial')) return 'Imperial Units';
    return 'Mixed Units';
  }, [heightUnit, weightUnit, waistUnit, waist]);

  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || isPregnant) return null;

    const colors = getCategoryColors(category);

    const mainRows: Array<{ label: string; value: string }> = [
      {
        label: 'Ideal Weight Range',
        value: idealWeight.max === 0 ? '--' : `${idealWeight.min.toFixed(1)} \u2013 ${idealWeight.max.toFixed(1)} ${weightUnit === 'metric' ? 'kg' : 'lbs'}`,
      },
      { label: 'BMI Prime', value: bmiPrime === 0 ? '--' : bmiPrime.toFixed(2) },
      { label: 'Ponderal Index', value: ponderalIndex === 0 ? '--' : `${ponderalIndex.toFixed(1)} kg/m\u00b3` },
    ];

    const sections: ShareableReport['sections'] = [{ heading: 'Key Results', rows: mainRows, variant: 'output' }];

    if (whtrCategory || waistRiskLevel) {
      const waistRows: Array<{ label: string; value: string }> = [];
      if (whtrCategory) {
        waistRows.push({ label: 'Waist-to-Height Ratio', value: `${whtr.toFixed(2)} (${whtrCategory})` });
      }
      if (waistRiskLevel) {
        waistRows.push({ label: 'Waist Risk (WHO)', value: waistRiskLevel });
      }
      sections.push({ heading: 'Waist Metrics', rows: waistRows, variant: 'output' });
    }

    const classificationRows = getBMIRanges(region).map((range) => ({
      label: range.category,
      value: range.category === category ? `${range.label} \u2014 Your Result` : range.label,
    }));
    sections.push({
      heading: `Detailed Classification (${region === 'asia-pacific' ? 'Asia-Pacific' : 'WHO'})`,
      rows: classificationRows,
      variant: 'output',
    });

    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Age', value: `${age} years` },
      { label: 'Biological Sex', value: gender === 'male' ? 'Male' : 'Female' },
      { label: 'Athletic Build', value: isAthletic ? 'Yes' : 'No' },
      {
        label: 'Height',
        value: heightUnit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"`,
      },
      { label: 'Weight', value: `${weight} ${weightUnit === 'metric' ? 'kg' : 'lbs'}` },
    ];
    const wc = parseFloat(waist.toString());
    if (!Number.isNaN(wc) && wc > 0) {
      inputRows.push({ label: 'Waist Circumference', value: `${waist} ${waistUnit === 'metric' ? 'cm' : 'in'}` });
    }
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    const imageSections: ShareableReport['sections'] = sections.filter(
      (s) => !s.heading?.startsWith('Detailed Classification')
    );

    return {
      title: 'BMI Result',
      headlineValue: bmi.toFixed(1),
      headlineLabel: category,
      accentColor: colors.hex,
      meta: [region === 'who' ? 'WHO Standard' : 'Asia-Pacific Standard', unitsSummary],
      sections,
      pdfOnlySections,
      imageSections,
      disclaimer: 'For informational purposes only \u2014 not medical advice.',
      fileNameBase: `bmi-result-${bmi.toFixed(1)}`,
    };
  }, [hasCalculated, hasError, isPregnant, bmi, category, idealWeight, bmiPrime, ponderalIndex, whtr, whtrCategory, waistRiskLevel, region, unitsSummary, age, gender, isAthletic, height, heightFt, heightIn, heightUnit, weight, weightUnit, waist, waistUnit]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!report || downloadingFormat !== null}
        aria-haspopup="menu"
        aria-expanded={downloadMenuOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-neutral-600 disabled:hover:border-neutral-200 disabled:hover:shadow-sm disabled:active:scale-100"
        title={report ? "Download your result" : "Calculate a result first"}
      >
        <SafeIcon
          icon={downloadingFormat ? FiLoader : FiDownload}
          className={`w-3.5 h-3.5 flex-shrink-0 ${downloadingFormat ? 'animate-spin' : ''}`}
        />
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">
          {downloadingFormat ? 'Preparing…' : 'Download'}
        </span>
        <SafeIcon
          icon={FiChevronDown}
          className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${downloadMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {downloadMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 sm:right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('image'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiImage} className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PNG Image</span>
              <span className="block text-xs text-neutral-400 mt-0.5">Quick shareable card</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('pdf'); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer border-t border-neutral-100 dark:border-neutral-700/50"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PDF Report</span>
              <span className="block text-xs text-neutral-400 mt-0.5">Complete paginated report</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );

  const renderShareBar = () => (
    <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-5 mt-5 border-t border-neutral-100 dark:border-neutral-800 text-center sm:text-right">
      <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">
        Like this? Please share
      </span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onShare?.()}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:ring-blue-200 dark:hover:ring-blue-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer"
          title="Share this calculator"
        >
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onEmailShare?.()}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:ring-amber-200 dark:hover:ring-amber-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer"
          title="Share via email"
        >
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onCopyLink?.()}
          className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer ${
            linkCopied
              ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400'
              : 'bg-violet-50 dark:bg-violet-500/10 ring-violet-100 dark:ring-violet-800/40 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:shadow-md hover:ring-violet-200 dark:hover:ring-violet-700/60 hover:-translate-y-0.5'
          }`}
          title="Copy link to this calculator"
        >
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? "Copied" : "Link"}</span>
        </button>
      </div>
    </div>
  );

  const getWeightStatusSubtext = () => {
    const w = parseFloat(weight.toString());
    if (w > idealWeight.max) return "Consider an active, balanced routine.";
    if (w < idealWeight.min) return "Focus on nutrient-dense meals.";
    return "Keep up the excellent habits!";
  };

  const handleJumpToClassification = () => {
    activeClassificationRowRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    setClassificationPulse(true);
    window.setTimeout(() => setClassificationPulse(false), prefersReducedMotion ? 1100 : 2600);
  };

  const toggleSources = () => {
    setShowSources((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          sourcesPanelRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
          });
        }, 50);
        setSourcesPulse(true);
        window.setTimeout(() => setSourcesPulse(false), 1600);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* INPUT CARD — unified bordered/shadowed surface matching BodyFatCalculator/BMRCalculator */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">

          {/* Title + master unit toggle — converts height, weight & waist together */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                <SafeIcon icon={FiSliders} className="w-3 h-3" />
                Units
              </span>
              <SegmentedToggle
                groupId="bmi-unit-system"
                size="sm"
                ariaLabel="Unit system"
                value={unit}
                onChange={(v) => handleUnitToggle(v as BMIUnit)}
                options={[
                  { value: 'imperial', label: 'Imperial' },
                  { value: 'metric', label: 'Metric' },
                ]}
              />
            </div>
          </div>

          {/* Personal details — Age + Biological Sex + Athletic Build */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Personal details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="bmi-age-input" className={fieldLabelClass}>Age</label>
                </div>
                <NumberField
                  id="bmi-age-input"
                  value={age}
                  onChange={(v) => { setAge(v); resetCalculation(); }}
                  onBlur={handleAgeBlur}
                  suffix="years"
                  error={!!ageError}
                  min="20"
                  max="120"
                  placeholder="e.g. 29"
                />
                {ageError && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 leading-tight">
                    <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {ageError}
                  </p>
                )}
              </div>

              <div>
                <div className={fieldLabelRowClass}>
                  <span className={fieldLabelClass}>Biological Sex</span>
                </div>
                <SegmentedToggle
                  groupId="bmi-sex"
                  ariaLabel="Biological sex selection"
                  value={gender}
                  onChange={(v) => { setGender(v as 'male' | 'female'); setIsPregnant(false); resetCalculation(); }}
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                />
              </div>

              <div>
                <div className={fieldLabelRowClass}>
                  <span className={fieldLabelClass}>Athletic Build?</span>
                  <InfoTip align="end" text="For higher muscle mass — adjusts how high BMI scores are interpreted." />
                </div>
                <SegmentedToggle
                  groupId="bmi-athletic"
                  ariaLabel="Athletic build selection"
                  value={isAthletic ? 'yes' : 'no'}
                  onChange={(v) => { setIsAthletic(v === 'yes'); resetCalculation(); }}
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Calculation Standard — segmented tabs, same pattern as WHRCalculator's Reference Values.
              Sits in the same 3-column grid as the fields above and spans two columns, so it lines up
              with them instead of stretching edge to edge. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="sm:col-span-2">
              <div className={fieldLabelRowClass}>
                <span className={fieldLabelClass}>Calculation Standard</span>
                <InfoTip
                  widthClass="w-64"
                  text="Asia-Pacific uses lower Overweight/Obese cutoffs, reflecting different metabolic risk in Asian populations."
                />
              </div>
              <SegmentedToggle
                groupId="bmi-standard"
                ariaLabel="Calculation standard"
                value={region}
                onChange={(v) => { setRegion(v as BMIRegion); resetCalculation(); }}
                options={[
                  { value: 'who', label: 'Global (WHO)' },
                  { value: 'asia-pacific', label: 'Asia-Pacific' },
                ]}
              />
            </div>
          </div>

          {/* Body measurements — Height, Weight, optional Waist */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Body measurements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="bmi-height-input" className={fieldLabelClass}>Height</label>
                </div>
                {heightUnit === 'metric' ? (
                  <NumberField
                    id="bmi-height-input"
                    value={height}
                    onChange={(v) => { setHeight(v); syncHeightCanonicalMetric(v); resetCalculation(); }}
                    suffix="cm"
                    error={!!heightError}
                    min="30" max="300"
                    placeholder="30-300"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumberField
                      id="bmi-height-input"
                      ariaLabel="Height, feet"
                      value={heightFt}
                      onChange={(v) => { setHeightFt(v); syncHeightCanonicalImperial(v, heightIn.toString()); resetCalculation(); }}
                      suffix="ft"
                      error={!!heightError}
                      min="1" max="9"
                      placeholder="1-9"
                    />
                    <NumberField
                      ariaLabel="Height, inches"
                      value={heightIn}
                      onChange={(v) => { setHeightIn(v); syncHeightCanonicalImperial(heightFt.toString(), v); resetCalculation(); }}
                      suffix="in"
                      error={!!heightError}
                      min="0" max="11"
                      placeholder="0-11"
                    />
                  </div>
                )}
                {heightError && <p className="mt-2.5 text-sm font-medium text-red-500">{heightError}</p>}
              </div>

              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="bmi-weight-input" className={fieldLabelClass}>Weight</label>
                </div>
                <NumberField
                  id="bmi-weight-input"
                  value={weight}
                  onChange={(v) => { setWeight(v); syncWeightCanonical(v); resetCalculation(); }}
                  suffix={weightUnit === 'metric' ? 'kg' : 'lbs'}
                  error={!!weightError}
                  min={weightUnit === 'metric' ? '1' : '2'}
                  max={weightUnit === 'metric' ? '500' : '1100'}
                  placeholder={weightUnit === 'metric' ? '1-500' : '2-1100'}
                />
                {weightError && <p className="mt-2.5 text-sm font-medium text-red-500">{weightError}</p>}
              </div>

              {!isPregnant && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <div className={fieldLabelRowClass}>
                    <label htmlFor="bmi-waist-input" className={`${fieldLabelClass} whitespace-nowrap`}>
                      Waist <span className="text-xs font-normal">(optional)</span>
                    </label>
                    <InfoTip
                      widthClass="w-64"
                      align="end"
                      text="Unlocks waist-to-height ratio and WHO risk screening. Measure midway between your lowest rib and the top of your hip bone."
                    />
                  </div>
                  <NumberField
                    id="bmi-waist-input"
                    value={waist}
                    onChange={(v) => { setWaist(v); syncWaistCanonical(v); resetCalculation(); }}
                    onBlur={handleWaistBlur}
                    suffix={waistUnit === 'metric' ? 'cm' : 'in'}
                    error={!!waistError}
                    min={waistUnit === 'metric' ? '30' : '12'}
                    max={waistUnit === 'metric' ? '300' : '118'}
                    placeholder={waistUnit === 'metric' ? 'e.g. 91' : 'e.g. 36'}
                  />
                  {waistError && <p className="mt-2.5 text-sm font-medium text-red-500">{waistError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Pregnancy — female only (same plain field style and 2-of-3 column width as Calculation Standard) */}
          {gender === 'female' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="sm:col-span-2">
                <div className={fieldLabelRowClass}>
                  <span className={fieldLabelClass}>Currently Pregnant?</span>
                  <InfoTip text="Per WHO and CDC, BMI categories don't apply during pregnancy because weight rises for reasons unrelated to body fat." />
                </div>
                <SegmentedToggle
                  groupId="bmi-pregnant"
                  ariaLabel="Pregnancy status"
                  value={isPregnant ? 'yes' : 'no'}
                  onChange={(v) => { setIsPregnant(v === 'yes'); resetCalculation(); }}
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' },
                  ]}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Action Buttons */}
      <div ref={actionButtonsRef} className="flex flex-col-reverse md:flex-row justify-center items-center gap-4 pt-4">
        <button
          type="button"
          onClick={handleClear}
          disabled={isClearDisabled}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-semibold tracking-normal rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:bg-neutral-50 dark:hover:bg-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-neutral-800 disabled:active:scale-100"
        >
          <SafeIcon icon={FiRotateCcw} className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-500 dark:group-hover:text-neutral-400 group-hover:-rotate-45 transition-all duration-200" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isCalculateDisabled}
          style={{
            background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)',
            boxShadow: '0 10px 20px -6px rgba(79,70,229,0.45), 0 4px 8px -2px rgba(79,70,229,0.25)',
          }}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-10 py-3.5 text-white text-sm font-semibold tracking-normal rounded-lg hover:brightness-[1.08] active:scale-[0.98] active:brightness-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
        >
          <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
          Calculate
        </button>
      </div>

      {/* EMPTY STATE */}
      {!hasCalculated && !hasError && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20"
        >
          <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <path d="M10 70a50 50 0 0 1 100 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            <circle cx="10" cy="70" r="3" fill="currentColor" />
            <circle cx="110" cy="70" r="3" fill="currentColor" />
            <circle cx="60" cy="70" r="6" fill="currentColor" />
            <line x1="60" y1="70" x2="86" y2="34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Fill in your age, height, and weight above, then press Calculate to see your personalized BMI results.
          </p>
        </motion.div>
      )}

      {/* RESULTS SECTIONS */}
      {hasCalculated && !hasError && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="space-y-6 pt-4"
        >
          {isPregnant ? (
            <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-rose-200 dark:border-rose-900/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] flex flex-col md:flex-row items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-50 dark:bg-rose-900/20 shadow-sm border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
                <SafeIcon icon={FiHeart} className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">Standard BMI Categories Don't Apply During Pregnancy</h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  BMI reflects total body weight, which naturally increases during pregnancy due to the growing baby, placenta, and fluids — not body fat. Applying standard weight-status categories (underweight, normal, overweight, obese) to your current weight would be misleading, so we're not showing one.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-3">
                  CDC and IOM pregnancy weight-gain guidelines are instead based on your BMI calculated from your <strong className="text-neutral-900 dark:text-white">pre-pregnancy</strong> weight. If you'd like that figure, re-run this calculator with your pre-pregnancy weight and toggle "Currently Pregnant" to No.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-3">
                  For personalized weight-gain guidance during pregnancy, please consult your healthcare provider.
                </p>
              </div>
            </div>
          ) : (
          <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your BMI Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          <div
            className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden flex flex-col items-center"
          >
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 opacity-20 blur-[80px] rounded-full pointer-events-none transition-colors duration-700 ${currentColors.bg}`} />

            <div className="w-full flex justify-between items-center mb-6 z-10">
              <h3 className="text-lg md:text-xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">BMI Scale</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/50 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                {region === 'who' ? 'WHO Standard' : 'Asia-Pacific'}
              </span>
            </div>

            <div className="relative w-full max-w-[360px] mx-auto z-10">
              <svg viewBox="0 0 400 220" className="w-full h-auto overflow-visible filter drop-shadow-sm" aria-hidden="true">
                <path d={describeArc(200, 180, 150, 0, 180)} fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" className="text-neutral-100 dark:text-neutral-700/50" />
                
                {bmiRanges.map((range, i) => {
                  const startAngle = bmiToAngle(range.min);
                  const endAngle = bmiToAngle(range.max);
                  const segmentColors = getCategoryColors(range.category);
                  return (
                    <path
                      key={i}
                      d={describeArc(200, 180, 150, startAngle, endAngle - (i === bmiRanges.length - 1 ? 0 : 1.5))}
                      fill="none"
                      stroke={segmentColors.hex}
                      strokeWidth="30"
                      strokeLinecap="butt"
                      className="transition-all duration-700 ease-in-out"
                    />
                  );
                })}

                <text x="15" y="195" fontSize="14" fontWeight="700" fill="currentColor" className="text-neutral-400 dark:text-neutral-500 tracking-wide">{minScale}</text>
                <text x="385" y="195" fontSize="14" fontWeight="700" fill="currentColor" textAnchor="end" className="text-neutral-400 dark:text-neutral-500 tracking-wide">{maxScale}+</text>

                <motion.g
                  initial={{ rotate: -90 }}
                  animate={{ rotate: needleAngle }}
                  transition={springConfig}
                  style={{ originX: "50%", originY: "50%" }}
                  className="drop-shadow-lg"
                >
                  <circle cx="200" cy="180" r="145" fill="transparent" stroke="none" />
                  <polygon points="197,180 200,35 203,180" className="fill-neutral-800 dark:fill-neutral-200" />
                  <circle cx="200" cy="180" r="14" className="fill-neutral-800 dark:fill-neutral-200" />
                  <circle cx="200" cy="180" r="5" className="fill-white dark:fill-neutral-900" />
                </motion.g>
              </svg>

              <div className="flex flex-col items-center justify-center mt-4 z-20">
                <motion.span
                  key={bmi}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm ${currentColors.text}`}
                  aria-live="polite"
                >
                  {bmi.toFixed(1)}
                </motion.span>
                <span className={`text-sm font-bold uppercase tracking-[0.15em] mt-1 ${currentColors.text}`}>
                  {category}
                </span>
                <button
                  type="button"
                  onClick={handleJumpToClassification}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  style={{ borderColor: currentColors.hex, color: currentColors.hex }}
                >
                  <motion.span
                    className="inline-flex"
                    animate={prefersReducedMotion ? undefined : { y: [0, 3, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <SafeIcon icon={FiArrowDown} className="w-3.5 h-3.5" />
                  </motion.span>
                  See in Classification Table
                </button>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md group">
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-300 ${currentColors.bg}`} />
            <div className="relative z-10 flex flex-col md:flex-row items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                <SafeIcon icon={FiHeart} className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Wellness Overview</h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal text-[15px] md:text-base">
                  {getBMIInsight(category, isAthletic)}
                </p>
                <p className="text-xs font-normal text-neutral-500 dark:text-neutral-400 leading-relaxed mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-700/50">
                  {getGenderContextNote(gender)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/10 ${currentColors.bgLight} shadow-sm hover:shadow-md transition-shadow group`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 transition-opacity ${currentColors.bg}`} />
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiTarget} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Healthy Weight</h3>
                  <p className="text-xs font-semibold text-neutral-400">Standard guideline</p>
                </div>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {idealWeight.max === 0 ? '--' : `${idealWeight.min.toFixed(1)} - ${idealWeight.max.toFixed(1)}`}
                <span className="text-sm font-bold text-neutral-500 uppercase ml-2">{weightUnit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
              <div className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mt-2">
                Optimal target for your height.
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/10 ${currentColors.bgLight} shadow-sm hover:shadow-md transition-shadow group`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 transition-opacity ${currentColors.bg}`} />
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiTrendingUp} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Weight Status</h3>
                  <p className="text-xs font-semibold text-neutral-400">Health indicator</p>
                </div>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {idealWeight.max === 0
                  ? '--'
                  : parseFloat(weight.toString()) > idealWeight.max ? 'Above Guideline' : 
                    parseFloat(weight.toString()) < idealWeight.min ? 'Below Guideline' : 'Within Range'}
              </div>
              <div className={`text-sm font-bold mt-2 ${currentColors.text}`}>
                {getWeightStatusSubtext()}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-sm hover:shadow-md transition-shadow group">
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-300 ${currentColors.bg}`} />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiBarChart2} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Additional Metrics</h3>
                  <p className="text-xs font-semibold text-neutral-400 mt-0.5">Extra reference values</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow px-4 sm:px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                      <SafeIcon icon={FiPercent} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-neutral-700 dark:text-neutral-200 leading-tight">BMI Prime</span>
                      <p className="text-xs text-neutral-400 mt-0.5">Ratio to normal limit (25)</p>
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                    {bmiPrime === 0 ? '--' : bmiPrime.toFixed(2)}
                  </div>
                </div>

                <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow px-4 sm:px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                      <SafeIcon icon={FiLayers} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-semibold text-neutral-700 dark:text-neutral-200 leading-tight">Ponderal Index</span>
                      <p className="text-xs text-neutral-400 mt-0.5">Height-weighted alternative</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                      {ponderalIndex === 0 ? '--' : ponderalIndex.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-neutral-400 uppercase">kg/m³</span>
                  </div>
                </div>

                {whtrCategory && (
                  <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow px-4 sm:px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                        <SafeIcon icon={FiMaximize2} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-semibold text-neutral-700 dark:text-neutral-200 leading-tight">Waist-to-Height Ratio</span>
                        <p className="text-xs text-neutral-400 mt-0.5">NICE guideline (WHtR &lt; 0.50)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{whtr.toFixed(2)}</span>
                      <span className={`inline-flex items-center justify-center text-center leading-snug whitespace-normal text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${getRiskBadgeClasses(whtrCategory)}`}>
                        {whtrCategory}
                      </span>
                    </div>
                  </div>
                )}

                {waistRiskLevel && (
                  <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow px-4 sm:px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                        <SafeIcon icon={FiShield} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-semibold text-neutral-700 dark:text-neutral-200 leading-tight">Waist Risk (WHO)</span>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {gender === 'male' ? 'Threshold: 94cm / 102cm (men)' : 'Threshold: 80cm / 88cm (women)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <span className={`inline-flex items-center justify-center text-center leading-snug whitespace-normal text-[11px] font-bold uppercase px-2.5 py-1.5 rounded-full ${getRiskBadgeClasses(waistRiskLevel)}`}>
                        {waistRiskLevel}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {gridData && (
            <div className="relative bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <div className="p-6 md:p-8 min-w-[600px]">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white mb-2">Your BMI Matrix</h3>
                    <span className="text-sm font-medium text-neutral-500 block">Center highlights your exact metrics</span>
                    <span className="md:hidden text-xs font-semibold text-neutral-400 mt-1 block">Swipe to see the full matrix &rarr;</span>
                  </div>
                  <div className="flex gap-4 text-xs font-bold uppercase tracking-wider bg-neutral-50 dark:bg-neutral-900/50 py-2 px-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></span>Under</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></span>Normal</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm"></span>Over</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-sm"></span>Obese</div>
                  </div>
                </div>
                
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border-b border-r border-neutral-200 dark:border-neutral-700 text-xs text-neutral-400 uppercase tracking-wide">
                        W \ H
                      </th>
                      {gridData.heights.map((h, i) => (
                        <th key={i} className={`p-2 border-b border-neutral-200 dark:border-neutral-700 text-sm font-bold ${i === 4 ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
                          {formatGridHeight(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.weights.map((w, rowIdx) => (
                      <tr key={rowIdx}>
                        <td className={`p-2 border-r border-neutral-200 dark:border-neutral-700 text-sm font-bold ${rowIdx === 4 ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
                          {formatGridWeight(w)}
                        </td>
                        {gridData.heights.map((h, colIdx) => {
                          const cell = gridData.grid[rowIdx][colIdx];
                          const colors = getCategoryColors(cell.category);
                          const isCenter = rowIdx === 4 && colIdx === 4;
                          return (
                            <td key={colIdx} className="p-1 border border-transparent">
                              <div className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${isCenter ? 'ring-2 ring-offset-2 ring-neutral-800 dark:ring-white scale-110 shadow-lg z-10 relative' : 'opacity-90'} ${colors.bg} text-white`}>
                                {cell.bmi.toFixed(1)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
              <div className="md:hidden pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-white dark:from-neutral-800 to-transparent" />
            </div>
          )}
          
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white">
                Detailed Classification {region === 'asia-pacific' ? '(Asia-Pacific)' : '(WHO)'}
              </h3>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {bmiRanges.map((range, index) => {
                const rowColors = getCategoryColors(range.category);
                const isActive = index === activeRangeIndex;
                return (
                  <motion.div
                    key={index}
                    ref={isActive ? activeClassificationRowRef : undefined}
                    className={`flex flex-col items-start gap-y-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 pl-6 pr-4 sm:pl-8 sm:pr-6 md:pl-10 md:pr-8 py-4 sm:py-5 transition-colors duration-300 relative ${
                      isActive ? 'bg-neutral-50 dark:bg-neutral-700/20 shadow-inner' : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50'
                    }`}
                    animate={
                      isActive && classificationPulse
                        ? { scale: prefersReducedMotion ? [1, 1.008, 1] : [1, 1.018, 1] }
                        : { scale: 1 }
                    }
                    style={isActive && classificationPulse ? { willChange: 'transform' } : undefined}
                    transition={{
                      duration: prefersReducedMotion ? 1.1 : 2.6,
                      ease: [0.45, 0, 0.15, 1],
                    }}
                  >
                    {isActive && classificationPulse && (
                      <motion.div
                        aria-hidden="true"
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{ boxShadow: `0 0 18px 3px ${rowColors.hex}`, willChange: 'opacity' }}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: prefersReducedMotion ? [0, 0.35, 0] : [0, 0.5, 0],
                        }}
                        transition={{
                          duration: prefersReducedMotion ? 1.1 : 2.6,
                          ease: [0.45, 0, 0.15, 1],
                        }}
                      />
                    )}

                    {isActive && (
                      <div className={`absolute left-0 top-0 w-1.5 h-full ${rowColors.bg}`} />
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                      <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full flex-shrink-0 ${rowColors.bg} shadow-sm`}></div>
                      <span className={`text-base sm:text-lg tracking-tight ${isActive ? 'font-black text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>
                        {range.category}
                      </span>
                      {isActive && (
                        <span
                          className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${rowColors.hex}1A`, color: rowColors.hex }}
                        >
                          Your Result
                        </span>
                      )}
                    </div>
                    <span className={`text-sm sm:text-base tracking-wide font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border whitespace-nowrap ${
                      isActive
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 dark:text-neutral-400 border-neutral-200/70 dark:border-neutral-700/50'
                    }`}>
                      {range.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          </>
          )}
        </motion.div>
      )}

      {renderShareBar()}

      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This BMI calculator provides a general guide, not medical advice. BMI does not account for muscle mass, age, or ethnic differences; highly muscular individuals may be falsely classified as overweight. Always consult a healthcare professional before altering your diet or lifestyle.
        </p>
      </div>

      <div
        ref={sourcesPanelRef}
        style={sourcesPulse ? { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' } : undefined}
        className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300"
      >
        <button
          type="button"
          onClick={toggleSources}
          aria-expanded={showSources}
          className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                Sources
              </span>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">
                {BMI_SOURCES.length} references — every formula and threshold used above, cited
              </span>
            </div>
          </div>
          <span
            className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${showSources ? 'rotate-180' : ''}`}
          >
            <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
          </span>
        </button>
        <motion.div
          initial={false}
          animate={{ height: showSources ? 'auto' : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
          aria-hidden={!showSources}
        >
          <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
            <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {BMI_SOURCES.map((source, i) => (
                <li key={source.metric} className="flex gap-3 pt-4 first:pt-0 first:mt-0">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200">{source.metric}</p>
                    <p className="leading-relaxed mt-1 text-neutral-600 dark:text-neutral-400">{source.citation}</p>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        tabIndex={showSources ? 0 : -1}
                        className="group inline-flex items-center gap-1.5 mt-2.5 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold text-[13px]"
                      >
                        <span className="underline-offset-2 group-hover:underline">{source.linkLabel ?? 'View source'}</span>
                        <SafeIcon icon={FiExternalLink} className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="pt-4 mt-4 border-t border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-400 leading-relaxed">
              Input range limits on this form (e.g. 30–300cm height, 1–500kg weight) are general sanity bounds for data entry, not clinical cut-offs, and aren't drawn from any source above.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BMICalculator;
