"use client";

// --- AGE DIFFERENCE CALCULATOR ---
// Third member of the date-based calculator family (Chronological Age,
// Birthday, Age Difference) described in dateLogic.ts's own header.
// Reuses that shared engine plus birthdayLogic.ts's generation/zodiac
// lookups rather than re-deriving any of it — see ageDifferenceLogic.ts
// for the two-person math genuinely specific to this calculator.
//
// Visual language, primitives (InfoTip, ResultCard,
// SectionHeader, StatTile) and prop contract deliberately mirror
// ChronologicalAgeCalculator.tsx / BirthdayCalculator.tsx exactly, so
// this drops into the same Registry.tsx / report-download / share
// pipeline unmodified. This pass brings the illustration quality,
// motion polish and section depth up to parity with those two files —
// ambient glow layers, a mouse-tracked spotlight, drifting sparkles,
// count-up numerics and a bespoke "gap bridge" SVG illustration — while
// keeping one indigo / teal / gold results palette shared by every section, and every
// existing differentiator (gap-as-percentage-of-life chart, life-stage
// overlay, catch-up date, generation/zodiac comparison, sources
// drawer). ageDifferenceLogic.ts's math is untouched.

import React, { useState, useMemo, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence, animate } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import DateTimePicker from '@/components/common/DateTimePicker';
import * as FiIcons from 'react-icons/fi';
import {
  formatWithCommas,
  DATE_SOURCES,
} from '@/utils/calculators/dateLogic';
import {
  type AgeDifferenceResult,
  validateAgeDifferenceInput,
  calculateAgeDifference,
  getCatchUpDate,
  compareGenerations,
  compareZodiac,
  formatAgeGap,
  AGE_DIFFERENCE_SOURCES,
} from '@/utils/calculators/ageDifferenceLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiUsers, FiClock, FiTrendingUp, FiAlertCircle, FiInfo, FiCalendar,
  FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown, FiDownload,
  FiRotateCcw, FiZap, FiStar, FiGift, FiFlag, FiCheckCircle,
  FiLoader, FiImage, FiFileText, FiArrowDown, FiExternalLink,
} = FiIcons;

interface AgeDifferenceCalculatorProps {
  onCalculationComplete?: () => void;
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- SHARED ACCENT SYSTEM --- (identical contract to ChronologicalAgeCalculator.tsx's ACCENT)
const ACCENT = {
  text: 'text-indigo-700 dark:text-indigo-400',
  bg: 'bg-indigo-600',
  grad: 'from-indigo-50 to-amber-50 dark:from-indigo-900/20 dark:to-amber-800/10 border-indigo-200 dark:border-indigo-800',
  border: 'border-indigo-600 dark:border-indigo-400',
  bgLight: 'bg-indigo-50 dark:bg-indigo-900/20',
  shadow: 'shadow-indigo-600/10',
  hex: '#4338ca',
};

// Shared easing for every entrance in the headline: fast start, long soft
// landing — reads as "settling into place" rather than mechanical. Same
// curve as ChronologicalAgeCalculator.tsx / BirthdayCalculator.tsx.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Identical field-label convention to ChronologicalAgeCalculator.tsx /
// BirthdayCalculator.tsx's Input Fields card, so labels here read the
// same weight/size/color as every other calculator's.
const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";

// Plain, neutral field style — same border/ring convention DateTimePicker
// uses internally (indigo focus ring, neutral-200 border), so the custom
// age/birth-year fields here sit flush with the shared DateTimePicker
// fields instead of introducing a per-person color identity.
const plainFieldClass = "w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400";

// --- ACCESSIBLE INFO TOOLTIP --- (identical contract to ChronologicalAgeCalculator.tsx's InfoTip)
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
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - tipRect.width - VIEWPORT_MARGIN);
    let top = btnRect.top - GAP_ABOVE_ICON - tipRect.height;
    top = Math.max(top, VIEWPORT_MARGIN);
    setCoords({ top, left });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target) && tooltipRef.current && !tooltipRef.current.contains(target)) {
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
          style={{ position: 'fixed', top: coords?.top ?? -9999, left: coords?.left ?? -9999, visibility: coords ? 'visible' : 'hidden' }}
          className={`${widthClass} rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-xs font-medium leading-relaxed text-neutral-700 dark:text-neutral-200 shadow-lg pointer-events-none z-[100] text-center`}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};

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
      <span className="invisible">{formatter(value)}</span>
      <span className="absolute inset-0">{formatter(display)}</span>
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

// A clean, premium stat tile: a smooth diagonal gradient with a soft inset
// edge highlight, a glass icon orb, the figure (whole numbers count up;
// "42y 3m"-style values pass `segments` so the digits animate while the
// unit letters stay small and quiet), a hairline divider, the label, and
// an optional detail pill. No background graphics or textures.
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
  tone, icon, emoji, value, numericValue, segments, label, sub, badge, maxRem = 1.5, delay = 0,
}) => {
  const t = TILE_TONES[tone];
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: EASE_OUT }}
      className="group relative isolate overflow-hidden rounded-2xl px-3 pt-5 pb-4 sm:px-4 sm:pt-6 sm:pb-5 text-center text-white ring-1 ring-inset ring-white/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(145deg, ${t.from} 0%, ${t.mid} 46%, ${t.to} 100%)`,
        containerType: 'inline-size',
        boxShadow: `0 18px 32px -16px ${t.to}f2, 0 4px 10px -4px ${t.to}80, inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.25)`,
      }}
    >
      {badge && (
        <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/95 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
          {badge}
        </span>
      )}

      {/* glass icon orb */}
      <span
        className="relative z-10 mx-auto mb-3 inline-flex items-center justify-center w-11 h-11 rounded-2xl overflow-hidden ring-1 ring-white/40 backdrop-blur-sm text-lg leading-none"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.10) 100%)',
          boxShadow: '0 8px 16px -6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.55)',
        }}
        aria-hidden="true"
      >
        <span className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-full bg-white/30 blur-[3px]" />
        {icon ? <SafeIcon icon={icon} className="relative w-5 h-5 text-white drop-shadow" /> : <span className="relative">{emoji}</span>}
      </span>

      {/* figure */}
      <span
        className="relative z-10 block w-full font-bold tabular-nums tracking-tight leading-none whitespace-nowrap"
        style={{ ...fitNumberStyle(value, maxRem), textShadow: '0 1px 6px rgba(0,0,0,0.18)' }}
      >
        {segments && segments.every((seg) => seg.label) ? (
          <span className="flex items-stretch justify-center whitespace-normal">
            {segments.map((seg, i) => (
              <span
                key={seg.unit}
                className={`relative flex flex-1 min-w-0 flex-col items-center justify-center px-0.5 py-1.5 ${i > 0 ? 'border-l border-white/50' : ''}`}
              >
                <span className="text-[1.1rem] sm:text-[1.25rem] leading-none font-extrabold tabular-nums tracking-tight">
                  <CountUp value={seg.value} delay={delay + i * 0.08} />
                </span>
                <span className="mt-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.05em] text-white/95">{seg.label}</span>
              </span>
            ))}
          </span>
        ) : segments ? (
          <span className="inline-flex items-baseline justify-center gap-[0.28em]">
            {segments.map((seg, i) => (
              <span key={seg.unit} className="inline-flex items-baseline">
                <CountUp value={seg.value} delay={delay + i * 0.08} />
                <span className="ml-[0.08em] text-[0.46em] font-bold text-white/85">{seg.unit}</span>
              </span>
            ))}
          </span>
        ) : typeof numericValue === 'number' ? (
          <CountUp value={numericValue} formatter={formatWithCommas} delay={delay} />
        ) : (
          value
        )}
      </span>

      {/* hairline divider */}
      <span aria-hidden="true" className="relative z-10 mx-auto mt-3 mb-2.5 block h-px w-12 bg-gradient-to-r from-transparent via-white/70 to-transparent" />

      <span className="relative z-10 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/95">{label}</span>
      {sub && (
        <span className="relative z-10 mt-2 inline-block max-w-full rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/85 ring-1 ring-inset ring-white/10">
          {sub}
        </span>
      )}
    </motion.div>
  );
};

