"use client";

// --- REVERSE BMI CALCULATOR (adults only) ---
// Solves the BMI formula backwards: height + target BMI -> weight, or weight +
// target BMI -> height. (Weight + height -> BMI lives on the BMI calculator.) All maths lives in
// reverseBmiLogic.ts (public-domain formulas only); category names, colours
// and cut-offs come from bmiLogic.ts so a BMI category looks the same here
// as on the BMI calculator.
//
// Primitives below are copied verbatim, as the other calculators do:
//  - from BMICalculator.tsx: getCategoryColors, field classes, InfoTip,
//    SegmentedToggle, NumberField, slowScrollToElement
//  - from AgeDifferenceCalculator.tsx: EASE_OUT, TILE_TONES, CountUp,
//    ResultCard, SectionHeader, StatTile

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, animate } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import {
  solveReverseBMI,
  getTargetBMILimits,
  getHealthyWeightRange,
  getCategoryWeightTable,
  getCategoryForBMI,
  getWhatIfTable,
  getWeightDifference,
  getWeeksAtPace,
  getSafetyNotes,
  roundTo,
  poundsToStone,
  DEFAULT_WHAT_IF_TARGETS,
  REVERSE_INPUT_LIMITS,
  REVERSE_BMI_SOURCES,
  type ReverseMode,
  type ReverseResult,
  type CategoryWeightRow,
  type BMIUnit,
  type BMIRegion,
} from '@/utils/calculators/reverseBmiLogic';
import { getBMIRanges } from '@/utils/calculators/bmiLogic';
import { formatWithCommas } from '@/utils/calculators/dateLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiTarget, FiActivity, FiArrowUp, FiInfo, FiBarChart2, FiSliders, FiRotateCcw, FiCheckCircle,
  FiShare2, FiMail, FiCopy, FiCheck, FiFileText, FiArrowDown, FiExternalLink,
  FiAlertTriangle, FiPercent, FiClock, FiImage, FiLoader, FiChevronDown, FiDownload, FiMaximize2, FiX,
} = FiIcons;

interface ReverseBMICalculatorProps {
  onCalculationComplete?: () => void;
  /** Report contract shared by every calculator (wired up with the PDF/PNG downloads). */
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  /** Native share sheet for the calculator page (falls back to copying the link). */
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- DYNAMIC PREMIUM COLOR MAPPER --- (copied from BMICalculator.tsx)
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

// Text colours for the result card, tuned for contrast in BOTH themes.
// `hero` is the big number (large text, needs 3:1); `label` is the small
// uppercase category tag (needs 4.5:1), so its light-mode shade is one step
// darker. Class names are written out in full so Tailwind can detect them.
const getResultTextClasses = (category: string): { hero: string; label: string } => {
  switch (category) {
    case 'Severe thinness': return { hero: 'text-indigo-600 dark:text-indigo-400', label: 'text-indigo-700 dark:text-indigo-400' };
    case 'Moderate thinness':
    case 'Underweight': return { hero: 'text-blue-600 dark:text-blue-400', label: 'text-blue-700 dark:text-blue-400' };
    case 'Mild thinness': return { hero: 'text-sky-600 dark:text-sky-400', label: 'text-sky-700 dark:text-sky-400' };
    case 'Normal range': return { hero: 'text-green-600 dark:text-green-500', label: 'text-green-700 dark:text-green-500' };
    case 'Overweight':
    case 'Pre-obese': return { hero: 'text-yellow-700 dark:text-yellow-500', label: 'text-yellow-700 dark:text-yellow-500' };
    case 'Obese Class I':
    case 'Obesity Class I': return { hero: 'text-orange-600 dark:text-orange-400', label: 'text-orange-700 dark:text-orange-400' };
    case 'Obese Class II':
    case 'Obesity Class II': return { hero: 'text-red-600 dark:text-red-400', label: 'text-red-700 dark:text-red-400' };
    case 'Obese Class III': return { hero: 'text-rose-700 dark:text-rose-500', label: 'text-rose-700 dark:text-rose-500' };
    default: return { hero: 'text-neutral-600 dark:text-neutral-400', label: 'text-neutral-600 dark:text-neutral-400' };
  }
};

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

// Slim, rounded scrollbar for the modal body. WebKit/Blink get a thin pill-shaped thumb inset from the
// track edges (turns indigo on hover); Firefox gets its thin-scrollbar equivalent. Class names are
// written out in full so Tailwind can detect them.
const MODAL_SCROLL_CLASS =
  '[&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:my-1 ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding ' +
  '[&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 ' +
  '[&::-webkit-scrollbar-thumb:hover]:bg-indigo-400 dark:[&::-webkit-scrollbar-thumb:hover]:bg-indigo-500 ' +
  'supports-[-moz-appearance:none]:[scrollbar-width:thin] supports-[-moz-appearance:none]:[scrollbar-color:#d4d4d4_transparent] dark:supports-[-moz-appearance:none]:[scrollbar-color:#525252_transparent]';

// --- MODAL --- (based on BodyFatCalculator.tsx: portal overlay, Esc / backdrop / X to close.
// One size step wider than Body Fat's max-w-sm, with a fixed header and its own scroll area, so the scrollbar
// never runs into the rounded corners.)
const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({
  open, onClose, title, children,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative flex w-full max-w-md max-h-[85vh] flex-col overflow-hidden bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-2xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <SafeIcon icon={FiX} className="w-4 h-4" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6 ${MODAL_SCROLL_CLASS}`}>
          {children}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

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


// --- ANIMATION CURVE --- (copied from AgeDifferenceCalculator.tsx)
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// --- SHARED RESULT-SECTION PRIMITIVES --- (identical contract to ChronologicalAgeCalculator.tsx)
type IconType = React.ComponentProps<typeof SafeIcon>['icon'];

// Each tone carries three stops (light -> body -> deep) plus a glow color,
// so tiles can be built as lacquered, multi-layer surfaces instead of a
// flat two-stop gradient. Gold keeps a deeper end stop from the
// previous pass so white numerals keep comfortable contrast on them.
const TILE_TONES = {
  indigo: { from: '#6366ec', mid: '#6d64d6', to: '#272260', glow: '#ced7fe' }, // indigo — the lead colour (matches the input card's controls)
  slate: { from: '#667791', mid: '#3f4f67', to: '#141d36', glow: '#e7ecf1' }, // slate — quiet, neutral counterweight
  teal: { from: '#0a847e', mid: '#0e7c7a', to: '#0a4a57', glow: '#7ceedc' }, // teal — cool complement (echoes Person 1's identity colour)
  gold: { from: '#a8680e', mid: '#a8640c', to: '#733d07', glow: '#fdeeb1' }, // antique gold — every stop keeps white text at 4.5:1 or better
} as const;
type TileTone = keyof typeof TILE_TONES;

const fitNumberStyle = (text: string, maxRem: number, minRem = 0.875): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(86 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// Counts a number up from 0 (first render) or from its previous value —
// same contract as ChronologicalAgeCalculator.tsx / BirthdayCalculator.tsx's
// CountUp. The final value renders invisibly underneath so the box is
// already its full width from the first frame — no label jitter while the
// digits climb. With reduced motion it simply shows the value.
const CountUp: React.FC<{ value: number; duration?: number; delay?: number; formatter?: (n: number) => string }> = ({
  value, duration = 1.1, delay = 0, formatter = (n) => String(n),
}) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduced ? value : 0);
  const fromRef = useRef<number>(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      fromRef.current = value;
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      delay: fromRef.current === 0 ? delay : 0,
      ease: EASE_OUT,
      onUpdate: (v) => {
        fromRef.current = v;
        setDisplay(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration, delay]);
  return (
    <span className="relative inline-block">
      <span className="invisible">{formatter(value)}</span>
      {/* With reduced motion the value is shown directly (no state update inside the effect). */}
      <span className="absolute inset-0">{formatter(reduced ? value : display)}</span>
    </span>
  );
};

const ResultCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`group relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-white via-neutral-50 to-indigo-50/50 dark:from-neutral-800 dark:via-neutral-800 dark:to-indigo-900/10 shadow-sm motion-safe:transition-all motion-safe:duration-300 hover:shadow-lg hover:shadow-indigo-600/[0.10] hover:border-indigo-300/70 dark:hover:border-indigo-700/60 p-4 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-500/20 via-teal-400/10 to-transparent blur-2xl motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-110" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-20 -left-14 w-56 h-56 rounded-full bg-gradient-to-tr from-amber-400/18 via-indigo-400/10 to-transparent blur-2xl motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-110" aria-hidden="true" />
    <div className="relative">{children}</div>
  </div>
);

const SectionHeader: React.FC<{ icon: IconType; title: string; subtitle?: React.ReactNode; tip?: string; badge?: React.ReactNode; mb?: string; }> = ({
  icon, title, subtitle, tip, badge, mb = 'mb-5',
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 ${mb}`}>
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-600/35" aria-hidden="true">
        <SafeIcon icon={icon} className="w-3.5 h-3.5 text-white" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-base font-extrabold leading-7 text-neutral-900 dark:text-white">{title}</h4>
          {tip && <InfoTip text={tip} />}
        </div>
        {subtitle && <p className="-mt-0.5 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
      </div>
    </div>
    {badge}
  </div>
);

// Splits a formatted figure such as "\u221229.1 kg", "5.8 wks" or "\u221228.6%" into
// the number and its unit, so the unit can be set smaller beside the number.
const splitFigure = (text: string): { num: string; unit: string } => {
  const m = text.match(/^([+\u2212-]?\d[\d.,]*)\s*(.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: text, unit: '' };
};

const StatTile: React.FC<{
  tone: TileTone;
  icon?: IconType;
  emoji?: string;
  value: string;
  numericValue?: number;
  segments?: { value: number; unit: string; label?: string }[];
  label: string;
  sub?: string;
  badge?: string;
  maxRem?: number;
  delay?: number;
}> = ({
  tone, icon, emoji, value, numericValue, segments, label, sub, badge, maxRem = 1.75, delay = 0,
}) => {
  const t = TILE_TONES[tone];
  const reduced = useReducedMotion();
  const { num, unit } = splitFigure(value);
  // Size the figure from the number plus a (smaller) unit so it fits the tile.
  const fitText = num.padEnd(num.length + Math.ceil(unit.length * 0.45) + 1);
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: EASE_OUT }}
      className="group relative isolate overflow-hidden rounded-3xl p-5 sm:p-6 text-white ring-1 ring-inset ring-white/15 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1"
      style={{
        background: `linear-gradient(150deg, ${t.from} 0%, ${t.mid} 48%, ${t.to} 100%)`,
        containerType: 'inline-size',
        boxShadow: `0 22px 40px -22px ${t.to}, 0 8px 16px -8px ${t.to}99, inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22)`,
      }}
    >
      {/* depth: corner glow, bottom shade, top edge highlight, hover sheen */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-40 blur-3xl motion-safe:transition-opacity motion-safe:duration-500 group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, ${t.glow} 0%, transparent 65%)` }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.10] to-transparent motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:translate-x-[520%]"
      />

