"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence, animate } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import DateTimePicker from '@/components/common/DateTimePicker';
import * as FiIcons from 'react-icons/fi';
import {
  getNextBirthdayInfo,
  getCountdownBreakdown,
  getGoldenBirthday,
  getDoubleGoldenBirthday,
  getPlatinumBirthday,
  getUpcomingBirthdays,
  getDayOfYearBorn,
  validateBirthdayInput,
  formatWithCommas,
  isFeb29Birthday,
  getWesternZodiac,
  getChineseZodiac,
  getBirthMonthLore,
  getGeneration,
  getLifePathNumber,
  BIRTHDAY_SOURCES,
  type NextBirthdayInfo,
  type CountdownBreakdown,
  type GoldenBirthdayInfo,
  type DoubleGoldenBirthdayInfo,
  type PlatinumBirthdayInfo,
  type UpcomingBirthday,
  type DayOfYearInfo,
  type WesternZodiacInfo,
  type WesternZodiacSign,
  type ChineseZodiacInfo,
  type ChineseZodiacAnimal,
  type BirthMonthLoreInfo,
  type GenerationInfo,
  type LifePathNumberInfo,
} from '@/utils/calculators/birthdayLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiCalendar, FiGift, FiAlertCircle, FiInfo, FiArrowDown,
  FiFileText, FiLoader, FiRotateCcw, FiCheckCircle, FiExternalLink, FiStar,
  FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown, FiDownload,
  FiImage, FiSunrise, FiFlag, FiTrendingUp,
  FiMoon, FiCompass, FiDroplet, FiLayers, FiHexagon,
} = FiIcons;

type IconType = React.ComponentProps<typeof SafeIcon>['icon'];