// --- HEADLINE CARD ---
// A bold "jewel-tone" panel — deep indigo diagonal gradient, white text,
// a warm gold accent on the headline figure — so the hero, stat tiles,
// timeline, chart and comparison cards all speak one indigo / teal /
// gold language. Built to a precise type/spacing scale rather than
// default Tailwind sizes, so every dimension here is a deliberate choice:
//   Eyebrow      11px / 700 / 0.16em tracking
//   Hero digits  32px → 44px (sm+) / 800 / tabular-nums
//   Hero labels  11px / 700 / 0.14em tracking
//   Sentence     16px → 18px (sm+) / 600
//   Footnote     11px / 600
// Motion is intentionally limited to three layers: two slow ambient
// glows (always-on, barely perceptible), one dashed dial ring behind
// the hero row (a quiet nod to the "time" subject matter, not a generic
// decoration), and a single shine sweep that plays once per calculation
// — one orchestrated reveal rather than scattered hover effects.
interface GapHeadlineCardProps {
  gapYears: number;
  gapMonths: number;
  gapDays: number;
  olderName: string;
  youngerName: string;
  initialOlder: string;
  initialYounger: string;
  /** True when Person 1 (the teal identity in the Input Fields card) is
   *  the older of the two. Needed so the hero avatars can be colored by
   *  PERSON IDENTITY (teal = Person 1, sky = Person 2) rather than by
   *  age role — otherwise "older/younger" and "teal/sky" would only
   *  agree by coincidence whenever Person 2 happened to be older. */
  olderIsPersonA: boolean;
  isApproximate: boolean;
  replayKey: string;
}