      {/* label + glass icon */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="pt-1 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-white">{label}</span>
        <span className="flex flex-shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm">
              {badge}
            </span>
          )}
          <span
            className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl text-lg leading-none ring-1 ring-white/35 backdrop-blur-sm"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 100%)',
              boxShadow: '0 8px 16px -6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
            aria-hidden="true"
          >
            {icon ? <SafeIcon icon={icon} className="relative h-5 w-5 text-white drop-shadow" /> : <span className="relative">{emoji}</span>}
          </span>
        </span>
      </div>

      {/* figure: big number with a smaller unit */}
      <div
        className="relative z-10 mt-6 flex items-baseline gap-[0.3em] font-extrabold tabular-nums tracking-tight leading-none whitespace-nowrap"
        style={{ ...fitNumberStyle(fitText, maxRem), textShadow: '0 2px 10px rgba(0,0,0,0.22)' }}
      >
        {segments ? (
          segments.map((seg, i) => (
            <span key={seg.unit} className="inline-flex items-baseline">
              <CountUp value={seg.value} delay={delay + i * 0.08} />
              <span className="ml-[0.12em] text-[0.5em] font-semibold tracking-wide">{seg.unit}</span>
            </span>
          ))
        ) : (
          <>
            <span>
              {typeof numericValue === 'number' ? (
                <CountUp value={numericValue} formatter={formatWithCommas} delay={delay} />
              ) : (
                num
              )}
            </span>
            {unit && <span className="text-[0.5em] font-semibold tracking-wide">{unit}</span>}
          </>
        )}
      </div>

      {/* detail */}
      {sub && (
        <div className="relative z-10 mt-6 border-t border-white/15 pt-4">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-xs font-semibold tabular-nums text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: t.glow }} />
            <span className="min-w-0 truncate">{sub}</span>
          </span>
        </div>
      )}
    </motion.div>
  );
};

// Conversion factors for the unit toggle and the secondary "other unit" figures —
// the same ones BMICalculator.tsx uses. The solving itself never uses them.
// PROVENANCE (public domain): 1 kg = 2.20462 lb is the standard unit conversion;
// 1 inch = 2.54 cm exactly, by international definition.
const KG_TO_LB = 2.20462;
const CM_PER_INCH = 2.54;

const MODE_OPTIONS: { value: ReverseMode; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'height', label: 'Height' },
];

// All result values are kept in the unit the person entered (kg/cm or lbs/in),
// so imperial entries use the standard 703 formula directly, with no metric round trip.
const fmtWeight = (value: number, unit: BMIUnit): string =>
  `${value.toFixed(1)} ${unit === 'metric' ? 'kg' : 'lbs'}`;

const fmtHeight = (value: number, unit: BMIUnit): string => {
  if (unit === 'metric') return `${value.toFixed(1)} cm`;
  let ft = Math.floor(value / 12);
  let inch = value - ft * 12;
  if (inch.toFixed(1) === '12.0') { ft += 1; inch = 0; }
  return `${ft} ft ${inch.toFixed(1)} in`;
};

const fmtStone = (lb: number): string => {
  let { stone, pounds } = poundsToStone(lb);
  if (pounds.toFixed(1) === '14.0') { stone += 1; pounds = 0; }
  return `${stone} st ${pounds.toFixed(1)} lb`;
};

/** Converts a weight between units (display-only secondary figures). */
const convertWeight = (value: number, from: BMIUnit, to: BMIUnit): number =>
  from === to ? value : from === 'metric' ? value * KG_TO_LB : value / KG_TO_LB;

const fmtBandRange = (row: CategoryWeightRow, from: BMIUnit, to: BMIUnit): string => {
  const n = (v: number) => convertWeight(v, from, to).toFixed(1);
  const label = to === 'metric' ? 'kg' : 'lbs';
  if (row.weightFrom === null && row.weightTo !== null) return `Up to ${n(row.weightTo)} ${label}`;
  if (row.weightTo === null && row.weightFrom !== null) return `${n(row.weightFrom)} ${label} and above`;
  if (row.weightFrom !== null && row.weightTo !== null) return `${n(row.weightFrom)} \u2013 ${n(row.weightTo)} ${label}`;
  return '--';
};

// Short, own-wording versions of the safety notes for the report rows (the PDF and PNG
// generators draw single-line label/value rows, so full sentences would not fit).
const REPORT_NOTE_ROWS: Record<string, { label: string; value: string }> = {
  screening: { label: 'About BMI', value: 'A screening measure, not a diagnosis' },
  'below-range': { label: 'Below Healthy Range', value: 'Consider speaking with a health professional' },
  'large-change': { label: 'Large Change', value: 'Consider speaking with a health professional' },
};

