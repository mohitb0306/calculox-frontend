"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence, animate } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  calculateMortgage,
  compareStrategies,
  validateMortgageInputs,
  MortgageInputError,
  REGION_PROFILES,
  MORTGAGE_SOURCES,
  MORTGAGE_LAST_REVIEWED,
} from '@/utils/calculators/mortgageLogic';
import type {
  MortgageInputs,
  MortgageResult,
  RegionCode,
  AmountMode,
  RecurringCosts,
  PmiInput,
  ScheduleRow,
  ExtraPayments,
  StrategyOutcome,
  AmountInput,
  MortgageSource,
} from '@/utils/calculators/mortgageLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiHome, FiPercent, FiCalendar, FiLayers, FiChevronDown, FiAlertCircle, FiInfo,
  FiRotateCcw, FiCheckCircle, FiSliders, FiPieChart, FiTrendingDown, FiList, FiShield, FiPlus, FiX, FiZap, FiBarChart2,
  FiDownload, FiLoader, FiImage, FiFileText, FiShare2, FiMail, FiCopy, FiCheck, FiExternalLink, FiArrowDown,
} = FiIcons;

/**
 * Landing-page preset (used by Registry aliases such as /biweekly-mortgage-calculator).
 * Only changes the STARTING state; the user can still edit everything, and nothing is
 * calculated until they press Calculate.
 */
export interface MortgagePreset {
  region?: RegionCode;
  termYears?: number;
  /** Pre-fills the "monthly extra payment" field. */
  extraMonthly?: number;
  /** Opens the Extra payments card on load. */
  openExtras?: boolean;
  /** Opens the Taxes & costs card (where PMI lives) on load. */
  openCosts?: boolean;
}

interface MortgageCalculatorProps {
  preset?: MortgagePreset;
  onCalculationComplete?: () => void;
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- ACCENT --- emerald is the main accent for Mortgage (same token shape as the sibling calculators).
const ACCENT = {
  text: 'text-emerald-600 dark:text-emerald-400',
  hex: '#10b981',
};

const fieldLabelClass = "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const fieldLabelRowClass = "flex items-center gap-1.5 mb-2";
const hintClass = "text-xs font-medium text-neutral-400 dark:text-neutral-500 mt-1.5";
const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// --- ACCESSIBLE INFO TOOLTIP --- (identical contract to the sibling calculators' InfoTip)
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

// --- SEGMENTED TOGGLE --- (same contract as the sibling calculators; indigo pill)
interface SegmentedToggleOption<T extends string> { value: T; label: string; }

// The compact "xs" switch (the % / currency unit switch above a field) gets a richer, more tactile finish:
// recessed track, glossy indigo pill with a soft glow and a top highlight. Sizes and shadows are inline on purpose
// so they never depend on which utilities the build generated.
const XS_TRACK_STYLE: React.CSSProperties = {
  padding: 3,
  boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.14), inset 0 0 0 1px rgba(255,255,255,0.03)',
};
const XS_BUTTON_STYLE: React.CSSProperties = {
  height: 24,
  minWidth: 40,
  paddingLeft: 12,
  paddingRight: 12,
  fontSize: 12.5,
  lineHeight: '24px',
  letterSpacing: '0.02em',
};
const XS_PILL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #818cf8 0%, #6366f1 52%, #4f46e5 100%)',
  boxShadow:
    '0 3px 10px -2px rgba(99,102,241,0.60), 0 1px 2px rgba(79,70,229,0.35), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(55,48,163,0.35)',
};

function SegmentedToggle<T extends string>({
  value, onChange, options, groupId, ariaLabel, size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedToggleOption<T>[];
  groupId: string;
  ariaLabel: string;
  size?: 'xs' | 'sm' | 'md' | 'field';
}) {
  const prefersReducedMotion = useReducedMotion();
  const isXs = size === 'xs';
  const isSm = size === 'sm' || isXs;
  return (
    <div
      className={`relative inline-flex bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-700/50 rounded-full ${isXs ? '' : isSm ? 'p-1' : 'flex w-full p-1.5'}`}
      style={isXs ? XS_TRACK_STYLE : undefined}
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
            style={isXs ? XS_BUTTON_STYLE : undefined}
            className={`relative rounded-full transition-colors duration-150 cursor-pointer ${
              isXs ? 'text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60' : isSm ? 'px-3.5 py-1.5 text-xs' : size === 'field' ? 'flex-1 px-4 py-2 text-sm' : 'flex-1 px-4 py-2.5 text-sm'
            } ${
              active
                ? 'text-white font-bold'
                : 'text-neutral-500 dark:text-neutral-400 font-semibold hover:text-neutral-800 dark:hover:text-neutral-100'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segment-pill-${groupId}`}
                className={`absolute inset-0 rounded-full ${isXs ? '' : 'bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_2px_10px_-1px_rgba(99,102,241,0.55)]'}`}
                style={isXs ? XS_PILL_STYLE : undefined}
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative z-10" style={isXs && active ? { textShadow: '0 1px 1px rgba(55,48,163,0.45)' } : undefined}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- SLOW, EASED "ANCHOR SCROLL" --- (identical to the sibling calculators)
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
    // Explicit behavior:'auto' so a global scroll-smooth never fights this rAF loop.
    window.scrollTo({ top: startY + distance * easeInOutCubic(progress), left: 0, behavior: 'auto' });
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

// --- SHARED RESULT UI (re-declared per calculator, emerald-tinted) ---
const ResultCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-white via-neutral-50 to-emerald-50/40 dark:from-neutral-800 dark:via-neutral-800 dark:to-emerald-900/10 shadow-sm p-4 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-emerald-400/15 via-teal-400/10 to-transparent blur-2xl" aria-hidden="true" />
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
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-emerald-500/30" aria-hidden="true">
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

const TILE_TONES = {
  indigo:  { from: '#6366f1', to: '#4338ca' },
  amber:   { from: '#f59e0b', to: '#b45309' },
  sky:     { from: '#0ea5e9', to: '#0369a1' },
  emerald: { from: '#10b981', to: '#047857' },
  rose:    { from: '#f43f5e', to: '#be123c' },
  violet:  { from: '#8b5cf6', to: '#6d28d9' },
} as const;
type TileTone = keyof typeof TILE_TONES;

// Sizes a number to fit its tile at any width (tile is a size container; cqw = 1% of inner width).
const fitNumberStyle = (text: string, maxRem: number, minRem = 0.875): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(86 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

const StatTile: React.FC<{
  tone: TileTone;
  icon: IconType;
  value: string;
  label: string;
  sub?: string;
  maxRem?: number;
}> = ({ tone, icon, value, label, sub, maxRem = 1.875 }) => {
  const t = TILE_TONES[tone];
  return (
    <div
      className="group relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 text-center text-white shadow-md shadow-neutral-900/10 dark:shadow-black/30 motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`, containerType: 'inline-size' }}
    >
      <SafeIcon
        icon={icon}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 w-16 h-16 text-white/10 motion-safe:transition-all motion-safe:duration-300 group-hover:text-white/15 group-hover:scale-110"
      />
      <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 mb-2.5" aria-hidden="true">
        <SafeIcon icon={icon} className="w-4 h-4 text-white" />
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

// --- FORMATTING (driven by the region profile: locale + currency) ---
const nfCache = new Map<string, Intl.NumberFormat>();
const getMoneyFormat = (locale: string, currency: string, decimals: number): Intl.NumberFormat => {
  const key = `${locale}|${currency}|${decimals}`;
  let nf = nfCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    nfCache.set(key, nf);
  }
  return nf;
};
const formatMoney = (n: number, locale: string, currency: string, decimals = 2): string =>
  getMoneyFormat(locale, currency, decimals).format(n);

const currencySymbol = (locale: string, currency: string): string => {
  const part = getMoneyFormat(locale, currency, 0).formatToParts(0).find((p) => p.type === 'currency');
  return part ? part.value : currency;
};

const formatMonthYear = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

const trimNum = (n: number, dp: number): string => String(Number(n.toFixed(dp)));

// Lakh / crore wording used as a helper line for India only.
const indianWords = (n: number): string => {
  if (n >= 1e7) return `${trimNum(n / 1e7, 2)} Crore`;
  if (n >= 1e5) return `${trimNum(n / 1e5, 2)} Lakh`;
  return '';
};

const formatDuration = (months: number): string => {
  const total = Math.round(months);
  const y = Math.floor(total / 12);
  const m = total % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  return parts.length ? parts.join(' ') : '0 months';
};

// --- NUMBER INPUT HELPERS ---
// Keeps only digits and (optionally) one decimal point; strips leading zeros; caps lengths.
const sanitizeNumber = (s: string, maxDecimals: number, maxInt: number): string => {
  let out = '';
  let seenDot = false;
  let dec = 0;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (dec < maxDecimals) { out += ch; dec += 1; }
      } else {
        out += ch;
      }
    } else if (ch === '.' && maxDecimals > 0 && !seenDot) {
      seenDot = true;
      out += '.';
    }
  }
  const dot = out.indexOf('.');
  let intPart = dot === -1 ? out : out.slice(0, dot);
  const decPart = dot === -1 ? '' : out.slice(dot + 1);
  intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, maxInt);
  if (dot !== -1) return `${intPart === '' ? '0' : intPart}.${decPart}`;
  return intPart;
};

// Groups the integer part with the locale (India = lakh/crore: 62,50,000).
const groupDisplay = (raw: string, locale: string): string => {
  if (!raw) return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(intPart || '0'));
  return dot === -1 ? grouped : `${grouped}.${raw.slice(dot + 1)}`;
};

const parseNum = (s: string): number => (s.trim() === '' ? NaN : Number(s));

// Text-based numeric field (so it can show grouped digits), same shell as the sibling NumberField.
const NumField: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  /** Replaces the suffix chip, e.g. an inline unit switch. */
  trailing?: React.ReactNode;
  grouped?: boolean;
  locale?: string;
  maxDecimals?: number;
  maxInt?: number;
  error?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  describedBy?: string;
}> = ({
  id, value, onChange, prefix, suffix, trailing, grouped = false, locale = 'en-US',
  maxDecimals = 2, maxInt = 13, error, placeholder, ariaLabel, describedBy,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);
  const display = grouped ? groupDisplay(value, locale) : value;

  // Restores the caret after re-grouping so typing in the middle of a number doesn't jump to the end.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const target = caretRef.current;
    if (target === null) return;
    caretRef.current = null;
    if (!el || document.activeElement !== el) return;
    let count = 0;
    let pos = 0;
    while (pos < display.length && count < target) {
      if (/[0-9.]/.test(display[pos])) count += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
  });

  const chipClass = "flex items-center justify-center flex-shrink-0 rounded-lg text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-700/70 whitespace-nowrap";
  // Spacing is inline on purpose: the fit of the symbol chip must not depend on which utilities the build generated.
  const chipBox: React.CSSProperties = { marginTop: 6, marginBottom: 6, paddingLeft: 10, paddingRight: 10 };

  return (
    <div
      className={`flex items-stretch w-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-150 bg-neutral-50 dark:bg-neutral-900/40 focus-within:ring-2 focus-within:ring-offset-0 ${
        error
          ? 'border-red-300 dark:border-red-500/60 focus-within:ring-red-400/50 focus-within:border-red-400'
          : 'border-neutral-200 dark:border-neutral-700 focus-within:ring-indigo-400/50 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/60'
      }`}
    >
      {prefix && (
        <span
          className={chipClass}
          style={{ ...chipBox, marginLeft: 6, minWidth: 40, fontSize: 14 }}
          aria-hidden="true"
        >
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={maxDecimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          const caret = e.target.selectionStart ?? raw.length;
          caretRef.current = raw.slice(0, caret).replace(/[^0-9.]/g, '').length;
          onChange(sanitizeNumber(raw, maxDecimals, maxInt));
        }}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        style={{ paddingLeft: prefix ? 14 : 16, paddingRight: 8 }}
        className={`flex-1 min-w-0 w-full py-3 bg-transparent text-neutral-900 dark:text-white font-semibold placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal focus:outline-none ${noSpinnerClass}`}
      />
      {trailing ?? (suffix && <span className={chipClass} style={{ ...chipBox, marginRight: 6 }}>{suffix}</span>)}
    </div>
  );
};