const GapHeadlineCard: React.FC<GapHeadlineCardProps> = ({
  gapYears, gapMonths, gapDays, olderName, youngerName, initialOlder, initialYounger, olderIsPersonA, isApproximate, replayKey,
}) => {
  const reduced = useReducedMotion();

  // Identity colors, fixed per person — teal always belongs to Person 1,
  // sky always belongs to Person 2, matching the Input Fields card's own
  // teal/sky dots exactly. Size (below) still shows who's older; color
  // no longer does, since color has to stay attached to the same person
  // however the "older/younger" labels swap between them.
  const TEAL_GRADIENT = 'linear-gradient(135deg,#0fa195,#146f68)';
  const SKY_GRADIENT = 'linear-gradient(135deg,#0293de,#08689d)';
  const olderAvatarGradient = olderIsPersonA ? TEAL_GRADIENT : SKY_GRADIENT;
  const youngerAvatarGradient = olderIsPersonA ? SKY_GRADIENT : TEAL_GRADIENT;
  const olderAvatarBorderClass = olderIsPersonA ? 'border-teal-100/90' : 'border-sky-100/90';
  const youngerAvatarBorderClass = olderIsPersonA ? 'border-sky-100/90' : 'border-teal-100/90';


  const fadeUp = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: EASE_OUT } };

  // Mouse-tracked spotlight — a soft radial highlight that follows the
  // cursor across the panel (desktop only; touch devices simply never
  // fire mousemove, so it costs nothing there). Pure CSS-variable
  // update, no re-render, so it stays smooth even on a busy page.
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const el = spotlightRef.current;
    if (!el) return;
    el.style.setProperty('--spot-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--spot-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    el.style.opacity = '1';
  }, [reduced]);
  const handlePointerLeave = useCallback(() => {
    const el = spotlightRef.current;
    if (el) el.style.opacity = '0';
  }, []);

  // Drifting sparkles — four tiny four-point stars, each on its own
  // slow float + twinkle loop with a fixed random-feeling offset, so
  // they read as ambient dust catching light rather than a repeating
  // pattern.
  const SPARKLES = [
    { top: '18%', left: '14%', size: 7, duration: 7, delay: 0 },
    { top: '68%', left: '10%', size: 5, duration: 9, delay: 1.2 },
    { top: '24%', left: '86%', size: 6, duration: 8, delay: 0.6 },
    { top: '74%', left: '90%', size: 8, duration: 10, delay: 2 },
  ];

  // Every non-zero unit is shown; if the gap is under a month, "Days"
  // still shows (even at 0) so the row never renders empty.
  const heroUnits = [
    { value: gapYears, unit: gapYears === 1 ? 'Year' : 'Years' },
    { value: gapMonths, unit: gapMonths === 1 ? 'Month' : 'Months' },
    { value: gapDays, unit: gapDays === 1 ? 'Day' : 'Days' },
  ].filter((u, i) => u.value > 0 || (i === 2 && gapYears === 0 && gapMonths === 0));

  return (
    <motion.div
      key={`shell-${replayKey}`}
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="relative overflow-hidden rounded-3xl border border-amber-200/25 shadow-[0_22px_54px_-16px_rgba(30,27,75,0.7),0_2px_0_0_rgba(0,0,0,0.06)]"
      style={{ background: 'linear-gradient(150deg, #14114c 0%, #252184 36%, #4239c3 72%, #6962e9 100%)' }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      {/* Foil accent bar — a single gold hairline at the top edge, the
          one deliberate premium cue on an otherwise strictly one-hue
          (deep indigo) panel, so the eye has exactly one accent color to
          notice rather than a background that competes for attention. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #fde68a 20%, #fbbf24 50%, #fde68a 80%, transparent 100%)' }}
      />
      {/* WRAPPING-PAPER TEXTURE — same faint diagonal-stripe overlay as
          BirthdayCalculator.tsx's Next Birthday hero, ported here as-is
          rather than the dot-grid this card used before, so the two
          calculators' hero cards share one surface treatment. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 2px, transparent 2px, transparent 26px)' }}
        aria-hidden="true"
      />
      {/* Vignette — quietly deepens the corners so the panel reads as a
          lit, three-dimensional surface rather than a flat fill; still
          strictly the one background hue, just darker at the edges. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, transparent 45%, rgba(10,8,40,0.34) 100%)' }}
        aria-hidden="true"
      />
      {/* Cursor-tracked spotlight — a large soft white glow that follows
          the pointer, giving the panel a tactile, "premium surface"
          feel. Opacity toggles on enter/leave via ref so it never
          triggers a React re-render. */}
      <div
        ref={spotlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hidden sm:block"
        style={{
          background: 'radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,255,255,0.14), transparent 65%)',
        }}
      />
      {/* Drifting sparkles — quiet ambient motion in the panel's quiet
          corners, well clear of the headline content. */}
      {!reduced && SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[2px] bg-white"
          style={{
            top: s.top, left: s.left, width: s.size, height: s.size,
            clipPath: 'polygon(50% 0%, 65% 35%, 100% 50%, 65% 65%, 50% 100%, 35% 65%, 0% 50%, 35% 35%)',
          }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.6, 1.1, 0.6], y: [0, -10, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Underglow — a single warm gold-to-indigo glow pooled along the bottom
          edge (same shape/role as Next Birthday's glow behind the
          gift), kept to the one background hue rather than blending in
          a second color. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-[10%] -right-[10%] h-48 rounded-full bg-gradient-to-t from-amber-200/35 via-indigo-300/18 to-transparent blur-3xl"
        animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Dashed dial rings, centered behind the hero number row — a
          quiet time/calendar motif rather than a generic orbit
          graphic, rotating almost imperceptibly slowly. */}
      {!reduced && (
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 420 420"
          className="pointer-events-none absolute left-1/2 top-[132px] sm:top-[150px] -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] opacity-40"
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="210" cy="210" r="190" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 11" fill="none" />
          <circle cx="210" cy="210" r="150" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 9" fill="none" />
        </motion.svg>
      )}
      {/* One-time shine — a soft diagonal band that crosses the panel
          once per fresh calculation, then disappears; the card's single
          "reveal" moment. */}
      {!reduced && (
        <motion.div
          key={`shine-${replayKey}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-[36%] bg-gradient-to-r from-transparent via-white/25 to-transparent"
          style={{ transform: 'skewX(-14deg)' }}
          initial={{ left: '-45%', opacity: 0 }}
          animate={{ left: '130%', opacity: [0, 1, 0] }}
          transition={{ duration: 1, delay: 0.15, ease: 'easeInOut' }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-5 sm:gap-6 px-5 py-8 sm:px-9 sm:py-10">
        {/* HEADER ROW — same icon-badge + title (left) / pill (right)
            convention as BirthdayCalculator.tsx's Next Birthday hero,
            so the two calculators' primary result cards read as one
            family, just recolored for this card's own two-person,
            indigo/gold theme. */}
        <motion.div {...fadeUp(0.02)} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 w-full">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-indigo-950/40" aria-hidden="true">
              <SafeIcon icon={FiUsers} className="w-3.5 h-3.5 text-white" />
            </span>
            <h4 className="text-base font-extrabold text-white">Age Gap</h4>
          </div>
          <span className="inline-flex max-w-full items-center gap-1.5 truncate text-[11px] sm:text-xs font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 text-amber-950 shadow-sm shadow-amber-500/30 whitespace-nowrap">
            <SafeIcon icon={isApproximate ? FiInfo : FiCheckCircle} className="w-3.5 h-3.5 flex-shrink-0" />
            {isApproximate ? 'Approximate' : 'Leap-year accurate'}
          </span>
        </motion.div>

        {/* HERO NUMBER ROW — same decorative-tile treatment as
            BirthdayCalculator.tsx's countdown row: each unit sits in
            its own glassy, backdrop-blurred box with a thin gold cap,
            rather than floating typography separated by a dot. */}
        <motion.div {...fadeUp(0.08)} className="relative flex items-stretch justify-center gap-2.5 sm:gap-3.5">
          {heroUnits.map((u) => (
            <div
              key={u.unit}
              className="relative flex flex-col items-center justify-center min-w-[76px] sm:min-w-[94px] px-3 py-3 sm:px-4 sm:py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-10px_rgba(0,0,0,0.5)]"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent"
              />
              <span className="text-[32px] sm:text-[44px] leading-none font-extrabold tabular-nums tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.3)]">
                <CountUp value={u.value} duration={0.9} delay={0.15} />
              </span>
              <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">{u.unit}</span>
            </div>
          ))}
        </motion.div>

        {/* BRIDGE — two gradient medallions (older visibly larger, per
            the calculator's own visual convention) joined by a dashed
            line. The midpoint pill deliberately does NOT repeat the
            gap breakdown (that figure already lives in the hero tiles
            above and the highlighted sentence below) — it just labels
            which side is older/younger, so the bridge reads as "who's
            who" rather than a third restatement of "by how much". */}
        <motion.div {...fadeUp(0.18)} className="flex items-start justify-center gap-0 w-full max-w-[280px] sm:max-w-xs">
          <div className="relative flex-shrink-0 flex flex-col items-center">
            <span
              className={`flex items-center justify-center rounded-full text-white font-extrabold border-2 ${olderAvatarBorderClass} shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] w-14 h-14 sm:w-16 sm:h-16 text-xl sm:text-2xl`}
              style={{ background: olderAvatarGradient }}
            >
              {initialOlder}
            </span>
            <span className="mt-1.5 max-w-[4.5rem] sm:max-w-[5.5rem] truncate text-[11px] sm:text-xs font-bold text-white/90 text-center">
              {olderName}
            </span>
          </div>
          <motion.span
            className="relative flex-1 h-px mx-1 sm:mx-2 mt-7 sm:mt-8"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(253,230,138,0.65) 0 6px, transparent 6px 12px)', backgroundSize: '12px 1px' }}
            animate={reduced ? undefined : { backgroundPositionX: [0, -24] }}
            transition={reduced ? undefined : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
          >
            {/* Traveling connection pulse — a small glowing spark that
                runs from the older avatar to the younger one and loops,
                so the bridge reads as an active connection rather than
                a static rule. Rendered before the label pill so it
                naturally passes behind it on the way across. */}
            {!reduced && (
              <motion.span
                aria-hidden="true"
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-200"
                style={{ boxShadow: '0 0 10px 3px rgba(252,211,77,0.75)' }}
                animate={{ left: ['2%', '98%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.12, 0.88, 1] }}
              />
            )}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-indigo-800 bg-white px-2.5 py-1 rounded-full ring-1 ring-amber-300/60 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.4)]">
              Older <span aria-hidden="true" className="text-indigo-600/70">→</span> Younger
            </span>
          </motion.span>
          <div className="relative flex-shrink-0 flex flex-col items-center">
            <span
              className={`flex items-center justify-center rounded-full text-white font-extrabold border-2 ${youngerAvatarBorderClass} shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] w-11 h-11 sm:w-12 sm:h-12 text-base sm:text-lg`}
              style={{ background: youngerAvatarGradient }}
            >
              {initialYounger}
            </span>
            <span className="mt-1.5 max-w-[4.5rem] sm:max-w-[5.5rem] truncate text-[11px] sm:text-xs font-bold text-white/90 text-center">
              {youngerName}
            </span>
          </div>
        </motion.div>

        {/* SENTENCE — refined into per-unit chips (each "3 years" kept
            as one non-breaking group, numbers lifted in the gold
            gradient, unit words softened to white/85), all sitting
            inside one glassy highlighted pill so the whole gap phrase
            reads as a single emphasized chunk within the sentence
            rather than either a long gradient string or scattered bare
            text. Wraps cleanly at any width instead of breaking
            mid-number on narrow screens. */}
        <motion.p
          {...fadeUp(0.3)}
          className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 text-center text-base sm:text-lg font-semibold text-white/95 leading-snug max-w-md"
        >
          <span className="font-extrabold text-white">{olderName}</span>
          <span className="text-white/90">is</span>
          <span className="inline-flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-amber-200/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            {heroUnits.map((u, i) => (
              <span key={u.unit} className="inline-flex items-baseline gap-1 whitespace-nowrap">
                {i > 0 && <span className="text-white/35 mr-0.5" aria-hidden="true">·</span>}
                <span className="font-extrabold tabular-nums bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent">{u.value}</span>
                <span className="text-white/85">{u.unit.toLowerCase()}</span>
              </span>
            ))}
          </span>
          <span className="text-white/90">older than</span>
          <span className="font-extrabold text-white">{youngerName}</span>
        </motion.p>
      </div>
    </motion.div>
  );
};


// --- GAP-SHRINKS-OVER-TIME CHART ---
// The age gap in years is fixed, but as a share of the younger person's
// age it falls hyperbolically (gap / age). This is a self-drawn SVG chart
// (no charting library, matching the rest of this calculator family) that
// is measured at its real pixel width, so labels stay a constant readable
// size on phones and desktops instead of scaling with a viewBox.
//
// Design decisions:
//  - LOG vertical axis. A 31-year gap is ~3,000% of a 1-year-old's age but
//    ~35% of a 90-year-old's; on a linear axis the whole curve would be a
//    flat line hugging the floor after the first few years. A log axis
//    keeps every age readable (and turns the hyperbola into a clean
//    diagonal). The hint under the chart says so.
//  - A live readout above the chart (big percentage + both people's ages)
//    that follows the pointer / arrow keys, defaulting to "right now".
//  - A pulsing "Now" marker at the younger person's current age.
//  - Clean surfaces only: soft gradient wash, hairline dashed grid, no
//    textures or decorative background graphics.
type YMD = { years: number; months: number; days: number };

const formatAgeGapYearsLabel = (years: number): string =>
  years >= 1 ? `${+years.toFixed(1)}-year` : `${Math.max(1, Math.round(years * 12))}-month`;

const formatGapPct = (p: number): string =>
  p >= 100 ? `${Math.round(p).toLocaleString('en-US')}%` : p >= 1 ? `${p.toFixed(1)}%` : `${p.toFixed(2)}%`;

const GapShrinkChart: React.FC<{
  gapYears: number;
  youngerNowAge: number;
  olderNowAge: number;
  /** Exact current ages (years / months / days) — shown instead of a rounded whole year so
   *  two people who are 10y 1m and 10y 10m don't both read as "age 10". */
  youngerNow: YMD;
  olderNow: YMD;
  /** The calendar gap between them, so hovered ages stay exact (younger = N years, older = N + gap). */
  gapYMD: YMD;
  youngerName: string;
  olderName: string;
  uid: string;
}> = ({ gapYears, youngerNowAge, olderNowAge, youngerNow, olderNow, gapYMD, youngerName, olderName, uid }) => {
  const reduced = useReducedMotion();
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, '');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(560);
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A gap under one day would put log(0) on the axis; clamp to one day.
  const gap = Math.max(gapYears, 1 / 365.2425);
  const minAge = 1;
  const maxAge = Math.min(130, Math.max(90, Math.ceil((youngerNowAge + 5) / 10) * 10));
  const nowAge = Math.min(Math.max(youngerNowAge, minAge), maxAge);
  const pctAt = (age: number) => (gap / age) * 100;

  const compact = width < 440;
  const H = compact ? 250 : 290;
  const PAD_L = compact ? 46 : 54;
  const PAD_R = 16;
  const PAD_T = 30;
  const PAD_B = 32;
  const plotW = Math.max(width - PAD_L - PAD_R, 1);
  const plotH = H - PAD_T - PAD_B;

  // log10 axis bounds, snapped to whole decades
  const logMin = Math.floor(Math.log10(pctAt(maxAge)));
  let logMax = Math.ceil(Math.log10(pctAt(minAge)));
  if (logMax <= logMin) logMax = logMin + 1;
  const xFor = (age: number) => PAD_L + ((age - minAge) / Math.max(maxAge - minAge, 1)) * plotW;
  const yFor = (pct: number) => PAD_T + (1 - (Math.log10(pct) - logMin) / (logMax - logMin)) * plotH;

  // y ticks: every decade, plus 2x / 5x minors when the range is short
  const yTicks: number[] = [];
  for (let k = logMin; k <= logMax; k++) {
    yTicks.push(10 ** k);
    if (logMax - logMin < 3 && k < logMax) yTicks.push(2 * 10 ** k, 5 * 10 ** k);
  }
  const fmtTick = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('en-US')}k%` : `${+v.toPrecision(2)}%`);

  const xStep = compact || maxAge > 100 ? 20 : 10;
  const xTicks: number[] = [minAge];
  for (let a = xStep; a <= maxAge; a += xStep) xTicks.push(a);

  // dense sample: quarter-years while the curve is steep, then whole years
  const ages: number[] = [];
  for (let a = minAge; a < 10; a += 0.25) ages.push(a);
  for (let a = 10; a <= maxAge; a += 1) ages.push(a);
  const linePath = ages.map((a, i) => `${i === 0 ? 'M' : 'L'} ${xFor(a).toFixed(1)} ${yFor(pctAt(a)).toFixed(1)}`).join(' ');
  const baseY = PAD_T + plotH;
  const areaPath = `${linePath} L ${xFor(maxAge).toFixed(1)} ${baseY} L ${xFor(minAge).toFixed(1)} ${baseY} Z`;

  const nx = xFor(nowAge);
  const ny = yFor(pctAt(nowAge));
  const pillX = Math.min(Math.max(nx - 18, 2), width - 38);
  const pillY = ny - PAD_T < 30 ? ny + 12 : ny - 30;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = minAge + ((e.clientX - rect.left - PAD_L) / plotW) * (maxAge - minAge);
    setHoverAge(Math.min(maxAge, Math.max(minAge, Math.round(raw))));
  };
  const handleKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const base = hoverAge ?? Math.round(nowAge);
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(minAge, base - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(maxAge, base + 1);
    else if (e.key === 'Home') next = minAge;
    else if (e.key === 'End') next = maxAge;
    else if (e.key === 'Escape') { setHoverAge(null); return; }
    if (next !== null) { e.preventDefault(); setHoverAge(next); }
  };

  const isNow = hoverAge === null;
  const activeAge = hoverAge ?? nowAge;
  // "Right now" must use the younger person's REAL age. `nowAge` is clamped to
  // the chart's 1-year left edge (so the marker stays on the plot), which
  // would make the readout wrong for anyone under 1 year old — e.g. a
  // 6-month-old with a 2-year gap is 400%, not the 200% shown at age 1.
  const realNowAge = Math.max(youngerNowAge, 1 / 365.2425);
  const activePct = isNow ? pctAt(realNowAge) : pctAt(activeAge);
  // Ages are shown as years + months + days, never rounded to a whole year:
  // the older person is always `gap` ahead, so flooring both would make them
  // look the same age whenever the gap is under a year. While hovering, the
  // younger person is exactly N years old and the older is N years plus the
  // calendar gap — exact, with no decimal-year conversion.
  const shownYounger: YMD = isNow ? youngerNow : { years: hoverAge!, months: 0, days: 0 };
  const shownOlder: YMD = isNow ? olderNow : { years: hoverAge! + gapYMD.years, months: gapYMD.months, days: gapYMD.days };

  const indigo = TILE_TONES.indigo;
  const gold = TILE_TONES.gold;
  const teal = TILE_TONES.teal;

  const AgePill = ({ tone, name, age }: { tone: TileTone; name: string; age: YMD }) => {
    const t = TILE_TONES[tone];
    const units = [
      { v: age.years, label: age.years === 1 ? 'Year' : 'Years' },
      { v: age.months, label: age.months === 1 ? 'Month' : 'Months' },
      { v: age.days, label: age.days === 1 ? 'Day' : 'Days' },
    ];
    return (
      <span
        className="flex min-w-0 flex-col gap-1 rounded-lg px-1.5 py-1.5 sm:px-2 text-white ring-1 ring-inset ring-white/20"
        style={{
          background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
          boxShadow: `0 6px 14px -8px ${t.to}cc, inset 0 1px 0 rgba(255,255,255,0.22)`,
        }}
      >
        <span className="truncate px-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] text-white/80">{name}</span>
        <span className="flex items-stretch gap-1">
          {units.map((u) => (
            <span
              key={u.label}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded bg-black/20 px-0.5 py-0.5 sm:min-w-[2.5rem] sm:flex-none sm:px-1 ring-1 ring-inset ring-white/10"
            >
              <span className="text-[13px] sm:text-sm font-extrabold leading-none tabular-nums">{u.v}</span>
              <span className="mt-px text-[6.5px] sm:text-[7.5px] font-bold uppercase leading-none tracking-[0.03em] text-white/75">{u.label}</span>
            </span>
          ))}
        </span>
      </span>
    );
  };

  return (
    <div>
      {/* LIVE READOUT */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4"
        style={{ borderColor: `${indigo.from}40`, background: `linear-gradient(160deg, ${indigo.from}1c 0%, ${gold.from}0d 60%, transparent 100%)` }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
            {isNow ? 'Right now' : `At age ${hoverAge}`}
          </p>
          <p className="mt-0.5 text-2xl sm:text-[1.7rem] font-bold tabular-nums tracking-tight leading-none text-neutral-900 dark:text-white">
            {formatGapPct(activePct)}
          </p>
          <p className="mt-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            of <span className="font-bold text-neutral-700 dark:text-neutral-200">{youngerName}</span>'s age is the gap
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto">
          <AgePill tone="gold" name={youngerName} age={shownYounger} />
          <AgePill tone="teal" name={olderName} age={shownOlder} />
        </div>
      </div>

      {/* CHART */}
      <div
        ref={wrapRef}
        className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white/70 dark:bg-neutral-900/40 px-1 pt-2 pb-1 sm:px-2"
      >
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block max-w-full select-none rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          style={{ touchAction: 'pan-y' }}
          role="img"
          tabIndex={0}
          aria-label={`Chart: the ${formatAgeGapYearsLabel(gap)} age gap as a percentage of ${youngerName}'s age. Use the left and right arrow keys to explore different ages.`}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoverAge(null)}
          onBlur={() => setHoverAge(null)}
          onKeyDown={handleKey}
        >
          <defs>
            <linearGradient id={`gsLine-${safeUid}`} gradientUnits="userSpaceOnUse" x1={PAD_L} y1="0" x2={width - PAD_R} y2="0">
              <stop offset="0%" stopColor={indigo.from} />
              <stop offset="55%" stopColor={teal.from} />
              <stop offset="100%" stopColor={gold.from} />
            </linearGradient>
            <linearGradient id={`gsArea-${safeUid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={indigo.from} stopOpacity="0.30" />
              <stop offset="100%" stopColor={gold.from} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* horizontal grid + y labels */}
          {yTicks.map((v) => (
            <g key={`y-${v}`}>
              <line x1={PAD_L} x2={width - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="currentColor" strokeDasharray="3 5" className="text-neutral-200 dark:text-neutral-700/70" />
              <text x={PAD_L - 8} y={yFor(v) + 3.5} textAnchor="end" fontSize="11" className="fill-neutral-500 dark:fill-neutral-400 font-semibold tabular-nums">{fmtTick(v)}</text>
            </g>
          ))}
          {/* x labels */}
          {xTicks.map((a) => (
            <text key={`x-${a}`} x={xFor(a)} y={H - 10} textAnchor="middle" fontSize="11" className="fill-neutral-500 dark:fill-neutral-400 font-semibold tabular-nums">{a}</text>
          ))}
          <line x1={PAD_L} x2={width - PAD_R} y1={baseY} y2={baseY} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" />

          {/* area + line */}
          <motion.path
            d={areaPath} fill={`url(#gsArea-${safeUid})`}
            initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: EASE_OUT }}
          />
          <motion.path
            d={linePath} fill="none" stroke={`url(#gsLine-${safeUid})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: EASE_OUT }}
          />

          {/* decade milestone dots */}
          {xTicks.filter((a) => a > minAge).map((a) => (
            <circle key={`d-${a}`} cx={xFor(a)} cy={yFor(pctAt(a))} r="3.5" className="fill-white dark:fill-neutral-900" stroke={teal.from} strokeWidth="2" />
          ))}

          {/* NOW marker */}
          <line x1={nx} x2={nx} y1={ny} y2={baseY} stroke={indigo.from} strokeOpacity="0.45" strokeDasharray="3 4" />
          {!reduced && (
            <motion.circle
              cx={nx} cy={ny} fill={indigo.from}
              initial={{ r: 6, opacity: 0.45 }} animate={{ r: 15, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <circle cx={nx} cy={ny} r="7" className="fill-white dark:fill-neutral-900" stroke={indigo.from} strokeWidth="2.5" />
          <circle cx={nx} cy={ny} r="3.5" fill={indigo.from} />
          <g aria-hidden="true">
            <rect x={pillX} y={pillY} width="36" height="18" rx="9" fill={indigo.mid} />
            <text x={pillX + 18} y={pillY + 12.5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff">Now</text>
          </g>

          {/* HOVER crosshair */}
          {hoverAge !== null && (
            <g pointerEvents="none">
              <line x1={xFor(hoverAge)} x2={xFor(hoverAge)} y1={PAD_T - 6} y2={baseY} stroke={gold.mid} strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx={xFor(hoverAge)} cy={yFor(pctAt(hoverAge))} r="6.5" className="fill-white dark:fill-neutral-900" stroke={gold.mid} strokeWidth="3" />
            </g>
          )}
          {/* invisible hit area */}
          <rect x={PAD_L} y={PAD_T - 10} width={plotW} height={plotH + 10} fill="transparent" />
        </svg>
      </div>

      <p className="mt-2.5 text-center text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        Hover, tap or use the arrow keys to explore any age. The vertical axis is logarithmic.
      </p>

      {/* START -> END */}
      <div className="mt-4 flex flex-wrap items-stretch justify-center gap-2.5 sm:gap-3">
        {[
          { key: 'birth', label: 'At birth', value: '\u221E', tone: TILE_TONES.slate, tip: "The chart starts at age 1 because a percentage of age 0 can't be calculated. As the younger person's age approaches zero, the gap grows without limit, so at birth it is shown as infinity." },
          { key: 'start', label: `At age ${minAge}`, value: formatGapPct(pctAt(minAge)), tone: indigo, tip: undefined as string | undefined },
          { key: 'end', label: `By age ${maxAge}`, value: formatGapPct(pctAt(maxAge)), tone: gold, tip: undefined as string | undefined },
        ].map((c, i) => (
          <React.Fragment key={c.key}>
            {i > 0 && (
              <span aria-hidden="true" className="self-center text-neutral-300 dark:text-neutral-600 text-lg font-bold">&rarr;</span>
            )}
            <div
              className="rounded-2xl border px-4 py-2.5 text-center min-w-[7.5rem]"
              style={{ borderColor: `${c.tone.from}40`, background: `linear-gradient(160deg, ${c.tone.from}1c 0%, ${c.tone.from}08 60%, transparent 100%)` }}
            >
              <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                {c.label}
                {c.tip && <InfoTip text={c.tip} widthClass="w-64" />}
              </p>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums text-neutral-900 dark:text-white">{c.value}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// --- LIFE-STAGE TIMELINE ---
// Three "moments" on a single connecting line: the day the younger person
// was born, the day they reach the older person's current age, and the
// fixed size of the gap itself. Each moment is a tinted card (gradient wash
// + tone-colored border, the same recipe as BirthdayCalculator.tsx's
// FactChip) beside a lacquered glass icon orb, with a large figure, one
// plain-language sentence and a status pill. Deliberately clean: no
// textures or decorative background graphics. Colors come from TILE_TONES
// so the section matches the stat tiles above it.
const formatLongDate = (d: Date, approx: boolean) =>
  approx
    ? `\u2248 ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const formatShortDate = (d: Date, approx: boolean) =>
  approx
    ? `\u2248 ${d.getFullYear()}`
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// "In 2y 4m" / "In 5 months" / "In 12 days" / "3y 1m ago" / "Today"
const formatAwayLabel = (days: number): string => {
  const abs = Math.abs(days);
  if (abs === 0) return 'Today';
  const years = Math.floor(abs / 365.2425);
  const months = Math.floor((abs - years * 365.2425) / 30.44);
  const span =
    years > 0 ? `${years}y ${months}m`
    : abs >= 31 ? `${Math.floor(abs / 30.44)} months`
    : `${abs} ${abs === 1 ? 'day' : 'days'}`;
  return days > 0 ? `In ${span}` : `${span} ago`;
};

interface LifeStageMoment {
  key: string;
  tone: TileTone;
  icon: IconType;
  eyebrow: string;
  figure: string;
  description: React.ReactNode;
  pill: string;
}

const LifeStageTimeline: React.FC<{ moments: LifeStageMoment[] }> = ({ moments }) => {
  const reduced = useReducedMotion();
  const first = TILE_TONES[moments[0].tone];
  const last = TILE_TONES[moments[moments.length - 1].tone];
  return (
    <div className="relative">
      {moments.length > 1 && (
        <motion.div
          aria-hidden="true"
          initial={reduced ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: EASE_OUT }}
          className="absolute left-[21px] top-6 bottom-6 w-0.5 rounded-full origin-top opacity-60"
          style={{ background: `linear-gradient(180deg, ${first.from} 0%, ${TILE_TONES.teal.from} 50%, ${last.from} 100%)` }}
        />
      )}
      <ol className="relative list-none m-0 p-0 space-y-3.5">
        {moments.map((m, i) => {
          const t = TILE_TONES[m.tone];
          return (
            <motion.li
              key={m.key}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 + i * 0.09, ease: EASE_OUT }}
              className="relative flex items-start gap-3 sm:gap-4"
            >
              <span
                className="relative z-10 flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ring-2 ring-white dark:ring-neutral-800 overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${t.from} 0%, ${t.to} 100%)`,
                  boxShadow: `0 10px 20px -8px ${t.to}cc, inset 0 1px 0 rgba(255,255,255,0.35)`,
                }}
                aria-hidden="true"
              >
                <span className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-full bg-white/25 blur-[3px]" />
                <SafeIcon icon={m.icon} className="relative w-[18px] h-[18px] text-white drop-shadow-sm" />
              </span>

              <div
                className="min-w-0 flex-1 rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 motion-safe:transition-all motion-safe:duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
                style={{
                  borderColor: `${t.from}38`,
                  background: `linear-gradient(160deg, ${t.from}1a 0%, ${t.from}08 55%, transparent 100%)`,
                  boxShadow: `0 1px 3px ${t.from}14`,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{m.eyebrow}</p>
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums whitespace-nowrap text-white ring-1 ring-inset ring-white/25"
                    style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, boxShadow: `0 4px 10px -4px ${t.to}99` }}
                  >
                    {m.pill}
                  </span>
                </div>
                <p className="mt-1 text-[15px] sm:text-[17px] font-semibold tabular-nums tracking-tight leading-snug text-neutral-900 dark:text-white break-words">
                  {m.figure}
                </p>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">{m.description}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
};

// --- COMPARISON PROFILE CARD ---
// A two-person "versus" panel for Generation and Western Zodiac. Structure:
// a gradient header strip (icon, category, match verdict pill), then one
// row per person (identity avatar, name, large value, small detail) with a
// connector chip between them that reads "vs" or, on a match, a check.
// Same header-strip + gradient-wash recipe as BirthdayCalculator.tsx's
// ProfileDetailCard, colored from TILE_TONES so it agrees with the stat
// tiles and the Life-Stage timeline. Person avatars keep the teal (Person
// 1) / sky (Person 2) identity colors the hero card uses. Clean surfaces
// only: no textures or decorative background graphics.
interface CompareProfilePerson {
  name: string;
  initial: string;
  /** Gradient for the identity avatar — fixed per person, never per role. */
  avatarGradient: string;
  value: React.ReactNode;
  meta?: string;
  /** Optional large glyph (e.g. a zodiac symbol) shown in a tile beside the value. */
  glyph?: string;
}

const PERSON_A_GRADIENT = 'linear-gradient(135deg,#0fa195,#146f68)';
const PERSON_B_GRADIENT = 'linear-gradient(135deg,#0293de,#08689d)';

const CompareProfileCard: React.FC<{
  tone: TileTone;
  icon: IconType;
  label: string;
  people: [CompareProfilePerson, CompareProfilePerson];
  match: boolean;
  matchLabel: string;
  noMatchLabel: string;
  delay?: number;
}> = ({ tone, icon, label, people, match, matchLabel, noMatchLabel, delay = 0 }) => {
  const reduced = useReducedMotion();
  const t = TILE_TONES[tone];

  const renderPerson = (person: CompareProfilePerson) => (
    <div className="flex items-center gap-3.5">
      <span
        className="relative flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-extrabold text-white ring-2 ring-white dark:ring-neutral-800 overflow-hidden"
        style={{ background: person.avatarGradient, boxShadow: '0 8px 16px -8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4)' }}
        aria-hidden="true"
      >
        <span className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-full bg-white/25 blur-[2px]" />
        <span className="relative">{person.initial}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 truncate">{person.name}</p>
        <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-neutral-50 break-words">{person.value}</p>
        {person.meta && <p className="mt-1 text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">{person.meta}</p>}
      </div>
      {person.glyph && (
        <span
          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl leading-none text-white ring-1 ring-white/40 dark:ring-white/10"
          style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, boxShadow: `0 10px 20px -8px ${t.to}cc, inset 0 1px 0 rgba(255,255,255,0.35)` }}
          aria-hidden="true"
        >
          <span className="drop-shadow-sm">{person.glyph}</span>
        </span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      className="group relative overflow-hidden rounded-2xl border shadow-sm motion-safe:transition-all motion-safe:duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
      style={{ borderColor: `${t.from}40` }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5"
        style={{ background: `linear-gradient(90deg, ${t.from} 0%, ${t.to} 100%)` }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <SafeIcon icon={icon} aria-hidden="true" className="w-3.5 h-3.5 text-white/95 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/95">{label}</span>
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${match ? 'bg-white text-neutral-900 ring-white/60' : 'bg-black/20 text-white/90 ring-white/25'}`}>
          {match && <span style={{ color: t.mid }} className="inline-flex"><SafeIcon icon={FiCheck} className="w-3 h-3" /></span>}
          {match ? matchLabel : noMatchLabel}
        </span>
      </div>

      <div
        className="p-4 sm:p-5"
        style={{ background: `linear-gradient(160deg, ${t.from}1f 0%, ${t.to}0f 55%, transparent 100%)` }}
      >
        {renderPerson(people[0])}

        <div className="relative my-3.5 flex items-center" aria-hidden="true">
          <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.from}55)` }} />
          <span
            className="mx-2.5 inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full px-2 text-[10px] font-extrabold uppercase tracking-wider text-white"
            style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, boxShadow: `0 4px 10px -4px ${t.to}99` }}
          >
            {match ? '=' : 'vs'}
          </span>
          <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${t.from}55, transparent)` }} />
        </div>

        {renderPerson(people[1])}
      </div>
    </motion.div>
  );
};

// Slow, eased scroll to an element. The browser's built-in smooth scroll is
// short (a few hundred ms) and differs per browser, so it reads as a jump.
// The target is re-measured every frame because the results mount while
// the page is still scrolling and push the layout around. Any touch, wheel
// or key press from the visitor cancels it immediately.
const slowScrollToElement = (el: HTMLElement, duration = 1800) => {
  const startY = window.scrollY;
  const startTime = performance.now();
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  window.addEventListener('keydown', cancel, { once: true });
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min((now - startTime) / duration, 1);
    const targetY = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, startY + (targetY - startY) * ease(t));
    if (t < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

const AgeDifferenceCalculator: React.FC<AgeDifferenceCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const chartUid = useId();

  // --- STATE ---
  const [personAName, setPersonAName] = useState<string>('');
  const [personBName, setPersonBName] = useState<string>('');

  const [personABirthDate, setPersonABirthDate] = useState<Date | null>(null);
  const [personBBirthDate, setPersonBBirthDate] = useState<Date | null>(null);

  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [committedA, setCommittedA] = useState<Date | null>(null);
  const [committedB, setCommittedB] = useState<Date | null>(null);
  const [committedAName, setCommittedAName] = useState<string>('Person 1');
  const [committedBName, setCommittedBName] = useState<string>('Person 2');
  const [isApproximate, setIsApproximate] = useState<boolean>(false);
  const [resultKey, setResultKey] = useState<number>(0);

  const [showSources, setShowSources] = useState<boolean>(false);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  // --- SHARE --- use the page's handlers when provided; otherwise fall back to
  // the browser so the buttons always work.
  const [localCopied, setLocalCopied] = useState<boolean>(false);
  const pageUrl = () => (typeof window !== 'undefined' ? window.location.href : '');
  const handleCopyLinkClick = async () => {
    if (onCopyLink) { onCopyLink(); return; }
    try {
      await navigator.clipboard.writeText(pageUrl());
      setLocalCopied(true);
      window.setTimeout(() => setLocalCopied(false), 2000);
    } catch { /* clipboard blocked — nothing to do */ }
  };
  const handleShareClick = () => {
    if (onShare) { onShare(); return; }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({ title: 'Age Difference Calculator', url: pageUrl() }).catch(() => {});
    } else {
      void handleCopyLinkClick();
    }
  };
  const handleEmailClick = () => {
    if (onEmailShare) { onEmailShare(); return; }
    window.location.href = `mailto:?subject=${encodeURIComponent('Age Difference Calculator')}&body=${encodeURIComponent(pageUrl())}`;
  };
  const isLinkCopied = onCopyLink ? linkCopied : localCopied;

  // --- DOWNLOAD DROPDOWN --- same pattern as BirthdayCalculator.tsx's result header menu
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [downloadMenuOpen]);
  useEffect(() => {
    if (downloadingFormat) setDownloadMenuOpen(false);
  }, [downloadingFormat]);

  // --- LIVE TICK --- (each person's "current age" ticks like Chronological Age's headline does)
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!hasCalculated) return;
    // First tick waits until the ~1.8s post-Calculate scroll has finished, so a
    // per-second re-render of the whole results tree can't land mid-scroll.
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      setLiveNow(new Date());
      interval = window.setInterval(() => setLiveNow(new Date()), 1000);
    }, 2000);
    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [hasCalculated]);

  // --- BIRTH DATES ---
  // The calculator works from exact birth dates only.
  const resolveBirthDates = (): { a: Date | null; b: Date | null; approximate: boolean } => ({
    a: personABirthDate,
    b: personBBirthDate,
    approximate: false,
  });

  const isCalculateDisabled = useMemo(() => {
    const { a, b } = resolveBirthDates();
    return !a || !b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personABirthDate, personBBirthDate]);

  // Same contract as ChronologicalAgeCalculator.tsx's isClearDisabled:
  // nothing to clear once every field is already empty and no result is
  // showing.
  const isClearDisabled = useMemo(() => {
    const noInputs =
      !personABirthDate && !personBBirthDate &&
      personAName.trim() === '' && personBName.trim() === '';
    return noInputs && !hasCalculated;
  }, [personABirthDate, personBBirthDate, personAName, personBName, hasCalculated]);

  const handleClear = () => {
    setPersonABirthDate(null); setPersonBBirthDate(null);
    setPersonAName(''); setPersonBName('');
    setHasCalculated(false); setFormError(null);
    setCommittedA(null); setCommittedB(null);
    if (onReportChange) onReportChange(null);
  };

  const handleCalculate = () => {
    const { a, b, approximate } = resolveBirthDates();
    if (!a || !b) return;

    const today = new Date();
    const validation = validateAgeDifferenceInput(a, b, today);
    if (!validation.isValid) {
      setFormError(validation.error ?? 'Please check both dates and try again.');
      setHasCalculated(false);
      return;
    }

    setFormError(null);
    setCommittedA(a);
    setCommittedB(b);
    setCommittedAName(personAName.trim() || 'Person 1');
    setCommittedBName(personBName.trim() || 'Person 2');
    setIsApproximate(approximate);
    setHasCalculated(true);
    setLiveNow(today);
    setResultKey((k) => k + 1);

    if (onCalculationComplete) onCalculationComplete();

    window.requestAnimationFrame(() => {
      const target = actionButtonsRef.current;
      if (!target) return;
      if (prefersReducedMotion) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      else slowScrollToElement(target, 1800);
    });
  };

  // --- DERIVED RESULTS ---
  const result: AgeDifferenceResult | null = useMemo(() => {
    if (!hasCalculated || !committedA || !committedB) return null;
    return calculateAgeDifference(committedA, committedB, liveNow);
  }, [hasCalculated, committedA, committedB, liveNow]);

  const olderName = result?.olderIsPersonA ? committedAName : committedBName;
  const youngerName = result?.olderIsPersonA ? committedBName : committedAName;
  const olderAge = result ? (result.olderIsPersonA ? result.personA : result.personB).currentAge : null;
  const youngerAge = result ? (result.olderIsPersonA ? result.personB : result.personA).currentAge : null;

  const generationCompare = useMemo(() => (committedA && committedB ? compareGenerations(committedA, committedB) : null), [committedA, committedB]);
  const zodiacCompare = useMemo(() => (committedA && committedB && !isApproximate ? compareZodiac(committedA, committedB) : null), [committedA, committedB, isApproximate]);

  const catchUpDate = useMemo(() => {
    if (!result) return null;
    const olderCurrentYears = result.olderIsPersonA ? result.personA.currentAge.years : result.personB.currentAge.years;
    return getCatchUpDate(result.youngerBirthDate, olderCurrentYears);
  }, [result]);

  // --- SHAREABLE REPORT ---
  // Best-effort mapping onto the app's ShareableReport shape — adjust
  // field names here if they differ from what '@/lib/reports/types'
  // actually exports; the calculation logic above is unaffected either way.
  useEffect(() => {
    if (!onReportChange) return;
    if (!result) { onReportChange(null); return; }
    onReportChange({
      title: 'Age Difference Result',
      subtitle: `${olderName} is ${formatAgeGap(result.gap)} older than ${youngerName}`,
      stats: [
        { label: `${olderName}'s age`, value: `${result.olderIsPersonA ? result.personA.currentAge.years : result.personB.currentAge.years} years` },
        { label: `${youngerName}'s age`, value: `${result.olderIsPersonA ? result.personB.currentAge.years : result.personA.currentAge.years} years` },
        { label: 'Total days apart', value: formatWithCommas(result.gap.totalDays) },
      ],
    } as unknown as ShareableReport);
  }, [result, olderName, youngerName, onReportChange]);

  const toggleSources = () => {
    setShowSources((prev) => {
      const next = !prev;
      if (next) { setSourcesPulse(true); window.setTimeout(() => setSourcesPulse(false), 1600); }
      return next;
    });
  };

  const combinedSources = [...AGE_DIFFERENCE_SOURCES, ...DATE_SOURCES.filter((s) => s.metric.includes('Calendar') || s.metric.includes('Age Calculation') || s.metric.includes('Feb 29'))];

  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!result || downloadingFormat !== null}
        aria-haspopup="menu"
        aria-expanded={downloadMenuOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-neutral-600 disabled:hover:border-neutral-200 disabled:hover:shadow-sm disabled:active:scale-100"
        title={result ? "Download your result" : "Calculate a result first"}
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
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Quick shareable card</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('pdf'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer border-t border-neutral-100 dark:border-neutral-700/50">
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

  // --- RENDER ---
  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* --- INPUT FIELDS CARD ---
          Plain treatment matching ChronologicalAgeCalculator.tsx /
          BirthdayCalculator.tsx exactly: no tinted background, no
          per-field colored border panel — labels + fields sit directly
          on the card's own white/neutral surface, and only the shared
          indigo focus ring (the same one DateTimePicker uses internally)
          marks an active field. The two people are told apart with a
          plain "Person 1" / "Person 2" label, not a color identity. */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <SafeIcon icon={FiUsers} className="w-3 h-3" />
              Two People Based
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {/* PERSON 1 — teal identity accent, echoing the headline
                card's older-person medallion, so the two columns read
                as distinct people at a glance rather than two identical
                forms. Deliberately kept off the red/gold results
                palette — this card is unthemed by design. */}
            <div className="relative space-y-4 sm:pl-4 sm:border-l-2 sm:border-teal-200/70 dark:sm:border-teal-800/50">
              <div>
                <div className={fieldLabelRowClass}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm shadow-teal-500/40" aria-hidden="true" />
                  <label htmlFor="personAName" className={fieldLabelClass}>Person 1</label>
                </div>
                <input
                  id="personAName"
                  type="text"
                  value={personAName}
                  onChange={(e) => setPersonAName(e.target.value)}
                  placeholder="Optional name"
                  aria-label="Person 1 name (optional)"
                  className={`${plainFieldClass} placeholder:text-neutral-400 placeholder:font-medium`}
                />
              </div>
              <div>
                <div className={fieldLabelRowClass}>
                  <label className={fieldLabelClass}>Date of Birth</label>
                </div>
                <DateTimePicker value={personABirthDate} onChange={setPersonABirthDate} ariaLabel="Person 1 date of birth" dateLabel="" maxDate={new Date()} />
              </div>
            </div>

            {/* PERSON 2 — sky identity accent, mirroring Person 1's
                teal so both medallion colors above are anchored to a
                real input, not just the results. Deliberately kept on
                the original neutral teal/sky pair rather than the
                red/gold palette used in the results below — the input
                card is a separate, unthemed surface. */}
            <div className="relative space-y-4 sm:pl-4 sm:border-l-2 sm:border-sky-200/70 dark:sm:border-sky-800/50">
              <div>
                <div className={fieldLabelRowClass}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-sky-300 to-sky-600 shadow-sm shadow-sky-500/40" aria-hidden="true" />
                  <label htmlFor="personBName" className={fieldLabelClass}>Person 2</label>
                </div>
                <input
                  id="personBName"
                  type="text"
                  value={personBName}
                  onChange={(e) => setPersonBName(e.target.value)}
                  placeholder="Optional name"
                  aria-label="Person 2 name (optional)"
                  className={`${plainFieldClass} placeholder:text-neutral-400 placeholder:font-medium`}
                />
              </div>
              <div>
                <div className={fieldLabelRowClass}>
                  <label className={fieldLabelClass}>Date of Birth</label>
                </div>
                <DateTimePicker value={personBBirthDate} onChange={setPersonBBirthDate} ariaLabel="Person 2 date of birth" dateLabel="" maxDate={new Date()} />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {formError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs font-semibold text-red-500 flex items-center gap-1.5"
              >
                <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
                {formError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ACTION BUTTONS — identical shared styling to ChronologicalAgeCalculator.tsx / BirthdayCalculator.tsx's Clear + Calculate pair */}
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

      {/* EMPTY STATE — identical to the other calculators: static icon, shown until the first result lands and hidden while an error is showing */}
      {!result && !formError && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20"
        >
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <circle cx="38" cy="42" r="16" stroke="currentColor" strokeWidth="5" />
            <circle cx="70" cy="50" r="11" stroke="currentColor" strokeWidth="5" />
            <path d="M20 82 C20 66 28 58 38 58 C48 58 56 66 56 82" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <path d="M56 82 C56 70 62 63 70 63 C78 63 84 70 84 82" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Enter both people's birthdates above, then press Calculate to see the age gap, life-stage snapshot, and more.
          </p>
        </motion.div>
      )}

      {/* --- RESULTS --- */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* RESULT HEADER ROW */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
                Your Age Difference Results
              </h3>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {renderDownloadButtons()}
              </div>
            </div>

            {/* HEADLINE */}
            <GapHeadlineCard
              gapYears={result.gap.years}
              gapMonths={result.gap.months}
              gapDays={result.gap.days}
              olderName={olderName}
              youngerName={youngerName}
              initialOlder={(olderName || 'O').trim().charAt(0).toUpperCase()}
              initialYounger={(youngerName || 'Y').trim().charAt(0).toUpperCase()}
              olderIsPersonA={result.olderIsPersonA}
              isApproximate={isApproximate}
              replayKey={String(resultKey)}
            />

            {/* STAT GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
              <StatTile
                tone="indigo" icon={FiCalendar}
                value={formatWithCommas(result.gap.totalWeeks)} numericValue={result.gap.totalWeeks}
                label="Weeks Apart"
                sub={`${result.gap.years}y ${result.gap.months}m ${result.gap.days}d`}
                delay={0}
              />
              <StatTile
                tone="slate" icon={FiZap}
                value={formatWithCommas(result.gap.totalDays)} numericValue={result.gap.totalDays}
                label="Days Apart"
                sub={`${formatWithCommas(result.gap.totalDays * 24)} hours`}
                delay={0.06}
              />
              {olderAge && (
                <StatTile
                  tone="teal" icon={FiUsers}
                  value={`${olderAge.years}y ${olderAge.months}m ${olderAge.days}d`}
                  segments={[
                    { value: olderAge.years, unit: 'y', label: olderAge.years === 1 ? 'Year' : 'Years' },
                    { value: olderAge.months, unit: 'm', label: olderAge.months === 1 ? 'Month' : 'Months' },
                    { value: olderAge.days, unit: 'd', label: olderAge.days === 1 ? 'Day' : 'Days' },
                  ]}
                  label={`${olderName}'s Age`}
                  sub="Older"
                  delay={0.12}
                />
              )}
              {youngerAge && (
                <StatTile
                  tone="gold" icon={FiUsers}
                  value={`${youngerAge.years}y ${youngerAge.months}m ${youngerAge.days}d`}
                  segments={[
                    { value: youngerAge.years, unit: 'y', label: youngerAge.years === 1 ? 'Year' : 'Years' },
                    { value: youngerAge.months, unit: 'm', label: youngerAge.months === 1 ? 'Month' : 'Months' },
                    { value: youngerAge.days, unit: 'd', label: youngerAge.days === 1 ? 'Day' : 'Days' },
                  ]}
                  label={`${youngerName}'s Age`}
                  sub="Younger"
                  delay={0.18}
                />
              )}
            </div>

            {/* LIFE-STAGE SNAPSHOT */}
            <ResultCard>
              <SectionHeader icon={FiClock} title="Life-Stage Snapshot" subtitle="The same gap, framed as moments in time rather than a number." />
              <LifeStageTimeline
                moments={[
                  {
                    key: 'birth',
                    tone: 'indigo',
                    icon: FiGift,
                    eyebrow: `The day ${youngerName} was born`,
                    figure: formatAgeGap(result.gap),
                    description: <><strong className="text-neutral-800 dark:text-neutral-100">{olderName}</strong> was already this old when <strong className="text-neutral-800 dark:text-neutral-100">{youngerName}</strong> arrived.</>,
                    pill: formatShortDate(result.youngerBirthDate, isApproximate),
                  },
                  ...(catchUpDate && olderAge ? [{
                    key: 'catchup',
                    tone: 'teal' as const,
                    icon: FiCalendar,
                    eyebrow: 'The catch-up date',
                    figure: formatLongDate(catchUpDate, isApproximate),
                    description: <><strong className="text-neutral-800 dark:text-neutral-100">{youngerName}</strong> {catchUpDate.getTime() >= liveNow.getTime() ? 'turns' : 'turned'} {olderAge.years}, the age <strong className="text-neutral-800 dark:text-neutral-100">{olderName}</strong> is right now.</>,
                    pill: formatAwayLabel(Math.round((catchUpDate.getTime() - liveNow.getTime()) / 86400000)),
                  }] : []),
                  {
                    key: 'constant',
                    tone: 'gold',
                    icon: FiFlag,
                    eyebrow: 'The gap itself',
                    figure: `${formatWithCommas(result.gap.totalDays)} days`,
                    description: <>That's {formatWithCommas(result.gap.totalWeeks)} weeks, and it never grows or shrinks. Only its share of each life does (see the chart below).</>,
                    pill: 'Never changes',
                  },
                ]}
              />
            </ResultCard>

            {/* GAP OVER A LIFETIME CHART */}
            {result.gap.totalDays > 0 && olderAge && youngerAge && (
              <ResultCard>
                <SectionHeader
                  icon={FiTrendingUp}
                  title="How the Gap Shrinks Over Time"
                  subtitle="The number of years between you never changes, but it becomes a smaller share of your lives as you both get older."
                  tip="Gap % = the age gap in years divided by the younger person's age at that point, ×100. It's a mathematical framing, not a claim about how a relationship should feel."
                />
                <GapShrinkChart
                  gapYears={(result.youngerBirthDate.getTime() - result.olderBirthDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)}
                  youngerNowAge={youngerAge.years + youngerAge.months / 12 + youngerAge.days / 365.2425}
                  youngerNow={{ years: youngerAge.years, months: youngerAge.months, days: youngerAge.days }}
                  olderNowAge={olderAge.years + olderAge.months / 12 + olderAge.days / 365.2425}
                  olderNow={{ years: olderAge.years, months: olderAge.months, days: olderAge.days }}
                  gapYMD={{ years: result.gap.years, months: result.gap.months, days: result.gap.days }}
                  youngerName={youngerName}
                  olderName={olderName}
                  uid={chartUid}
                />
              </ResultCard>
            )}

            {/* GENERATION & ZODIAC */}
            {generationCompare && (
              <ResultCard>
                <SectionHeader
                  icon={FiStar}
                  title="Generation & Zodiac"
                  subtitle="Fun context, not a factual claim about either person."
                  badge={(() => {
                    const total = zodiacCompare ? 2 : 1;
                    const matches = (generationCompare.sameGeneration ? 1 : 0) + (zodiacCompare?.sameSign ? 1 : 0);
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-white ring-1 ring-inset ring-white/25"
                        style={{ background: `linear-gradient(135deg, ${TILE_TONES.gold.from} 0%, ${TILE_TONES.gold.to} 100%)`, boxShadow: `0 6px 14px -6px ${TILE_TONES.gold.to}99` }}
                      >
                        <SafeIcon icon={matches > 0 ? FiCheckCircle : FiUsers} className="w-3 h-3" />
                        {matches} of {total} in common
                      </span>
                    );
                  })()}
                />
                <div className={`grid gap-4 ${zodiacCompare ? 'sm:grid-cols-2' : ''}`}>
                  <CompareProfileCard
                    tone="indigo"
                    icon={FiGift}
                    label="Generation"
                    people={[
                      {
                        name: committedAName,
                        initial: (committedAName || 'P').trim().charAt(0).toUpperCase(),
                        avatarGradient: PERSON_A_GRADIENT,
                        value: generationCompare.personA.label,
                        meta: generationCompare.personA.yearRange,
                      },
                      {
                        name: committedBName,
                        initial: (committedBName || 'P').trim().charAt(0).toUpperCase(),
                        avatarGradient: PERSON_B_GRADIENT,
                        value: generationCompare.personB.label,
                        meta: generationCompare.personB.yearRange,
                      },
                    ]}
                    match={generationCompare.sameGeneration}
                    matchLabel="Same Generation"
                    noMatchLabel="Different Generations"
                    delay={0}
                  />
                  {zodiacCompare && (
                    <CompareProfileCard
                      tone="gold"
                      icon={FiStar}
                      label="Western Zodiac"
                      people={[
                        {
                          name: committedAName,
                          initial: (committedAName || 'P').trim().charAt(0).toUpperCase(),
                          avatarGradient: PERSON_A_GRADIENT,
                          value: zodiacCompare.personA.sign,
                          meta: zodiacCompare.personA.dateRange,
                          glyph: zodiacCompare.personA.symbol,
                        },
                        {
                          name: committedBName,
                          initial: (committedBName || 'P').trim().charAt(0).toUpperCase(),
                          avatarGradient: PERSON_B_GRADIENT,
                          value: zodiacCompare.personB.sign,
                          meta: zodiacCompare.personB.dateRange,
                          glyph: zodiacCompare.personB.symbol,
                        },
                      ]}
                      match={zodiacCompare.sameSign}
                      matchLabel="Same Sign"
                      noMatchLabel="Different Signs"
                      delay={0.08}
                    />
                  )}
                </div>
                {!zodiacCompare && isApproximate && (
                  <p className="mt-3 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Zodiac signs need exact birth dates, so they're hidden when you enter ages or birth years.
                  </p>
                )}
              </ResultCard>
            )}

            {/* CONTEXT NOTE — optional, neutral benchmark. Applies to couples only; the copy says so explicitly and avoids "most recent", since the cited figure is from 2014. */}
            <div
              className="flex items-start gap-3.5 rounded-2xl border px-4 py-4 sm:px-5"
              style={{
                borderColor: `${TILE_TONES.gold.from}40`,
                background: `linear-gradient(160deg, ${TILE_TONES.gold.from}1a 0%, ${TILE_TONES.gold.from}08 60%, transparent 100%)`,
              }}
            >
              <span
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-white/40 dark:ring-white/10"
                style={{ background: `linear-gradient(135deg, ${TILE_TONES.gold.from} 0%, ${TILE_TONES.gold.to} 100%)`, boxShadow: `0 8px 16px -8px ${TILE_TONES.gold.to}cc, inset 0 1px 0 rgba(255,255,255,0.35)` }}
                aria-hidden="true"
              >
                <SafeIcon icon={FiInfo} className="w-4 h-4 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-neutral-900 dark:text-white">A little context</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
                  For couples, US survey data (2014) shows an average gap of about 2.3 years between opposite-sex spouses, and somewhat larger for same-sex couples. These are averages only, and no gap is more or less &ldquo;normal&rdquo; than another.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHARE, DISCLAIMER and SOURCES — always visible (not only after a result), in the
          same order and styling as the other calculators: Share -> Disclaimer -> Sources.
          Wrapped in one element so the root's space-y-6 doesn't stack on their own margins. */}
      <div>
        {/* SHARE */}
        <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-5 mt-5 border-t border-neutral-100 dark:border-neutral-800 text-center sm:text-right">
          <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">
            Like this? Please share
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleShareClick}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:ring-blue-200 dark:hover:ring-blue-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer"
              title="Share this calculator"
              aria-label="Share this calculator"
            >
              <SafeIcon icon={FiShare2} className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleEmailClick}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:ring-amber-200 dark:hover:ring-amber-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer"
              title="Share via email"
              aria-label="Share via email"
            >
              <SafeIcon icon={FiMail} className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCopyLinkClick}
              className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer ${
                isLinkCopied
                  ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400'
                  : 'bg-violet-50 dark:bg-violet-500/10 ring-violet-100 dark:ring-violet-800/40 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:shadow-md hover:ring-violet-200 dark:hover:ring-violet-700/60 hover:-translate-y-0.5'
              }`}
              title="Copy link to this calculator"
              aria-label="Copy link to this calculator"
            >
              <SafeIcon icon={isLinkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{isLinkCopied ? 'Copied' : 'Link'}</span>
            </button>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
          <p className="leading-normal">
            <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator provides general date-based information for informational and entertainment purposes only. The age gap is calculated from the dates or ages you enter; when you enter ages or birth years, results are approximate.
          </p>
        </div>

        {/* SOURCES ACCORDION — directly below the disclaimer */}
        <div
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
                  {combinedSources.length} references — every convention and statistic used above, cited
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
                {combinedSources.map((source, i) => (
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
      </div>
    </div>
  );
};

export default AgeDifferenceCalculator;
