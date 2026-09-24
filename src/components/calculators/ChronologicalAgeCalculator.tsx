"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence, animate, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import DateTimePicker from '@/components/common/DateTimePicker';
import * as FiIcons from 'react-icons/fi';
import {
  calculateAge,
  validateDateInput,
  getNextBirthday,
  getMilestoneBirthdays,
  getNextMilestone,
  getDayCountMilestones,
  calculatePetYears,
  getLifetimeEstimates,
  getBirthdayWeekdayTally,
  getNextSameWeekdayBirthdayYear,
  isFeb29Birthday,
  isLeapYear,
  formatWithCommas,
  DATE_SOURCES,
} from '@/utils/calculators/dateLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiCalendar, FiClock, FiGift, FiTrendingUp, FiAlertCircle, FiInfo, FiHeart, FiArrowDown,
  FiFileText, FiLoader, FiRotateCcw, FiCheckCircle, FiExternalLink, FiStar, FiActivity,
  FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown, FiDownload, FiAward, FiWind,
  FiMoon, FiImage, FiSun, FiZap, FiTarget, FiBarChart2,
} = FiIcons;

interface ChronologicalAgeCalculatorProps {
  onCalculationComplete?: () => void;
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- SHARED ACCENT SYSTEM ---
// Age doesn't have a "category" the way BMI/Body Fat do, so a single
// premium accent (violet, distinct from BMI's category-driven palette and
// BMR's amber/orange) carries the identity instead — still expressed
// through the same text/bg/border/grad/hex token shape as
// getCategoryColors in the other calculators, so every shared component
// that expects that shape keeps working unmodified.
const ACCENT = {
  text: 'text-violet-600 dark:text-violet-400',
  bg: 'bg-violet-500',
  grad: 'from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 border-violet-200 dark:border-violet-800',
  border: 'border-violet-500 dark:border-violet-400',
  bgLight: 'bg-violet-50 dark:bg-violet-900/20',
  shadow: 'shadow-violet-500/10',
  hex: '#7c3aed',
};

// --- DAY-COUNT MILESTONE PALETTE ---
// Each Day-Count Milestone node gets its own color, cycled by index, so the
// trail reads as a string of distinct "collected" jewels rather than one
// flat hue. Full literal Tailwind class strings only (never built with
// template interpolation) so nothing is purged from the production build.
// hexFrom/hexTo feed the SVG trail's per-segment <linearGradient> (SVG
// "currentColor"/stroke can't read Tailwind classes, so the same two
// stops are also expressed as raw hex here).
interface MilestoneColor {
  hexFrom: string;
  hexTo: string;
  grad: string;
  border: string;
  text: string;
  shadow: string;
  chip: string;
  pulse: string;
  pulseFade: string;
}
const MILESTONE_PALETTE: MilestoneColor[] = [
  {
    hexFrom: '#2dd4bf', hexTo: '#0891b2',
    grad: 'from-teal-400 to-cyan-600',
    border: 'border-teal-400 dark:border-teal-500',
    text: 'text-teal-500 dark:text-teal-400',
    shadow: 'shadow-teal-500/30',
    chip: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200/70 dark:border-teal-800/50',
    pulse: 'rgba(20,184,166,0.35)', pulseFade: 'rgba(20,184,166,0)',
  },
  {
    hexFrom: '#818cf8', hexTo: '#4f46e5',
    grad: 'from-indigo-400 to-indigo-600',
    border: 'border-indigo-400 dark:border-indigo-500',
    text: 'text-indigo-500 dark:text-indigo-400',
    shadow: 'shadow-indigo-500/30',
    chip: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/50',
    pulse: 'rgba(99,102,241,0.35)', pulseFade: 'rgba(99,102,241,0)',
  },
  {
    hexFrom: '#fcd34d', hexTo: '#d97706',
    grad: 'from-amber-300 to-amber-600',
    border: 'border-amber-400 dark:border-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    shadow: 'shadow-amber-500/30',
    chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50',
    pulse: 'rgba(217,119,6,0.35)', pulseFade: 'rgba(217,119,6,0)',
  },
  {
    hexFrom: '#fb7185', hexTo: '#e11d48',
    grad: 'from-rose-400 to-rose-600',
    border: 'border-rose-400 dark:border-rose-500',
    text: 'text-rose-500 dark:text-rose-400',
    shadow: 'shadow-rose-500/30',
    chip: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/50',
    pulse: 'rgba(225,29,72,0.35)', pulseFade: 'rgba(225,29,72,0)',
  },
  {
    hexFrom: '#a78bfa', hexTo: '#7c3aed',
    grad: 'from-violet-400 to-violet-600',
    border: 'border-violet-400 dark:border-violet-500',
    text: 'text-violet-500 dark:text-violet-400',
    shadow: 'shadow-violet-500/30',
    chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200/70 dark:border-violet-800/50',
    pulse: 'rgba(124,58,237,0.35)', pulseFade: 'rgba(124,58,237,0)',
  },
  {
    hexFrom: '#34d399', hexTo: '#059669',
    grad: 'from-emerald-400 to-emerald-600',
    border: 'border-emerald-400 dark:border-emerald-500',
    text: 'text-emerald-500 dark:text-emerald-400',
    shadow: 'shadow-emerald-500/30',
    chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/50',
    pulse: 'rgba(5,150,105,0.35)', pulseFade: 'rgba(5,150,105,0)',
  },
  {
    hexFrom: '#38bdf8', hexTo: '#0284c7',
    grad: 'from-sky-400 to-sky-600',
    border: 'border-sky-400 dark:border-sky-500',
    text: 'text-sky-500 dark:text-sky-400',
    shadow: 'shadow-sky-500/30',
    chip: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-800/50',
    pulse: 'rgba(2,132,199,0.35)', pulseFade: 'rgba(2,132,199,0)',
  },
];

const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";

// --- ACCESSIBLE INFO TOOLTIP --- (identical contract to BMICalculator.tsx's InfoTip)
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
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
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

// --- SEGMENTED TOGGLE --- (identical contract to BMICalculator.tsx's SegmentedToggle)
interface SegmentedToggleOption<T extends string> { value: T; label: string; }
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
      className={`relative inline-flex bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-700/50 rounded-full ${isSm ? 'p-1' : 'flex w-full p-1.5'}`}
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

// --- PREMIUM RESULT ILLUSTRATIONS ---
// Two inline-SVG graphics for the headline result: a tiered "cake" that
// carries the years/months/days breakdown ON its tiers, and a sunburst
// medallion (echoing the day-of-week fact). Both are original geometry —
// hand-authored paths/gradients in this file, not traced from or a
// reproduction of any third-party image, icon set, or stock asset — using
// the app's own violet/indigo/amber palette.
//
// The SVGs never bake in text. The cake's figures are real HTML laid over
// the tiers (see AgeCake), so they stay crisp and theme-aware,
// while the SVG itself remains purely decorative (aria-hidden). Gradient
// ids are suffixed with useId() so multiple instances of this calculator
// on one page never clash over <defs> ids.

// Rounded-top / flat-or-rounded-bottom rectangle path. Upper tiers use a
// flat bottom (rb = 0) so they sit flush on the tier below with no
// background notch at the corners, which a plain rounded <rect> leaves.
const tierPath = (x: number, y: number, w: number, h: number, rt: number, rb: number): string =>
  `M${x + rt},${y} H${x + w - rt} Q${x + w},${y} ${x + w},${y + rt} ` +
  `V${y + h - rb} Q${x + w},${y + h} ${x + w - rb},${y + h} ` +
  `H${x + rb} Q${x},${y + h} ${x},${y + h - rb} ` +
  `V${y + rt} Q${x},${y} ${x + rt},${y} Z`;

// Cake geometry, in viewBox units (320 x 258). Tiers are wide and shallow
// on purpose: each one has to hold a full "41 YEARS" style label at a
// legible size, so the taper is gentle (288 → 216 → 144 wide) rather than
// the old steep wedding-cake stack that left the Days tier ~48px wide.
const CAKE_VB = { w: 320, h: 258 } as const;
const CAKE_TIERS = {
  years:  { x: 16, y: 176, w: 288, h: 58 },
  months: { x: 52, y: 122, w: 216, h: 54 },
  days:   { x: 88, y: 72,  w: 144, h: 50 },
} as const;

interface AgeCakeProps {
  years: number;
  months: number;
  days: number;
}

const plural = (n: number, singular: string, pluralForm: string): string => (n === 1 ? singular : pluralForm);

// Shared easing for every entrance in the headline: fast start, long soft
// landing — reads as "settling into place" rather than mechanical.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Spring for the pointer-driven cake tilt: soft and slightly damped so it
// follows the cursor with a little weight instead of snapping to it.
const TILT_SPRING = { stiffness: 140, damping: 16, mass: 0.6 };

// One-shot confetti burst fired from the candle the first time the cake
// appears. Deterministic (no Math.random) so it looks identical every
// time and is safe for SSR/hydration. Colors come from the app palette.
const CONFETTI_COLORS = ['#f59e0b', '#8b5cf6', '#6366f1', '#fb7185', '#2dd4bf'];
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.3;
  const dist = 62 + (i % 3) * 20;
  return {
    id: i,
    dx: Math.cos(angle) * dist * 1.15,
    dy: Math.sin(angle) * dist * 0.75 - 26,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 2.6 + (i % 3) * 0.9,
    round: i % 2 === 0,
    spin: (i % 2 ? 1 : -1) * (120 + i * 18),
  };
});

// Counts a number up from 0 (first render) or from its previous value
// (later changes, e.g. the day rolling over at midnight). The final value
// is rendered invisibly underneath so the box is already its full width
// from the first frame — no label jitter while the digits climb. With
// reduced motion it simply shows the value.
const CountUp: React.FC<{ value: number; duration?: number; delay?: number }> = ({ value, duration = 1.1, delay = 0 }) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduced ? value : 0);
  const fromRef = useRef<number>(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
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
      <span className="invisible">{value}</span>
      <span className="absolute inset-0 text-right">{display}</span>
    </span>
  );
};

