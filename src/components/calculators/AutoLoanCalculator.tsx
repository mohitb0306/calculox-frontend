"use client";

/**
 * AutoLoanCalculator.tsx  (PART 1 of 2)
 *
 * PART 1 holds: imports, the preset type, small shared UI pieces, number-field helpers,
 * the scoped stylesheet and every RESULT card (hero, summary, receipt, warnings, ring,
 * balance chart, term comparison, extra-payment savings, schedule).
 * PART 2 holds: the Sources panel and the main calculator component (state, form, report).
 *
 * Paste PART 2 directly under the last line of this part. Do not change anything in between.
 */

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  calculateAutoLoan,
  compareTerms,
  validateAutoLoanInputs,
  flatToReducingApr,
  AUTO_REGION_PROFILES,
  AUTO_LOAN_SOURCES,
  AUTO_LOAN_LAST_REVIEWED,
  MAX_AUTO_APR_PCT,
  TERM_COMPARE_MONTHS,
  LONG_TERM_MONTHS,
} from '@/utils/calculators/autoLoanLogic';
import type {
  AutoLoanInputs,
  AutoLoanResult,
  AutoLoanWarning,
  AutoLoanSource,
  AutoScheduleRow,
  AutoYearRow,
  AutoSavings,
  BreakdownLine,
  TermComparisonRow,
} from '@/utils/calculators/autoLoanLogic';
import type { RegionCode } from '@/utils/calculators/mortgageLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiTruck, FiPercent, FiCalendar, FiLayers, FiChevronDown, FiAlertCircle, FiAlertTriangle, FiInfo,
  FiRotateCcw, FiCheckCircle, FiSliders, FiPieChart, FiTrendingDown, FiList, FiPlus, FiZap,
  FiBarChart2, FiFileText, FiExternalLink, FiArrowDown, FiClock, FiDollarSign,
  FiDownload, FiLoader, FiImage, FiShare2, FiMail, FiCopy, FiCheck,
} = FiIcons;

/**
 * Landing-page preset (used by Registry aliases). Only changes the STARTING state of the
 * form. It never pre-fills a number, so every field still starts empty.
 * `mode: 'affordability'` is accepted now but only takes effect in Phase 4.
 */
export interface AutoLoanPreset {
  region?: RegionCode;
  openExtras?: boolean;
  openTradeIn?: boolean;
  mode?: 'payment' | 'affordability';
  rateType?: 'reducing' | 'flat';
}

interface AutoLoanCalculatorProps {
  preset?: AutoLoanPreset;
  onReportChange?: (report: ShareableReport | null) => void;
  /** Phase 3: supplied by the calculator page (same props the Mortgage calculator receives). */
  onCalculationComplete?: () => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

type AmountMode = 'percent' | 'amount';

// --- ACCENT --- inputs use the same indigo as the sibling calculators; results use an orange accent so Auto Loan looks different from the green Mortgage results.
const ACCENT = {
  hex: '#ea580c',
};

const fieldLabelClass = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';
const fieldLabelRowClass = 'flex items-center gap-1.5 mb-2';
const hintClass = 'text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1.5';
const noSpinnerClass = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ---------------------------------------------------------------------------
// Accessible info tooltip (same contract as the Mortgage and sibling calculators)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Segmented toggle (indigo pill, same contract as Mortgage). Sizes are inline for the xs switch.
// ---------------------------------------------------------------------------
interface SegmentedToggleOption<T extends string> { value: T; label: string; }

const XS_TRACK_STYLE: React.CSSProperties = {
  padding: 3,
  boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.14), inset 0 0 0 1px rgba(255,255,255,0.03)',
};
const XS_BUTTON_STYLE: React.CSSProperties = {
  height: 24, minWidth: 40, paddingLeft: 12, paddingRight: 12, fontSize: 12.5, lineHeight: '24px', letterSpacing: '0.02em',
};
const XS_PILL_STYLE: React.CSSProperties = {
  background: '#6366f1',
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
                className={`absolute inset-0 rounded-full ${isXs ? '' : 'bg-indigo-500 shadow-[0_2px_10px_-1px_rgba(99,102,241,0.55)]'}`}
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

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
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

const compactMoney = (n: number, locale: string, currency: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);

const formatMonthYear = (year: number, month: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));

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

const termLabel = (months: number): string =>
  months % 12 === 0 ? `${months} months (${months / 12} ${months === 12 ? 'year' : 'years'})` : `${months} months`;

// Sizes a number to fit its container at any width (the wrapper is a size container; cqw = 1% of its width).
const fitNumberStyle = (text: string, maxRem: number, minRem = 1.25): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(70 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// ---------------------------------------------------------------------------
// Number input helpers. Money fields group by locale while typing (India = lakh) and keep the caret.
// ---------------------------------------------------------------------------
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

const groupDisplay = (raw: string, locale: string): string => {
  if (!raw) return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(intPart || '0'));
  return dot === -1 ? grouped : `${grouped}.${raw.slice(dot + 1)}`;
};

const parseNum = (s: string): number => (s.trim() === '' ? NaN : Number(s));

// Converts a typed value between "% of base" and "amount" when a unit switch flips.
const convertAmount = (raw: string, from: AmountMode, to: AmountMode, base: number): string => {
  if (raw.trim() === '' || !(base > 0)) return raw;
  const v = Number(raw);
  if (!Number.isFinite(v)) return raw;
  if (from === 'percent' && to === 'amount') return trimNum((v * base) / 100, 2);
  if (from === 'amount' && to === 'percent') return trimNum((v / base) * 100, 3);
  return raw;
};

const NumField: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  grouped?: boolean;
  locale?: string;
  maxDecimals?: number;
  maxInt?: number;
  error?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  describedBy?: string;
}> = ({
  id, value, onChange, prefix, suffix, grouped = false, locale = 'en-US',
  maxDecimals = 2, maxInt = 13, error, placeholder, ariaLabel, describedBy,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);
  const display = grouped ? groupDisplay(value, locale) : value;

  // Restores the caret after re-grouping so typing in the middle of a number never jumps to the end.
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

  const chipClass = 'flex items-center justify-center flex-shrink-0 rounded-lg text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-700/70 whitespace-nowrap';
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
        <span className={chipClass} style={{ ...chipBox, marginLeft: 6, minWidth: 40, fontSize: 14 }} aria-hidden="true">
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
      {suffix && <span className={chipClass} style={{ ...chipBox, marginRight: 6 }}>{suffix}</span>}
    </div>
  );
};

// Label row: label + info tip on the left, optional control (for example the % / currency switch) on the right.
// Small "(optional)" note after a label or card title. Only optional items are marked; required ones carry no tag.
type FieldTagKind = 'optional';
const FieldTag: React.FC<{ kind: FieldTagKind }> = () => (
  <span
    className="text-neutral-500 dark:text-neutral-400"
    style={{ flexShrink: 0, fontSize: 12, lineHeight: '16px', fontWeight: 500, whiteSpace: 'nowrap' }}
  >
    (optional)
  </span>
);

const FieldLabel: React.FC<{
  htmlFor?: string;
  label: string;
  tip: string;
  right?: React.ReactNode;
  reserve?: boolean;
  tipAlign?: 'center' | 'start' | 'end';
  tipWidth?: string;
  tag?: FieldTagKind;
}> = ({ htmlFor, label, tip, right, reserve, tipAlign, tipWidth, tag }) => (
  <div className="flex items-center justify-between gap-3 mb-2" style={right || reserve ? { minHeight: 32 } : undefined}>
    <div className="flex items-center gap-1.5 min-w-0">
      {htmlFor
        ? <label htmlFor={htmlFor} className={`${fieldLabelClass} truncate`}>{label}</label>
        : <span className={`${fieldLabelClass} truncate`}>{label}</span>}
      {tag && <FieldTag kind={tag} />}
      <InfoTip text={tip} align={tipAlign} widthClass={tipWidth} />
    </div>
    {right && <div className="flex-shrink-0">{right}</div>}
  </div>
);

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

// One labelled money field: label row, field, error, hint. Used for every plain amount.
const MoneyField: React.FC<{
  id: string;
  label: string;
  tip: string;
  sym: string;
  value: string;
  onChange: (v: string) => void;
  locale: string;
  error?: string;
  hint?: string;
  maxDecimals?: number;
  reserve?: boolean;
  tag?: FieldTagKind;
}> = ({ id, label, tip, sym, value, onChange, locale, error, hint, maxDecimals = 2, reserve, tag }) => (
  <div className="min-w-0">
    <FieldLabel htmlFor={id} label={label} tip={tip} reserve={reserve} tag={tag} />
    <NumField
      id={id}
      value={value}
      onChange={onChange}
      prefix={sym}
      grouped
      locale={locale}
      maxDecimals={maxDecimals}
      placeholder="0"
      error={Boolean(error)}
      describedBy={error ? `${id}-err` : `${id}-hint`}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

// One labelled percent field (suffix chip). Used for tax rate, APR, processing fee and GST.
const PercentField: React.FC<{
  id: string;
  label: string;
  tip: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  error?: string;
  hint?: string;
  maxDecimals?: number;
  reserve?: boolean;
  tag?: FieldTagKind;
}> = ({ id, label, tip, value, onChange, suffix = '%', error, hint, maxDecimals = 3, reserve, tag }) => (
  <div className="min-w-0">
    <FieldLabel htmlFor={id} label={label} tip={tip} reserve={reserve} tag={tag} />
    <NumField
      id={id}
      value={value}
      onChange={onChange}
      suffix={suffix}
      maxDecimals={maxDecimals}
      maxInt={3}
      placeholder="0"
      error={Boolean(error)}
      describedBy={error ? `${id}-err` : `${id}-hint`}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

// Field with the % / currency switch ABOVE the input, on the right (used for the down payment).
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
  error?: string;
  hint?: string;
  tag?: FieldTagKind;
}> = ({ id, label, tip, mode, onModeChange, sym, value, onChange, locale, modeAriaLabel, groupId, error, hint, tag }) => (
  <div className="min-w-0">
    <FieldLabel
      htmlFor={id}
      label={label}
      tip={tip}
      tag={tag}
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
      suffix={mode === 'percent' ? '%' : undefined}
      grouped={mode === 'amount'}
      locale={locale}
      maxDecimals={mode === 'percent' ? 3 : 2}
      placeholder="0"
      error={Boolean(error)}
      describedBy={error ? `${id}-err` : `${id}-hint`}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

// Native <select> option popup theming (same approach as the sibling calculators).
const selectShellClass =
  'alc-native-select w-full appearance-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 cursor-pointer';
const selectOptionThemeCSS = `
  .alc-native-select { color-scheme: light; }
  .dark .alc-native-select { color-scheme: dark; }
  .alc-native-select option { background-color: #ffffff; color: #262626; }
  .dark .alc-native-select option { background-color: #262626; color: #f5f5f5; }
`;

// Month + year picker (month wider than year; sizes inline so layout never depends on generated utilities).
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
  tag?: FieldTagKind;
}> = ({ id, label, tip, month, year, monthNames, onMonth, onYear, error, hint, compactLabel, tag }) => (
  <div className="min-w-0">
    <div className={compactLabel ? 'flex items-center gap-1.5 mb-1.5' : fieldLabelRowClass}>
      <span className={compactLabel ? 'text-xs font-semibold text-neutral-500 dark:text-neutral-400' : fieldLabelClass}>{label}</span>
      {tag && <FieldTag kind={tag} />}
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

// Form grid, inline so it can't be affected by missing utilities. Two columns when the CALCULATOR is wide
// enough (each column >= 18rem), otherwise one. Never more than two columns.
const FIELD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(18rem, calc((100% - 1.5rem) / 2))), 1fr))',
  columnGap: '1.5rem',
  rowGap: '1.75rem',
  alignItems: 'start',
};