// Label row: label + info tip on the left, optional control (e.g. the % / currency switch) on the right.
// `reserve` keeps the row the same height as a row that has a control, so neighbouring fields line up.
const FieldLabel: React.FC<{
  htmlFor?: string;
  label: string;
  tip: string;
  right?: React.ReactNode;
  reserve?: boolean;
  tipAlign?: 'center' | 'start' | 'end';
  tipWidth?: string;
}> = ({ htmlFor, label, tip, right, reserve, tipAlign, tipWidth }) => (
  <div
    className="flex items-center justify-between gap-3 mb-2"
    style={right || reserve ? { minHeight: 32 } : undefined}
  >
    <div className="flex items-center gap-1.5 min-w-0">
      {htmlFor
        ? <label htmlFor={htmlFor} className={`${fieldLabelClass} truncate`}>{label}</label>
        : <span className={`${fieldLabelClass} truncate`}>{label}</span>}
      <InfoTip text={tip} align={tipAlign} widthClass={tipWidth} />
    </div>
    {right && <div className="flex-shrink-0">{right}</div>}
  </div>
);

// One labelled field with the % / amount switch ABOVE the input, on the right.
// Used for Down payment, every cost row and PMI, so they all share one structure:
// label row (+ switch), field, error, hint.
const UnitField: React.FC<{
  id: string;
  label: string;
  tip: string;
  mode: AmountMode;
  onModeChange: (m: AmountMode) => void;
  sym: string;
  value: string;
  onChange: (v: string) => void;
  locale: string;
  modeAriaLabel: string;
  groupId: string;
  percentSuffix?: string;
  amountSuffix?: string;
  error?: string;
  hint?: string;
}> = ({ id, label, tip, mode, onModeChange, sym, value, onChange, locale, modeAriaLabel, groupId, percentSuffix, amountSuffix, error, hint }) => (
  <div className="min-w-0">
    <FieldLabel
      htmlFor={id}
      label={label}
      tip={tip}
      right={
        <SegmentedToggle<AmountMode>
          size="xs"
          value={mode}
          onChange={onModeChange}
          groupId={groupId}
          ariaLabel={modeAriaLabel}
          options={[{ value: 'percent', label: '%' }, { value: 'amount', label: sym }]}
        />
      }
    />
    <NumField
      id={id}
      value={value}
      onChange={onChange}
      prefix={mode === 'amount' ? sym : undefined}
      suffix={mode === 'percent' ? percentSuffix : amountSuffix}
      grouped={mode === 'amount'}
      locale={locale}
      maxDecimals={mode === 'percent' ? 3 : 2}
      placeholder="0"
      error={Boolean(error)}
      describedBy={error ? `${id}-err` : undefined}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p className={hintClass}>{hint}</p>}
  </div>
);

// Form grid, inline so it can't be affected by missing utilities. Two columns when the CALCULATOR is wide
// enough (each column >= 18rem), otherwise one. Never more than two columns, whatever the screen width.
const FIELD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(18rem, calc((100% - 1.5rem) / 2))), 1fr))',
  columnGap: '1.5rem',
  rowGap: '1.75rem',
  alignItems: 'start',
};

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) => (
  <AnimatePresence>
    {message && (
      <motion.p
        id={id}
        role="alert"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="text-xs font-semibold text-red-500 mt-1.5 flex items-center gap-1.5"
      >
        <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
        {message}
      </motion.p>
    )}
  </AnimatePresence>
);

// Count-up for the hero figure. Writes straight to the DOM (no re-render per frame) so it never
// competes with the post-Calculate scroll animation. Always lands on the exact formatted value.
const AnimatedAmount: React.FC<{
  value: number;
  format: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, format, className, style }) => {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const finalText = format(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = finalText;
      return;
    }
    el.textContent = format(0);
    const controls = animate(0, value, {
      duration: 0.9,
      delay: 0.15,
      ease: EASE_OUT,
      onUpdate: (v) => { el.textContent = format(v); },
      onComplete: () => { el.textContent = finalText; },
    });
    return () => {
      controls.stop();
      el.textContent = finalText;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, finalText, reduced]);

  return (
    <span className={className} style={style}>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{finalText}</span>
    </span>
  );
};

// Native <select> option popup theming (same approach as the sibling calculators).
const selectShellClass =
  "mtg-native-select w-full appearance-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 dark:focus:border-indigo-500/60 cursor-pointer";
const selectOptionThemeCSS = `
  .mtg-native-select { color-scheme: light; }
  .dark .mtg-native-select { color-scheme: dark; }
  .mtg-native-select option { background-color: #ffffff; color: #262626; }
  .dark .mtg-native-select option { background-color: #262626; color: #f5f5f5; }
`;

const REGION_OPTIONS: { value: RegionCode; label: string }[] = [
  { value: 'US', label: 'US' },
  { value: 'IN', label: 'India' },
  { value: 'CA', label: 'Canada' },
];

// --- TAXES & COSTS STATE ---
type CostKey = 'propertyTax' | 'insurance' | 'hoa' | 'other';
interface CostField { mode: AmountMode; value: string; }
type CostsState = Record<CostKey, CostField>;
interface PmiField { mode: AmountMode; value: string; dropAt: 'request80' | 'auto78'; }

const COST_KEYS: CostKey[] = ['propertyTax', 'insurance', 'hoa', 'other'];
const COST_META: Record<CostKey, { label: string; tip: string }> = {
  propertyTax: { label: 'Property tax', tip: 'Yearly property tax. Enter it as a % of the home price or as a fixed amount per year.' },
  insurance: { label: 'Home insurance', tip: 'Yearly homeowners insurance premium, as a % of the home price or an amount per year.' },
  hoa: { label: 'HOA / maintenance fees', tip: 'Association, condo or society fees, entered per year.' },
  other: { label: 'Other costs', tip: 'Any other yearly housing cost you want included in your monthly total.' },
};
const COST_ERROR_KEYS = ['propertyTax', 'insurance', 'hoa', 'other', 'pmi', 'propertyTaxIncrease', 'insuranceIncrease', 'hoaIncrease', 'otherIncrease'];
const EXTRA_ERROR_KEYS = ['extraMonthly', 'extraYearly', 'extraOneTime', 'compareRecast'];
const MAX_ONE_TIME = 5;

const defaultCosts = (): CostsState => ({
  propertyTax: { mode: 'percent', value: '' },
  insurance: { mode: 'amount', value: '' },
  hoa: { mode: 'amount', value: '' },
  other: { mode: 'amount', value: '' },
});
const defaultPmi = (): PmiField => ({ mode: 'percent', value: '', dropAt: 'request80' });

// A month + year picker pair (month wider than year, inline so the layout never depends on generated utilities).
// Used by the Extra payments section: "Starting from [Month] [Year]" / "Paid in [Month] [Year]".
interface MonthYear { month: number; year: string; }

const MonthYearField: React.FC<{
  id: string;
  label: string;
  tip: string;
  month: number;
  year: string;
  monthNames: string[];
  onMonth: (m: number) => void;
  onYear: (y: string) => void;
  error?: string;
  hint?: string;
  compactLabel?: boolean;
}> = ({ id, label, tip, month, year, monthNames, onMonth, onYear, error, hint, compactLabel }) => (
  <div className="min-w-0">
    <div className={compactLabel ? 'flex items-center gap-1.5 mb-1.5' : fieldLabelRowClass}>
      <span className={compactLabel ? 'text-xs font-semibold text-neutral-500 dark:text-neutral-400' : fieldLabelClass}>{label}</span>
      <InfoTip text={tip} align="end" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', columnGap: '0.75rem', alignItems: 'start' }}>
      <div className="min-w-0">
        <div className="relative">
          <select
            id={`${id}-month`}
            aria-label={`${label} month`}
            value={month}
            onChange={(e) => onMonth(Number(e.target.value))}
            className={selectShellClass}
          >
            {monthNames.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        </div>
      </div>
      <div className="min-w-0">
        <NumField
          id={`${id}-year`}
          value={year}
          onChange={onYear}
          maxDecimals={0}
          maxInt={4}
          ariaLabel={`${label} year`}
          placeholder="Year"
          error={Boolean(error)}
          describedBy={error ? `${id}-err` : undefined}
        />
      </div>
    </div>
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p className={hintClass}>{hint}</p>}
  </div>
);

const defaultStart = (): { month: number; year: number } => {
  const now = new Date();
  const m = now.getMonth() + 2; // next month, 1-12 (+1 for 1-based, +1 for next)
  return m > 12 ? { month: 1, year: now.getFullYear() + 1 } : { month: m, year: now.getFullYear() };
};

// Converts a typed value between "% of base" and "amount" when a toggle flips.
const convertAmount = (raw: string, from: AmountMode, to: AmountMode, base: number): string => {
  if (raw.trim() === '' || !(base > 0)) return raw;
  const v = Number(raw);
  if (!Number.isFinite(v)) return raw;
  if (from === 'percent' && to === 'amount') return trimNum((v * base) / 100, 2);
  if (from === 'amount' && to === 'percent') return trimNum((v / base) * 100, 3);
  return raw;
};