// Big comma-grouped number whose LAST digit rolls up into place each time
// it changes — the seconds counter feels like a live odometer instead of a
// number silently swapping. Only the last digit is animated, so the rest
// stays perfectly still and the row never reflows (tabular-nums).
const TickingNumber: React.FC<{ value: number }> = ({ value }) => {
  const reduced = useReducedMotion();
  const text = formatWithCommas(value);
  const head = text.slice(0, -1);
  const last = text.slice(-1);
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span>{head}</span>
      <span className="inline-block overflow-hidden h-[1.25em] leading-[1.25em] align-bottom">
        <motion.span
          key={value}
          className="inline-block"
          initial={reduced ? false : { y: '70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          {last}
        </motion.span>
      </span>
    </span>
  );
};

const AgeCake: React.FC<AgeCakeProps> = ({ years, months, days }) => {
  const uid = useId();
  const gGold = `cake-gold-${uid}`;
  const gIndigo = `cake-indigo-${uid}`;
  const gViolet = `cake-violet-${uid}`;
  const gFlame = `cake-flame-${uid}`;
  const gGlow = `cake-glow-${uid}`;
  const gSheen = `cake-sheen-${uid}`;
  const clipId = `cake-clip-${uid}`;
  const prefersReducedMotion = useReducedMotion();

  const T = CAKE_TIERS;
  const pct = (yUnits: number) => `${(yUnits / CAKE_VB.h) * 100}%`;

  // Pointer tilt (mouse only): the whole cake leans a few degrees toward
  // the cursor, with springs for weight. Touch and reduced-motion users
  // get a still cake.
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const rotateY = useSpring(useTransform(nx, [-0.5, 0.5], [-8, 8]), TILT_SPRING);
  const rotateX = useSpring(useTransform(ny, [-0.5, 0.5], [6, -6]), TILT_SPRING);
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    nx.set((e.clientX - r.left) / r.width - 0.5);
    ny.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handlePointerLeave = () => {
    nx.set(0);
    ny.set(0);
  };

  // Entrance choreography: tiers rise into place bottom → top, then the
  // candle drops in and its flame lights, then the confetti fires. Reduced
  // motion renders everything already in place.
  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE_OUT },
        };

  // Label rows, top of cake to bottom. `dark` flips the text to deep amber
  // on the gold tier, because white on light gold fails contrast — the
  // violet and indigo tiers keep white text (with a soft shadow).
  // Vertical centre is nudged +2 units below the tier's geometric middle
  // to account for the highlight strip along its top edge. `delay` matches
  // the tier's own entrance; `countDelay` starts the count-up just after.
  const labels = [
    { key: 'days',   value: days,   unit: plural(days, 'day', 'days'),       y: T.days.y + T.days.h / 2 + 2,     dark: true,  num: 9,    lab: 3.9, delay: 0.46, countDelay: 0.7 },
    { key: 'months', value: months, unit: plural(months, 'month', 'months'), y: T.months.y + T.months.h / 2 + 2, dark: false, num: 9.6,  lab: 4,   delay: 0.28, countDelay: 0.55 },
    { key: 'years',  value: years,  unit: plural(years, 'year', 'years'),    y: T.years.y + T.years.h / 2 + 2,   dark: false, num: 10.4, lab: 4.2, delay: 0.1,  countDelay: 0.4 },
  ];

  return (
    // container-type lets the label text scale in `cqw` (1% of THIS box's
    // width), so numbers and unit words grow and shrink in lock-step with
    // the cake at any screen width instead of needing per-breakpoint sizes.
    <div
      className="relative w-full max-w-[264px] mx-auto"
      style={{ containerType: 'inline-size' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* soft violet pool of light under the plate, so the cake reads as
          resting on a lit surface rather than floating */}
      <div className="pointer-events-none absolute left-[8%] right-[8%] bottom-[1%] h-[7%] rounded-full bg-violet-500/30 dark:bg-violet-400/20 blur-xl" aria-hidden="true" />

      <motion.div style={{ rotateX, rotateY, transformPerspective: 800 }}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${CAKE_VB.w} ${CAKE_VB.h}`}
          className="block w-full h-auto overflow-visible drop-shadow-md"
        >
          <defs>
            <linearGradient id={gGold} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            {/* Indigo/violet stops are a touch deeper so the white labels
                sit on a darker field and read more clearly. */}
            <linearGradient id={gIndigo} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4338ca" />
            </linearGradient>
            <linearGradient id={gViolet} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6d28d9" />
            </linearGradient>
            <radialGradient id={gFlame} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="55%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#ea580c" />
            </radialGradient>
            <radialGradient id={gGlow} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
            {/* light band for the periodic "sheen" sweep across the tiers */}
            <linearGradient id={gSheen} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            {/* the sheen is clipped to the exact tier silhouettes */}
            <clipPath id={clipId}>
              <path d={tierPath(T.years.x, T.years.y, T.years.w, T.years.h, 12, 18)} />
              <path d={tierPath(T.months.x, T.months.y, T.months.w, T.months.h, 12, 0)} />
              <path d={tierPath(T.days.x, T.days.y, T.days.w, T.days.h, 14, 0)} />
            </clipPath>
          </defs>

          {/* contact shadow + serving plate */}
          <ellipse cx="160" cy="249" rx="124" ry="6" fill="#000000" opacity="0.08" />
          <rect x="8" y="228" width="304" height="10" rx="5" fill="#a3a3a3" opacity="0.55" />

          {/* Years — bottom tier */}
          <motion.g {...rise(0.1)}>
            <path d={tierPath(T.years.x, T.years.y, T.years.w, T.years.h, 12, 18)} fill={`url(#${gViolet})`} />
            <path d={tierPath(T.years.x, T.years.y, T.years.w, 9, 12, 0)} fill="#ffffff" opacity="0.2" />
            <circle cx="36" cy="207" r="3" fill="#ffffff" opacity="0.55" />
            <circle cx="284" cy="207" r="3" fill="#ffffff" opacity="0.55" />
          </motion.g>

          {/* Months — middle tier */}
          <motion.g {...rise(0.28)}>
            <path d={tierPath(T.months.x, T.months.y, T.months.w, T.months.h, 12, 0)} fill={`url(#${gIndigo})`} />
            <path d={tierPath(T.months.x, T.months.y, T.months.w, 9, 12, 0)} fill="#ffffff" opacity="0.2" />
            <circle cx="70" cy="151" r="3" fill="#ffffff" opacity="0.55" />
            <circle cx="250" cy="151" r="3" fill="#ffffff" opacity="0.55" />
          </motion.g>

          {/* Days — top tier */}
          <motion.g {...rise(0.46)}>
            <path d={tierPath(T.days.x, T.days.y, T.days.w, T.days.h, 14, 0)} fill={`url(#${gGold})`} />
            <path d={tierPath(T.days.x, T.days.y, T.days.w, 7, 14, 0)} fill="#ffffff" opacity="0.28" />
            <circle cx="104" cy="99" r="2.5" fill="#ffffff" opacity="0.6" />
            <circle cx="216" cy="99" r="2.5" fill="#ffffff" opacity="0.6" />
          </motion.g>

          {/* Sheen: a soft diagonal band of light glides across the
              tiers every several seconds — a "catching the light" cue.
              Starts after the entrance has finished. */}
          {!prefersReducedMotion && (
            <g clipPath={`url(#${clipId})`}>
              <motion.rect
                x={0} y={60} width={70} height={190}
                fill={`url(#${gSheen})`}
                style={{ skewX: -18 }}
                initial={{ x: -140 }}
                animate={{ x: 380 }}
                transition={{ duration: 1.7, delay: 2, repeat: Infinity, repeatDelay: 7, ease: 'easeInOut' }}
              />
            </g>
          )}

          {/* Candle + flame, added last so the cake "lights up" after it
              has been built. */}
          <motion.g
            initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7, ease: EASE_OUT }}
          >
            <rect x="156" y="42" width="8" height="34" rx="3" fill="#f5f5f4" />
            <rect x="156" y="42" width="8" height="34" rx="3" fill={`url(#${gGold})`} opacity="0.35" />
          </motion.g>
          <motion.g
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.95 }}
          >
            {/* Soft ambient glow behind the flame, breathing slowly — a
                light-source cue kept separate from the flame's own flicker
                so the two motions don't read as one mechanical pulse. */}
            <motion.circle
              cx="160" cy="30" r="22"
              fill={`url(#${gGlow})`}
              animate={prefersReducedMotion ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.12, 1] }}
              transition={prefersReducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '160px 30px' }}
            />
            {/* Flame flickers with a small irregular wobble, anchored at its
                base (160,44) so it sways like a real flame instead of drifting. */}
            <motion.path
              d="M160,18 C153,28 151,36 160,44 C169,36 167,28 160,18 Z"
              fill={`url(#${gFlame})`}
              animate={prefersReducedMotion ? undefined : { scaleY: [1, 1.08, 0.95, 1.05, 1], scaleX: [1, 0.95, 1.05, 0.97, 1], rotate: [0, -3, 2, -2, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: '160px 44px' }}
            />
          </motion.g>

          {/* One-shot confetti burst from the flame (the svg is
              overflow-visible so pieces can fly past the cake's edge). */}
          {!prefersReducedMotion && (
            <g transform="translate(160 32)">
              {CONFETTI.map((c) => (
                <motion.g
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{
                    x: [0, c.dx, c.dx * 1.08],
                    y: [0, c.dy, c.dy + 34],
                    opacity: [0, 1, 0],
                    scale: [0.4, 1, 0.8],
                    rotate: [0, c.spin / 2, c.spin],
                  }}
                  transition={{ duration: 1.7, delay: 1.05 + c.id * 0.02, ease: 'easeOut', times: [0, 0.5, 1] }}
                >
                  {c.round ? (
                    <circle r={c.size} fill={c.color} />
                  ) : (
                    <rect x={-c.size} y={-c.size / 2} width={c.size * 2} height={c.size} rx={0.8} fill={c.color} />
                  )}
                </motion.g>
              ))}
            </g>
          )}
        </svg>

        {/* Tier labels — real HTML, absolutely centred on each tier. Each
            reads as "<number> <FULL WORD>" (e.g. "41 YEARS"), not an
            abbreviation, so no legend is needed. The outer div does the
            positioning (Tailwind translate); the inner motion.div does
            the fade/rise, so the two transforms never fight. */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {labels.map((l) => (
            <div
              key={l.key}
              className="absolute left-0 right-0 -translate-y-1/2 flex justify-center"
              style={{ top: pct(l.y) }}
            >
              <motion.div
                className="flex items-baseline whitespace-nowrap"
                style={{ gap: '1.8cqw' }}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: l.delay, ease: EASE_OUT }}
              >
                <span
                  className={`font-extrabold tabular-nums leading-none ${l.dark ? 'text-amber-950' : 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]'}`}
                  style={{ fontSize: `${l.num}cqw` }}
                >
                  <CountUp value={l.value} delay={l.countDelay} />
                </span>
                <span
                  className={`font-bold uppercase leading-none tracking-[0.12em] ${l.dark ? 'text-amber-900' : 'text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]'}`}
                  style={{ fontSize: `${l.lab}cqw` }}
                >
                  {l.unit}
                </span>
              </motion.div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* The visual labels are aria-hidden, so give assistive tech the
          whole age as one natural sentence. */}
      <span className="sr-only">
        {years} {plural(years, 'year', 'years')}, {months} {plural(months, 'month', 'months')}, {days} {plural(days, 'day', 'days')}
      </span>
    </div>
  );
};