// On/off switch with a visible label and a plain-language hint. All sizes are inline.
const ToggleSwitch: React.FC<{
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}> = ({ id, checked, onChange, label, hint }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', columnGap: 16 }}>
    <div className="min-w-0">
      <label htmlFor={id} className={fieldLabelClass} style={{ cursor: 'pointer' }}>{label}</label>
      <p id={`${id}-hint`} className={hintClass} style={{ marginTop: 4 }}>{hint}</p>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={`${id}-hint`}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${checked ? '' : 'bg-neutral-300 dark:bg-neutral-600'}`}
      style={{ width: 44, height: 26, marginTop: 1, background: checked ? '#6366f1' : undefined }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: 999,
          background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 150ms ease',
        }}
      />
    </button>
  </div>
);

// Collapsible input card (Trade-in and rebates, Extra payments).
const CollapseCard: React.FC<{
  id: string;
  icon: IconType;
  title: string;
  subtitle: string;
  badge?: string;
  tag?: FieldTagKind;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, icon, title, subtitle, badge, tag, open, onToggle, children }) => {
  const reduced = useReducedMotion();
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 md:px-8 text-left cursor-pointer rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <span className="flex items-start gap-2.5 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
            <SafeIcon icon={icon} className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-extrabold leading-7 text-neutral-900 dark:text-white">{title}</span>
              {tag && <FieldTag kind={tag} />}
              {badge && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full">{badge}</span>
              )}
            </span>
            <span className="block text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">{subtitle}</span>
          </span>
        </span>
        <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60 text-neutral-400 dark:text-neutral-400 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 sm:px-6 md:px-8 pb-6 md:pb-8" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', rowGap: '1.75rem' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------
const niceStep = (raw: number): number => {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

// Tracks an element's pixel width so the SVG chart is drawn at real size (crisp text, no sideways scroll).
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

// ---------------------------------------------------------------------------
// Scoped stylesheet (.alc-*). Plain CSS so the look never depends on which Tailwind utilities were generated.
// Dark mode follows the site's `.dark` class. Cards react to their own width (container queries).
// ---------------------------------------------------------------------------
const ALC_CSS = `
.alc-hero, .alc-sum { --k1: #0f172a; --k2: #64748b; --line: rgba(15,23,42,.08); --soft: rgba(15,23,42,.035); --bg: #ffffff; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.dark .alc-sum { --k1: #f8fafc; --k2: #9ca3af; --line: rgba(255,255,255,.1); --soft: rgba(255,255,255,.045); --bg: #171b24; }
.alc-hero *, .alc-hero *::before, .alc-hero *::after, .alc-sum *, .alc-sum *::before, .alc-sum *::after { box-sizing: border-box; }
.alc-hero svg, .alc-sum svg { display: block; }
.alc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@keyframes alc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes alc-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes alc-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .alc-hero, .alc-sum, .alc-hero *, .alc-sum * { animation: none !important; transition: none !important; } }

/* ---------- Hero ---------- */
.alc-hero { position: relative; isolation: isolate; overflow: hidden; container-type: inline-size; border-radius: 28px; color: #fff; background: linear-gradient(160deg, #c2410c 0%, #9a3412 58%, #7c2d12 100%); box-shadow: 0 30px 60px -30px rgba(124,45,18,.65), 0 2px 8px rgba(124,45,18,.2); animation: alc-fade .5s ease both; }
.dark .alc-hero { background: linear-gradient(160deg, #9a3412 0%, #7c2d12 58%, #5f240e 100%); box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 34px 70px -34px rgba(0,0,0,.9); }
.alc-hero__glow { position: absolute; z-index: -1; top: -120px; right: -90px; width: 340px; height: 340px; border-radius: 50%; background: rgba(251,146,60,.32); filter: blur(56px); pointer-events: none; }
.alc-hero__in { padding: clamp(20px, 4.6cqi, 34px); display: flex; flex-direction: column; gap: 14px; }
.alc-eyebrow { margin: 0; display: inline-flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; line-height: 1.3; color: #fff; }
.alc-eyebrow i { width: 16px; height: 3px; border-radius: 999px; background: #fde68a; flex: none; }
.alc-amt-wrap { container-type: inline-size; }
.alc-amt { display: block; width: 100%; white-space: nowrap; font-weight: 700; letter-spacing: -.035em; line-height: 1.08; color: #fff; }
.alc-cap { margin: 0; font-size: 14px; line-height: 1.5; font-weight: 500; color: rgba(255,255,255,.8); }
.alc-facts { margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.alc-fact { min-width: 0; padding: 11px 13px; border-radius: 14px; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
.alc-fact dt { font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; line-height: 1.3; color: rgba(255,255,255,.7); }
.alc-fact dd { margin: 3px 0 0; font-size: 15px; font-weight: 800; letter-spacing: -.01em; line-height: 1.25; color: #fff; overflow-wrap: anywhere; }
.alc-fact small { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 600; line-height: 1.35; color: rgba(255,255,255,.72); }
.alc-note { margin: 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.14); font-size: 12px; line-height: 1.5; font-weight: 500; color: rgba(255,255,255,.72); }

/* ---------- Orange accent helpers (sources, share bar) ---------- */
.alc-regtag { color: #c2410c; background: rgba(249,115,22,.12); }
.dark .alc-regtag { color: #fdba74; background: rgba(251,146,60,.16); }
.alc-srclink { color: #c2410c; }
.alc-srclink:hover { color: #9a3412; }
.dark .alc-srclink { color: #fdba74; }
.dark .alc-srclink:hover { color: #fed7aa; }
.alc-linkbtn { color: #c2410c; background: rgba(249,115,22,.1); --tw-ring-color: rgba(249,115,22,.28); }
.alc-linkbtn:hover { background: rgba(249,115,22,.18); }
.dark .alc-linkbtn { color: #fdba74; background: rgba(251,146,60,.12); --tw-ring-color: rgba(251,146,60,.3); }
.dark .alc-linkbtn:hover { background: rgba(251,146,60,.2); }

/* ---------- Card shell ---------- */
.alc-sum { position: relative; isolation: isolate; overflow: hidden; container-type: inline-size; border-radius: 28px; color: #171717; background: var(--bg); box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 4px 12px rgba(15,23,42,.04), 0 28px 56px -30px rgba(194,65,12,.25); animation: alc-fade .5s ease both; }
.dark .alc-sum { color: #fafafa; box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 28px 56px -28px rgba(0,0,0,.78); }
.alc-sum__glow { position: absolute; z-index: -1; pointer-events: none; top: -110px; right: -90px; width: 320px; height: 320px; border-radius: 50%; background: rgba(249,115,22,.12); }
.dark .alc-sum__glow { opacity: .6; }
.alc-sum__in { padding: clamp(18px, 4.2cqi, 28px); }
.alc-sum__head { display: flex; align-items: center; gap: 12px; }
.alc-badge { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 12px; color: #fff; background: #ea580c; box-shadow: inset 0 1px 0 rgba(255,255,255,.38), 0 8px 18px -6px rgba(249,115,22,.55); }
.alc-badge svg { width: 18px; height: 18px; }
.alc-badge--amber { background: #d97706; box-shadow: inset 0 1px 0 rgba(255,255,255,.38), 0 8px 18px -6px rgba(245,158,11,.55); }
.alc-sum__title { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.015em; line-height: 1.25; color: var(--k1); }
.alc-sum__sub { margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; font-weight: 500; color: var(--k2); }
.alc-sum__body { margin-top: clamp(16px, 3.2cqi, 22px); }

/* ---------- Summary tiles ---------- */
.alc-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@container (min-width: 760px) { .alc-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.alc-tile { position: relative; overflow: hidden; container-type: inline-size; min-width: 0; padding: 14px 14px 14px; border-radius: 18px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
.alc-tile::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--tc, #ea580c); opacity: .85; }
.alc-tile__k { font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.3; color: var(--k2); }
.alc-tile__v { display: block; margin-top: 10px; white-space: nowrap; font-weight: 700; letter-spacing: -.025em; line-height: 1.1; color: var(--k1); }
.alc-tile__s { margin-top: 6px; font-size: 12px; line-height: 1.35; font-weight: 600; color: var(--k2); }
.alc-tile--orange { --tc: #ea580c; } .alc-tile--emerald { --tc: #059669; } .alc-tile--rose { --tc: #e11d48; } .alc-tile--sky { --tc: #0284c7; } .alc-tile--amber { --tc: #d97706; }

/* ---------- Receipt ---------- */
.alc-rcpt { list-style: none; margin: 0; padding: 0; border-radius: 18px; box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
.alc-rcpt__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 12px 16px; }
.alc-rcpt__row + .alc-rcpt__row { border-top: 1px solid var(--line); }
.alc-rcpt__l { min-width: 0; }
.alc-rcpt__n { display: block; font-size: 14px; font-weight: 700; line-height: 1.3; color: var(--k1); }
.alc-rcpt__h { display: block; margin-top: 2px; font-size: 12px; font-weight: 500; line-height: 1.4; color: var(--k2); }
.alc-rcpt__v { flex: none; font-size: 14.5px; font-weight: 800; letter-spacing: -.01em; line-height: 1.3; white-space: nowrap; color: var(--k1); }
.alc-rcpt__row--neg .alc-rcpt__v { color: #047857; }
.dark .alc-rcpt__row--neg .alc-rcpt__v { color: #6ee7b7; }
.alc-rcpt__row--hot { background: rgba(245,158,11,.1); }
.alc-rcpt__row--hot .alc-rcpt__n, .alc-rcpt__row--hot .alc-rcpt__v { color: #b45309; }
.dark .alc-rcpt__row--hot .alc-rcpt__n, .dark .alc-rcpt__row--hot .alc-rcpt__v { color: #fbbf24; }
.alc-rcpt__row--total { background: var(--soft); }
.alc-rcpt__row--total .alc-rcpt__n { font-size: 15px; font-weight: 800; }
.alc-rcpt__row--total .alc-rcpt__v { font-size: 17px; }
.alc-rcpt__row--cash { border-top: 2px dashed var(--line) !important; }

/* ---------- Warnings ---------- */
.alc-warns { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.alc-warn { display: flex; gap: 12px; padding: 13px 15px; border-radius: 16px; background: rgba(245,158,11,.1); box-shadow: inset 0 0 0 1px rgba(245,158,11,.28); }
.alc-warn svg { width: 18px; height: 18px; flex: none; margin-top: 1px; color: #b45309; }
.dark .alc-warn svg { color: #fbbf24; }
.alc-warn b { display: block; font-size: 13.5px; font-weight: 800; line-height: 1.35; color: #92400e; }
.dark .alc-warn b { color: #fcd34d; }
.alc-warn span { display: block; margin-top: 3px; font-size: 13px; font-weight: 500; line-height: 1.55; color: #78350f; }
.dark .alc-warn span { color: #fde68a; }

/* ---------- Insights ---------- */
.alc-insights { display: grid; gap: 8px; margin-top: clamp(14px, 2.8cqi, 18px); }
.alc-insight { margin: 0; display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border-radius: 14px; font-size: 13px; line-height: 1.55; font-weight: 500; color: var(--k2); background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
.alc-insight b { font-weight: 800; color: var(--k1); }
.alc-insight__ic { width: 24px; height: 24px; flex: none; display: grid; place-items: center; border-radius: 8px; color: #c2410c; background: rgba(249,115,22,.12); }
.dark .alc-insight__ic { color: #fdba74; background: rgba(251,146,60,.14); }
.alc-insight__ic svg { width: 13px; height: 13px; }

/* ---------- Ring ---------- */
.alc-wg { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(14px, 2.6cqi, 20px); align-items: center; }
@container (min-width: 620px) { .alc-wg { grid-template-columns: minmax(240px, 280px) minmax(0, 1fr); } }
.alc-wg__panel { display: grid; place-items: center; padding: 18px; border-radius: 22px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
.alc-wg__ring { position: relative; container-type: inline-size; width: 100%; max-width: 250px; aspect-ratio: 1; }
.alc-wg__ring svg { width: 100%; height: 100%; overflow: visible; }
.alc-wg__track { stroke: var(--line); }
.alc-wg__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0 23%; text-align: center; pointer-events: none; }
.alc-wg__ck { max-width: 100%; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; line-height: 1.25; color: var(--k2); overflow-wrap: anywhere; }
.alc-wg__cv { max-width: 100%; white-space: nowrap; font-size: clamp(1rem, 10cqw, 1.5rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; color: var(--k1); }
.alc-wg__cs { max-width: 100%; min-height: 1.3em; white-space: nowrap; font-size: 12px; font-weight: 700; line-height: 1.3; color: var(--k2); }
.alc-wg__list { list-style: none; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.alc-wg__row { appearance: none; width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 13px; border: 0; border-radius: 15px; text-align: left; font: inherit; cursor: pointer; color: inherit; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); transition: opacity .15s ease, box-shadow .15s ease; }
.alc-wg__row[data-dim="true"] { opacity: .5; }
.alc-wg__row[data-on="true"] { box-shadow: 0 0 0 1.5px var(--c); }
.alc-wg__row:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
.alc-wg__dot { width: 12px; height: 12px; flex: none; border-radius: 4px; background: var(--c); }
.alc-wg__rn { flex: 1 1 auto; min-width: 0; }
.alc-wg__rl { display: block; font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--k1); overflow-wrap: anywhere; }
.alc-wg__rbar { display: block; height: 4px; margin-top: 7px; border-radius: 999px; overflow: hidden; background: var(--line); }
.alc-wg__rbar i { display: block; height: 100%; min-width: 3px; border-radius: 999px; background: var(--c); transform-origin: left center; animation: alc-grow .7s cubic-bezier(.22,1,.36,1) .15s both; }
.alc-wg__rv { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.alc-wg__rv b { white-space: nowrap; font-size: 13.5px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: var(--k1); }
.alc-wg__rv em { font-style: normal; font-size: 11.5px; font-weight: 700; line-height: 1.2; color: var(--k2); }

/* ---------- Balance chart ---------- */
.alc-bc__panel { padding: clamp(12px, 3cqi, 18px); border-radius: 22px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); display: grid; gap: 14px; }
.alc-bc__read { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@container (max-width: 520px) { .alc-bc__read { grid-template-columns: minmax(0, 1fr); } }
.alc-bc__rd { position: relative; overflow: hidden; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px 14px; border-radius: 16px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line); }
.alc-bc__rk { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: var(--k2); }
.alc-bc__rk i { width: 7px; height: 7px; flex: none; border-radius: 2.5px; }
.alc-bc__rv { font-size: 15px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; color: var(--k1); overflow-wrap: anywhere; }
.alc-bc__rs { font-size: 11.5px; font-weight: 600; line-height: 1.3; color: var(--k2); }
.alc-bc__rm { display: block; height: 4px; margin-top: 4px; border-radius: 999px; overflow: hidden; background: var(--line); }
.alc-bc__rm b { display: block; height: 100%; min-width: 3px; border-radius: 999px; transition: width .35s cubic-bezier(.22,1,.36,1); }
.alc-bc__chart { width: 100%; border-radius: 14px; outline: none; }
.alc-bc__chart:focus-visible { outline: 2px solid rgba(249,115,22,.6); outline-offset: 2px; }
.alc-bc__grid { stroke: var(--line); }
.alc-bc__tick { fill: var(--k2); font-variant-numeric: tabular-nums; }
.alc-bc__cursor { stroke: rgba(100,116,139,.55); stroke-dasharray: 3 3; }
.alc-bc__dot { stroke: var(--bg); }
.alc-bc__line { stroke-dasharray: 1; animation: alc-draw 1s cubic-bezier(.22,1,.36,1) .1s both; }
.alc-bc__key { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; font-weight: 700; color: var(--k2); }
.alc-bc__key span { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px 4px 9px; border-radius: 999px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--line); }
.alc-bc__key i { width: 14px; height: 4px; border-radius: 999px; }

/* ---------- Tables (terms and schedule) ---------- */
.alc-tbl-wrap { overflow-x: auto; border-radius: 16px; box-shadow: inset 0 0 0 1px var(--line); -webkit-overflow-scrolling: touch; }
.alc-tbl { width: 100%; min-width: 440px; border-collapse: collapse; font-size: 13px; }
.alc-tbl--s { min-width: 0; }
.alc-tbl th { padding: 10px 12px; text-align: right; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; color: var(--k2); background: var(--soft); }
.alc-tbl td { padding: 10px 12px; text-align: right; white-space: nowrap; color: var(--k1); border-top: 1px solid var(--line); font-weight: 600; }
.alc-tbl th:first-child, .alc-tbl td:first-child { text-align: left; }
.alc-tbl td small { display: block; font-size: 11px; font-weight: 600; color: var(--k2); }
.alc-tbl tr[data-cur="true"] td { background: rgba(249,115,22,.1); font-weight: 800; }
.alc-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #c2410c; background: rgba(249,115,22,.16); vertical-align: middle; }
.dark .alc-tag { color: #fdba74; }
.alc-up { color: #be123c; } .alc-down { color: #047857; }
.dark .alc-up { color: #fda4af; } .dark .alc-down { color: #6ee7b7; }
.alc-sched__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.alc-more { appearance: none; margin-top: 12px; width: 100%; padding: 11px 14px; border: 0; border-radius: 14px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; color: #4338ca; background: rgba(99,102,241,.1); box-shadow: inset 0 0 0 1px rgba(99,102,241,.22); }
.dark .alc-more { color: #c7d2fe; }
.alc-more:focus-visible { outline: 2px solid rgba(99,102,241,.7); outline-offset: 2px; }

/* ---------- Savings ---------- */
.alc-save { display: grid; gap: 10px; margin-top: 14px; }
.alc-save__row { display: grid; gap: 6px; }
.alc-save__top { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; font-weight: 700; color: var(--k2); }
.alc-save__top b { color: var(--k1); font-weight: 800; }
.alc-save__bar { height: 8px; border-radius: 999px; overflow: hidden; background: var(--line); }
.alc-save__bar i { display: block; height: 100%; border-radius: 999px; transform-origin: left center; animation: alc-grow .8s cubic-bezier(.22,1,.36,1) .1s both; }

/* ---------- Empty and no-loan states ---------- */
.alc-empty { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; padding: clamp(36px, 8vw, 56px) clamp(20px, 5vw, 32px); border-radius: 28px; border: 1.5px dashed rgba(100,116,139,.35); background: rgba(248,250,252,.7); }
.dark .alc-empty { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.02); }
.alc-empty__icon { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; color: #c2410c; background: rgba(249,115,22,.1); box-shadow: inset 0 0 0 1px rgba(249,115,22,.22); }
.dark .alc-empty__icon { color: #fdba74; background: rgba(251,146,60,.12); box-shadow: inset 0 0 0 1px rgba(251,146,60,.26); }
.alc-empty__title { margin: 18px 0 0; font-size: 18px; font-weight: 800; letter-spacing: -.02em; color: #334155; }
.dark .alc-empty__title { color: #e2e8f0; }
.alc-empty__text { margin: 8px 0 0; max-width: 26rem; font-size: 14px; line-height: 1.6; font-weight: 500; color: #526074; }
.dark .alc-empty__text { color: #a1a1aa; }
.alc-stale { margin: 0; display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; font-weight: 600; color: #92400e; background: rgba(245,158,11,.12); box-shadow: inset 0 0 0 1px rgba(245,158,11,.3); }
.dark .alc-stale { color: #fcd34d; }
.alc-stale svg { width: 16px; height: 16px; flex: none; margin-top: 2px; }
`;

// ---------------------------------------------------------------------------
// RESULT CARDS
// ---------------------------------------------------------------------------

// Shared card shell: badge header + body. Every result region announces changes politely.
const ResultSection: React.FC<{
  icon: IconType;
  title: string;
  subtitle?: string;
  tip?: string;
  label: string;
  amber?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, tip, label, amber, children }) => (
  <section className="alc-sum" aria-label={label} aria-live="polite">
    <div className="alc-sum__glow" aria-hidden="true" />
    <div className="alc-sum__in">
      <div className="alc-sum__head">
        <span className={`alc-badge${amber ? ' alc-badge--amber' : ''}`} aria-hidden="true">
          <SafeIcon icon={icon} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h4 className="alc-sum__title">
            {title}
            {tip && <InfoTip text={tip} />}
          </h4>
          {subtitle && <p className="alc-sum__sub">{subtitle}</p>}
        </div>
      </div>
      <div className="alc-sum__body">{children}</div>
    </div>
  </section>
);

// --- HERO: the monthly payment estimate ---
interface HeroFact { k: string; v: string; s?: string; }

const PaymentHero: React.FC<{
  text: string;
  caption: string;
  facts: HeroFact[];
  note: string;
}> = ({ text, caption, facts, note }) => (
  <section className="alc-hero" aria-label="Estimated monthly payment" aria-live="polite">
    <div className="alc-hero__glow" aria-hidden="true" />
    <div className="alc-hero__in">
      <p className="alc-eyebrow"><i aria-hidden="true" />Estimated monthly payment</p>
      <div className="alc-amt-wrap">
        <span className="alc-amt" style={fitNumberStyle(text, 4.25)}>{text}</span>
      </div>
      <p className="alc-cap">{caption}</p>
      <dl className="alc-facts">
        {facts.map((f) => (
          <div key={f.k} className="alc-fact">
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
            {f.s && <small>{f.s}</small>}
          </div>
        ))}
      </dl>
      <p className="alc-note">{note}</p>
    </div>
  </section>
);

// --- "No loan needed" result (not an error) ---
const NoLoanCard: React.FC<{ cashDue: number; surplus: number; fmt2: (n: number) => string }> = ({ cashDue, surplus, fmt2 }) => (
  <section className="alc-hero" aria-label="No loan needed" aria-live="polite">
    <div className="alc-hero__glow" aria-hidden="true" />
    <div className="alc-hero__in">
      <p className="alc-eyebrow"><i aria-hidden="true" />Estimate</p>
      <div className="alc-amt-wrap">
        <span className="alc-amt" style={fitNumberStyle('No loan needed', 3, 1.5)}>No loan needed</span>
      </div>
      <p className="alc-cap">
        Your down payment and trade-in already cover the cost, so there is nothing left to borrow.
        {surplus > 0 && ` They cover it with about ${fmt2(surplus)} to spare. Ask the dealer how that extra credit would be handled.`}
      </p>
      <dl className="alc-facts">
        <div className="alc-fact"><dt>Cash due at signing</dt><dd>{fmt2(cashDue)}</dd></div>
      </dl>
      <p className="alc-note">This is an estimate. Final figures come from the dealer&apos;s paperwork.</p>
    </div>
  </section>
);

// --- SUMMARY TILES ---
interface TileData { label: string; value: string; sub?: string; tone: 'emerald' | 'rose' | 'sky' | 'amber' | 'orange'; }

const LoanSummaryCard: React.FC<{ tiles: TileData[]; tip: string }> = ({ tiles, tip }) => (
  <ResultSection icon={FiLayers} title="Loan Summary" subtitle="The main numbers for this estimate." tip={tip} label="Loan summary">
    <div className="alc-tiles">
      {tiles.map((t) => (
        <div key={t.label} className={`alc-tile alc-tile--${t.tone}`}>
          <div className="alc-tile__k">{t.label}</div>
          <span className="alc-tile__v" style={fitNumberStyle(t.value, 1.5, 0.9)}>{t.value}</span>
          {t.sub && <div className="alc-tile__s">{t.sub}</div>}
        </div>
      ))}
    </div>
  </ResultSection>
);

// --- RECEIPT: "What you are really financing" ---
const RECEIPT_HINTS: Record<BreakdownLine['id'], string> = {
  price: 'The listed price of the vehicle.',
  salesTax: 'Tax on the sale, added to the loan.',
  fees: 'Title, registration, dealer and similar fees, added to the loan.',
  lenderFee: 'The lender processing fee plus the GST charged on it.',
  down: 'Cash you pay up front, which lowers the loan.',
  rebate: 'Incentives that come off the amount owed.',
  tradeInEquity: 'What your trade-in is worth beyond what you still owe on it.',
  negativeEquity: 'What you still owe on the trade-in beyond its value. It is added to this loan.',
};

const ReceiptCard: React.FC<{
  lines: BreakdownLine[];
  priceLabel: string;
  amountFinanced: number;
  cashDue: number;
  upfrontExtras: number;
  fmt2: (n: number) => string;
  tip: string;
}> = ({ lines, priceLabel, amountFinanced, cashDue, upfrontExtras, fmt2, tip }) => (
  <ResultSection
    icon={FiFileText}
    title="What You Are Really Financing"
    subtitle="Each line that adds up to your loan, so you can match it to the dealer's paperwork."
    tip={tip}
    label="What you are really financing"
  >
    <ul className="alc-rcpt">
      {lines.map((l) => {
        const hot = l.id === 'negativeEquity';
        const neg = l.amount < 0;
        const sign = l.id === 'price' ? '' : neg ? '\u2212\u00A0' : '+\u00A0';
        return (
          <li key={l.id} className={`alc-rcpt__row${hot ? ' alc-rcpt__row--hot' : ''}${neg ? ' alc-rcpt__row--neg' : ''}`}>
            <span className="alc-rcpt__l">
              <span className="alc-rcpt__n">{l.id === 'price' ? priceLabel : l.label}</span>
              <span className="alc-rcpt__h">{RECEIPT_HINTS[l.id]}</span>
            </span>
            <span className="alc-rcpt__v">{sign}{fmt2(Math.abs(l.amount))}</span>
          </li>
        );
      })}
      <li className="alc-rcpt__row alc-rcpt__row--total">
        <span className="alc-rcpt__l">
          <span className="alc-rcpt__n">Amount financed</span>
          <span className="alc-rcpt__h">The loan balance your payment is based on.</span>
        </span>
        <span className="alc-rcpt__v">{fmt2(amountFinanced)}</span>
      </li>
      <li className="alc-rcpt__row alc-rcpt__row--cash">
        <span className="alc-rcpt__l">
          <span className="alc-rcpt__n">Cash due at signing</span>
          <span className="alc-rcpt__h">
            {upfrontExtras > 0.004 ? 'Your down payment plus the taxes and fees you pay up front.' : 'Your down payment.'}
          </span>
        </span>
        <span className="alc-rcpt__v">{fmt2(cashDue)}</span>
      </li>
    </ul>
  </ResultSection>
);

// --- WARNINGS (original wording for each engine code) ---
const WarningsCard: React.FC<{
  warnings: AutoLoanWarning[];
  negativeEquity: number;
  ltvPct: number;
  termMonths: number;
  fmt0: (n: number) => string;
}> = ({ warnings, negativeEquity, ltvPct, termMonths, fmt0 }) => {
  const items = warnings.map((code) => {
    if (code === 'NEGATIVE_EQUITY_FINANCED') {
      return {
        code,
        title: 'Old debt is rolled into this loan',
        text: `You owe about ${fmt0(negativeEquity)} more on your trade-in than it is worth. That gap is added to the new loan, so you borrow against it and pay interest on it. Paying it off first, or putting more down, keeps the loan smaller.`,
      };
    }
    if (code === 'LTV_OVER_100') {
      return {
        code,
        title: 'You would borrow more than the vehicle costs',
        text: `The loan is about ${Math.round(ltvPct)}% of the vehicle price. New vehicles lose value quickly, so for a while you could owe more than it would sell for. A bigger down payment brings this closer to 100% or below.`,
      };
    }
    return {
      code,
      title: 'A long loan term',
      text: `At ${termMonths} months (more than ${LONG_TERM_MONTHS}), the payment is lower but you pay interest for longer and stay behind the vehicle's falling value for longer. Compare shorter terms below before you decide.`,
    };
  });
  return (
    <ResultSection icon={FiAlertTriangle} amber title="Things To Watch" subtitle="Points that could make this loan costlier or riskier." label="Warnings">
      <ul className="alc-warns">
        {items.map((w) => (
          <li key={w.code} className="alc-warn">
            <SafeIcon icon={FiAlertTriangle} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <b>{w.title}</b>
              <span>{w.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </ResultSection>
  );
};

// --- RING: "Where your money goes" ---
interface RingSlice { key: string; label: string; value: number; color: string; }

const shareLabel = (f: number): string => `${(f * 100).toFixed(f > 0 && f < 0.001 ? 2 : 1)}%`;

const BreakdownRing: React.FC<{
  slices: RingSlice[];
  centerLabel: string;
  centerValue: string;
  fmt: (n: number) => string;
}> = ({ slices, centerLabel, centerValue, fmt }) => {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
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
  const active = hover ?? pinned;
  const activeArc = arcs.find((a) => a.key === active) ?? null;
  const togglePin = (key: string) => setPinned((cur) => (cur === key ? null : key));
  // Touch taps also fire pointer-enter; only a real mouse should drive the hover highlight.
  const mouseHover = (key: string | null) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') setHover(key);
  };
  const focusHover = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
    let visible = true;
    try { visible = e.currentTarget.matches(':focus-visible'); } catch (_err) { visible = true; }
    if (visible) setHover(key);
  };
  const maskId = `alcwg${uid}`;

  return (
    <div className="alc-wg">
      <div className="alc-wg__panel">
        <div className="alc-wg__ring">
          <svg viewBox="0 0 160 160" role="img" aria-label={`Total cost split: ${arcs.map((a) => `${a.label} ${shareLabel(a.frac)}`).join(', ')}`}>
            {!reduced && (
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160">
                  <g transform="rotate(-90 80 80)">
                    <motion.circle
                      cx="80" cy="80" r={R}
                      fill="none" stroke="#fff" strokeWidth={36}
                      strokeDasharray={C}
                      initial={{ strokeDashoffset: C }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 0.9, delay: 0.1, ease: EASE_OUT }}
                    />
                  </g>
                </mask>
              </defs>
            )}
            <circle cx="80" cy="80" r={R} fill="none" strokeWidth="22" className="alc-wg__track" />
            <g mask={reduced ? undefined : `url(#${maskId})`}>
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
                    onPointerEnter={mouseHover(a.key)}
                    onPointerLeave={mouseHover(null)}
                    onClick={() => togglePin(a.key)}
                    style={{
                      opacity: active && active !== a.key ? 0.28 : 1,
                      cursor: 'pointer',
                      transition: 'opacity 150ms, stroke-width 150ms',
                    }}
                  />
                ))}
              </g>
            </g>
          </svg>
          <div className="alc-wg__c" aria-hidden="true">
            <span className="alc-wg__ck">{activeArc ? activeArc.label : centerLabel}</span>
            <span className="alc-wg__cv">{activeArc ? shareLabel(activeArc.frac) : centerValue}</span>
            <span className="alc-wg__cs">{activeArc ? fmt(activeArc.value) : '\u00A0'}</span>
          </div>
        </div>
      </div>

      <ul className="alc-wg__list">
        {arcs.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              className="alc-wg__row"
              style={{ '--c': a.color } as React.CSSProperties}
              data-on={active === a.key ? 'true' : undefined}
              data-dim={active && active !== a.key ? 'true' : undefined}
              aria-pressed={pinned === a.key}
              onClick={() => togglePin(a.key)}
              onPointerEnter={mouseHover(a.key)}
              onPointerLeave={mouseHover(null)}
              onFocus={focusHover(a.key)}
              onBlur={() => setHover(null)}
            >
              <span className="alc-wg__dot" aria-hidden="true" />
              <span className="alc-wg__rn">
                <span className="alc-wg__rl">{a.label}</span>
                <span className="alc-wg__rbar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.max(0, a.frac * 100))}%` }} />
                </span>
              </span>
              <span className="alc-wg__rv">
                <b>{fmt(a.value)}</b>
                <em>{shareLabel(a.frac)}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MoneyBreakdownCard: React.FC<{
  slices: RingSlice[];
  centerLabel: string;
  centerValue: string;
  fmt: (n: number) => string;
  tip: string;
}> = ({ slices, centerLabel, centerValue, fmt, tip }) => {
  const total = slices.reduce((a, sl) => a + sl.value, 0);
  const interest = slices.find((sl) => sl.key === 'interest');
  return (
    <ResultSection icon={FiPieChart} title="Where Your Money Goes" subtitle="Everything you pay, from signing to the last payment." tip={tip} label="Where your money goes">
      <BreakdownRing slices={slices} centerLabel={centerLabel} centerValue={centerValue} fmt={fmt} />
      {interest && total > 0 && (
        <div className="alc-insights">
          <p className="alc-insight">
            <span className="alc-insight__ic" aria-hidden="true"><SafeIcon icon={FiPercent} /></span>
            <span>
              Interest is about <b>{shareLabel(interest.value / total)}</b> of the <b>{fmt(total)}</b> this estimate says you pay in total.
            </span>
          </p>
        </div>
      )}
    </ResultSection>
  );
};

// --- BALANCE CHART (inline SVG drawn at the container's real width; monthly points) ---
interface BalancePoint { month: number; balance: number; interest: number; label: string; }

const BalanceChart: React.FC<{
  points: BalancePoint[];
  locale: string;
  currency: string;
  fmt: (n: number) => string;
}> = ({ points, locale, currency, fmt }) => {
  const [wrapRef, width] = useElementWidth();
  const [idx, setIdx] = useState<number | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const H = width > 0 && width < 420 ? 220 : 260;

  const dataMax = Math.max(...points.map((p) => Math.max(p.balance, p.interest)), 1);
  const step = niceStep(dataMax / 4);
  const yMax = Math.ceil(dataMax / step) * step;
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const yLabels = yTicks.map((t) => compactMoney(t, locale, currency));

  const padL = Math.max(...yLabels.map((l) => l.length)) * 7 + 14;
  const padR = 14, padT = 14, padB = 32;
  const innerW = Math.max(width - padL - padR, 10);
  const innerH = H - padT - padB;
  const xMax = Math.max(points[points.length - 1].month, 1);
  const x = (m: number) => padL + (m / xMax) * innerW;
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;

  const maxXTicks = Math.max(2, Math.floor(innerW / 60));
  const xStep = [1, 2, 3, 6, 12, 24, 36].find((c) => xMax / c <= maxXTicks) ?? 36;
  const xTicks: number[] = [];
  for (let t = 0; t <= xMax; t += xStep) xTicks.push(t);

  const line = (key: 'balance' | 'interest') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const balanceLine = line('balance');
  const interestLine = line('interest');
  const areaPath = `${balanceLine} L${x(xMax).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const pick = (clientX: number, left: number) => {
    const m = ((clientX - left - padL) / innerW) * xMax;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.month - m);
      if (d < bd) { bd = d; best = i; }
    });
    setIdx(best);
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => (i === null ? 0 : Math.min(i + 1, last))); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => (i === null ? last : Math.max(i - 1, 0))); }
    else if (e.key === 'PageDown') { e.preventDefault(); setIdx((i) => Math.min((i ?? 0) + 12, last)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setIdx((i) => Math.max((i ?? last) - 12, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setIdx(0); }
    else if (e.key === 'End') { e.preventDefault(); setIdx(last); }
    else if (e.key === 'Escape') setIdx(null);
  };

  const first = points[0];
  const last = points[points.length - 1];
  // The readout and cursor are always visible: they follow the pointer or arrow keys and rest on the payoff point.
  const active = idx !== null ? points[idx] : null;
  const shown = active ?? last;
  const whenLabel = shown.month === 0 ? 'Loan start' : shown.month === last.month ? `Payment ${shown.month} \u00B7 Payoff` : `Payment ${shown.month} of ${last.month}`;
  const balLeftPct = first.balance > 0 ? Math.round(Math.min(100, Math.max(0, (shown.balance / first.balance) * 100))) : 0;
  const intPaidPct = last.interest > 0 ? Math.round(Math.min(100, Math.max(0, (shown.interest / last.interest) * 100))) : 0;

  return (
    <div className="alc-bc__panel">
      <div className="alc-bc__read" aria-live="polite">
        <div className="alc-bc__rd">
          <span className="alc-bc__rk">{whenLabel}</span>
          <span className="alc-bc__rv">{shown.label}</span>
          <span className="alc-bc__rs">{shown.month === 0 ? 'Before the first payment' : shown.month === last.month ? 'Final payment' : 'After this payment'}</span>
        </div>
        <div className="alc-bc__rd">
          <span className="alc-bc__rk"><i style={{ background: '#f97316' }} />Balance left</span>
          <span className="alc-bc__rv">{fmt(shown.balance)}</span>
          <span className="alc-bc__rs">{balLeftPct}% of the loan</span>
          <span className="alc-bc__rm" aria-hidden="true"><b style={{ width: `${balLeftPct}%`, background: '#ea580c' }} /></span>
        </div>
        <div className="alc-bc__rd">
          <span className="alc-bc__rk"><i style={{ background: '#f43f5e' }} />Interest so far</span>
          <span className="alc-bc__rv">{fmt(shown.interest)}</span>
          <span className="alc-bc__rs">{intPaidPct}% of all interest</span>
          <span className="alc-bc__rm" aria-hidden="true"><b style={{ width: `${intPaidPct}%`, background: '#e11d48' }} /></span>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="alc-bc__chart"
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
        aria-label="Loan balance chart. Use the left and right arrow keys to move between payments."
      >
        {width > 0 ? (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Remaining balance falls from ${fmt(first.balance)} to ${fmt(last.balance)} over ${last.month} payments. Interest paid reaches ${fmt(last.interest)}.`}
            style={{ touchAction: 'pan-y', display: 'block' }}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect().left)}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIdx(null); }}
          >
            <defs>
              <linearGradient id={`${gid}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((t, i) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} strokeWidth="1" className="alc-bc__grid" strokeDasharray={t === 0 ? undefined : '3 4'} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" className="alc-bc__tick">{yLabels[i]}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={H - 10} textAnchor={t === 0 ? 'start' : t === xMax ? 'end' : 'middle'} fontSize="11" className="alc-bc__tick">
                {t === 0 ? 'Start' : t % 12 === 0 ? `Yr ${t / 12}` : `Mo ${t}`}
              </text>
            ))}

            <path d={areaPath} fill={`url(#${gid}-area)`} />
            <path d={balanceLine} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="alc-bc__line" />
            <path d={interestLine} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="alc-bc__line" />

            <g>
              <line x1={x(shown.month)} x2={x(shown.month)} y1={padT} y2={y(0)} strokeWidth="1" className="alc-bc__cursor" />
              <circle cx={x(shown.month)} cy={y(shown.balance)} r="9" fill="#f97316" opacity="0.18" />
              <circle cx={x(shown.month)} cy={y(shown.interest)} r="9" fill="#f43f5e" opacity="0.18" />
              <circle cx={x(shown.month)} cy={y(shown.balance)} r="4.5" fill="#f97316" className="alc-bc__dot" strokeWidth="2" />
              <circle cx={x(shown.month)} cy={y(shown.interest)} r="4.5" fill="#f43f5e" className="alc-bc__dot" strokeWidth="2" />
            </g>
          </svg>
        ) : (
          <div style={{ height: H }} aria-hidden="true" />
        )}
      </div>

      <div className="alc-bc__key" aria-hidden="true">
        <span><i style={{ background: '#f97316' }} />Remaining balance</span>
        <span><i style={{ background: '#f43f5e' }} />Interest paid so far</span>
      </div>
    </div>
  );
};

const BalanceOverTimeCard: React.FC<{
  points: BalancePoint[];
  locale: string;
  currency: string;
  fmt: (n: number) => string;
  tip: string;
}> = ({ points, locale, currency, fmt, tip }) => {
  const first = points[0];
  const last = points[points.length - 1];
  const halfIdx = first.balance > 0 ? points.findIndex((pt) => pt.balance <= first.balance / 2) : -1;
  const half = halfIdx > 0 ? points[halfIdx] : null;
  return (
    <ResultSection icon={FiTrendingDown} title="Balance Over Time" subtitle="How the loan shrinks while interest adds up." tip={tip} label="Balance over time">
      <BalanceChart points={points} locale={locale} currency={currency} fmt={fmt} />
      {half && (
        <div className="alc-insights">
          <p className="alc-insight">
            <span className="alc-insight__ic" aria-hidden="true"><SafeIcon icon={FiTrendingDown} /></span>
            <span>
              Half of the loan is gone after payment <b>{half.month}</b> ({half.label}), with about <b>{fmt(half.balance)}</b> still owed.
            </span>
          </p>
          {last.interest > 0.004 && (
            <p className="alc-insight">
              <span className="alc-insight__ic" aria-hidden="true"><SafeIcon icon={FiPercent} /></span>
              <span>Interest adds up to <b>{fmt(last.interest)}</b> by <b>{last.label}</b>, when the loan is paid off.</span>
            </p>
          )}
        </div>
      )}
    </ResultSection>
  );
};

// --- COMPARE TERMS ---
const TermsCard: React.FC<{
  rows: TermComparisonRow[];
  currentTerm: number;
  hasExtras: boolean;
  fmt0: (n: number) => string;
  fmt2: (n: number) => string;
  tip: string;
}> = ({ rows, currentTerm, hasExtras, fmt0, fmt2, tip }) => {
  const cur = rows.find((r) => r.termMonths === currentTerm);
  const shorter = [...rows].reverse().find((r) => r.termMonths < currentTerm);
  const longer = rows.find((r) => r.termMonths > currentTerm);
  const insights: React.ReactNode[] = [];
  if (cur && shorter) {
    const dInt = cur.totalInterest - shorter.totalInterest;
    insights.push(
      <span key="s">
        A <b>{shorter.termMonths}-month</b> term would raise the payment by <b>{fmt2(shorter.payment - cur.payment)}</b> a month{dInt > 0.5 ? <>, but save about <b>{fmt0(dInt)}</b> in interest</> : <>, with little change in interest</>}.
      </span>
    );
  }
  if (cur && longer) {
    const dInt = longer.totalInterest - cur.totalInterest;
    insights.push(
      <span key="l">
        A <b>{longer.termMonths}-month</b> term would lower the payment by <b>{fmt2(cur.payment - longer.payment)}</b> a month{dInt > 0.5 ? <>, but add about <b>{fmt0(dInt)}</b> in interest</> : <>, with little change in interest</>}.
      </span>
    );
  }
  return (
    <ResultSection icon={FiBarChart2} title="Compare Terms" subtitle="The same loan over different lengths, at the same rate." tip={tip} label="Compare loan terms">
      <div className="alc-tbl-wrap">
        <table className="alc-tbl alc-tbl--s">
          <caption className="alc-sr">Monthly payment and total interest for different loan terms</caption>
          <thead>
            <tr>
              <th scope="col">Term</th>
              <th scope="col">Payment</th>
              <th scope="col">Total interest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isCur = r.termMonths === currentTerm;
              const diff = cur ? r.totalInterest - cur.totalInterest : 0;
              return (
                <tr key={r.termMonths} data-cur={isCur ? 'true' : undefined}>
                  <td>
                    {r.termMonths} mo{isCur && <span className="alc-tag">Yours</span>}
                    {r.termMonths % 12 === 0 && <small>{r.termMonths / 12} {r.termMonths === 12 ? 'year' : 'years'}</small>}
                  </td>
                  <td>{fmt2(r.payment)}</td>
                  <td>
                    {fmt0(r.totalInterest)}
                    {cur && !isCur && Math.abs(diff) >= 0.5 && (
                      <small className={diff > 0 ? 'alc-up' : 'alc-down'}>{diff > 0 ? '+' : '\u2212'}{fmt0(Math.abs(diff))} vs yours</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(insights.length > 0 || hasExtras) && (
        <div className="alc-insights">
          {insights.map((n, i) => (
            <p key={i} className="alc-insight">
              <span className="alc-insight__ic" aria-hidden="true"><SafeIcon icon={FiZap} /></span>
              {n}
            </p>
          ))}
          {hasExtras && (
            <p className="alc-insight">
              <span className="alc-insight__ic" aria-hidden="true"><SafeIcon icon={FiInfo} /></span>
              <span>This table leaves out your extra payments, so it shows each term on its regular schedule.</span>
            </p>
          )}
        </div>
      )}
    </ResultSection>
  );
};

// --- WHAT EXTRA PAYMENTS SAVE (only when extras were entered) ---
const SavingsCard: React.FC<{
  savings: AutoSavings;
  payments: number;
  fmt0: (n: number) => string;
  fmt2: (n: number) => string;
  tip: string;
}> = ({ savings, payments, fmt0, fmt2, tip }) => {
  const withInterest = Math.max(savings.baselineInterest - savings.interestSaved, 0);
  const pct = (v: number, of: number) => (of > 0 ? Math.min(100, Math.max(0, (v / of) * 100)) : 0);
  return (
    <ResultSection icon={FiZap} title="What Extra Payments Save" subtitle="Your extra payments compared with paying on schedule." tip={tip} label="What extra payments save">
      <div className="alc-tiles">
        <div className="alc-tile alc-tile--emerald">
          <div className="alc-tile__k">Interest saved</div>
          <span className="alc-tile__v" style={fitNumberStyle(fmt2(savings.interestSaved), 1.5, 0.9)}>{fmt2(savings.interestSaved)}</span>
        </div>
        <div className="alc-tile alc-tile--sky">
          <div className="alc-tile__k">Paid off sooner</div>
          <span className="alc-tile__v" style={fitNumberStyle(formatDuration(savings.monthsSaved), 1.5, 0.9)}>{formatDuration(savings.monthsSaved)}</span>
          <div className="alc-tile__s">{payments} payments instead of {savings.baselineMonths}</div>
        </div>
      </div>
      <div className="alc-save">
        <div className="alc-save__row">
          <div className="alc-save__top"><span>Interest on the regular schedule</span><b>{fmt0(savings.baselineInterest)}</b></div>
          <div className="alc-save__bar"><i style={{ width: '100%', background: '#f43f5e' }} /></div>
        </div>
        <div className="alc-save__row">
          <div className="alc-save__top"><span>Interest with your extras</span><b>{fmt0(withInterest)}</b></div>
          <div className="alc-save__bar"><i style={{ width: `${pct(withInterest, savings.baselineInterest)}%`, background: '#10b981' }} /></div>
        </div>
      </div>
    </ResultSection>
  );
};

// --- SCHEDULE (yearly by default, monthly on a toggle, show all on demand) ---
const SCHEDULE_PREVIEW_ROWS = 12;

const ScheduleCard: React.FC<{
  rows: AutoScheduleRow[];
  years: AutoYearRow[];
  locale: string;
  fmt2: (n: number) => string;
  tip: string;
}> = ({ rows, years, locale, fmt2, tip }) => {
  const uid = useId();
  const [view, setView] = useState<'yearly' | 'monthly'>('yearly');
  const [showAll, setShowAll] = useState(false);
  const hasExtra = rows.some((r) => r.extra > 0);
  const shownRows = showAll ? rows : rows.slice(0, SCHEDULE_PREVIEW_ROWS);
  return (
    <ResultSection icon={FiList} title="Payment Schedule" subtitle="Where each payment goes, month by month or year by year." tip={tip} label="Payment schedule">
      <div className="alc-sched__bar">
        <SegmentedToggle<'yearly' | 'monthly'>
          size="sm"
          value={view}
          onChange={setView}
          groupId={`${uid}-sched`}
          ariaLabel="Schedule view"
          options={[{ value: 'yearly', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }]}
        />
      </div>
      {view === 'yearly' ? (
        <div className="alc-tbl-wrap">
          <table className="alc-tbl">
            <caption className="alc-sr">Yearly payment schedule</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Paid</th>
                <th scope="col">Interest</th>
                <th scope="col">Principal</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{fmt2(y.payments)}</td>
                  <td>{fmt2(y.interest)}</td>
                  <td>{fmt2(y.principal)}</td>
                  <td>{fmt2(y.endBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="alc-tbl-wrap">
            <table className="alc-tbl" style={{ minWidth: hasExtra ? 560 : 480 }}>
              <caption className="alc-sr">Monthly payment schedule</caption>
              <thead>
                <tr>
                  <th scope="col">Payment</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Interest</th>
                  <th scope="col">Principal</th>
                  {hasExtra && <th scope="col">Extra</th>}
                  <th scope="col">Balance</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r) => (
                  <tr key={r.number}>
                    <td>{formatMonthYear(r.year, r.month, locale)}<small>#{r.number}</small></td>
                    <td>{fmt2(r.payment)}</td>
                    <td>{fmt2(r.interest)}</td>
                    <td>{fmt2(r.principal)}</td>
                    {hasExtra && <td>{r.extra > 0 ? fmt2(r.extra) : '\u2014'}</td>}
                    <td>{fmt2(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > SCHEDULE_PREVIEW_ROWS && (
            <button type="button" className="alc-more" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
              {showAll ? 'Show fewer payments' : `Show all ${rows.length} payments`}
            </button>
          )}
        </>
      )}
    </ResultSection>
  );
};

// --- EMPTY STATE (shown until a result exists) ---
const EmptyState: React.FC<{ prefersReducedMotion: boolean | null }> = ({ prefersReducedMotion }) => (
  <motion.div
    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
    className="alc-empty"
    aria-live="polite"
  >
    <span className="alc-empty__icon" aria-hidden="true">
      <svg width="52" height="52" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M12 60 L20 40 Q22 34 29 34 H71 Q78 34 80 40 L88 60 V74 H12 Z" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 46 H76" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="30" cy="74" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
        <circle cx="70" cy="74" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
      </svg>
    </span>
    <h3 className="alc-empty__title">Your Results Will Appear Here</h3>
    <p className="alc-empty__text">
      Enter the vehicle price, the interest rate and the loan term above, then press Calculate to see your estimated monthly payment, total interest and payoff date.
    </p>
  </motion.div>
);

// ===================== END OF PART 1. Paste PART 2 directly below this line. =====================

// ===========================================================================
// PART 2 OF 2 (paste directly under the last line of PART 1)
// Holds: the Sources panel, a small input-card shell, and the main calculator component.
// ===========================================================================

// ---------------------------------------------------------------------------
// SOURCES PANEL
// AUTO_LOAN_SOURCES (engine file) is the single list. Items marked "to-verify" are shown as
// "Being verified" with a plain note of our own, never as confirmed facts and never with a link.
// ---------------------------------------------------------------------------
const SOURCE_REGION_TAG: Record<string, string> = {
  'amortization-formula': 'All regions',
  'cfpb-negotiate': 'US',
  'cfpb-negative-equity': 'US',
  'fed-g19': 'US',
  'us-state-tax': 'US',
  'india-gst-fee': 'India',
  'canada-monthly': 'Canada',
};

// Not used by this version of the calculator, so not listed for visitors.
const SOURCE_HIDDEN = new Set<string>(['fed-g19']);

// Visitor-facing wording for items still being verified (the engine notes are internal to-do notes).
const SOURCE_PUBLIC_NOTE: Record<string, string> = {
  'cfpb-negotiate': 'Background reading on how loan length and add-ons change what a car loan costs. We are still confirming the exact page, so treat it as a pointer rather than proof.',
  'cfpb-negative-equity': 'Background on owing more on a loan than the vehicle is worth, which is the idea behind the warning in your results. We are still confirming the exact report link.',
  'us-state-tax': 'Whether a trade-in lowers the taxable amount depends on the state. This calculator does not apply state rules: you type your own rate and choose whether a trade-in counts. We are still checking state rules.',
  'india-gst-fee': 'The GST that lenders add to a processing fee, and the 84-month limit we chose for India. You type the rates yourself. We are still checking the official GST notifications.',
  'canada-monthly': 'Car loans in Canada are calculated here with monthly compounding. We are still checking this against a lender\u2019s cost-of-borrowing disclosure, so your lender\u2019s figures may differ slightly.',
};

const SourcesPanel: React.FC<{ reduced: boolean | null }> = ({ reduced }) => {
  const uid = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [pulse, setPulse] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const list: AutoLoanSource[] = AUTO_LOAN_SOURCES.filter((s) => !SOURCE_HIDDEN.has(s.id));
  const pending = list.filter((s) => s.status !== 'verified').length;
  const reviewed = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${AUTO_LOAN_LAST_REVIEWED}T00:00:00Z`));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        }, 50);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 1600);
      }
      return next;
    });
  };

  return (
    <div
      ref={panelRef}
      style={pulse ? { boxShadow: '0 0 0 3px rgba(249,115,22,0.35)' } : undefined}
      className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${uid}-sources-panel`}
        className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
            <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources</span>
            <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">
              {list.length} references{pending > 0 ? ` (${pending} being verified)` : ''}. Last reviewed {reviewed}.
            </span>
          </div>
        </div>
        <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}>
          <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
        </span>
      </button>
      <motion.div
        id={`${uid}-sources-panel`}
        initial={false}
        animate={{ height: open ? 'auto' : 0 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
        style={{ overflow: 'hidden' }}
        aria-hidden={!open}
      >
        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
          <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {list.map((source, i) => {
              const verified = source.status === 'verified';
              return (
                <li key={source.id} className="flex gap-3 pt-4 first:pt-0">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 break-words">{source.title}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <span className="alc-regtag inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {SOURCE_REGION_TAG[source.id] ?? 'General'}
                      </span>
                      {!verified && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                          Being verified
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed mt-1.5 text-neutral-600 dark:text-neutral-400">
                      {verified
                        ? source.note
                        : SOURCE_PUBLIC_NOTE[source.id] ?? 'We are still checking this reference, so what it supports is not yet treated as confirmed.'}
                    </p>
                    {verified && source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        tabIndex={open ? 0 : -1}
                        className="group inline-flex items-center gap-1.5 mt-2.5 alc-srclink font-semibold text-[13px] focus:outline-none focus-visible:underline"
                      >
                        <span className="underline-offset-2 group-hover:underline">View source</span>
                        <SafeIcon icon={FiExternalLink} className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="pt-4 mt-4 border-t border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-2">
            <p>
              <strong className="text-neutral-700 dark:text-neutral-300">How it is calculated:</strong> the amount you borrow is the vehicle price,
              plus any taxes and fees you choose to finance, minus your down payment, rebates and trade-in equity. If you owe more on your trade-in than it is worth,
              that gap is added to the loan. The monthly rate is the yearly rate divided by 12 in every region. The monthly payment is
              M = P × r ÷ (1 − (1 + r)<sup>−n</sup>), where P is the amount borrowed, r the monthly rate and n the number of months (at 0%, M = P ÷ n).
              Each month, interest on the remaining balance is added and the payment is taken off. Money is rounded to the cent every month, and the last payment clears whatever is left.
            </p>
            <p>
              <strong className="text-neutral-700 dark:text-neutral-300">Flat rates and extras:</strong> a flat rate (India) charges interest on the full amount borrowed for the whole term,
              so EMI = (P + P × flat rate × years) ÷ months. The matching reducing-balance rate shown is the rate that gives the same payment. Extra payments go straight to the balance after the scheduled payment,
              which shortens the loan and cuts interest. Sales tax is the rate you type applied to the taxable amount; whether a trade-in or rebate lowers that amount depends on where you live, so you choose.
            </p>
            <p>
              Nothing here is a lender quote. Your lender&apos;s fees, rounding and rules decide the real figures. The notes above are written in our own words and no source text is copied.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// INPUT CARD SHELL (same look as the Mortgage input card; spacing inline)
// ---------------------------------------------------------------------------
const InputCard: React.FC<{ title: string; subtitle?: string; tag?: FieldTagKind; children: React.ReactNode }> = ({ title, subtitle, tag, children }) => (
  <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
    <div className="p-5 sm:p-6 md:p-8" style={{ display: 'flex', flexDirection: 'column', rowGap: '1.75rem' }}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">{title}</h3>
          {tag && <FieldTag kind={tag} />}
        </div>
        {subtitle && <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

const REGION_OPTIONS: { value: RegionCode; label: string }[] = [
  { value: 'US', label: 'US' },
  { value: 'IN', label: 'India' },
  { value: 'CA', label: 'Canada' },
];

const defaultStart = (): { month: number; year: number } => {
  const now = new Date();
  const m = now.getMonth() + 2; // next month, 1-12
  return m > 12 ? { month: 1, year: now.getFullYear() + 1 } : { month: m, year: now.getFullYear() };
};

const num = (s: string): number => (s.trim() === '' ? 0 : Number(s));

// What the person asked for, locked in when Calculate is pressed.
interface Committed {
  inputs: AutoLoanInputs;
  result: AutoLoanResult;
  terms: TermComparisonRow[];
  sig: string;
  hasExtras: boolean;
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const AutoLoanCalculator: React.FC<AutoLoanCalculatorProps> = ({
  preset,
  onReportChange,
  onCalculationComplete,
  onDownloadReport,
  downloadingFormat = null,
  onShare,
  onEmailShare,
  onCopyLink,
  linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // A preset only seeds the starting state (read once). It never pre-fills a number.
  const [initialRegion] = useState<RegionCode>(() => (preset?.region && preset.region in AUTO_REGION_PROFILES ? preset.region : 'US'));
  const initialRateType: 'reducing' | 'flat' =
    preset?.rateType === 'flat' && AUTO_REGION_PROFILES[initialRegion].supportsFlatRate ? 'flat' : 'reducing';

  const [region, setRegion] = useState<RegionCode>(initialRegion);
  const profile = AUTO_REGION_PROFILES[region];

  const [price, setPrice] = useState<string>('');
  const [downMode, setDownMode] = useState<AmountMode>('percent');
  const [down, setDown] = useState<string>('');
  const [tradeInValue, setTradeInValue] = useState<string>('');
  const [tradeInOwed, setTradeInOwed] = useState<string>('');
  const [rebate, setRebate] = useState<string>('');
  const [taxRate, setTaxRate] = useState<string>('');
  const [tradeInReducesTax, setTradeInReducesTax] = useState<boolean>(false);
  const [rebateReducesTax, setRebateReducesTax] = useState<boolean>(false);
  const [taxableFees, setTaxableFees] = useState<string>('');
  const [nonTaxableFees, setNonTaxableFees] = useState<string>('');
  const [procFee, setProcFee] = useState<string>('');
  const [gstFee, setGstFee] = useState<string>('');
  const [financeExtras, setFinanceExtras] = useState<boolean>(true);
  const [rateType, setRateType] = useState<'reducing' | 'flat'>(initialRateType);
  const [apr, setApr] = useState<string>('');
  const [termUnit, setTermUnit] = useState<'months' | 'years'>('months');
  const [term, setTerm] = useState<string>('');
  const [startMonth, setStartMonth] = useState<number>(() => defaultStart().month);
  const [startYear, setStartYear] = useState<string>(() => String(defaultStart().year));
  const [exMonthly, setExMonthly] = useState<string>('');
  const [exOneAmount, setExOneAmount] = useState<string>('');
  const [exOneWhen, setExOneWhen] = useState<MonthYear | null>(null); // null = follows the first payment month

  const [tradeOpen, setTradeOpen] = useState<boolean>(() => !!preset?.openTradeIn);
  const [taxOpen, setTaxOpen] = useState<boolean>(false);
  const [extrasOpen, setExtrasOpen] = useState<boolean>(() => !!preset?.openExtras);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<boolean>(false);
  const [committed, setCommitted] = useState<Committed | null>(null);

  const sym = useMemo(() => currencySymbol(profile.locale, profile.currency), [profile]);
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(profile.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1)))
    ),
    [profile.locale]
  );
  const money = (n: number, dp = 0): string => formatMoney(n, profile.locale, profile.currency, dp);

  const clearErr = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  // A text-field handler that also clears that field's error and marks the form as touched.
  const upd = (setter: (v: string) => void, ...keys: string[]) => (v: string) => {
    setter(v);
    if (keys.length) clearErr(...keys);
    setTouched(true);
  };

  // --- Derived numbers used by hints and checks ---
  const priceNum = parseNum(price);
  const termRaw = parseNum(term);
  const termMonths = Number.isFinite(termRaw) ? (termUnit === 'years' ? Math.round(termRaw * 12) : termRaw) : NaN;
  const aprNum = parseNum(apr);
  const startYearInt = parseNum(startYear);
  const showTax = profile.showSalesTax;
  const isFlat = profile.supportsFlatRate && rateType === 'flat';

  const downPreview = useMemo(() => {
    const p = parseNum(price);
    const d = down.trim() === '' ? 0 : Number(down);
    if (!(p > 0) || !Number.isFinite(d)) return null;
    const amt = downMode === 'percent' ? (p * d) / 100 : d;
    if (amt >= p) return null;
    return { amt, pct: (amt / p) * 100, loan: p - amt };
  }, [price, down, downMode]);

  const liveTermError =
    Number.isFinite(termMonths) && termMonths > profile.maxTermMonths
      ? `Loan term cannot be longer than ${profile.maxTermMonths} months for ${profile.label}.`
      : undefined;

  // One-time extra: month and year turned into a payment number (1 = the first payment month).
  const resolveYM = (v: MonthYear | null): MonthYear => v ?? { month: startMonth, year: startYear };
  const oneTimeIndex = (): number => {
    const w = resolveYM(exOneWhen);
    const y = parseNum(w.year);
    if (!Number.isFinite(y) || !Number.isFinite(startYearInt)) return NaN;
    return (y - startYearInt) * 12 + (w.month - startMonth) + 1;
  };

  // --- Handlers ---
  const handleRegionChange = (r: RegionCode) => {
    if (r === region) return;
    setRegion(r);
    if (!AUTO_REGION_PROFILES[r].supportsFlatRate) setRateType('reducing');
    setErrors({});
    setTouched(true);
  };

  const handleDownModeChange = (m: AmountMode) => {
    if (m === downMode) return;
    setDown(convertAmount(down, downMode, m, priceNum));
    setDownMode(m);
    clearErr('down');
    setTouched(true);
  };

  const handleTermUnit = (u: 'months' | 'years') => {
    if (u === termUnit) return;
    const v = parseNum(term);
    if (Number.isFinite(v)) setTerm(u === 'years' ? trimNum(v / 12, 2) : String(Math.round(v * 12)));
    setTermUnit(u);
    clearErr('termMonths');
    setTouched(true);
  };

  const handleRateType = (t: 'reducing' | 'flat') => {
    if (t === rateType) return;
    setRateType(t);
    clearErr('aprPct', 'rateType');
    setTouched(true);
  };

  const isCalculateDisabled = price.trim() === '' || apr.trim() === '' || term.trim() === '';
  const isClearDisabled = !touched && !committed;

  const handleClear = () => {
    if (isClearDisabled) return;
    setPrice(''); setDownMode('percent'); setDown('');
    setTradeInValue(''); setTradeInOwed(''); setRebate('');
    setTaxRate(''); setTradeInReducesTax(false); setRebateReducesTax(false);
    setTaxableFees(''); setNonTaxableFees(''); setProcFee(''); setGstFee('');
    setFinanceExtras(true);
    setRateType(profile.supportsFlatRate ? initialRateType : 'reducing');
    setApr(''); setTermUnit('months'); setTerm('');
    const s = defaultStart();
    setStartMonth(s.month); setStartYear(String(s.year));
    setExMonthly(''); setExOneAmount(''); setExOneWhen(null);
    setErrors({});
    setCommitted(null);
    setTouched(false);
  };

  const buildInputs = (): AutoLoanInputs => {
    const oneAmt = num(exOneAmount);
    const monthly = num(exMonthly);
    return {
      region,
      price: priceNum,
      down: { mode: downMode, value: num(down) },
      tradeInValue: num(tradeInValue),
      tradeInOwed: num(tradeInOwed),
      rebate: num(rebate),
      // Fields that are hidden for a region are not used for that region.
      taxRatePct: showTax ? num(taxRate) : 0,
      tradeInReducesTax: showTax && tradeInReducesTax,
      rebateReducesTax: showTax && rebateReducesTax,
      taxableFees: showTax ? num(taxableFees) : 0,
      nonTaxableFees: showTax ? num(nonTaxableFees) : 0,
      processingFeePct: profile.hasProcessingFee ? num(procFee) : undefined,
      gstOnFeePct: profile.hasProcessingFee ? num(gstFee) : undefined,
      financeTaxesAndFees: financeExtras,
      rateType: isFlat ? 'flat' : 'reducing',
      aprPct: aprNum,
      termMonths,
      startMonth,
      startYear: startYearInt,
      extraMonthly: monthly > 0 ? monthly : 0,
      extraOneTime: oneAmt > 0 ? { amount: oneAmt, monthIndex: oneTimeIndex() } : undefined,
    };
  };

  // A fingerprint of every field. If it differs from the one saved at Calculate, the shown result is out of date.
  const formSignature = (): string =>
    JSON.stringify([
      region, price, downMode, down, tradeInValue, tradeInOwed, rebate, taxRate, tradeInReducesTax, rebateReducesTax,
      taxableFees, nonTaxableFees, procFee, gstFee, financeExtras, rateType, apr, termUnit, term, startMonth, startYear,
      exMonthly, exOneAmount, exOneWhen,
    ]);
  const stale = committed !== null && committed.sig !== formSignature();

  const extraDateErrors = (termM: number): Record<string, string> => {
    const out: Record<string, string> = {};
    if (num(exOneAmount) > 0) {
      const idx = oneTimeIndex();
      if (!Number.isFinite(idx) || idx < 1) {
        out.extraOneTime = `Choose ${monthNames[startMonth - 1]} ${startYear} or later, your first payment month.`;
      } else if (Number.isFinite(termM) && idx > termM) {
        out.extraOneTime = 'Choose a date within your loan term.';
      }
    }
    return out;
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;
    const inputs = buildInputs();
    let outcome: ReturnType<typeof calculateAutoLoan>;
    try {
      outcome = calculateAutoLoan(inputs);
    } catch (_err) {
      setErrors({ form: 'Something went wrong while calculating. Please check your entries and try again.' });
      setCommitted(null);
      return;
    }
    const dateErrs = extraDateErrors(inputs.termMonths);
    if (!outcome.ok || Object.keys(dateErrs).length > 0) {
      const merged: Record<string, string> = { ...(outcome.ok ? {} : (outcome.errors as Record<string, string>)), ...dateErrs };
      setErrors(merged);
      setCommitted(null);
      if (['tradeInValue', 'tradeInOwed', 'rebate'].some((k) => k in merged)) setTradeOpen(true);
      if (['taxRatePct', 'taxableFees', 'nonTaxableFees', 'processingFeePct', 'gstOnFeePct'].some((k) => k in merged)) setTaxOpen(true);
      if (['extraMonthly', 'extraOneTime'].some((k) => k in merged)) setExtrasOpen(true);
      return;
    }

    const termList = Array.from(new Set<number>([...TERM_COMPARE_MONTHS, inputs.termMonths])).sort((a, b) => a - b);
    const terms = outcome.result.status === 'ok' ? compareTerms(inputs, termList) : [];
    setErrors({});
    setCommitted({
      inputs,
      result: outcome.result,
      terms,
      sig: formSignature(),
      hasExtras: (inputs.extraMonthly ?? 0) > 0 || !!inputs.extraOneTime,
    });
    if (onCalculationComplete) onCalculationComplete();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  };

  // --- SHAREABLE REPORT (built from the locked-in result; the page turns it into the PNG and PDF) ---
  const report = useMemo<ShareableReport | null>(() => {
    if (!committed) return null;
    const { inputs, result: r } = committed;
    const pr = AUTO_REGION_PROFILES[inputs.region];
    const loc = pr.locale;
    const cur = pr.currency;
    const f0 = (n: number) => formatMoney(n, loc, cur, 0);
    const f2 = (n: number) => formatMoney(n, loc, cur, 2);
    const flat = inputs.rateType === 'flat';
    const rateText = flat ? `${trimNum(inputs.aprPct, 3)}% flat` : `${trimNum(inputs.aprPct, 3)}% APR`;
    type Row = { label: string; value: string };

    const loanRows: Row[] = [];
    if (r.status === 'ok') {
      loanRows.push(
        { label: 'Monthly payment', value: f2(r.payment) },
        { label: 'Amount financed', value: f2(r.amountFinanced) },
        { label: 'Total interest', value: f2(r.totalInterest) },
        { label: 'Total paid', value: f2(r.totalPaid) },
        { label: 'Payoff date', value: r.payoffDate ? `${formatMonthYear(r.payoffDate.year, r.payoffDate.month, loc)} (${formatDuration(r.numberOfPayments)})` : '' },
      );
    }
    loanRows.push(
      { label: 'Cash due at signing', value: f2(r.cashDueAtSigning) },
      { label: 'Total out of pocket', value: f2(r.totalOutOfPocket) },
    );
    const loanSection = { heading: 'Loan Summary', rows: loanRows, variant: 'output' as const };

    const financeRows: Row[] = r.breakdown.map((l) => ({
      label: l.id === 'price' ? pr.priceLabel : l.label,
      value: `${l.id === 'price' ? '' : l.amount < 0 ? '- ' : '+ '}${f2(Math.abs(l.amount))}`,
    }));
    financeRows.push({ label: 'Amount financed', value: f2(r.amountFinanced) });
    const financeSection = { heading: 'What You Are Financing', rows: financeRows, variant: 'output' as const };

    const sections: ShareableReport['sections'] = [loanSection, financeSection];
    if (r.savings) {
      sections.push({
        heading: 'Extra Payment Savings',
        rows: [
          { label: 'Interest saved', value: f2(r.savings.interestSaved) },
          { label: 'Paid off sooner', value: formatDuration(r.savings.monthsSaved) },
        ],
        variant: 'output',
      });
    }

    // --- inputs recap (PDF only): every value that was used ---
    const inRows: Row[] = [
      { label: 'Region', value: pr.label },
      { label: pr.priceLabel, value: f2(inputs.price) },
      { label: 'Down payment', value: inputs.down.mode === 'percent' ? `${trimNum(inputs.down.value, 3)}% (${f2(r.downAmount)})` : f2(r.downAmount) },
    ];
    if (inputs.tradeInValue > 0) inRows.push({ label: 'Trade-in value', value: f2(inputs.tradeInValue) });
    if (inputs.tradeInOwed > 0) inRows.push({ label: 'Owed on trade-in', value: f2(inputs.tradeInOwed) });
    if (inputs.rebate > 0) inRows.push({ label: 'Rebates', value: f2(inputs.rebate) });
    if (pr.showSalesTax) {
      if (inputs.taxRatePct > 0) {
        inRows.push({ label: 'Sales tax rate', value: `${trimNum(inputs.taxRatePct, 3)}%` });
        inRows.push({ label: 'Trade-in lowers taxable amount', value: inputs.tradeInReducesTax ? 'Yes' : 'No' });
        inRows.push({ label: 'Rebate lowers taxable amount', value: inputs.rebateReducesTax ? 'Yes' : 'No' });
      }
      if (inputs.taxableFees > 0) inRows.push({ label: 'Taxable fees', value: f2(inputs.taxableFees) });
      if (inputs.nonTaxableFees > 0) inRows.push({ label: 'Non-taxable fees', value: f2(inputs.nonTaxableFees) });
    }
    if (pr.hasProcessingFee) {
      inRows.push({ label: 'Processing fee', value: `${trimNum(inputs.processingFeePct ?? 0, 3)}%` });
      inRows.push({ label: 'GST on the fee', value: `${trimNum(inputs.gstOnFeePct ?? 0, 3)}%` });
    }
    inRows.push(
      { label: 'Taxes and fees', value: inputs.financeTaxesAndFees ? 'Added to the loan' : 'Paid up front' },
      { label: flat ? 'Flat interest rate' : 'Interest rate (APR)', value: `${trimNum(inputs.aprPct, 3)}%${flat ? ` flat (about ${trimNum(r.effectiveAprPct, 2)}% reducing)` : ''}` },
      { label: 'Loan term', value: `${inputs.termMonths} months` },
      { label: 'First payment', value: formatMonthYear(inputs.startYear ?? 0, inputs.startMonth ?? 1, loc) },
    );
    if ((inputs.extraMonthly ?? 0) > 0) inRows.push({ label: 'Extra every month', value: f2(inputs.extraMonthly ?? 0) });
    if (inputs.extraOneTime) inRows.push({ label: 'One-time extra payment', value: `${f2(inputs.extraOneTime.amount)} with payment ${inputs.extraOneTime.monthIndex}` });

    const yearRows: Row[] = r.yearRows.map((y) => ({
      label: String(y.year),
      value: `Paid ${f0(y.payments)} | Interest ${f0(y.interest)} | Balance ${f0(y.endBalance)}`,
    }));

    const pdfOnly: NonNullable<ShareableReport['pdfOnlySections']> = [{ heading: 'Your Inputs', rows: inRows, variant: 'input' }];
    if (yearRows.length > 0) pdfOnly.push({ heading: 'Year-by-Year Summary', rows: yearRows, variant: 'output' });

    return {
      title: 'AUTO LOAN RESULT',
      headlineValue: r.status === 'ok' ? f2(r.payment) : 'No loan needed',
      headlineLabel: r.status === 'ok' ? `per month for ${inputs.termMonths} months at ${rateText}` : 'down payment and trade-in cover the cost',
      accentColor: ACCENT.hex,
      meta: [pr.label, cur],
      sections,
      imageSections: [loanSection],
      pdfOnlySections: pdfOnly,
      disclaimer: 'Estimate only, not a lender quote or financial advice; your lender\'s terms decide the real figures.',
      fileNameBase: 'auto-loan-result',
    };
  }, [committed]);

  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  // --- DOWNLOAD MENU + SHARE BAR (Phase 3) ---
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

  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!report || downloadingFormat !== null}
        aria-haspopup="menu"
        aria-expanded={downloadMenuOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
        <button type="button" onClick={() => onShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60" title="Share this calculator" aria-label="Share this calculator">
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onEmailShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60" title="Share via email" aria-label="Share via email">
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onCopyLink?.()} className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'alc-linkbtn hover:shadow-md hover:-translate-y-0.5'}`} title="Copy link to this calculator" aria-label={linkCopied ? 'Link copied' : 'Copy link to this calculator'}>
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? 'Copied' : 'Link'}</span>
        </button>
      </div>
    </div>
  );

  const hasError = Object.keys(errors).length > 0;

  // --- RESULTS ---
  const renderResults = () => {
    if (!committed) return null;
    const { inputs, result: r, terms, hasExtras } = committed;
    const pr = AUTO_REGION_PROFILES[inputs.region];
    const loc = pr.locale;
    const cur = pr.currency;
    const fmt0 = (n: number) => formatMoney(n, loc, cur, 0);
    const fmt2 = (n: number) => formatMoney(n, loc, cur, 2);
    const flat = inputs.rateType === 'flat';
    const upfront = Math.max(0, r.cashDueAtSigning - r.downAmount);

    const receipt = (
      <ReceiptCard
        lines={r.breakdown}
        priceLabel={pr.priceLabel}
        amountFinanced={r.amountFinanced}
        cashDue={r.cashDueAtSigning}
        upfrontExtras={upfront}
        fmt2={fmt2}
        tip="Every line adds up to the amount you borrow. Compare it with the dealer's paperwork: if a line is missing or different, ask why."
      />
    );

    const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', rowGap: 20 };

    if (r.status === 'no-loan') {
      return (
        <div style={wrapStyle} role="region" aria-label="Auto loan results">
          <div className="flex justify-end pb-3">{renderDownloadButtons()}</div>
          <NoLoanCard cashDue={r.cashDueAtSigning} surplus={r.surplusCredit} fmt2={fmt2} />
          {receipt}
        </div>
      );
    }

    const caption = flat
      ? `per month for ${inputs.termMonths} months at a ${trimNum(inputs.aprPct, 3)}% flat rate (about ${trimNum(r.effectiveAprPct, 2)}% a year on the reducing balance)`
      : `per month for ${inputs.termMonths} months at ${trimNum(inputs.aprPct, 3)}% APR`;
    const heroFacts = [
      flat
        ? { k: 'Flat rate', v: `${trimNum(inputs.aprPct, 3)}%`, s: `about ${trimNum(r.effectiveAprPct, 2)}% reducing` }
        : { k: 'Interest rate', v: `${trimNum(inputs.aprPct, 3)}% APR` },
      { k: 'Loan term', v: formatDuration(inputs.termMonths), s: inputs.termMonths >= 12 ? `${inputs.termMonths} months` : undefined },
      { k: 'Cash due at signing', v: fmt2(r.cashDueAtSigning) },
      { k: 'Region', v: pr.label },
    ];

    const interestShare = r.totalPaid > 0 ? (r.totalInterest / r.totalPaid) * 100 : 0;
    const tiles: React.ComponentProps<typeof LoanSummaryCard>['tiles'] = [
      { label: 'Amount financed', value: fmt0(r.amountFinanced), sub: `${trimNum(r.ltvPct, 1)}% of the price`, tone: 'orange' },
      { label: 'Total interest', value: fmt0(r.totalInterest), sub: `${trimNum(interestShare, 1)}% of total paid`, tone: 'rose' },
      { label: 'Total paid', value: fmt0(r.totalPaid), sub: 'Loan plus interest', tone: 'sky' },
      {
        label: 'Payoff date',
        value: r.payoffDate ? formatMonthYear(r.payoffDate.year, r.payoffDate.month, loc) : '-',
        sub: formatDuration(r.numberOfPayments),
        tone: 'amber',
      },
    ];

    const taxAndFees = r.salesTax + r.totalFees;
    const principalPart = Math.max(0, r.totalOutOfPocket - r.downAmount - taxAndFees - r.totalInterest);
    const ringSlices: RingSlice[] = [
      { key: 'principal', label: 'Vehicle cost (principal)', value: principalPart, color: '#10b981' },
      { key: 'interest', label: 'Interest', value: r.totalInterest, color: '#f43f5e' },
      { key: 'tax', label: 'Taxes and fees', value: taxAndFees, color: '#0ea5e9' },
      { key: 'down', label: 'Down payment', value: r.downAmount, color: '#f59e0b' },
    ].filter((sl) => sl.value > 0.004);

    const balancePoints: BalancePoint[] = [{ month: 0, balance: r.amountFinanced, interest: 0, label: 'Loan start' }];
    let cum = 0;
    r.schedule.forEach((row) => {
      cum += row.interest;
      balancePoints.push({ month: row.number, balance: row.balance, interest: cum, label: formatMonthYear(row.year, row.month, loc) });
    });

    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 50, damping: 12, mass: 0.8 }}
        style={wrapStyle}
        role="region"
        aria-label="Auto loan results"
      >
        <p className="alc-sr" role="status">
          Result updated. Monthly payment {fmt2(r.payment)}. Amount financed {fmt0(r.amountFinanced)}. Total interest {fmt0(r.totalInterest)}.
          {r.payoffDate ? ` Paid off in ${formatMonthYear(r.payoffDate.year, r.payoffDate.month, loc)}.` : ''}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">Your Auto Loan Results</h3>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {renderDownloadButtons()}
          </div>
        </div>

        <PaymentHero
          text={fmt2(r.payment)}
          caption={caption}
          facts={heroFacts}
          note={`This is an estimate, not a lender quote. Final figures depend on the lender's fees, taxes and rounding.${hasExtras ? ' The payment shown is the scheduled one; your extra payments come on top of it.' : ''}`}
        />

        <LoanSummaryCard
          tiles={tiles}
          tip="The totals cover the loan itself. Cash you pay at signing, such as your down payment, is shown in the list below."
        />

        {receipt}

        {r.warnings.length > 0 && (
          <WarningsCard warnings={r.warnings} negativeEquity={r.negativeEquity} ltvPct={r.ltvPct} termMonths={inputs.termMonths} fmt0={fmt0} />
        )}

        <MoneyBreakdownCard
          slices={ringSlices}
          centerLabel="Total cash out"
          centerValue={compactMoney(r.totalOutOfPocket, loc, cur)}
          fmt={fmt0}
          tip="Cash you pay at signing plus every loan payment, split into what each part is for. Tap a row to highlight it."
        />

        <BalanceOverTimeCard
          points={balancePoints}
          locale={loc}
          currency={cur}
          fmt={fmt0}
          tip="At the start most of each payment goes to interest, so the balance falls slowly and then faster."
        />

        {terms.length > 0 && (
          <TermsCard
            rows={terms}
            currentTerm={inputs.termMonths}
            hasExtras={hasExtras}
            fmt0={fmt0}
            fmt2={fmt2}
            tip="The same loan at the same rate over other lengths. A longer term lowers the payment but usually costs more in total."
          />
        )}

        {r.savings && (
          <SavingsCard
            savings={r.savings}
            payments={r.numberOfPayments}
            fmt0={fmt0}
            fmt2={fmt2}
            tip="Compares your plan with paying only the scheduled payment. Interest saved is interest you no longer owe the lender."
          />
        )}

        <ScheduleCard
          rows={r.schedule}
          years={r.yearRows}
          locale={loc}
          fmt2={fmt2}
          tip="Where each payment goes. Extra payments, if you added any, are shown in their own column."
        />
      </motion.div>
    );
  };

  // --- Small derived bits for the form ---
  const filledTradeCount = [tradeInValue, tradeInOwed, rebate].filter((v) => v.trim() !== '').length;
  const filledTaxCount = (showTax ? [taxRate, taxableFees, nonTaxableFees] : [procFee, gstFee]).filter((v) => v.trim() !== '').length;
  const filledExtraCount = (exMonthly.trim() !== '' ? 1 : 0) + (exOneAmount.trim() !== '' ? 1 : 0);

  const tvNum = num(tradeInValue);
  const toNum = num(tradeInOwed);
  let equityHint: string | undefined;
  if (tvNum > 0 || toNum > 0) {
    const diff = tvNum - toNum;
    if (diff > 0) equityHint = `After your old loan is paid off, about ${money(diff)} is left to put towards the new vehicle.`;
    else if (diff < 0) equityHint = `You owe about ${money(-diff)} more than it is worth. That extra amount is added to your new loan.`;
  }

  const termHint =
    Number.isFinite(termMonths) && termMonths > 0 && !liveTermError
      ? termUnit === 'years'
        ? `That is ${termMonths} months.`
        : termMonths >= 12 ? `That is ${formatDuration(termMonths)}.` : undefined
      : undefined;

  const flatHint =
    isFlat && aprNum > 0 && Number.isFinite(termMonths) && termMonths >= 1 && termMonths <= profile.maxTermMonths
      ? `A ${trimNum(aprNum, 3)}% flat rate over ${termMonths} months costs about the same as a ${trimNum(flatToReducingApr(aprNum, termMonths), 2)}% reducing rate.`
      : isFlat
        ? 'A flat rate charges interest on the full amount for the whole loan, so it costs more than the same number as a reducing rate.'
        : 'The yearly rate on your loan quote. Each month, interest is charged only on the amount you still owe.';

  const errTerm = errors.termMonths ?? liveTermError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 20 }}>
      <style>{selectOptionThemeCSS + ALC_CSS}</style>

      {/* 1. VEHICLE + LOAN (one card) */}
      <InputCard title="Basic details" subtitle="Start here. Pick your country, then enter the vehicle price and the interest rate and term from your loan quote.">
        {errors.form && (
          <p role="alert" className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
            <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
            {errors.form}
          </p>
        )}

        <div>
          <div className={fieldLabelRowClass}>
            <span className={fieldLabelClass}>Country</span>
            <InfoTip text="Pick where you are buying the vehicle. This sets the currency, the tax and fee fields, and the longest loan term allowed. It does not change how interest is worked out." />
          </div>
          <SegmentedToggle<RegionCode>
            value={region}
            onChange={handleRegionChange}
            groupId={`${uid}-region`}
            ariaLabel="Country"
            options={REGION_OPTIONS}
          />
          <FieldError id={`${uid}-region-err`} message={errors.region} />
        </div>

        <div style={FIELD_GRID_STYLE}>
          <MoneyField
            id={`${uid}-price`}
            label={profile.priceLabel}
            tip={region === 'IN'
              ? 'The full on-road price: what you pay the dealer, with GST, registration and insurance already included. Do not take off your down payment here.'
              : 'The price of the vehicle by itself. Do not take off your down payment or trade-in here, and do not add tax or fees. You can add those in the next steps.'}
            sym={sym}
            value={price}
            onChange={upd(setPrice, 'price', 'down')}
            locale={profile.locale}
            error={errors.price}
            hint={region === 'IN' && priceNum >= 1e5 ? `${sym}${indianWords(priceNum)}` : undefined}
            reserve
          />
          <UnitField
            id={`${uid}-down`}
            label="Down payment"
            tag="optional"
            tip="The money you pay from your own pocket at the start, so you borrow less. Type it as a percent of the price (such as 20) or as an amount. Leave it blank if you are paying nothing up front."
            groupId={`${uid}-down-mode`}
            mode={downMode}
            onModeChange={handleDownModeChange}
            sym={sym}
            value={down}
            onChange={upd(setDown, 'down')}
            locale={profile.locale}
            modeAriaLabel="Down payment entry type"
            error={errors.down}
            hint={
              downPreview && down.trim() !== ''
                ? downMode === 'percent'
                  ? `That is ${money(downPreview.amt)} paid up front.`
                  : `That is ${downPreview.pct.toLocaleString(profile.locale, { maximumFractionDigits: 2 })}% of the price.`
                : 'Use the % or currency button above to choose how you type it.'
            }
          />
        </div>

        <div style={FIELD_GRID_STYLE}>
          <div className="min-w-0">
            <FieldLabel
              htmlFor={`${uid}-apr`}
              label={isFlat ? 'Flat interest rate' : 'Interest rate (APR)'}
                tip={isFlat
                ? 'A flat rate charges interest on the full amount you borrowed for the whole loan, even as you pay it back. The same number costs more than a reducing rate. Use this only if your quote says "flat".'
                : profile.supportsFlatRate
                  ? 'The yearly interest rate on your loan quote. A reducing rate charges interest only on the amount you still owe. Choose Flat only if your quote says "flat rate". Type 0 if the loan has no interest.'
                  : 'The yearly interest rate on your loan quote. APR means the rate for one year. Type 0 if the loan has no interest.'}
              right={profile.supportsFlatRate ? (
                <SegmentedToggle<'reducing' | 'flat'>
                  size="xs"
                  value={rateType}
                  onChange={handleRateType}
                  groupId={`${uid}-rate-type`}
                  ariaLabel="Interest rate type"
                  options={[{ value: 'reducing', label: 'Reducing' }, { value: 'flat', label: 'Flat' }]}
                />
              ) : undefined}
              reserve
            />
            <NumField
              id={`${uid}-apr`}
              value={apr}
              onChange={upd(setApr, 'aprPct', 'rateType')}
              suffix={isFlat ? '% flat' : '% / yr'}
              maxDecimals={3}
              maxInt={2}
              placeholder="0"
              error={Boolean(errors.aprPct || errors.rateType)}
              describedBy={errors.aprPct || errors.rateType ? `${uid}-apr-err` : `${uid}-apr-hint`}
            />
            <FieldError id={`${uid}-apr-err`} message={errors.aprPct ?? errors.rateType} />
            {!errors.aprPct && !errors.rateType && <p id={`${uid}-apr-hint`} className={hintClass}>{flatHint}</p>}
          </div>

          <div className="min-w-0">
            <FieldLabel
              htmlFor={`${uid}-term`}
              label="Loan term"
                tip={`How long you will take to repay the loan. Type it in months or in years. The longest this calculator allows for ${profile.label} is ${profile.maxTermMonths} months (${profile.maxTermMonths / 12} years).`}
              right={
                <SegmentedToggle<'months' | 'years'>
                  size="xs"
                  value={termUnit}
                  onChange={handleTermUnit}
                  groupId={`${uid}-term-unit`}
                  ariaLabel="Loan term unit"
                  options={[{ value: 'months', label: 'Months' }, { value: 'years', label: 'Years' }]}
                />
              }
            />
            <NumField
              id={`${uid}-term`}
              value={term}
              onChange={upd(setTerm, 'termMonths')}
              suffix={termUnit}
              maxDecimals={termUnit === 'years' ? 2 : 0}
              maxInt={3}
              placeholder="0"
              error={Boolean(errTerm)}
              describedBy={errTerm ? `${uid}-term-err` : `${uid}-term-hint`}
            />
            <FieldError id={`${uid}-term-err`} message={errTerm} />
            {!errTerm && <p id={`${uid}-term-hint`} className={hintClass}>{termHint ?? 'Example: 60 months is the same as 5 years.'}</p>}
          </div>

          <MonthYearField
            id={`${uid}-start`}
            label="First payment"
            tag="optional"
            tip="The month your first payment is due. If you do not change it, we assume next month. It only changes the dates in the results, not the amount you pay."
            month={startMonth}
            year={startYear}
            monthNames={monthNames}
            onMonth={(m) => { setStartMonth(m); clearErr('startMonth', 'extraOneTime'); setTouched(true); }}
            onYear={(y) => { setStartYear(y); clearErr('startYear', 'extraOneTime'); setTouched(true); }}
            error={errors.startMonth ?? errors.startYear}
          />
        </div>
      </InputCard>

      {/* 2. TAXES AND FEES */}
      <CollapseCard
        id={`${uid}-taxes`}
        icon={FiPercent}
        title="Taxes and fees"
        tag="optional"
        subtitle={showTax ? 'Add these if your dealer quote shows them. Skip this if not.' : 'GST is already inside the on-road price, so only the lender’s processing fee goes here. Skip this if there is none.'}
        badge={filledTaxCount > 0 ? `${filledTaxCount} added` : undefined}
        open={taxOpen}
        onToggle={() => setTaxOpen((o) => !o)}
      >
        {showTax ? (
          <>
            <div style={FIELD_GRID_STYLE}>
              <PercentField
                id={`${uid}-tax`}
                label="Sales tax rate"
                tip="The sales tax percent charged where you will register the vehicle. It is on your dealer quote. If you leave it blank, the result will not include any sales tax."
                value={taxRate}
                onChange={upd(setTaxRate, 'taxRatePct')}
                error={errors.taxRatePct}
                hint="Example: type 7 for 7%."
                reserve
              />
              <div className="min-w-0" />
              <MoneyField
                id={`${uid}-tf`}
                label="Fees that are taxed"
                tip="Dealer fees, such as paperwork or admin fees, that sales tax also applies to. If you are not sure, ask your dealer."
                sym={sym}
                value={taxableFees}
                onChange={upd(setTaxableFees, 'taxableFees')}
                locale={profile.locale}
                error={errors.taxableFees}
                hint="Sales tax is added on top of these."
              />
              <MoneyField
                id={`${uid}-nf`}
                label="Fees that are not taxed"
                tip="Government fees such as title, registration and number plates. Sales tax does not apply to these."
                sym={sym}
                value={nonTaxableFees}
                onChange={upd(setNonTaxableFees, 'nonTaxableFees')}
                locale={profile.locale}
                error={errors.nonTaxableFees}
                hint="No sales tax is charged on these."
              />
            </div>
          </>
        ) : (
          <div style={FIELD_GRID_STYLE}>
            <PercentField
              id={`${uid}-pf`}
              label="Lender processing fee"
              tip="A one-time fee the bank charges for arranging the loan. Your sanction letter shows it as a percent of the loan. Leave blank if there is none."
              value={procFee}
              onChange={upd(setProcFee, 'processingFeePct')}
              error={errors.processingFeePct}
              hint="Worked out on the loan amount, before the fee is added."
              reserve
            />
            <PercentField
              id={`${uid}-gst`}
              label="GST on the processing fee"
              tip="Tax that the bank adds on its processing fee. Type the GST rate shown on your sanction letter. Leave blank if you are not sure."
              value={gstFee}
              onChange={upd(setGstFee, 'gstOnFeePct')}
              error={errors.gstOnFeePct}
              hint="GST is charged on the fee only, not on the whole loan."
              reserve
            />
          </div>
        )}
        <ToggleSwitch
          id={`${uid}-fin`}
          checked={financeExtras}
          onChange={(v) => { setFinanceExtras(v); setTouched(true); }}
          label="Include taxes and fees in the loan"
          hint="On: they are added to the amount you borrow, so you pay interest on them. Off: you pay them in cash when you sign."
        />
      </CollapseCard>

      {/* 3. TRADE-IN AND REBATES (collapsed unless a preset opens it) */}
      <CollapseCard
        id={`${uid}-trade`}
        icon={FiTruck}
        title="Trade-in and rebates"
        tag="optional"
        subtitle="Giving your old vehicle to the dealer, or getting a discount? Add it here. Skip this if not."
        badge={filledTradeCount > 0 ? `${filledTradeCount} added` : undefined}
        open={tradeOpen}
        onToggle={() => setTradeOpen((o) => !o)}
      >
        <div style={FIELD_GRID_STYLE}>
          <MoneyField
            id={`${uid}-tv`}
            label="Trade-in value (your old vehicle)"
            tip="The amount the dealer will give you for your old vehicle. It counts like extra money towards the new one."
            sym={sym}
            value={tradeInValue}
            onChange={upd(setTradeInValue, 'tradeInValue')}
            locale={profile.locale}
            error={errors.tradeInValue}
            hint="Leave blank if you are not trading in a vehicle."
          />
          <MoneyField
            id={`${uid}-to`}
            label="Loan still owed on your old vehicle"
            tip="How much you still owe the lender on your old vehicle. That amount is paid off first, from the trade-in value. Leave blank if it is fully paid off."
            sym={sym}
            value={tradeInOwed}
            onChange={upd(setTradeInOwed, 'tradeInOwed')}
            locale={profile.locale}
            error={errors.tradeInOwed}
            hint={equityHint ?? 'Leave blank if your old vehicle is fully paid off.'}
          />
          <MoneyField
            id={`${uid}-rb`}
            label="Rebates and cash-back offers"
            tip="Discounts from the maker or the dealer, such as a cash-back offer. They are taken off the amount you borrow."
            sym={sym}
            value={rebate}
            onChange={upd(setRebate, 'rebate')}
            locale={profile.locale}
            error={errors.rebate}
            hint="Leave blank if you have none."
          />
        </div>
        {showTax && tvNum > 0 && (
          <ToggleSwitch
            id={`${uid}-tr-tax`}
            checked={tradeInReducesTax}
            onChange={(v) => { setTradeInReducesTax(v); setTouched(true); }}
            label="Charge sales tax only on the price minus my trade-in"
            hint="Many US states and Canadian provinces work this way, but not all. Turn it on only if yours does. Off: tax is charged on the full price."
          />
        )}
        {showTax && num(rebate) > 0 && (
          <ToggleSwitch
            id={`${uid}-rb-tax`}
            checked={rebateReducesTax}
            onChange={(v) => { setRebateReducesTax(v); setTouched(true); }}
            label="Charge sales tax only on the price minus my rebates"
            hint="Most places still charge tax on the full price before a rebate. Turn this on only if your dealer quote says otherwise."
          />
        )}
      </CollapseCard>

      {/* 4. EXTRA PAYMENTS (collapsed unless a preset opens it) */}
      <CollapseCard
        id={`${uid}-extras`}
        icon={FiZap}
        title="Extra payments"
        tag="optional"
        subtitle="Want to finish sooner? See how much interest you save by paying a little extra. Skip this if not."
        badge={filledExtraCount > 0 ? `${filledExtraCount} added` : undefined}
        open={extrasOpen}
        onToggle={() => setExtrasOpen((o) => !o)}
      >
        <div style={FIELD_GRID_STYLE}>
          <MoneyField
            id={`${uid}-exm`}
            label="Extra amount every month"
            tip="An extra amount you add to every monthly payment. All of it goes towards what you owe, so the loan ends sooner."
            sym={sym}
            value={exMonthly}
            onChange={upd(setExMonthly, 'extraMonthly')}
            locale={profile.locale}
            error={errors.extraMonthly}
            hint={num(exMonthly) > 0 ? `That is about ${money(num(exMonthly) * 12)} extra a year, starting with your first payment.` : 'Starts with your first payment.'}
            reserve
          />
          <div className="min-w-0" />
          <MoneyField
            id={`${uid}-exo`}
            label="One-time extra payment"
            tip="A single lump sum paid once, such as a bonus or a tax refund."
            sym={sym}
            value={exOneAmount}
            onChange={upd(setExOneAmount, 'extraOneTime')}
            locale={profile.locale}
            hint="Paid once, in the month you choose on the right."
          />
          <MonthYearField
            id={`${uid}-exo-when`}
            label="Month of the lump sum"
            tip="When you will pay the lump sum. Until you choose a month, it uses your first payment month."
            month={resolveYM(exOneWhen).month}
            year={resolveYM(exOneWhen).year}
            monthNames={monthNames}
            onMonth={(m) => { setExOneWhen({ month: m, year: resolveYM(exOneWhen).year }); clearErr('extraOneTime'); setTouched(true); }}
            onYear={(y) => { setExOneWhen({ month: resolveYM(exOneWhen).month, year: y }); clearErr('extraOneTime'); setTouched(true); }}
            error={errors.extraOneTime}
          />
        </div>
      </CollapseCard>

      {hasError && !errors.form && (
        <p role="alert" className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0" />
          Please fix the highlighted fields, then press Calculate again.
        </p>
      )}

      {stale && !hasError && (
        <p className="alc-stale" role="status">
          <SafeIcon icon={FiInfo} aria-hidden="true" />
          <span>Your inputs changed. Press Calculate to update the results below.</span>
        </p>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex flex-col-reverse md:flex-row justify-center items-center gap-4 pt-4">
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
            background: '#4f46e5',
            boxShadow: '0 10px 20px -6px rgba(79,70,229,0.45), 0 4px 8px -2px rgba(79,70,229,0.25)',
          }}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-10 py-3.5 text-white text-sm font-semibold tracking-normal rounded-lg hover:brightness-[1.08] active:scale-[0.98] active:brightness-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
        >
          <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
          Calculate
        </button>
      </div>

      {isCalculateDisabled && (
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 text-center" role="status">
          To calculate, fill in: {[price.trim() === '' ? 'vehicle price' : '', apr.trim() === '' ? 'interest rate' : '', term.trim() === '' ? 'loan term' : ''].filter(Boolean).join(', ')}.
        </p>
      )}

      {/* EMPTY STATE */}
      {!committed && !hasError && <EmptyState prefersReducedMotion={prefersReducedMotion} />}

      {/* RESULTS */}
      <div ref={resultsRef} style={{ scrollMarginTop: 24 }}>
        {!hasError && renderResults()}
      </div>

      {/* DISCLAIMER (always visible) */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong>{' '}This calculator gives estimates for general information only. It is not a lender quote, a loan offer or financial, legal or tax advice. Your real payment depends on your lender&apos;s rate, fees, taxes, add-ons and rounding, and the rules we model are simplified. Please confirm the figures with your lender or dealer before you sign anything.
        </p>
      </div>

      {/* SOURCES */}
      <SourcesPanel reduced={prefersReducedMotion} />

      {/* SHARE BAR */}
      {renderShareBar()}
    </div>
  );
};

export default AutoLoanCalculator;