interface BirthdayCalculatorProps {
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
// Rose/pink, distinct from Age's violet, BMR's amber, and the
// category-driven palettes of BMI/WHR — reads as festive/celebratory
// without clashing with any sibling calculator's own identity. Same
// text/bg/border/grad/hex token shape as every other calculator's ACCENT
// so it drops into the shared components unmodified.
const ACCENT = {
  text: 'text-rose-600 dark:text-rose-400',
  bg: 'bg-rose-500',
  grad: 'from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-800',
  border: 'border-rose-500 dark:border-rose-400',
  bgLight: 'bg-rose-50 dark:bg-rose-900/20',
  shadow: 'shadow-rose-500/10',
  hex: '#e11d48',
};

// Gold, reserved for the Golden Birthday card only — the one place a
// second accent earns its keep, since the whole point of that card is
// "this one is special."
const GOLD = {
  from: '#fcd34d',
  to: '#d97706',
  text: 'text-amber-600 dark:text-amber-400',
  chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50',
};

// Cool silver-grey, reserved for the Platinum Birthday mini-card — reads
// as "a different, cooler metal" next to Gold and Double Golden's warm
// rose, the same way real platinum jewelry reads next to gold.
const PLATINUM = {
  from: '#cbd5e1',
  to: '#64748b',
  chip: 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60',
};

// Sky blue, reserved for the Upcoming Birthdays card only — a "planner /
// calendar" color next to Golden's warm gold-foil, so the two sections
// that now sit back-to-back read as clearly different at a glance, not
// just structurally different.
const UPCOMING = {
  from: '#38bdf8',
  to: '#0369a1',
  text: 'text-sky-600 dark:text-sky-400',
  chip: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-800/50',
};

const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";

// --- ACCESSIBLE INFO TOOLTIP --- (identical contract to the other calculators' InfoTip)
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

// --- FORMATTING HELPERS --- (same conventions as ChronologicalAgeCalculator.tsx)
const formatFullDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const formatShortDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// --- SLOW, EASED "ANCHOR SCROLL" --- (identical to BMICalculator.tsx /
// ChronologicalAgeCalculator.tsx — the Calculate button here was using the
// browser's native `window.scrollTo({ behavior: 'smooth' })`, which runs a
// short, fixed-feel scroll that's noticeably quicker than this eased
// 1800ms animation the other calculators use, hence the "too fast, doesn't
// match" mismatch.)
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
    // Explicit behavior: 'auto' — see the same fix in
    // ChronologicalAgeCalculator.tsx's copy of this function: the plain
    // `window.scrollTo(0, y)` form inherits any global CSS
    // `scroll-behavior: smooth`, which fights this manual per-frame
    // easing and causes visible stutter.
    window.scrollTo({ top: startY + distance * easeInOutCubic(progress), left: 0, behavior: 'auto' });
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

const plural = (n: number, singular: string, pluralForm: string): string => (n === 1 ? singular : pluralForm);

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

const MIN_BIRTH_DATE = new Date(new Date().getFullYear() - 130, 0, 1);

// Shared easing for every entrance in the hero card: fast start, long soft
// landing — reads as "settling into place" rather than mechanical. Same
// curve ChronologicalAgeCalculator.tsx uses for its own headline/Next
// Birthday card entrances, kept identical so the two calculators feel
// like the same product.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

// One-shot confetti burst fired from the calendar leaf the moment the
// birthday arrives. Deterministic (no Math.random) so it looks identical
// every time and is safe for SSR/hydration — same approach and palette as
// ChronologicalAgeCalculator.tsx's own confetti burst.
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

// Counts a number up from 0 on first render — used for the "weeks/days"
// tiles when the countdown isn't live (a fixed "as of" date). The final
// value is rendered invisibly underneath so the tile is already its full
// width from the first frame. With reduced motion it simply shows the
// value.
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

// A single countdown unit re-pulses (brief scale/opacity pop) only on the
// tick where its own value actually changes — the "hrs/min/sec" digits
// stay put, only the changed one pops. Distinct from a flip-clock: no
// characters travel, the whole chip just gives a soft heartbeat. Used by
// the gift-tag countdown below.
const TagPulse: React.FC<{ value: number; pad?: number }> = ({ value, pad = 2 }) => {
  const reduced = useReducedMotion();
  const text = String(value).padStart(pad, '0');
  return (
    <span className="relative inline-block tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="inline-block"
          initial={reduced ? false : { scale: 0.82, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

// Small scattered confetti pieces — squares and dashes in the gift-wrap
// palette, gently twinkling. Purely decorative; static under
// prefers-reduced-motion. Replaces the Age Calculator's night-sky star
// field with something that reads as "party," not "midnight."
const NEXT_BDAY_CONFETTI_FIELD = [
  { l: '8%',  t: '14%', s: 5, r: 12,  d: 0,   c: '#fde68a' }, { l: '22%', t: '9%',  s: 4, r: -20, d: 0.8, c: '#fecdd3' },
  { l: '38%', t: '19%', s: 6, r: 40,  d: 1.6, c: '#fde68a' }, { l: '55%', t: '8%',  s: 4, r: -8,  d: 0.4, c: '#fda4af' },
  { l: '70%', t: '17%', s: 5, r: 25,  d: 2.1, c: '#fcd34d' }, { l: '84%', t: '10%', s: 4, r: -35, d: 1.2, c: '#fecdd3' },
  { l: '93%', t: '25%', s: 5, r: 15,  d: 0.2, c: '#fde68a' }, { l: '14%', t: '35%', s: 4, r: -12, d: 1.9, c: '#fda4af' },
  { l: '62%', t: '31%', s: 5, r: 30,  d: 2.6, c: '#fcd34d' }, { l: '90%', t: '47%', s: 4, r: -22, d: 1.0, c: '#fecdd3' },
  { l: '4%',  t: '53%', s: 5, r: 18,  d: 2.4, c: '#fde68a' },
];

// --- TILE TONES --- (same palette convention as the other calculators)
const TILE_TONES = {
  rose:    { from: '#f43f5e', to: '#be123c' },
  indigo:  { from: '#6366f1', to: '#4338ca' },
  sky:     { from: '#0ea5e9', to: '#0369a1' },
  emerald: { from: '#10b981', to: '#047857' },
  amber:   { from: '#f59e0b', to: '#b45309' },
  violet:  { from: '#8b5cf6', to: '#6d28d9' },
} as const;
type TileTone = keyof typeof TILE_TONES;

const fitNumberStyle = (text: string, maxRem: number, minRem = 0.875): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(86 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// --- SHARED RESULT SHELL ---
const ResultCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-white via-neutral-50 to-rose-50/40 dark:from-neutral-800 dark:via-neutral-800 dark:to-rose-900/10 shadow-sm p-4 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-rose-400/15 via-amber-400/10 to-transparent blur-2xl" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-20 -left-14 w-56 h-56 rounded-full bg-gradient-to-tr from-indigo-400/10 via-sky-400/10 to-transparent blur-2xl" aria-hidden="true" />
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
  // Per-section identity color for the icon square, so sections that want
  // to read as visually distinct at a glance (Golden Birthday's gold,
  // Upcoming Birthdays' sky) aren't stuck under the app-wide rose/amber
  // used by every other section header.
  accentClassName?: string;
}> = ({ icon, title, subtitle, tip, badge, mb = 'mb-5', accentClassName = 'bg-gradient-to-br from-rose-500 to-amber-500 shadow-rose-500/30' }) => (
  <div className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 ${mb}`}>
    <div className="flex items-start gap-2.5 min-w-0">
      <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${accentClassName}`} aria-hidden="true">
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

// A labeled fact chip — the same "gradient wash + glowing icon orb" recipe
// ProfileDetailCard uses for its own fact cards below, scaled down to chip
// size and given its own TILE_TONES color (rather than all three sharing
// one color) so this trio reads as richly varied as that card's, instead
// of three identical boxes with only the label changing.
const FactChip: React.FC<{ tone: TileTone; icon: IconType; label: string; value: string }> = ({ tone, icon, label, value }) => {
  const t = TILE_TONES[tone];
  return (
    <div
      className="group/chip relative flex items-center gap-3 rounded-2xl border overflow-hidden px-3.5 py-3 h-full motion-safe:transition-all motion-safe:duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
      style={{ borderColor: `${t.from}33`, background: `linear-gradient(160deg, ${t.from}1c 0%, ${t.from}08 55%, transparent 100%)`, boxShadow: `0 1px 3px ${t.from}17` }}
    >
      {/* soft color bloom, revealed on hover — the same "glow behind the
          content" language the richer cards elsewhere in this page use,
          scaled down to chip size via a named group so it never fires
          off the panel-level hover this chip sits inside. */}
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover/chip:opacity-70 motion-safe:transition-opacity motion-safe:duration-500"
        style={{ background: `radial-gradient(circle, ${t.from}55 0%, transparent 70%)` }}
        aria-hidden="true"
      />
      <span
        className="relative z-10 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-white/50 dark:ring-white/10 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, boxShadow: `0 8px 18px -6px ${t.from}99` }}
        aria-hidden="true"
      >
        {/* glassy top sheen, matching the Golden Birthday medallion's
            highlight so the icon orb reads as lacquered, not flat */}
        <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-white/25 blur-[3px]" />
        <SafeIcon icon={icon} className="relative w-4 h-4 text-white drop-shadow-sm" />
      </span>
      <div className="relative z-10 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 leading-none">{label}</p>
        {/* Was truncate + single line, which clipped "Q2 of the year" mid-word.
            Values here are short but variable-length, so let it wrap onto a
            second line instead of losing content — the chip's h-full plus
            the grid row's shared height absorbs the extra line cleanly. */}
        <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100 mt-1 leading-snug break-words">{value}</p>
      </div>
    </div>
  );
};

// A radial "how far through the year" gauge, restyled as a genuine
// medallion — a solid coin face behind the progress ring, a white edge
// ring and a lifted shadow like the Golden Birthday headline's own
// medallion — rather than a bare ring floating on the card background.
// Still this card's own rose-to-amber identity (the same pair its
// SectionHeader icon square already uses), so it reads as this card's
// fill, not a borrow of Golden's gold or Upcoming's sky. No pulsing halo
// here, unlike Golden's medallion — that pulse means "still ahead of
// you"; this ring reports a fixed historical fact, so it stays still.
const YearPositionRing: React.FC<{ dayOfYear: number; yearLength: number; uid: string }> = ({ dayOfYear, yearLength, uid }) => {
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, '');
  const radius = 42;
  const faceRadius = 34;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, (dayOfYear / yearLength) * 100));
  const dash = (pct / 100) * circumference;
  return (
    <div
      className="relative w-28 h-28 flex-shrink-0 mx-auto sm:mx-0 rounded-full ring-4 ring-white/70 dark:ring-neutral-900/60 overflow-hidden"
      style={{ containerType: 'inline-size', boxShadow: '0 14px 30px -12px rgba(244,63,94,0.45)' }}
    >
      {/* glassy top sheen, same coin-highlight treatment as the Golden
          Birthday medallion, so this ring reads as a lacquered coin face
          rather than a flat gauge */}
      <span className="pointer-events-none absolute z-10 inset-x-4 top-2 h-1/3 rounded-full bg-white/30 dark:bg-white/10 blur-md" aria-hidden="true" />
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
        {/* solid coin face, so the ring reads as a medallion rather than a
            hollow gauge floating over the panel behind it */}
        <circle cx="50" cy="50" r={faceRadius} className="fill-white dark:fill-neutral-900" />
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-neutral-100 dark:stroke-neutral-800" />
        <defs>
          <linearGradient id={`yearRing-${safeUid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#yearRing-${safeUid})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(217,119,6,0.35))' }}
        />
      </svg>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span
          className="block font-extrabold tabular-nums text-neutral-900 dark:text-white leading-none whitespace-nowrap"
          style={fitNumberStyle(`${dayOfYear}`, 1.75)}
        >
          {dayOfYear}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mt-1.5 whitespace-nowrap">
          of {yearLength} days
        </span>
      </div>
    </div>
  );
};

// --- ATTENTION "NEXT" CHIP ---
// Same contract as the Age Calculator's own NextChip: a soft halo, in the
// milestone's own colour, breathes outward every ~2s so a still-upcoming
// milestone reads as "live" next to the flat, static chip a reached one
// gets. No movement or size change, so nothing shifts next to the text.
// Static under prefers-reduced-motion.
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

// Reached-count badge for a SectionHeader, same shape as the Age
// Calculator's CountBadge (Milestone Birthdays, Day-Count Milestones) —
// amber here since it sits on the Golden Birthday card specifically.
const CountBadge: React.FC<{ achieved: number; total: number }> = ({ achieved, total }) => (
  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap tabular-nums bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-200/70 dark:border-amber-800/50">
    {achieved} of {total} reached
  </span>
);

// --- NEXT BIRTHDAY HERO ---
// Age Calculator's Next Birthday card is a "midnight" scene: night sky,
// tear-off calendar leaf, flip-digit clock, glowing linear track. This is
// this calculator's own idea for the same job — a wrapped present whose
// bow gradually unties as the year turns, on a party backdrop instead of
// a night sky. Same underlying data (turningAge, live countdown,
// dayOfWeek, isToday/confetti, year-progress%, leap note) and the same
// ResultCard-adjacent conventions (SectionHeader-style header row,
// aria-hidden visuals + one sr-only summary sentence), just a different
// object doing the storytelling.
interface NextBirthdayHeroProps {
  nextBirthday: NextBirthdayInfo;
  breakdown: CountdownBreakdown;
  progressPercent: number;
  isLeapBirthday?: boolean;
}

const NextBirthdayHero: React.FC<NextBirthdayHeroProps> = ({ nextBirthday, breakdown, progressPercent, isLeapBirthday = false }) => {
  const reduced = useReducedMotion();
  const { date, daysUntil, dayOfWeek, turningAge, isToday } = nextBirthday;
  const pct = Math.max(0, Math.min(100, progressPercent));

  // How far the bow has untied, 0 (freshly tied) -> 1 (fully loose), driven
  // by year-progress. On the day itself it's fully untied regardless.
  const untie = isToday ? 1 : pct / 100;
  const loopSwing = 16 + untie * 34; // degrees each loop rotates outward
  const knotScale = 1 - untie * 0.3;

  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE_OUT },
        };

  const tiles: { label: string; value: number; pad?: number }[] = [
    { label: plural(breakdown.days, 'day', 'days'), value: breakdown.days, pad: 1 },
    { label: 'hrs', value: breakdown.hours },
    { label: 'min', value: breakdown.minutes },
    { label: 'sec', value: breakdown.seconds },
  ];

  const monthShort = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-rose-300/25 shadow-[0_16px_48px_-16px_rgba(159,18,57,0.75)] p-4 sm:p-6"
      style={{ background: 'linear-gradient(135deg, #881337 0%, #be123c 55%, #b45309 100%)' }}
    >
      {/* WRAPPING-PAPER TEXTURE — faint diagonal stripe, purely decorative */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 2px, transparent 2px, transparent 26px)' }}
        aria-hidden="true"
      />
      {/* Warm glow that brightens the closer the birthday gets, same idea
          as a "dawn" edge but pooled behind the gift instead of the floor. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-[10%] -right-[10%] h-48 rounded-full bg-gradient-to-t from-amber-400 via-rose-400/60 to-transparent blur-3xl"
        style={{ opacity: 0.16 + pct * 0.004 }}
        animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {NEXT_BDAY_CONFETTI_FIELD.map((s, i) =>
        reduced ? (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute opacity-50"
            style={{ left: s.l, top: s.t, width: s.s, height: s.s, background: s.c, transform: `rotate(${s.r}deg)`, borderRadius: i % 2 ? 1 : 9999 }}
          />
        ) : (
          <motion.span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: s.l, top: s.t, width: s.s, height: s.s, background: s.c, borderRadius: i % 2 ? 1 : 9999 }}
            animate={{ opacity: [0.15, 0.8, 0.15], rotate: [s.r, s.r + 40, s.r] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: s.d }}
          />
        )
      )}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" aria-hidden="true" />

      <div className="relative flex flex-col gap-4 sm:gap-5">
        {/* 1 · HEADER */}
        <motion.div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2" {...enter(0.05)}>
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-rose-400 to-amber-500 flex items-center justify-center shadow-sm shadow-rose-900/50" aria-hidden="true">
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

        {/* 2 · HERO — wrapped gift + bow, and a hanging gift-tag countdown */}
        <div className="flex items-center gap-5 sm:gap-7">
          {/* Present: a wrapped box with a criss-cross ribbon and a bow
              whose two loops swing open as the year progresses, fully
              open on the day itself — replaces the tear-off calendar leaf
              and the flip-digit mechanic with one continuous visual cue. */}
          <div className="relative flex-shrink-0 w-[90px] sm:w-[116px] pt-5">
            <div className="absolute inset-x-3 top-7 -bottom-1.5 rounded-2xl bg-black/15" aria-hidden="true" />
            <motion.div
              className="relative rounded-2xl overflow-hidden shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] text-center"
              style={{ background: 'linear-gradient(160deg, #fda4af 0%, #e11d48 55%, #9f1239 100%)' }}
              initial={reduced ? false : { opacity: 0, y: 14, rotate: 6 }}
              animate={{ opacity: 1, y: 0, rotate: isToday ? 0 : 2 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT }}
              whileHover={reduced ? undefined : { rotate: 0, y: -3, scale: 1.03 }}
            >
              {/* criss-cross ribbon */}
              <span className="pointer-events-none absolute inset-x-0 top-[38%] h-[20%] bg-gradient-to-b from-amber-300 to-amber-500" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[22%] bg-gradient-to-r from-amber-300 to-amber-500" aria-hidden="true" />

              <div className="relative pt-2 pb-2.5 sm:pt-2.5 sm:pb-3">
                <div className="text-[2rem] sm:text-5xl font-black leading-none tabular-nums text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
                  {date.getDate()}
                </div>
                <div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-50/95 drop-shadow-sm">{monthShort} · {dayOfWeek}</div>
              </div>
            </motion.div>

            {/* Bow — two loops rotate outward and the knot shrinks as
                "untie" goes from 0 (just wrapped) to 1 (fully loose). */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-8 sm:w-20 sm:h-9" aria-hidden="true">
              <motion.span
                className="absolute left-1/2 top-1/2 origin-right rounded-full border-2 border-amber-600/50"
                style={{ width: 26, height: 18, background: 'linear-gradient(135deg, #fde68a, #f59e0b)' }}
                animate={{ x: '-100%', y: '-50%', rotate: -loopSwing }}
                transition={{ duration: 1.1, ease: EASE_OUT }}
              />
              <motion.span
                className="absolute left-1/2 top-1/2 origin-left rounded-full border-2 border-amber-600/50"
                style={{ width: 26, height: 18, background: 'linear-gradient(225deg, #fde68a, #f59e0b)' }}
                animate={{ x: '0%', y: '-50%', rotate: loopSwing }}
                transition={{ duration: 1.1, ease: EASE_OUT }}
              />
              <motion.span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] bg-amber-400 border border-amber-600/60 shadow-sm"
                style={{ width: 12, height: 12 }}
                animate={{ scale: knotScale }}
                transition={{ duration: 1.1, ease: EASE_OUT }}
              />
            </div>

            {/* birthday-today: one-shot confetti burst, popped from the bow */}
            {isToday && !reduced && (
              <div className="pointer-events-none absolute left-1/2 top-2 w-0 h-0" aria-hidden="true">
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
            <motion.p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-rose-200/80 mb-2" {...enter(0.3)}>
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
                <p className="text-xs sm:text-sm font-medium text-rose-100/90 mt-1">You turn {turningAge} today</p>
              </motion.div>
            ) : (
              /* Gift-tag countdown: a row of small hanging tags rather than
                 a flip-clock grid — each pops gently the moment its own
                 number ticks over, the rest stay still. */
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2" aria-hidden="true">
                {tiles.map((t, i) => (
                  <motion.div key={i} className="relative pt-1.5" {...enter(0.35 + i * 0.08)}>
                    <span className="absolute left-1/2 -translate-x-1/2 top-0 w-1.5 h-1.5 rounded-full bg-white/25 ring-2 ring-white/10" />
                    <div className="rounded-lg rounded-tl-sm bg-white/10 backdrop-blur-sm border border-white/15 py-2 sm:py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <div className="text-xl sm:text-2xl font-extrabold text-white leading-none">
                        <TagPulse value={t.value} pad={t.pad ?? 2} />
                      </div>
                      <div className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-rose-200/80">{t.label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3 · RIBBON METER — a stitched thread from last birthday to next,
            with a little gift-tag marker riding along it. Same underlying
            year-progress % as Age's glowing track, told as "how much of
            the ribbon is left to unspool" instead of a filling bar. */}
        <motion.div {...enter(0.7)}>
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-200/80 mb-2">
            <span>Turned {turningAge - 1}</span>
            <span className="text-white tabular-nums">
              <CountUp value={Math.round(pct)} delay={0.8} duration={1.4} />% unwrapped
            </span>
            <span>Turning {turningAge}</span>
          </div>
          <div
            className="relative h-2 rounded-full"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.28) 0 6px, transparent 6px 12px)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Progress toward your next birthday"
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #fda4af 0%, #fbbf24 100%)' }}
              initial={reduced ? false : { width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.4, delay: 0.8, ease: EASE_OUT }}
            />
            <motion.span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-md bg-amber-300 ring-2 ring-white/70 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
              initial={reduced ? false : { left: '0%', rotate: -8 }}
              animate={{ left: `${pct}%`, rotate: [-8, 8, -8] }}
              transition={{ left: { duration: 1.4, delay: 0.8, ease: EASE_OUT }, rotate: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } }}
              aria-hidden="true"
            >
              <SafeIcon icon={FiGift} className="w-2.5 h-2.5 text-amber-900" />
            </motion.span>
          </div>
        </motion.div>

        {isLeapBirthday && (
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs font-semibold text-amber-200">
              Born on Feb 29 — a true leap-year baby. Observed on Feb 28 in non-leap years.
            </p>
          </div>
        )}
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

// --- GOLDEN BIRTHDAY TIMELINE ---
// Ported from the Age Calculator's MilestoneTimeline: the same connecting
// line (gradient-filled up to the last reached node), the same
// reached/next/upcoming node states, the same pulsing NextChip on the
// single soonest-unreached item, and the same status-pill shape. The one
// deliberate difference is that each row here keeps its own fixed accent
// (Gold / Double Golden's rose / Platinum's slate) rather than cycling a
// generic palette by index, since these are three specifically-named
// milestones, not an open-ended list — and the still-unreached node shows
// the target age itself (this calculator's own convention) rather than a
// generic star glyph.
interface GoldenTimelineItem {
  key: string;
  title: string;
  hint: string;
  age: number;
  date: Date;
  achieved: boolean;
  isToday: boolean;
  daysAway: number;
  hexFrom: string;
  hexTo: string;
  chipClass: string;
  pulse: string;
  pulseFade: string;
}

const GoldenMilestoneTimeline: React.FC<{ items: GoldenTimelineItem[] }> = ({ items }) => {
  const reduced = useReducedMotion();
  // Chronological order so "reached" nodes are always a leading run and the
  // line-fill math below (borrowed as-is from MilestoneTimeline) holds.
  const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime());
  const reachedCount = sorted.filter((it) => it.achieved).length;
  const nextIndex = sorted.findIndex((it) => !it.achieved);
  const fillPct = sorted.length > 1 && reachedCount > 0
    ? Math.min(100, ((reachedCount - 1) / (sorted.length - 1)) * 100)
    : 0;

  return (
    <div className="relative">
      {sorted.length > 1 && (
        <div className="absolute left-[23px] top-7 bottom-7 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true">
          <div
            className="w-full bg-gradient-to-b from-amber-400 to-rose-500 motion-safe:transition-[height] motion-safe:duration-500 ease-out"
            style={{ height: `${fillPct}%` }}
          />
        </div>
      )}
      <ol className="relative list-none m-0 p-0 space-y-1">
        {sorted.map((it, i) => {
          const isNext = i === nextIndex;
          const reached = it.achieved;
          return (
            <li
              key={it.key}
              className={`relative flex items-center gap-3 rounded-xl pl-1.5 pr-3 py-2.5 motion-safe:transition-colors motion-safe:duration-150 ${
                isNext
                  ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700'
                  : 'hover:bg-white/70 dark:hover:bg-neutral-900/30'
              }`}
            >
              <motion.span
                animate={isNext && !reduced ? { boxShadow: [`0 0 0 0 ${it.pulse}`, `0 0 0 7px ${it.pulseFade}`] } : undefined}
                transition={isNext && !reduced ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : undefined}
                className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 shadow-sm ${
                  reached || isNext
                    ? 'text-white'
                    : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400'
                }`}
                style={reached || isNext ? { background: `linear-gradient(135deg, ${it.hexFrom} 0%, ${it.hexTo} 100%)`, borderColor: it.hexTo } : undefined}
                aria-hidden="true"
              >
                {reached ? (
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-extrabold tabular-nums leading-none">{it.age}</span>
                )}
              </motion.span>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-neutral-800 dark:text-neutral-100">
                    <span className="truncate">{it.title}</span>
                    {isNext && (
                      <NextChip
                        label="Next up"
                        className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full"
                        pulse={it.pulse}
                        pulseFade={it.pulseFade}
                      />
                    )}
                  </p>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
                    {it.hint} &middot; {formatShortDate(it.date)}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-[11px] font-bold tabular-nums whitespace-nowrap px-2 py-0.5 rounded-full ${
                    reached || isNext
                      ? it.chipClass
                      : 'bg-neutral-100/80 dark:bg-neutral-800/70 text-neutral-500 dark:text-neutral-400 border border-neutral-200/70 dark:border-neutral-700/60'
                  }`}
                >
                  {reached ? 'Reached' : it.isToday ? 'Today! 🎉' : formatAway(it.daysAway)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// --- GOLDEN BIRTHDAY CARD ---
interface GoldenBirthdayCardProps {
  golden: GoldenBirthdayInfo;
  doubleGolden: DoubleGoldenBirthdayInfo;
  platinum: PlatinumBirthdayInfo;
}

const GoldenBirthdayCard: React.FC<GoldenBirthdayCardProps> = ({ golden: info, doubleGolden, platinum }) => {
  const reduced = useReducedMotion();

  // Reached-count badge: Golden + Double Golden always count; Platinum only
  // counts as its own milestone when it isn't already folded into Golden
  // (see the sameAsGolden note below) — otherwise "of 3" would overstate
  // how many distinct dates are actually being tracked.
  const milestoneTotal = platinum.sameAsGolden ? 2 : 3;
  const milestoneAchieved = [info.achieved, doubleGolden.achieved, ...(platinum.sameAsGolden ? [] : [platinum.achieved])]
    .filter(Boolean).length;

  const timelineItems: GoldenTimelineItem[] = [
    {
      key: 'golden', title: 'Golden Birthday', hint: `Age = birth day (${ordinal(info.goldenDay)})`,
      age: info.goldenDay, date: info.date, achieved: info.achieved, isToday: info.isToday, daysAway: info.daysAway,
      hexFrom: GOLD.from, hexTo: GOLD.to, chipClass: GOLD.chip,
      pulse: 'rgba(217,119,6,0.45)', pulseFade: 'rgba(217,119,6,0)',
    },
    {
      key: 'double', title: 'Double Golden Birthday', hint: 'Age = birth day \u00d7 2',
      age: doubleGolden.doubleGoldenAge, date: doubleGolden.date, achieved: doubleGolden.achieved, isToday: doubleGolden.isToday, daysAway: doubleGolden.daysAway,
      hexFrom: ACCENT.hex, hexTo: '#9f1239', chipClass: `${ACCENT.bgLight} ${ACCENT.text}`,
      pulse: 'rgba(225,29,72,0.45)', pulseFade: 'rgba(225,29,72,0)',
    },
    ...(platinum.sameAsGolden ? [] : [{
      key: 'platinum', title: 'Platinum Birthday', hint: 'Age = birth day, digits reversed',
      age: platinum.platinumAge, date: platinum.date, achieved: platinum.achieved, isToday: platinum.isToday, daysAway: platinum.daysAway,
      hexFrom: PLATINUM.from, hexTo: PLATINUM.to, chipClass: PLATINUM.chip,
      pulse: 'rgba(100,116,139,0.45)', pulseFade: 'rgba(100,116,139,0)',
    }]),
  ];

  return (
    <ResultCard>
      <SectionHeader
        icon={FiStar}
        title="Golden Birthday"
        subtitle="The birthday where your new age matches the day of the month you were born."
        tip="Also called a champagne or lucky birthday — a popular tradition, not an official or legally defined milestone."
        badge={<CountBadge achieved={milestoneAchieved} total={milestoneTotal} />}
        accentClassName="bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30"
      />

      {/* HEADLINE — glassy gradient medallion, pulsing while still ahead;
          the same treatment other cards use for their single hero stat,
          scaled down to sit inside a shared ResultCard rather than take a
          full-width band of its own. */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 to-rose-50/50 dark:from-amber-900/10 dark:to-rose-900/10 border border-amber-200/60 dark:border-amber-800/40 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="relative flex-shrink-0 mx-auto sm:mx-0">
            {!info.achieved && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                animate={!reduced ? { boxShadow: ['0 0 0 0 rgba(217,119,6,0.35)', '0 0 0 14px rgba(217,119,6,0)'] } : undefined}
                transition={!reduced ? { duration: 2, repeat: Infinity, ease: 'easeOut' } : undefined}
              />
            )}
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center text-white overflow-hidden ring-4 ring-white/60 dark:ring-neutral-900/50"
              style={{ background: `linear-gradient(135deg, ${GOLD.from} 0%, ${GOLD.to} 100%)`, boxShadow: '0 14px 30px -10px rgba(217,119,6,0.55)' }}
            >
              {/* faint watermark star + glassy top sheen, purely decorative */}
              <SafeIcon icon={FiStar} aria-hidden="true" className="pointer-events-none absolute -bottom-3 -right-2 w-14 h-14 text-white/15" />
              <div className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-full bg-white/15 blur-md" aria-hidden="true" />
              <span className="relative text-3xl sm:text-4xl font-extrabold leading-none tabular-nums drop-shadow-sm">{info.goldenDay}</span>
              <span className="relative text-[10px] font-bold uppercase tracking-wider mt-1">Golden Age</span>
            </div>
          </div>
          <div className="min-w-0 text-center sm:text-left">
            {info.achieved ? (
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${GOLD.chip}`}>
                <SafeIcon icon={FiCheckCircle} className="w-3 h-3" /> Already reached
              </span>
            ) : (
              <NextChip
                label={info.isToday ? 'Today! 🎉' : formatAway(info.daysAway)}
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${GOLD.chip}`}
                pulse="rgba(217,119,6,0.45)"
                pulseFade="rgba(217,119,6,0)"
              />
            )}
            <p className="mt-2.5 flex items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              <SafeIcon icon={FiCalendar} className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
              {formatFullDate(info.date)}
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Turning {info.goldenDay} on the {ordinal(info.goldenDay)} of the month.
            </p>
          </div>
        </div>
      </div>

      {/* Golden family timeline — Golden Birthday plus its two informal
          "missed it" variants, most relevant to early-month birth dates
          whose actual golden birthday already happened in childhood. Both
          variants are unofficial internet traditions with more than one
          competing definition in circulation, so the formulas used here
          (and why) are spelled out in Sources. */}
      <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800">
        <div className={fieldLabelRowClass}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            The Golden Birthday family
          </p>
          <InfoTip text="Unofficial internet traditions, not a single agreed formula — some sites define these terms differently. See Sources for exactly which version this calculator uses." />
        </div>
        <GoldenMilestoneTimeline items={timelineItems} />
        {platinum.sameAsGolden && (
          <p className="mt-2 text-xs font-medium text-neutral-400 dark:text-neutral-500 italic">
            Your Platinum Birthday isn't shown separately — it lands on the same day as your Golden Birthday above, since the {ordinal(info.goldenDay)} reversed is still the {ordinal(info.goldenDay)}.
          </p>
        )}
      </div>
    </ResultCard>
  );
};

// --- UPCOMING BIRTHDAYS: CALENDAR-PAGE TRAIL / TIMELINE ---
// This section's own visual idea rather than a re-skin of the Golden
// family's circular-badge-and-icon timeline above: every node is a tiny
// torn calendar page (month strip + day number), the literal object the
// "planner" sky identity already promises, threaded on one unbroken
// ribbon of a path instead of a dashed, only-partly-coloured trail. The
// very next birthday's page sits lifted and glowing with a small pulsing
// "gift" tab in its corner; every page further out lies flat, in ink-grey,
// on the same ribbon — there's no "reached" state to show since every
// item here is still ahead. Phones fall back to a vertical stack of the
// same calendar pages, connected by a single sky-gradient spine, so the
// motif reads identically at both sizes.
const UPCOMING_PULSE = 'rgba(14,165,233,0.4)';
const UPCOMING_PULSE_FADE = 'rgba(14,165,233,0)';

const monthShortOf = (d: Date): string => d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();

// A single calendar page — used identically by the desktop ribbon and the
// phone stack so the motif never looks like two different components.
const CalendarPageNode: React.FC<{ date: Date; isNext: boolean; size?: 'sm' | 'md' }> = ({ date, isNext, size = 'md' }) => {
  const reduced = useReducedMotion();
  const w = size === 'sm' ? 'w-10' : 'w-12';
  return (
    <motion.div
      animate={isNext && !reduced ? { boxShadow: [`0 0 0 0 ${UPCOMING_PULSE}`, `0 0 0 8px ${UPCOMING_PULSE_FADE}`] } : undefined}
      transition={isNext && !reduced ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : undefined}
      className={`relative flex-shrink-0 ${w} rounded-lg overflow-hidden border motion-safe:transition-transform motion-safe:duration-300 ${
        isNext
          ? 'border-sky-300 dark:border-sky-600 shadow-md shadow-sky-500/25 scale-110'
          : 'border-neutral-200 dark:border-neutral-700 shadow-sm shadow-neutral-900/5'
      }`}
    >
      <div
        className={`text-center py-0.5 text-[9px] font-extrabold uppercase tracking-wider leading-none ${
          isNext ? 'text-white' : 'text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
        }`}
        style={isNext ? { background: `linear-gradient(135deg, ${UPCOMING.from} 0%, ${UPCOMING.to} 100%)` } : undefined}
      >
        {monthShortOf(date)}
      </div>
      <div
        className={`text-center py-1 font-extrabold tabular-nums leading-none bg-white dark:bg-neutral-900 ${
          size === 'sm' ? 'text-sm' : 'text-base'
        } ${isNext ? 'text-sky-700 dark:text-sky-300' : 'text-neutral-500 dark:text-neutral-400'}`}
      >
        {date.getDate()}
      </div>
      {isNext && (
        <span
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white dark:bg-neutral-900 shadow flex items-center justify-center border border-sky-200 dark:border-sky-700"
          aria-hidden="true"
        >
          <SafeIcon icon={FiGift} className="w-2 h-2 text-sky-600 dark:text-sky-400" />
        </span>
      )}
    </motion.div>
  );
};

const UpcomingTrail: React.FC<{ items: UpcomingBirthday[]; uid: string }> = ({ items, uid }) => {
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, '');
  const n = items.length;
  // Label sizes track the trail's own width (cqw), scaled relative to the
  // 7-column case this clamp was tuned for — fewer columns get more room
  // per label, more columns get less, so a date like "Aug 26, 2070" never
  // touches its neighbor whatever count of birthdays is passed in.
  const colScale = 7 / Math.max(n, 1);
  const points = items.map((_, i) => ({ x: ((i + 0.5) / n) * 100, y: i % 2 === 0 ? 24 : 76 }));
  // One continuous ribbon through every node — not a run of separately
  // coloured, individually dashed legs — so the whole path reads as a
  // single unbroken thread of "what's ahead" rather than a chain of
  // disconnected hops.
  const ribbonD = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const midX = (prev.x + p.x) / 2;
      return `C ${midX} ${prev.y}, ${midX} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(' ');

  return (
    <div className="relative h-56" style={{ containerType: 'inline-size' }}>
      {n > 1 && (
        <svg aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`upTrail-${safeUid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={UPCOMING.from} />
              <stop offset="100%" stopColor={UPCOMING.to} />
            </linearGradient>
          </defs>
          <path
            d={ribbonD}
            fill="none"
            stroke={`url(#upTrail-${safeUid})`}
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: 'drop-shadow(0 2px 3px rgba(2,132,199,0.25))' }}
          />
        </svg>
      )}

      {items.map((item, i) => {
        const { x, y } = points[i];
        const isTop = i % 2 === 0;
        const isNext = i === 0;
        const isToday = item.daysAway === 0;
        return (
          <React.Fragment key={item.turningAge}>
            <div style={{ left: `${x}%`, top: `${y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
              <CalendarPageNode date={item.date} isNext={isNext} />
            </div>
            <div
              style={{ left: `${x}%`, top: `${isTop ? y + 17 : y - 17}%` }}
              className={`absolute text-center -translate-x-1/2 ${isTop ? '' : '-translate-y-full'}`}
            >
              <span
                className={`block text-sm font-extrabold tabular-nums leading-tight ${isNext ? UPCOMING.text : 'text-neutral-500 dark:text-neutral-400'}`}
                style={{ fontSize: `clamp(0.8125rem, ${(2.4 * colScale).toFixed(2)}cqw, 1.0625rem)` }}
              >
                Turns {item.turningAge}
              </span>
              <span
                className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mt-1 whitespace-nowrap"
                style={{ fontSize: `clamp(0.6875rem, ${(1.85 * colScale).toFixed(2)}cqw, 0.8125rem)` }}
              >
                {formatShortDate(item.date)}
              </span>
              {isNext ? (
                <div className="mt-2">
                  <NextChip
                    label={isToday ? 'Today! 🎉' : 'Next'}
                    className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${UPCOMING.chip}`}
                    pulse={UPCOMING_PULSE}
                    pulseFade={UPCOMING_PULSE_FADE}
                  />
                </div>
              ) : (
                <span className="block text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 mt-1 whitespace-nowrap">
                  {formatAway(item.daysAway)}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Phones: the same calendar-page motif in a vertical stack, threaded by a
// single sky-gradient spine — same object as the desktop ribbon, just
// stacked instead of woven, so the identity doesn't change with viewport.
const UpcomingTimeline: React.FC<{ items: UpcomingBirthday[] }> = ({ items }) => {
  return (
    <div className="relative">
      {items.length > 1 && (
        <div className="absolute left-5 top-7 bottom-7 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true">
          <div
            className="w-full"
            style={{ height: `${(1 / (items.length - 1)) * 100}%`, background: `linear-gradient(to bottom, ${UPCOMING.from}, ${UPCOMING.to})` }}
          />
        </div>
      )}
      <ol className="relative list-none m-0 p-0 space-y-1">
        {items.map((item, i) => {
          const isNext = i === 0;
          const isToday = item.daysAway === 0;
          return (
            <li
              key={item.turningAge}
              className={`relative flex items-center gap-3 rounded-xl pl-1.5 pr-3 py-2.5 motion-safe:transition-colors motion-safe:duration-150 ${
                isNext
                  ? 'bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-300 dark:ring-sky-700'
                  : 'hover:bg-white/70 dark:hover:bg-neutral-900/30'
              }`}
            >
              <div className="relative z-10">
                <CalendarPageNode date={item.date} isNext={isNext} size="sm" />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-neutral-800 dark:text-neutral-100">
                    <span className="truncate">Turns {item.turningAge}</span>
                    {isNext && (
                      <NextChip
                        label={isToday ? 'Today! 🎉' : 'Next up'}
                        className="flex-shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 rounded-full"
                        pulse={UPCOMING_PULSE}
                        pulseFade={UPCOMING_PULSE_FADE}
                      />
                    )}
                  </p>
                  <p className="flex items-center gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
                    {item.dayOfWeek}, {formatShortDate(item.date)}
                    {item.isWeekend && <SafeIcon icon={FiStar} className="w-3 h-3 text-sky-400 dark:text-sky-500 flex-shrink-0" />}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-[11px] font-bold tabular-nums whitespace-nowrap px-2 py-0.5 rounded-full ${
                    isNext
                      ? UPCOMING.chip
                      : 'bg-neutral-100/80 dark:bg-neutral-800/70 text-neutral-500 dark:text-neutral-400 border border-neutral-200/70 dark:border-neutral-700/60'
                  }`}
                >
                  {isToday ? 'Today! 🎉' : formatAway(item.daysAway)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const UpcomingBirthdaysSection: React.FC<{ items: UpcomingBirthday[] }> = ({ items }) => {
  const trailUid = useId();
  if (items.length === 0) return null;
  return (
    <ResultCard>
      <SectionHeader
        icon={FiTrendingUp}
        title="Upcoming Birthdays"
        subtitle="Plan ahead — which day of the week each one falls on."
        accentClassName="bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-500/30"
      />
      {/* sm and up: the calendar-page ribbon. Phones: the calendar-page
          stack — same motif, different arrangement. */}
      <div className="hidden sm:block">
        <UpcomingTrail items={items} uid={trailUid} />
      </div>
      <div className="sm:hidden">
        <UpcomingTimeline items={items} />
      </div>
    </ResultCard>
  );
};

// --- DAY OF YEAR CARD ---
const DayOfYearCard: React.FC<{ info: DayOfYearInfo; birthYear: number }> = ({ info, birthYear }) => {
  const ringUid = useId();
  const isLeap = info.yearLength === 366;
  return (
    <ResultCard>
      <SectionHeader icon={FiCalendar} title="Birth Date Numerics" subtitle={`Exact calendar-position facts from your birth year, ${birthYear}.`} />

      {/* Same "gradient wash + blurred color blob" shell ProfileDetailCard's
          fact-cards use below, in this card's own rose-to-amber identity —
          so the medallion + chips sit inside a panel with real depth
          instead of resting directly on ResultCard's own plain background. */}
      <div
        className="group relative overflow-hidden rounded-2xl border shadow-sm p-4 sm:p-5"
        style={{ background: 'linear-gradient(160deg, #f43f5e1f 0%, #d977060f 55%, transparent 100%)', borderColor: '#f43f5e33' }}
      >
        <div
          className="pointer-events-none absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-60 motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-110"
          style={{ background: 'radial-gradient(circle, #f43f5e40 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        {/* No separate "birth year" badge here — that context now lives in
            the SectionHeader subtitle above, so the panel stays focused on
            the ring + chips instead of repeating itself. */}
        <div className="relative flex flex-col sm:flex-row items-center sm:items-stretch gap-5">
          <YearPositionRing dayOfYear={info.dayOfYear} yearLength={info.yearLength} uid={ringUid} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 w-full">
            <FactChip tone="indigo" icon={FiFlag} label="Year Days Left" value={formatWithCommas(info.daysRemainingInBirthYear)} />
            <FactChip tone="sky" icon={FiSunrise} label="Born On A" value={info.weekdayBorn} />
            <FactChip tone="violet" icon={FiCompass} label="Quarter" value={`Q${info.quarter}`} />
          </div>
        </div>
      </div>

      {isLeap && (
        <div className="mt-3.5 flex justify-center sm:justify-start">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50">
            <SafeIcon icon={FiStar} className="w-3 h-3 flex-shrink-0" />
            Leap year — {formatWithCommas(info.yearLength)} days instead of the usual 365
          </span>
        </div>
      )}
    </ResultCard>
  );
};

// --- GEM ICON ---
// Birthstone previously used one static 💎 emoji for every month regardless
// of which stone it actually was. This is an original, hand-built faceted
// gem shape (not traced from any icon set) recolored per month to the
// real stone's color — a rose-red garnet, a purple amethyst, a green
// emerald, and so on — so each month is genuinely distinct rather than
// one repeated glyph. October (Opal) gets an iridescent gradient fill
// instead of a flat color, since a shifting play of color is opal's
// defining trait.
const GemIcon: React.FC<{ color: string; gradientColors?: string[]; className?: string }> = ({ color, gradientColors, className = 'w-10 h-10' }) => {
  const gradId = useId();
  const fill = gradientColors ? `url(#gem-${gradId})` : color;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {gradientColors && (
        <defs>
          <linearGradient id={`gem-${gradId}`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            {gradientColors.map((c, i) => (
              <stop key={c} offset={`${(i / (gradientColors.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      )}
      <path d="M12 2 L4 8 L12 22 L20 8 Z" fill={fill} stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M4 8 L20 8 L12 2 Z" fill="rgba(255,255,255,0.28)" />
      <path d="M8.4 8 L12 22 L4 8 Z" fill="rgba(0,0,0,0.10)" />
      <path d="M15.6 8 L12 22 L20 8 Z" fill="rgba(255,255,255,0.14)" />
    </svg>
  );
};

// Indexed by month (0-11), matching birthdayLogic.ts's BIRTH_MONTH_LORE
// table — the real, commonly-recognized color of that month's primary
// birthstone.
const BIRTHSTONE_COLOR = [
  '#9f1239', // Jan — Garnet (deep red)
  '#8b5cf6', // Feb — Amethyst (purple)
  '#2dd4bf', // Mar — Aquamarine (blue-green)
  '#bae6fd', // Apr — Diamond (icy clear-blue)
  '#059669', // May — Emerald (green)
  '#faf8f4', // Jun — Pearl (cream white)
  '#e11d48', // Jul — Ruby (red)
  '#84cc16', // Aug — Peridot (olive green)
  '#2563eb', // Sep — Sapphire (blue)
  '#f0abfc', // Oct — Opal (base; overridden by gradient below)
  '#f59e0b', // Nov — Topaz/Citrine (golden)
  '#14b8a6', // Dec — Turquoise (teal)
];
const OPAL_GRADIENT = ['#f0abfc', '#a5f3fc', '#fde68a', '#fca5a5'];


// birthdayLogic.ts only computes the raw category for each item (which
// sign, which animal, which stone/flower, etc.) — it deliberately doesn't
// carry opinionated trait copy, since that's presentation content, not a
// calculation. These tables supply that content for the UI layer, written
// fresh in Calculox's own words (not quoted or paraphrased from any single
// site) and kept to the commonly-cited, popular version of each tradition
// (modern planetary rulers for zodiac signs, the Jewelers-of-America-style
// modern birthstone list already used in birthdayLogic.ts, etc.) —
// presented throughout as tradition/entertainment, matching the card's
// own disclaimer, never as fact.
const WESTERN_ZODIAC_DETAILS: Record<WesternZodiacSign, { element: string; quality: string; planet: string; traits: string[]; blurb: string }> = {
  Aries:       { element: 'Fire',  quality: 'Cardinal', planet: 'Mars',    traits: ['Bold', 'Energetic', 'Competitive'], blurb: "As the first sign of the zodiac, Aries is associated with a pioneering, go-first energy — quick to act and quick to lead. That same drive can also read as impatient, since an Aries would rather start the race than wait for the starting gun." },
  Taurus:      { element: 'Earth', quality: 'Fixed',    planet: 'Venus',   traits: ['Steady', 'Patient', 'Grounded'], blurb: "Taurus is linked to comfort, loyalty, and an appreciation for the good things in life — food, beauty, and familiar routines. That steadiness is a real strength, though it can tip into stubbornness once a Taurus has made up their mind." },
  Gemini:      { element: 'Air',   quality: 'Mutable',  planet: 'Mercury', traits: ['Curious', 'Witty', 'Adaptable'], blurb: "Gemini's twin symbol reflects a mind that's happiest juggling several interests at once — quick, curious, and endlessly conversational. The flip side is a reputation for restlessness, moving on before a single idea is fully explored." },
  Cancer:      { element: 'Water', quality: 'Cardinal', planet: 'Moon',    traits: ['Nurturing', 'Intuitive', 'Sentimental'], blurb: "Cancer is associated with home, family, and emotional depth, often acting as the quiet caretaker of a friend group. That same sensitivity can make Cancer more guarded than most, retreating into its shell when it feels exposed." },
  Leo:         { element: 'Fire',  quality: 'Fixed',    planet: 'Sun',     traits: ['Confident', 'Generous', 'Dramatic'], blurb: "Ruled by the Sun, Leo is associated with warmth, generosity, and a natural flair for the dramatic — the sign most at home in the spotlight. That confidence is magnetic, though it can shade into a need for constant recognition." },
  Virgo:       { element: 'Earth', quality: 'Mutable',  planet: 'Mercury', traits: ['Analytical', 'Practical', 'Meticulous'], blurb: "Virgo is linked to precision and service, the sign most likely to notice the one detail everyone else missed. That eye for improvement is a gift to any team, but can turn into self-critical perfectionism if left unchecked." },
  Libra:       { element: 'Air',   quality: 'Cardinal', planet: 'Venus',   traits: ['Diplomatic', 'Sociable', 'Fair-minded'], blurb: "Symbolized by the scales, Libra is associated with fairness, harmony, and a genuine dislike of conflict. That diplomacy makes Libra a natural peacemaker, though it can sometimes mean delaying a decision to avoid upsetting anyone." },
  Scorpio:     { element: 'Water', quality: 'Fixed',    planet: 'Pluto',   traits: ['Intense', 'Passionate', 'Resourceful'], blurb: "Scorpio is associated with intensity and depth, drawn to whatever lies beneath the surface rather than small talk. That same intensity makes Scorpio fiercely loyal to the people it trusts, and famously unforgiving toward those who betray it." },
  Sagittarius: { element: 'Fire',  quality: 'Mutable',  planet: 'Jupiter', traits: ['Adventurous', 'Optimistic', 'Philosophical'], blurb: "Sagittarius is the zodiac's wanderer, associated with optimism, humor, and a hunger for new places and ideas. That restlessness fuels a love of freedom, though it can come across as blunt or commitment-shy to those who don't share it." },
  Capricorn:   { element: 'Earth', quality: 'Cardinal', planet: 'Saturn',  traits: ['Disciplined', 'Ambitious', 'Patient'], blurb: "Capricorn is associated with ambition and discipline, the sign most likely to already have a long-term plan in motion. That patience pays off over time, even if Capricorn can seem reserved while quietly working toward the goal." },
  Aquarius:    { element: 'Air',   quality: 'Fixed',    planet: 'Uranus',  traits: ['Independent', 'Inventive', 'Idealistic'], blurb: "Aquarius is associated with originality and big-picture thinking, often more interested in humanity in general than small talk about the everyday. That independence of mind can make Aquarius seem detached, even while it's deeply idealistic underneath." },
  Pisces:      { element: 'Water', quality: 'Mutable',  planet: 'Neptune', traits: ['Empathetic', 'Imaginative', 'Dreamy'], blurb: "Pisces is the zodiac's dreamer, associated with empathy, imagination, and a strong pull toward art and emotion. That sensitivity makes Pisces a natural listener, though it can also mean absorbing more of other people's feelings than is healthy." },
};

const CHINESE_ZODIAC_DETAILS: Record<ChineseZodiacAnimal, { traits: string[]; blurb: string }> = {
  Rat:     { traits: ['Clever', 'Resourceful', 'Quick-witted'], blurb: "The Rat is associated with quick thinking and resourcefulness, known for spotting an opportunity before anyone else notices it. That cleverness is often paired with a strong instinct for planning and saving ahead." },
  Ox:      { traits: ['Diligent', 'Dependable', 'Strong-willed'], blurb: "The Ox is associated with hard work and quiet determination, happiest making steady progress rather than chasing shortcuts. That same persistence can tip into stubbornness once an Ox has settled on a plan." },
  Tiger:   { traits: ['Brave', 'Confident', 'Competitive'], blurb: "The Tiger is associated with courage and confidence, drawn to bold moves and a bit of healthy competition. That fearlessness makes Tigers natural leaders, even if patience isn't always their strongest trait." },
  Rabbit:  { traits: ['Gentle', 'Elegant', 'Cautious'], blurb: "The Rabbit is associated with gentleness and grace, valuing peace, comfort, and a calm home life. That caution can look like shyness, but it usually reflects a careful nature rather than a lack of confidence." },
  Dragon:  { traits: ['Ambitious', 'Charismatic', 'Energetic'], blurb: "The Dragon is traditionally considered the luckiest sign in the cycle, associated with ambition, charisma, and larger-than-life energy. That confidence tends to draw others in, even if it occasionally reads as a touch too self-assured." },
  Snake:   { traits: ['Wise', 'Intuitive', 'Enigmatic'], blurb: "The Snake is associated with wisdom and intuition, often the quiet observer who understands more than they let on. That mystery can make Snakes seem guarded, though it usually masks a sharp, private intelligence." },
  Horse:   { traits: ['Free-spirited', 'Energetic', 'Independent'], blurb: "The Horse is associated with energy and independence, most at home when there's a new place to go or a new goal to chase. That free-spirited streak can make commitment a challenge, though it fuels a genuinely adventurous life." },
  Goat:    { traits: ['Gentle', 'Creative', 'Compassionate'], blurb: "The Goat (sometimes called the Sheep) is associated with gentleness and creativity, drawn to art, nature, and a peaceful pace. That sensitivity is paired with a strong compassionate streak for the people around them." },
  Monkey:  { traits: ['Witty', 'Inventive', 'Playful'], blurb: "The Monkey is associated with wit and inventiveness, the sign most likely to find a clever workaround to any problem. That playful curiosity makes Monkeys entertaining company, if occasionally a little mischievous." },
  Rooster: { traits: ['Observant', 'Hardworking', 'Confident'], blurb: "The Rooster is associated with confidence and hard work, often the most organized and observant person in the room. That honesty is refreshing, though it can come across as blunt when opinions aren't asked for." },
  Dog:     { traits: ['Loyal', 'Honest', 'Protective'], blurb: "The Dog is associated with loyalty and honesty, the sign most likely to have your back without needing to be asked. That protectiveness runs deep, sometimes paired with a tendency to worry about the people it loves." },
  Pig:     { traits: ['Generous', 'Easy-going', 'Diligent'], blurb: "The Pig is associated with generosity and good humor, known for enjoying life's comforts and sharing them freely. That easy-going warmth makes Pigs great company, even if it sometimes means avoiding hard conversations." },
};

// Indexed by month (0-11), lining up 1:1 with birthdayLogic.ts's own
// BIRTH_MONTH_LORE table — two-sentence, popularly-cited detail on the
// month's primary birthstone and birth flower, plus an emoji standing in
// for the flower (Feather's icon set has no flower glyphs of its own).
const BIRTHSTONE_MEANING = [
  "Garnet has long been worn as a traveler's stone, said to protect its wearer on journeys and guard against nightmares. It's also associated with enduring friendship, making it a popular gift between close friends.",
  "Amethyst's deep purple hue has made it a symbol of calm and clarity for centuries, popularly believed to soothe an anxious mind. It was once so prized that European royalty wore it as a symbol of stability and dignity.",
  "Aquamarine takes its name from the Latin for \u201cwater of the sea,\u201d and is traditionally associated with courage and calm, said to keep sailors safe on their travels. Bloodstone, its lesser-known co-birthstone, has long been linked to strength and vitality.",
  "As one of the hardest naturally occurring materials on Earth, the diamond has become the enduring symbol of unbreakable love and commitment. It's also popularly associated with clarity, strength, and everlasting bonds.",
  "Emerald's vivid green has made it a symbol of rebirth and renewal since antiquity, prized by ancient civilizations from Egypt to Rome. It's traditionally believed to promote growth, love, and fresh starts.",
  "Unlike most gemstones, the pearl forms inside a living creature, which has made it a long-standing symbol of purity and new beginnings. Alexandrite, its rarer co-birthstone, is famous for appearing to change color in different light.",
  "The ruby's deep red has tied it to passion and vitality across many cultures, and it was historically believed to protect its wearer in battle. It remains one of the most prized colored gemstones for its rarity and intensity.",
  "Peridot's signature olive-green color was so valued in ancient Egypt that it was nicknamed the \u201cgem of the sun.\u201d It's traditionally said to ward off negative energy and bring strength, alongside its co-birthstone, spinel.",
  "Sapphire has long been associated with wisdom, loyalty, and nobility, and was once believed to protect royalty from harm. Its deep blue has made it a popular choice for engagement rings, symbolizing faithfulness and truth.",
  "Opal's shifting play of color has made it a symbol of creativity, hope, and inspiration across many traditions. Tourmaline, its co-birthstone, comes in nearly every color and is said to bring balance and emotional healing.",
  "Topaz has long been associated with warmth and confidence, said in some traditions to bring strength to those who wear it. Citrine, its sunny co-birthstone, is popularly linked to abundance, joy, and positive energy.",
  "Turquoise has been prized for thousands of years \u2014 from ancient Egypt to the American Southwest \u2014 as a stone of protection and good fortune, especially for travelers. Zircon and tanzanite round out December's trio, each adding their own brilliance to the season's birthstones.",
];
const BIRTH_FLOWER_MEANING = [
  "The carnation has symbolized admiration and love for centuries, with different colors carrying their own meanings \u2014 pink for gratitude, red for deep love. Its ruffled, long-lasting blooms have made it a popular choice for bouquets and corsages alike.",
  "The violet's modest, low-growing blooms have long symbolized humility and quiet faithfulness. In Victorian flower language, gifting violets was a way of saying \u201cI'll always be true.\u201d",
  "As one of the first flowers to bloom after winter, the daffodil has become a natural symbol of new beginnings and rebirth. In many cultures, spotting the season's first daffodil is considered a sign of good fortune to come.",
  "The daisy's simple, cheerful form has made it a lasting symbol of innocence and pure love. Its name comes from the Old English \u201cday's eye,\u201d since the flower opens with the sun each morning.",
  "Lily of the valley's delicate white bells are traditionally associated with happiness, humility, and a return of good fortune. In French tradition, gifting a sprig on May 1st is said to bring luck for the rest of the year.",
  "The rose is perhaps the most universally recognized flower of love and passion, with its color carrying its own meaning \u2014 red for romance, yellow for friendship. Roses have been cultivated for thousands of years and remain the world's most popular cut flower.",
  "Larkspur's tall, colorful spikes have made it a symbol of positivity and an open heart. Its name comes from the spur-shaped petal at the back of each bloom, said to resemble a lark's claw.",
  "The gladiolus takes its name from the Latin for \u201csmall sword,\u201d a nod to its tall, blade-like leaves, and has become a symbol of strength of character and integrity. Giving a bouquet of gladioli is traditionally said to express deep admiration for the recipient.",
  "The aster's star-shaped blooms take their name from the Greek word for \u201cstar,\u201d and the flower has long been associated with wisdom and valor. Ancient legend held that burning aster leaves could ward off evil spirits.",
  "Marigolds' warm, fiery colors have made them a symbol of passion and creativity across many traditions. In Mexican culture, marigolds are closely associated with the Day of the Dead, believed to guide spirits home with their bright color and scent.",
  "The chrysanthemum has symbolized joy, optimism, and long life across many cultures, and in some Asian traditions it's considered a symbol of nobility. It remains one of the most popular flowers for autumn arrangements thanks to its long bloom season.",
  "The narcissus, especially the fragrant paperwhite, is traditionally associated with hope and renewal, often blooming indoors right around the winter holidays. In Chinese tradition, a paperwhite blooming in time for Lunar New Year is considered a sign of good fortune ahead.",
];
const BIRTH_FLOWER_EMOJI = ['🌸', '🌸', '🌼', '🌼', '💐', '🌹', '🌸', '🌺', '🌸', '🌼', '🌼', '🌼'];

const GENERATION_DETAILS: Record<string, string> = {
  'The Greatest Generation': "Came of age during the Great Depression and World War II, and is often associated with resilience, sacrifice, and a strong sense of civic duty. Many went on to build the postwar institutions and infrastructure later generations grew up with.",
  'The Silent Generation': "Grew up in the shadow of the Depression and the war years, and is often described as cautious, hardworking, and inclined to conform rather than rock the boat. The label itself reflects a generation more likely to work quietly within the system than protest against it.",
  'Baby Boomers': "Born into the dramatic postwar population boom, Boomers are often associated with career-focused, competitive values and a strong belief in individual opportunity. They came of age during major social change, from the civil rights movement to the moon landing.",
  'Generation X': "Grew up amid rising divorce rates and dual-income households, which is often credited with making Gen X independent, self-reliant, and skeptical of institutions. Sometimes called the \u201cforgotten middle child\u201d generation, sandwiched between two much larger cohorts.",
  'Millennials': "Came of age around the turn of the millennium, shaped early by the rise of the internet and, later, social media and smartphones. Millennials also entered adulthood during the Great Recession, which is often cited as shaping their attitudes toward work and financial security.",
  'Generation Z': "The first generation of true digital natives, raised alongside smartphones, streaming, and always-on connectivity from early childhood. Gen Z is often associated with strong comfort around technology and a heightened awareness of social and environmental issues.",
  'Generation Alpha': "Grew up entirely within the era of AI, tablets, and ubiquitous screens \u2014 the first generation with no memory of a world before smartphones. Largely the children of Millennials.",
  'Generation Beta': "The newest named cohort, born into a world where AI and automation are already deeply woven into everyday life. Largely the children of younger Millennials and older Generation Z, and expected to make up a significant share of the global population by the mid-2030s.",
};

const LIFE_PATH_DETAILS: Record<number, { keywords: string[]; blurb: string }> = {
  1:  { keywords: ['Leadership', 'Independence', 'Drive'], blurb: "Numerology associates the number 1 with initiative and a pioneering drive to forge your own path. People with this life path are often described as natural self-starters who'd rather chart their own course than follow someone else's." },
  2:  { keywords: ['Partnership', 'Diplomacy', 'Balance'], blurb: "Numerology associates the number 2 with cooperation, diplomacy, and sensitivity to others' feelings. This life path is often linked to a talent for bringing people together and smoothing over conflict." },
  3:  { keywords: ['Creativity', 'Expression', 'Optimism'], blurb: "Numerology associates the number 3 with creativity, self-expression, and an easy sociability. This life path is often linked to artistic or communicative talents and a naturally upbeat outlook." },
  4:  { keywords: ['Stability', 'Discipline', 'Hard Work'], blurb: "Numerology associates the number 4 with discipline and a talent for building solid, lasting foundations. This life path is often linked to reliability \u2014 the steady hand a project or a team can count on." },
  5:  { keywords: ['Freedom', 'Change', 'Adventure'], blurb: "Numerology associates the number 5 with freedom, change, and a restless love of variety and travel. This life path is often linked to adaptability, thriving on new experiences rather than routine." },
  6:  { keywords: ['Responsibility', 'Nurturing', 'Harmony'], blurb: "Numerology associates the number 6 with responsibility, nurturing, and a deep care for family and community. This life path is often linked to a natural instinct to look after the people around you." },
  7:  { keywords: ['Introspection', 'Wisdom', 'Analysis'], blurb: "Numerology associates the number 7 with introspection, analysis, and a searching, reflective mind. This life path is often linked to a love of research, philosophy, and understanding how things really work." },
  8:  { keywords: ['Ambition', 'Power', 'Achievement'], blurb: "Numerology associates the number 8 with ambition, authority, and material achievement. This life path is often linked to strong organizational instincts and a drive to build something lasting." },
  9:  { keywords: ['Compassion', 'Idealism', 'Generosity'], blurb: "Numerology associates the number 9 with compassion, idealism, and generosity toward others. This life path is often linked to humanitarian instincts and a willingness to let go once a chapter is complete." },
  11: { keywords: ['Intuition', 'Inspiration', 'Insight'], blurb: "Conventionally left unreduced as a \u201cmaster number,\u201d 11 is associated with heightened intuition, inspiration, and insight. This life path is often linked to a strong inner vision, sometimes paired with the pressure of living up to it." },
  22: { keywords: ['Vision', 'Building', 'Mastery'], blurb: "Conventionally left unreduced as a \u201cmaster number,\u201d 22 is associated with turning big dreams into concrete reality \u2014 sometimes called the \u201cmaster builder.\u201d This life path is often linked to a rare mix of vision and practical follow-through." },
  33: { keywords: ['Healing', 'Teaching', 'Compassion'], blurb: "Conventionally left unreduced as a \u201cmaster number,\u201d 33 is associated with selfless guidance of others \u2014 sometimes called the \u201cmaster teacher.\u201d This life path is often linked to a deep well of compassion and a instinct to nurture and heal." },
};

// A full-width "profile record" card — restyled again per client feedback
// for a richer, more premium feel: instead of a plain white body under a
// color banner, the whole card now carries a soft colorful gradient wash
// in its own tone, a blurred decorative color blob (the same device
// ResultCard uses at the page level, just tinted per-card here), and a
// glowing gradient icon orb (solid color + soft shadow-glow) in place of
// the flat tinted square. `symbol` accepts either a glyph string (a
// zodiac symbol, animal emoji, or the life path number) or a node — used
// for Birthstone's GemIcon, so that card can show a real recolored gem
// rather than a repeated emoji.
const ProfileDetailCard: React.FC<{
  tone: TileTone;
  icon: IconType;
  symbol: React.ReactNode;
  eyebrow: string;
  title: string;
  meta?: string;
  facts?: { label: string; value: string }[];
  description: string;
}> = ({ tone, icon, symbol, eyebrow, title, meta, facts, description }) => {
  const t = TILE_TONES[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border shadow-sm motion-safe:transition-all motion-safe:duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
      style={{ borderColor: `${t.from}40` }}
    >
      <div
        className="relative flex items-center gap-2 px-4 py-3 sm:px-5"
        style={{ background: `linear-gradient(90deg, ${t.from} 0%, ${t.to} 100%)` }}
      >
        <SafeIcon icon={icon} aria-hidden="true" className="w-3.5 h-3.5 text-white/95 flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/95">{eyebrow}</span>
      </div>
      <div
        className="relative overflow-hidden p-4 sm:p-5"
        style={{ background: `linear-gradient(160deg, ${t.from}1f 0%, ${t.to}0f 55%, transparent 100%)` }}
      >
        <div
          className="pointer-events-none absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-60 motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-110"
          style={{ background: `radial-gradient(circle, ${t.from}55 0%, transparent 70%)` }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col-reverse sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
          <div className="min-w-0 flex-1 w-full space-y-1.5 sm:space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h5 className="text-lg sm:text-xl font-extrabold leading-snug text-neutral-900 dark:text-white break-words">{title}</h5>
              {meta && (
                <span className="max-w-full text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 dark:bg-neutral-900/50 backdrop-blur-sm text-neutral-600 dark:text-neutral-300 border border-white/60 dark:border-neutral-700/60 break-words">
                  {meta}
                </span>
              )}
            </div>
            {facts && facts.length > 0 && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1">
                {facts.map((f) => (
                  <span key={f.label} className="text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-bold" style={{ color: t.to }}>{f.label}: </span>
                    {f.value}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{description}</p>
          </div>
          <span
            className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center text-5xl sm:text-6xl leading-none ring-1 ring-white/40 dark:ring-white/10"
            style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, boxShadow: `0 12px 28px -10px ${t.from}99` }}
            aria-hidden="true"
          >
            <span className="text-white drop-shadow-sm">{symbol}</span>
          </span>
        </div>
      </div>
    </div>
  );
};


// The Age Calculator's "Curiosities" section closes out its results with
// fun, non-essential calendar facts. This is this calculator's
// counterpart — a set of popularly-referenced facts tied to the birth
// date itself (zodiac signs, birthstone/flower, generation, numerology)
// rather than calendar math. Same ResultCard + SectionHeader + StatTile
// shell as every other section, so it doesn't read as a bolted-on
// afterthought; explicitly framed as entertainment/tradition in both the
// subtitle and the page-level disclaimer, since several of these (zodiac,
// numerology) aren't factual claims.
interface BirthProfileCardProps {
  western: WesternZodiacInfo;
  chinese: ChineseZodiacInfo;
  lore: BirthMonthLoreInfo;
  generation: GenerationInfo;
  lifePath: LifePathNumberInfo;
}

const BirthProfileCard: React.FC<BirthProfileCardProps> = ({ western, chinese, lore, generation, lifePath }) => {
  const westernDetails = WESTERN_ZODIAC_DETAILS[western.sign];
  const chineseDetails = CHINESE_ZODIAC_DETAILS[chinese.animal];
  const generationBlurb = GENERATION_DETAILS[generation.label];
  const lifePathDetails = LIFE_PATH_DETAILS[lifePath.number];

  return (
    <ResultCard>
      <SectionHeader
        icon={FiStar}
        title="Birth Date Profile"
        subtitle="Popular traditions and lookups tied to your date of birth — for fun, not fact."
        tip="Zodiac signs, birthstones/flowers, generation labels and numerology are cultural traditions or research categories, not scientific claims about you personally."
      />
      <div className="space-y-3 sm:space-y-4">
        <ProfileDetailCard
          tone="rose"
          icon={FiMoon}
          symbol={western.symbol}
          eyebrow="Zodiac Sign"
          title={western.sign}
          meta={western.dateRange}
          facts={[
            { label: 'Element', value: westernDetails.element },
            { label: 'Quality', value: westernDetails.quality },
            { label: 'Ruling Planet', value: westernDetails.planet },
          ]}
          description={`Known for being ${westernDetails.traits.join(', ').toLowerCase()}. ${westernDetails.blurb}`}
        />
        <ProfileDetailCard
          tone="amber"
          icon={FiCompass}
          symbol={chinese.symbol}
          eyebrow="Chinese Zodiac"
          title={`Year of the ${chinese.animal}`}
          meta={chinese.isApproximate ? 'Near lunar new year — approx.' : undefined}
          facts={[{ label: 'Date Range', value: `${chinese.cycleYearRange} (approx.)` }]}
          description={`Known for being ${chineseDetails.traits.join(', ').toLowerCase()}. ${chineseDetails.blurb}`}
        />
        <ProfileDetailCard
          tone="indigo"
          icon={FiDroplet}
          symbol={
            <GemIcon
              color={BIRTHSTONE_COLOR[lore.month]}
              gradientColors={lore.month === 9 ? OPAL_GRADIENT : undefined}
              className="w-11 h-11 sm:w-12 sm:h-12"
            />
          }
          eyebrow="Birthstone"
          title={lore.birthstones.join(' / ')}
          meta={lore.monthName}
          description={BIRTHSTONE_MEANING[lore.month]}
        />
        <ProfileDetailCard
          tone="emerald"
          icon={FiSunrise}
          symbol={BIRTH_FLOWER_EMOJI[lore.month]}
          eyebrow="Birth Flower"
          title={lore.birthFlower}
          meta={lore.monthName}
          description={BIRTH_FLOWER_MEANING[lore.month]}
        />
        <ProfileDetailCard
          tone="sky"
          icon={FiLayers}
          symbol="🕰️"
          eyebrow="Generation"
          title={generation.label}
          meta={generation.yearRange}
          description={generationBlurb}
        />
        <ProfileDetailCard
          tone="violet"
          icon={FiHexagon}
          symbol={`${lifePath.number}`}
          eyebrow="Life Path Number"
          title={`Life Path ${lifePath.number}`}
          meta={lifePath.isMasterNumber ? 'Master Number' : 'Numerology'}
          facts={[{ label: 'Keywords', value: lifePathDetails.keywords.join(', ') }]}
          description={lifePathDetails.blurb}
        />
      </div>
    </ResultCard>
  );
};

const BirthdayCalculator: React.FC<BirthdayCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // --- STATE ---
  const [birthDate, setBirthDate] = useState<Date | null>(null);

  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  const [committedBirthDate, setCommittedBirthDate] = useState<Date | null>(null);

  const hasError = Boolean(birthDateError);

  // --- LIVE TICK --- (results are always "as of now" — there's no custom
  // "as of" date anymore, so the countdown always ticks once calculated)
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!hasCalculated) return;
    const id = window.setInterval(() => setLiveNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [hasCalculated]);

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

  const isCalculateDisabled = useMemo(() => !birthDate, [birthDate]);

  const isClearDisabled = useMemo(() => !birthDate && !hasCalculated, [birthDate, hasCalculated]);

  const resetCalculation = () => {
    setHasCalculated(false);
    setBirthDateError(null);
    setCommittedBirthDate(null);
  };

  const handleBirthDateChange = (d: Date | null) => {
    setBirthDate(d);
    setBirthDateError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setBirthDate(null);
    resetCalculation();
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const birth = birthDate;
    const asOf = new Date();

    const validation = validateBirthdayInput(birth, asOf);
    if (!validation.isValid) {
      setBirthDateError(validation.error ?? 'Please enter a valid date of birth.');
      setHasCalculated(false);
      return;
    }

    setBirthDateError(null);
    setCommittedBirthDate(birth);
    setHasCalculated(true);
    setLiveNow(asOf);

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

  const effectiveAsOf = useMemo(() => {
    if (!hasCalculated || !committedBirthDate) return null;
    return liveNow;
  }, [hasCalculated, committedBirthDate, liveNow]);

  const nextBirthday = useMemo(() => {
    if (!committedBirthDate || !effectiveAsOf) return null;
    return getNextBirthdayInfo(committedBirthDate, effectiveAsOf);
  }, [committedBirthDate, effectiveAsOf]);

  const countdown = useMemo(() => {
    if (!nextBirthday || !effectiveAsOf) return null;
    return getCountdownBreakdown(nextBirthday.date, effectiveAsOf);
  }, [nextBirthday, effectiveAsOf]);

  // Visual-only: how far through the ~365-day cycle since the last
  // birthday we are, for the hero card's year-progress track. Same
  // derivation as ChronologicalAgeCalculator.tsx's own yearProgressPercent.
  const yearProgressPercent = useMemo(() => {
    if (!nextBirthday) return 0;
    const prev = new Date(nextBirthday.date);
    prev.setFullYear(prev.getFullYear() - 1);
    const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const span = Math.max(1, Math.round((startOfDayMs(nextBirthday.date) - startOfDayMs(prev)) / 86_400_000));
    return Math.round(Math.max(0, Math.min(100, ((span - nextBirthday.daysUntil) / span) * 100)));
  }, [nextBirthday]);

  const golden = useMemo(() => {
    if (!committedBirthDate || !effectiveAsOf) return null;
    return getGoldenBirthday(committedBirthDate, effectiveAsOf);
  }, [committedBirthDate, effectiveAsOf]);

  const doubleGolden = useMemo(() => {
    if (!committedBirthDate || !effectiveAsOf) return null;
    return getDoubleGoldenBirthday(committedBirthDate, effectiveAsOf);
  }, [committedBirthDate, effectiveAsOf]);

  const platinum = useMemo(() => {
    if (!committedBirthDate || !effectiveAsOf) return null;
    return getPlatinumBirthday(committedBirthDate, effectiveAsOf);
  }, [committedBirthDate, effectiveAsOf]);

  const upcomingBirthdays = useMemo(() => {
    if (!committedBirthDate || !effectiveAsOf) return [];
    return getUpcomingBirthdays(committedBirthDate, effectiveAsOf, 5);
  }, [committedBirthDate, effectiveAsOf]);

  const dayOfYear = useMemo(() => {
    if (!committedBirthDate) return null;
    return getDayOfYearBorn(committedBirthDate);
  }, [committedBirthDate]);

  const isLeapBirthday = useMemo(
    () => (committedBirthDate ? isFeb29Birthday(committedBirthDate) : false),
    [committedBirthDate]
  );

  // --- BIRTH DATE PROFILE --- (see BirthProfileCard above)
  const westernZodiac = useMemo(() => {
    if (!committedBirthDate) return null;
    return getWesternZodiac(committedBirthDate);
  }, [committedBirthDate]);

  const chineseZodiac = useMemo(() => {
    if (!committedBirthDate) return null;
    return getChineseZodiac(committedBirthDate);
  }, [committedBirthDate]);

  const birthMonthLore = useMemo(() => {
    if (!committedBirthDate) return null;
    return getBirthMonthLore(committedBirthDate);
  }, [committedBirthDate]);

  const generation = useMemo(() => {
    if (!committedBirthDate) return null;
    return getGeneration(committedBirthDate.getFullYear());
  }, [committedBirthDate]);

  const lifePathNumber = useMemo(() => {
    if (!committedBirthDate) return null;
    return getLifePathNumber(committedBirthDate);
  }, [committedBirthDate]);

  // --- REPORT ENGINE HOOKUP ---
  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || !nextBirthday || !golden || !doubleGolden || !platinum || !committedBirthDate || !effectiveAsOf) return null;

    const goldenRows: Array<{ label: string; value: string }> = [
      { label: `Age ${golden.goldenDay}`, value: `${formatShortDate(golden.date)} (${golden.achieved ? 'already reached' : formatAway(golden.daysAway)})` },
      { label: `Double Golden \u2014 Age ${doubleGolden.doubleGoldenAge}`, value: `${formatShortDate(doubleGolden.date)} (${doubleGolden.achieved ? 'already reached' : formatAway(doubleGolden.daysAway)})` },
    ];
    if (!platinum.sameAsGolden) {
      goldenRows.push({ label: `Platinum \u2014 Age ${platinum.platinumAge}`, value: `${formatShortDate(platinum.date)} (${platinum.achieved ? 'already reached' : formatAway(platinum.daysAway)})` });
    }

    const sections: ShareableReport['sections'] = [
      {
        heading: 'Next Birthday',
        rows: [
          { label: 'Date', value: formatFullDate(nextBirthday.date) },
          { label: 'Countdown', value: nextBirthday.isToday ? 'Today! 🎉' : `${nextBirthday.daysUntil} ${plural(nextBirthday.daysUntil, 'day', 'days')}` },
          { label: 'Turning', value: `${nextBirthday.turningAge}` },
        ],
        variant: 'output',
      },
      {
        heading: 'Golden Birthday',
        rows: goldenRows,
        variant: 'output',
      },
      ...(westernZodiac && chineseZodiac && birthMonthLore && generation && lifePathNumber
        ? [{
            heading: 'Birth Date Profile',
            rows: [
              { label: 'Zodiac Sign', value: `${westernZodiac.sign} (${westernZodiac.dateRange})` },
              { label: 'Chinese Zodiac', value: chineseZodiac.animal },
              { label: 'Birthstone', value: birthMonthLore.birthstones.join(' / ') },
              { label: 'Birth Flower', value: birthMonthLore.birthFlower },
              { label: 'Generation', value: `${generation.label} (${generation.yearRange})` },
              { label: 'Life Path Number', value: `${lifePathNumber.number}` },
            ],
            variant: 'output' as const,
          }]
        : []),
    ];

    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Date of Birth', value: formatFullDate(committedBirthDate) },
    ];
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    return {
      title: 'Birthday Calculator Result',
      headlineValue: nextBirthday.isToday ? '🎉' : `${countdown?.days ?? nextBirthday.daysUntil}`,
      headlineLabel: nextBirthday.isToday ? 'Happy Birthday!' : `days until you turn ${nextBirthday.turningAge}`,
      accentColor: ACCENT.hex,
      meta: [`As of ${formatShortDate(effectiveAsOf)}`],
      sections,
      pdfOnlySections,
      imageSections: sections,
      disclaimer: 'For informational and entertainment purposes only.',
      fileNameBase: `birthday-countdown-${nextBirthday.turningAge}`,
    };
  }, [hasCalculated, hasError, nextBirthday, golden, doubleGolden, platinum, committedBirthDate, effectiveAsOf, countdown, westernZodiac, chineseZodiac, birthMonthLore, generation, lifePathNumber]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  const toggleSources = () => {
    setShowSources((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          sourcesPanelRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
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
        <button type="button" onClick={() => onCopyLink?.()} className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'bg-rose-50 dark:bg-rose-500/10 ring-rose-100 dark:ring-rose-800/40 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:shadow-md hover:ring-rose-200 dark:hover:ring-rose-700/60 hover:-translate-y-0.5'}`} title="Copy link to this calculator">
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
              Date Based
            </span>
          </div>

          {/* Matches the plain Input Fields treatment used across the other
              calculators (see ChronologicalAgeCalculator.tsx): no tinted
              background, no bordered wrapper panel around the field — just
              the label row, the field, and its inline error, sitting
              directly on the card's own surface. Width is constrained via
              lg:w-2/3, the same convention used for the equivalent control
              in WHRCalculator.tsx / BMRCalculator.tsx / this same file's
              sibling calculators, rather than a bespoke max-width. */}
          <div className="lg:w-2/3">
            <div className={fieldLabelRowClass}>
              <label htmlFor="birthDate" className={fieldLabelClass}>Date of Birth</label>
              <InfoTip text="Your date of birth is used to calculate your countdown, golden birthday and more. Never shared or stored beyond this calculation." />
            </div>
            <DateTimePicker
              id="birthDate"
              value={birthDate}
              onChange={handleBirthDateChange}
              minDate={MIN_BIRTH_DATE}
              maxDate={new Date()}
              placeholder="Select your date of birth"
              ariaLabel="Date of birth"
              error={Boolean(birthDateError)}
              dateLabel=""
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
          </div>
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
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <rect x="26" y="34" width="48" height="42" rx="4" stroke="currentColor" strokeWidth="5" />
            <path d="M50 34 V22 M50 22 C50 16 58 16 58 22 C58 28 50 28 50 22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="26" y1="50" x2="74" y2="50" stroke="currentColor" strokeWidth="5" />
            <path d="M34 76 V60 M50 76 V60 M66 76 V60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Enter your date of birth above, then press Calculate to see your countdown, golden birthday, and more.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {hasCalculated && !hasError && nextBirthday && countdown && golden && doubleGolden && platinum && committedBirthDate && effectiveAsOf && dayOfYear &&
        westernZodiac && chineseZodiac && birthMonthLore && generation && lifePathNumber && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springConfig}
          className="space-y-5"
        >
          {/* RESULT HEADER ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your Birthday Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          <NextBirthdayHero
            nextBirthday={nextBirthday}
            breakdown={countdown}
            progressPercent={yearProgressPercent}
            isLeapBirthday={isLeapBirthday}
          />

          <GoldenBirthdayCard golden={golden} doubleGolden={doubleGolden} platinum={platinum} />

          {upcomingBirthdays.length > 0 && (
            <UpcomingBirthdaysSection items={upcomingBirthdays} />
          )}

          <BirthProfileCard
            western={westernZodiac}
            chinese={chineseZodiac}
            lore={birthMonthLore}
            generation={generation}
            lifePath={lifePathNumber}
          />

          <DayOfYearCard info={dayOfYear} birthYear={committedBirthDate.getFullYear()} />

          {renderShareBar()}

          {/* DISCLAIMER */}
          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
            <p className="leading-normal">
              <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator provides general date-based information for informational and entertainment purposes only. The golden birthday is a popular tradition, not an official or legally defined milestone. Zodiac signs, the Chinese zodiac, birthstones/flowers, generation labels and the Life Path Number are cultural traditions, common conventions, or numerology — not scientific or factual claims.
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
                    {BIRTHDAY_SOURCES.length} references — every convention used above, cited
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
                  {BIRTHDAY_SOURCES.map((source, i) => (
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
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BirthdayCalculator;