const SunburstMedallion: React.FC<{ size?: number; className?: string }> = ({ size = 148, className = '' }) => {
  const uid = useId();
  const gCenter = `med-center-${uid}`;
  const gRayViolet = `med-ray-violet-${uid}`;
  const gRayIndigo = `med-ray-indigo-${uid}`;
  const gRayGold = `med-ray-gold-${uid}`;
  const rayGradients = [gRayViolet, gRayIndigo, gRayGold];
  const longPetalPath = 'M120,120 C132,78 130,36 120,14 C110,36 108,78 120,120 Z';
  const shortPetalPath = 'M120,120 C132,84 130,50 120,30 C110,50 108,84 120,120 Z';
  const sparkColors = ['#f59e0b', '#7c3aed', '#4f46e5'];
  const prefersReducedMotion = useReducedMotion();

  return (
    <svg aria-hidden="true" viewBox="0 0 240 240" width={size} height={size} className={`flex-shrink-0 drop-shadow-sm ${className}`}>
      <defs>
        <radialGradient id={gCenter} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <linearGradient id={gRayViolet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={gRayIndigo} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id={gRayGold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Petals + sparkles share one slow-spinning group so the whole
          "flower" turns as a single unit — a very long, gentle rotation
          (not a spin animation) so it reads as alive rather than a
          loading spinner. The center medallion is drawn separately,
          outside this group, so the calendar glyph and day-of-week stay
          upright and legible at all times. */}
      <motion.g
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={prefersReducedMotion ? undefined : { duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '120px 120px' }}
      >
        {/* 8 alternating long/short petals, 45° apart */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 120 120)`}>
            <path d={i % 2 === 0 ? longPetalPath : shortPetalPath} fill={`url(#${rayGradients[i % 3]})`} />
          </g>
        ))}

        {/* interleaved sparkle dots — each twinkles on its own staggered
            timer, independent of the group's rotation, for a subtle
            "catching the light" effect rather than a uniform blink. */}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg, i) => (
          <g key={deg} transform={`rotate(${deg} 120 120)`}>
            <motion.circle
              cx="120"
              cy={i % 2 === 0 ? 52 : 58}
              r={i % 2 === 0 ? 5 : 4}
              fill={sparkColors[i % 3]}
              animate={prefersReducedMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.85, 1.1, 0.85] }}
              transition={prefersReducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.22 }}
              style={{ transformOrigin: `120px ${i % 2 === 0 ? 52 : 58}px` }}
            />
          </g>
        ))}
      </motion.g>

      {/* center medallion + calendar glyph (hand-drawn, not an icon-font import) */}
      <circle cx="120" cy="120" r="34" fill={`url(#${gCenter})`} stroke="white" strokeWidth="3" />
      <rect x="103" y="106" width="34" height="28" rx="5" fill="none" stroke="white" strokeWidth="2.2" />
      <path d="M103 116h34M111 102v8M129 102v8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

// --- SLOW, EASED "ANCHOR SCROLL" --- (identical to BMICalculator.tsx)
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
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

const formatFullDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const formatShortDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// 12-hour, AM/PM — matches DateTimePicker's own trigger-text convention,
// used here for the report / "Your Inputs" summary.
const formatTime = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

// Loose UI-level lower bound for the birth-date picker's year navigation
// (matches dateLogic's AGE_MAX_YEARS=130 sanity bound; validateDateInput
// remains the source of truth for what's actually accepted on Calculate).
const MIN_BIRTH_DATE = new Date(new Date().getFullYear() - 130, 0, 1);

// --- HEADLINE CARD — "You are exactly" ---
// Extracted from the main component so its pointer/animation hooks live
// locally and the results JSX stays readable. Three stacked zones:
//   1. Eyebrow — what this number is
//   2. Hero    — the labelled cake beside the born-on weekday
//   3. Footer  — live seconds counter + any caveats
// Premium layers, all decorative and all off under prefers-reduced-motion:
// slow-drifting aurora glows, faint floating sparkles, a soft spotlight
// that follows the mouse, glass pills, and a staggered entrance.
interface AgeHeadlineCardProps {
  years: number;
  months: number;
  days: number;
  totalSeconds: number;
  birthDate: Date;
  asOfDate: Date;
  isToday: boolean;
  isApproximate: boolean;
  isLeapBirthday: boolean;
  // Changes when a NEW calculation is committed (not on the 1s live
  // tick), so the cake's entrance replays for a fresh result.
  replayKey: string;
}

// Faint drifting sparkles kept to the card's left/right edges so they
// never sit behind the text.
const HEADLINE_SPARKLES = [
  { left: '5%',  top: '18%', size: 5, color: 'bg-amber-400/70',  delay: 0,   dur: 4.4 },
  { left: '9%',  top: '58%', size: 4, color: 'bg-violet-400/70', delay: 1.1, dur: 5.2 },
  { left: '4%',  top: '82%', size: 3, color: 'bg-indigo-400/70', delay: 2.2, dur: 4.8 },
  { left: '93%', top: '30%', size: 4, color: 'bg-violet-400/70', delay: 0.6, dur: 5.0 },
  { left: '96%', top: '64%', size: 5, color: 'bg-amber-400/70',  delay: 1.7, dur: 4.6 },
  { left: '90%', top: '88%', size: 3, color: 'bg-indigo-400/70', delay: 2.8, dur: 5.4 },
];