// --- TARGET BMI SLIDER ---
// A native range input laid over a strip of the region's BMI bands. Band colours come
// from getCategoryColors (the BMI calculator's own mapper) and band edges from
// getBMIRanges, so the strip always matches the category table below the results.
const TargetBmiSlider: React.FC<{
  value: number | null;
  region: BMIRegion;
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ value, region, min, max, onChange }) => {
  const ranges = getBMIRanges(region);
  const span = max - min;
  const shown = Math.min(Math.max(value ?? 22, min), max);
  const category = value !== null ? getCategoryForBMI(shown, region) : '';
  // Cut-off labels start at 18.5 (the start of the normal range in both standards). The thinness
  // edges below it sit too close together to label legibly; the coloured bands still show them.
  const tickEdges = ranges.map((r) => r.min).filter((edge) => edge >= 18.5 && edge > min && edge < max);
  return (
    <div>
      <div className="relative flex h-6 items-center">
        <div
          className="absolute inset-x-0 flex h-2.5 overflow-hidden rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10"
          aria-hidden="true"
        >
          {ranges.map((r) => (
            <span
              key={r.category}
              className={`h-full ${getCategoryColors(r.category).bg}`}
              style={{ width: `${((Math.min(r.max, max) - Math.max(r.min, min)) / span) * 100}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          id="reverse-bmi-target-slider"
          aria-label="Target BMI slider"
          aria-valuetext={value !== null ? `BMI ${shown.toFixed(1)}, ${category}` : 'No target BMI chosen yet'}
          min={min}
          max={max}
          step={0.1}
          value={shown}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`relative h-6 w-full cursor-pointer appearance-none bg-transparent focus:outline-none [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&:focus-visible::-webkit-slider-thumb]:ring-2 [&:focus-visible::-webkit-slider-thumb]:ring-indigo-400/70 ${value === null ? 'opacity-60' : ''}`}
        />
      </div>
      <div className="relative mt-1 h-4 text-[11px] font-bold tabular-nums text-neutral-500 dark:text-neutral-400" aria-hidden="true">
        {tickEdges.map((edge) => (
          <span key={edge} className="absolute -translate-x-1/2" style={{ left: `${((edge - min) / span) * 100}%` }}>
            {edge}
          </span>
        ))}
      </div>
    </div>
  );
};

// --- BMI SCALE (result card) ---
// The region's BMI bands as one strip with a diamond marker at the result BMI. Band colours and
// edges come from the same sources as TargetBmiSlider, so both always agree.
const BmiScale: React.FC<{
  bmi: number;
  region: BMIRegion;
  min: number;
  max: number;
  hex: string;
  category: string;
}> = ({ bmi, region, min, max, hex, category }) => {
  const ranges = getBMIRanges(region);
  const span = max - min;
  const pos = Math.min(Math.max((bmi - min) / span, 0), 1) * 100;
  const tickEdges = ranges.map((r) => r.min).filter((edge) => edge >= 18.5 && edge > min && edge < max);
  return (
    <div
      role="img"
      aria-label={`BMI ${bmi.toFixed(1)}, ${category}, shown on the ${region === 'who' ? 'WHO' : 'Asia-Pacific'} BMI scale`}
      className="mx-auto mt-3 w-full max-w-xl px-3 pt-8"
    >
      <div className="relative">
        <span
          className="absolute -top-6 z-10 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${pos}%` }}
          aria-hidden="true"
        >
          <span
            className="block h-4 w-4 rotate-45 rounded-[4px] border-2 border-white shadow-md dark:border-neutral-900"
            style={{ backgroundColor: hex }}
          />
          <span className="mt-0.5 block h-1.5 w-0.5 rounded-full" style={{ backgroundColor: hex }} />
        </span>
        <div className="flex h-2.5 overflow-hidden rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10" aria-hidden="true">
          {ranges.map((r) => (
            <span
              key={r.category}
              className={`h-full ${getCategoryColors(r.category).bg}`}
              style={{ width: `${((Math.min(r.max, max) - Math.max(r.min, min)) / span) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="relative mt-2 h-4 text-[11px] font-bold tabular-nums text-neutral-500 dark:text-neutral-400" aria-hidden="true">
        {tickEdges.map((edge) => (
          <span key={edge} className="absolute -translate-x-1/2" style={{ left: `${((edge - min) / span) * 100}%` }}>
            {edge}
          </span>
        ))}
      </div>
    </div>
  );
};

// One row of a "category / BMI" list. The row that matches the person's
// result (`active`) is highlighted so it gets instant attention; every other
// row keeps the plain look. Dividers are drawn per row (`showDivider`) so they
// never cut through the highlighted row.
const HighlightRow: React.FC<{
  category: string;
  active: boolean;
  showDivider: boolean;
  title: string;
  subtitle: string;
  primary: string;
  secondary: string;
}> = ({ category, active, showDivider, title, subtitle, primary, secondary }) => {
  const colors = getCategoryColors(category);
  const tone = getResultTextClasses(category);
  return (
    <div className={`${showDivider ? 'border-t border-neutral-200/70 dark:border-neutral-700/60' : ''} ${active ? 'my-1.5' : ''}`}>
      <div
        aria-current={active ? 'true' : undefined}
        className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 rounded-xl border px-3 py-3 ${
          active ? `bg-gradient-to-r ${colors.grad} shadow-md ${colors.shadow} sm:py-3.5` : 'border-transparent'
        }`}
      >
        {active && <span aria-hidden="true" className={`absolute inset-y-2.5 left-0 w-1 rounded-full ${colors.bg}`} />}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0" aria-hidden="true">
            {active && (
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${colors.bg}`} />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors.bg}`} />
          </span>
          <div className="min-w-0">
            <p className={`text-base leading-snug ${active ? `font-extrabold ${tone.label}` : 'font-bold text-neutral-800 dark:text-neutral-200'}`}>
              {title}
              {active && (
                <span className={`ml-2 inline-flex items-center rounded-full border bg-white/70 px-2 py-0.5 align-middle text-[11px] font-extrabold uppercase tracking-wider dark:bg-neutral-900/50 ${colors.border} ${tone.label}`}>
                  Your target
                </span>
              )}
            </p>
            <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          </div>
        </div>
        <div className="pl-5 sm:pl-0 sm:flex-shrink-0 sm:whitespace-nowrap sm:text-right">
          <p className={`tabular-nums text-neutral-900 dark:text-white ${active ? 'text-lg font-extrabold' : 'text-base font-bold'}`}>{primary}</p>
          <p className="text-[13px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">{secondary}</p>
        </div>
      </div>
    </div>
  );
};

// One "what if" scenario row. Only the target row is a lifted card (tinted,
// ringed, badged), so it gets instant attention while the rest of the list
// stays quiet. Each row shows the BMI, the category as a chip, a bar for this
// weight relative to the heaviest scenario, the weight, and the difference
// from the person's target.
const WhatIfRow: React.FC<{
  bmi: number;
  category: string;
  active: boolean;
  primary: string;
  secondary: string;
  barPercent: number;
  delta: string;
  direction: 'up' | 'down' | 'same';
}> = ({ bmi, category, active, primary, secondary, barPercent, delta, direction }) => {
  const colors = getCategoryColors(category);
  const tone = getResultTextClasses(category);
  return (
    <li aria-current={active ? 'true' : undefined} className="py-1">
      <div
        className={`flex items-center gap-3 sm:gap-4 rounded-2xl px-3 py-3 sm:px-4 motion-safe:transition-colors motion-safe:duration-200 ${
          active
            ? `border bg-gradient-to-r ${colors.grad} shadow-lg ${colors.shadow} ring-1 ring-inset ring-white/60 dark:ring-white/10 sm:py-4`
            : 'border border-transparent hover:bg-neutral-100/70 dark:hover:bg-white/[0.04]'
        }`}
      >
        <div className="w-12 flex-shrink-0 sm:w-14">
          <p className="text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-neutral-500 dark:text-neutral-400">BMI</p>
          <p className={`mt-1 tabular-nums font-extrabold leading-none ${active ? `text-xl ${tone.label}` : 'text-lg text-neutral-800 dark:text-neutral-200'}`}>
            {bmi.toFixed(1)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.bgLight} ${tone.label}`}>{category}</span>
            {active && (
              <span className={`inline-flex items-center rounded-full border bg-white/80 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider dark:bg-neutral-900/60 ${colors.border} ${tone.label}`}>
                Your target
              </span>
            )}
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-700/60" aria-hidden="true">
            <div className={`h-full rounded-full ${colors.bg}`} style={{ width: `${Math.max(4, Math.min(100, barPercent))}%` }} />
          </div>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-500 dark:text-neutral-400">
            {direction !== 'same' && <SafeIcon icon={direction === 'up' ? FiArrowUp : FiArrowDown} className="h-3 w-3" />}
            {delta}
          </p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className={`tabular-nums text-neutral-900 dark:text-white ${active ? 'text-base font-extrabold sm:text-lg' : 'text-base font-bold'}`}>{primary}</p>
          <p className="mt-0.5 text-[13px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">{secondary}</p>
        </div>
      </div>
    </li>
  );
};

// Sign helper for the current-vs-target tiles (true minus sign, not a hyphen).
const signFor = (direction: 'lower' | 'higher' | 'same'): string =>
  direction === 'lower' ? '\u2212' : direction === 'higher' ? '+' : '';

const ReverseBMICalculator: React.FC<ReverseBMICalculatorProps> = ({ onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null, onShare, onEmailShare, onCopyLink, linkCopied = false }) => {
  const prefersReducedMotion = useReducedMotion();

  // State
  const [mode, setMode] = useState<ReverseMode>('weight');
  const [unit, setUnit] = useState<BMIUnit>('imperial');
  const [region, setRegion] = useState<BMIRegion>('who');

  const [height, setHeight] = useState<string>('');
  const [heightFt, setHeightFt] = useState<string>('');
  const [heightIn, setHeightIn] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [targetBmi, setTargetBmi] = useState<string>('');
  // Optional extras (Target weight mode only): current weight, and a weekly pace the person chooses.
  const [currentWeight, setCurrentWeight] = useState<string>('');
  const [pace, setPace] = useState<string>('');

  // Canonical (metric, unrounded) source of truth — same approach as
  // BMICalculator.tsx: unit toggles re-derive the display from these refs so
  // flipping units back and forth never drifts through rounding.
  const heightCmRef = useRef<number | null>(null);
  const weightKgRef = useRef<number | null>(null);
  const currentKgRef = useRef<number | null>(null);
  const paceKgRef = useRef<number | null>(null);

  const [result, setResult] = useState<ReverseResult | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [paceError, setPaceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [showPaceModal, setShowPaceModal] = useState<boolean>(false);
  const closePaceModal = useCallback(() => setShowPaceModal(false), []);

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

  // The menu stays closed while a download is being prepared (derived, so no effect is needed).
  const menuOpen = downloadMenuOpen && !downloadingFormat;

  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  // Target BMI is always an input; the other field depends on which direction is chosen.
  const needsHeight = mode === 'weight';
  const needsWeight = mode === 'height';
  const targetLimits = getTargetBMILimits(region);

  const isCalculateDisabled = useMemo(() => {
    if (needsHeight) {
      if (unit === 'metric' && !height.trim()) return true;
      if (unit === 'imperial' && (!heightFt.trim() || !heightIn.trim())) return true;
    }
    if (needsWeight && !weight.trim()) return true;
    if (!targetBmi.trim()) return true;
    return false;
  }, [needsHeight, needsWeight, unit, height, heightFt, heightIn, weight, targetBmi]);

  const isClearDisabled = useMemo(
    () => !height && !heightFt && !heightIn && !weight && !targetBmi && !currentWeight && !pace && !result,
    [height, heightFt, heightIn, weight, targetBmi, currentWeight, pace, result]
  );

  const syncHeightCanonicalMetric = (v: string) => {
    const n = parseFloat(v);
    heightCmRef.current = Number.isNaN(n) ? null : n;
  };
  const syncHeightCanonicalImperial = (ftStr: string, inStr: string) => {
    const ft = parseFloat(ftStr);
    const inc = parseFloat(inStr);
    if (Number.isNaN(ft) && Number.isNaN(inc)) { heightCmRef.current = null; return; }
    const totalInches = (Number.isNaN(ft) ? 0 : ft) * 12 + (Number.isNaN(inc) ? 0 : inc);
    heightCmRef.current = totalInches * CM_PER_INCH;
  };
  const syncWeightCanonical = (v: string) => {
    const n = parseFloat(v);
    weightKgRef.current = Number.isNaN(n) ? null : (unit === 'metric' ? n : n / KG_TO_LB);
  };

  const syncCurrentCanonical = (v: string, u: BMIUnit = unit) => {
    const n = parseFloat(v);
    currentKgRef.current = Number.isNaN(n) ? null : (u === 'metric' ? n : n / KG_TO_LB);
  };
  const syncPaceCanonical = (v: string, u: BMIUnit = unit) => {
    const n = parseFloat(v);
    paceKgRef.current = Number.isNaN(n) ? null : (u === 'metric' ? n : n / KG_TO_LB);
  };

  const resetCalculation = () => {
    setResult(null);
    setCurrentError(null);
    setPaceError(null);
    setWeightError(null);
    setHeightError(null);
    setTargetError(null);
    setFormError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setMode('weight');
    setUnit('imperial');
    setRegion('who');
    setHeight('');
    setHeightFt('');
    setHeightIn('');
    setWeight('');
    setTargetBmi('');
    setCurrentWeight('');
    setPace('');
    heightCmRef.current = null;
    weightKgRef.current = null;
    currentKgRef.current = null;
    paceKgRef.current = null;
    resetCalculation();
  };

  // Master unit toggle — converts height and weight together, always from
  // the canonical metric refs (see note above).
  const handleUnitToggle = (newUnit: BMIUnit) => {
    if (newUnit === unit) return;
    resetCalculation();

    if (heightCmRef.current !== null) {
      if (newUnit === 'imperial') {
        const totalInches = heightCmRef.current / CM_PER_INCH;
        let ft = Math.floor(totalInches / 12);
        let inch = Math.round(totalInches % 12);
        if (inch === 12) { inch = 0; ft += 1; }
        setHeightFt(String(ft));
        setHeightIn(String(inch));
      } else {
        setHeight(String(Math.round(heightCmRef.current)));
      }
    }

    if (weightKgRef.current !== null) {
      setWeight(String(newUnit === 'imperial' ? Math.round(weightKgRef.current * KG_TO_LB) : Math.round(weightKgRef.current)));
    }

    if (currentKgRef.current !== null) {
      setCurrentWeight(String(newUnit === 'imperial' ? Math.round(currentKgRef.current * KG_TO_LB) : Math.round(currentKgRef.current)));
    }
    if (paceKgRef.current !== null) {
      setPace(String(newUnit === 'imperial' ? roundTo(paceKgRef.current * KG_TO_LB, 1) : roundTo(paceKgRef.current, 2)));
    }

    setUnit(newUnit);
  };

  const activeHeight = useMemo(() => {
    if (unit === 'metric') return parseFloat(height) || 0;
    return (parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0);
  }, [unit, height, heightFt, heightIn]);

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const isMetric = unit === 'metric';
    const w = parseFloat(weight);
    const h = activeHeight; // cm (metric) or total inches (imperial)
    const t = parseFloat(targetBmi);

    // Limits mirror validateBMIInput (bmiLogic.ts), expressed in each field's displayed unit.
    const L = REVERSE_INPUT_LIMITS[unit];
    let hErr: string | null = null;
    let wErr: string | null = null;
    let tErr: string | null = null;

    if (needsHeight) {
      const lim = L.height;
      const ft = parseFloat(heightFt);
      const inc = parseFloat(heightIn);
      if (!isMetric && (!(ft >= 0) || !(inc >= 0 && inc < 12))) {
        hErr = 'Feet must be 0 or more, and inches between 0-11.';
      } else if (!Number.isFinite(h) || h < lim.min || h > lim.max) {
        hErr = `Height must be between ${lim.min}-${lim.max} ${lim.label}.`;
      }
    }
    if (needsWeight) {
      const lim = L.weight;
      if (!Number.isFinite(w) || w < lim.min || w > lim.max) wErr = `Weight must be between ${lim.min}-${lim.max} ${lim.label}.`;
    }
    if (!Number.isFinite(t) || t < targetLimits.min || t > targetLimits.max) {
      tErr = `Target BMI must be between ${targetLimits.min}-${targetLimits.max}.`;
    }

    // Optional extras: only checked when filled in. Limits are data-entry sanity bounds, not advice.
    let cErr: string | null = null;
    let pErr: string | null = null;
    if (mode === 'weight' && currentWeight.trim()) {
      const c = parseFloat(currentWeight);
      const lim = L.weight;
      if (!Number.isFinite(c) || c < lim.min || c > lim.max) cErr = `Weight must be between ${lim.min}-${lim.max} ${lim.label}.`;
    }
    if (mode === 'weight' && pace.trim()) {
      const pc = parseFloat(pace);
      const lim = L.pace;
      if (!Number.isFinite(pc) || pc < lim.min || pc > lim.max) pErr = `Pace must be between ${lim.min}-${lim.max} ${lim.label} per week.`;
    }

    setHeightError(hErr);
    setWeightError(wErr);
    setTargetError(tErr);
    setCurrentError(cErr);
    setPaceError(pErr);
    setFormError(null);

    if (hErr || wErr || tErr || cErr || pErr) {
      setResult(null);
      return;
    }

    // Solve in the unit the person entered (metric, or the standard 703 imperial form).
    const outcome =
      mode === 'weight'
        ? solveReverseBMI({ mode: 'weight', unit, region, height: h, targetBMI: t })
        : solveReverseBMI({ mode: 'height', unit, region, weight: w, targetBMI: t });

    if (!outcome.ok) {
      setResult(null);
      setFormError('These values give a result outside the supported range. Please try different numbers.');
      return;
    }

    setResult(outcome.result);

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

  const hasError = Boolean(weightError || heightError || targetError || currentError || paceError || formError);
  const currentColors = getCategoryColors(result?.category ?? '');
  const resultText = getResultTextClasses(result?.category ?? '');

  const healthy = useMemo(
    () => (result ? getHealthyWeightRange(result.height, result.unit, result.region) : null),
    [result]
  );
  const tableRows = useMemo(
    () => (result ? getCategoryWeightTable(result.height, result.unit, result.region) : []),
    [result]
  );

  // Live category badge for the slider (shows the band of the BMI currently chosen).
  const targetNum = parseFloat(targetBmi);
  const targetInLimits = Number.isFinite(targetNum) && targetNum >= targetLimits.min && targetNum <= targetLimits.max;
  const liveCategory = targetInLimits ? getCategoryForBMI(targetNum, region) : '';
  const liveColors = getCategoryColors(liveCategory);

  // Current vs target and pace (Target weight mode only). Every input edit clears the
  // result, so these always describe the entries that produced it.
  const currentNum = parseFloat(currentWeight);
  const paceNum = parseFloat(pace);
  const comparison = useMemo(() => {
    if (!result || result.mode !== 'weight' || !currentWeight.trim() || !(currentNum > 0)) return null;
    const diff = getWeightDifference(currentNum, result.weight);
    const weeks = pace.trim() && paceNum > 0 ? getWeeksAtPace(diff.difference, paceNum) : null;
    // BMI at the current weight and the same height: BMI scales linearly with weight.
    const currentBmi = result.weight > 0 ? (result.bmi * currentNum) / result.weight : 0;
    return { diff, weeks, currentBmi, currentCategory: getCategoryForBMI(currentBmi, result.region) };
  }, [result, currentWeight, currentNum, pace, paceNum]);

  const whatIfRows = useMemo(() => {
    if (!result) return [];
    const targets: number[] = [...DEFAULT_WHAT_IF_TARGETS];
    if (!targets.some((t) => Math.abs(t - result.bmi) < 0.005)) targets.push(result.bmi);
    targets.sort((a, b) => a - b);
    return getWhatIfTable(result.height, result.unit, result.region, targets);
  }, [result]);

  // Heaviest what-if scenario: the bars are drawn relative to it.
  const maxWeight = useMemo(() => Math.max(0, ...whatIfRows.map((r) => r.weight)), [whatIfRows]);

  const safetyNotes = useMemo(
    () =>
      result
        ? getSafetyNotes({
            targetBMI: result.bmi,
            region: result.region,
            current: comparison ? currentNum : null,
            target: comparison ? result.weight : null,
          })
        : [],
    [result, comparison, currentNum]
  );

  // Worked examples for the pace guide, in the unit currently selected. Both examples use the same
  // numbers (24 weeks) so the two formulas visibly mirror each other.
  const paceGuide = useMemo(
    () =>
      unit === 'metric'
        ? { diff: '12 kg', pace: '0.5 kg', weeks: '24', loss: '1\u20132 lbs (roughly 0.5\u20131 kg)' }
        : { diff: '24 lbs', pace: '1 lb', weeks: '24', loss: '1\u20132 lbs (roughly 0.5\u20131 kg)' },
    [unit]
  );
  const paceLimit = REVERSE_INPUT_LIMITS[unit].pace;

  const summaryLine = useMemo(() => {
    if (!result) return '';
    const bmiText = result.bmi.toFixed(1);
    if (result.mode === 'weight') return `At ${fmtHeight(result.height, unit)}, a BMI of ${bmiText} works out to ${fmtWeight(result.weight, unit)}.`;
    return `At ${fmtWeight(result.weight, unit)}, a BMI of ${bmiText} works out to a height of ${fmtHeight(result.height, unit)}.`;
  }, [result, unit]);

  // Hero figure split into number + unit so the unit can sit smaller beside it. Imperial heights
  // ("5 ft 10.0 in") have two units, so they stay as one string.
  const heroFigure = useMemo<{ num: string; unit: string }>(() => {
    if (!result) return { num: '', unit: '' };
    if (result.mode === 'height') {
      return unit === 'imperial' ? { num: fmtHeight(result.height, unit), unit: '' } : splitFigure(fmtHeight(result.height, unit));
    }
    return splitFigure(fmtWeight(result.weight, unit));
  }, [result, unit]);

  const report = useMemo<ShareableReport | null>(() => {
    if (!result || !healthy || hasError) return null;

    const u = result.unit;
    const standardName = result.region === 'who' ? 'Global (WHO)' : 'Asia-Pacific';
    const modeName = result.mode === 'weight' ? 'Target Weight' : 'Height Needed';
    const primaryValue = result.mode === 'height' ? fmtHeight(result.height, u) : fmtWeight(result.weight, u);
    const colors = getCategoryColors(result.category);

    const keyRows: Array<{ label: string; value: string }> = [{ label: modeName, value: primaryValue }];
    keyRows.push({ label: 'BMI', value: result.bmi.toFixed(1) });
    keyRows.push({ label: 'Category', value: result.category });
    if (result.mode === 'weight') {
      keyRows.push({
        label: 'In Other Units',
        value: u === 'imperial'
          ? `${fmtStone(result.weight)} \u00b7 ${convertWeight(result.weight, 'imperial', 'metric').toFixed(1)} kg`
          : fmtWeight(convertWeight(result.weight, 'metric', 'imperial'), 'imperial'),
      });
    }
    keyRows.push({
      label: 'Healthy Weight Range',
      value: `${fmtWeight(healthy.weightMin, u).replace(/ (kg|lbs)$/, '')} \u2013 ${fmtWeight(healthy.weightMax, u)}`,
    });
    const sections: ShareableReport['sections'] = [{ heading: 'Key Results', rows: keyRows, variant: 'output' }];

    if (comparison) {
      const sign = signFor(comparison.diff.direction);
      const rows: Array<{ label: string; value: string }> = [
        { label: 'Current Weight', value: fmtWeight(currentNum, u) },
        { label: 'Current BMI', value: `${comparison.currentBmi.toFixed(1)} (${comparison.currentCategory})` },
        { label: 'Change from Current', value: `${sign}${fmtWeight(Math.abs(comparison.diff.difference), u)}` },
        { label: 'Of Current Weight', value: `${sign}${Math.abs(comparison.diff.percent).toFixed(1)}%` },
      ];
      if (comparison.weeks !== null && comparison.diff.direction !== 'same') {
        rows.push({ label: 'Time at Your Pace', value: `${comparison.weeks.toFixed(1)} wks at ${paceNum} ${u === 'metric' ? 'kg' : 'lbs'}/wk` });
      }
      sections.push({ heading: 'Current vs Target', rows, variant: 'output' });
    }

    sections.push({
      heading: 'What If: Weight at Other BMIs',
      rows: whatIfRows.map((row) => ({
        label: `BMI ${row.targetBMI.toFixed(1)} \u00b7 ${row.category}`,
        value: Math.abs(row.targetBMI - result.bmi) < 0.005
          ? `${fmtWeight(row.weight, u)} \u2014 Your Target`
          : fmtWeight(row.weight, u),
      })),
      variant: 'output',
    });

    sections.push({
      heading: `Weight by BMI Category (${result.region === 'who' ? 'WHO' : 'Asia-Pacific'})`,
      rows: tableRows.map((row) => ({
        label: row.category,
        value: row.category === result.category
          ? `${fmtBandRange(row, u, u)} \u2014 Your Target`
          : fmtBandRange(row, u, u),
      })),
      variant: 'output',
    });

    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Calculating', value: modeName },
      { label: 'Standard', value: standardName },
      { label: 'Units', value: u === 'metric' ? 'Metric' : 'Imperial' },
    ];
    if (result.mode !== 'height') inputRows.push({ label: 'Height', value: fmtHeight(result.height, u) });
    if (result.mode !== 'weight') inputRows.push({ label: 'Weight', value: fmtWeight(result.weight, u) });
    inputRows.push({ label: 'Target BMI', value: result.bmi.toFixed(1) });
    if (comparison) {
      inputRows.push({ label: 'Current Weight', value: fmtWeight(currentNum, u) });
      if (comparison.weeks !== null) inputRows.push({ label: 'Weekly Pace', value: `${paceNum} ${u === 'metric' ? 'kg' : 'lbs'}/wk` });
    }
    const noteRows = safetyNotes.map((n) => REPORT_NOTE_ROWS[n.id]).filter(Boolean);
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];
    // Closing card of the PDF; the PNG filter below leaves it out.
    if (noteRows.length) sections.push({ heading: 'Good to Know', rows: noteRows, variant: 'output' });

    // The quick-share PNG keeps the headline figures; the reference tables stay in the PDF.
    const imageSections: ShareableReport['sections'] = sections.filter(
      (sec) => sec.heading === 'Key Results' || sec.heading === 'Current vs Target'
    );

    return {
      title: `Reverse BMI \u00b7 ${modeName}`,
      headlineValue: primaryValue,
      headlineLabel: result.category,
      accentColor: colors.hex,
      meta: [`${standardName} Standard`, u === 'metric' ? 'Metric Units' : 'Imperial Units', `BMI ${result.bmi.toFixed(1)}`],
      sections,
      pdfOnlySections,
      imageSections,
      disclaimer: 'For informational purposes only \u2014 not medical advice.',
      fileNameBase: `reverse-bmi-${result.mode}-${result.bmi.toFixed(1)}`,
    };
  }, [result, healthy, hasError, comparison, currentNum, paceNum, whatIfRows, tableRows, safetyNotes]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

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

  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!report || downloadingFormat !== null}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
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
          className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {menuOpen && (
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
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Quick shareable card</span>
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
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Complete paginated report</span>
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
          title="Share this calculator" aria-label="Share this calculator"
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

  return (
    <div className="space-y-5">
      {/* "How to choose a weekly pace" guide — opened from the button next to the Weekly Pace field.
          Wording adapts to the selected unit. Arithmetic only: the calculator never recommends a pace. */}
      <Modal open={showPaceModal} onClose={closePaceModal} title="How to choose a weekly pace">
        <p className="text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">
          Weekly pace is how much weight you plan to change each week. You choose it; the calculator only does the division.
        </p>

        <div className="mt-3 space-y-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
          <div>
            <p className="text-sm font-extrabold text-neutral-900 dark:text-white">Weeks = difference &divide; pace</p>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:text-neutral-400">
              {paceGuide.diff} &divide; {paceGuide.pace} per week = {paceGuide.weeks} weeks
            </p>
          </div>
          <div className="border-t border-neutral-200 pt-2.5 dark:border-neutral-700">
            <p className="text-sm font-extrabold text-neutral-900 dark:text-white">Pace = difference &divide; weeks available</p>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:text-neutral-400">
              {paceGuide.diff} &divide; {paceGuide.weeks} weeks = {paceGuide.pace} per week
            </p>
          </div>
        </div>

        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">
          <li>For weight loss, the CDC describes about {paceGuide.loss} a week as gradual and steady.</li>
          <li>Progress is uneven, so treat the weeks as a rough guide, not a prediction.</li>
          <li>Age, medicines and health conditions matter. Check with a health professional before choosing a pace.</li>
        </ul>
      </Modal>

      {/* INPUT CARD — same surface, padding and grid as BMICalculator */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">

          {/* Title + master unit toggle — converts height and weight together */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                <SafeIcon icon={FiSliders} className="w-3 h-3" />
                Units
              </span>
              <SegmentedToggle
                groupId="reverse-bmi-unit-system"
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

          <p className="-mt-4 text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Built for adults (20 and over). It does not apply to children or teenagers.
          </p>

          {/* Solve-for + calculation standard (side by side from sm up) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className={fieldLabelRowClass}>
                <span className={fieldLabelClass}>What to Calculate</span>
                <InfoTip
                  widthClass="w-64"
                  text="Choose the value to calculate. Select Weight if you know your height, or Height if you know your weight. You also enter a target BMI."
                />
              </div>
              <SegmentedToggle
                groupId="reverse-bmi-mode"
                ariaLabel="What to Calculate"
                value={mode}
                onChange={(v) => { setMode(v as ReverseMode); resetCalculation(); }}
                options={MODE_OPTIONS}
              />
            </div>

            <div>
              <div className={fieldLabelRowClass}>
                <span className={fieldLabelClass}>Calculation Standard</span>
                <InfoTip
                  widthClass="w-64"
                  text="Asia-Pacific uses lower Overweight/Obese cutoffs, reflecting different metabolic risk in Asian populations."
                />
              </div>
              <SegmentedToggle
                groupId="reverse-bmi-standard"
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

          {/* Measurements — which fields show depends on what you want to find */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Measurements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {needsHeight && (
                <div>
                  <div className={fieldLabelRowClass}>
                    <label htmlFor="reverse-bmi-height-input" className={fieldLabelClass}>Height</label>
                  </div>
                  {unit === 'metric' ? (
                    <NumberField
                      id="reverse-bmi-height-input"
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
                        id="reverse-bmi-height-input"
                        ariaLabel="Height, feet"
                        value={heightFt}
                        onChange={(v) => { setHeightFt(v); syncHeightCanonicalImperial(v, heightIn); resetCalculation(); }}
                        suffix="ft"
                        error={!!heightError}
                        min="1" max="9"
                        placeholder="1-9"
                      />
                      <NumberField
                        ariaLabel="Height, inches"
                        value={heightIn}
                        onChange={(v) => { setHeightIn(v); syncHeightCanonicalImperial(heightFt, v); resetCalculation(); }}
                        suffix="in"
                        error={!!heightError}
                        min="0" max="11"
                        placeholder="0-11"
                      />
                    </div>
                  )}
                  {heightError && <p className="mt-2.5 text-sm font-medium text-red-500">{heightError}</p>}
                </div>
              )}

              {needsWeight && (
                <div>
                  <div className={fieldLabelRowClass}>
                    <label htmlFor="reverse-bmi-weight-input" className={fieldLabelClass}>Weight</label>
                  </div>
                  <NumberField
                    id="reverse-bmi-weight-input"
                    value={weight}
                    onChange={(v) => { setWeight(v); syncWeightCanonical(v); resetCalculation(); }}
                    suffix={unit === 'metric' ? 'kg' : 'lbs'}
                    error={!!weightError}
                    min={unit === 'metric' ? '1' : '2'}
                    max={unit === 'metric' ? '500' : '1100'}
                    placeholder={unit === 'metric' ? '1-500' : '2-1100'}
                  />
                  {weightError && <p className="mt-2.5 text-sm font-medium text-red-500">{weightError}</p>}
                </div>
              )}

            </div>

            {/* TARGET BMI — number box, slider and quick picks stacked together; all set the same value */}
            <div className="mt-6">
              <div className={`${fieldLabelRowClass} !mb-1`}>
                <label htmlFor="reverse-bmi-target-input" className={fieldLabelClass}>Target BMI</label>
                <InfoTip
                  widthClass="w-64"
                  text="The BMI you want to work backwards from. The coloured strip shows the BMI bands for the selected standard. For reference, the normal range starts at 18.5."
                />
              </div>
              <p className="mb-4 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
                Type a value, drag the slider or tap a quick pick. All three set the same Target BMI.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="w-full sm:w-56 flex-shrink-0">
                  <NumberField
                    id="reverse-bmi-target-input"
                    value={targetBmi}
                    onChange={(v) => { setTargetBmi(v); resetCalculation(); }}
                    suffix="kg/m²"
                    error={!!targetError}
                    min={String(targetLimits.min)} max={String(targetLimits.max)}
                    placeholder={`${targetLimits.min}-${targetLimits.max}`}
                  />
                  {targetError && <p className="mt-2.5 text-sm font-medium text-red-500">{targetError}</p>}
                </div>
                <div aria-live="polite" className="min-w-0 sm:min-h-[3.1rem] sm:flex sm:items-center">
                  {targetInLimits ? (
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border bg-gradient-to-br ${liveColors.grad} ${liveColors.text}`}>
                      <span className={`w-2 h-2 rounded-full ${liveColors.bg}`} aria-hidden="true" />
                      {`BMI ${targetNum.toFixed(1)} \u00b7 ${liveCategory}`}
                    </span>
                  ) : (
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Its category will show here.</p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <TargetBmiSlider
                  value={targetInLimits ? targetNum : null}
                  region={region}
                  min={targetLimits.min}
                  max={targetLimits.max}
                  onChange={(v) => { setTargetBmi(v.toFixed(1)); resetCalculation(); }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Quick picks</span>
                <SegmentedToggle
                  groupId="reverse-bmi-presets"
                  size="sm"
                  ariaLabel="Quick target BMI picks"
                  value={DEFAULT_WHAT_IF_TARGETS.map(String).find((t) => targetInLimits && parseFloat(t) === targetNum) ?? ''}
                  onChange={(v) => { setTargetBmi(v); resetCalculation(); }}
                  options={DEFAULT_WHAT_IF_TARGETS.map((t) => ({ value: String(t), label: String(t) }))}
                />
              </div>
            </div>
            {formError && <p className="mt-4 text-sm font-medium text-red-500">{formError}</p>}
          </div>

          {/* Optional: current weight and a pace the person chooses (Target weight mode) */}
          {mode === 'weight' && (
            <div className="pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-1.5 mb-4">
                <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
                  Current Body Measurements <span className="text-xs font-normal">(optional)</span>
                </h4>
                <InfoTip
                  widthClass="w-64"
                  text="Optional. Add your current weight to see the difference from your target, and a weekly pace to see the weeks it takes."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className={`${fieldLabelRowClass} min-h-7`}>
                    <label htmlFor="reverse-bmi-current-input" className={fieldLabelClass}>Current Weight<span className="sr-only"> (optional)</span></label>
                  </div>
                  <NumberField
                    id="reverse-bmi-current-input"
                    value={currentWeight}
                    onChange={(v) => { setCurrentWeight(v); syncCurrentCanonical(v); resetCalculation(); }}
                    suffix={unit === 'metric' ? 'kg' : 'lbs'}
                    error={!!currentError}
                    min={unit === 'metric' ? '1' : '2'}
                    max={unit === 'metric' ? '500' : '1100'}
                    placeholder={unit === 'metric' ? '1-500' : '2-1100'}
                  />
                  {currentError && <p className="mt-2.5 text-sm font-medium text-red-500">{currentError}</p>}
                </div>
                <div>
                  <div className={`${fieldLabelRowClass} min-h-7 flex-wrap gap-y-1`}>
                    <label htmlFor="reverse-bmi-pace-input" className={fieldLabelClass}>Weekly Pace<span className="sr-only"> (optional)</span></label>
                    <InfoTip
                      widthClass="w-64"
                      text="You choose the pace. The calculator only divides the difference by it. It does not suggest a pace or predict what will happen."
                    />
                    <button
                      type="button"
                      onClick={() => setShowPaceModal(true)}
                      aria-haspopup="dialog"
                      className="inline-flex items-center gap-1 whitespace-nowrap pl-2 pr-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-600 bg-transparent text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors cursor-pointer"
                    >
                      <SafeIcon icon={FiMaximize2} className="w-3 h-3" />
                      How to calculate
                    </button>
                  </div>
                  <NumberField
                    id="reverse-bmi-pace-input"
                    value={pace}
                    onChange={(v) => { setPace(v); syncPaceCanonical(v); resetCalculation(); }}
                    suffix={unit === 'metric' ? 'kg/wk' : 'lbs/wk'}
                    error={!!paceError}
                    min={String(paceLimit.min)}
                    max={String(paceLimit.max)}
                    placeholder={`${paceLimit.min}-${paceLimit.max}`}
                  />
                  {paceError && <p className="mt-2.5 text-sm font-medium text-red-500">{paceError}</p>}
                  {!paceError && pace.trim() && !currentWeight.trim() && (
                    <p className="mt-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">Add your current weight to see the time at this pace.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Action Buttons — classes copied from BirthdayCalculator / BMICalculator */}
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
      {!result && !hasError && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20"
        >
          <SafeIcon icon={FiTarget} className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Choose what you want to find, fill in the fields above, then press Calculate to see your results.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {result && healthy && !hasError && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-5"
        >
          {/* RESULT HEADER ROW — same layout as BMICalculator: title + Download menu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your Reverse BMI Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          <ResultCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-base font-extrabold leading-7 text-neutral-900 dark:text-white">
                {result.mode === 'weight' ? 'Target Weight' : 'Height Needed'}
              </h4>
              <span className="rounded-lg border border-neutral-200 bg-white/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
                {region === 'who' ? 'WHO Standard' : 'Asia-Pacific Standard'}
              </span>
            </div>

            <div className="mt-6 text-center">
              <p className={`flex items-baseline justify-center gap-[0.3em] whitespace-nowrap text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight leading-none ${resultText.hero}`}>
                {heroFigure.unit ? (
                  <>
                    <span>{heroFigure.num}</span>
                    <span className="text-[0.5em] font-bold tracking-normal">{heroFigure.unit}</span>
                  </>
                ) : (
                  heroFigure.num
                )}
              </p>
              <p className={`mt-3 text-sm font-bold uppercase tracking-[0.18em] ${resultText.label}`}>{result.category}</p>
              <p className="mt-3 text-sm font-medium text-neutral-500 dark:text-neutral-400">{summaryLine}</p>
              {result.mode === 'weight' && (
                <p className="mt-1 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {unit === 'imperial'
                    ? `${fmtStone(result.weight)} \u00b7 ${convertWeight(result.weight, 'imperial', 'metric').toFixed(1)} kg`
                    : fmtWeight(convertWeight(result.weight, 'metric', 'imperial'), 'imperial')}
                </p>
              )}
            </div>

            <BmiScale
              bmi={result.bmi}
              region={region}
              min={targetLimits.min}
              max={targetLimits.max}
              hex={currentColors.hex}
              category={result.category}
            />

            <dl className="mt-6 grid grid-cols-1 divide-y divide-neutral-200/80 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/60 dark:divide-neutral-700/60 dark:border-neutral-700/60 dark:bg-neutral-900/30 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">BMI</dt>
                <dd className="mt-2 whitespace-nowrap text-lg font-extrabold leading-none tabular-nums text-neutral-900 dark:text-white sm:text-xl">{result.bmi.toFixed(1)}</dd>
                <dd className="mt-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Target BMI (kg/m&sup2;)</dd>
              </div>
              <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Healthy weight range</dt>
                <dd className="mt-2 whitespace-nowrap text-lg font-extrabold leading-none tabular-nums text-neutral-900 dark:text-white sm:text-xl">
                  {`${fmtWeight(healthy.weightMin, unit).replace(/ (kg|lbs)$/, '')} \u2013 ${fmtWeight(healthy.weightMax, unit)}`}
                </dd>
                <dd className="mt-2 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {`BMI ${healthy.bmiMin}\u2013${healthy.bmiMax} \u00b7 ${region === 'who' ? 'WHO' : 'Asia-Pacific'}`}
                </dd>
              </div>
            </dl>
          </ResultCard>

          {comparison && result && (
            <ResultCard>
              <SectionHeader
                icon={FiActivity}
                title="Current vs Target"
                subtitle={`Current weight ${fmtWeight(currentNum, unit)} \u00b7 BMI ${comparison.currentBmi.toFixed(1)} \u00b7 ${comparison.currentCategory}`}
              />
              <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${comparison.weeks !== null && comparison.diff.direction !== 'same' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <StatTile
                  tone="indigo"
                  icon={comparison.diff.direction === 'higher' ? FiArrowUp : comparison.diff.direction === 'lower' ? FiArrowDown : FiCheck}
                  value={`${signFor(comparison.diff.direction)}${fmtWeight(Math.abs(comparison.diff.difference), unit)}`}
                  label="Change from current"
                  sub={comparison.diff.direction === 'lower' ? 'Target is lower' : comparison.diff.direction === 'higher' ? 'Target is higher' : 'Already at target'}
                  maxRem={1.75}
                />
                <StatTile
                  tone="teal"
                  icon={FiPercent}
                  value={`${signFor(comparison.diff.direction)}${Math.abs(comparison.diff.percent).toFixed(1)}%`}
                  label="Of current weight"
                  sub={`${fmtWeight(currentNum, unit)} \u2192 ${fmtWeight(result.weight, unit)}`}
                  delay={0.08}
                  maxRem={1.75}
                />
                {comparison.weeks !== null && comparison.diff.direction !== 'same' && (
                  <StatTile
                    tone="gold"
                    icon={FiClock}
                    value={`${comparison.weeks.toFixed(1)} wks`}
                    label="Time at your pace"
                    sub={`at ${paceNum} ${unit === 'metric' ? 'kg' : 'lbs'} per week`}
                    delay={0.16}
                    maxRem={1.75}
                  />
                )}
              </div>
              {comparison.weeks !== null && comparison.diff.direction !== 'same' && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-neutral-100/70 px-3 py-2.5 text-xs font-medium leading-relaxed text-neutral-600 dark:bg-white/[0.04] dark:text-neutral-400">
                  <SafeIcon icon={FiInfo} className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
                  <span>Time is the difference divided by the pace you chose. It is simple arithmetic, not a recommended pace or a prediction.</span>
                </p>
              )}
            </ResultCard>
          )}

          <ResultCard>
            <SectionHeader
              icon={FiBarChart2}
              title="Weight by BMI Category"
              subtitle={`Weight ranges at ${fmtHeight(result.height, unit)} for the ${region === 'who' ? 'Global (WHO)' : 'Asia-Pacific'} standard.`}
            />
            <div>
              {tableRows.map((row, i) => {
                const isActive = (r: typeof row) => r.category === result.category;
                return (
                  <HighlightRow
                    key={row.category}
                    category={row.category}
                    active={isActive(row)}
                    showDivider={i > 0 && !isActive(row) && !isActive(tableRows[i - 1])}
                    title={row.category}
                    subtitle={`BMI ${row.label}`}
                    primary={fmtBandRange(row, unit, unit)}
                    secondary={fmtBandRange(row, unit, unit === 'metric' ? 'imperial' : 'metric')}
                  />
                );
              })}
            </div>
          </ResultCard>

          <ResultCard>
            <SectionHeader
              icon={FiSliders}
              title="What If: Weight at Other BMIs"
              subtitle={`Weights at ${fmtHeight(result.height, unit)} for several BMI values, side by side.`}
            />
            <ul className="mt-1">
              {whatIfRows.map((row) => {
                const altUnit: BMIUnit = unit === 'metric' ? 'imperial' : 'metric';
                const active = Math.abs(row.targetBMI - result.bmi) < 0.005;
                const diff = row.weight - result.weight;
                const direction: 'up' | 'down' | 'same' = active ? 'same' : diff > 0 ? 'up' : 'down';
                const delta = active ? 'Matches your result' : `${fmtWeight(Math.abs(diff), unit)} vs target`;
                return (
                  <WhatIfRow
                    key={row.targetBMI}
                    bmi={row.targetBMI}
                    category={row.category}
                    active={active}
                    primary={fmtWeight(row.weight, unit)}
                    secondary={fmtWeight(convertWeight(row.weight, unit, altUnit), altUnit)}
                    barPercent={maxWeight > 0 ? (row.weight / maxWeight) * 100 : 0}
                    delta={delta}
                    direction={direction}
                  />
                );
              })}
            </ul>
          </ResultCard>

          <ResultCard>
            <SectionHeader icon={FiInfo} title="Good to Know" />
            <div className="space-y-3">
              {safetyNotes.map((note) => (
                <div
                  key={note.id}
                  role="note"
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-sm font-medium leading-relaxed ${
                    note.tone === 'caution'
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'
                      : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <SafeIcon
                    icon={note.tone === 'caution' ? FiAlertTriangle : FiInfo}
                    className={`mt-0.5 w-4 h-4 flex-shrink-0 ${note.tone === 'caution' ? 'text-amber-500 dark:text-amber-400' : 'text-neutral-400 dark:text-neutral-500'}`}
                  />
                  <p>{note.text}</p>
                </div>
              ))}
            </div>
          </ResultCard>
        </motion.div>
      )}

      {renderShareBar()}

      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This tool rearranges the BMI formula for adults and is meant as a reference point, not medical advice. BMI is a screening measure: it cannot see muscle, age or body composition, so a number here is not a health goal on its own. Please speak with a healthcare professional before changing your eating or activity habits.
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
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                {REVERSE_BMI_SOURCES.length} references
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
              {REVERSE_BMI_SOURCES.map((source, i) => (
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
            <p className="pt-4 mt-4 border-t border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Not drawn from any source above: the input limits on this form (sanity bounds for data entry, not clinical cut-offs), the example targets in the what-if table, and the caution shown for a change of more than 20% of current weight. These are our own design choices and make no medical claim.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReverseBMICalculator;
