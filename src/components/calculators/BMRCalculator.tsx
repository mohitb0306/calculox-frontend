"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  calculateBMR,
  calculateTDEE,
  getGoalCalories,
  getLifeStageAdjustment,
  applyLifeStageAddition,
  getTDEEBreakdown,
  validateBMRInput,
  validateBodyFatInput,
  AGE_VALIDATED_MIN,
  AGE_VALIDATED_MAX,
  BODY_FAT_MIN,
  BODY_FAT_MAX,
  BMRUnit,
  BMRGender,
  ActivityLevel,
  BMRResult,
  TDEEEntry,
  GoalCalorieEntry,
  LifeStage,
  PregnancyTrimester,
  BreastfeedingStage,
  BMR_SOURCES,
} from '@/utils/calculators/bmrLogic';
import type { ShareableReport } from '@/lib/reports/types';
import SegmentedRingChart from '@/components/charts/SegmentedRingChart';

const {
  FiAlertCircle, FiInfo, FiZap, FiArrowDown, FiImage, FiFileText, FiLoader,
  FiRotateCcw, FiCheckCircle, FiExternalLink, FiTrendingUp, FiTrendingDown,
  FiMinus, FiShield, FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown,
  FiDownload, FiBarChart2, FiActivity, FiUser, FiWind, FiAward, FiSliders,
} = FiIcons;

interface BMRCalculatorProps {
  onCalculationComplete?: () => void;
  /**
   * Fired whenever the current result changes — including becoming null when
   * there is no shareable result (no calculation yet, or a validation
   * error). Mirrors BMICalculator's contract exactly.
   */
  onReportChange?: (report: ShareableReport | null) => void;
  /** Triggers the PNG/PDF download for the current report — implemented by
   * the parent page, same as BMICalculator. */
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

const ACTIVITY_OPTIONS: Array<{ level: ActivityLevel; label: string; description: string }> = [
  { level: 'sedentary', label: 'Sedentary', description: 'little or no exercise' },
  { level: 'light', label: 'Light', description: 'light exercise 1\u20133 days/week' },
  { level: 'moderate', label: 'Moderate', description: 'moderate exercise 3\u20135 days/week' },
  { level: 'active', label: 'Active', description: 'hard exercise 6\u20137 days/week' },
  { level: 'very_active', label: 'Very Active', description: 'very hard exercise + physical job' },
  { level: 'extra_active', label: 'Extra Active', description: 'professional athlete / very demanding job' },
];

// One icon per tier for the TDEE table's row chips — a quick visual read
// of "how intense" a tier is (low movement → peak output) before anyone
// reads the label, and gives each row its own identity instead of six
// identically-shaped rows differing only by text.
const ACTIVITY_ICONS: Record<ActivityLevel, IconType> = {
  sedentary: FiUser,
  light: FiWind,
  moderate: FiActivity,
  active: FiZap,
  very_active: FiTrendingUp,
  extra_active: FiAward,
};

// --- CALCULATION MODE ---
// 'auto' keeps the existing "run every formula + show confidence" behavior.
// Any other value pins the calculator to that single formula's result —
// used to build both the dropdown options below AND to look up a chosen
// formula's BMRFormulaResult out of BMRResult.results (whose `formula`
// field is typed identically, so this union is kept in lockstep with
// bmrLogic.ts's BMRFormulaResult['formula'] rather than importing an extra
// type just for this).
type BMRFormulaKey = 'mifflin_st_jeor' | 'harris_benedict' | 'schofield' | 'katch_mcardle' | 'cunningham';
type CalculationMode = 'auto' | BMRFormulaKey;

// Single source of truth for a formula's display name — reused by the
// dropdown options below, the headline card's label, and the report meta,
// so the name can't drift out of sync between those three places.
const CALCULATION_MODE_LABELS: Record<BMRFormulaKey, string> = {
  mifflin_st_jeor: 'Mifflin-St Jeor',
  harris_benedict: 'Revised Harris-Benedict',
  schofield: 'Schofield (WHO/FAO/UNU)',
  katch_mcardle: 'Katch-McArdle',
  cunningham: 'Cunningham',
};

const CALCULATION_MODE_OPTIONS: Array<{ value: CalculationMode; label: string }> = [
  { value: 'auto', label: 'Auto (all formulas + confidence)' },
  { value: 'mifflin_st_jeor', label: CALCULATION_MODE_LABELS.mifflin_st_jeor },
  { value: 'harris_benedict', label: CALCULATION_MODE_LABELS.harris_benedict },
  { value: 'schofield', label: CALCULATION_MODE_LABELS.schofield },
  { value: 'katch_mcardle', label: CALCULATION_MODE_LABELS.katch_mcardle },
  { value: 'cunningham', label: CALCULATION_MODE_LABELS.cunningham },
];

// --- LIFE STAGE DROPDOWN OPTIONS ---
// The whole Life Stage section is female-only (see the gender === 'female'
// guard around it below) — Pregnant, Breastfeeding, PCOS, and Perimenopause
// are all conditions tied to having ovaries, the same biological basis
// "Biological Sex" is used for elsewhere in this calculator (e.g. selecting
// BMR formula coefficients).
const LIFE_STAGE_OPTIONS: Array<{ value: LifeStage; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'breastfeeding', label: 'Breastfeeding' },
  { value: 'pcos', label: 'PCOS' },
  { value: 'perimenopause', label: 'Perimenopause' },
];

// --- DAILY TARGET RING COLORS ---
// Fixed per-segment so the ring + legend dots mean the same thing wherever
// this breakdown is shown. Distinct from GOAL_STYLES/MACRO colors elsewhere
// since this is a different kind of breakdown (calorie source, not goal or
// macro).
const DAILY_TARGET_COLORS = {
  bmr: '#6366f1', // indigo-500
  activity: '#10b981', // emerald-500
  tef: '#9ca3af', // neutral-400 — the smallest, estimated segment
};

// --- ROW-LEVEL VISUALS ---
// Compare Formulas and TDEE by Activity Level were, before this pass, the
// same template rendered twice (bordered card → header → divide-y list of
// label-left/value-right rows) with nothing but a badge telling them
// apart. Giving both a same-shaped horizontal fill bar (an earlier version
// of this pass) still read as the same visual repeated twice with a
// different paint job, so each now uses a shape suited to what it's
// actually measuring instead of sharing one:
//   - Compare Formulas: a formula's BMR is a continuous number, so a
//     continuous bar fits — its length is where that formula's BMR falls
//     between the lowest and highest computed formula, echoing the
//     "spread" language in the Confidence & Insight card above it.
//     Colored indigo — the BMR ring segment's color.
//   - TDEE table: activity level isn't continuous, it's one of six fixed,
//     ordered tiers — so it gets a discrete step meter (like a signal- or
//     battery-strength icon) instead of a bar: one rung per tier, filled
//     up to this row's rung. Colored emerald — the Activity ring
//     segment's color, and the same color already used on the multiplier
//     chip in this table.
// A continuous bar and a stepped rung meter don't read as the same
// component wearing two colors — they're different shapes for a
// continuous quantity vs. a discrete rank.
const FORMULA_BAR_COLOR = DAILY_TARGET_COLORS.bmr;