const AgeHeadlineCard: React.FC<AgeHeadlineCardProps> = ({
  years, months, days, totalSeconds, birthDate, asOfDate,
  isToday, isApproximate, isLeapBirthday, replayKey,
}) => {
  const reduced = useReducedMotion();
  const isFuture = !isToday && asOfDate.getTime() > Date.now();

  // Mouse spotlight: a soft violet radial glow that trails the cursor
  // inside the card and fades out when the pointer leaves. Mouse only —
  // touch never triggers it.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const hover = useMotionValue(0);
  const spotOpacity = useSpring(hover, { stiffness: 120, damping: 22 });
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(167,139,250,0.22), transparent 70%)`;
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
    hover.set(1);
  };

  const fadeUp = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE_OUT },
        };

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-violet-200/80 dark:border-violet-700/40 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-900/30 dark:via-neutral-800 dark:to-indigo-900/30 shadow-[0_12px_40px_-14px_rgba(124,58,237,0.45)] p-4 sm:p-6"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => hover.set(0)}
    >
      {/* AMBIENT LAYERS — all behind the content, all decorative */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-violet-400/30 via-indigo-400/20 to-transparent blur-3xl"
        animate={reduced ? undefined : { x: [0, 28, 0], y: [0, 18, 0] }}
        transition={reduced ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-16 w-72 h-72 rounded-full bg-gradient-to-tl from-amber-300/30 via-rose-300/15 to-transparent blur-3xl"
        animate={reduced ? undefined : { x: [0, -24, 0], y: [0, -16, 0] }}
        transition={reduced ? undefined : { duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: spotlight, opacity: spotOpacity }}
      />
      {/* hairline inner highlight — gives the card a glassy, machined edge */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/70 dark:ring-white/5" aria-hidden="true" />

      {/* Decorative confetti/orbit illustration */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 -right-6 w-40 h-40 sm:w-56 sm:h-56 text-violet-400/20 dark:text-violet-300/10"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="2" strokeDasharray="4 10" />
        <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="2" strokeDasharray="2 8" />
        <circle cx="188" cy="60" r="6" fill="currentColor" />
        <circle cx="20" cy="140" r="4" fill="currentColor" />
        <circle cx="150" cy="180" r="5" fill="currentColor" />
      </svg>

      {!reduced &&
        HEADLINE_SPARKLES.map((s, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-full ${s.color}`}
            style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
            animate={{ y: [0, -9, 0], opacity: [0.25, 0.85, 0.25] }}
            transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
          />
        ))}

      <div className="relative flex flex-col gap-4 sm:gap-5">
        {/* 1 · EYEBROW — a glass pill with a gradient icon chip */}
        <motion.div className="flex items-center justify-center" {...fadeUp(0.05)}>
          <span className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-violet-200/70 dark:border-violet-700/40 backdrop-blur-sm shadow-sm">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/40" aria-hidden="true">
              <SafeIcon icon={FiGift} className="w-3 h-3 text-white" />
            </span>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
              {isToday ? 'You are exactly' : `As of ${formatShortDate(asOfDate)}, you ${isFuture ? 'will be' : 'were'}`}
            </span>
          </span>
        </motion.div>

        {/* 2 · HERO — cake + born-on weekday. Cake stacks over a compact
            weekday row on mobile; side-by-side with a vertical divider
            from sm up. */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-center gap-4 sm:gap-6 w-full max-w-2xl mx-auto">
          <AgeCake key={replayKey} years={years} months={months} days={days} />

          <motion.div
            className="flex flex-row sm:flex-col items-center justify-center gap-4 sm:gap-2.5 pt-4 sm:pt-0 border-t border-violet-200/60 dark:border-violet-700/30 sm:border-t-0 sm:border-l sm:pl-6"
            {...fadeUp(0.5)}
          >
            {/* medallion with a slowly breathing halo behind it */}
            <div className="relative flex-shrink-0 w-[68px] h-[68px] sm:w-[104px] sm:h-[104px]">
              <motion.span
                aria-hidden="true"
                className="absolute inset-[-14%] rounded-full bg-gradient-to-br from-violet-400/35 to-amber-300/30 blur-xl"
                animate={reduced ? undefined : { opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
                transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <SunburstMedallion className="relative w-full h-full" />
            </div>
            <div className="text-left sm:text-center">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                You were born on a
              </p>
              <p className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight mt-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-300 dark:to-indigo-300 bg-clip-text text-transparent">
                {birthDate.toLocaleDateString(undefined, { weekday: 'long' })}
              </p>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-0.5">
                {formatShortDate(birthDate)}
              </p>
            </div>
          </motion.div>
        </div>

        {/* 3 · FOOTER — live counter + caveats under one hairline, so they
            read as supporting detail rather than competing headlines. */}
        {(isToday || isApproximate || isLeapBirthday) && (
          <motion.div
            className="flex flex-col items-center gap-1.5 pt-3 sm:pt-4 border-t border-violet-200/60 dark:border-violet-700/30 text-center"
            {...fadeUp(0.8)}
          >
            {isToday && (
              // max-w-full + flex-wrap so a very long seconds-alive total
              // wraps instead of forcing the pill wider than the card. The
              // pulsing green dot signals the counter is live (ping is
              // motion-safe only); the last digit rolls each second.
              <div className="max-w-full inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-violet-200/70 dark:border-violet-700/40 shadow-sm">
                <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 text-center">
                  <TickingNumber value={totalSeconds} /> seconds alive, and counting
                </span>
              </div>
            )}
            {isApproximate && (
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1">
                <SafeIcon icon={FiInfo} className="w-3 h-3 flex-shrink-0" />
                Approximate — exact time of birth wasn't provided
              </span>
            )}
            {isLeapBirthday && (
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                Born on Feb 29 — a true leap-year baby. Observed on Feb 28 in non-leap years.
              </span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- NEXT BIRTHDAY CARD ---
// A deliberately different look from the light "You are exactly" headline:
// a deep "midnight" card (same in light and dark mode) that counts down to
// the party. A tear-off calendar leaf shows the date, glass tiles count
// down (live to the second when the result is "as of today"), and a
// glowing track shows how far through the year you are. Twinkling stars
// and a "dawn" glow that brightens as the birthday approaches carry the
// theme. Every animated layer stops under prefers-reduced-motion.

const ordinal = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

const NEXT_BDAY_STARS = [
  { l: '8%',  t: '14%', s: 2, d: 0 },   { l: '22%', t: '8%',  s: 3, d: 0.8 },
  { l: '38%', t: '18%', s: 2, d: 1.6 }, { l: '55%', t: '7%',  s: 3, d: 0.4 },
  { l: '70%', t: '16%', s: 2, d: 2.1 }, { l: '84%', t: '9%',  s: 3, d: 1.2 },
  { l: '93%', t: '24%', s: 2, d: 0.2 }, { l: '14%', t: '34%', s: 2, d: 1.9 },
  { l: '62%', t: '30%', s: 2, d: 2.6 }, { l: '90%', t: '46%', s: 3, d: 1.0 },
  { l: '4%',  t: '52%', s: 3, d: 2.4 },
];

// Digits that roll in individually — only the characters that actually
// change re-animate, so at "00:00:07 → 00:00:06" just the last digit
// moves and the rest of the row stays perfectly still.
const FlipDigits: React.FC<{ value: number; pad?: number }> = ({ value, pad = 2 }) => {
  const reduced = useReducedMotion();
  const text = String(value).padStart(pad, '0');
  return (
    <span className="inline-flex tabular-nums">
      {text.split('').map((ch, i) => (
        <span key={i} className="inline-block overflow-hidden h-[1.15em] leading-[1.15em]">
          <motion.span
            key={ch}
            className="inline-block"
            initial={reduced ? false : { y: '-70%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            {ch}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

interface NextBirthdayCardProps {
  info: ReturnType<typeof getNextBirthday>;
  asOf: Date;
  // true when the result is "as of today" — only then does the countdown
  // tick, because an "as of" a fixed date is by definition static.
  isLive: boolean;
  progressPercent: number;
}

const NextBirthdayCard: React.FC<NextBirthdayCardProps> = ({ info, asOf, isLive, progressPercent }) => {
  const reduced = useReducedMotion();
  const { date, daysUntil, dayOfWeek, turningAge, isToday } = info;
  const pct = Math.max(0, Math.min(100, progressPercent));

  // Live countdown to midnight at the start of the birthday.
  const msLeft = Math.max(0, date.getTime() - asOf.getTime());
  const liveD = Math.floor(msLeft / 86_400_000);
  const liveH = Math.floor((msLeft % 86_400_000) / 3_600_000);
  const liveM = Math.floor((msLeft % 3_600_000) / 60_000);
  const liveS = Math.floor((msLeft % 60_000) / 1000);
  // Static ("as of" a fixed date): weeks + days from the calendar count.
  const weeks = Math.floor(daysUntil / 7);
  const restDays = daysUntil % 7;

  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE_OUT },
        };

  const tiles: { label: string; node: React.ReactNode; accent?: boolean }[] = isLive
    ? [
        { label: plural(liveD, 'day', 'days'), node: <CountUp value={liveD} delay={0.5} /> },
        { label: 'hrs', node: <FlipDigits value={liveH} /> },
        { label: 'min', node: <FlipDigits value={liveM} /> },
        { label: 'sec', node: <FlipDigits value={liveS} />, accent: true },
      ]
    : [
        { label: plural(weeks, 'week', 'weeks'), node: <CountUp value={weeks} delay={0.5} /> },
        { label: plural(restDays, 'day', 'days'), node: <CountUp value={restDays} delay={0.6} /> },
      ];

  const monthShort = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-violet-400/25 shadow-[0_16px_48px_-16px_rgba(76,29,149,0.75)] p-4 sm:p-6"
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #312e81 100%)' }}
    >
      {/* NIGHT-SKY LAYERS — decorative only */}
      <div className="pointer-events-none absolute -top-20 -left-16 w-72 h-72 rounded-full bg-gradient-to-br from-violet-400/25 via-indigo-400/10 to-transparent blur-3xl" aria-hidden="true" />
      {/* "Dawn" glow along the bottom edge: brighter the closer the
          birthday is (0.18 at the start of the year → ~0.6 on the day). */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-[10%] -right-[10%] h-48 rounded-full bg-gradient-to-t from-amber-400 via-rose-400/60 to-transparent blur-3xl"
        style={{ opacity: 0.18 + pct * 0.0042 }}
        animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {NEXT_BDAY_STARS.map((s, i) =>
        reduced ? (
          <span key={i} aria-hidden="true" className="pointer-events-none absolute rounded-full bg-white opacity-40" style={{ left: s.l, top: s.t, width: s.s, height: s.s }} />
        ) : (
          <motion.span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-white"
            style={{ left: s.l, top: s.t, width: s.s, height: s.s }}
            animate={{ opacity: [0.12, 0.85, 0.12], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: s.d }}
          />
        )
      )}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 sm:gap-5">
        {/* 1 · HEADER */}
        <motion.div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" {...enter(0.05)}>
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-sm shadow-violet-900/50" aria-hidden="true">
              <SafeIcon icon={FiGift} className="w-3.5 h-3.5 text-white" />
            </span>
            <h4 className="text-base font-extrabold text-white">Next Birthday</h4>
          </div>
          <div className="flex items-center gap-1.5">
            {!isToday && daysUntil === 1 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/20 whitespace-nowrap">
                Tomorrow
              </span>
            )}
            <span className="text-[11px] sm:text-xs font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 text-amber-950 shadow-sm shadow-amber-500/30 whitespace-nowrap">
              Turning {turningAge}
            </span>
          </div>
        </motion.div>

        {/* 2 · HERO — calendar leaf + countdown */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Tear-off calendar leaf with a second sheet peeking out
              behind it; lifts and straightens on hover. */}
          <div className="relative flex-shrink-0 w-[84px] sm:w-[108px]">
            <div className="absolute inset-x-2 top-2 -bottom-1.5 rounded-2xl bg-white/35" aria-hidden="true" />
            <motion.div
              className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-white to-violet-50 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] text-center"
              initial={reduced ? false : { opacity: 0, y: 14, rotate: -8 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT }}
              whileHover={reduced ? undefined : { rotate: 0, y: -3, scale: 1.03 }}
            >
              <div className="bg-gradient-to-r from-amber-300 to-amber-500 py-1 text-[10px] sm:text-[11px] font-extrabold tracking-[0.22em] text-amber-950">
                {monthShort}
              </div>
              {/* binder holes, in the card's own background color so they
                  read as punched through the paper */}
              <span className="absolute top-0 left-[22%] -translate-y-1/2 w-2 h-2 rounded-full bg-[#2a1a72]" aria-hidden="true" />
              <span className="absolute top-0 right-[22%] -translate-y-1/2 w-2 h-2 rounded-full bg-[#2a1a72]" aria-hidden="true" />
              <div className="pt-1.5 pb-2 sm:pt-2 sm:pb-2.5">
                <div className="text-[2rem] sm:text-5xl font-black leading-none tabular-nums bg-gradient-to-b from-violet-600 to-indigo-700 bg-clip-text text-transparent">
                  {date.getDate()}
                </div>
                <div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">{dayOfWeek}</div>
                <div className="text-[10px] font-semibold text-neutral-400">{date.getFullYear()}</div>
              </div>
            </motion.div>

            {/* birthday-today: one-shot confetti burst from the leaf */}
            {isToday && !reduced && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0" aria-hidden="true">
                {CONFETTI.map((c) => (
                  <motion.span
                    key={c.id}
                    className={`absolute ${c.round ? 'rounded-full' : 'rounded-[1px]'}`}
                    style={{ width: c.size * 1.7, height: c.round ? c.size * 1.7 : c.size * 0.9, background: c.color }}
                    initial={{ opacity: 0 }}
                    animate={{
                      x: [0, c.dx, c.dx * 1.08],
                      y: [0, c.dy, c.dy + 34],
                      opacity: [0, 1, 0],
                      rotate: [0, c.spin / 2, c.spin],
                    }}
                    transition={{ duration: 1.8, delay: 0.7 + c.id * 0.025, ease: 'easeOut', times: [0, 0.5, 1] }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <motion.p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-violet-200/80 mb-2" {...enter(0.3)}>
              {isToday ? `Your ${ordinal(turningAge)} birthday` : `Until your ${ordinal(turningAge)} birthday`}
            </motion.p>

            {isToday ? (
              <motion.div
                className="rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-400/20 via-amber-300/10 to-rose-400/20 px-3 py-3 text-center"
                {...enter(0.4)}
              >
                <p className="text-xl sm:text-2xl font-extrabold leading-tight">
                  <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-rose-300 bg-clip-text text-transparent">Happy Birthday!</span>{' '}
                  <span aria-hidden="true">🎉</span>
                </p>
                <p className="text-xs sm:text-sm font-medium text-violet-100/90 mt-1">You turn {turningAge} today</p>
              </motion.div>
            ) : (
              <div className={`grid gap-2 ${tiles.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`} aria-hidden="true">
                {tiles.map((t, i) => (
                  <motion.div
                    key={i}
                    className={`rounded-xl bg-white/10 backdrop-blur-sm border py-2 sm:py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${t.accent ? 'border-amber-300/40' : 'border-white/15'}`}
                    {...enter(0.35 + i * 0.08)}
                  >
                    <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums leading-none ${t.accent ? 'text-amber-300' : 'text-white'}`}>
                      {t.node}
                    </div>
                    <div className="mt-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/80">{t.label}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3 · YEAR TRACK — a glowing fill from the last birthday to the
            next, with a tick per month and a marker that leads the fill. */}
        <motion.div {...enter(0.7)}>
          <div className="flex items-center justify-between text-[11px] font-bold text-violet-200/80 mb-2">
            <span>Turned {turningAge - 1}</span>
            <span className="text-white tabular-nums">
              <CountUp value={Math.round(pct)} delay={0.8} duration={1.4} />% of the way
            </span>
            <span>Turning {turningAge}</span>
          </div>
          <div
            className="relative h-2.5 rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Progress toward your next birthday"
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-indigo-400 to-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
              initial={reduced ? false : { width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT }}
            />
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: `${((i + 1) / 12) * 100}%` }} aria-hidden="true" />
            ))}
            <motion.span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4"
              initial={reduced ? false : { left: '0%' }}
              animate={{ left: `${pct}%` }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT }}
              aria-hidden="true"
            >
              <span className="absolute inset-0 rounded-full bg-amber-300 opacity-60 motion-safe:animate-ping" />
              <span className="relative block w-full h-full rounded-full bg-white ring-2 ring-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.85)]" />
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* The countdown tiles are aria-hidden (they'd re-announce every
          second), so give assistive tech one stable sentence instead. */}
      <span className="sr-only">
        {isToday
          ? `Today is your ${ordinal(turningAge)} birthday.`
          : `Your ${ordinal(turningAge)} birthday is on ${dayOfWeek}, ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}, ${daysUntil} ${plural(daysUntil, 'day', 'days')} away.`}
      </span>
    </div>
  );
};

// --- SHARED RESULT-SECTION PRIMITIVES ---
// Every result card below the headline (Exact Totals, Milestone Birthdays,
// Day-Count Milestones, Pet Years, Lifetime Estimates, Curiosities) is built
// from the same few pieces so spacing, radii, type scale, gradients and
// glows are defined once and cannot drift apart:
//   ResultCard      — the card shell (border, radius, surface, ambient glow)
//   SectionHeader   — icon chip + title + subtitle + optional tip / badge
//   StatTile        — the saturated gradient number tile
//   CountBadge / MilestoneTimeline — milestone widgets
// (The headline "You are exactly" and dark "Next Birthday" cards keep their
// own hero treatments on purpose; they share the violet/indigo/amber palette
// and the same header type scale.)

type IconType = React.ComponentProps<typeof SafeIcon>['icon'];

// One tone table for every gradient tile. Stops run from Tailwind 500 → 700
// (not 300/400 → 600) so white numerals keep readable contrast on every
// tone, including amber and sky, which fail on the lighter stops.
const TILE_TONES = {
  indigo:  { from: '#6366f1', to: '#4338ca' },
  amber:   { from: '#f59e0b', to: '#b45309' },
  sky:     { from: '#0ea5e9', to: '#0369a1' },
  emerald: { from: '#10b981', to: '#047857' },
  rose:    { from: '#f43f5e', to: '#be123c' },
  violet:  { from: '#8b5cf6', to: '#6d28d9' },
} as const;
type TileTone = keyof typeof TILE_TONES;

// Sizes a number to fit its tile at ANY width. The tile is a size container
// (see StatTile), so `cqw` is 1% of the tile's inner width; dividing by the
// character count (≈0.58em per tabular digit/comma on average) gives the
// largest size that still fits on one line. Clamped so short numbers never
// get huge and long ones never get unreadable. The `text-2xl` class on the
// element is the fallback for browsers without container units.
const fitNumberStyle = (text: string, maxRem: number, minRem = 0.875): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(86 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// Calendar-day distance (midnight to midnight), the same convention
// getNextBirthday uses for its own "daysUntil" — so every countdown on the
// page agrees, and a milestone that lands later today reads "Today" rather
// than "0d".
const startOfDayMs = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const calendarDaysAway = (target: Date, from: Date): number =>
  Math.round((startOfDayMs(target) - startOfDayMs(from)) / 86_400_000);

// Compact, human countdown: "Tomorrow", "in 12 days", "in 8 mo", "in 3y 2mo".
// Far-off milestones (a 100th birthday can be 27,000+ days away) stay
// readable instead of showing a raw day count.
const formatAway = (days: number): string => {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 100) return `in ${days} days`;
  if (days < 365) return `in ${Math.min(11, Math.round(days / 30.4375))} mo`;
  const y = Math.floor(days / 365.2425);
  const mo = Math.round((days - y * 365.2425) / 30.4375);
  if (mo >= 12) return `in ${y + 1}y`;
  return mo > 0 ? `in ${y}y ${mo}mo` : `in ${y}y`;
};

const formatAwayPlain = (days: number): string =>
  days <= 0 ? 'today' : `${formatWithCommas(days)} ${plural(days, 'day', 'days')} away`;

const ResultCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-white via-neutral-50 to-violet-50/40 dark:from-neutral-800 dark:via-neutral-800 dark:to-violet-900/10 shadow-sm p-4 sm:p-6 ${className}`}>
    {/* ambient glow — decorative, identical on every card */}
    <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-violet-400/15 via-indigo-400/10 to-transparent blur-2xl" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-20 -left-14 w-56 h-56 rounded-full bg-gradient-to-tr from-amber-400/10 via-sky-400/10 to-transparent blur-2xl" aria-hidden="true" />
    <div className="relative">{children}</div>
  </div>
);

const SectionHeader: React.FC<{
  icon: IconType;
  title: string;
  subtitle?: React.ReactNode;
  tip?: string;
  badge?: React.ReactNode;
  mb?: string;
}> = ({ icon, title, subtitle, tip, badge, mb = 'mb-5' }) => (
  <div className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 ${mb}`}>
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/30" aria-hidden="true">
        <SafeIcon icon={icon} className="w-3.5 h-3.5 text-white" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-base font-extrabold leading-7 text-neutral-900 dark:text-white">{title}</h4>
          {tip && <InfoTip text={tip} />}
        </div>
        {subtitle && (
          <p className="-mt-0.5 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        )}
      </div>
    </div>
    {badge}
  </div>
);

const CountBadge: React.FC<{ achieved: number; total: number }> = ({ achieved, total }) => (
  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 whitespace-nowrap tabular-nums bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 rounded-full border border-violet-200/70 dark:border-violet-800/50">
    {achieved} of {total} reached
  </span>
);

// Saturated gradient number tile — the single stat treatment used by Exact
// Totals, Pet Years and Lifetime Estimates. Centered, same padding, same
// icon chip, same label/sub type scale.
const StatTile: React.FC<{
  tone: TileTone;
  icon?: IconType;
  emoji?: string;
  value: string;
  label: string;
  sub?: string;
  maxRem?: number;
}> = ({ tone, icon, emoji, value, label, sub, maxRem = 1.875 }) => {
  const t = TILE_TONES[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-center text-white shadow-md shadow-neutral-900/10 dark:shadow-black/30 motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, containerType: 'inline-size' }}
    >
      {/* oversized watermark */}
      {icon ? (
        <SafeIcon
          icon={icon}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -right-3 w-16 h-16 text-white/10 motion-safe:transition-all motion-safe:duration-300 group-hover:text-white/15 group-hover:scale-110"
        />
      ) : (
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-4 -right-3 text-7xl leading-none opacity-15 motion-safe:transition-all motion-safe:duration-300 group-hover:opacity-25 group-hover:scale-110">
          {emoji}
        </span>
      )}
      <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 mb-2.5 text-lg leading-none" aria-hidden="true">
        {icon ? <SafeIcon icon={icon} className="w-4 h-4 text-white" /> : emoji}
      </span>
      <span
        className="relative block w-full text-2xl font-extrabold tabular-nums tracking-tight leading-tight whitespace-nowrap drop-shadow-sm"
        style={fitNumberStyle(value, maxRem)}
      >
        {value}
      </span>
      <span className="relative block text-[11px] font-bold uppercase tracking-[0.12em] text-white/90 mt-1.5">{label}</span>
      {sub && <span className="relative block text-[10px] font-medium text-white/75 mt-0.5">{sub}</span>}
    </div>
  );
};

// --- ATTENTION "NEXT" CHIP ---
// Used for the "Next" / "Next up" marker on both milestone cards. Kept
// deliberately minimal: one soft halo, in the milestone's own colour, breathes
// outward every ~2s — half a beat behind the pulse on the milestone node, so
// the eye travels from the icon to its label. No movement and no size change
// (so nothing shifts or jitters next to the text). Static under
// prefers-reduced-motion.
const NextChip: React.FC<{ label: string; className: string; pulse: string; pulseFade: string }> = ({
  label, className, pulse, pulseFade,
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className={`inline-block ${className}`}
      animate={reduced ? undefined : { boxShadow: [`0 0 0 0 ${pulse}`, `0 0 0 6px ${pulseFade}`] }}
      transition={reduced ? undefined : { duration: 1.8, delay: 0.9, repeat: Infinity, ease: 'easeOut' }}
    >
      {label}
    </motion.span>
  );
};

// --- MILESTONE TIMELINE ---
// One vertical timeline used by Milestone Birthdays (all sizes) and by
// Day-Count Milestones on phones. The connecting line sits in an inner
// wrapper (so it scrolls WITH the rows when the list is height-capped) and
// is centred on the icon column; its filled portion ends exactly on the
// last reached icon. When capped, the list scrolls itself so the "next up"
// row is in view instead of hiding below the fold.
interface TimelineItem {
  key: string | number;
  state: 'reached' | 'next' | 'upcoming';
  title: string;
  subtitle: string;
  status: string;
  statusTitle?: string;
}

const MilestoneTimeline: React.FC<{ items: TimelineItem[]; label: string; maxHeightClass?: string }> = ({
  items, label, maxHeightClass,
}) => {
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLLIElement | null>(null);
  const reachedCount = items.filter((i) => i.state === 'reached').length;
  const nextIndex = items.findIndex((i) => i.state === 'next');
  const fillPct = items.length > 1 && reachedCount > 0
    ? Math.min(100, ((reachedCount - 1) / (items.length - 1)) * 100)
    : 0;

  useEffect(() => {
    const box = scrollRef.current;
    const row = nextRef.current;
    if (!box || !row || box.scrollHeight <= box.clientHeight) return;
    box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2);
  }, [nextIndex, items.length]);

  return (
    <div
      ref={scrollRef}
      className={`${maxHeightClass ?? ''} ${maxHeightClass ? 'overflow-y-auto pr-1' : ''}`}
      {...(maxHeightClass ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
    >
      <div className="relative">
        <div className="absolute left-[26px] top-7 bottom-7 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true">
          <div
            className="w-full bg-gradient-to-b from-violet-400 to-indigo-500 motion-safe:transition-[height] motion-safe:duration-500 ease-out"
            style={{ height: `${fillPct}%` }}
          />
        </div>
        <ol className="relative list-none m-0 p-0 space-y-1">
          {items.map((it, i) => {
            const palette = MILESTONE_PALETTE[i % MILESTONE_PALETTE.length];
            const isNext = it.state === 'next';
            const reached = it.state === 'reached';
            return (
              <li
                key={it.key}
                ref={isNext ? nextRef : undefined}
                className={`relative flex items-center gap-3 rounded-xl pl-2 pr-3 py-2.5 motion-safe:transition-colors motion-safe:duration-150 ${
                  isNext
                    ? 'bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-300 dark:ring-violet-700'
                    : 'hover:bg-white/70 dark:hover:bg-neutral-900/30'
                }`}
              >
                <motion.span
                  animate={isNext && !reduced ? { boxShadow: ['0 0 0 0 rgba(139,92,246,0.35)', '0 0 0 7px rgba(139,92,246,0)'] } : undefined}
                  transition={isNext && !reduced ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : undefined}
                  className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                    reached
                      ? `bg-gradient-to-br ${palette.grad} ${palette.border} text-white shadow-sm ${palette.shadow}`
                      : isNext
                      ? 'bg-violet-500 border-violet-500 text-white'
                      : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400'
                  }`}
                  aria-hidden="true"
                >
                  <SafeIcon icon={reached ? FiCheckCircle : FiStar} className="w-4 h-4" />
                </motion.span>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-neutral-800 dark:text-neutral-100">
                      <span className="truncate">{it.title}</span>
                      {isNext && (
                        <NextChip
                          label="Next up"
                          className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full"
                          pulse="rgba(139,92,246,0.45)"
                          pulseFade="rgba(139,92,246,0)"
                        />
                      )}
                    </p>
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{it.subtitle}</p>
                  </div>
                  <span
                    title={it.statusTitle}
                    className={`flex-shrink-0 text-[11px] font-bold tabular-nums whitespace-nowrap px-2 py-0.5 rounded-full ${
                      reached
                        ? palette.chip
                        : isNext
                        ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-800/50'
                        : 'bg-neutral-100/80 dark:bg-neutral-800/70 text-neutral-500 dark:text-neutral-400 border border-neutral-200/70 dark:border-neutral-700/60'
                    }`}
                  >
                    {it.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

// --- DAY-COUNT TRAIL (sm and up) ---
// Zig-zag path so all seven day-count milestones fit on one screen. The
// curve is decorative SVG; every number/date is real HTML text over it. The
// stroke uses vector-effect="non-scaling-stroke": the SVG is stretched with
// preserveAspectRatio="none", which otherwise makes the line visibly
// thicker in one direction than the other. Upcoming segments are dashed.
const DayCountTrail: React.FC<{ items: ReturnType<typeof getDayCountMilestones>; uid: string }> = ({ items, uid }) => {
  const reduced = useReducedMotion();
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, '');
  const n = items.length;
  const nextItem = items.find((dm) => !dm.achieved);
  return (
    <div className="relative h-56" style={{ containerType: 'inline-size' }}>
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {items.slice(0, -1).map((dm, i) => (
            <linearGradient key={dm.dayCount} id={`dayTrail-${safeUid}-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={MILESTONE_PALETTE[i % MILESTONE_PALETTE.length].hexTo} />
              <stop offset="100%" stopColor={MILESTONE_PALETTE[(i + 1) % MILESTONE_PALETTE.length].hexFrom} />
            </linearGradient>
          ))}
        </defs>
        {items.slice(0, -1).map((dm, i) => {
          const x0 = ((i + 0.5) / n) * 100;
          const x1 = ((i + 1.5) / n) * 100;
          const y0 = i % 2 === 0 ? 24 : 76;
          const y1 = (i + 1) % 2 === 0 ? 24 : 76;
          const midX = (x0 + x1) / 2;
          return (
            <path
              key={dm.dayCount}
              d={`M ${x0} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`}
              fill="none"
              stroke={dm.achieved ? `url(#dayTrail-${safeUid}-${i})` : 'currentColor'}
              className={dm.achieved ? '' : 'text-neutral-300 dark:text-neutral-600'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={dm.achieved ? undefined : '4 5'}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {items.map((dm, i) => {
        const x = ((i + 0.5) / n) * 100;
        const isTop = i % 2 === 0;
        const y = isTop ? 24 : 76;
        const isNext = dm === nextItem;
        const palette = MILESTONE_PALETTE[i % MILESTONE_PALETTE.length];
        return (
          <React.Fragment key={dm.dayCount}>
            <motion.span
              style={{ left: `${x}%`, top: `${y}%` }}
              animate={isNext && !reduced ? { boxShadow: [`0 0 0 0 ${palette.pulse}`, `0 0 0 9px ${palette.pulseFade}`] } : undefined}
              transition={isNext && !reduced ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : undefined}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 ${
                dm.achieved
                  ? `bg-gradient-to-br ${palette.grad} ${palette.border} text-white shadow-sm ${palette.shadow}`
                  : isNext
                  ? `bg-white dark:bg-neutral-800 ${palette.border} ${palette.text}`
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600'
              }`}
              aria-hidden="true"
            >
              <SafeIcon icon={dm.achieved ? FiCheckCircle : FiTarget} className="w-4 h-4" />
            </motion.span>
            <div
              style={{ left: `${x}%`, top: `${isTop ? y + 17 : y - 17}%` }}
              className={`absolute text-center -translate-x-1/2 ${isTop ? '' : '-translate-y-full'}`}
            >
              {/* Label sizes track the trail's own width (cqw): each column is
                  1/7 of it, and a date like "Mar 28, 2067" is ~6.6em wide, so
                  ~1.85cqw is the largest date size that never touches its
                  neighbour. Clamped so it is never tiny or oversized. The
                  text-[11px]/text-sm classes are the no-cqw fallback. */}
              <span
                className={`block text-sm font-extrabold tabular-nums leading-tight ${dm.achieved ? palette.text : 'text-neutral-900 dark:text-white'}`}
                style={{ fontSize: 'clamp(0.8125rem, 2.4cqw, 1.0625rem)' }}
              >
                {formatWithCommas(dm.dayCount)}
              </span>
              <span
                className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mt-1 whitespace-nowrap"
                style={{ fontSize: 'clamp(0.6875rem, 1.85cqw, 0.8125rem)' }}
              >
                {formatShortDate(dm.date)}
              </span>
              {isNext && (
                <div className="mt-2">
                  <NextChip
                    label="Next"
                    className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${palette.chip}`}
                    pulse={palette.pulse}
                    pulseFade={palette.pulseFade}
                  />
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Small bordered "fact" row used inside Curiosities.
const FactRow: React.FC<{ icon: IconType; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-start gap-3 rounded-xl bg-white/80 dark:bg-neutral-900/40 border border-neutral-200/70 dark:border-neutral-700/50 px-3.5 py-3">
    <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300" aria-hidden="true">
      <SafeIcon icon={icon} className="w-4 h-4" />
    </span>
    <p className="min-w-0 pt-1 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">{children}</p>
  </div>
);

type AsOfMode = 'today' | 'custom';

const ChronologicalAgeCalculator: React.FC<ChronologicalAgeCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  // Unique per mounted instance so the Day-Count Milestones trail's SVG
  // <linearGradient> ids never clash if this calculator appears twice on
  // one page.
  const dayMilestoneUid = useId();

  // --- STATE ---
  // Time of birth is optional and defaults to midnight — `birthTimeUnknown`
  // starts true (the "I don't know my exact birth time" state) so a person
  // who never touches the time picker gets exactly the old midnight-default
  // behavior. DateTimePicker flips it to false itself the moment someone
  // actually picks an hour/minute.
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTimeUnknown, setBirthTimeUnknown] = useState<boolean>(true);

  const [asOfMode, setAsOfMode] = useState<AsOfMode>('today');
  const [asOfDate, setAsOfDate] = useState<Date | null>(null);
  const [asOfTimeUnknown, setAsOfTimeUnknown] = useState<boolean>(true);

  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  // Locked-in birth date, only updated by Calculate — display fields above
  // can change freely without recomputing anything until the user commits,
  // same "explicit calculate step" pattern the other calculators use.
  const [committedBirthDate, setCommittedBirthDate] = useState<Date | null>(null);
  const [committedBirthTimeUnknown, setCommittedBirthTimeUnknown] = useState<boolean>(true);
  const [committedAsOfMode, setCommittedAsOfMode] = useState<AsOfMode>('today');
  const [committedAsOfDate, setCommittedAsOfDate] = useState<Date | null>(null);
  const [committedAsOfTimeUnknown, setCommittedAsOfTimeUnknown] = useState<boolean>(true);

  // --- LIVE TICK ---
  // Only ticks when the result is "as of today" — an "as of" a fixed past
  // or future date is, by definition, static, so ticking it would be
  // misleading rather than premium.
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!hasCalculated || committedAsOfMode !== 'today') return;
    const id = window.setInterval(() => setLiveNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [hasCalculated, committedAsOfMode]);

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

  const isCalculateDisabled = useMemo(() => {
    if (!birthDate) return true;
    if (asOfMode === 'custom' && !asOfDate) return true;
    return false;
  }, [birthDate, asOfMode, asOfDate]);

  const isClearDisabled = useMemo(() => !birthDate && !hasCalculated, [birthDate, hasCalculated]);

  const resetCalculation = () => {
    setHasCalculated(false);
    setBirthDateError(null);
    setCommittedBirthDate(null);
    setCommittedAsOfDate(null);
  };

  const handleBirthDateChange = (d: Date | null) => {
    setBirthDate(d);
    setBirthDateError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setBirthDate(null);
    setBirthTimeUnknown(true);
    setAsOfMode('today');
    setAsOfDate(null);
    setAsOfTimeUnknown(true);
    resetCalculation();
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const birth = birthDate;
    const asOf: Date = asOfMode === 'today' ? new Date() : (asOfDate ?? new Date(NaN));

    const validation = validateDateInput(birth, asOf);
    if (!validation.isValid) {
      setBirthDateError(validation.error ?? 'Please enter a valid date of birth.');
      setHasCalculated(false);
      return;
    }

    setBirthDateError(null);
    setCommittedBirthDate(birth);
    setCommittedBirthTimeUnknown(birthTimeUnknown);
    setCommittedAsOfMode(asOfMode);
    setCommittedAsOfDate(asOf);
    setCommittedAsOfTimeUnknown(asOfMode === 'custom' ? asOfTimeUnknown : false);
    setHasCalculated(true);
    setLiveNow(new Date());

    if (onCalculationComplete) onCalculationComplete();

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

  const hasError = Boolean(birthDateError);

  // "as of" instant used for every derived calculation below — the live
  // tick when today, otherwise the locked-in custom date at local midnight.
  const effectiveAsOf = useMemo(() => {
    if (!hasCalculated || !committedAsOfDate) return null;
    return committedAsOfMode === 'today' ? liveNow : committedAsOfDate;
  }, [hasCalculated, committedAsOfDate, committedAsOfMode, liveNow]);

  const ageBreakdown = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || !effectiveAsOf) return null;
    return calculateAge(committedBirthDate, effectiveAsOf);
  }, [hasCalculated, hasError, committedBirthDate, effectiveAsOf]);

  // Total Hours/Minutes/Seconds (and the live seconds ticker) are only as
  // precise as the time-of-day fed into calculateAge. When either endpoint
  // fell back to its midnight default, those finer-grained totals are
  // accurate to the nearest day rather than the nearest second.
  const isApproximate = useMemo(() => {
    if (!hasCalculated || hasError) return false;
    if (committedBirthTimeUnknown) return true;
    if (committedAsOfMode === 'custom' && committedAsOfTimeUnknown) return true;
    return false;
  }, [hasCalculated, hasError, committedBirthTimeUnknown, committedAsOfMode, committedAsOfTimeUnknown]);

  const nextBirthday = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || !effectiveAsOf) return null;
    return getNextBirthday(committedBirthDate, effectiveAsOf);
  }, [hasCalculated, hasError, committedBirthDate, effectiveAsOf]);

  const milestones = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || !effectiveAsOf) return [];
    return getMilestoneBirthdays(committedBirthDate, effectiveAsOf);
  }, [hasCalculated, hasError, committedBirthDate, effectiveAsOf]);

  const nextMilestone = useMemo(() => getNextMilestone(milestones), [milestones]);

  const dayMilestones = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || !effectiveAsOf) return [];
    return getDayCountMilestones(committedBirthDate, effectiveAsOf);
  }, [hasCalculated, hasError, committedBirthDate, effectiveAsOf]);

  const petYears = useMemo(() => {
    if (!ageBreakdown) return null;
    const ageInYears = ageBreakdown.years + ageBreakdown.months / 12 + ageBreakdown.days / 365.2425;
    return calculatePetYears(ageInYears);
  }, [ageBreakdown]);

  const lifetimeEstimates = useMemo(() => {
    if (!ageBreakdown) return null;
    return getLifetimeEstimates(ageBreakdown.totalMinutes);
  }, [ageBreakdown]);

  const weekdayTally = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || !effectiveAsOf) return [];
    return getBirthdayWeekdayTally(committedBirthDate, effectiveAsOf);
  }, [hasCalculated, hasError, committedBirthDate, effectiveAsOf]);

  // Anchored on the upcoming birthday (not the current calendar year's, which
  // may already have passed): "your next birthday is a Saturday — the next
  // time it's a Saturday after that is 2033".
  const nextBirthdayTime = nextBirthday ? nextBirthday.date.getTime() : null;
  const nextSameWeekday = useMemo(() => {
    if (!hasCalculated || hasError || !committedBirthDate || nextBirthdayTime === null) return null;
    return getNextSameWeekdayBirthdayYear(committedBirthDate, new Date(nextBirthdayTime));
  }, [hasCalculated, hasError, committedBirthDate, nextBirthdayTime]);

  const isLeapBirthday = useMemo(
    () => (committedBirthDate ? isFeb29Birthday(committedBirthDate) : false),
    [committedBirthDate]
  );
  const bornInLeapYear = useMemo(
    () => (committedBirthDate ? isLeapYear(committedBirthDate.getFullYear()) : false),
    [committedBirthDate]
  );

  // --- VISUAL-ONLY DERIVED VALUES ---
  // Progress ring: how far through the ~365-day cycle since the last
  // birthday we are, purely to give the countdown a glanceable shape.
  const yearProgressPercent = useMemo(() => {
    if (!nextBirthday) return 0;
    const prev = new Date(nextBirthday.date);
    prev.setFullYear(prev.getFullYear() - 1);
    const span = Math.max(1, Math.round((startOfDayMs(nextBirthday.date) - startOfDayMs(prev)) / 86_400_000));
    return Math.round(Math.max(0, Math.min(100, ((span - nextBirthday.daysUntil) / span) * 100)));
  }, [nextBirthday]);

  // Milestone badge ("X of Y reached"): how many of the listed milestone birthdays
  // have already been reached, out of the total shown.
  const milestoneProgress = useMemo(() => {
    if (milestones.length === 0) return null;
    const achieved = milestones.filter((m) => m.achieved).length;
    return { achieved, total: milestones.length };
  }, [milestones]);

  const dayMilestoneProgress = useMemo(() => {
    if (dayMilestones.length === 0) return null;
    const achieved = dayMilestones.filter((dm) => dm.achieved).length;
    return { achieved, total: dayMilestones.length };
  }, [dayMilestones]);

  // Highest single weekday-birthday count, used to scale the mini bar
  // chart in the Curiosities panel so the tallest bar reaches full height.
  const maxWeekdayCount = useMemo(
    () => weekdayTally.reduce((max, wd) => Math.max(max, wd.count), 0),
    [weekdayTally]
  );

  // --- SHAREABLE REPORT ---
  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || !ageBreakdown || !committedBirthDate || !effectiveAsOf) return null;

    const mainRows: Array<{ label: string; value: string }> = [
      { label: 'Total Days Alive', value: formatWithCommas(ageBreakdown.totalDays) },
      { label: 'Total Weeks Alive', value: formatWithCommas(ageBreakdown.totalWeeks) },
      { label: 'Total Hours Alive', value: formatWithCommas(ageBreakdown.totalHours) },
    ];
    const sections: ShareableReport['sections'] = [{ heading: 'Exact Totals', rows: mainRows, variant: 'output' }];

    if (nextBirthday) {
      sections.push({
        heading: 'Next Birthday',
        rows: [
          { label: 'Date', value: formatFullDate(nextBirthday.date) },
          { label: 'Countdown', value: nextBirthday.isToday ? 'Today! 🎉' : `${nextBirthday.daysUntil} ${plural(nextBirthday.daysUntil, 'day', 'days')}` },
          { label: 'Turning', value: `${nextBirthday.turningAge}` },
        ],
        variant: 'output',
      });
    }

    if (nextMilestone) {
      sections.push({
        heading: 'Next Milestone Birthday',
        rows: [
          { label: nextMilestone.label, value: `${formatShortDate(nextMilestone.date)} (${formatAwayPlain(calendarDaysAway(nextMilestone.date, effectiveAsOf))})` },
        ],
        variant: 'output',
      });
    }

    if (petYears) {
      sections.push({
        heading: 'Equivalent Age',
        rows: [
          { label: 'Dog Years', value: `${petYears.dogYears}` },
          { label: 'Cat Years', value: `${petYears.catYears}` },
        ],
        variant: 'output',
      });
    }

    const inputRows: Array<{ label: string; value: string }> = [
      {
        label: 'Date of Birth',
        value: committedBirthTimeUnknown
          ? formatFullDate(committedBirthDate)
          : `${formatFullDate(committedBirthDate)} at ${formatTime(committedBirthDate)}`,
      },
      { label: 'Calculated As Of', value: formatFullDate(effectiveAsOf) },
    ];
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    return {
      title: 'Chronological Age Result',
      headlineValue: `${ageBreakdown.years}`,
      headlineLabel: `years, ${ageBreakdown.months} months, ${ageBreakdown.days} days`,
      accentColor: ACCENT.hex,
      meta: [committedAsOfMode === 'today' ? 'As of Today' : `As of ${formatShortDate(effectiveAsOf)}`],
      sections,
      pdfOnlySections,
      imageSections: sections,
      disclaimer: isApproximate
        ? 'For informational purposes only. Hour/minute/second totals are approximate since an exact time of birth was not provided.'
        : 'For informational purposes only.',
      fileNameBase: `chronological-age-${ageBreakdown.years}`,
    };
  }, [hasCalculated, hasError, ageBreakdown, committedBirthDate, committedBirthTimeUnknown, effectiveAsOf, nextBirthday, nextMilestone, petYears, committedAsOfMode, isApproximate]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  // --- MISC HANDLERS ---
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
        aria-expanded={downloadMenuOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-neutral-600 disabled:hover:border-neutral-200 disabled:hover:shadow-sm disabled:active:scale-100"
        title={report ? "Download your result" : "Calculate a result first"}
      >
        <SafeIcon icon={downloadingFormat ? FiLoader : FiDownload} className={`w-3.5 h-3.5 flex-shrink-0 ${downloadingFormat ? 'animate-spin' : ''}`} />
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">{downloadingFormat ? 'Preparing…' : 'Download'}</span>
        <SafeIcon icon={FiChevronDown} className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${downloadMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {downloadMenuOpen && (
        <div role="menu" className="absolute right-0 sm:right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden">
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('image'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiImage} className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PNG Image</span>
              <span className="block text-xs text-neutral-400 mt-0.5">Quick shareable card</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('pdf'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer border-t border-neutral-100 dark:border-neutral-700/50">
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
      <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">Like this? Please share</span>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => onShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:ring-blue-200 dark:hover:ring-blue-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer" title="Share this calculator">
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onEmailShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:ring-amber-200 dark:hover:ring-amber-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer" title="Share via email">
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onCopyLink?.()} className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'bg-violet-50 dark:bg-violet-500/10 ring-violet-100 dark:ring-violet-800/40 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:shadow-md hover:ring-violet-200 dark:hover:ring-violet-700/60 hover:-translate-y-0.5'}`} title="Copy link to this calculator">
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? "Copied" : "Link"}</span>
        </button>
      </div>
    </div>
  );

  const springConfig = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 50, damping: 12, mass: 0.8 };

  return (
    <div className="space-y-5">
      {/* INPUT CARD */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <SafeIcon icon={FiCalendar} className="w-3 h-3" />
              Date & Time Based
            </span>
          </div>

          <div>
            <div className={fieldLabelRowClass}>
              <label htmlFor="birthDate" className={fieldLabelClass}>Date & Time of Birth</label>
              <InfoTip text="Your date of birth (and time, if you add it) is used to calculate your exact age. Never shared or stored beyond this calculation." />
            </div>
            <DateTimePicker
              id="birthDate"
              value={birthDate}
              onChange={handleBirthDateChange}
              includeTime
              timeUnknown={birthTimeUnknown}
              onTimeUnknownChange={setBirthTimeUnknown}
              timeUnknownLabel="Don't know the exact birth time? Leave this field empty — it'll default to midnight."
              minDate={MIN_BIRTH_DATE}
              maxDate={new Date()}
              placeholder="Select your date of birth"
              ariaLabel="Date of birth"
              error={Boolean(birthDateError)}
            />
            <AnimatePresence>
              {birthDateError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs font-semibold text-red-500 mt-1.5 flex items-center gap-1.5"
                >
                  <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
                  {birthDateError}
                </motion.p>
              )}
            </AnimatePresence>
            {!birthDateError && (
              <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mt-1.5">
                Adding a time of birth makes hour/minute/second totals exact. Leave it unset and it defaults to midnight.
              </p>
            )}
          </div>

          {/* Constrained to 2/3 width on large screens (full width on
              mobile/tablet), same as the Reference Values control in
              WHRCalculator.tsx / Calculation Mode in BMRCalculator.tsx, so
              it doesn't stretch edge-to-edge on wide layouts. */}
          <div className="lg:w-2/3">
            <div className={fieldLabelRowClass}>
              <span className={fieldLabelClass}>Calculate Age As Of</span>
              <InfoTip text="Defaults to right now. Switch to a custom date to see your age on a specific past or future day." />
            </div>
            <SegmentedToggle
              value={asOfMode}
              onChange={setAsOfMode}
              groupId="as-of-mode"
              ariaLabel="Calculate age as of"
              options={[{ value: 'today', label: 'Today' }, { value: 'custom', label: 'Custom Date' }]}
            />
            {asOfMode === 'custom' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden">
                <DateTimePicker
                  value={asOfDate}
                  onChange={setAsOfDate}
                  includeTime
                  timeUnknown={asOfTimeUnknown}
                  onTimeUnknownChange={setAsOfTimeUnknown}
                  timeUnknownLabel="Don't know the exact time? Leave this field empty — it'll default to midnight."
                  ariaLabel="Calculate age as of this date"
                  placeholder="Select a date"
                />
              </motion.div>
            )}
          </div>

        </div>
      </div>

      {/* Card-level footnote for the "*" on the Time label(s) above — sits
          outside the card's own border, in the gap before the action
          buttons, same placement as the "* Optional — not required to
          calculate your BMR." line under BMRCalculator's Input Fields
          card. */}
      <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 text-right">
        * Optional — not required to calculate your age.
      </p>

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
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <rect x="20" y="24" width="60" height="52" rx="6" stroke="currentColor" strokeWidth="5" />
            <line x1="20" y1="40" x2="80" y2="40" stroke="currentColor" strokeWidth="5" />
            <line x1="32" y1="16" x2="32" y2="30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <line x1="68" y1="16" x2="68" y2="30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <circle cx="50" cy="58" r="9" stroke="currentColor" strokeWidth="4" />
            <line x1="50" y1="58" x2="50" y2="52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="58" x2="55" y2="61" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Enter your date of birth above, then press Calculate to see your exact age, next birthday, and more.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {hasCalculated && !hasError && ageBreakdown && committedBirthDate && effectiveAsOf && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="space-y-5"
        >
          {/* RESULT HEADER ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your Age Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          {/* HEADLINE — live-ticking exact age (see AgeHeadlineCard above) */}
          <AgeHeadlineCard
            years={ageBreakdown.years}
            months={ageBreakdown.months}
            days={ageBreakdown.days}
            totalSeconds={ageBreakdown.totalSeconds}
            birthDate={committedBirthDate}
            asOfDate={effectiveAsOf}
            isToday={committedAsOfMode === 'today'}
            isApproximate={isApproximate}
            isLeapBirthday={isLeapBirthday}
            replayKey={`${committedBirthDate.getTime()}-${committedAsOfMode}-${committedAsOfDate ? committedAsOfDate.getTime() : 0}`}
          />

          {/* EXACT TOTALS */}
          <ResultCard>
            <SectionHeader
              icon={FiBarChart2}
              title="Exact Totals"
              subtitle={
                isApproximate ? (
                  <span className="inline-flex items-start gap-1.5">
                    <SafeIcon icon={FiInfo} className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>Hour, minute &amp; second totals are approximate — exact time wasn't provided.</span>
                  </span>
                ) : (
                  'Your time alive, counted in whole units.'
                )
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'Weeks', value: ageBreakdown.totalWeeks, icon: FiCalendar, tone: 'indigo' },
                { label: 'Days', value: ageBreakdown.totalDays, icon: FiSun, tone: 'amber' },
                { label: 'Hours', value: ageBreakdown.totalHours, icon: FiClock, tone: 'sky' },
                { label: 'Minutes', value: ageBreakdown.totalMinutes, icon: FiZap, tone: 'emerald' },
              ] as const).map((row) => (
                <StatTile key={row.label} tone={row.tone} icon={row.icon} value={formatWithCommas(row.value)} label={row.label} />
              ))}
            </div>
          </ResultCard>

          {/* NEXT BIRTHDAY (see NextBirthdayCard above) */}
          {nextBirthday && effectiveAsOf && (
            <NextBirthdayCard
              key={`${committedBirthDate.getTime()}-${committedAsOfMode}-${committedAsOfDate ? committedAsOfDate.getTime() : 0}`}
              info={nextBirthday}
              asOf={effectiveAsOf}
              isLive={committedAsOfMode === 'today'}
              progressPercent={yearProgressPercent}
            />
          )}

          {/* MILESTONE BIRTHDAYS */}
          {milestones.length > 0 && (
            <ResultCard>
              <SectionHeader
                icon={FiAward}
                title="Milestone Birthdays"
                subtitle="Notable birthdays, past and still to come."
                badge={milestoneProgress ? <CountBadge achieved={milestoneProgress.achieved} total={milestoneProgress.total} /> : undefined}
              />
              <MilestoneTimeline
                label="Milestone birthdays"
                items={milestones.map((m) => {
                  const away = calendarDaysAway(m.date, effectiveAsOf);
                  return {
                    key: m.age,
                    state: m.achieved ? 'reached' : m === nextMilestone ? 'next' : 'upcoming',
                    title: m.label,
                    subtitle: `${m.dayOfWeek}, ${formatShortDate(m.date)}`,
                    status: m.achieved ? 'Reached' : formatAway(away),
                    statusTitle: m.achieved ? undefined : `${formatWithCommas(Math.max(0, away))} ${plural(away, 'day', 'days')} away`,
                  };
                })}
              />
            </ResultCard>
          )}

          {/* DAY-COUNT MILESTONES */}
          {dayMilestones.length > 0 && (
            <ResultCard>
              <SectionHeader
                icon={FiTrendingUp}
                title="Day-Count Milestones"
                subtitle="Anniversaries counted in raw days alive, not birthdays."
                badge={dayMilestoneProgress ? <CountBadge achieved={dayMilestoneProgress.achieved} total={dayMilestoneProgress.total} /> : undefined}
              />
              {/* sm and up: the zig-zag trail. Phones: the same vertical
                  timeline as Milestone Birthdays, since seven labelled
                  nodes can't fit a ~300px-wide zig-zag legibly. */}
              <div className="hidden sm:block">
                <DayCountTrail items={dayMilestones} uid={dayMilestoneUid} />
              </div>
              <div className="sm:hidden">
                {(() => {
                  const nextDay = dayMilestones.find((dm) => !dm.achieved);
                  return (
                    <MilestoneTimeline
                      label="Day-count milestones"
                      items={dayMilestones.map((dm) => {
                        const away = calendarDaysAway(dm.date, effectiveAsOf);
                        return {
                          key: dm.dayCount,
                          state: dm.achieved ? 'reached' : dm === nextDay ? 'next' : 'upcoming',
                          title: `${formatWithCommas(dm.dayCount)} days`,
                          subtitle: `${dm.date.toLocaleDateString(undefined, { weekday: 'short' })}, ${formatShortDate(dm.date)}`,
                          status: dm.achieved ? 'Reached' : formatAway(away),
                          statusTitle: dm.achieved ? undefined : `${formatWithCommas(Math.max(0, away))} ${plural(away, 'day', 'days')} away`,
                        };
                      })}
                    />
                  );
                })()}
              </div>
            </ResultCard>
          )}

          {/* PET YEARS */}
          {petYears && (
            <ResultCard>
              <SectionHeader
                icon={FiHeart}
                title="Your Age, In Pet Years"
                subtitle="A playful equivalence based on modern, non-linear aging tables."
                tip="A playful equivalence using the modern, non-linear dog/cat aging tables — not the old '×7' myth, and not a biological claim."
              />
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatTile tone="amber" emoji="🐶" value={String(petYears.dogYears)} label="Dog Years" maxRem={2.25} />
                <StatTile tone="sky" emoji="🐱" value={String(petYears.catYears)} label="Cat Years" maxRem={2.25} />
              </div>

              {/* Same-scale comparison: you vs. dog vs. cat */}
              <div className="space-y-2.5">
                {[
                  { label: 'You', icon: '🙂', value: ageBreakdown.years, barClass: 'from-violet-400 to-violet-600', chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200/70 dark:border-violet-800/50' },
                  { label: 'Dog', icon: '🐶', value: petYears.dogYears, barClass: 'from-amber-400 to-amber-600', chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/50' },
                  { label: 'Cat', icon: '🐱', value: petYears.catYears, barClass: 'from-sky-400 to-sky-600', chip: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200/70 dark:border-sky-800/50' },
                ].map((row) => {
                  const maxVal = Math.max(ageBreakdown.years, petYears.dogYears, petYears.catYears, 1);
                  const widthPct = Math.max(4, (row.value / maxVal) * 100);
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-14 flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400">
                        <span aria-hidden="true">{row.icon}</span>
                        {row.label}
                      </span>
                      <div className="flex-1 min-w-0 h-3 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 overflow-hidden">
                        <div
                          className={`relative h-full rounded-full bg-gradient-to-r ${row.barClass} motion-safe:transition-[width] motion-safe:duration-700 ease-out`}
                          style={{ width: `${widthPct}%` }}
                        >
                          <span className="absolute inset-y-0 right-0 w-2 rounded-full bg-white/40" aria-hidden="true" />
                        </div>
                      </div>
                      <span className={`flex-shrink-0 min-w-[2.5rem] text-center text-[11px] font-extrabold tabular-nums px-2 py-0.5 rounded-full border ${row.chip}`}>{row.value}</span>
                    </div>
                  );
                })}
              </div>
            </ResultCard>
          )}

          {/* LIFETIME ESTIMATES */}
          {lifetimeEstimates && (
            <ResultCard>
              <SectionHeader
                icon={FiActivity}
                title="Lifetime Estimates"
                subtitle="Population-average estimates since birth."
                tip="Population-average estimates based on published resting rates — not personal biometrics."
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatTile tone="rose" icon={FiHeart} value={formatWithCommas(lifetimeEstimates.estimatedHeartbeats)} label="Heartbeats" sub="estimated, since birth" />
                <StatTile tone="sky" icon={FiWind} value={formatWithCommas(lifetimeEstimates.estimatedBreaths)} label="Breaths" sub="estimated, since birth" />
                <StatTile tone="violet" icon={FiMoon} value={String(lifetimeEstimates.estimatedSleepYears)} label="Years Asleep" sub="estimated lifetime total" />
              </div>
            </ResultCard>
          )}

          {/* CURIOSITIES — always visible; same card + header as every other section */}
          <ResultCard>
            <SectionHeader icon={FiStar} title="Curiosities" subtitle="Fun calendar facts about your birthdays." />
            <div className="space-y-3">
                {bornInLeapYear && <FactRow icon={FiStar}>You were born in a leap year.</FactRow>}
                {nextBirthday && nextSameWeekday && (
                  <FactRow icon={FiCalendar}>
                    {nextBirthday.isToday ? (
                      <>Your birthday is today, a <strong className="font-bold text-neutral-900 dark:text-white">{nextBirthday.dayOfWeek}</strong>.</>
                    ) : (
                      <>Your next birthday, in <strong className="font-bold text-neutral-900 dark:text-white">{nextBirthday.date.getFullYear()}</strong>, falls on a <strong className="font-bold text-neutral-900 dark:text-white">{nextBirthday.dayOfWeek}</strong>.</>
                    )}{' '}
                    It won't land on a {nextBirthday.dayOfWeek} again until <strong className="font-bold text-neutral-900 dark:text-white">{nextSameWeekday.year}</strong>.
                  </FactRow>
                )}
                {maxWeekdayCount > 0 && (
                  <div className="rounded-xl bg-white/80 dark:bg-neutral-900/40 border border-neutral-200/70 dark:border-neutral-700/50 p-3.5 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <SafeIcon icon={FiBarChart2} className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400 flex-shrink-0" />
                      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Your past birthdays by day of the week</p>
                    </div>
                    <div
                      className="grid grid-cols-7 gap-1.5 items-end h-28"
                      role="img"
                      aria-label={`Past birthdays by weekday: ${weekdayTally.map((wd) => `${wd.day} ${wd.count}`).join(', ')}`}
                    >
                      {weekdayTally.map((wd) => {
                        const isPeak = wd.count === maxWeekdayCount;
                        const barHeightPct = Math.max(8, (wd.count / maxWeekdayCount) * 100);
                        return (
                          <div key={wd.day} className="h-full min-w-0 flex flex-col items-center justify-end gap-1.5" aria-hidden="true">
                            <span className={`text-[11px] font-extrabold tabular-nums ${isPeak ? 'text-violet-600 dark:text-violet-300' : 'text-neutral-700 dark:text-neutral-300'}`}>{wd.count}</span>
                            <div className="w-full flex-1 flex items-end rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700/50 overflow-hidden">
                              <div
                                className={`w-full rounded-t-md bg-gradient-to-t motion-safe:transition-[height] motion-safe:duration-500 ease-out ${
                                  isPeak ? 'from-violet-600 to-violet-400' : 'from-violet-300 to-violet-200 dark:from-violet-700 dark:to-violet-600'
                                }`}
                                style={{ height: `${barHeightPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400">{wd.day.slice(0, 3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </ResultCard>
        </motion.div>
      )}

      {renderShareBar()}

      {/* DISCLAIMER */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator provides general chronological information for informational and entertainment purposes only. Lifetime estimates (heartbeats, breaths, sleep) are population averages, not personal biometrics, and dog/cat-year equivalents are a playful comparison, not a biological or veterinary claim.
        </p>
      </div>

      {/* SOURCES ACCORDION */}
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
              <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources</span>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">
                {DATE_SOURCES.length} references — every convention and estimate used above, cited
              </span>
            </div>
          </div>
          <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${showSources ? 'rotate-180' : ''}`}>
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
              {DATE_SOURCES.map((source, i) => (
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
              Milestone-age selection (18, 21, 30, 40…) reflects commonly-referenced round-number and cultural birthdays for general interest, not a claim about any specific jurisdiction's legal ages.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChronologicalAgeCalculator;