// --- CHART HELPERS ---
const compactMoney = (n: number, locale: string, currency: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Rounds a raw step up to 1 / 2 / 5 x 10^n so axis ticks land on friendly numbers.
const niceStep = (raw: number): number => {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

// Tracks an element's pixel width so the SVG chart can be drawn at real size (crisp text, no horizontal scroll).
const useElementWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setWidth(Math.floor(cr.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
};

// --- BREAKDOWN RING --- (inline SVG donut; legend doubles as the interactive control)
interface RingSlice { key: string; label: string; value: number; color: string; }

const BreakdownRing: React.FC<{
  slices: RingSlice[];
  centerLabel: string;
  centerValue: string;
  fmt: (n: number) => string;
}> = ({ slices, centerLabel, centerValue, fmt }) => {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  const gap = slices.length > 1 ? 2.5 : 0;
  let cum = 0;
  const arcs = slices.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const len = Math.max(frac * C - gap, 0.5);
    const start = cum * C + gap / 2;
    cum += frac;
    return { ...s, frac, len, start };
  });
  const activeArc = arcs.find((a) => a.key === active) ?? null;
  const pct = (f: number) => `${(f * 100).toFixed(f > 0 && f < 0.001 ? 2 : 1)}%`;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative flex-shrink-0 w-44 h-44 sm:w-52 sm:h-52">
        <svg viewBox="0 0 160 160" className="w-full h-full" role="img" aria-label={`Total cost split: ${arcs.map((a) => `${a.label} ${pct(a.frac)}`).join(', ')}`}>
          <circle cx="80" cy="80" r={R} fill="none" strokeWidth="22" className="stroke-neutral-100 dark:stroke-neutral-700/60" />
          <g transform="rotate(-90 80 80)">
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={active === a.key ? 25 : 22}
                strokeDasharray={`${a.len} ${C - a.len}`}
                strokeDashoffset={-a.start}
                style={{ opacity: active && active !== a.key ? 0.3 : 1, transition: 'opacity 150ms, stroke-width 150ms' }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 leading-tight">
            {activeArc ? activeArc.label : centerLabel}
          </span>
          <span className="mt-0.5 text-lg sm:text-xl font-extrabold tabular-nums text-neutral-900 dark:text-white leading-tight">
            {activeArc ? pct(activeArc.frac) : centerValue}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {arcs.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              aria-pressed={active === a.key}
              onClick={() => setActive((cur) => (cur === a.key ? null : a.key))}
              onMouseEnter={() => setActive(a.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a.key)}
              onBlur={() => setActive(null)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${active === a.key ? 'bg-neutral-100 dark:bg-neutral-700/50' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30'}`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color }} aria-hidden="true" />
              <span className="flex-1 min-w-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{a.label}</span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums text-neutral-900 dark:text-white break-words">{fmt(a.value)}</span>
                <span className="block text-[11px] font-medium tabular-nums text-neutral-400 dark:text-neutral-500">{pct(a.frac)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- BALANCE CHART --- (inline SVG, drawn at the container's real pixel width)
interface BalancePoint { year: number; balance: number; interest: number; label: string; }

const BalanceChart: React.FC<{
  points: BalancePoint[];
  locale: string;
  currency: string;
  fmt: (n: number) => string;
}> = ({ points, locale, currency, fmt }) => {
  const [wrapRef, width] = useElementWidth();
  const [idx, setIdx] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const H = 250;

  const dataMax = Math.max(...points.map((p) => Math.max(p.balance, p.interest)), 1);
  const step = niceStep(dataMax / 4);
  const yMax = Math.ceil(dataMax / step) * step;
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const yLabels = yTicks.map((t) => compactMoney(t, locale, currency));

  const padL = Math.max(...yLabels.map((l) => l.length)) * 7 + 14;
  const padR = 14, padT = 12, padB = 32;
  const innerW = Math.max(width - padL - padR, 10);
  const innerH = H - padT - padB;
  const xMax = Math.max(points[points.length - 1].year, 1);
  const x = (yr: number) => padL + (yr / xMax) * innerW;
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;

  const maxXTicks = Math.max(2, Math.floor(innerW / 56));
  const xStep = [1, 2, 5, 10, 20].find((c) => xMax / c <= maxXTicks) ?? 20;
  const xTicks: number[] = [];
  for (let t = 0; t <= xMax; t += xStep) xTicks.push(t);

  const line = (key: 'balance' | 'interest') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const balanceLine = line('balance');
  const areaPath = `${balanceLine} L${x(xMax).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const pick = (clientX: number, left: number) => {
    const yr = ((clientX - left - padL) / innerW) * xMax;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.year - yr);
      if (d < bd) { bd = d; best = i; }
    });
    setIdx(best);
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => (i === null ? 0 : Math.min(i + 1, last))); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => (i === null ? last : Math.max(i - 1, 0))); }
    else if (e.key === 'Home') { e.preventDefault(); setIdx(0); }
    else if (e.key === 'End') { e.preventDefault(); setIdx(last); }
    else if (e.key === 'Escape') setIdx(null);
  };

  const active = idx !== null ? points[idx] : null;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <div className="min-h-[3.5rem] mb-3 flex items-center" aria-live="polite">
        {active ? (
          <div className="grid grid-cols-3 gap-2 w-full">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {active.year === 0 ? 'Start' : `Year ${active.year}`}
              </span>
              <span className="block text-[13px] sm:text-sm font-bold text-neutral-900 dark:text-white break-words">{active.label}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Balance left</span>
              <span className="block text-[13px] sm:text-sm font-bold tabular-nums text-neutral-900 dark:text-white break-words">{fmt(active.balance)}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">Interest so far</span>
              <span className="block text-[13px] sm:text-sm font-bold tabular-nums text-neutral-900 dark:text-white break-words">{fmt(active.interest)}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
            Hover, tap or use the arrow keys on the chart to read any year.
          </p>
        )}
      </div>

      <div
        ref={wrapRef}
        className="w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
        aria-label="Loan balance chart. Use left and right arrow keys to move between years."
      >
        {width > 0 ? (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Remaining balance falls from ${fmt(first.balance)} to ${fmt(last.balance)} over ${last.year} years. Interest paid reaches ${fmt(last.interest)}.`}
            style={{ touchAction: 'pan-y', display: 'block' }}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIdx(null); }}
          >
            <defs>
              <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((t, i) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} strokeWidth="1" className="stroke-neutral-200 dark:stroke-neutral-700" strokeDasharray={t === 0 ? undefined : '3 4'} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" className="fill-neutral-400 dark:fill-neutral-500 tabular-nums">{yLabels[i]}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={H - 10} textAnchor={t === 0 ? 'start' : t === xMax ? 'end' : 'middle'} fontSize="11" className="fill-neutral-400 dark:fill-neutral-500">
                {t === 0 ? 'Start' : `Yr ${t}`}
              </text>
            ))}

            <path d={areaPath} fill={`url(#${gid}-area)`} />
            <path d={balanceLine} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            <path d={line('interest')} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {active && (
              <g>
                <line x1={x(active.year)} x2={x(active.year)} y1={padT} y2={y(0)} strokeWidth="1" className="stroke-neutral-400 dark:stroke-neutral-500" />
                <circle cx={x(active.year)} cy={y(active.balance)} r="4.5" fill="#10b981" className="stroke-white dark:stroke-neutral-800" strokeWidth="2" />
                <circle cx={x(active.year)} cy={y(active.interest)} r="4.5" fill="#f43f5e" className="stroke-white dark:stroke-neutral-800" strokeWidth="2" />
              </g>
            )}
          </svg>
        ) : (
          <div style={{ height: H }} aria-hidden="true" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-emerald-500" aria-hidden="true" />Remaining balance</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-1 rounded-full bg-rose-500" aria-hidden="true" />Interest paid so far</span>
      </div>
    </div>
  );
};

// --- YEARLY SCHEDULE --- (years first; one year opens at a time to show its payments)
const MiniStat: React.FC<{ label: string; value: string; sub?: string; strong?: boolean; className?: string }> = ({ label, value, sub, strong, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{label}</span>
    <span className={`block text-[13px] sm:text-sm tabular-nums break-words ${strong ? 'font-extrabold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-700 dark:text-neutral-200'}`}>{value}</span>
    {sub && <span className="block text-[11px] font-medium text-neutral-400 dark:text-neutral-500">{sub}</span>}
  </div>
);

const SCHEDULE_PREVIEW_YEARS = 10;

const YearlySchedule: React.FC<{ result: MortgageResult }> = ({ result: r }) => {
  const uid = useId();
  const prefersReducedMotion = useReducedMotion();
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const loc = r.locale;
  const fmt0 = (n: number) => formatMoney(n, loc, r.currency, 0);
  const fmt2 = (n: number) => formatMoney(n, loc, r.currency, 2);

  const byYear = useMemo(() => {
    const m = new Map<number, ScheduleRow[]>();
    for (const row of r.schedule) {
      const list = m.get(row.loanYear);
      if (list) list.push(row);
      else m.set(row.loanYear, [row]);
    }
    return m;
  }, [r.schedule]);

  const rowDate = (iso: string): string =>
    r.periodsPerYear === 12
      ? formatMonthYear(iso, loc)
      : new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  const years = r.yearly;
  const collapsible = years.length > SCHEDULE_PREVIEW_YEARS + 2;
  const visible = collapsible && !showAll ? years.slice(0, SCHEDULE_PREVIEW_YEARS) : years;

  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((y) => {
          const isOpen = openYear === y.year;
          const rows = byYear.get(y.year) ?? [];
          const costs = y.propertyTax + y.insurance + y.pmi + y.hoa + y.other;
          const panelId = `${uid}-year-${y.year}`;
          return (
            <li key={y.year} className={`rounded-2xl border overflow-hidden transition-colors duration-150 ${isOpen ? 'border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60'}`}>
              <button
                type="button"
                onClick={() => setOpenYear(isOpen ? null : y.year)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center gap-3 p-3 sm:p-4 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/60"
              >
                <div className="w-16 flex-shrink-0">
                  <span className="block text-sm font-extrabold text-neutral-900 dark:text-white">Year {y.year}</span>
                  <span className="block text-[11px] font-medium text-neutral-400 dark:text-neutral-500">{formatMonthYear(y.startDate, loc)}</span>
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                  <MiniStat label="Paid" value={fmt0(y.payments)} className="hidden sm:block" />
                  <MiniStat label="Principal" value={fmt0(y.principal)} className="hidden sm:block" />
                  <MiniStat label="Interest" value={fmt0(y.interest)} />
                  <MiniStat label="Balance" value={fmt0(y.endBalance)} strong />
                </div>
                <SafeIcon icon={FiChevronDown} className={`w-5 h-5 flex-shrink-0 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-label={`Payments in year ${y.year}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-neutral-100 dark:border-neutral-700/60 px-3 sm:px-4 pt-3 pb-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 pb-3">
                        <MiniStat label="Paid this year" value={fmt0(y.payments)} />
                        <MiniStat label="Principal" value={fmt0(y.principal)} />
                        <MiniStat label="Interest" value={fmt0(y.interest)} />
                        {costs > 0.004 && <MiniStat label="Taxes & costs" value={fmt0(costs)} />}
                      </div>

                      <div className="hidden sm:grid grid-cols-[1.1fr_1fr_1fr_1fr_1.1fr] gap-3 py-2 border-t border-neutral-100 dark:border-neutral-700/60 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                        <span>Date</span><span>Paid</span><span>Principal</span><span>Interest</span><span className="text-right">Balance</span>
                      </div>
                      <ul className="divide-y divide-neutral-100 dark:divide-neutral-700/60 border-t border-neutral-100 dark:border-neutral-700/60 sm:border-t-0">
                        {rows.map((row) => (
                          <li key={row.period} className="py-2.5">
                            {/* Phone layout: two lines, no sideways scroll */}
                            <div className="sm:hidden">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-sm font-bold text-neutral-900 dark:text-white">{rowDate(row.date)}</span>
                                <span className="text-sm font-extrabold tabular-nums text-neutral-900 dark:text-white">{fmt2(row.balance)}</span>
                              </div>
                              <p className="mt-0.5 text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400 break-words">
                                Paid {fmt2(row.payment + row.extra)} · Principal {fmt2(row.principal + row.extra)} · Interest {fmt2(row.interest)}
                              </p>
                            </div>
                            {/* Tablet / desktop layout: one table-like row */}
                            <div className="hidden sm:grid grid-cols-[1.1fr_1fr_1fr_1fr_1.1fr] gap-3 text-sm tabular-nums">
                              <span className="font-bold text-neutral-900 dark:text-white">{rowDate(row.date)}</span>
                              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{fmt2(row.payment + row.extra)}</span>
                              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{fmt2(row.principal + row.extra)}</span>
                              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{fmt2(row.interest)}</span>
                              <span className="text-right font-extrabold text-neutral-900 dark:text-white">{fmt2(row.balance)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {collapsible && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => { setShowAll((s) => !s); setOpenYear(null); }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            {showAll ? 'Show fewer years' : `Show all ${years.length} years`}
            <SafeIcon icon={FiChevronDown} className={`w-4 h-4 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
};

// --- DATE HELPER: calendar label for "loan month N" (month 1 = the first payment month) ---
const loanMonthLabel = (startYear: number, startMonth: number, loanMonth: number, locale: string): string => {
  if (!Number.isFinite(startYear) || !Number.isFinite(loanMonth) || loanMonth < 1) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(startYear, startMonth - 1 + (loanMonth - 1), 1)));
};

// --- PMI TIMELINE (US) ---
const PmiTimeline: React.FC<{ result: MortgageResult; inputs: MortgageInputs }> = ({ result: r, inputs }) => {
  const loc = r.locale;
  const fmt0 = (n: number) => formatMoney(n, loc, r.currency, 0);
  const fmt2 = (n: number) => formatMoney(n, loc, r.currency, 2);
  const p = r.pmi;

  if (!p.applies) {
    return (
      <p className="text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-300">
        No PMI is charged in this estimate. Your down payment is {r.downPaymentPct}% of the price (the loan is {r.ltvPct}% of the home value),
        and this calculator only adds PMI when the loan is more than 80% of the home value.
      </p>
    );
  }

  const totalMonths = Math.max(1, Math.round(inputs.termYears * 12));
  const through = p.chargedThroughMonth ?? totalMonths;
  const pctOf = (m: number | null) => (m === null ? 0 : Math.min(100, Math.max(0, (m / totalMonths) * 100)));
  const label = (m: number | null) =>
    m === null ? 'Not reached' : `Month ${m} · ${loanMonthLabel(inputs.startYear, inputs.startMonth, m, loc)}`;
  const rule = inputs.pmi?.dropAt === 'auto78' ? '78% (automatic)' : '80% (on request)';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile tone="violet" icon={FiShield} value={fmt2(r.firstPeriod.pmi)} label="PMI per month" />
        <StatTile tone="indigo" icon={FiCalendar} value={`Month ${through}`} label="PMI stops after" sub={loanMonthLabel(inputs.startYear, inputs.startMonth, through, loc)} maxRem={1.5} />
      </div>

      {/* Timeline bar: violet = months you pay PMI */}
      <div>
        <div className="relative h-3 rounded-full bg-neutral-100 dark:bg-neutral-700/60 overflow-hidden" role="img"
          aria-label={`PMI is charged for the first ${through} of ${totalMonths} months`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pctOf(through)}%` }} />
        </div>
        <div className="relative h-5 mt-1" aria-hidden="true">
          {p.month80 !== null && (
            <span className="absolute -translate-x-1/2 text-[10px] font-bold text-neutral-400 dark:text-neutral-500" style={{ left: `${pctOf(p.month80)}%` }}>▲ 80%</span>
          )}
        </div>
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 -mt-2">
          <span>Start</span><span>End of loan</span>
        </div>
      </div>

      <dl className="divide-y divide-neutral-100 dark:divide-neutral-700/60 text-sm">
        {[
          { k: 'Balance reaches 80% of home value', v: label(p.month80), tip: 'You can usually ask your lender to remove PMI from this point.' },
          { k: 'Scheduled to reach 78% (automatic)', v: label(p.month78Scheduled), tip: 'On the original schedule, PMI should end automatically around here.' },
          ...(p.month78Actual !== null && p.month78Scheduled !== null && p.month78Actual < p.month78Scheduled
            ? [{ k: '78% reached with your extra payments', v: label(p.month78Actual), tip: '' }]
            : []),
          { k: `PMI ends in this estimate (${rule})`, v: label(p.chargedThroughMonth), tip: '' },
          { k: 'Total PMI paid', v: fmt0(p.totalPaid), tip: '' },
        ].map((row) => (
          <div key={row.k} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4">
            <dt className="font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
              {row.k}
              {row.tip && <InfoTip text={row.tip} widthClass="w-56" />}
            </dt>
            <dd className="font-bold tabular-nums text-neutral-900 dark:text-white">{row.v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
        An estimate only. Your lender&apos;s PMI terms decide the real end date, and some loan types work differently.
      </p>
    </div>
  );
};

// --- COMPARE PANEL --- (read-only: weighs extra payments, both biweekly styles, a shorter term and a recast.
// Its settings are entered in the Extra payments card above and locked in when Calculate is pressed.)
interface CompareOptions {
  extraMonthly?: number;
  shorterTermYears?: number;
  recastLump?: number;
  recastAtMonth?: number;
}

const ComparePanel: React.FC<{ inputs: MortgageInputs; options: CompareOptions }> = ({ inputs, options }) => {
  const profile = REGION_PROFILES[inputs.region];
  const loc = profile.locale;
  const fmt0 = (n: number) => formatMoney(n, loc, profile.currency, 0);
  const fmt2 = (n: number) => formatMoney(n, loc, profile.currency, 2);

  const { outcomes, error } = useMemo(() => {
    try {
      const out = compareStrategies(inputs, {
        extraMonthly: options.extraMonthly,
        // A value at or above the current term switches the shorter-term row off (the engine would otherwise default to 15).
        shorterTermYears: options.shorterTermYears !== undefined && options.shorterTermYears >= 1 ? options.shorterTermYears : inputs.termYears,
        recastLump: options.recastLump,
        recastAtMonth: options.recastAtMonth,
      });
      return { outcomes: out, error: null as string | null };
    } catch (err) {
      return {
        outcomes: [] as StrategyOutcome[],
        error: err instanceof MortgageInputError ? Object.values(err.errors)[0] : 'These comparison settings could not be calculated.',
      };
    }
  }, [inputs, options]);

  const best = outcomes
    .filter((o) => o.id !== 'standard' && o.interestSaved > 0.5)
    .reduce<StrategyOutcome | null>((a, o) => (a === null || o.interestSaved > a.interestSaved ? o : a), null);

  const used: string[] = [];
  if (options.extraMonthly) used.push(`${fmt0(options.extraMonthly)} extra every month`);
  if (options.shorterTermYears && options.shorterTermYears < inputs.termYears) used.push(`${options.shorterTermYears}-year term`);
  if (options.recastLump) used.push(`${fmt0(options.recastLump)} lump sum + recast in ${loanMonthLabel(inputs.startYear, inputs.startMonth, options.recastAtMonth ?? 60, loc)}`);

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
        {used.length > 0
          ? `Comparing: ${used.join(' · ')}. Change these in the Extra payments section above, then press Calculate again.`
          : 'Want more to compare? Add an extra monthly payment, a shorter term or a lump sum + recast in the Extra payments section above, then press Calculate again.'}
      </p>

      {error ? (
        <p role="alert" className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
          <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </p>
      ) : (
        <ul className="space-y-3">
          {outcomes.map((o) => {
            const isBase = o.id === 'standard';
            const per = o.paymentsPerYear === 12 ? '/ month' : 'every 2 weeks';
            return (
              <li key={o.id} className={`rounded-2xl border p-4 ${best?.id === o.id ? 'border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/40 dark:bg-emerald-900/10' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <h5 className="text-sm font-extrabold text-neutral-900 dark:text-white min-w-0">{o.label}</h5>
                  {best?.id === o.id && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full whitespace-nowrap">Most interest saved</span>
                  )}
                </div>
                <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">{o.note}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-3">
                  <MiniStat label="Payment" value={fmt2(o.payment)} sub={per} />
                  <MiniStat label="Paid off" value={formatMonthYear(o.payoffDate, loc)} sub={formatDuration(o.payoffMonths)} />
                  <MiniStat label="Total interest" value={fmt0(o.totalInterest)} />
                  <MiniStat
                    label="You save"
                    value={isBase ? 'Baseline' : o.interestSaved > 0.5 ? fmt0(o.interestSaved) : 'About the same'}
                    sub={isBase ? undefined : o.monthsSaved >= 0.5 ? `${formatDuration(o.monthsSaved)} sooner` : 'Same payoff time'}
                    strong
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
        Every option starts from the loan above and covers principal and interest only. Taxes, PMI, your yearly and one-time
        extras and your other extra payment dates are left out, and the extra monthly amount is counted from the first payment, so the comparison is like for like. Lenders handle biweekly payments in different ways, so treat these as estimates.
      </p>
    </div>
  );
};

// --- SOURCES ---
// The engine's MORTGAGE_SOURCES list is the base. Three entries were "to-verify" in the engine file; their
// checked links and wording are applied here so the page never shows an unverified source as fact.
// (Optional later: copy these three entries back into mortgageLogic.ts and delete this override map.)
const SOURCE_OVERRIDES: Record<string, Partial<MortgageSource>> = {
  'hpa-1998': {
    title: 'Homeowners Protection Act of 1998 (Public Law 105-216)',
    url: 'https://www.govinfo.gov/content/pkg/PLAW-105publ216/html/PLAW-105publ216.htm',
    note: 'US federal law behind the PMI timeline. It sets the 80% cancellation point and the 78% automatic termination point, both measured against the original value of the property.',
    status: 'verified',
  },
  'canada-semi-annual': {
    title: 'Interest Act (Canada), section 6: interest on mortgages with blended payments',
    url: 'https://laws-lois.justice.gc.ca/eng/acts/I-15/FullText.html',
    note: 'The Act requires such a mortgage to state its rate on a yearly or half-yearly basis, not in advance. Canadian fixed-rate mortgages are commonly quoted with semi-annual compounding, which is the method used here. Your lender\'s disclosure shows the method that applies to your loan.',
    status: 'verified',
  },
  'india-prepayment': {
    title: 'RBI (Pre-payment Charges on Loans) Directions, 2025',
    url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12878',
    note: 'Reserve Bank of India rules on prepayment charges, issued on 2 July 2025. Rules differ by loan type and by lender type, so check your own sanction letter before assuming extra payments are free.',
    status: 'verified',
  },
};
const SOURCE_REGION_TAG: Record<string, string> = {
  'amortization-formula': 'All regions',
  'cfpb-pmi': 'US',
  'hpa-1998': 'US',
  'canada-semi-annual': 'Canada',
  'india-prepayment': 'India',
};
const DISPLAY_SOURCES: MortgageSource[] = MORTGAGE_SOURCES.map((src) => ({ ...src, ...(SOURCE_OVERRIDES[src.id] ?? {}) }));

const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({
  preset,
  onCalculationComplete,
  onReportChange,
  onDownloadReport,
  downloadingFormat = null,
  onShare,
  onEmailShare,
  onCopyLink,
  linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

  // --- STATE ---
  // A preset only seeds the initial state (read once on mount).
  const [initialRegion] = useState<RegionCode>(() => (preset?.region && preset.region in REGION_PROFILES ? preset.region : 'US'));
  const [region, setRegion] = useState<RegionCode>(initialRegion);
  const profile = REGION_PROFILES[region];

  const [price, setPrice] = useState<string>('');
  const [downMode, setDownMode] = useState<AmountMode>('percent');
  const [down, setDown] = useState<string>('');
  const [term, setTerm] = useState<string>(() => {
    const t = preset?.termYears;
    const max = REGION_PROFILES[initialRegion].maxTermYears;
    return t && Number.isFinite(t) && t >= 1 && (max === undefined || t <= max)
      ? String(t)
      : '';
  });
  const [rate, setRate] = useState<string>('');
  const [startMonth, setStartMonth] = useState<number>(() => defaultStart().month);
  const [startYear, setStartYear] = useState<string>(() => String(defaultStart().year));

  const [costs, setCosts] = useState<CostsState>(defaultCosts);
  const [pmi, setPmi] = useState<PmiField>(defaultPmi);
  const [costsOpen, setCostsOpen] = useState<boolean>(() => !!preset?.openCosts);
  const [incr, setIncr] = useState<Record<CostKey, string>>({ propertyTax: '', insurance: '', hoa: '', other: '' });

  // Extra payments (all optional)
  const [exMonthly, setExMonthly] = useState<string>(() => (preset?.extraMonthly && preset.extraMonthly > 0 ? String(preset.extraMonthly) : ''));
  // "Starting from" / "Paid in" dates. null = follow the First payment date (the default), so changing the
  // loan start moves these along until the user picks their own month and year.
  const [exMonthlyStart, setExMonthlyStart] = useState<MonthYear | null>(null);
  const [exYearly, setExYearly] = useState<string>('');
  const [exYearlyStart, setExYearlyStart] = useState<MonthYear | null>(null);
  const [oneTimes, setOneTimes] = useState<{ id: number; amount: string; when: MonthYear | null }[]>([]);
  // Compare options: only feed the Compare section of the results (never the main result).
  const [cmpShorter, setCmpShorter] = useState<string>('');
  const [cmpRecast, setCmpRecast] = useState<string>('');
  const [cmpRecastAt, setCmpRecastAt] = useState<MonthYear | null>(null); // null = payment month 60
  const oneTimeId = useRef<number>(1);
  const [extrasOpen, setExtrasOpen] = useState<boolean>(() => !!preset?.openExtras || !!(preset?.extraMonthly && preset.extraMonthly > 0));

  // Download menu + Sources panel (same behaviour as the sibling calculators)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<boolean>(false);
  // Locked-in inputs + result, only updated by Calculate (same explicit-calculate pattern as siblings).
  const [committed, setCommitted] = useState<{ inputs: MortgageInputs; result: MortgageResult; compare: CompareOptions } | null>(null);

  const sym = useMemo(() => currencySymbol(profile.locale, profile.currency), [profile]);
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(profile.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1)))
    ),
    [profile.locale]
  );

  // Extra-payment dates: shown as month + year, converted to the engine's loan-month number
  // (1 = first payment month) only when building the inputs.
  const startYearInt = parseNum(startYear);
  const resolveYM = (v: MonthYear | null): MonthYear => v ?? { month: startMonth, year: startYear };
  const monthIndexOf = (r: MonthYear): number => {
    const y = parseNum(r.year);
    if (!Number.isFinite(y) || !Number.isFinite(startYearInt)) return NaN;
    return (y - startYearInt) * 12 + (r.month - startMonth) + 1;
  };
  const loanMonthOf = (v: MonthYear | null): number => monthIndexOf(resolveYM(v));
  // Recast date: unless the user picks one, it sits at payment month 60 (five years in).
  const DEFAULT_RECAST_MONTH = 60;
  const ymOfLoanMonth = (n: number): MonthYear => {
    if (!Number.isFinite(startYearInt)) return { month: startMonth, year: startYear };
    const idx = startMonth - 1 + (n - 1);
    return { month: (((idx % 12) + 12) % 12) + 1, year: String(startYearInt + Math.floor(idx / 12)) };
  };
  const resolveRecastYM = (): MonthYear => cmpRecastAt ?? ymOfLoanMonth(DEFAULT_RECAST_MONTH);
  const recastMonthOf = (): number => (cmpRecastAt ? monthIndexOf(cmpRecastAt) : DEFAULT_RECAST_MONTH);
  const buildCompareOptions = (built: MortgageInputs): CompareOptions => {
    const sh = parseNum(cmpShorter);
    const rl = parseNum(cmpRecast);
    return {
      extraMonthly: built.extras?.monthly && built.extras.monthly.amount > 0 ? built.extras.monthly.amount : undefined,
      shorterTermYears: sh >= 1 && sh < built.termYears ? sh : undefined,
      recastLump: rl > 0 ? rl : undefined,
      recastAtMonth: rl > 0 ? recastMonthOf() : undefined,
    };
  };
  const beforeStartMessage = (): string =>
    `Choose ${monthNames[startMonth - 1]} ${startYear} or later, your first payment month.`;
  // "Choose ... or later" errors belong to the date picker; every other extras error belongs to the amount field.
  const isDateErr = (m?: string): boolean => Boolean(m) && /or later/.test(m as string);
  const amountErr = (m?: string): string | undefined => (m && !isDateErr(m) ? m : undefined);
  const dateErr = (m?: string): string | undefined => (isDateErr(m) ? m : undefined);
  const extraDateErrors = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!Number.isFinite(startYearInt)) return out;
    const bad = (v: MonthYear | null) => {
      const n = loanMonthOf(v);
      return !Number.isFinite(n) || n < 1;
    };
    if (Number(exMonthly) > 0 && bad(exMonthlyStart)) out.extraMonthly = beforeStartMessage();
    if (Number(exYearly) > 0 && bad(exYearlyStart)) out.extraYearly = beforeStartMessage();
    if (oneTimes.some((o) => Number(o.amount) > 0 && bad(o.when))) out.extraOneTime = beforeStartMessage();
    if (parseNum(cmpRecast) > 0) {
      const n = recastMonthOf();
      const termMonths = Math.round((parseNum(term) || 0) * 12);
      if (!Number.isFinite(n) || n < 2) out.compareRecast = `Choose a month after ${monthNames[startMonth - 1]} ${startYear}, your first payment month.`;
      else if (termMonths > 0 && n > termMonths) out.compareRecast = 'Choose a date within your loan term.';
    }
    return out;
  };

  const money = useCallback(
    (n: number, dp = 0) => formatMoney(n, profile.locale, profile.currency, dp),
    [profile.locale, profile.currency]
  );

  const clearErr = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  // --- DERIVED PREVIEW (down payment link + loan) ---
  const priceNum = parseNum(price);
  const downPreview = useMemo(() => {
    const p = parseNum(price);
    const d = down.trim() === '' ? 0 : Number(down);
    if (!(p > 0) || !Number.isFinite(d)) return null;
    const amt = downMode === 'percent' ? (p * d) / 100 : d;
    if (amt >= p) return null;
    return { amt, pct: (amt / p) * 100, loan: p - amt };
  }, [price, down, downMode]);

  // --- HANDLERS ---
  const resetFields = () => {
    setPrice('');
    setDownMode('percent');
    setDown('');
    setTerm('');
    setRate('');
    setCosts(defaultCosts());
    setPmi(defaultPmi());
    setIncr({ propertyTax: '', insurance: '', hoa: '', other: '' });
    setExMonthly('');
    setExMonthlyStart(null);
    setExYearly('');
    setExYearlyStart(null);
    setOneTimes([]);
    setCmpShorter('');
    setCmpRecast('');
    setCmpRecastAt(null);
  };

  const handleRegionChange = (r: RegionCode) => {
    if (r === region) return;
    setRegion(r);
    resetFields();
    setErrors({});
    setTouched(true);
  };

  const handleDownModeChange = (m: AmountMode) => {
    if (m === downMode) return;
    setDown(convertAmount(down, downMode, m, priceNum));
    setDownMode(m);
    clearErr('downPayment');
    setTouched(true);
  };

  const handleCostChange = (key: CostKey, patch: Partial<CostField>) => {
    setCosts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    clearErr(key);
    setTouched(true);
  };

  const handleCostMode = (key: CostKey, m: AmountMode) => {
    if (m === costs[key].mode) return;
    handleCostChange(key, { mode: m, value: convertAmount(costs[key].value, costs[key].mode, m, priceNum) });
  };

  const handlePmiMode = (m: AmountMode) => {
    if (m === pmi.mode) return;
    const base = downPreview ? downPreview.loan : NaN;
    setPmi((prev) => ({ ...prev, mode: m, value: convertAmount(prev.value, prev.mode, m, base) }));
    clearErr('pmi');
    setTouched(true);
  };

  const isCalculateDisabled = price.trim() === '' || rate.trim() === '' || term.trim() === '';
  const isClearDisabled = !touched && !committed;

  const handleClear = () => {
    if (isClearDisabled) return;
    resetFields();
    const s = defaultStart();
    setStartMonth(s.month);
    setStartYear(String(s.year));
    setErrors({});
    setCommitted(null);
    setTouched(false);
  };

  const buildInputs = (): MortgageInputs => {
    const costsInput: RecurringCosts = {};
    COST_KEYS.forEach((k) => {
      const c = costs[k];
      if (c.value.trim() !== '') costsInput[k] = { mode: c.mode, value: Number(c.value) };
    });
    const hasCosts = Object.keys(costsInput).length > 0;
    if (hasCosts) {
      const inc: NonNullable<RecurringCosts['annualIncreasePct']> = {};
      COST_KEYS.forEach((k) => {
        if (costsInput[k] && incr[k].trim() !== '') inc[k] = Number(incr[k]);
      });
      if (Object.keys(inc).length > 0) costsInput.annualIncreasePct = inc;
    }
    const extras: ExtraPayments = {};
    if (exMonthly.trim() !== '' && Number(exMonthly) > 0) {
      extras.monthly = { amount: Number(exMonthly), fromMonth: loanMonthOf(exMonthlyStart) };
    }
    if (exYearly.trim() !== '' && Number(exYearly) > 0) {
      extras.yearly = { amount: Number(exYearly), calendarMonth: resolveYM(exYearlyStart).month, fromMonth: loanMonthOf(exYearlyStart) };
    }
    const lumps = oneTimes
      .filter((o) => o.amount.trim() !== '' && Number(o.amount) > 0)
      .map((o) => ({ amount: Number(o.amount), month: loanMonthOf(o.when) }));
    if (lumps.length > 0) extras.oneTime = lumps;
    const hasExtras = Object.keys(extras).length > 0;
    const pmiInput: PmiInput | undefined =
      profile.supportsPmi && pmi.value.trim() !== ''
        ? { annualCost: { mode: pmi.mode, value: Number(pmi.value) }, dropAt: pmi.dropAt }
        : undefined;
    return {
      region,
      homePrice: parseNum(price),
      downPayment: { mode: downMode, value: down.trim() === '' ? 0 : Number(down) },
      termYears: parseNum(term),
      annualRatePct: parseNum(rate),
      startYear: parseNum(startYear),
      startMonth,
      paymentMode: 'monthly',
      costs: hasCosts ? costsInput : undefined,
      pmi: pmiInput,
      extras: hasExtras ? extras : undefined,
    };
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;
    const inputs = buildInputs();

    const validation = validateMortgageInputs(inputs);
    const dateErrors = extraDateErrors();
    if (!validation.valid || Object.keys(dateErrors).length > 0) {
      const merged = { ...validation.errors, ...dateErrors };
      setErrors(merged);
      setCommitted(null);
      if (COST_ERROR_KEYS.some((k) => k in merged)) setCostsOpen(true);
      if (EXTRA_ERROR_KEYS.some((k) => k in merged)) setExtrasOpen(true);
      return;
    }

    let result: MortgageResult;
    try {
      result = calculateMortgage(inputs);
    } catch (err) {
      if (err instanceof MortgageInputError) {
        setErrors(err.errors);
        if (COST_ERROR_KEYS.some((k) => k in err.errors)) setCostsOpen(true);
        if (EXTRA_ERROR_KEYS.some((k) => k in err.errors)) setExtrasOpen(true);
      } else {
        setErrors({ form: 'Something went wrong while calculating. Please check your entries and try again.' });
      }
      setCommitted(null);
      return;
    }

    setErrors({});
    setCommitted({ inputs, result, compare: buildCompareOptions(inputs) });

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

  // --- SHAREABLE REPORT ---
  // PNG = key results only (imageSections). PDF = key results + inputs recap + year-by-year summary (pdfOnlySections).
  const report = useMemo<ShareableReport | null>(() => {
    if (!committed) return null;
    const { inputs, result: r } = committed;
    const loc = r.locale;
    const cur = r.currency;
    const f0 = (n: number) => formatMoney(n, loc, cur, 0);
    const f2 = (n: number) => formatMoney(n, loc, cur, 2);
    const fAmt = (n: number) => (Number.isInteger(n) ? f0(n) : f2(n));
    const fp = r.firstPeriod;
    const pr = REGION_PROFILES[inputs.region];
    const startLabel = loanMonthLabel(inputs.startYear, inputs.startMonth, 1, loc);
    type Row = { label: string; value: string };

    const costRows: Row[] = [
      { label: 'Property tax', value: fp.propertyTax },
      { label: 'Home insurance', value: fp.insurance },
      { label: 'PMI', value: fp.pmi },
      { label: 'HOA / fees', value: fp.hoa },
      { label: 'Other costs', value: fp.other },
    ]
      .filter((x) => Number(x.value) > 0.004)
      .map((x) => ({ label: x.label, value: f2(Number(x.value)) }));

    const sections: ShareableReport['sections'] = [];
    const imageSections: ShareableReport['sections'] = [];

    if (costRows.length > 0) {
      const paymentSection = {
        heading: 'Monthly Payment (first month)',
        rows: [
          { label: 'Principal & interest', value: f2(r.scheduledPayment) },
          ...costRows,
          { label: 'Total monthly payment', value: f2(fp.total) },
        ],
        variant: 'output' as const,
      };
      sections.push(paymentSection);
      imageSections.push(paymentSection);
    }

    const loanSection = {
      heading: 'Loan Summary',
      rows: [
        { label: 'Loan amount', value: f0(r.loanAmount) },
        { label: 'Down payment', value: `${f0(r.downPaymentAmount)} (${trimNum(r.downPaymentPct, 2)}%)` },
        { label: 'Total interest', value: f0(r.totals.interest) },
        { label: 'Total of payments', value: f0(r.totals.principalAndInterestPaid) },
        { label: 'Payoff date', value: `${formatMonthYear(r.payoff.date, loc)} (${formatDuration(r.payoff.months)})` },
      ],
      variant: 'output' as const,
    };
    sections.push(loanSection);
    imageSections.push(loanSection);

    if (r.savings) {
      const savingsSection = {
        heading: 'Extra Payment Savings',
        rows: [
          { label: 'Interest saved', value: f0(r.savings.interestSaved) },
          { label: 'Paid off sooner', value: formatDuration(r.savings.monthsSaved) },
          { label: 'Extra payments total', value: f0(r.savings.extraPaidTotal) },
        ],
        variant: 'output' as const,
      };
      sections.push(savingsSection);
      imageSections.push(savingsSection);
    }

    if (r.pmi.applies && r.pmi.chargedThroughMonth !== null) {
      sections.push({
        heading: 'PMI',
        rows: [
          { label: 'PMI per month', value: f2(fp.pmi) },
          { label: 'PMI ends after', value: `Month ${r.pmi.chargedThroughMonth} (${loanMonthLabel(inputs.startYear, inputs.startMonth, r.pmi.chargedThroughMonth, loc)})` },
          { label: 'Total PMI paid', value: f0(r.pmi.totalPaid) },
        ],
        variant: 'output',
      });
    }

    // --- inputs recap (PDF only) ---
    const amountText = (a: AmountInput | undefined, percentOf: string): string =>
      !a ? '' : a.mode === 'percent' ? `${trimNum(a.value, 3)}% of ${percentOf} per year` : `${fAmt(a.value)} per year`;
    const inputRows: Row[] = [
      { label: 'Region', value: pr.label },
      { label: 'Home price', value: f0(inputs.homePrice) },
      { label: 'Down payment', value: `${f0(r.downPaymentAmount)} (${trimNum(r.downPaymentPct, 2)}%)` },
      { label: 'Loan term', value: `${inputs.termYears} years` },
      { label: 'Interest rate', value: `${inputs.annualRatePct}% per year${inputs.region === 'CA' ? ', compounded semi-annually' : ''}` },
      { label: 'First payment', value: startLabel },
    ];
    COST_KEYS.forEach((k) => {
      const a = inputs.costs?.[k];
      if (!a) return;
      const inc = inputs.costs?.annualIncreasePct?.[k];
      inputRows.push({
        label: COST_META[k].label,
        value: `${amountText(a, 'home price')}${inc ? `, rising ${trimNum(inc, 2)}% a year` : ''}`,
      });
    });
    if (inputs.pmi) {
      inputRows.push({
        label: 'PMI',
        value: `${amountText(inputs.pmi.annualCost, 'loan')}, ends at ${inputs.pmi.dropAt === 'auto78' ? '78%' : '80%'}`,
      });
    }
    const ex = inputs.extras;
    if (ex?.monthly) inputRows.push({ label: 'Extra every month', value: `${fAmt(ex.monthly.amount)} from payment month ${ex.monthly.fromMonth ?? 1}` });
    if (ex?.yearly) {
      const mName = new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, ex.yearly.calendarMonth - 1, 1)));
      inputRows.push({ label: 'Extra once a year', value: `${fAmt(ex.yearly.amount)} every ${mName}` });
    }
    (ex?.oneTime ?? []).forEach((o, i) => {
      inputRows.push({ label: `One-time payment ${i + 1}`, value: `${fAmt(o.amount)} in payment month ${o.month}` });
    });

    const yearRows: Row[] = r.yearly.map((y) => ({
      label: `Year ${y.year} (${formatMonthYear(y.startDate, loc)})`,
      value: `Interest ${f0(y.interest)} · Balance ${f0(y.endBalance)}`,
    }));

    return {
      title: 'Mortgage Result',
      headlineValue: f2(r.scheduledPayment),
      headlineLabel: 'per month, principal & interest',
      accentColor: ACCENT.hex,
      meta: [pr.label, `${inputs.annualRatePct}% · ${inputs.termYears} years`],
      sections,
      imageSections,
      pdfOnlySections: [
        { heading: 'Your Inputs', rows: inputRows, variant: 'input' },
        { heading: 'Year-by-Year Summary', rows: yearRows, variant: 'output' },
      ],
      disclaimer: 'Estimates for planning only, not financial advice or a lender quote. Real payments depend on your lender\'s terms, rounding and fees.',
      fileNameBase: `mortgage-${inputs.region.toLowerCase()}-${Math.round(r.scheduledPayment)}`,
    };
  }, [committed]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  // Download menu: close on outside click, and while a download is being prepared.
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
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
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-neutral-600 disabled:hover:border-neutral-200 disabled:hover:shadow-sm disabled:active:scale-100"
        title={report ? 'Download your result' : 'Calculate a result first'}
      >
        <SafeIcon icon={downloadingFormat ? FiLoader : FiDownload} className={`w-3.5 h-3.5 flex-shrink-0 ${downloadingFormat ? 'animate-spin' : ''}`} />
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">{downloadingFormat ? 'Preparing…' : 'Download'}</span>
        <SafeIcon icon={FiChevronDown} className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${downloadMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {downloadMenuOpen && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden">
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('image'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-700/50">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiImage} className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PNG Image</span>
              <span className="block text-xs text-neutral-400 mt-0.5">Key results card</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('pdf'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer border-t border-neutral-100 dark:border-neutral-700/50 focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-700/50">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PDF Report</span>
              <span className="block text-xs text-neutral-400 mt-0.5">Inputs + year-by-year summary</span>
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
        <button type="button" onClick={() => onShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:ring-blue-200 dark:hover:ring-blue-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60" title="Share this calculator" aria-label="Share this calculator">
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onEmailShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:ring-amber-200 dark:hover:ring-amber-700/60 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60" title="Share via email" aria-label="Share via email">
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onCopyLink?.()} className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-100 dark:ring-emerald-800/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:shadow-md hover:ring-emerald-200 dark:hover:ring-emerald-700/60 hover:-translate-y-0.5'}`} title="Copy link to this calculator" aria-label={linkCopied ? 'Link copied' : 'Copy link to this calculator'}>
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? 'Copied' : 'Link'}</span>
        </button>
      </div>
    </div>
  );

  const hasError = Object.keys(errors).length > 0;
  const springConfig = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 50, damping: 12, mass: 0.8 };

  // --- COST ROW ---
  const renderCostRow = (key: CostKey) => {
    const c = costs[key];
    const meta = COST_META[key];
    const v = c.value.trim() === '' ? NaN : Number(c.value);
    let hint = '';
    if (Number.isFinite(v) && v > 0) {
      if (c.mode === 'amount') hint = `About ${money(v / 12, 2)} per month`;
      else if (priceNum > 0) hint = `About ${money((priceNum * v) / 100, 0)} per year`;
    }
    return (
      <UnitField
        key={key}
        id={`${uid}-${key}`}
        label={meta.label}
        tip={meta.tip}
        groupId={`${uid}-mode-${key}`}
        percentSuffix="% / yr"
        amountSuffix="/ yr"
        mode={c.mode}
        onModeChange={(m) => handleCostMode(key, m)}
        sym={sym}
        value={c.value}
        onChange={(val) => handleCostChange(key, { value: val })}
        locale={profile.locale}
        modeAriaLabel={`${meta.label} entry type`}
        error={errors[key]}
        hint={hint}
      />
    );
  };

  const filledExtraCount =
    (exMonthly.trim() !== '' ? 1 : 0) +
    (exYearly.trim() !== '' ? 1 : 0) +
    oneTimes.filter((o) => o.amount.trim() !== '').length;
  const filledCostCount =
    COST_KEYS.filter((k) => costs[k].value.trim() !== '').length +
    (profile.supportsPmi && pmi.value.trim() !== '' ? 1 : 0);

  // --- RESULT VALUES ---
  const renderResults = () => {
    if (!committed) return null;
    const { inputs, result: r } = committed;
    const loc = r.locale;
    const cur = r.currency;
    const fmt2 = (n: number) => formatMoney(n, loc, cur, 2);
    const fmt0 = (n: number) => formatMoney(n, loc, cur, 0);
    const fp = r.firstPeriod;
    const extrasInFirst = fp.propertyTax + fp.insurance + fp.pmi + fp.hoa + fp.other;
    const hasCostsInResult = extrasInFirst > 0.004;
    const parts = [
      { label: 'Principal & interest', value: fp.principalAndInterest },
      { label: 'Property tax', value: fp.propertyTax },
      { label: 'Insurance', value: fp.insurance },
      { label: 'PMI', value: fp.pmi },
      { label: 'HOA / fees', value: fp.hoa },
      { label: 'Other', value: fp.other },
    ].filter((p) => p.value > 0.004);
    const ringSlices: RingSlice[] = [
      { key: 'principal', label: 'Principal', value: r.loanAmount, color: '#10b981' },
      { key: 'interest', label: 'Interest', value: r.totals.interest, color: '#f43f5e' },
      { key: 'tax', label: 'Property tax', value: r.totals.propertyTax, color: '#0ea5e9' },
      { key: 'insurance', label: 'Insurance', value: r.totals.insurance, color: '#f59e0b' },
      { key: 'pmi', label: 'PMI', value: r.totals.pmi, color: '#8b5cf6' },
      { key: 'hoa', label: 'HOA / fees', value: r.totals.hoa, color: '#14b8a6' },
      { key: 'other', label: 'Other costs', value: r.totals.other, color: '#a3a3a3' },
    ].filter((sl) => sl.value > 0.004);
    const ringTotal = ringSlices.reduce((a, sl) => a + sl.value, 0);
    const balancePoints: BalancePoint[] = [{ year: 0, balance: r.loanAmount, interest: 0, label: 'Loan start' }];
    let cumInterest = 0;
    r.yearly.forEach((yr) => {
      cumInterest += yr.interest;
      balancePoints.push({ year: yr.year, balance: yr.endBalance, interest: cumInterest, label: formatMonthYear(yr.endDate, loc) });
    });
    const heroText = fmt2(r.scheduledPayment);
    const totalText = fmt2(fp.total);

    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springConfig}
        className="space-y-5"
        role="region"
        aria-label="Mortgage results"
      >
        <p className="sr-only" role="status">
          Result updated. Monthly payment {fmt2(r.scheduledPayment)}. Loan amount {fmt0(r.loanAmount)}. Total interest {fmt0(r.totals.interest)}. Paid off in {formatMonthYear(r.payoff.date, loc)}.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
            Your Mortgage Results
          </h3>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {renderDownloadButtons()}
          </div>
        </div>

        {/* HERO: monthly payment */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-900/10"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #0f766e 100%)' }}
        >
          <div className="pointer-events-none absolute -top-14 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-teal-300/20 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
              Monthly payment · principal &amp; interest
            </p>
            <div className="mt-2 w-full" style={{ containerType: 'inline-size' }}>
              <AnimatedAmount
                value={r.scheduledPayment}
                format={fmt2}
                className="block w-full font-extrabold tabular-nums tracking-tight leading-tight whitespace-nowrap drop-shadow-sm"
                style={fitNumberStyle(heroText, 3.5, 1.5)}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-white/80">
              {inputs.annualRatePct}% interest · {inputs.termYears}-year term · {REGION_PROFILES[r.region].label}
              {r.region === 'CA' ? ' · semi-annual compounding' : ''}
            </p>

            {hasCostsInResult && (
              <div className="mt-5 pt-4 border-t border-white/20">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
                  Total monthly payment (first month)
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight break-words">{totalText}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {parts.map((p) => (
                    <div key={p.label} className="min-w-0 rounded-xl bg-white/15 px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">{p.label}</span>
                      <span className="block text-sm font-bold tabular-nums break-words">{fmt2(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RESULT CARDS */}
        <ResultCard>
          <SectionHeader
            icon={FiLayers}
            title="Loan Summary"
            subtitle="Principal and interest over the full loan term."
            tip="Totals cover the loan itself (principal and interest). Taxes and other costs you add are shown separately in the monthly total."
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile tone="emerald" icon={FiHome} value={fmt0(r.loanAmount)} label="Loan amount" sub={`${r.downPaymentPct}% down`} />
            <StatTile tone="rose" icon={FiPercent} value={fmt0(r.totals.interest)} label="Total interest" />
            <StatTile tone="sky" icon={FiLayers} value={fmt0(r.totals.principalAndInterestPaid)} label="Total of payments" sub="Principal + interest" />
            <StatTile tone="amber" icon={FiCalendar} value={formatMonthYear(r.payoff.date, loc)} label="Payoff date" sub={formatDuration(r.payoff.months)} />
          </div>
          {r.totals.outOfPocket - r.totals.principalAndInterestPaid > 0.004 && (
            <p className="mt-4 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
              Including the taxes and costs you entered, the full cost over the loan comes to about{' '}
              <span className={`font-bold ${ACCENT.text}`}>{fmt0(r.totals.outOfPocket)}</span>.
            </p>
          )}
          {r.warnings.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {r.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </ResultCard>

        {/* EXTRA PAYMENT SAVINGS */}
        {r.savings && (
          <ResultCard>
            <SectionHeader
              icon={FiZap}
              title="What Your Extra Payments Save"
              subtitle="Compared with the same loan and no extras."
              tip="Savings compare this loan with the same loan paid on schedule. Interest saved is what you no longer pay the lender."
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <StatTile tone="emerald" icon={FiPercent} value={fmt0(r.savings.interestSaved)} label="Interest saved" />
              <StatTile tone="sky" icon={FiCalendar} value={formatDuration(r.savings.monthsSaved)} label="Paid off sooner" maxRem={1.5} />
              <StatTile tone="amber" icon={FiHome} value={formatMonthYear(r.payoff.date, loc)} label="New payoff date" sub={`${r.payoff.periods} payments`} />
              <StatTile tone="violet" icon={FiLayers} value={fmt0(r.savings.extraPaidTotal)} label="Extras you pay" />
            </div>
            <p className="mt-4 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
              With no extras this loan would take {formatDuration((r.savings.baselinePeriods * 12) / r.periodsPerYear)} ({r.savings.baselinePeriods} payments) and
              cost {fmt0(r.savings.baselineInterest)} in interest. With them it takes {formatDuration(r.payoff.months)} and costs {fmt0(r.totals.interest)}.
            </p>
          </ResultCard>
        )}

        {/* PMI TIMELINE (US only, when a PMI cost was entered) */}
        {inputs.region === 'US' && inputs.pmi && (
          <ResultCard>
            <SectionHeader
              icon={FiShield}
              title="When PMI Ends"
              subtitle="Private mortgage insurance on a small down payment."
              tip="PMI is charged while your balance is high compared with the home's original value. Once it falls to 80% you can usually ask to drop it, and it should end automatically near 78%."
            />
            <PmiTimeline result={r} inputs={inputs} />
          </ResultCard>
        )}

        {/* BREAKDOWN RING */}
        <ResultCard>
          <SectionHeader
            icon={FiPieChart}
            title="Where Your Money Goes"
            subtitle="Everything you pay over the life of the loan."
            tip="Principal is the amount you borrow. Interest is the cost of borrowing it. Any taxes and costs you entered are included. Tap a row to highlight it."
          />
          <BreakdownRing
            slices={ringSlices}
            centerLabel="Total cost"
            centerValue={compactMoney(ringTotal, loc, cur)}
            fmt={fmt0}
          />
        </ResultCard>

        {/* BALANCE CHART */}
        <ResultCard>
          <SectionHeader
            icon={FiTrendingDown}
            title="Balance Over Time"
            subtitle="How the loan shrinks while interest adds up."
            tip="Early payments are mostly interest, so the balance falls slowly at first and faster later."
          />
          <BalanceChart points={balancePoints} locale={loc} currency={cur} fmt={fmt0} />
        </ResultCard>

        {/* COMPARE PANEL */}
        <ResultCard>
          <SectionHeader
            icon={FiBarChart2}
            title="Compare Ways To Pay Off Faster"
            subtitle="Extra payments, both biweekly styles, a shorter term and a recast, side by side."
            tip="Half-monthly biweekly pays 13 monthly payments a year, so it finishes sooner. True biweekly keeps the same term. Set your extra payment, shorter term or recast in the Extra payments section above."
          />
          <ComparePanel key={inputs.region} inputs={inputs} options={committed.compare} />
        </ResultCard>

        {/* YEARLY SCHEDULE */}
        <ResultCard>
          <SectionHeader
            icon={FiList}
            title="Payment Schedule"
            subtitle="Year by year. Tap a year to see each payment."
            tip="Principal and interest only. Taxes and other costs are shown as a yearly total inside each year."
          />
          <YearlySchedule result={r} />
        </ResultCard>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <style>{selectOptionThemeCSS}</style>

      {/* INPUT CARD */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Loan Details</h3>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              <SafeIcon icon={FiHome} className="w-3 h-3" />
              US · India · Canada
            </span>
          </div>

          {errors.form && (
            <p role="alert" className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
              <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
              {errors.form}
            </p>
          )}

          {/* Region */}
          <div>
            <div className={fieldLabelRowClass}>
              <span className={fieldLabelClass}>Region</span>
              <InfoTip text="Sets the currency, number format, loan-term limit and interest convention used in the calculation." />
            </div>
            <SegmentedToggle<RegionCode>
              value={region}
              onChange={handleRegionChange}
              groupId={`${uid}-region`}
              ariaLabel="Region"
              options={REGION_OPTIONS}
            />
            <FieldError id={`${uid}-region-err`} message={errors.region} />
          </div>

          {/* One grid for all loan fields: price + down payment, term + rate, then First payment under Loan term.
              One grid keeps every row gap identical and every column the same width. */}
          <div style={FIELD_GRID_STYLE}>
            {/* Home price */}
            <div>
              <FieldLabel
                htmlFor={`${uid}-price`}
                reserve
                label="Home price"
                tip="The full purchase price of the property, before your down payment."
              />
              <NumField
                id={`${uid}-price`}
                value={price}
                onChange={(v) => { setPrice(v); clearErr('homePrice', 'downPayment'); setTouched(true); }}
                prefix={sym}
                grouped
                locale={profile.locale}
                maxDecimals={0}
                placeholder="0"
                error={Boolean(errors.homePrice)}
                describedBy={errors.homePrice ? `${uid}-price-err` : undefined}
              />
              <FieldError id={`${uid}-price-err`} message={errors.homePrice} />
              {!errors.homePrice && region === 'IN' && priceNum >= 1e5 && (
                <p className={hintClass}>{sym}{indianWords(priceNum)}</p>
              )}
            </div>

            {/* Down payment */}
            <UnitField
              id={`${uid}-down`}
              label="Down payment"
              tip="Enter it as a percentage of the price or as an amount. Switching the unit converts your entry, and the other figure is shown below."
              groupId={`${uid}-down-mode`}
              percentSuffix="%"
              mode={downMode}
              onModeChange={handleDownModeChange}
              sym={sym}
              value={down}
              onChange={(v) => { setDown(v); clearErr('downPayment'); setTouched(true); }}
              locale={profile.locale}
              modeAriaLabel="Down payment entry type"
              error={errors.downPayment}
            />

            {/* Term */}
            <div className="min-w-0">
              <div className={fieldLabelRowClass}>
                <label htmlFor={`${uid}-term`} className={fieldLabelClass}>Loan term</label>
                <InfoTip text={`Length of the loan. The maximum for ${profile.label} in this calculator is ${profile.maxTermYears} years.`} />
              </div>
              <NumField
                id={`${uid}-term`}
                value={term}
                onChange={(v) => { setTerm(v); clearErr('termYears'); setTouched(true); }}
                suffix="years"
                maxDecimals={0}
                maxInt={2}
                placeholder="0"
                error={Boolean(errors.termYears)}
                describedBy={errors.termYears ? `${uid}-term-err` : undefined}
              />
              <FieldError id={`${uid}-term-err`} message={errors.termYears} />
            </div>

            <div className="min-w-0">
              <div className={fieldLabelRowClass}>
                <label htmlFor={`${uid}-rate`} className={fieldLabelClass}>Interest rate</label>
                <InfoTip text="Yearly interest rate. Enter the rate your lender quotes you." />
              </div>
              <NumField
                id={`${uid}-rate`}
                value={rate}
                onChange={(v) => { setRate(v); clearErr('annualRatePct'); setTouched(true); }}
                suffix="% / yr"
                maxDecimals={3}
                maxInt={2}
                placeholder="0"
                error={Boolean(errors.annualRatePct)}
                describedBy={errors.annualRatePct ? `${uid}-rate-err` : undefined}
              />
              <FieldError id={`${uid}-rate-err`} message={errors.annualRatePct} />
              {!errors.annualRatePct && region === 'CA' && (
                <p className={hintClass}>Canada is calculated with semi-annual compounding.</p>
              )}
            </div>

            {/* First payment: same column width as Loan term, month wider than year */}
            <div className="min-w-0">
              <div className={fieldLabelRowClass}>
                <span className={fieldLabelClass}>First payment</span>
                <InfoTip text="The month of your first payment. It decides the payoff date shown in your results." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', columnGap: '0.75rem', alignItems: 'start' }}>
                <div className="min-w-0">
                  <div className="relative">
                    <select
                      id={`${uid}-month`}
                      aria-label="Start month"
                      value={startMonth}
                      onChange={(e) => { setStartMonth(Number(e.target.value)); clearErr('startMonth'); setTouched(true); }}
                      className={selectShellClass}
                    >
                      {monthNames.map((name, i) => (
                        <option key={name} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  </div>
                  <FieldError id={`${uid}-month-err`} message={errors.startMonth} />
                </div>
                <div className="min-w-0">
                  <NumField
                    id={`${uid}-year`}
                    value={startYear}
                    onChange={(v) => { setStartYear(v); clearErr('startYear'); setTouched(true); }}
                    maxDecimals={0}
                    maxInt={4}
                    ariaLabel="Start year"
                    placeholder="Year"
                    error={Boolean(errors.startYear)}
                    describedBy={errors.startYear ? `${uid}-year-err` : undefined}
                  />
                  <FieldError id={`${uid}-year-err`} message={errors.startYear} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAXES & COSTS (collapsed by default) */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <button
          type="button"
          onClick={() => setCostsOpen((o) => !o)}
          aria-expanded={costsOpen}
          aria-controls={`${uid}-costs-panel`}
          className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 md:px-8 text-left cursor-pointer rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <span className="flex items-start gap-2.5 min-w-0">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
              <SafeIcon icon={FiSliders} className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-7 text-neutral-900 dark:text-white">Taxes &amp; costs</span>
              <span className="block -mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Optional: add property tax, insurance, HOA{profile.supportsPmi ? ' and PMI' : ''} to see your full monthly cost.
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {filledCostCount > 0 && (
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap tabular-nums bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-full border border-indigo-200/70 dark:border-indigo-800/50">
                {filledCostCount} added
              </span>
            )}
            <SafeIcon
              icon={FiChevronDown}
              className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${costsOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {costsOpen && (
            <motion.div
              id={`${uid}-costs-panel`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-6 sm:px-6 md:px-8 md:pb-8 space-y-8 border-t border-neutral-100 dark:border-neutral-700/60 pt-6">
                <div style={FIELD_GRID_STYLE}>
                  {COST_KEYS.map(renderCostRow)}
                </div>

                {COST_KEYS.some((k) => costs[k].value.trim() !== '') && (
                  <div>
                    <div className={fieldLabelRowClass}>
                      <span className={fieldLabelClass}>Expected yearly increase</span>
                      <InfoTip text="Optional. How much each cost you entered is expected to rise every year. It is applied from year 2 onward. Leave blank for no increase." widthClass="w-64" />
                    </div>
                    <div style={FIELD_GRID_STYLE}>
                      {COST_KEYS.filter((k) => costs[k].value.trim() !== '').map((k) => (
                        <div key={k} className="min-w-0">
                          <label htmlFor={`${uid}-inc-${k}`} className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">{COST_META[k].label}</label>
                          <NumField
                            id={`${uid}-inc-${k}`}
                            value={incr[k]}
                            onChange={(v) => { setIncr((prev) => ({ ...prev, [k]: v })); clearErr(`${k}Increase`); setTouched(true); }}
                            suffix="% / yr"
                            maxDecimals={2}
                            maxInt={2}
                            placeholder="0"
                            error={Boolean(errors[`${k}Increase`])}
                            describedBy={errors[`${k}Increase`] ? `${uid}-inc-${k}-err` : undefined}
                          />
                          <FieldError id={`${uid}-inc-${k}-err`} message={errors[`${k}Increase`]} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.supportsPmi && (
                  <div className="pt-8 border-t border-neutral-100 dark:border-neutral-700/60 space-y-5">
                    <div>
                      <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white">Mortgage insurance</h4>
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Usually required in the US when your down payment is under 20%.</p>
                    </div>
                    <div style={FIELD_GRID_STYLE}>
                      <UnitField
                        id={`${uid}-pmi`}
                        label="PMI"
                        tip="Private mortgage insurance. Enter your lender's quote, as a % of the loan per year or an amount per year. Leave blank if you don't pay PMI."
                        groupId={`${uid}-pmi-mode`}
                        percentSuffix="% / yr"
                        amountSuffix="/ yr"
                        mode={pmi.mode}
                        onModeChange={handlePmiMode}
                        sym={sym}
                        value={pmi.value}
                        onChange={(v) => { setPmi((p) => ({ ...p, value: v })); clearErr('pmi'); setTouched(true); }}
                        locale={profile.locale}
                        modeAriaLabel="PMI entry type"
                        error={errors.pmi}
                      />
                      <div className="min-w-0">
                        <FieldLabel
                          reserve
                          label="Stop charging PMI at"
                          tip="80% means when your balance reaches 80% of the original home value (you ask your lender to remove it). 78% means the point your original schedule reaches 78% (automatic)."
                          tipWidth="w-64"
                          tipAlign="end"
                        />
                        <SegmentedToggle<'request80' | 'auto78'>
                          size="field"
                          value={pmi.dropAt}
                          onChange={(d) => { setPmi((p) => ({ ...p, dropAt: d })); setTouched(true); }}
                          groupId={`${uid}-pmi-drop`}
                          ariaLabel="PMI end rule"
                          options={[{ value: 'request80', label: '80% (request)' }, { value: 'auto78', label: '78% (auto)' }]}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* EXTRA PAYMENTS (collapsed by default) */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <button
          type="button"
          onClick={() => setExtrasOpen((o) => !o)}
          aria-expanded={extrasOpen}
          aria-controls={`${uid}-extras-panel`}
          className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 md:px-8 text-left cursor-pointer rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <span className="flex items-start gap-2.5 min-w-0">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
              <SafeIcon icon={FiZap} className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-7 text-neutral-900 dark:text-white">Extra payments</span>
              <span className="block -mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Optional: pay extra every month, once a year or as a lump sum to see how much sooner you finish.
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {filledExtraCount > 0 && (
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap tabular-nums bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-full border border-indigo-200/70 dark:border-indigo-800/50">
                {filledExtraCount} added
              </span>
            )}
            <SafeIcon icon={FiChevronDown} className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${extrasOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {extrasOpen && (
            <motion.div
              id={`${uid}-extras-panel`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-6 sm:px-6 md:px-8 md:pb-8 space-y-8 border-t border-neutral-100 dark:border-neutral-700/60 pt-6">
                {/* Monthly */}
                <div style={FIELD_GRID_STYLE}>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <label htmlFor={`${uid}-ex-m`} className={`${fieldLabelClass} truncate`}>Extra every month</label>
                        <InfoTip text="An extra amount paid on top of your regular payment, every month. It goes straight to the loan balance." />
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium text-neutral-400 dark:text-neutral-500 whitespace-nowrap">per month</span>
                    </div>
                    <NumField
                      id={`${uid}-ex-m`}
                      value={exMonthly}
                      onChange={(v) => { setExMonthly(v); clearErr('extraMonthly'); setTouched(true); }}
                      prefix={sym}
                      grouped
                      locale={profile.locale}
                      maxDecimals={2}
                      placeholder="0"
                      error={Boolean(amountErr(errors.extraMonthly))}
                      describedBy={amountErr(errors.extraMonthly) ? `${uid}-ex-m-err` : undefined}
                    />
                    <FieldError id={`${uid}-ex-m-err`} message={amountErr(errors.extraMonthly)} />
                    {!errors.extraMonthly && Number(exMonthly) > 0 && (
                      <p className={hintClass}>About {money(Number(exMonthly) * 12)} extra per year</p>
                    )}
                  </div>
                  <MonthYearField
                    id={`${uid}-ex-m-start`}
                    label="Starting from"
                    tip="The month your extra payments begin. It starts at your first payment month; pick a later month and year if the extra payments begin after a while."
                    month={resolveYM(exMonthlyStart).month}
                    year={resolveYM(exMonthlyStart).year}
                    monthNames={monthNames}
                    onMonth={(m) => { setExMonthlyStart({ month: m, year: resolveYM(exMonthlyStart).year }); clearErr('extraMonthly'); setTouched(true); }}
                    onYear={(y) => { setExMonthlyStart({ month: resolveYM(exMonthlyStart).month, year: y }); clearErr('extraMonthly'); setTouched(true); }}
                    error={dateErr(errors.extraMonthly)}
                  />
                </div>

                {/* Yearly */}
                <div style={FIELD_GRID_STYLE}>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <label htmlFor={`${uid}-ex-y`} className={`${fieldLabelClass} truncate`}>Extra once a year</label>
                        <InfoTip text="A yearly extra payment, such as from a bonus or tax refund." />
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium text-neutral-400 dark:text-neutral-500 whitespace-nowrap">per year</span>
                    </div>
                    <NumField
                      id={`${uid}-ex-y`}
                      value={exYearly}
                      onChange={(v) => { setExYearly(v); clearErr('extraYearly'); setTouched(true); }}
                      prefix={sym}
                      grouped
                      locale={profile.locale}
                      maxDecimals={2}
                      placeholder="0"
                      error={Boolean(amountErr(errors.extraYearly))}
                      describedBy={amountErr(errors.extraYearly) ? `${uid}-ex-y-err` : undefined}
                    />
                    <FieldError id={`${uid}-ex-y-err`} message={amountErr(errors.extraYearly)} />
                  </div>
                  <MonthYearField
                    id={`${uid}-ex-y-start`}
                    label="Starting from"
                    tip="The month and year of the first yearly extra payment. It then repeats every year in the same month."
                    month={resolveYM(exYearlyStart).month}
                    year={resolveYM(exYearlyStart).year}
                    monthNames={monthNames}
                    onMonth={(m) => { setExYearlyStart({ month: m, year: resolveYM(exYearlyStart).year }); clearErr('extraYearly'); setTouched(true); }}
                    onYear={(y) => { setExYearlyStart({ month: resolveYM(exYearlyStart).month, year: y }); clearErr('extraYearly'); setTouched(true); }}
                    error={dateErr(errors.extraYearly)}
                  />
                </div>

                {/* One-time */}
                <div className="pt-8 border-t border-neutral-100 dark:border-neutral-700/60">
                  <div className={fieldLabelRowClass}>
                    <span className={fieldLabelClass}>One-time payments</span>
                    <InfoTip text="Lump sums paid once, such as an inheritance or a sale. Choose the month and year each one is paid." />
                  </div>
                  {oneTimes.length > 0 && (
                    <div className="space-y-4">
                      {oneTimes.map((o, i) => {
                        const mNum = loanMonthOf(o.when);
                        const termMonths = Math.round((parseNum(term) || 0) * 12);
                        return (
                          <div key={o.id} className="min-w-0 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/70 bg-neutral-50/60 dark:bg-neutral-900/20 p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Payment {i + 1}</span>
                              <button
                                type="button"
                                aria-label={`Remove one-time payment ${i + 1}`}
                                onClick={() => { setOneTimes((prev) => prev.filter((x) => x.id !== o.id)); clearErr('extraOneTime'); }}
                                className="inline-flex items-center gap-1 px-2 py-1 -mr-1 rounded-lg text-xs font-semibold text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                              >
                                <SafeIcon icon={FiX} className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                            <div style={FIELD_GRID_STYLE}>
                              <div className="min-w-0">
                                <label htmlFor={`${uid}-ot-a-${o.id}`} className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">Amount</label>
                                <NumField
                                  id={`${uid}-ot-a-${o.id}`}
                                  value={o.amount}
                                  onChange={(v) => { setOneTimes((prev) => prev.map((x) => (x.id === o.id ? { ...x, amount: v } : x))); clearErr('extraOneTime'); setTouched(true); }}
                                  prefix={sym}
                                  grouped
                                  locale={profile.locale}
                                  maxDecimals={2}
                                  placeholder="0"
                                  error={Boolean(amountErr(errors.extraOneTime))}
                                />
                              </div>
                              <MonthYearField
                                id={`${uid}-ot-${o.id}`}
                                label="Paid in"
                                compactLabel
                                tip="The month and year this lump sum is paid."
                                month={resolveYM(o.when).month}
                                year={resolveYM(o.when).year}
                                monthNames={monthNames}
                                onMonth={(m) => { setOneTimes((prev) => prev.map((x) => (x.id === o.id ? { ...x, when: { month: m, year: resolveYM(x.when).year } } : x))); clearErr('extraOneTime'); setTouched(true); }}
                                onYear={(y) => { setOneTimes((prev) => prev.map((x) => (x.id === o.id ? { ...x, when: { month: resolveYM(x.when).month, year: y } } : x))); clearErr('extraOneTime'); setTouched(true); }}
                              />
                            </div>
                            {mNum >= 1 && mNum > termMonths && (
                              <p className={hintClass}>This is after your loan would end, so it will have no effect.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <FieldError id={`${uid}-ex-ot-err`} message={errors.extraOneTime} />
                  {oneTimes.length < MAX_ONE_TIME && (
                    <button
                      type="button"
                      onClick={() => { setOneTimes((prev) => [...prev, { id: oneTimeId.current++, amount: '', when: null }]); setTouched(true); }}
                      className={`${oneTimes.length > 0 ? 'mt-4' : ''} inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60`}
                    >
                      <SafeIcon icon={FiPlus} className="w-4 h-4" />
                      Add a one-time payment
                    </button>
                  )}
                </div>

                {/* Compare options: only feed the Compare section of the results */}
                <div className="pt-8 border-t border-neutral-100 dark:border-neutral-700/60">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-extrabold text-neutral-900 dark:text-white">Compare options</span>
                    <InfoTip text="Optional. These only feed the Compare Ways To Pay Off Faster section in your results. They do not change your main result." />
                  </div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-5">
                    Optional. Add a lump sum with a recast, or a shorter term, to compare them in your results.
                  </p>
                  <div style={FIELD_GRID_STYLE}>
                    <div className="min-w-0">
                      <div className={fieldLabelRowClass}>
                        <label htmlFor={`${uid}-cr`} className={`${fieldLabelClass} truncate`}>Lump sum + recast</label>
                        <InfoTip text="A one-time lump sum, after which the payment is recalculated over the same remaining term. The payoff date stays the same but the payment drops. Leave blank to skip." widthClass="w-64" />
                      </div>
                      <NumField
                        id={`${uid}-cr`}
                        value={cmpRecast}
                        onChange={(v) => { setCmpRecast(v); clearErr('compareRecast'); setTouched(true); }}
                        prefix={sym}
                        grouped
                        locale={profile.locale}
                        maxDecimals={0}
                        placeholder="0"
                      />
                    </div>
                    <MonthYearField
                      id={`${uid}-cr-at`}
                      label="Recast in"
                      tip="The month and year the lump sum is paid. If you leave it, it is five years into the loan. FHA, VA and USDA loans generally cannot be recast."
                      month={resolveRecastYM().month}
                      year={resolveRecastYM().year}
                      monthNames={monthNames}
                      onMonth={(m) => { setCmpRecastAt({ month: m, year: resolveRecastYM().year }); clearErr('compareRecast'); setTouched(true); }}
                      onYear={(y) => { setCmpRecastAt({ month: resolveRecastYM().month, year: y }); clearErr('compareRecast'); setTouched(true); }}
                      error={errors.compareRecast}
                    />
                    <div className="min-w-0">
                      <div className={fieldLabelRowClass}>
                        <label htmlFor={`${uid}-cs`} className={`${fieldLabelClass} truncate`}>Shorter term</label>
                        <InfoTip text="Shows what a shorter loan would cost at the same interest rate. Lenders may charge a different rate for a different term. Leave blank to skip." />
                      </div>
                      <NumField
                        id={`${uid}-cs`}
                        value={cmpShorter}
                        onChange={(v) => { setCmpShorter(v); setTouched(true); }}
                        suffix="years"
                        maxDecimals={0}
                        maxInt={2}
                        placeholder="0"
                      />
                      {parseNum(cmpShorter) >= 1 && parseNum(term) > 0 && parseNum(cmpShorter) >= parseNum(term) && (
                        <p className={hintClass}>Needs to be shorter than your loan term to be compared.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasError && !errors.form && (
        <p role="alert" className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0" />
          Please fix the highlighted fields, then press Calculate again.
        </p>
      )}

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
      {!committed && !hasError && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20"
        >
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <path d="M14 48 L50 18 L86 48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 42 V80 H76 V42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="42" y="56" width="16" height="24" rx="2" stroke="currentColor" strokeWidth="4" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">
            Your Results Will Appear Here
          </h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Fill in the loan details above, then press Calculate to see your monthly payment, total interest and payoff date.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {!hasError && renderResults()}

      {renderShareBar()}

      {/* DISCLAIMER (always visible) */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator gives estimates for planning and learning only. It is not financial, legal or tax advice, and it is not a loan offer or lender quote. The pre-filled interest rate is an example, not a current or offered rate. Real payments depend on your lender&apos;s terms, how it rounds and applies payments, fees, and local rules, and tax or insurance amounts you enter may change over time. Please confirm the details with your lender or a qualified adviser before you decide.
        </p>
      </div>

      {/* SOURCES ACCORDION */}
      <div
        ref={sourcesPanelRef}
        style={sourcesPulse ? { boxShadow: '0 0 0 3px rgba(16,185,129,0.35)' } : undefined}
        className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300"
      >
        <button
          type="button"
          onClick={toggleSources}
          aria-expanded={showSources}
          aria-controls={`${uid}-sources-panel`}
          className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources &amp; method</span>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">
                {DISPLAY_SOURCES.length} references. Last reviewed {new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${MORTGAGE_LAST_REVIEWED}T00:00:00Z`))}.
              </span>
            </div>
          </div>
          <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${showSources ? 'rotate-180' : ''}`}>
            <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
          </span>
        </button>
        <motion.div
          id={`${uid}-sources-panel`}
          initial={false}
          animate={{ height: showSources ? 'auto' : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
          aria-hidden={!showSources}
        >
          <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
            <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {DISPLAY_SOURCES.map((source, i) => (
                <li key={source.id} className="flex gap-3 pt-4 first:pt-0">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 break-words">{source.title}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                      {SOURCE_REGION_TAG[source.id] ?? 'General'}
                    </span>
                    <p className="leading-relaxed mt-1.5 text-neutral-600 dark:text-neutral-400">{source.note}</p>
                    {source.url && source.status === 'verified' && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        tabIndex={showSources ? 0 : -1}
                        className="group inline-flex items-center gap-1.5 mt-2.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold text-[13px] focus:outline-none focus-visible:underline"
                      >
                        <span className="underline-offset-2 group-hover:underline">View source</span>
                        <SafeIcon icon={FiExternalLink} className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="pt-4 mt-4 border-t border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-2">
              <p>
                <strong className="text-neutral-700 dark:text-neutral-300">How it is calculated:</strong> each payment is the standard loan formula applied to your balance.
                Interest, principal and costs are rounded to the cent every period, and the final payment clears whatever balance is left.
                Extra payments reduce the balance after the scheduled payment and never go above what is owed.
              </p>
              <p>
                Biweekly figures use two methods (half the monthly payment, or true biweekly), and lenders handle both in different ways, so treat them as estimates.
                No live rates are used. Nothing here is a lender listing or a recommendation.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MortgageCalculator;