const GOAL_STYLES: Record<string, { icon: IconType; text: string; bgLight: string; border: string }> = {
  aggressive_cut: { icon: FiTrendingDown, text: 'text-red-600 dark:text-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  mild_cut: { icon: FiTrendingDown, text: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
  maintain: { icon: FiMinus, text: 'text-blue-600 dark:text-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  mild_bulk: { icon: FiTrendingUp, text: 'text-teal-600 dark:text-teal-400', bgLight: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800' },
  aggressive_bulk: { icon: FiTrendingUp, text: 'text-green-600 dark:text-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
};

// --- CONFIDENCE COLOR MAPPER ---
// Same role as getCategoryColors() in BMICalculator.tsx, keyed by formula
// spread (kcal) instead of a BMI category string. label/icon are the single
// source of truth for the tier's name and icon, shared by the badge, icon
// chip, and confidence meter in the Confidence & Insight card below — so
// they can never drift out of sync with each other.
const getConfidenceColors = (spreadKcal: number) => {
  if (spreadKcal < 75) {
    return {
      text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500',
      grad: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
      border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20',
      shadow: 'shadow-green-500/10', hex: '#10b981',
      borderTop: 'border-t-green-500 dark:border-t-green-400', iconBg: 'bg-green-50 dark:bg-green-500/10',
      label: 'High Confidence', tier: 1, icon: FiCheckCircle,
    };
  }
  if (spreadKcal <= 150) {
    return {
      text: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-500',
      grad: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800',
      border: 'border-amber-500 dark:border-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-900/20',
      shadow: 'shadow-amber-500/10', hex: '#f59e0b',
      borderTop: 'border-t-amber-500 dark:border-t-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      label: 'Normal Range', tier: 2, icon: FiShield,
    };
  }
  return {
    text: 'text-orange-600 dark:text-orange-500', bg: 'bg-orange-500',
    grad: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800',
    border: 'border-orange-500 dark:border-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20',
    shadow: 'shadow-orange-500/10', hex: '#f97316',
    borderTop: 'border-t-orange-500 dark:border-t-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-500/10',
    label: 'Wide Spread', tier: 3, icon: FiAlertCircle,
  };
};

// --- SINGLE-FORMULA HEADLINE STYLING ---
// Used instead of getConfidenceColors' green/amber/orange tiers whenever
// Calculation Mode is pinned to one formula — that palette communicates
// "how much the formulas agree," which has no meaning when only one
// formula was ever computed, so the headline card falls back to this
// neutral indigo treatment (the app's existing accent color, e.g. the
// select/focus ring and the "Primary" badge below) instead of implying a
// confidence verdict that was never evaluated.
const SINGLE_FORMULA_COLORS = {
  text: 'text-indigo-600 dark:text-indigo-400',
  grad: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800',
  hex: '#6366f1',
};

// --- SLOW, EASED "ANCHOR SCROLL" --- (copied verbatim from BMICalculator.tsx)
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

// --- ACCESSIBLE INFO TOOLTIP ---
// Opens on hover AND tap, closes on outside click, for touch-device parity.
//
// Renders the popover through a portal into document.body, positioned with
// `position: fixed` from the icon's own measured coordinates, instead of the
// original CSS-only `absolute bottom-full` (kept inside the normal document
// flow). That approach was clipped whenever an ancestor between the icon and
// the page root had `overflow-hidden` (or any scroll container) — the
// `align="start"`/`align="end"` props below were an earlier attempt to dodge
// this for the leftmost/rightmost fields, but they only addressed
// *horizontal* clipping and did nothing for the Age/Biological Sex row,
// which sits right under the "Personal details" heading with almost no
// vertical room above it before hitting the card's own top edge (and, once
// scrolled to the top of the page, the viewport edge itself) — hence still
// getting cut off. A portal sidesteps ancestor clipping entirely, and
// measuring real viewport space lets the popover clamp itself to stay fully
// visible while still opening upward (per design) rather than flipping to
// open downward.
//
// `align` is kept as an initial horizontal preference (which side of the
// icon the popover starts out anchored to) before final viewport clamping —
// 'start' for fields near the left edge, 'end' for fields near the right
// edge, 'center' (default) otherwise.
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

    // Start from the align-based preference, then clamp horizontally so it
    // never runs off either edge of the viewport regardless of that
    // preference.
    let left =
      align === 'start' ? btnRect.left
      : align === 'end' ? btnRect.right - tipRect.width
      : btnRect.left + btnRect.width / 2 - tipRect.width / 2;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      window.innerWidth - tipRect.width - VIEWPORT_MARGIN
    );

    // Always try to open upward (bottom edge sits just above the icon).
    // If there isn't enough room above — the icon sits near the top of the
    // viewport — clamp to a fixed margin from the top instead of letting it
    // run off-screen or get clipped. It's still "above" the icon whenever
    // there's room, and is always fully visible either way.
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
      {/* Themed to match the app's other floating surfaces (e.g. the
          share/export dropdown below) instead of a flat black box — a
          light card with a border and shadow in light mode, and a lighter
          dark-neutral surface (not pure black) in dark mode, both paired
          with normal body-text color rather than white-on-black. */}
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

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// Every field label in the input card uses these two classes so the form
// stays visually uniform (same weight, colour and spacing above each
// control) — matches BMICalculator/BodyFatCalculator/WHRCalculator. Section
// headings (h4) and the standalone select-driven fields below (Calculation
// Mode, Activity Level, Life Stage — unique to this calculator) keep their
// own bolder style, so the two levels still read as distinct.
const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";

const formatKcal = (n: number): string => `${Math.round(n).toLocaleString()} kcal`;

// --- SEGMENTED TOGGLE --- shared pill-switch used for Unit, Biological Sex,
// Trimester, and Breastfeeding Stage. Previously each of these was its own
// hand-rolled block with a static class-swap for the active state — visually
// similar but subtly inconsistent (different padding, different active
// treatments) and with no motion. This single component gives all four the
// same sizing/behavior and a sliding active-pill (via a shared layoutId per
// group) instead of an abrupt swap, which is what makes a toggle read as
// "designed" rather than default. `groupId` must be unique per toggle
// instance on the page so each one's sliding pill animates independently.
interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
  /** Optional compact label shown below the `sm` breakpoint instead of
   * `label`. Only needed for toggles with 3+ options and/or long labels
   * (e.g. Trimester) where the full text can't fit each segment on a
   * narrow phone without wrapping the pill to two lines. Two-option
   * toggles with short labels (Male/Female, Yes/No) don't need this —
   * omitting it keeps `label` shown at every width, unchanged. */
  shortLabel?: string;
}
function SegmentedToggle<T extends string>({
  value, onChange, options, groupId, ariaLabel, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedToggleOption<T>[];
  groupId: string;
  ariaLabel: string;
  /** 'md' (default) is the original full-field-width control (Biological
   * Sex, Trimester, Breastfeeding Stage, and previously Unit). 'sm' is a
   * compact, content-width variant for sitting inline next to a field
   * label (e.g. a per-field unit switch) rather than filling a row on its
   * own — smaller type, tighter padding, no flex-1 stretch. */
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
            className={`relative rounded-full whitespace-nowrap transition-colors duration-150 cursor-pointer ${
              isSm ? 'px-3.5 py-1.5 text-xs' : 'flex-1 px-4 py-2.5 text-sm'
            } ${
              active ? 'text-white font-bold' : 'text-neutral-500 dark:text-neutral-400 font-semibold hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            {active && (
              // Gradient + glow instead of a flat white/gray fill — the
              // active segment always reads as white-on-indigo regardless
              // of light/dark mode (rather than swapping to a plain white
              // or dark-gray pill), which is both richer on its own and
              // ties every toggle's active state back to the same indigo
              // brand accent already used for the Calculate button, field
              // focus rings, and the BMR ring's own indigo segment — one
              // accent color doing the same job everywhere instead of a
              // neutral gray standing in for it here.
              <motion.span
                layoutId={`segment-pill-${groupId}`}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_2px_10px_-1px_rgba(99,102,241,0.55)]"
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative z-10">
              {opt.shortLabel ? (
                <>
                  <span className="sm:hidden">{opt.shortLabel}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </>
              ) : (
                opt.label
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- NUMBER FIELD --- shared input shell for Age/Height/Weight/Body Fat.
// Sits visually "inset" into the card (a shade darker than the card surface
// in dark mode, a shade lighter in light mode) rather than looking identical
// to the surrounding surface, so fields read as interactive wells rather
// than flat rectangles. The unit ("years", "lbs", "%"...) is a soft rounded
// chip floating inside the field instead of a hard-divided box — the same
// idea recharts' tooltip refactor above already uses for legibility, applied
// here for polish. Focus state uses the app's indigo brand accent (matching
// the Calculate button and the indigo BMR ring segment) instead of a neutral
// gray ring, so every field ties back to one accent color instead of two.
//
// Focus is signaled ONLY by the ring + border color — the field's own
// background stays fixed at all times (no bg-neutral-50 → bg-white swap on
// click/focus). A background swap on top of a ring is two things changing
// at once for one state change, which reads as a "flash"/glitch rather
// than a clean highlight; one consistent signal (the ring) is calmer and
// matches the same fix applied to the <select> shell below.
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

// Shared shell for the Activity Level / Life Stage <select> elements.
// Note: transition-colors is intentionally removed here to prevent a white
// flash when native Chrome/Safari promotes the dropdown element in dark mode.
const selectShellClass =
  "bmr-native-select w-full appearance-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3.5 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 dark:focus:border-indigo-500/60 cursor-pointer";

// Paints the native <option> popup for both Activity Level and Life Stage.
// The `color-scheme` definitions below strictly force the native OS to draw
// the container dark immediately when the popup is opened, completely
// eliminating the white flash bug common in Chromium browsers.
const bmrSelectOptionThemeCSS = `
  .bmr-native-select {
    color-scheme: light;
  }
  .dark .bmr-native-select {
    color-scheme: dark;
  }
  .bmr-native-select option {
    background-color: #ffffff; /* matches bg-white on this file's other popovers */
    color: #262626; /* neutral-800 — matches text-neutral-800 on this file's other popovers */
  }
  .dark .bmr-native-select option {
    background-color: #262626; /* neutral-800 — matches dark:bg-neutral-800 on this file's other popovers */
    color: #f5f5f5; /* neutral-100 — matches dark:text-neutral-100 on this file's other popovers */
  }
`;

const BMRCalculator: React.FC<BMRCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // --- State ---
  // Single master unit toggle (top-right of the input card, next to "Input
  // Fields") drives Height and Weight together — matches
  // BMICalculator/BodyFatCalculator/WHRCalculator, which all use one shared
  // `unit` state rather than a per-field toggle. bmrLogic's
  // calculateBMR/validateBMRInput still only take a single unit for the
  // whole person, so at calculate time both measurements are normalized to
  // metric locally (see handleCalculate) before being passed in.
  const [unit, setUnit] = useState<BMRUnit>('imperial');
  const heightUnit = unit;
  const weightUnit = unit;
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<BMRGender>('male');

  const [weight, setWeight] = useState<number | string>('');
  const [height, setHeight] = useState<number | string>('');
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');
  const [bodyFat, setBodyFat] = useState<number | string>('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // --- CANONICAL (PRECISE, METRIC) SOURCE OF TRUTH ---
  // Display fields (height/weight above) are rounded for a clean UI, but
  // rounding must never feed back into further conversions — otherwise
  // toggling units repeatedly drifts the value a little each time. So the
  // *true* measurement is kept here, in metric, at full precision, updated
  // only from what the user actually types. The unit toggle reads from
  // these refs (never from the current, possibly-rounded, display state)
  // to recompute the display strings, so the underlying value never
  // degrades. Same pattern as BMICalculator/BodyFatCalculator/WHRCalculator.
  const heightCmRef = useRef<number | null>(null);
  const weightKgRef = useRef<number | null>(null);

  // Calculation Mode — 'auto' (default) computes every formula and drives
  // the Confidence & Insight / Compare Formulas sections, same as before
  // this feature existed. Pinning it to one formula changes which BMR
  // value feeds TDEE/goals (see handleCalculate) and hides those two
  // comparison-only sections, since there's nothing to compare with one
  // formula. Included in resetCalculation()-triggering changes (like
  // Activity Level) because — unlike Life Stage — it changes the actual
  // BMR/TDEE math, not just a display-only addition layered on top.
  const [calculationMode, setCalculationMode] = useState<CalculationMode>('auto');

  // Life Stage — optional, additive-only on top of TDEE/goal numbers.
  // Deliberately NOT part of resetCalculation()/handleCalculate() gating:
  // it doesn't affect the BMR/TDEE math itself, so it can be changed
  // freely before or after a calculation without invalidating the result.
  const [lifeStage, setLifeStage] = useState<LifeStage>('none');
  const [trimester, setTrimester] = useState<PregnancyTrimester>('first');
  const [breastfeedingStage, setBreastfeedingStage] = useState<BreastfeedingStage>('months_1_6');

  const [hasCalculated, setHasCalculated] = useState(false);
  const [result, setResult] = useState<BMRResult | null>(null);
  const [tdeeRows, setTdeeRows] = useState<TDEEEntry[]>([]);
  const [goalRows, setGoalRows] = useState<GoalCalorieEntry[]>([]);

  const [ageError, setAgeError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [bodyFatError, setBodyFatError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

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

  // The entire Life Stage section is hidden when Biological Sex = Male (see
  // the gender === 'female' guard further down). This resets the underlying
  // state to "None" in that case too, so a stale Pregnant/Breastfeeding/PCOS/
  // Perimenopause value can never linger in state — e.g. if the user picked
  // one while Female, then switched to Male — and silently affect anything
  // that reads lifeStage even though the UI no longer shows it.
  useEffect(() => {
    if (gender === 'male' && lifeStage !== 'none') {
      setLifeStage('none');
    }
  }, [gender, lifeStage]);

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight) return true;
    if (heightUnit === 'metric' && !height) return true;
    if (heightUnit === 'imperial' && (!heightFt || !heightIn)) return true;
    return false;
  }, [age, weight, height, heightFt, heightIn, heightUnit]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !bodyFat && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, bodyFat, hasCalculated]);

  const activeHeight = useMemo(() => {
    if (heightUnit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    return (ft * 12) + inc;
  }, [heightUnit, height, heightFt, heightIn]);

  const resetCalculation = () => {
    setHasCalculated(false);
    setResult(null);
    setTdeeRows([]);
    setGoalRows([]);
    setAgeError(null);
    setWeightError(null);
    setHeightError(null);
    setBodyFatError(null);
  };

  // Keep the canonical (metric, unrounded) refs in sync with whatever the
  // user actually types, converting once from the *current* display unit —
  // never from an already-rounded intermediate value. Same pattern as
  // BMICalculator/BodyFatCalculator/WHRCalculator.
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

  // Range checks fire on blur (leaving the field), not on every keystroke —
  // validating while typing flashes a false-positive red border on
  // perfectly-normal partial input (e.g. typing "8" on the way to "80"
  // trips a < 15 check for an instant). Waiting for blur gives the same
  // early feedback — before they even hit Calculate — without that flicker.
  //
  // For Age this is still just a heads-up: getAgeRangeWarning (in
  // bmrLogic.ts) lets ages outside 15–80 through to calculate with a
  // non-blocking "less reliable" note in the results, so this only borders
  // the field red — it doesn't block anything Calculate wouldn't already
  // allow.
  const handleAgeBlur = () => {
    const raw = age.toString().trim();
    if (raw === '') { setAgeError(null); return; }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && !Number.isNaN(n) && (n < AGE_VALIDATED_MIN || n > AGE_VALIDATED_MAX)) {
      setAgeError(`Age must be between ${AGE_VALIDATED_MIN} and ${AGE_VALIDATED_MAX}.`);
    } else {
      setAgeError(null);
    }
  };

  // Body Fat is optional and, unlike Age, is a hard bound at Calculate time
  // (validateBodyFatInput rejects it outright outside 3–60%) — so this
  // blur check just surfaces that same rule a little earlier.
  const handleBodyFatBlur = () => {
    const raw = bodyFat.toString().trim();
    if (raw === '') { setBodyFatError(null); return; }
    const bf = parseFloat(raw);
    if (Number.isNaN(bf) || bf <= 0) { setBodyFatError(null); return; }
    const validation = validateBodyFatInput(bf);
    setBodyFatError(validation.isValid ? null : (validation.error ?? 'Invalid body fat percentage.'));
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setAge('');
    setGender('male');
    setWeight('');
    setHeight('');
    setHeightFt('');
    setHeightIn('');
    setBodyFat('');
    setActivityLevel('moderate');
    setUnit('imperial');
    heightCmRef.current = null;
    weightKgRef.current = null;
    setCalculationMode('auto');
    setLifeStage('none');
    setTrimester('first');
    setBreastfeedingStage('months_1_6');
    resetCalculation();
  };

  // Single master toggle — converts Height and Weight together in one go,
  // then flips the shared `unit` state once. Same pattern as
  // BMICalculator/BodyFatCalculator/WHRCalculator's handleUnitToggle.
  //
  // Crucially, every value shown here is derived from the precise canonical
  // refs (metric, never rounded) rather than from the current display
  // state. If we instead re-converted from the previous rounded display
  // value each time, repeated toggling (imperial -> metric -> imperial...)
  // would compound rounding error and the calculated result would visibly
  // drift on every flip. Reading from the untouched canonical value means
  // toggling back and forth is always lossless — only the display rounds.
  const handleUnitToggle = (newUnit: BMRUnit) => {
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

    setUnit(newUnit);
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const w = parseFloat(weight.toString());
    const h = activeHeight; // cm if heightUnit is metric, else total inches
    const a = parseInt(age.toString(), 10);

    // Height and Weight can now be in different unit systems, but
    // calculateBMR/validateBMRInput only take ONE unit for the whole
    // person — so normalize both to metric ourselves first, then always
    // call those with unit='metric' and these already-converted values.
    const weightKg = weightUnit === 'metric' ? w : w / 2.20462;
    const heightCm = heightUnit === 'metric' ? h : h * 2.54;

    let isValid = true;

    const validation = validateBMRInput(weightKg, heightCm, a, 'metric');
    if (!validation.isValid) {
      // Re-derive per-field errors using each field's OWN unit/limits, so
      // e.g. a Height error still reads in cm when Height is in cm even
      // if Weight happens to be in lbs (and vice versa).
      const weightLimits = weightUnit === 'metric' ? { min: 1, max: 500, label: 'kg' } : { min: 2, max: 1100, label: 'lbs' };
      const heightLimits = heightUnit === 'metric' ? { min: 30, max: 300, label: 'cm' } : { min: 12, max: 118, label: 'inches' };

      const weightInvalid = !Number.isFinite(w) || Number.isNaN(w) || w <= 0 || w < weightLimits.min || w > weightLimits.max;
      const heightInvalid = !Number.isFinite(h) || Number.isNaN(h) || h <= 0 || h < heightLimits.min || h > heightLimits.max;
      const ageInvalid = !Number.isFinite(a) || Number.isNaN(a) || a <= 0 || a > 130;

      setWeightError(weightInvalid ? `Weight must be between ${weightLimits.min} and ${weightLimits.max} ${weightLimits.label}.` : null);
      setHeightError(heightInvalid && !weightInvalid ? `Height must be between ${heightLimits.min} and ${heightLimits.max} ${heightLimits.label}.` : null);
      setAgeError(ageInvalid && !weightInvalid && !heightInvalid ? (validation.error ?? 'Please enter a realistic age.') : null);
      isValid = false;
    } else {
      setWeightError(null);
      setHeightError(null);
      setAgeError(null);
    }

    // Body fat % is optional — only validated if the user actually entered one.
    const bf = parseFloat(bodyFat.toString());
    const hasBodyFatInput = !Number.isNaN(bf) && bf > 0;
    if (hasBodyFatInput) {
      const bfValidation = validateBodyFatInput(bf);
      if (!bfValidation.isValid) {
        setBodyFatError(bfValidation.error ?? 'Invalid body fat percentage.');
        isValid = false;
      } else {
        setBodyFatError(null);
      }
    } else {
      setBodyFatError(null);
    }

    if (!isValid) {
      setHasCalculated(false);
      return;
    }

    const bmrResult = calculateBMR(weightKg, heightCm, a, gender, 'metric', hasBodyFatInput ? bf : null);

    // calculateBMR always computes every formula (see bmrLogic.ts) — that
    // doesn't change here. What changes is which one feeds everything
    // downstream (TDEE, goal targets, the headline number): Auto keeps
    // using primaryBmr (Mifflin-St Jeor), a pinned mode uses that
    // formula's own bmr instead. Katch-McArdle/Cunningham can very rarely
    // be absent from bmrResult.results (an unusable Boer LBM estimate for
    // extreme inputs — see calculateBMR's lbmIsUsable guard); in that edge
    // case this silently falls back to primaryBmr, and the UI surfaces a
    // warning below rather than showing a broken/blank result.
    const selectedFormula = calculationMode !== 'auto'
      ? bmrResult.results.find((r) => r.formula === calculationMode)
      : undefined;
    const baseBmr = selectedFormula ? selectedFormula.bmr : bmrResult.primaryBmr;

    const tdee = calculateTDEE(baseBmr);
    const activeTdeeCalories = tdee.find((t) => t.level === activityLevel)?.calories ?? baseBmr * 1.2;
    const goals = getGoalCalories(activeTdeeCalories, gender);

    setResult(bmrResult);
    setTdeeRows(tdee);
    setGoalRows(goals);
    setHasCalculated(true);

    onCalculationComplete?.();

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

  const hasError = Boolean(ageError || weightError || heightError || bodyFatError);
  const confidenceColors = getConfidenceColors(result?.spreadKcal ?? 0);

  const isSingleFormulaMode = calculationMode !== 'auto';

  // The chosen formula's own BMRFormulaResult, pulled out of the current
  // result — null in Auto mode, and also null in the rare fallback case
  // where a pinned Katch-McArdle/Cunningham couldn't be computed for these
  // inputs (see the comment in handleCalculate above).
  const selectedFormulaResult = useMemo(() => {
    if (calculationMode === 'auto' || !result) return null;
    return result.results.find((r) => r.formula === calculationMode) ?? null;
  }, [calculationMode, result]);

  const singleFormulaUnavailable = isSingleFormulaMode && !!result && !selectedFormulaResult;

  // The BMR value actually driving the headline card, TDEE table, goal
  // targets, and Daily Target breakdown below — Mifflin-St Jeor in Auto
  // mode (or as a fallback when a pinned formula is unavailable), the
  // selected formula's own value otherwise. Mirrors the baseBmr logic in
  // handleCalculate exactly, since tdeeRows/goalRows were already computed
  // from that same value at calculate time.
  const effectiveBmr = selectedFormulaResult ? selectedFormulaResult.bmr : (result?.primaryBmr ?? 0);
  const effectiveBmrLabel = selectedFormulaResult
    ? CALCULATION_MODE_LABELS[selectedFormulaResult.formula as BMRFormulaKey]
    : 'Mifflin-St Jeor';

  const activeTdeeEntry = useMemo(
    () => tdeeRows.find((t) => t.level === activityLevel) ?? null,
    [tdeeRows, activityLevel]
  );

  // Purely additive on top of the goal-calorie numbers below — computed
  // independently of handleCalculate so changing it never invalidates or
  // recalculates the base BMR/TDEE/goal figures.
  const lifeStageAdjustment = useMemo(
    () => getLifeStageAdjustment(lifeStage, trimester, breastfeedingStage),
    [lifeStage, trimester, breastfeedingStage]
  );

  // "Your Daily Target" hero breakdown — the selected activity level's TDEE
  // plus any life-stage addition, decomposed into BMR/Activity/TEF purely
  // for display (see getTDEEBreakdown's comments in bmrLogic.ts). Returns
  // null until a TDEE row is available, same guard pattern as
  // activeTdeeEntry above.
  const dailyTargetTotal = useMemo(
    () => (activeTdeeEntry ? applyLifeStageAddition(activeTdeeEntry.calories, lifeStageAdjustment) : null),
    [activeTdeeEntry, lifeStageAdjustment]
  );
  const dailyTargetBreakdown = useMemo(
    () => (dailyTargetTotal !== null && result ? getTDEEBreakdown(dailyTargetTotal, effectiveBmr) : null),
    [dailyTargetTotal, result, effectiveBmr]
  );

  // --- SHAREABLE REPORT ---
  // Same role as the `report` useMemo in BMICalculator.tsx: the ONLY place
  // this component talks to the report engine. "Your Inputs" is kept
  // PDF-only (not in the on-screen/PNG sections) — the same convention
  // BMI's own report builder uses, even though the blueprint's wording
  // listed it as a top-level section.
  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || !result) return null;

    const colors = getConfidenceColors(result.spreadKcal);
    const activityMeta = ACTIVITY_OPTIONS.find((o) => o.level === activityLevel);

    // In a pinned single-formula mode, the report mirrors the on-screen
    // "only that formula's result" behavior — one row instead of every
    // formula. Falls back to the full list in Auto mode, and also in the
    // rare singleFormulaUnavailable case (selectedFormulaResult is null
    // there too), same fallback the on-screen headline uses.
    const formulaRows = (isSingleFormulaMode && selectedFormulaResult ? [selectedFormulaResult] : result.results).map((r) => ({
      label: r.label,
      value: `${formatKcal(r.bmr)}/day${r.requiresBodyFat && result.estimatedLbmKg ? ' (est. LBM)' : ''}`,
    }));

    const sections: ShareableReport['sections'] = [
      { heading: 'BMR by Formula', rows: formulaRows, variant: 'output' },
    ];

    if (tdeeRows.length > 0) {
      sections.push({
        heading: 'TDEE by Activity Level',
        rows: tdeeRows.map((t) => ({
          label: t.level === activityLevel ? `${t.label} (selected)` : t.label,
          value: `${formatKcal(t.calories)}/day`,
        })),
        variant: 'output',
      });
    }

    if (goalRows.length > 0) {
      sections.push({
        heading: 'Goal-Based Calorie Targets',
        rows: goalRows.map((g) => ({ label: g.label, value: `${formatKcal(g.dailyCalories)}/day` })),
        variant: 'output',
      });
    }

    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Age', value: `${age} years` },
      { label: 'Biological Sex', value: gender === 'male' ? 'Male' : 'Female' },
      { label: 'Height', value: heightUnit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"` },
      { label: 'Weight', value: `${weight} ${weightUnit === 'metric' ? 'kg' : 'lbs'}` },
      { label: 'Activity Level', value: activityMeta?.label ?? '\u2014' },
    ];
    const bf = parseFloat(bodyFat.toString());
    if (!Number.isNaN(bf) && bf > 0) {
      inputRows.push({ label: 'Body Fat %', value: `${bf}%` });
    }
    if (isSingleFormulaMode) {
      inputRows.push({ label: 'Calculation Mode', value: `${effectiveBmrLabel} only` });
    }
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    // Quick-share PNG stays a compact snapshot — just the formula
    // comparison, same "trim the long reference content" reasoning
    // BMICalculator.tsx applies to its own Detailed Classification table.
    const imageSections: ShareableReport['sections'] = [sections[0]];

    // Headline number/label/accent follow effectiveBmr, same as the
    // on-screen card — Mifflin-St Jeor's confidence-tier color in Auto
    // mode (and in the singleFormulaUnavailable fallback, where
    // effectiveBmr/effectiveBmrLabel already resolve back to Mifflin), the
    // neutral single-formula color otherwise.
    const unitsMeta = unit === 'metric' ? 'Metric Units' : 'Imperial Units';

    return {
      title: 'BMR Result',
      headlineValue: Math.round(effectiveBmr).toString(),
      headlineLabel: 'BMR (Calories/day at rest)',
      accentColor: isSingleFormulaMode && selectedFormulaResult ? SINGLE_FORMULA_COLORS.hex : colors.hex,
      meta: [effectiveBmrLabel, unitsMeta],
      sections,
      pdfOnlySections,
      imageSections,
      disclaimer: 'For informational purposes only \u2014 not medical advice.',
      fileNameBase: `bmr-result-${Math.round(effectiveBmr)}`,
    };
  }, [hasCalculated, hasError, result, tdeeRows, goalRows, activityLevel, age, gender, unit, height, heightFt, heightIn, weight, bodyFat, isSingleFormulaMode, selectedFormulaResult, effectiveBmr, effectiveBmrLabel]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  // --- DOWNLOAD BUTTONS --- (copied verbatim from BMICalculator.tsx)
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

  // --- SHARE BAR --- (copied verbatim from BMICalculator.tsx)
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

  // Opening the Sources panel brings it into view with a brief highlight
  // pulse — identical pattern to BMICalculator.tsx's toggleSources.
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
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: bmrSelectOptionThemeCSS }} />

      {/* INPUT CARD — everything from Personal details through Life Stage
          lives in one bordered/shadowed surface (matching the results
          cards below it) instead of a bare, hr-divided form. Every row
          inside shares the card's own padding as its width reference,
          rather than each row re-declaring its own max-w-* wrapper
          (max-w-md / max-w-4xl / max-w-2xl, previously three different
          widths in one form). One width, set once, fixes every row at
          once.

          Unit selection is a single master toggle next to the "Input
          Fields" title, converting Height and Weight together — matching
          BMICalculator/BodyFatCalculator/WHRCalculator, which all use one
          shared `unit` state rather than a per-field toggle. Age and Body
          Fat have no unit toggle since neither has an alternate unit.
          bmrLogic's calculation functions still only take one shared unit
          for the whole person (see toMetric in bmrLogic.ts), so at
          calculate time (see handleCalculate) both measurements are
          normalized to metric locally first, and calculateBMR/
          validateBMRInput are always called with unit='metric'. */}
      {/* Note: this card intentionally doesn't need overflow-hidden either
          way any more. InfoTip (see above) now renders its popover through
          a portal into document.body with viewport-clamped fixed
          positioning, so it's immune to any ancestor's overflow setting —
          including the Age/Biological Sex row's popovers, which used to be
          the first row under "Personal details" with almost no vertical
          room above them and got clipped as a result. */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">

        <div className="p-5 sm:p-6 md:p-8 space-y-8">

          {/* Title + master unit toggle — converts height & weight together */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                <SafeIcon icon={FiSliders} className="w-3 h-3" />
                Units
              </span>
              <SegmentedToggle
                groupId="bmr-unit-system"
                size="sm"
                ariaLabel="Unit system"
                value={unit}
                onChange={(v) => handleUnitToggle(v as BMRUnit)}
                options={[
                  { value: 'imperial', label: 'Imperial' },
                  { value: 'metric', label: 'Metric' },
                ]}
              />
            </div>
          </div>

          {/* Personal details — Age + Biological Sex */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Personal details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="bmr-age-input" className={fieldLabelClass}>
                    Age
                  </label>
                </div>
                <NumberField
                  id="bmr-age-input"
                  value={age}
                  onChange={(v) => { setAge(v); resetCalculation(); }}
                  onBlur={handleAgeBlur}
                  suffix="years"
                  error={!!ageError}
                  min={AGE_VALIDATED_MIN.toString()}
                  max={AGE_VALIDATED_MAX.toString()}
                  placeholder={`${AGE_VALIDATED_MIN}-${AGE_VALIDATED_MAX}`}
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
                  <span className={fieldLabelClass}>
                    Biological Sex
                  </span>
                </div>
                <SegmentedToggle
                  groupId="bmr-sex"
                  ariaLabel="Biological sex selection"
                  value={gender}
                  onChange={(v) => { setGender(v as BMRGender); resetCalculation(); }}
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Calculation Mode — Auto (default) runs every formula below and
              powers the Confidence & Insight / Compare Formulas sections;
              pinning it to one formula shows only that formula's result
              and hides those two sections, since there's nothing to
              compare with a single formula. Placed above Height/Weight per
              the design (it governs how those inputs get used, so it
              reads first). Uses the exact same selectShellClass /
              FiChevronDown / bmr-native-select pattern as Activity Level
              and Life Stage below so it can't reintroduce the dark-mode
              popup flicker those two were fixed for. Constrained to 2/3
              width on large screens (full width on mobile/tablet), same
              as the Reference Values control in WHRCalculator.tsx, so it
              doesn't stretch edge-to-edge on wide layouts. */}
          <div className="lg:w-2/3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Calculation Mode
              </span>
              <InfoTip
                widthClass="w-56"
                text="Auto compares every formula for a reliable estimate. Pin to one if you want just that formula's result."
              />
            </div>
            <div className="relative">
              <select
                value={calculationMode}
                onChange={(e) => { setCalculationMode(e.target.value as CalculationMode); resetCalculation(); }}
                className={selectShellClass}
              >
                {CALCULATION_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            </div>
          </div>

          {/* Body measurements — Height, Weight, optional Body Fat % */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Body measurements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <div className={fieldLabelRowClass}>
                  <label htmlFor="bmr-height-input" className={fieldLabelClass}>Height</label>
                </div>
                {heightUnit === 'metric' ? (
                  <NumberField
                    id="bmr-height-input"
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
                      id="bmr-height-input"
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
                  <label htmlFor="bmr-weight-input" className={fieldLabelClass}>Weight</label>
                </div>
                <NumberField
                  id="bmr-weight-input"
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

              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className={fieldLabelClass}>
                    Body Fat<span className="align-super text-xs ml-0.5">*</span>
                  </span>
                  <InfoTip
                    widthClass="w-56"
                    align="end"
                    text="Improves accuracy for Katch-McArdle and Cunningham. Left blank, we'll estimate it from your height and weight instead."
                  />
                  <motion.span
                    className="inline-block rounded-full"
                    animate={prefersReducedMotion ? undefined : {
                      boxShadow: [
                        '0 0 0 0 rgba(99,102,241,0.35)',
                        '0 0 0 5px rgba(99,102,241,0)',
                        '0 0 0 0 rgba(99,102,241,0)',
                      ],
                    }}
                    transition={prefersReducedMotion ? undefined : { duration: 1.6, repeat: Infinity, repeatDelay: 0.9, ease: 'easeOut' }}
                  >
                    <Link
                      href="/calculators/body-fat-calculator"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Find your body fat percentage — opens in a new tab"
                      className="inline-flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-500/15 text-xs font-bold text-indigo-600 dark:text-indigo-300 shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-500/25 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer"
                    >
                      <SafeIcon icon={FiBarChart2} className="w-3 h-3" />
                      Find yours
                    </Link>
                  </motion.span>
                </div>
                <NumberField
                  value={bodyFat}
                  onChange={(v) => { setBodyFat(v); resetCalculation(); }}
                  onBlur={handleBodyFatBlur}
                  suffix="%"
                  error={!!bodyFatError}
                  min={BODY_FAT_MIN.toString()}
                  max={BODY_FAT_MAX.toString()}
                  placeholder={`${BODY_FAT_MIN}-${BODY_FAT_MAX}`}
                />
                {bodyFatError && <p className="mt-2.5 text-sm font-medium text-red-500">{bodyFatError}</p>}
              </div>
            </div>
          </div>

          {/* Activity Level — drives the TDEE table and goal targets.
              Same lg:w-2/3 constrained-width wrapper as Calculation Mode
              above and the Reference Values control in WHRCalculator.tsx. */}
          <div className="lg:w-2/3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Activity Level
              </span>
              <InfoTip widthClass="w-60" text="How much you move day-to-day, outside of resting. This scales your BMR up into a full daily calorie estimate (TDEE)." />
            </div>
            <div className="relative">
              <select
                value={activityLevel}
                onChange={(e) => { setActivityLevel(e.target.value as ActivityLevel); resetCalculation(); }}
                className={selectShellClass}
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.level} value={opt.level}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
              <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            </div>
          </div>

          {/* Life Stage — female-only (Pregnant/Breastfeeding/PCOS/
              Perimenopause all require having ovaries), so the whole block
              is hidden outright when Biological Sex = Male, rather than
              just restricting the dropdown's options. Set apart in its own
              soft panel (rather than just another row) since it's an
              optional, conditional block layered on top of the required
              fields above it. */}
          {gender === 'female' && (
            <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-neutral-50/70 dark:bg-neutral-900/30 p-5 sm:p-6">
              {/* Dropdown itself constrained to 2/3 width on large screens
                  (full width on mobile/tablet), same wrapper as Calculation
                  Mode / Activity Level above — the panel around it stays
                  full width since it also holds the trimester/breastfeeding
                  toggles and notes below. */}
              <div className="lg:w-2/3">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Life Stage<span className="align-super text-xs ml-0.5">*</span>
                  </span>
                  <InfoTip
                    widthClass="w-64"
                    text="Pregnancy and breastfeeding have official calorie additions (ACOG/USDA) shown on top of your goal targets below. PCOS and perimenopause show an educational note only — there's no universal calorie adjustment for either."
                  />
                </div>
                <div className="relative">
                  <select
                    value={lifeStage}
                    onChange={(e) => setLifeStage(e.target.value as LifeStage)}
                    className={selectShellClass}
                  >
                    {LIFE_STAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                </div>
              </div>

              {lifeStage === 'pregnant' && (
                <div className="mt-3">
                  <SegmentedToggle
                    groupId="bmr-trimester"
                    ariaLabel="Trimester selection"
                    value={trimester}
                    onChange={setTrimester}
                    options={[
                      { value: 'first', label: '1st Trimester', shortLabel: '1st' },
                      { value: 'second', label: '2nd Trimester', shortLabel: '2nd' },
                      { value: 'third', label: '3rd Trimester', shortLabel: '3rd' },
                    ]}
                  />
                </div>
              )}

              {lifeStage === 'breastfeeding' && (
                <div className="mt-3">
                  <SegmentedToggle
                    groupId="bmr-breastfeeding"
                    ariaLabel="Breastfeeding stage selection"
                    value={breastfeedingStage}
                    onChange={setBreastfeedingStage}
                    options={[
                      { value: 'months_1_6', label: 'Months 1–6' },
                      { value: 'months_7_12', label: 'Months 7–12' },
                    ]}
                  />
                </div>
              )}

              {lifeStage === 'pregnant' && trimester === 'first' && lifeStageAdjustment.note && (
                <p className="mt-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {lifeStageAdjustment.note}
                </p>
              )}

              {(lifeStage === 'pcos' || lifeStage === 'perimenopause') && lifeStageAdjustment.note && (
                <div className="mt-3 flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                  <SafeIcon icon={FiInfo} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-relaxed">{lifeStageAdjustment.note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs font-medium text-neutral-400 text-right px-1">* Optional — not required to calculate your BMR.</p>

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
          <SafeIcon icon={FiZap} className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Fill in your age, height, and weight above, then press Calculate to see your BMR, TDEE, and goal-based calorie targets.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {hasCalculated && !hasError && result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 pt-4"
        >
          {/* RESULT HEADER ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your BMR Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          {result.ageRangeWarning && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">{result.ageRangeWarning}</p>
            </div>
          )}

          {/* Rare fallback: a pinned Katch-McArdle/Cunningham couldn't be
              computed for these inputs (unusable Boer LBM estimate), so
              everything below silently used Mifflin-St Jeor instead — this
              surfaces that instead of leaving it unexplained. */}
          {singleFormulaUnavailable && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                {CALCULATION_MODE_LABELS[calculationMode as BMRFormulaKey]} couldn&apos;t be calculated for these inputs (the estimated lean body mass came out invalid), so the result below uses Mifflin-St Jeor instead.
              </p>
            </div>
          )}

          {/* PRIMARY HEADLINE CARD — shows the selected formula's own name
              and value in a pinned calculation mode (neutral indigo
              styling, since there's no confidence tier to color it by);
              Mifflin-St Jeor with the usual confidence-tier color in Auto
              mode, exactly as before. */}
          <div className={`bg-gradient-to-br ${isSingleFormulaMode && selectedFormulaResult ? SINGLE_FORMULA_COLORS.grad : confidenceColors.grad} rounded-3xl p-6 sm:p-8 border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] text-center`}>
            <p className="text-sm font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
              {isSingleFormulaMode && selectedFormulaResult ? effectiveBmrLabel : 'Mifflin-St Jeor (Primary)'}
            </p>
            <p className={`text-5xl md:text-6xl font-black tracking-tight ${isSingleFormulaMode && selectedFormulaResult ? SINGLE_FORMULA_COLORS.text : confidenceColors.text}`}>
              {Math.round(effectiveBmr).toLocaleString()}
            </p>
            <p className="mt-1 text-base font-semibold text-neutral-600 dark:text-neutral-300">
              BMR (Calories/day at rest)
            </p>
          </div>

          {result.estimatedLbmKg !== undefined && (!isSingleFormulaMode || calculationMode === 'katch_mcardle' || calculationMode === 'cunningham') && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <SafeIcon icon={FiInfo} className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                {isSingleFormulaMode ? (
                  <>This result uses an estimated lean body mass of{' '}
                  <strong>{result.estimatedLbmKg.toFixed(1)} kg</strong>, derived from your height and weight — enter your body fat % above for a more precise result.</>
                ) : (
                  <>Katch-McArdle and Cunningham below use an estimated lean body mass of{' '}
                  <strong>{result.estimatedLbmKg.toFixed(1)} kg</strong>, derived from your height and weight — enter your body fat % above for a more precise result.</>
                )}
              </p>
            </div>
          )}

          {/* CONFIDENCE / INSIGHT + COMPARE FORMULAS — both are
              comparison-only sections (how closely the formulas agree,
              and a side-by-side of all of them), so both are hidden
              entirely in a pinned single-formula calculation mode: with
              only one formula computed there's nothing left to compare
              or judge agreement on. Auto mode renders them exactly as
              before this feature existed. */}
          {!isSingleFormulaMode && (
          <>
          {/* CONFIDENCE / INSIGHT — pared back from an earlier, busier pass
              (a colored icon chip + a heavy 4px top border + a tier badge
              was three separate colored accents doing the same one job;
              a hover-triggered shadow lift was also decorative movement
              on a card nobody clicks). Now there's exactly one color cue
              — the small icon + badge, both in the tier color — and the
              card shell itself (white surface, thin neutral border,
              shadow-sm, no top border) matches every other results card
              in this file (Compare Formulas, TDEE table, etc.) instead of
              standing out as its own visual style. */}
          <div className="rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-5">
              <div className="flex items-center gap-2">
                <SafeIcon icon={confidenceColors.icon} className={`w-4 h-4 flex-shrink-0 ${confidenceColors.text}`} />
                <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Confidence and Insight</h3>
                <InfoTip
                  widthClass="w-64"
                  text="Your BMR above is calculated from several established formulas at once. This section shows how closely they agree — the closer the agreement, the more confidently you can rely on the number above."
                />
              </div>
              <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10 ${confidenceColors.bgLight} ${confidenceColors.text}`}>
                {confidenceColors.label}
              </span>
            </div>

            {/* Confidence meter — a single thin track filled proportionally
                to the current tier (1/3, 2/3, or full), rather than three
                separately-rounded pill segments with visible gaps between
                them. Reads as one continuous, precise measurement instead
                of three decorative blocks. */}
            <div className="mb-5" role="img" aria-label={`Confidence level: ${confidenceColors.label}`}>
              <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-700/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confidenceColors.bg}`}
                  style={{ width: `${(confidenceColors.tier / 3) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Low Spread</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Normal</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Wide</span>
              </div>
            </div>

            {/* Lead with a short, bolded plain-language verdict, then
                the fuller explanation right after it in the same
                paragraph — the takeaway is readable at a glance, the
                "why" is right there for anyone who wants it. */}
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal text-[15px] md:text-base">
              <strong className="font-bold text-neutral-900 dark:text-white">{result.confidenceVerdict}</strong>{' '}
              {result.confidenceNote}
            </p>
            <p className="text-xs font-normal text-neutral-500 dark:text-neutral-400 leading-relaxed mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
              Formulas ranged from{' '}
              <strong className="font-semibold text-neutral-600 dark:text-neutral-300">
                {formatKcal(Math.min(...result.results.map((r) => r.bmr)))}
              </strong>{' '}
              to{' '}
              <strong className="font-semibold text-neutral-600 dark:text-neutral-300">
                {formatKcal(Math.max(...result.results.map((r) => r.bmr)))}
              </strong>{' '}
              — a spread of <strong className="font-semibold text-neutral-600 dark:text-neutral-300">{Math.round(result.spreadKcal)} kcal</strong>.
            </p>
          </div>

          {/* COMPARE FORMULAS PANEL */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="flex items-center gap-2 text-xl font-extrabold text-neutral-900 dark:text-white">
                <SafeIcon icon={FiBarChart2} className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                Compare Formulas
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Each bar shows where that formula lands between the lowest and highest result above.
              </p>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {(() => {
                const bmrValues = result.results.map((r) => r.bmr);
                const formulaMin = Math.min(...bmrValues);
                const formulaMax = Math.max(...bmrValues);
                const formulaRange = formulaMax - formulaMin;
                return result.results.map((r) => {
                  // All formulas agree exactly → every bar reads full,
                  // rather than a divide-by-zero collapsing them to 0%.
                  const fillPct = formulaRange === 0 ? 100 : ((r.bmr - formulaMin) / formulaRange) * 100;
                  return (
                    <div
                      key={r.formula}
                      className={`px-6 sm:px-8 py-4 sm:py-5 ${r.isPrimary ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-base font-semibold ${r.isPrimary ? 'text-indigo-700 dark:text-indigo-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                            {r.label}
                          </span>
                          {r.isPrimary && (
                            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                              Primary
                            </span>
                          )}
                          {r.requiresBodyFat && result.estimatedLbmKg !== undefined && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                              Est. LBM
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                          {formatKcal(r.bmr)}<span className="text-xs font-semibold text-neutral-400 ml-1">/day</span>
                        </span>
                      </div>
                      <div
                        className="mt-2.5 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-700/60 overflow-hidden"
                        role="img"
                        aria-label={`${r.label}: ${Math.round(fillPct)}% of the way from lowest to highest formula`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${fillPct}%`, backgroundColor: FORMULA_BAR_COLOR, opacity: r.isPrimary ? 1 : 0.55 }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          </>
          )}

          {/* YOUR DAILY TARGET — hero breakdown of the selected TDEE (+ any
              life-stage addition) into BMR / Activity / TEF. Placed above
              the TDEE table (rather than below it) since this is the
              headline conclusion — the TDEE table is supporting detail
              underneath it. A single ring, shown once here — not repeated
              per goal card. */}
          {dailyTargetBreakdown && activeTdeeEntry && (
            <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <div className="p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-sm font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-2">
                    Your Daily Target
                  </p>
                  <p className="text-4xl md:text-5xl font-black text-neutral-900 dark:text-white tracking-tight">
                    {formatKcal(dailyTargetBreakdown.totalCalories)}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {activeTdeeEntry.label}
                    {lifeStageAdjustment.calorieAddition > 0 && (
                      <> · +{lifeStageAdjustment.calorieAddition} kcal for {lifeStageAdjustment.label}</>
                    )}
                  </p>
                </div>

                <SegmentedRingChart
                  size={160}
                  centerLabel={dailyTargetBreakdown.totalCalories.toLocaleString()}
                  centerSubLabel="Cal/Day"
                  ariaLabel={`Daily target breakdown: ${dailyTargetBreakdown.bmrPct}% BMR, ${dailyTargetBreakdown.activityPct}% activity, ${dailyTargetBreakdown.tefPct}% thermic effect of food`}
                  segments={[
                    { label: 'BMR', value: dailyTargetBreakdown.bmrCalories, pct: dailyTargetBreakdown.bmrPct, color: DAILY_TARGET_COLORS.bmr },
                    { label: 'Activity', value: dailyTargetBreakdown.activityCalories, pct: dailyTargetBreakdown.activityPct, color: DAILY_TARGET_COLORS.activity },
                    { label: 'TEF', value: dailyTargetBreakdown.tefCalories, pct: dailyTargetBreakdown.tefPct, color: DAILY_TARGET_COLORS.tef },
                  ]}
                />
              </div>

              <div className="px-5 sm:px-6 md:px-8 pb-5 sm:pb-6 md:pb-8 pt-2 border-t border-neutral-100 dark:border-neutral-700/50 grid grid-cols-3 gap-3">
                <div className="text-center sm:text-left">
                  <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DAILY_TARGET_COLORS.bmr }} />
                    BMR
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                    {formatKcal(dailyTargetBreakdown.bmrCalories)} <span className="font-semibold text-neutral-400">{dailyTargetBreakdown.bmrPct}%</span>
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DAILY_TARGET_COLORS.activity }} />
                    Activity
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                    {formatKcal(dailyTargetBreakdown.activityCalories)} <span className="font-semibold text-neutral-400">{dailyTargetBreakdown.activityPct}%</span>
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <span className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DAILY_TARGET_COLORS.tef }} />
                    TEF
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                    {formatKcal(dailyTargetBreakdown.tefCalories)} <span className="font-semibold text-neutral-400">{dailyTargetBreakdown.tefPct}%</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TDEE TABLE — all six tiers shown at once. The selected row is
              marked once, cleanly: a soft indigo tint + left accent bar,
              bold label, a small "Selected" tag, and an indigo value/bar —
              one coherent signal instead of five competing ones (gradient
              wash, glow, solid badge with icon, colored chip) stacked on
              top of each other. Every row also gets a slim magnitude bar
              showing where it falls between the lightest and most intense
              tier, echoing the bar language used in Compare Formulas
              above rather than introducing a new visual idiom just for
              this table. */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-extrabold text-neutral-900 dark:text-white">
                    <SafeIcon icon={FiActivity} className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                    TDEE by Activity Level
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Total Daily Energy Expenditure — your BMR scaled up by how active you are. The bar under each tier shows it relative to the lightest and most intense levels.
                  </p>
                </div>
                {/* Quick-glance summary of the active tier, so the answer
                    is visible even before scanning the list below. */}
                {activeTdeeEntry && (
                  <span className="inline-flex items-center gap-1.5 flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-sm">
                    <SafeIcon icon={ACTIVITY_ICONS[activeTdeeEntry.level]} className="w-3.5 h-3.5" />
                    You: {activeTdeeEntry.label} · {formatKcal(activeTdeeEntry.calories)}
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {(() => {
                // Relative magnitude across the six tiers, reusing the same
                // "where does this fall between lowest and highest" bar
                // language as Compare Formulas above — one continuous,
                // informative fill per row instead of a 6-rung step meter
                // repeated 6 times (36 decorative nodes) that only ever
                // encoded rank, which the row order already communicates.
                const calMin = tdeeRows[0]?.calories ?? 0;
                const calMax = tdeeRows[tdeeRows.length - 1]?.calories ?? 0;
                const calRange = calMax - calMin;
                return tdeeRows.map((row) => {
                  const isActive = row.level === activityLevel;
                  const fillPct = calRange === 0 ? 100 : ((row.calories - calMin) / calRange) * 100;
                  return (
                    <div
                      key={row.level}
                      className={`relative flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 transition-colors ${
                        isActive ? 'bg-indigo-50/70 dark:bg-indigo-900/15' : ''
                      }`}
                    >
                      {/* A single left accent bar carries the "you are
                          here" signal together with the row tint below —
                          not repeated as a separate glow, ring, and badge
                          the way earlier passes stacked it. */}
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-indigo-500" aria-hidden="true" />
                      )}

                      <div
                        className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-indigo-500' : 'bg-neutral-100 dark:bg-neutral-900/50'
                        }`}
                      >
                        <SafeIcon
                          icon={ACTIVITY_ICONS[row.level]}
                          className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className={`text-sm sm:text-base tracking-tight ${isActive ? 'font-bold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>
                              {row.label}
                            </span>
                            <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {row.multiplier.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}×
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                Selected
                              </span>
                            )}
                            <span className="w-full text-xs text-neutral-400 dark:text-neutral-500">{row.description}</span>
                          </div>
                          <span className={`text-sm sm:text-base font-bold tracking-tight flex-shrink-0 tabular-nums ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                            {formatKcal(row.calories)}<span className="text-[11px] font-semibold text-neutral-400 ml-0.5">/day</span>
                          </span>
                        </div>
                        <div
                          className="mt-2 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-700/60 overflow-hidden"
                          role="img"
                          aria-label={`${row.label}: ${formatKcal(row.calories)} per day`}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${fillPct}%`, backgroundColor: isActive ? DAILY_TARGET_COLORS.bmr : DAILY_TARGET_COLORS.activity, opacity: isActive ? 1 : 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* GOAL-BASED CALORIE TARGETS */}
          <div>
            <h3 className="flex items-center gap-1.5 text-xl font-extrabold text-neutral-900 dark:text-white mb-1">
              Goal-Based Calorie Targets
              <InfoTip
                widthClass="w-64"
                text="Macro grams use the NASEM/USDA Acceptable Macronutrient Distribution Range (Protein 10–35%, Carbs 45–65%, Fat 20–35% of calories), with a specific percentage chosen per goal within those official bounds."
              />
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Based on your {activeTdeeEntry?.label ?? 'selected'} TDEE of {activeTdeeEntry ? formatKcal(activeTdeeEntry.calories) : '\u2014'}/day. Uses the standard ~7,700 kcal ≈ 1 kg conversion — an approximation, not a guarantee.
            </p>

            {lifeStageAdjustment.calorieAddition > 0 && (
              <div className="flex items-start gap-3 p-4 mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300">
                <SafeIcon icon={FiInfo} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
                  <strong>+{lifeStageAdjustment.calorieAddition} kcal/day</strong> for {lifeStageAdjustment.label} is added on top of each target below, shown as its "Adjusted total" — the base targets themselves are unchanged.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {goalRows.map((g) => {
                const style = GOAL_STYLES[g.goal];
                // Unusually low results get a red warning treatment instead
                // of the normal goal-tier color, and a warning line replaces
                // the usual delta/week-change text — the dailyCalories value
                // itself is unchanged either way.
                const cardText = g.isUnsafeLow ? 'text-red-700 dark:text-red-400' : style.text;
                const cardBg = g.isUnsafeLow ? 'bg-red-50 dark:bg-red-900/20' : style.bgLight;
                const cardBorder = g.isUnsafeLow ? 'border-red-300 dark:border-red-800' : style.border;
                return (
                  <div key={g.goal} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${cardBg} ${cardBorder}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <SafeIcon icon={g.isUnsafeLow ? FiAlertCircle : style.icon} className={`w-4 h-4 ${cardText}`} />
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${cardText}`}>{g.label}</h4>
                    </div>
                    <p className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                      {formatKcal(g.dailyCalories)}<span className="text-xs font-semibold text-neutral-400 ml-1">/day</span>
                    </p>
                    {g.isUnsafeLow ? (
                      <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400 leading-relaxed">
                        {g.safetyWarning}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {g.deltaFromMaintenance === 0 ? 'At maintenance' : `${g.deltaFromMaintenance > 0 ? '+' : ''}${g.deltaFromMaintenance} kcal/day`}
                        {g.expectedChangePerWeekKg !== 0 && (
                          <> · ≈ {g.expectedChangePerWeekKg > 0 ? '+' : ''}{g.expectedChangePerWeekKg.toFixed(2)} kg/week</>
                        )}
                      </p>
                    )}

                    {/* MACRO BREAKDOWN — AMDR-based grams for this goal.
                        Label, percentage, and grams are each on their own line 
                        so they stack neatly in a 3-row layout, making the 
                        columns perfectly aligned and easy to read. */}
                    <div className="mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-700/50 grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 whitespace-nowrap">
                          Protein
                        </p>
                        <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-tight mb-0.5">
                          {g.macros.proteinPct}%
                        </p>
                        <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                          {Math.round(g.macros.proteinGrams)}g
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 whitespace-nowrap">
                          Carbs
                        </p>
                        <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-tight mb-0.5">
                          {g.macros.carbsPct}%
                        </p>
                        <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                          {Math.round(g.macros.carbsGrams)}g
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 whitespace-nowrap">
                          Fat
                        </p>
                        <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 leading-tight mb-0.5">
                          {g.macros.fatPct}%
                        </p>
                        <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">
                          {Math.round(g.macros.fatGrams)}g
                        </p>
                      </div>
                    </div>

                    {/* LIFE-STAGE ADDITION — additive only, base dailyCalories above is unchanged */}
                    {lifeStageAdjustment.calorieAddition > 0 && (
                      <p className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        Adjusted total: {formatKcal(applyLifeStageAddition(g.dailyCalories, lifeStageAdjustment))}/day
                        <span className="font-semibold text-indigo-500 dark:text-indigo-300"> (+{lifeStageAdjustment.calorieAddition})</span>
                      </p>
                    )}
                  </div>
                );
              })}

              {/* TIP CARD — fills the leftover grid cell. Five fixed goal
                  tiers don't divide evenly into either a 2-col or 3-col
                  grid, so there's always one empty slot at both the sm
                  and lg breakpoints (5 → 2,2,1 at sm; 5 → 3,2 at lg) —
                  not just the 3-col case. Adding this as a real 6th grid
                  item makes 6 total, which divides evenly at every
                  breakpoint, so the grid is always full rather than
                  leaving a gap that only shows up at certain widths.
                  Dashed border + neutral palette + no colored icon keeps
                  it from being mistaken for a 6th selectable goal. */}
              <div className="rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/40 p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Which one to pick?
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  ⚖️ Start with <strong className="font-bold text-neutral-700 dark:text-neutral-300">Mild Cut</strong> or{' '}
                  <strong className="font-bold text-neutral-700 dark:text-neutral-300">Mild Bulk</strong> for steady, sustainable
                  progress. Switch anytime — nothing else needs recalculating.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {renderShareBar()}

      {/* DISCLAIMER */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This BMR calculator provides a general guide, not medical advice. Estimates rely on population-average formulas and may not reflect individual variation in metabolism. Always consult a healthcare professional before making significant changes to your diet or exercise routine.
        </p>
      </div>

      {/* SOURCES */}
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
                {BMR_SOURCES.length} references — every formula used above, cited
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
              {BMR_SOURCES.map((source, i) => (
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
              Input range limits on this form (e.g. 30–300cm height, 1–500kg weight) are general sanity bounds for data entry, not clinical cut-offs, and aren&apos;t drawn from any source above.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BMRCalculator;
