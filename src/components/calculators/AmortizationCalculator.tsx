"use client";

/**
 * AmortizationCalculator.tsx
 *
 * Universal amortization calculator for Calculox — Phase 1.
 * Matches the AutoLoanCalculator / MortgageCalculator UI pattern exactly:
 *  - NumField: chip-in-flex-row prefix/suffix, groupDisplay, proper caret restore
 *  - MoneyField / PercentField wrappers
 *  - CollapseCard, InputCard, ResultSection, SegmentedToggle, InfoTip (portal)
 *  - Scoped .amc-* CSS, framer-motion collapses, recharts charts
 *  - ShareableReport with pdfOnlySections + imageSections
 *  - Sources drawer, share bar, download menu
 *
 * Accent: indigo (#4f46e5) — matches the site's Calculate button.
 * No region logic. Currency is display-only and never changes the maths.
 */

import React, {
  useState, useMemo, useRef, useEffect, useLayoutEffect,
  useCallback, useId,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import DateTimePicker from '@/components/common/DateTimePicker';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  calculateAmortization,
  validateAmortizationInputs,
  formatMoney,
  formatMonthsAsYearsMonths,
  periodsPerYearFor,
  scheduledPaymentCount,
  CURRENCY_OPTIONS,
  MAX_TERM_YEARS,
  DEFAULT_CURRENCY_SYMBOL,
  AMORTIZATION_SOURCES,
  AMORTIZATION_LAST_REVIEWED,
} from '@/utils/calculators/amortizationLogic';
import type {
  AmortizationInputs,
  AmortizationResult,
  AmortFrequency,
  ExtraFrequency,
  RecurringExtra,
  OneTimeExtra,
  ScheduleRow,
  YearRow,
} from '@/utils/calculators/amortizationLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiTrendingDown, FiCalendar, FiList, FiChevronDown,
  FiRotateCcw, FiCheckCircle, FiInfo, FiZap,
  FiFileText, FiExternalLink, FiArrowDown, FiBarChart2,
  FiDownload, FiLoader, FiImage, FiShare2, FiMail, FiCopy,
  FiCheck, FiAlertCircle,
  FiPercent, FiDollarSign, FiHash,
} = FiIcons;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACCENT_HEX = '#4f46e5';
const SCHEDULE_PREVIEW = 12;

const FREQ_OPTIONS: { value: AmortFrequency; label: string }[] = [
  { value: 'monthly',      label: 'Monthly'      },
  { value: 'semi-monthly', label: 'Semi-monthly' },
  { value: 'biweekly',     label: 'Bi-weekly'    },
  { value: 'weekly',       label: 'Weekly'       },
];

const EXTRA_FREQ_OPTIONS: { value: ExtraFrequency; label: string }[] = [
  { value: 'weekly',      label: 'Weekly'      },
  { value: 'monthly',     label: 'Monthly'     },
  { value: 'quarterly',   label: 'Quarterly'   },
  { value: 'half-yearly', label: 'Half-yearly' },
  { value: 'yearly',      label: 'Yearly'      },
];

const EXTRA_EVERY: Record<ExtraFrequency, string> = {
  weekly: 'every week', monthly: 'every month', quarterly: 'every 3 months',
  'half-yearly': 'every 6 months', yearly: 'every year',
};
const EXTRA_PER_YEAR: Record<ExtraFrequency, number> = {
  weekly: 52, monthly: 12, quarterly: 4, 'half-yearly': 2, yearly: 1,
};

/** The single "regular extra": amount, how often, optional start and end payment. */
type RegularExtra = {
  amount: string; frequency: ExtraFrequency;
  startYears: string; startMonths: string; endYears: string; endMonths: string;
};
const EMPTY_REGULAR: RegularExtra = {
  amount: '', frequency: 'monthly', startYears: '', startMonths: '', endYears: '', endMonths: '',
};

/** The single one-time payment (a lump sum), placed by payment number or by date. */
type OneTimeExtraState = { amount: string; byDate: boolean; payment: string; date: string };
const EMPTY_ONE_TIME: OneTimeExtraState = { amount: '', byDate: false, payment: '', date: '' };

/** "2 yrs" + "6 mo" -> 30 months. Blank counts as 0. */
function durationMonths(years: string, months: string): number {
  return (parseInt(years || '0', 10) || 0) * 12 + (parseInt(months || '0', 10) || 0);
}
/** How many regular payments fall inside a span of months for the loan's payment frequency. */
function paymentsWithin(totalMonths: number, loanFreq: AmortFrequency): number {
  return Math.round((totalMonths * periodsPerYearFor(loanFreq)) / 12);
}
/** Effective annual rate (as a percent) when interest is charged k times a year at rate/k each time. */
function effectiveAnnualRatePct(nominalPct: number, periodsPerYear: number): number {
  if (!(periodsPerYear > 0)) return nominalPct;
  return (Math.pow(1 + nominalPct / 100 / periodsPerYear, periodsPerYear) - 1) * 100;
}
const sumCents = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/**
 * What one payment costs while the regular extra runs: scheduled payment + extra.
 * Exact when the extra has the same rhythm as the loan (monthly/monthly, weekly/weekly);
 * otherwise an average per payment, flagged so the page can say "about".
 */
function paymentWithExtra(regularPayment: number, extra: { amount: number; frequency: ExtraFrequency } | undefined, loanFreq: AmortFrequency): { amount: number; exact: boolean } | null {
  if (!extra || !(extra.amount > 0)) return null;
  const exact = (loanFreq === 'monthly' && extra.frequency === 'monthly') || (loanFreq === 'weekly' && extra.frequency === 'weekly');
  const perPayment = exact ? extra.amount : (extra.amount * EXTRA_PER_YEAR[extra.frequency]) / periodsPerYearFor(loanFreq);
  return { amount: Math.round((regularPayment + perPayment) * 100) / 100, exact };
}

/** The payment number an extra "starting after N months" first lands on (blank/0 = payment 1). */
function startPaymentFor(startM: number, loanFreq: AmortFrequency): number {
  return startM > 0 ? paymentsWithin(startM, loanFreq) + 1 : 1;
}
/** The last payment number an extra "stopping after N months" can land on (0 = until the loan ends). */
function endPaymentFor(endM: number, loanFreq: AmortFrequency): number {
  return endM > 0 ? paymentsWithin(endM, loanFreq) : 0;
}

/** "2027-03-15" -> local Date at midnight (null if blank or invalid). Local parts only, so no time-zone shift. */
function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Local Date -> "2027-03-15". Never uses toISOString(), which shifts the day in time zones ahead of UTC. */
function dateToIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${mm}-${dd}`;
}
// Picker range: a loan that started up to 50 years ago, or starts up to 30 years from now (the maths file allows 1900-2200).
function firstPaymentRange(): { min: Date; max: Date } {
  const y = new Date().getFullYear();
  return { min: new Date(y - 50, 0, 1), max: new Date(y + 30, 11, 31) };
}

/** "2027-03-15" -> "Mar 15, 2027" (UTC, so time zones never shift the day). */
function fmtIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
}

/** "2041-12-15" -> "December 2041". Used for payoff dates, where the exact day adds nothing. */
function fmtIsoMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(+m[1], +m[2] - 1, 1);
  return new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long' });
}

/** "2026-10-23" -> "Oct 2026". Used in the schedule and chart, where the exact day is not needed. */
function fmtIsoMonthShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(+m[1], +m[2] - 1, 1);
  return new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short' });
}

/** Map symbols jsPDF's built-in font cannot render. */
function pdfCurrencySymbol(sym: string): string {
  if (sym === '₹') return 'Rs.';
  if (sym === '¥') return 'JPY ';
  return sym;
}

// ---------------------------------------------------------------------------
// Style tokens (match AutoLoan exactly)
// ---------------------------------------------------------------------------
const fieldLabelClass = 'text-sm font-medium text-neutral-700 dark:text-neutral-300';
const hintClass = 'text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1.5';
const compactLabelClass = 'text-xs font-semibold text-neutral-500 dark:text-neutral-400';
const dateInputClass =
  'amc-date w-full rounded-xl border bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3 shadow-sm focus:outline-none focus:ring-2 transition-colors border-neutral-200 dark:border-neutral-700 focus:ring-indigo-400/50 focus:border-indigo-300 dark:focus:border-indigo-500/60';
const noSpinnerClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

const FIELD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(18rem, calc((100% - 1.5rem) / 2))), 1fr))',
  columnGap: '1.5rem',
  rowGap: '1.75rem',
  alignItems: 'start',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface AmortizationCalculatorProps {
  onReportChange?: (report: ShareableReport | null) => void;
  onCalculationComplete?: () => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

interface Committed {
  inputs: AmortizationInputs;
  result: AmortizationResult;
  currencySymbol: string;
  sig: string;
}

// ---------------------------------------------------------------------------
// Scoped stylesheet (.amc-*)
// ---------------------------------------------------------------------------
const AMC_CSS = `
.amc-hero, .amc-sum { --k1:#0f172a; --k2:#64748b; --line:rgba(15,23,42,.08); --soft:rgba(15,23,42,.035); --bg:#ffffff; font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased; }
.dark .amc-sum { --k1:#f8fafc; --k2:#9ca3af; --line:rgba(255,255,255,.1); --soft:rgba(255,255,255,.045); --bg:#171b24; }
.amc-hero *, .amc-hero *::before, .amc-hero *::after,
.amc-sum *, .amc-sum *::before, .amc-sum *::after { box-sizing:border-box; }
.amc-hero svg, .amc-sum svg { display:block; }
.amc-sr { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
@keyframes amc-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes amc-grow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@media (prefers-reduced-motion:reduce) { .amc-hero,.amc-sum,.amc-hero *,.amc-sum * { animation:none !important; transition:none !important; } }

/* Hero */
.amc-hero { position:relative; isolation:isolate; overflow:hidden; container-type:inline-size; border-radius:28px; color:#fff; background:linear-gradient(150deg,#4f46e5 0%,#3730a3 48%,#2e2a85 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 32px 64px -32px rgba(67,56,202,.65),0 2px 8px rgba(67,56,202,.2); animation:amc-fade .45s ease both; }
.dark .amc-hero { background:linear-gradient(150deg,#3b36b3 0%,#2f2b8f 48%,#1e1b4b 100%); box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 0 1px rgba(255,255,255,.07),0 34px 70px -34px rgba(0,0,0,.9); }
.amc-hero__glow { position:absolute; z-index:-1; top:-110px; right:-80px; width:340px; height:340px; border-radius:50%; background:rgba(129,140,248,.32); filter:blur(56px); pointer-events:none; }
.amc-hero__glow--b { top:auto; right:auto; bottom:-140px; left:-100px; width:300px; height:300px; background:rgba(56,189,248,.12); }
.amc-hero__in { padding:clamp(22px,4.8cqi,36px); display:flex; flex-direction:column; gap:14px; }
.amc-eyebrow { margin:0; display:inline-flex; align-items:center; gap:10px; font-size:11px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; line-height:1.3; color:rgba(255,255,255,.92); }
.amc-eyebrow i { width:16px; height:3px; border-radius:999px; background:#a5b4fc; flex:none; }
.amc-amt-wrap { container-type:inline-size; }
.amc-amt { display:block; font-weight:800; letter-spacing:-.035em; line-height:1; color:#fff; text-shadow:0 2px 24px rgba(15,12,70,.35); }
.amc-cap { margin:0; font-size:clamp(13px,2.4cqi,14px); font-weight:600; color:rgba(255,255,255,.8); line-height:1.5; }
.amc-boost { display:flex; flex-direction:column; align-items:flex-start; gap:9px; padding:12px 16px; border-radius:16px; background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(16,185,129,.1)); box-shadow:inset 0 0 0 1px rgba(110,231,183,.38); font-size:13px; font-weight:600; line-height:1.5; color:rgba(255,255,255,.88); }
.amc-boost__tag { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:#34d399; color:#064e3b; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; }
.amc-boost b { color:#fff; font-weight:800; }
.amc-boost__txt { margin:0; }
.amc-boost__amt { font-size:1.18em; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
.amc-boost small { font-size:12px; font-weight:600; color:rgba(255,255,255,.7); }
.amc-split { display:grid; gap:10px; margin-top:6px; padding-top:16px; border-top:1px solid rgba(255,255,255,.16); }
.amc-split__head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 12px; font-size:12px; font-weight:700; letter-spacing:.02em; color:rgba(255,255,255,.72); }
.amc-split__head b { color:#fff; font-weight:800; }
.amc-split__bar { display:flex; gap:3px; height:10px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.1); }
.amc-split__bar i { display:block; height:100%; min-width:4px; transform-origin:left center; animation:amc-grow .9s cubic-bezier(.22,1,.36,1) .15s both; }
.amc-split__legend { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 24px; list-style:none; margin:4px 0 0; padding:0; }
.amc-split__legend li { display:flex; flex-direction:column; gap:5px; min-width:0; }
.amc-split__legend .d { display:inline-block; width:9px; height:9px; border-radius:50%; flex:none; }
.amc-split__legend .k, .amc-split__totalk .k { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.66); line-height:1.2; }
.amc-split__totalk small { display:block; margin-top:4px; font-size:12px; font-weight:600; color:rgba(255,255,255,.62); }
.amc-split__legend b { display:block; font-size:clamp(16px,3.4cqi,20px); font-weight:800; color:#fff; letter-spacing:-.01em; line-height:1.2; }
.amc-split__total { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px 16px; margin-top:6px; padding:14px 16px; border-radius:16px; background:rgba(255,255,255,.07); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
.amc-split__totalv { font-size:clamp(18px,4.4cqi,24px); font-weight:800; color:#fff; letter-spacing:-.025em; line-height:1.1; font-variant-numeric:tabular-nums; }
.amc-note { margin:2px 0 0; font-size:12px; font-weight:600; color:rgba(255,255,255,.58); line-height:1.55; }

/* Section cards */
.amc-sum { position:relative; overflow:hidden; border-radius:24px; border:1px solid var(--line); background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.04),0 12px 32px -16px rgba(79,70,229,.18); }
.dark .amc-sum { background:#1b1e2b; border-color:rgba(255,255,255,.09); box-shadow:0 1px 2px rgba(0,0,0,.4),0 18px 40px -22px rgba(0,0,0,.7); }
.amc-sum::before { content:""; position:absolute; inset:0 0 auto 0; height:2px; background:linear-gradient(90deg,transparent,rgba(99,102,241,.55),transparent); opacity:.7; pointer-events:none; }
.amc-sum__glow { position:absolute; top:-70px; right:-70px; width:240px; height:240px; border-radius:50%; background:rgba(99,102,241,.07); filter:blur(44px); pointer-events:none; }
.amc-sum__in { position:relative; padding:clamp(18px,3.8cqi,28px); display:flex; flex-direction:column; gap:18px; }
.amc-sum__head { display:flex; align-items:flex-start; gap:14px; padding-bottom:16px; border-bottom:1px solid var(--line); }
.amc-badge { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:40px; height:40px; border-radius:12px; background:linear-gradient(145deg,rgba(99,102,241,.2),rgba(99,102,241,.08)); color:#4f46e5; box-shadow:inset 0 0 0 1px rgba(99,102,241,.25); }
.dark .amc-badge { background:linear-gradient(145deg,rgba(129,140,248,.26),rgba(99,102,241,.1)); color:#a5b4fc; }
.amc-sum__title { margin:0; font-size:16px; font-weight:800; color:var(--k1); letter-spacing:-.02em; line-height:1.3; display:flex; align-items:center; gap:6px; }
.amc-sum__sub { margin:3px 0 0; font-size:13px; font-weight:500; color:var(--k2); line-height:1.45; }
.amc-sum__body { display:flex; flex-direction:column; gap:0; }

/* Tiles (neutral surface, colour only in the dot) */
.amc-tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,max(10rem,calc((100%-1rem)/2))),1fr)); gap:12px; }
.amc-tile { --dot:#6366f1; position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; border-radius:18px; padding:18px 14px 16px; background:linear-gradient(160deg,color-mix(in srgb,var(--dot) 16%,transparent),color-mix(in srgb,var(--dot) 5%,transparent)); border:1px solid color-mix(in srgb,var(--dot) 32%,transparent); box-shadow:0 8px 20px -14px color-mix(in srgb,var(--dot) 70%,transparent); transition:transform .2s ease,border-color .2s ease; }
.amc-tile:hover { transform:translateY(-1px); border-color:color-mix(in srgb,var(--dot) 55%,transparent); }
.amc-tiles--2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.amc-tiles--2 > .amc-tile:last-child:nth-child(odd) { grid-column:1 / -1; }
@media (max-width:420px) { .amc-tiles--2 { gap:8px; } .amc-tiles--2 .amc-tile { padding:14px 8px 12px; } }
.amc-tile__ic { display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:13px; color:#fff; background:linear-gradient(135deg,var(--dot),color-mix(in srgb,var(--dot) 70%,#000)); box-shadow:0 6px 14px -6px color-mix(in srgb,var(--dot) 80%,transparent); margin-bottom:10px; flex:none; }
.amc-tile__ic svg { width:18px; height:18px; }
.amc-tile__k { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:color-mix(in srgb,var(--dot) 55%,var(--k2)); }
.amc-tile__v { display:block; font-size:clamp(18px,4.8cqi,24px); font-weight:800; color:color-mix(in srgb,var(--dot) 78%,var(--k1)); letter-spacing:-.025em; margin-top:6px; line-height:1.15; }
.amc-tile__s { font-size:12px; font-weight:600; color:var(--k2); margin-top:4px; }
.amc-tile__note { font-size:13px; font-weight:700; line-height:1.5; color:color-mix(in srgb,var(--dot) 70%,var(--k1)); margin:0; max-width:34ch; }
.amc-tile--note { justify-content:center; }
.amc-tile--indigo { --dot:#6366f1; }
.amc-tile--violet { --dot:#8b5cf6; }
.amc-tile--amber { --dot:#f59e0b; }
.amc-tile--teal { --dot:#14b8a6; }
.amc-tile--pink { --dot:#ec4899; }
.amc-tile--gray { --dot:#64748b; }
/* Plain (original) tile: neutral surface, colour only in the dot. Used by the Savings card. */
.amc-tile--plain { display:block; text-align:left; padding:16px 18px; background:var(--soft); border:1px solid var(--line); box-shadow:none; }
.amc-tile--plain:hover { border-color:rgba(99,102,241,.3); }
.amc-tile--plain .amc-tile__k { display:flex; align-items:center; gap:8px; color:var(--k2); }
.amc-tile--plain .amc-tile__k::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--dot); box-shadow:0 0 0 3px color-mix(in srgb,var(--dot) 20%,transparent); flex:none; }
.amc-tile--plain .amc-tile__v { color:var(--k1); } /* size, weight, spacing and margin are inherited from .amc-tile__v so this card always matches Loan Summary */
.amc-tile--rose { --dot:#f43f5e; }
.amc-tile--emerald { --dot:#10b981; }
.amc-tile--sky { --dot:#0ea5e9; }

/* Savings bars */
.amc-save { display:grid; gap:12px; margin-top:16px; padding:16px 18px; border-radius:18px; background:var(--soft); border:1px solid var(--line); }
.amc-save__row { display:grid; gap:6px; }
.amc-save__top { display:flex; justify-content:space-between; gap:10px; font-size:13px; font-weight:700; color:var(--k2); }
.amc-save__top b { color:var(--k1); font-weight:800; }
.amc-save__bar { height:9px; border-radius:999px; overflow:hidden; background:var(--line); }
.amc-save__bar i { display:block; height:100%; border-radius:999px; transform-origin:left center; animation:amc-grow .9s cubic-bezier(.22,1,.36,1) .1s both; }

/* Tables */
.amc-tbl-wrap { overflow-x:auto; border-radius:16px; box-shadow:inset 0 0 0 1px var(--line); -webkit-overflow-scrolling:touch; }
.amc-tbl tfoot td { position:sticky; bottom:0; z-index:1; font-weight:800; color:var(--k1); border-top:1px solid rgba(99,102,241,.35); background-color:var(--bg); background-image:linear-gradient(rgba(99,102,241,.1),rgba(99,102,241,.1)); }
.amc-tbl tfoot td:first-child { color:var(--k1); }
.amc-tbl-wrap--scroll { max-height:30rem; overflow:auto; }
.amc-tbl { width:100%; min-width:440px; border-collapse:separate; border-spacing:0; font-size:13px; }
.amc-tbl th { position:sticky; top:0; z-index:1; padding:11px 14px; text-align:right; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; color:var(--k2); background-color:var(--bg); background-image:linear-gradient(var(--soft),var(--soft)); box-shadow:inset 0 -1px 0 var(--line); }
.amc-tbl td { padding:11px 14px; text-align:right; white-space:nowrap; color:var(--k1); border-top:1px solid var(--line); font-weight:600; }
.amc-tbl tbody tr:first-child td { border-top:0; }
.amc-tbl tbody tr:nth-child(even) td { background:var(--soft); }
.amc-tbl tbody tr:hover td { background:rgba(99,102,241,.07); }
.amc-tbl th:first-child, .amc-tbl td:first-child { text-align:left; }
.amc-tbl td:first-child { font-weight:700; color:var(--k2); }
.amc-sched-bar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
.amc-more { appearance:none; margin-top:12px; width:100%; padding:12px 14px; border:0; border-radius:14px; font:inherit; font-size:13px; font-weight:700; cursor:pointer; color:#4338ca; background:rgba(99,102,241,.08); box-shadow:inset 0 0 0 1px rgba(99,102,241,.22); transition:background .2s ease; }
.amc-more:hover { background:rgba(99,102,241,.14); }
.dark .amc-more { color:#c7d2fe; }
.amc-more:focus-visible { outline:2px solid rgba(99,102,241,.7); outline-offset:2px; }

/* Chart legend */
.amc-legend { display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:10px; font-size:12px; font-weight:700; color:var(--k2); }
.amc-legend span { display:inline-flex; align-items:center; gap:7px; }
.amc-legend i { width:10px; height:10px; border-radius:50%; display:inline-block; }

/* Empty state */
.amc-empty { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; text-align:center; padding:clamp(36px,8vw,56px) clamp(20px,5vw,32px); border-radius:28px; border:1.5px dashed rgba(100,116,139,.35); background:rgba(248,250,252,.7); }
.dark .amc-empty { border-color:rgba(255,255,255,.14); background:rgba(255,255,255,.02); }
.amc-empty__icon { display:grid; place-items:center; width:84px; height:84px; border-radius:50%; color:#4338ca; background:rgba(99,102,241,.1); box-shadow:inset 0 0 0 1px rgba(99,102,241,.22); }
.dark .amc-empty__icon { color:#a5b4fc; background:rgba(99,102,241,.12); }
.amc-empty__title { margin:18px 0 0; font-size:18px; font-weight:800; letter-spacing:-.02em; color:#334155; }
.dark .amc-empty__title { color:#e2e8f0; }
.amc-empty__text { margin:8px 0 0; max-width:26rem; font-size:14px; line-height:1.6; font-weight:500; color:#526074; }
.dark .amc-empty__text { color:#a1a1aa; }

/* Stale banner */
.amc-stale { margin:0; display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:14px; font-size:13px; line-height:1.5; font-weight:600; color:#92400e; background:rgba(245,158,11,.12); box-shadow:inset 0 0 0 1px rgba(245,158,11,.3); }
.dark .amc-stale { color:#fcd34d; }
.amc-stale svg { width:16px; height:16px; flex:none; margin-top:2px; }

/* Sources link */
.amc-srclink { color:#4338ca; }
.dark .amc-srclink { color:#a5b4fc; }

/* Native select theming */
.amc-native-select { color-scheme:light; }
.dark .amc-native-select { color-scheme:dark; }
.amc-native-select option { background-color:#ffffff; color:#262626; }
.dark .amc-native-select option { background-color:#262626; color:#f5f5f5; }
.amc-date { color-scheme:light; }
.dark .amc-date { color-scheme:dark; }
.amc-date::-webkit-calendar-picker-indicator { cursor:pointer; }
.amc-ot { container-type:inline-size; }
.amc-ot__grid { display:grid; grid-template-columns:minmax(0,1fr); row-gap:1rem; }
.amc-ot__head { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.5rem; }
.amc-ot__head--right { min-height:2.375rem; flex-wrap:nowrap; }
@container (min-width: 30rem) {
  .amc-ot__grid { grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:1.25rem; align-items:start; }
  .amc-ot__head--left { min-height:2.375rem; }
}

/* Chart tooltip */
.amc-tt { background:var(--bg); border:1px solid var(--line); border-radius:14px; padding:10px 14px; font-size:12px; font-weight:600; color:var(--k1); box-shadow:0 10px 30px -8px rgba(15,23,42,.25); min-width:150px; }
.amc-tt p { display:flex; align-items:center; justify-content:space-between; gap:14px; margin:3px 0 0; }
.amc-tt p span.k { display:inline-flex; align-items:center; gap:7px; color:var(--k2); }
.amc-tt p span.k i { width:8px; height:8px; border-radius:50%; display:inline-block; }
.amc-tt p.amc-tt__label { display:block; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--k2); margin:0 0 4px; }


/* Link copy button */
.amc-linkbtn { background:rgba(99,102,241,.08); box-shadow:0 0 0 1px rgba(99,102,241,.22); color:#4338ca; }
.dark .amc-linkbtn { color:#a5b4fc; }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const numOrZero = (s: string): number => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

const sanitizeNumber = (s: string, maxDecimals: number, maxInt: number): string => {
  let out = ''; let seenDot = false; let dec = 0;
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) { if (dec < maxDecimals) { out += ch; dec++; } } else out += ch;
    } else if (ch === '.' && maxDecimals > 0 && !seenDot) { seenDot = true; out += '.'; }
  }
  const dot = out.indexOf('.');
  let intPart = dot === -1 ? out : out.slice(0, dot);
  const decPart = dot === -1 ? '' : out.slice(dot + 1);
  intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, maxInt);
  if (dot !== -1) return `${intPart === '' ? '0' : intPart}.${decPart}`;
  return intPart;
};

// Groups the integer part with locale commas (en-US throughout — no locale switching needed).
const groupDisplay = (raw: string): string => {
  if (!raw) return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(intPart || '0'));
  return dot === -1 ? grouped : `${grouped}.${raw.slice(dot + 1)}`;
};

const fitNumberStyle = (text: string, maxRem: number, minRem = 1.25): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(70 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// ---------------------------------------------------------------------------
// InfoTip — portal tooltip (exact copy of AutoLoan pattern)
// ---------------------------------------------------------------------------
const InfoTip: React.FC<{ text: string; widthClass?: string; align?: 'center' | 'start' | 'end' }> = ({
  text, widthClass = 'w-56', align = 'center',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const VM = 8, GAP = 8;

  const reposition = useCallback(() => {
    const btn = btnRef.current; const tip = tipRef.current;
    if (!btn || !tip) return;
    const b = btn.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let left = align === 'start' ? b.left : align === 'end' ? b.right - t.width : b.left + b.width / 2 - t.width / 2;
    left = Math.min(Math.max(left, VM), window.innerWidth - t.width - VM);
    setCoords({ top: Math.max(b.top - GAP - t.height, VM), left });
  }, [align]);

  useLayoutEffect(() => { if (open) reposition(); }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const tgt = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(tgt) && tipRef.current && !tipRef.current.contains(tgt)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button ref={btnRef} type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        aria-expanded={open} aria-label="More information"
        className="cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <SafeIcon icon={FiInfo} className="w-4 h-4" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={tipRef} role="tooltip"
          style={{ position: 'fixed', top: coords?.top ?? -9999, left: coords?.left ?? -9999, visibility: coords ? 'visible' : 'hidden' }}
          className={`${widthClass} rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-xs font-medium leading-relaxed text-neutral-700 dark:text-neutral-200 shadow-lg pointer-events-none z-[100] text-center`}
        >{text}</div>,
        document.body
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// SegmentedToggle (exact AutoLoan pattern)
// ---------------------------------------------------------------------------
function SegmentedToggle<T extends string>({
  value, onChange, options, groupId, ariaLabel, size = 'md', dividers = false,
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean; ariaLabel?: string }[];
  groupId: string; ariaLabel: string;
  size?: 'sm' | 'md' | 'field';
  dividers?: boolean;
}) {
  const reduced = useReducedMotion();
  const sm = size === 'sm';
  const field = size === 'field';
  return (
    <div
      className={`relative inline-flex bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-700/50 rounded-full ${field ? 'flex w-full p-1.5' : sm ? 'p-1' : 'flex w-full p-1.5'}`}
      role="group" aria-label={ariaLabel}
    >
      {options.map((opt, idx) => {
        const active = opt.value === value;
        // A thin line between neighbouring options; hidden next to the selected pill so it never cuts into it.
        const showDivider = dividers && idx > 0 && !active && options[idx - 1].value !== value;
        return (
          <button key={opt.value} type="button" aria-pressed={active} disabled={opt.disabled} aria-label={opt.ariaLabel} title={opt.ariaLabel}
            onClick={() => { if (!opt.disabled) onChange(opt.value); }}
            className={`relative rounded-full transition-colors duration-150 ${opt.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${sm ? 'px-3.5 py-1.5 text-xs' : 'flex-1 px-2 sm:px-4 py-2.5 text-xs sm:text-sm text-center leading-tight'} ${active ? 'text-white font-bold' : 'text-neutral-500 dark:text-neutral-400 font-semibold hover:text-neutral-800 dark:hover:text-neutral-100'}`}
          >
            {showDivider && (
              <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-px bg-neutral-300 dark:bg-neutral-600" />
            )}
            {active && (
              <motion.span
                layoutId={`seg-pill-${groupId}`}
                className="absolute inset-0 rounded-full bg-indigo-500 shadow-[0_2px_10px_-1px_rgba(99,102,241,0.55)]"
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumField — chip-in-flex-row, groupDisplay, proper caret restore
// Matches AutoLoanCalculator's NumField exactly.
// ---------------------------------------------------------------------------
const NumField: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  grouped?: boolean;
  maxDecimals?: number;
  maxInt?: number;
  error?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  describedBy?: string;
}> = ({
  id, value, onChange, prefix, suffix,
  grouped = false, maxDecimals = 2, maxInt = 13,
  error, placeholder, ariaLabel, describedBy,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | null>(null);
  const display = grouped ? groupDisplay(value) : value;

  // Restore caret after re-grouping so typing mid-number never jumps to the end.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const target = caretRef.current;
    if (target === null) return;
    caretRef.current = null;
    if (!el || document.activeElement !== el) return;
    let count = 0, pos = 0;
    while (pos < display.length && count < target) {
      if (/[0-9.]/.test(display[pos])) count++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  });

  const chipClass =
    'flex items-center justify-center flex-shrink-0 rounded-lg text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-700/70 whitespace-nowrap';
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
      {suffix && (
        <span className={chipClass} style={{ ...chipBox, marginRight: 6 }}>{suffix}</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FieldError
// ---------------------------------------------------------------------------
const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) => (
  <AnimatePresence>
    {message && (
      <motion.p id={id} role="alert"
        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
        className="text-xs font-semibold text-red-500 mt-1.5 flex items-center gap-1.5"
      >
        <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />
        {message}
      </motion.p>
    )}
  </AnimatePresence>
);

// ---------------------------------------------------------------------------
// Labelled field wrappers (match AutoLoan's MoneyField / PercentField shape)
// ---------------------------------------------------------------------------
const MoneyField: React.FC<{
  id: string; label: string; tip?: string; sym: string;
  value: string; onChange: (v: string) => void;
  error?: string; hint?: string; placeholder?: string; compact?: boolean; invalid?: boolean;
}> = ({ id, label, tip, sym, value, onChange, error, hint, placeholder, compact, invalid }) => (
  <div className="min-w-0">
    <div className={`flex items-center gap-1.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
      <label htmlFor={id} className={compact ? compactLabelClass : fieldLabelClass}>{label}</label>
      {tip && <InfoTip text={tip} />}
    </div>
    <NumField id={id} value={value} onChange={onChange}
      prefix={sym} grouped maxDecimals={2} maxInt={13}
      placeholder={placeholder ?? '0'} error={Boolean(error) || Boolean(invalid)}
      describedBy={error ? `${id}-err` : `${id}-hint`}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

const PercentField: React.FC<{
  id: string; label: string; tip: string;
  value: string; onChange: (v: string) => void;
  error?: string; hint?: string; maxDec?: number;
}> = ({ id, label, tip, value, onChange, error, hint, maxDec = 3 }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 mb-2">
      <label htmlFor={id} className={fieldLabelClass}>{label}</label>
      <InfoTip text={tip} />
    </div>
    <NumField id={id} value={value} onChange={onChange}
      suffix="%" maxDecimals={maxDec} maxInt={3}
      placeholder="0" error={Boolean(error)}
      describedBy={error ? `${id}-err` : `${id}-hint`}
    />
    <FieldError id={`${id}-err`} message={error} />
    {!error && hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// CollapseCard (exact AutoLoan pattern)
// ---------------------------------------------------------------------------
const CollapseCard: React.FC<{
  id: string; icon: IconType; title: string; subtitle: string;
  badge?: string; optional?: boolean; open: boolean; onToggle: () => void; children: React.ReactNode;
}> = ({ id, icon, title, subtitle, badge, optional, open, onToggle, children }) => {
  const reduced = useReducedMotion();
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${id}-panel`}
        className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 md:px-8 text-left cursor-pointer rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <span className="flex items-start gap-2.5 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
            <SafeIcon icon={icon} className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-extrabold leading-7 text-neutral-900 dark:text-white">{title}</span>
              {optional && <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">(optional)</span>}
              {badge && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full">{badge}</span>
              )}
            </span>
            <span className="block text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">{subtitle}</span>
          </span>
        </span>
        <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60 text-neutral-400 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`${id}-panel`}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: 'easeOut' }} style={{ overflow: 'hidden' }}
          >
            <div className="px-5 sm:px-6 md:px-8 pb-6 md:pb-8" style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', rowGap: '1.5rem' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// DurationField — "years + months" pair, same chips as the loan-term fields
// ---------------------------------------------------------------------------
const DurationField: React.FC<{
  id: string; label: string; tip: string;
  years: string; months: string; onYears: (v: string) => void; onMonths: (v: string) => void;
  invalid?: boolean; hint?: string;
}> = ({ id, label, tip, years, months, onYears, onMonths, invalid, hint }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 mb-2">
      <label htmlFor={`${id}-y`} className={fieldLabelClass}>{label}</label>
      <InfoTip text={tip} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '0.75rem' }}>
      <NumField id={`${id}-y`} value={years} onChange={onYears} suffix="yrs"
        maxDecimals={0} maxInt={2} placeholder="0" error={invalid}
        ariaLabel={`${label} — years`} describedBy={`${id}-hint`}
      />
      <NumField id={`${id}-m`} value={months} onChange={onMonths} suffix="mo"
        maxDecimals={0} maxInt={3} placeholder="0" error={invalid}
        ariaLabel={`${label} — months`} describedBy={`${id}-hint`}
      />
    </div>
    {hint && <p id={`${id}-hint`} className={hintClass}>{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// RegularExtraRow — one regular extra: amount, how often, optional start / stop (in years + months)
// ---------------------------------------------------------------------------
const RegularExtraRow: React.FC<{
  id: string; sym: string; fmt: (n: number) => string;
  loanFrequency: AmortFrequency; loanMonths: number;
  value: RegularExtra; onChange: (patch: Partial<RegularExtra>) => void; error?: string;
}> = ({ id, sym, fmt, loanFrequency, loanMonths, value, onChange, error }) => {
  const amt = parseFloat(value.amount) || 0;
  const startM = durationMonths(value.startYears, value.startMonths);
  const endM = durationMonths(value.endYears, value.endMonths);
  const S = startPaymentFor(startM, loanFrequency);
  const E = endPaymentFor(endM, loanFrequency);
  const startPart = startM > 0
    ? `starting after ${formatMonthsAsYearsMonths(startM)} (from payment ${S})`
    : 'from the first payment';
  const endPart = endM > 0
    ? `stopping after ${formatMonthsAsYearsMonths(endM)} (payment ${E})`
    : 'until the loan ends';
  const summary = amt > 0
    ? `Adds ${fmt(amt)} ${EXTRA_EVERY[value.frequency]}, ${startPart}, ${endPart}. About ${fmt(amt * EXTRA_PER_YEAR[value.frequency])} a year while it runs.`
    : '';
  const startHint = loanMonths > 0 && startM >= loanMonths
    ? `Your loan lasts ${formatMonthsAsYearsMonths(loanMonths)}.`
    : 'Leave blank to start from the first payment.';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm font-extrabold text-neutral-900 dark:text-white">Regular extra payment</span>
        <InfoTip text="An extra amount paid on top of your regular payment on its own rhythm, such as every month or once a year. If it falls between two payment dates, it is applied on the next payment date. It goes straight to the loan balance. Leave the amount blank to skip." widthClass="w-64" />
      </div>
      <div style={FIELD_GRID_STYLE}>
        <MoneyField
          id={`${id}-amt`} label="Extra amount"
          tip="The amount added each time the extra falls due."
          sym={sym} value={value.amount} onChange={(v) => onChange({ amount: v })}
          invalid={Boolean(error)}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <label htmlFor={`${id}-freq`} className={fieldLabelClass}>How often</label>
            <InfoTip text="How often the extra is paid: weekly, monthly, quarterly, half-yearly or yearly, on its own calendar rhythm." />
          </div>
          <div className="relative">
            <select id={`${id}-freq`} value={value.frequency}
              onChange={(e) => onChange({ frequency: e.target.value as ExtraFrequency })}
              className={selectShellClass}
            >
              {EXTRA_FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          </div>
        </div>
        <DurationField
          id={`${id}-start`} label="Start after"
          tip="How far into the loan the extra begins, for example 2 years and 6 months. Leave blank to start from the first payment."
          years={value.startYears} months={value.startMonths}
          onYears={(v) => onChange({ startYears: v })} onMonths={(v) => onChange({ startMonths: v })}
          invalid={Boolean(error)} hint={startHint}
        />
        <DurationField
          id={`${id}-end`} label="Stop after"
          tip="How far into the loan the extra stops, for example 5 years. Leave blank to keep paying it until the loan ends."
          years={value.endYears} months={value.endMonths}
          onYears={(v) => onChange({ endYears: v })} onMonths={(v) => onChange({ endMonths: v })}
          invalid={Boolean(error)} hint="Leave blank to continue until the loan ends."
        />
      </div>
      <FieldError id={`${id}-err`} message={error} />
      {!error && summary && <p className={hintClass} style={{ marginTop: 12 }}>{summary}</p>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// OneTimeExtraRow — the single one-time payment: amount + where it is paid (payment # or date)
// ---------------------------------------------------------------------------
const OneTimeExtraRow: React.FC<{
  id: string; sym: string; fmt: (n: number) => string;
  loanPayments: number; hasFirstDate: boolean; firstPaymentDate: string;
  value: OneTimeExtraState; onChange: (patch: Partial<OneTimeExtraState>) => void; error?: string;
}> = ({ id, sym, fmt, loanPayments, hasFirstDate, firstPaymentDate, value, onChange, error }) => {
  const amt = parseFloat(value.amount) || 0;
  const byDate = value.byDate && hasFirstDate;
  const payN = value.payment ? parseInt(value.payment, 10) : 0;
  const summary = amt <= 0
    ? ''
    : byDate
      ? (value.date ? `Pays ${fmt(amt)} once, at the first payment on or after ${fmtIsoDate(value.date)}.` : 'Now choose the date it is paid.')
      : (payN > 0 ? `Pays ${fmt(amt)} once, at payment ${payN}.` : 'Now enter the payment number it is paid at.');
  const placeId = `${id}-${byDate ? 'date' : 'pay'}`;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm font-extrabold text-neutral-900 dark:text-white">One-time payment</span>
        <InfoTip text="A lump sum paid once, such as a bonus or a sale. Place it at a payment number, or at the first payment on or after a date (dates need a first payment date above). It goes straight to the loan balance. Leave the amount blank to skip. For something that repeats, use the regular extra payment above." widthClass="w-64" />
      </div>
      <div className="amc-ot">
        <div className="amc-ot__grid">
          <div className="min-w-0">
            <div className="amc-ot__head amc-ot__head--left">
              <label htmlFor={`${id}-amt`} className={fieldLabelClass}>One-time amount</label>
            </div>
            <NumField
              id={`${id}-amt`} value={value.amount} onChange={(v) => onChange({ amount: v })}
              prefix={sym} grouped maxDecimals={2} maxInt={13} placeholder="0"
              error={Boolean(error)} describedBy={error ? `${id}-err` : `${id}-hint`}
            />
            <p id={`${id}-hint`} className={hintClass}>Leave blank to skip.</p>
          </div>
          <div className="min-w-0">
            <div className="amc-ot__head amc-ot__head--right">
              <label htmlFor={placeId} className={fieldLabelClass}>Paid at</label>
              <SegmentedToggle<'payment' | 'date'>
                size="sm"
                value={byDate ? 'date' : 'payment'}
                onChange={(v) => onChange({ byDate: v === 'date' })}
                options={[
                  { value: 'payment', label: 'Payment #' },
                  { value: 'date', label: 'Date', disabled: !hasFirstDate },
                ]}
                groupId={`${id}-mode`}
                ariaLabel="One-time payment placement"
              />
            </div>
            {byDate ? (
              <input
                id={placeId} type="date" min={firstPaymentDate} value={value.date}
                onChange={(e) => onChange({ date: e.target.value })}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-err` : undefined}
                className={`${dateInputClass} ${error ? '!border-red-300 dark:!border-red-500/60' : ''}`}
              />
            ) : (
              <NumField
                id={placeId} value={value.payment} onChange={(v) => onChange({ payment: v })}
                prefix="#" maxDecimals={0} maxInt={4} placeholder="e.g. 12"
                error={Boolean(error)} describedBy={error ? `${id}-err` : undefined}
              />
            )}
            {!error && !byDate && loanPayments > 0 && payN > loanPayments && <p className={hintClass}>Your loan has {loanPayments} payments.</p>}
            {!hasFirstDate && <p className={hintClass}>Add a first payment date above to place by date.</p>}
          </div>
        </div>
      </div>
      <FieldError id={`${id}-err`} message={error} />
      {!error && summary && <p className={hintClass} style={{ marginTop: 12 }}>{summary}</p>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// InputCard shell
// ---------------------------------------------------------------------------
const InputCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
    <div className="p-5 sm:p-6 md:p-8" style={{ display: 'flex', flexDirection: 'column', rowGap: '1.75rem' }}>
      <div>
        <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Select shell (matches AutoLoan selectShellClass)
// ---------------------------------------------------------------------------
const selectShellClass =
  'amc-native-select w-full appearance-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 cursor-pointer';

// ---------------------------------------------------------------------------
// ResultSection shell
// ---------------------------------------------------------------------------
const ResultSection: React.FC<{
  icon: IconType; title: string; subtitle?: string; tip?: string; label: string; children: React.ReactNode;
}> = ({ icon, title, subtitle, tip, label, children }) => (
  <section className="amc-sum" aria-label={label}>
    <div className="amc-sum__glow" aria-hidden="true" />
    <div className="amc-sum__in">
      <div className="amc-sum__head">
        <span className="amc-badge" aria-hidden="true"><SafeIcon icon={icon} /></span>
        <div style={{ minWidth: 0 }}>
          <h4 className="amc-sum__title">{title}{tip && <InfoTip text={tip} />}</h4>
          {subtitle && <p className="amc-sum__sub">{subtitle}</p>}
        </div>
      </div>
      <div className="amc-sum__body">{children}</div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
const EmptyState: React.FC = () => (
  <div className="amc-empty">
    <div className="amc-empty__icon">
      <SafeIcon icon={FiTrendingDown} className="w-10 h-10" />
    </div>
    <p className="amc-empty__title">See your full loan picture</p>
    <p className="amc-empty__text">
      Enter your loan amount, interest rate and term above, then press Calculate to get the payment schedule, total interest, and payoff timeline.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Hero card
// ---------------------------------------------------------------------------
const PaymentHero: React.FC<{
  text: string; caption: string; principal: number; interest: number;
  fmt: (n: number) => string; note: string; totalExtra?: number;
  boost?: { extraPaid: number; interestSaved: number; timeSavedMonths: number; withExtra: { amount: number; exact: boolean } | null; freqWord: string } | null;
}> = ({ text, caption, principal, interest, fmt, note, boost, totalExtra = 0 }) => {
  const total = principal + interest;
  const interestPct = total > 0 ? Math.min(100, Math.max(0, (interest / total) * 100)) : 0;
  const principalPct = 100 - interestPct;
  const pctText = (v: number) => `${v.toFixed(1).replace(/\.0$/, '')}%`;
  return (
    <section className="amc-hero" aria-label="Regular payment">
      <div className="amc-hero__glow" aria-hidden="true" />
      <div className="amc-hero__glow amc-hero__glow--b" aria-hidden="true" />
      <div className="amc-hero__in">
        <p className="amc-eyebrow"><i aria-hidden="true" />Regular payment</p>
        <div className="amc-amt-wrap">
          <span className="amc-amt" style={fitNumberStyle(text, 3)}>{text}</span>
        </div>
        <p className="amc-cap">{caption}</p>
        {boost && boost.withExtra && (
          <div className="amc-boost">
            <span className="amc-boost__tag">With extra payments</span>
            <p className="amc-boost__txt">
              {boost.withExtra.exact ? 'While your regular extra runs, each payment is ' : 'While your regular extra runs, you pay about '}
              <b className="amc-boost__amt">{fmt(boost.withExtra.amount)}</b>
              {boost.withExtra.exact ? '' : ' per payment on average'}
              {' '}<small>(scheduled payment + extra)</small>
            </p>
          </div>
        )}
        {total > 0 && (
          <div className="amc-split">
            <div className="amc-split__head">
              <span>Where your money goes</span>
              <span><b>{pctText(interestPct)}</b> of everything you pay is interest</span>
            </div>
            <div className="amc-split__bar" role="img" aria-label={`Principal ${pctText(principalPct)}, interest ${pctText(interestPct)}`}>
              <i style={{ width: `${principalPct}%`, background: '#a5b4fc' }} />
              <i style={{ width: `${interestPct}%`, background: '#fda4af' }} />
            </div>
            <ul className="amc-split__legend">
              <li><span className="k"><i className="d" style={{ background: '#a5b4fc' }} />Principal</span><b>{fmt(principal)}</b></li>
              <li><span className="k"><i className="d" style={{ background: '#fda4af' }} />Interest</span><b>{fmt(interest)}</b></li>
            </ul>
            <div className="amc-split__total">
              <div className="amc-split__totalk">
                <span className="k">Total paid{totalExtra > 0 ? ' (incl. extras)' : ''}</span>
                {totalExtra > 0 && <small>includes {fmt(totalExtra)} in extra payments</small>}
              </div>
              <b className="amc-split__totalv">{fmt(total)}</b>
            </div>
          </div>
        )}
        <p className="amc-note">{note}</p>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Savings card
// ---------------------------------------------------------------------------
const SavingsCard: React.FC<{
  interestSaved: number; timeSavedMonths: number; paymentsSaved: number;
  baselineInterest: number; newInterest: number; totalExtra: number;
  payoffNew: string | null; payoffOld: string | null; notes: string[];
  fmt: (n: number) => string;
}> = ({ interestSaved, timeSavedMonths, paymentsSaved, baselineInterest, newInterest, totalExtra, payoffNew, payoffOld, notes, fmt }) => {
  const pct = (v: number, of: number) => of > 0 ? Math.min(100, Math.max(0, (v / of) * 100)) : 0;
  return (
    <ResultSection icon={FiZap} title="What Extra Payments Save"
      subtitle="Your extra payments vs paying only the regular schedule."
      tip="Compares the loan with and without your extras. The payment shown at the top is the scheduled one; your extras come on top and go straight to the balance."
      label="Extra payment savings"
    >
      <div className="amc-tiles" style={{ marginTop: 4 }}>
        <div className="amc-tile amc-tile--plain amc-tile--emerald">
          <div className="amc-tile__k">Interest saved</div>
          <span className="amc-tile__v">{fmt(interestSaved)}</span>
          {baselineInterest > 0 && <div className="amc-tile__s">{Math.round((interestSaved / baselineInterest) * 100)}% less interest</div>}
        </div>
        <div className="amc-tile amc-tile--plain amc-tile--sky">
          <div className="amc-tile__k">Time saved</div>
          <span className="amc-tile__v">{formatMonthsAsYearsMonths(timeSavedMonths)}</span>
          <div className="amc-tile__s">{paymentsSaved} fewer payment{paymentsSaved !== 1 ? 's' : ''}</div>
        </div>
        <div className="amc-tile amc-tile--plain amc-tile--indigo">
          <div className="amc-tile__k">Extra paid in total</div>
          <span className="amc-tile__v">{fmt(totalExtra)}</span>
          <div className="amc-tile__s">included in total paid</div>
        </div>
      </div>
      <div className="amc-save">
        <div className="amc-save__row">
          <div className="amc-save__top"><span>Interest without extras</span><b>{fmt(baselineInterest)}</b></div>
          <div className="amc-save__bar"><i style={{ width: '100%', background: '#f43f5e' }} /></div>
        </div>
        <div className="amc-save__row">
          <div className="amc-save__top"><span>Interest with extras</span><b>{fmt(newInterest)}</b></div>
          <div className="amc-save__bar"><i style={{ width: `${pct(newInterest, baselineInterest)}%`, background: '#10b981' }} /></div>
        </div>
      </div>
      {payoffNew && payoffOld && payoffNew !== payoffOld && (
        <p className={hintClass} style={{ marginTop: 12 }}>Paid off {payoffNew} instead of {payoffOld}.</p>
      )}
      {notes.map((t) => (
        <p key={t} className="amc-stale" role="note" style={{ marginTop: 12 }}>
          <SafeIcon icon={FiInfo} /><span>{t}</span>
        </p>
      ))}
    </ResultSection>
  );
};

// ---------------------------------------------------------------------------
// Balance over time chart
// ---------------------------------------------------------------------------
interface BalancePt { x: number; label: string; balance: number; interest: number; }

const AXIS_TICK = { fontSize: 12, fill: '#94a3b8', fontWeight: 600 } as const;

const BalanceChart: React.FC<{ points: BalancePt[]; fmt: (n: number) => string; fmtShort: (n: number) => string }> = ({ points, fmt, fmtShort }) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as BalancePt | undefined;
    return (
      <div className="amc-sum amc-tt">
        <p className="amc-tt__label">{row?.label}</p>
        <p><span className="k"><i style={{ background: '#6366f1' }} />Balance</span><b>{fmt(row?.balance ?? 0)}</b></p>
        <p><span className="k"><i style={{ background: '#f43f5e' }} />Interest paid</span><b>{fmt(row?.interest ?? 0)}</b></p>
      </div>
    );
  };
  const step = Math.max(1, Math.ceil(points.length / 60));
  const shown = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);
  return (
    <ResultSection icon={FiTrendingDown} title="Balance Over Time"
      subtitle="Remaining balance and interest paid so far."
      tip="Balance (indigo) falls as you pay off principal. Interest paid (rose) climbs until the final payment."
      label="Balance over time chart"
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={shown} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="amc-grad-bal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(100,116,139,.18)" vertical={false} />
            <XAxis type="number" dataKey="x" domain={[0, 'dataMax']} tickFormatter={(v) => `${Math.round(v * 10) / 10} yr`} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
            <YAxis tickFormatter={(v) => fmtShort(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(99,102,241,.35)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5} fill="url(#amc-grad-bal)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            <Area type="monotone" dataKey="interest" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="amc-legend">
        <span><i style={{ background: '#6366f1' }} />Remaining balance</span>
        <span><i style={{ background: '#f43f5e' }} />Interest paid so far</span>
      </div>
    </ResultSection>
  );
};

// ---------------------------------------------------------------------------
// Interest vs Principal bar chart
// ---------------------------------------------------------------------------
interface YearBarPt { label: string; interest: number; principal: number; extra: number; }

const IntVsPrincipalChart: React.FC<{ points: YearBarPt[]; fmt: (n: number) => string; fmtShort: (n: number) => string }> = ({ points, fmt, fmtShort }) => {
  const hasExtra = points.some((p) => p.extra > 0);
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as YearBarPt | undefined;
    return (
      <div className="amc-sum amc-tt">
        <p className="amc-tt__label">{label}</p>
        <p><span className="k"><i style={{ background: '#f43f5e' }} />Interest</span><b>{fmt(row?.interest ?? 0)}</b></p>
        <p><span className="k"><i style={{ background: '#6366f1' }} />Principal</span><b>{fmt(row?.principal ?? 0)}</b></p>
        {hasExtra && <p><span className="k"><i style={{ background: '#10b981' }} />Extra payments</span><b>{fmt(row?.extra ?? 0)}</b></p>}
      </div>
    );
  };
  return (
    <ResultSection icon={FiBarChart2} title="Interest vs. Principal Per Year"
      subtitle={hasExtra ? "How each year's money splits between interest, principal and your extra payments." : "How each year's payments split between interest and principal."}
      tip="Early in the loan most of each payment goes to interest. As the balance falls, more goes to principal."
      label="Interest vs principal chart"
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(100,116,139,.18)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={(v) => fmtShort(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,.08)' }} />
            <Bar dataKey="interest" stackId="a" fill="#f43f5e" fillOpacity={0.88} maxBarSize={34} />
            <Bar dataKey="principal" stackId="a" fill="#6366f1" fillOpacity={0.9} maxBarSize={34} radius={hasExtra ? [0, 0, 0, 0] : [6, 6, 0, 0]} />
            {hasExtra && <Bar dataKey="extra" stackId="a" fill="#10b981" fillOpacity={0.92} maxBarSize={34} radius={[6, 6, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="amc-legend">
        <span><i style={{ background: '#f43f5e' }} />Interest</span>
        <span><i style={{ background: '#6366f1' }} />Principal</span>
        {hasExtra && <span><i style={{ background: '#10b981' }} />Extra payments</span>}
      </div>
    </ResultSection>
  );
};

// ---------------------------------------------------------------------------
// Schedule card
// ---------------------------------------------------------------------------
const ScheduleCard: React.FC<{
  rows: ScheduleRow[]; yearly: YearRow[]; hasDates: boolean; fmt: (n: number) => string;
}> = ({ rows, yearly, hasDates, fmt }) => {
  const uid = useId();
  const [view, setView] = useState<'yearly' | 'monthly'>('yearly');
  const [showAll, setShowAll] = useState(false);
  const hasExtra = rows.some((r) => r.extra > 0);
  const shownRows = showAll ? rows : rows.slice(0, SCHEDULE_PREVIEW);
  const tot = {
    payment: sumCents(rows.map((r) => r.payment)), interest: sumCents(rows.map((r) => r.interest)),
    principal: sumCents(rows.map((r) => r.principal)), extra: sumCents(rows.map((r) => r.extra)),
    paid: sumCents(yearly.map((y) => y.totalPaid)),
  };
  return (
    <ResultSection icon={FiList} title="Payment Schedule"
      subtitle="Where each payment goes — year by year or payment by payment."
      tip="Switch to the payment-by-payment view for the full breakdown. Extra payments appear in the Extra column when present."
      label="Payment schedule"
    >
      <div className="amc-sched-bar">
        <SegmentedToggle<'yearly' | 'monthly'>
          size="sm" value={view} onChange={(v) => { setView(v); setShowAll(false); }}
          groupId={`${uid}-sched`} ariaLabel="Schedule view"
          options={[{ value: 'yearly', label: 'Yearly' }, { value: 'monthly', label: 'Each payment' }]}
        />
      </div>
      {view === 'yearly' ? (
        <div className="amc-tbl-wrap">
          <table className="amc-tbl">
            <caption className="amc-sr">Yearly payment schedule</caption>
            <thead>
              <tr>
                <th scope="col">{yearly[0]?.kind === 'calendar' ? 'Year' : 'Loan year'}</th>
                <th scope="col">Total paid</th>
                <th scope="col">Interest</th>
                <th scope="col">Principal</th>
                {hasExtra && <th scope="col">Extra</th>}
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => (
                <tr key={y.label}>
                  <td>{y.label}</td>
                  <td>{fmt(y.totalPaid)}</td>
                  <td>{fmt(y.interest)}</td>
                  <td>{fmt(y.principal)}</td>
                  {hasExtra && <td>{y.extra > 0 ? fmt(y.extra) : '—'}</td>}
                  <td>{fmt(y.endBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{fmt(tot.paid)}</td>
                <td>{fmt(tot.interest)}</td>
                <td>{fmt(tot.principal)}</td>
                {hasExtra && <td>{fmt(tot.extra)}</td>}
                <td>{fmt(0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <>
          <div className={`amc-tbl-wrap${showAll ? ' amc-tbl-wrap--scroll' : ''}`}>
            <table className="amc-tbl" style={{ minWidth: hasExtra ? 560 : 480 }}>
              <caption className="amc-sr">Payment schedule</caption>
              <thead>
                <tr>
                  <th scope="col">{hasDates ? 'Month' : 'Payment'}</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Interest</th>
                  <th scope="col">Principal</th>
                  {hasExtra && <th scope="col">Extra</th>}
                  <th scope="col">Balance</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r) => (
                  <tr key={r.n}>
                    <td>{hasDates && r.date ? fmtIsoMonthShort(r.date) : `#${r.n}`}</td>
                    <td>{fmt(r.payment)}</td>
                    <td>{fmt(r.interest)}</td>
                    <td>{fmt(r.principal)}</td>
                    {hasExtra && <td>{r.extra > 0 ? fmt(r.extra) : '—'}</td>}
                    <td>{fmt(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total (all {rows.length.toLocaleString('en-US')})</td>
                  <td>{fmt(tot.payment)}</td>
                  <td>{fmt(tot.interest)}</td>
                  <td>{fmt(tot.principal)}</td>
                  {hasExtra && <td>{fmt(tot.extra)}</td>}
                  <td>{fmt(0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length > SCHEDULE_PREVIEW && !showAll && (
            <button type="button" className="amc-more" onClick={() => setShowAll(true)}>
              Show all {rows.length.toLocaleString('en-US')} payments
            </button>
          )}
          {showAll && rows.length > SCHEDULE_PREVIEW && (
            <button type="button" className="amc-more" onClick={() => setShowAll(false)}>Show less</button>
          )}
        </>
      )}
    </ResultSection>
  );
};

// ---------------------------------------------------------------------------
// Sources panel (exact AutoLoan pattern, rebranded for amortization)
// ---------------------------------------------------------------------------
const SourcesPanel: React.FC<{ reduced: boolean | null }> = ({ reduced }) => {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const pending = AMORTIZATION_SOURCES.filter((s) => s.status !== 'verified').length;
  const reviewed = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${AMORTIZATION_LAST_REVIEWED}T00:00:00Z`));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 50);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 1600);
      }
      return next;
    });
  };

  return (
    <div ref={panelRef}
      style={pulse ? { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' } : undefined}
      className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300"
    >
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`${uid}-src`}
        className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
            <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources</span>
            <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">
              {AMORTIZATION_SOURCES.length} references{pending > 0 ? ` (${pending} being verified)` : ''}. Last reviewed {reviewed}.
            </span>
          </div>
        </div>
        <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}>
          <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
        </span>
      </button>
      <motion.div id={`${uid}-src`} initial={false}
        animate={{ height: open ? 'auto' : 0 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
        style={{ overflow: 'hidden' }} aria-hidden={!open}
      >
        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
          <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {AMORTIZATION_SOURCES.map((src, i) => {
              const verified = src.status === 'verified';
              return (
                <li key={src.id} className="flex gap-3 pt-4 first:pt-0">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200 break-words">{src.title}</p>
                    {!verified && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Being verified</span>
                    )}
                    <p className="leading-relaxed mt-1.5 text-neutral-600 dark:text-neutral-400">
                      {verified ? src.note : 'We are still checking this reference.'}
                    </p>
                    {verified && src.url && (
                      <a href={src.url} target="_blank" rel="nofollow noopener noreferrer" tabIndex={open ? 0 : -1}
                        className="group inline-flex items-center gap-1.5 mt-2.5 amc-srclink font-semibold text-[13px] focus:outline-none focus-visible:underline"
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
          <div className="pt-4 mt-4 border-t border-neutral-200/70 dark:divide-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-2">
            <p><strong className="text-neutral-700 dark:text-neutral-300">How it is calculated:</strong> the regular payment uses the standard annuity formula M = P × r / (1 − (1 + r)<sup>−n</sup>), where P is the loan amount, r the rate per payment period and n the total number of payments. At 0% the payment is P ÷ n. Each period, interest on the opening balance is rounded to cents, the regular payment is applied, then any extra payments. The last payment clears whatever balance remains, so it usually differs slightly from the regular payment. The effective annual rate shown is (1 + i/k)<sup>k</sup> − 1, where i is the nominal annual rate and k the payments per year. Weekly and bi-weekly loans use 52 and 26 payments per year.</p>
            <p><strong className="text-neutral-700 dark:text-neutral-300">Extra payments</strong> are applied on a payment date after the regular payment and are capped at the balance owed. Recurring and one-time extras are combined in the same schedule. Fees, taxes, insurance and prepayment charges are not included. Nothing here is a lender quote — your lender&apos;s rules decide the real figures.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
const AmortizationCalculator: React.FC<AmortizationCalculatorProps> = ({
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
  const uid = useId();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // ---- Loan inputs ----
  const [loanAmount, setLoanAmount] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [termValue, setTermValue] = useState('');
  const [termUnit, setTermUnit] = useState<'years' | 'months'>('years');
  const [frequency, setFrequency] = useState<AmortFrequency>('monthly');
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState<string>(DEFAULT_CURRENCY_SYMBOL);

  // ---- Extra payments panel ----
  const [extrasOpen, setExtrasOpen] = useState(false);

  const [regular, setRegular] = useState<RegularExtra>(EMPTY_REGULAR);
  const [oneTime, setOneTime] = useState<OneTimeExtraState>(EMPTY_ONE_TIME);

  // ---- Form state ----
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [committed, setCommitted] = useState<Committed | null>(null);

  const fmt = useCallback((n: number) => formatMoney(n, currencySymbol), [currencySymbol]);

  const clearErr = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const upd = (setter: (v: string) => void, ...keys: string[]) => (v: string) => {
    setter(v);
    if (keys.length) clearErr(...keys);
    setTouched(true);
  };

  // ---- Derived hints ----
  const rateNum = numOrZero(annualRate);
  // One term field + a unit switch. Everything below works in whole months, split into years + months for the maths file.
  const termTotalMonths = termUnit === 'years'
    ? Math.round((parseFloat(termValue) || 0) * 12)
    : (parseInt(termValue || '0', 10) || 0);
  const yearsNum = Math.floor(termTotalMonths / 12);
  const monthsNum = termTotalMonths % 12;
  const n = (yearsNum > 0 || monthsNum > 0) ? scheduledPaymentCount(yearsNum, monthsNum, frequency) : 0;

  const filledExtraCount =
    (parseFloat(regular.amount) > 0 ? 1 : 0) +
    (parseFloat(oneTime.amount) > 0 ? 1 : 0);

  const hasFirstDate = firstPaymentDate.trim() !== '';
  const firstPaymentDateObj = useMemo(() => isoToDate(firstPaymentDate), [firstPaymentDate]);
  const fpdRange = useMemo(() => firstPaymentRange(), []);
  // The picker calls onChange on every blur (even when nothing changed). Ignore those, so just tabbing
  // through the field does not mark the form as edited or dim the current results.
  const onFirstDateChange = (d: Date | null) => {
    const next = d ? dateToIso(d) : '';
    if (next === firstPaymentDate) return;
    setFirstPaymentDate(next);
    clearErr('firstPaymentDate');
    setTouched(true);
  };

  const changeTermUnit = (unit: 'years' | 'months') => {
    if (unit === termUnit) return;
    if (termValue.trim() !== '') {
      const v = parseFloat(termValue) || 0;
      const next = unit === 'months' ? Math.round(v * 12) : Math.round((v / 12) * 100) / 100;
      setTermValue(next > 0 ? String(next) : '');
    }
    setTermUnit(unit);
    clearErr('term');
    setTouched(true);
  };

  // Any change to an extra clears its errors (they are re-checked on the next Calculate).
  const clearExtraErrs = () =>
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => k.startsWith('recurringExtra') || k.startsWith('oneTimeExtra'));
      if (keys.length === 0) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  // ---- Regular extra handler (error key: recurringExtra0) ----
  const updRegular = (patch: Partial<RegularExtra>) => {
    setRegular((prev) => ({ ...prev, ...patch }));
    clearExtraErrs();
    setTouched(true);
  };

  // ---- One-time payment handler (error key: oneTimeExtra0) ----
  const updOneTime = (patch: Partial<OneTimeExtraState>) => {
    setOneTime((prev) => ({ ...prev, ...patch }));
    clearExtraErrs();
    setTouched(true);
  };

  // ---- Build inputs ----
  const buildInputs = (): AmortizationInputs => {
    // A blank regular extra is passed as amount 0, which the maths ignores.
    // Start / stop are typed as time into the loan and converted to payment numbers here.
    const startMonthsNum = durationMonths(regular.startYears, regular.startMonths);
    const endMonthsNum = durationMonths(regular.endYears, regular.endMonths);
    const recExtras: RecurringExtra[] = [{
      amount: parseFloat(regular.amount) || 0,
      frequency: regular.frequency,
      startPayment: startMonthsNum > 0 ? startPaymentFor(startMonthsNum, frequency) : undefined,
      endPayment: endMonthsNum > 0 ? endPaymentFor(endMonthsNum, frequency) : null,
    }];
    // A blank placement is passed through as invalid so the user is told, instead of silently using payment 1.
    const otExtras: OneTimeExtra[] = [{
      amount: parseFloat(oneTime.amount) || 0,
      ...(oneTime.byDate && hasFirstDate
        ? { date: oneTime.date }
        : { payment: oneTime.payment ? parseInt(oneTime.payment, 10) : NaN }),
    }];
    return {
      loanAmount: parseFloat(loanAmount) || 0,
      annualRatePct: parseFloat(annualRate) || 0,
      termYears: yearsNum,
      termMonths: monthsNum,
      frequency,
      firstPaymentDate: hasFirstDate ? firstPaymentDate : null,
      recurringExtras: recExtras,
      oneTimeExtras: otExtras,
    };
  };

  const formSig = () => JSON.stringify([
    loanAmount, annualRate, termValue, termUnit, frequency,
    firstPaymentDate, currencySymbol, regular, oneTime,
  ]);

  // Stale only fires when there is already a committed result.
  const stale = committed !== null && committed.sig !== formSig();

  const isCalculateDisabled =
    loanAmount.trim() === '' || annualRate.trim() === '' || termValue.trim() === '';
  const isClearDisabled = !touched && !committed;

  const handleClear = () => {
    if (isClearDisabled) return;
    setLoanAmount(''); setAnnualRate(''); setTermValue(''); setTermUnit('years');
    setFrequency('monthly'); setFirstPaymentDate('');
    setRegular(EMPTY_REGULAR); setOneTime(EMPTY_ONE_TIME);
    setErrors({}); setCommitted(null); setTouched(false);
  };

  // Start / stop are checked here in plain words (the maths file only knows payment numbers).
  const regularTimingError = (): string | null => {
    if (!(parseFloat(regular.amount) > 0)) return null;
    const startM = durationMonths(regular.startYears, regular.startMonths);
    const endM = durationMonths(regular.endYears, regular.endMonths);
    const loanMonths = yearsNum * 12 + monthsNum;
    const S = startPaymentFor(startM, frequency);
    if (n > 0 && S > n) return `The extra would start after your loan ends. Your loan lasts ${formatMonthsAsYearsMonths(loanMonths)}.`;
    if (endM > 0 && endPaymentFor(endM, frequency) < S) return 'Stop after must be later than Start after.';
    return null;
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;
    const inputs = buildInputs();
    const base = validateAmortizationInputs(inputs);
    const timingErr = regularTimingError();
    // Blank placements get a plain-words message (the maths file only knows "invalid").
    const oneTimeErrs: Record<string, string> = {};
    if (parseFloat(oneTime.amount) > 0) {
      if (oneTime.byDate && hasFirstDate) {
        if (!oneTime.date) oneTimeErrs.oneTimeExtra0 = 'Choose a date for this payment.';
      } else if (!oneTime.payment) {
        oneTimeErrs.oneTimeExtra0 = 'Enter the payment number for this payment.';
      }
    }
    const termErr = termTotalMonths > MAX_TERM_YEARS * 12
      ? { term: `The loan term can be at most ${MAX_TERM_YEARS} years (${MAX_TERM_YEARS * 12} months).` }
      : {};
    const extraErrs = { ...termErr, ...oneTimeErrs, ...(timingErr ? { recurringExtra0: timingErr } : {}) };
    const v = Object.keys(extraErrs).length > 0
      ? { valid: false, errors: { ...base.errors, ...extraErrs } }
      : base;
    if (!v.valid) {
      setErrors(v.errors);
      const hasExtraErr = Object.keys(v.errors).some((k) => k.startsWith('recurringExtra') || k.startsWith('oneTimeExtra'));
      if (hasExtraErr) setExtrasOpen(true);
      setCommitted(null);
      return;
    }
    let result: AmortizationResult;
    try {
      result = calculateAmortization(inputs);
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Something went wrong. Please check your entries.' });
      setCommitted(null);
      return;
    }
    setErrors({});
    setCommitted({ inputs, result, currencySymbol, sig: formSig() });
    if (onCalculationComplete) onCalculationComplete();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  };

  // ---- Report builder ----
  const report = useMemo<ShareableReport | null>(() => {
    if (!committed) return null;
    const { inputs, result: r, currencySymbol: sym } = committed;
    const pdfSym = pdfCurrencySymbol(sym);
    const f = (n: number) => formatMoney(n, sym);
    const fP = (n: number) => formatMoney(n, pdfSym);
    const termStr = formatMonthsAsYearsMonths(inputs.termYears * 12 + inputs.termMonths);
    const fLabel = FREQ_OPTIONS.find((o) => o.value === inputs.frequency)?.label ?? inputs.frequency;

    const summaryRows = [
      { label: 'Regular payment', value: f(r.regularPayment) },
      { label: 'Total interest', value: f(r.totalInterest) },
      { label: r.totalExtra > 0 ? 'Total paid (incl. extras)' : 'Total paid', value: f(r.totalPaid) },
      { label: 'Number of payments', value: r.paymentsMade.toLocaleString('en-US') },
      ...(r.payoffDate ? [{ label: 'Payoff date', value: fmtIsoMonth(r.payoffDate) }] : []),
      ...(r.totalExtra > 0 ? [{ label: 'Extra payments total', value: f(r.totalExtra) }] : []),
      { label: 'Effective annual rate', value: `${effectiveAnnualRatePct(inputs.annualRatePct, periodsPerYearFor(inputs.frequency)).toFixed(2)}%` },
    ];
    const sections: ShareableReport['sections'] = [{ heading: 'Loan Summary', rows: summaryRows, variant: 'output' }];
    const hasExtras = r.totalExtra > 0;
    const regularExtraText = (fm: (n: number) => string, e: RecurringExtra) =>
      `${fm(e.amount)} ${EXTRA_EVERY[e.frequency]}${e.startPayment ? ` from payment #${e.startPayment}` : ''}${e.endPayment ? ` to payment #${e.endPayment}` : ''}`;
    const oneTimeText = (fm: (n: number) => string, e: OneTimeExtra) =>
      `${fm(e.amount)} at ${e.date ? `on/after ${fmtIsoDate(e.date)}` : `payment #${e.payment}`}`;
    // Compact summary for the PNG: key loan numbers first, then everything about the extras.
    const withExtra = paymentWithExtra(r.regularPayment, (inputs.recurringExtras ?? []).find((e) => e.amount > 0), inputs.frequency);
    // EMI + extra sits in the Loan Summary (PNG and PDF), straight after the regular payment.
    const emiPlusExtraRow = withExtra && hasExtras
      ? [{ label: 'Payment with extra (EMI + extra)', value: `${withExtra.exact ? '' : 'about '}${f(withExtra.amount)}${withExtra.exact ? '' : ' avg'}` }]
      : [];
    const imageLoanRows = [
      { label: 'Loan amount (principal)', value: f(inputs.loanAmount) },
      { label: hasExtras ? 'Regular payment (EMI)' : 'Regular payment', value: f(r.regularPayment) },
      ...emiPlusExtraRow,
      { label: 'Total interest', value: f(r.totalInterest) },
      { label: hasExtras ? 'Total paid (incl. extras)' : 'Total paid', value: f(r.totalPaid) },
      { label: 'Number of payments', value: hasExtras ? `${r.paymentsMade.toLocaleString('en-US')} (scheduled ${r.scheduledPayments.toLocaleString('en-US')})` : r.paymentsMade.toLocaleString('en-US') },
      ...(r.payoffDate ? [{ label: 'Payoff date', value: fmtIsoMonth(r.payoffDate) }] : []),
    ];
    const imageSections: NonNullable<ShareableReport['imageSections']> = [
      { heading: 'Loan Summary', rows: imageLoanRows, variant: 'output' },
    ];
    // PDF: results only (the loan amount and other inputs are listed once, under "Your Inputs").
    const earRow = summaryRows[summaryRows.length - 1];
    sections.length = 0;
    sections.push({ heading: 'Loan Summary', rows: [...imageLoanRows.slice(1), earRow], variant: 'output' });
    if (hasExtras) {
      const extraRows: { label: string; value: string }[] = [];
      (inputs.recurringExtras ?? []).filter((e) => e.amount > 0).forEach((e) => extraRows.push({ label: 'Regular extra', value: regularExtraText(f, e) }));
      (inputs.oneTimeExtras ?? []).filter((e) => e.amount > 0).forEach((e) => extraRows.push({ label: 'One-time payment', value: oneTimeText(f, e) }));
      extraRows.push({ label: 'Extra payments total', value: f(r.totalExtra) });
      if (r.savings) {
        extraRows.push({ label: 'Interest saved', value: f(r.savings.interestSaved) });
        extraRows.push({ label: 'Time saved', value: `${formatMonthsAsYearsMonths(r.savings.timeSavedMonths)} (${r.savings.paymentsSaved} fewer payments)` });
      }
      imageSections.push({ heading: 'Extra Payments', rows: extraRows, variant: 'output' });
      // PDF: outcomes only (the extras themselves are listed once, under "Your Inputs").
      if (r.savings && r.baseline) {
        const lessPct = r.baseline.totalInterest > 0 ? Math.round((r.savings.interestSaved / r.baseline.totalInterest) * 100) : 0;
        sections.push({
          heading: 'Effect of Extra Payments',
          rows: [
            { label: 'Extra payments total', value: f(r.totalExtra) },
            { label: 'Interest saved', value: `${f(r.savings.interestSaved)} (${lessPct}% less)` },
            { label: 'Time saved', value: `${formatMonthsAsYearsMonths(r.savings.timeSavedMonths)} (${r.savings.paymentsSaved} fewer payments)` },
            ...(r.baseline.payoffDate ? [{ label: 'Payoff without extras', value: fmtIsoMonth(r.baseline.payoffDate) }] : []),
          ],
          variant: 'output',
        });
      }
    }
    const inputRows = [
      { label: 'Loan amount', value: fP(inputs.loanAmount) },
      { label: 'Annual interest rate', value: `${inputs.annualRatePct}%` },
      { label: 'Loan term', value: termStr },
      { label: 'Payment frequency', value: fLabel },
      ...(inputs.firstPaymentDate ? [{ label: 'First payment date', value: fmtIsoDate(inputs.firstPaymentDate) }] : []),
    ];
    (inputs.recurringExtras ?? []).filter((e) => e.amount > 0).forEach((e) => {
      inputRows.push({ label: 'Regular extra payment', value: regularExtraText(fP, e) });
    });
    (inputs.oneTimeExtras ?? []).filter((e) => e.amount > 0).forEach((e) => {
      inputRows.push({ label: 'One-time payment', value: oneTimeText(fP, e) });
    });
    const yearRows = r.yearly.map((y) => ({
      label: y.kind === 'loan' ? `Year ${y.label}` : String(y.label),
      value: `Paid ${fP(y.totalPaid)}${y.extra > 0 ? ` (incl. ${fP(y.extra)} extra)` : ''} | Interest ${fP(y.interest)} | Balance ${fP(y.endBalance)}`,
    }));
    const noteRows = [
      { label: 'Method', value: 'Standard level-payment (annuity) formula' },
      { label: 'Interest', value: 'Charged each period on the remaining balance' },
      ...(hasExtras ? [{ label: 'Extra payments', value: 'Applied after the regular payment' }] : []),
      { label: 'Final payment', value: 'Clears the balance; may differ slightly' },
      { label: 'Not included', value: 'Fees, taxes, insurance, prepayment charges' },
      { label: 'Reference', value: 'CFPB Regulation Z, Appendix J' },
    ];
    const pdfOnly: NonNullable<ShareableReport['pdfOnlySections']> = [
      { heading: 'Your Inputs', rows: inputRows, variant: 'input' },
      ...(yearRows.length > 0 ? [{ heading: 'Year-by-Year Summary', rows: yearRows, variant: 'output' as const }] : []),
      { heading: 'Methods and Notes', rows: noteRows, variant: 'output' as const },
    ];
    return {
      title: 'AMORTIZATION RESULT',
      headlineValue: f(r.regularPayment),
      headlineLabel: `${fLabel.toLowerCase()} for ${termStr} at ${inputs.annualRatePct}%${hasExtras ? ' (before extras)' : ''}`,
      accentColor: ACCENT_HEX,
      meta: [fLabel, sym],
      sections,
      imageSections,
      pdfOnlySections: pdfOnly,
      disclaimer: "Estimate only. Not a lender quote or financial, legal or tax advice. Fees and taxes excluded.",
      fileNameBase: 'amortization-result',
    };
  }, [committed]);

  useEffect(() => { onReportChange?.(report); }, [report, onReportChange]);

  // ---- Download menu outside-click ----
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const h = (e: MouseEvent | TouchEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [downloadMenuOpen]);

  useEffect(() => { if (downloadingFormat) setDownloadMenuOpen(false); }, [downloadingFormat]);

  // ---- Download buttons ----
  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button type="button" onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!report || downloadingFormat !== null}
        aria-haspopup="menu" aria-expanded={downloadMenuOpen}
        title={report ? 'Download your result' : 'Calculate a result first'}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        <SafeIcon icon={downloadingFormat ? FiLoader : FiDownload} className={`w-3.5 h-3.5 flex-shrink-0 ${downloadingFormat ? 'animate-spin' : ''}`} />
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">{downloadingFormat ? 'Preparing…' : 'Download'}</span>
        <SafeIcon icon={FiChevronDown} className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 transition-transform duration-200 ${downloadMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {downloadMenuOpen && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden">
          {[
            { format: 'image' as const, icon: FiImage, label: 'PNG Image', sub: 'Key results card' },
            { format: 'pdf' as const, icon: FiFileText, label: 'PDF Report', sub: 'Inputs + year-by-year summary' },
          ].map((item, idx) => (
            <button key={item.format} type="button" role="menuitem"
              onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.(item.format); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:bg-neutral-50 ${idx > 0 ? 'border-t border-neutral-100 dark:border-neutral-700/50' : ''}`}
            >
              <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400">
                <SafeIcon icon={item.icon} className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">{item.label}</span>
                <span className="block text-xs text-neutral-400 mt-0.5">{item.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ---- Share bar ----
  const renderShareBar = () => (
    <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-5 mt-5 border-t border-neutral-100 dark:border-neutral-800 text-center sm:text-right">
      <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">Like this? Please share</span>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => onShare?.()} aria-label="Share"
          className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onEmailShare?.()} aria-label="Share via email"
          className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60">
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onCopyLink?.()} aria-label={linkCopied ? 'Link copied' : 'Copy link'}
          className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'amc-linkbtn hover:shadow-md hover:-translate-y-0.5'}`}>
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? 'Copied' : 'Link'}</span>
        </button>
      </div>
    </div>
  );

  // ---- Results ----
  const renderResults = () => {
    if (!committed) return null;
    const { inputs, result: r } = committed;
    const fmtLocal = (n: number) => formatMoney(n, committed.currencySymbol);
    const fLabel = FREQ_OPTIONS.find((o) => o.value === inputs.frequency)?.label ?? inputs.frequency;
    const termStr = formatMonthsAsYearsMonths(inputs.termYears * 12 + inputs.termMonths);
    const caption = `${fLabel.toLowerCase()} payment for ${termStr} at ${inputs.annualRatePct}%${r.totalExtra > 0 ? ' (before extras)' : ''}`;

    const tiles = [
      { label: 'Total interest', value: fmtLocal(r.totalInterest), tone: 'rose' as const, icon: FiPercent },
      { label: 'Total paid', value: fmtLocal(r.totalPaid), tone: 'indigo' as const, icon: FiDollarSign },
      { label: 'Payments', value: r.paymentsMade.toLocaleString('en-US'), sub: `of ${r.scheduledPayments} scheduled`, tone: 'sky' as const, icon: FiHash },
      { label: 'Effective annual rate', value: `${effectiveAnnualRatePct(inputs.annualRatePct, periodsPerYearFor(inputs.frequency)).toFixed(2)}%`, sub: `from ${inputs.annualRatePct}%, interest applied ${fLabel.toLowerCase()}`, tone: 'violet' as const, icon: FiTrendingDown },
      ...(r.payoffDate ? [{ label: 'Payoff date', value: fmtIsoMonth(r.payoffDate), tone: 'emerald' as const, icon: FiCheckCircle }] : []),
    ];
    const savingsNote = r.savings && r.savings.interestSaved > 0
      ? `Your extra payments finish the loan ${formatMonthsAsYearsMonths(r.savings.timeSavedMonths)} sooner and save you ${fmtLocal(r.savings.interestSaved)} in interest.`
      : null;

    const perYear = periodsPerYearFor(inputs.frequency);
    const balancePts: BalancePt[] = [
      { x: 0, label: 'Start', balance: inputs.loanAmount, interest: 0 },
    ];
    let cumInt = 0;
    r.rows.forEach((row) => {
      cumInt += row.interest;
      balancePts.push({
        x: Math.round((row.n / perYear) * 100) / 100,
        label: row.date ? fmtIsoMonthShort(row.date) : `Payment #${row.n}`,
        balance: row.closing,
        interest: cumInt,
      });
    });
    const symShort = committed.currencySymbol;
    const fmtShort = (n: number) => `${symShort}${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

    const yearBarPts: YearBarPt[] = r.yearly.map((y) => ({
      label: String(y.label), interest: y.interest, principal: y.principal, extra: y.extra,
    }));

    const hasDates = inputs.firstPaymentDate !== null;

    // Tell the user when an extra never had any effect (the loan was already paid off before it was due).
    const unusedNotes: string[] = [];
    (inputs.oneTimeExtras ?? []).filter((e) => e.amount > 0).forEach((e) => {
      const late = e.date
        ? Boolean(r.payoffDate && e.date > r.payoffDate)
        : (e.payment ?? 0) > r.paymentsMade;
      if (late) unusedNotes.push(`Your one-time payment of ${fmtLocal(e.amount)} was not used, because the loan was already paid off by then.`);
    });
    (inputs.recurringExtras ?? []).filter((e) => e.amount > 0).forEach((e) => {
      if ((e.startPayment ?? 1) > r.paymentsMade) unusedNotes.push(`Your regular extra payment never started, because the loan was already paid off by then.`);
    });

    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 50, damping: 12, mass: 0.8 }}
        style={{ display: 'flex', flexDirection: 'column', rowGap: 20 }}
        role="region" aria-label="Amortization results"
      >
        <p className="amc-sr" role="status">
          Result updated. Regular payment {fmtLocal(r.regularPayment)}. Total interest {fmtLocal(r.totalInterest)}. Total paid {fmtLocal(r.totalPaid)}.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Your Amortization Results</h3>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">{renderDownloadButtons()}</div>
        </div>

        <PaymentHero
          text={fmtLocal(r.regularPayment)}
          caption={caption}
          principal={Math.max(0, r.totalPaid - r.totalInterest)}
          interest={r.totalInterest}
          fmt={fmtLocal}
          totalExtra={r.totalExtra}
          boost={r.savings && r.totalExtra > 0 ? { extraPaid: r.totalExtra, interestSaved: r.savings.interestSaved, timeSavedMonths: r.savings.timeSavedMonths, withExtra: paymentWithExtra(r.regularPayment, (inputs.recurringExtras ?? []).find((e) => e.amount > 0), inputs.frequency), freqWord: fLabel.toLowerCase() } : null}
          note={`This is the regular scheduled payment. The final payment usually differs slightly, as it clears whatever balance remains.${r.totalExtra > 0 ? ' Extra payments are applied on top of this amount.' : ''}`}
        />

        <ResultSection icon={FiCalendar} title="Loan Summary"
          subtitle="The key numbers for this loan."
          tip="Total interest is what you pay the lender beyond the original amount borrowed. Total paid is the loan plus all interest. The effective annual rate is what your rate works out to over a full year once interest on interest is counted."
          label="Loan summary"
        >
          <div className="amc-tiles amc-tiles--2" style={{ marginTop: 4 }}>
            {tiles.map((t) => (
              <div key={t.label} className={`amc-tile amc-tile--${t.tone}`}>
                <span className="amc-tile__ic" aria-hidden="true"><SafeIcon icon={t.icon} /></span>
                <div className="amc-tile__k">{t.label}</div>
                <span className="amc-tile__v">{t.value}</span>
                {t.sub && <div className="amc-tile__s">{t.sub}</div>}
              </div>
            ))}
            {savingsNote && (
              <div className="amc-tile amc-tile--gray amc-tile--note">
                <span className="amc-tile__ic" aria-hidden="true"><SafeIcon icon={FiZap} /></span>
                <p className="amc-tile__note">{savingsNote}</p>
              </div>
            )}
          </div>
        </ResultSection>

        {r.savings && r.baseline && (
          <SavingsCard
            interestSaved={r.savings.interestSaved}
            timeSavedMonths={r.savings.timeSavedMonths}
            paymentsSaved={r.savings.paymentsSaved}
            baselineInterest={r.baseline.totalInterest}
            newInterest={r.totalInterest}
            totalExtra={r.totalExtra}
            payoffNew={r.payoffDate ? fmtIsoMonth(r.payoffDate) : null}
            payoffOld={r.baseline.payoffDate ? fmtIsoMonth(r.baseline.payoffDate) : null}
            notes={unusedNotes}
            fmt={fmtLocal}
          />
        )}

        <BalanceChart points={balancePts} fmt={fmtLocal} fmtShort={fmtShort} />
        <IntVsPrincipalChart points={yearBarPts} fmt={fmtLocal} fmtShort={fmtShort} />
        <ScheduleCard rows={r.rows} yearly={r.yearly} hasDates={hasDates} fmt={fmtLocal} />
      </motion.div>
    );
  };

  const hasError = Object.keys(errors).length > 0;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: '1.5rem' }}>
      <style>{AMC_CSS}</style>

      {/* ---- Main inputs ---- */}
      <InputCard title="Loan Details" subtitle="Enter the core numbers for your loan.">

        {/* Currency picker — one tap, no dropdown */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={fieldLabelClass}>Currency symbol</span>
            <InfoTip text="Only changes the symbol shown next to amounts, in the results and in downloads. It does not convert currencies or change any calculation." widthClass="w-64" />
          </div>
          <div style={{ maxWidth: 340 }}>
            <SegmentedToggle<string>
              value={currencySymbol}
              onChange={(v) => { setCurrencySymbol(v); setTouched(true); }}
              options={CURRENCY_OPTIONS.map((o) => ({ value: o.symbol, label: o.symbol, ariaLabel: o.label }))}
              groupId={`${uid}-curr`}
              ariaLabel="Currency symbol"
              dividers
            />
          </div>
        </div>

        {/* Core fields */}
        <div style={FIELD_GRID_STYLE}>
          <MoneyField
            id={`${uid}-amt`}
            label="Loan amount"
            tip="The total amount you are borrowing, before any down payment or fees."
            sym={currencySymbol}
            value={loanAmount}
            onChange={upd(setLoanAmount, 'loanAmount')}
            error={errors.loanAmount}
          />
          <PercentField
            id={`${uid}-rate`}
            label="Annual interest rate"
            tip="The nominal annual interest rate. Not the monthly or per-period rate — the calculator converts it."
            value={annualRate}
            onChange={upd(setAnnualRate, 'annualRatePct')}
            error={errors.annualRatePct}
            hint={rateNum === 0 && annualRate !== '' ? 'At 0% the payment is simply loan ÷ number of payments.' : undefined}
          />
        </div>

        {/* Term (one field + unit switch) and first payment date */}
        <div className="amc-ot">
          <div className="amc-ot__grid">
            <div className="min-w-0">
              <div className="amc-ot__head amc-ot__head--right">
                <div className="flex items-center gap-1.5 min-w-0">
                  <label htmlFor={`${uid}-term`} className={fieldLabelClass}>Loan term</label>
                  <InfoTip text="How long you have to repay the loan. Type it in years or in months and switch the unit if you like. Years can include decimals, for example 7.5 years is 7 years 6 months." />
                </div>
                <SegmentedToggle<'years' | 'months'>
                  size="sm"
                  value={termUnit}
                  onChange={changeTermUnit}
                  options={[{ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' }]}
                  groupId={`${uid}-termunit`}
                  ariaLabel="Loan term unit"
                />
              </div>
              <NumField
                id={`${uid}-term`}
                value={termValue}
                onChange={upd(setTermValue, 'term')}
                suffix={termUnit === 'years' ? 'yrs' : 'mo'}
                maxDecimals={termUnit === 'years' ? 2 : 0}
                maxInt={termUnit === 'years' ? 3 : 4}
                placeholder={termUnit === 'years' ? 'e.g. 15' : 'e.g. 180'}
                error={Boolean(errors.term)}
                describedBy={errors.term ? `${uid}-term-err` : undefined}
              />
              <FieldError id={`${uid}-term-err`} message={errors.term} />
            </div>
            <div className="min-w-0">
              <div className="amc-ot__head amc-ot__head--left">
                <div className="flex items-center gap-1.5 min-w-0">
                  <label htmlFor={`${uid}-fpd`} className={fieldLabelClass}>First payment date</label>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">(optional)</span>
                  <InfoTip text="Fill this in to see real calendar dates in the schedule and results. Leave blank to use payment numbers only." />
                </div>
              </div>
              <DateTimePicker
                id={`${uid}-fpd`}
                value={firstPaymentDateObj}
                onChange={onFirstDateChange}
                minDate={fpdRange.min}
                maxDate={fpdRange.max}
                placeholder="MM/DD/YYYY"
                ariaLabel="First payment date"
                error={Boolean(errors.firstPaymentDate)}
                dateLabel=""
              />
              <FieldError id={`${uid}-fpd-err`} message={errors.firstPaymentDate} />
            </div>
          </div>
        </div>

        {/* Payment frequency */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={fieldLabelClass}>Payment frequency</span>
            <InfoTip text="How often you make payments. The payment is worked out so the loan is repaid over the same term, so more frequent payments only save a small amount of interest. This is not an accelerated plan such as half a monthly payment every two weeks." />
          </div>
          <div style={{ maxWidth: 520 }}>
            <SegmentedToggle<AmortFrequency>
              value={frequency}
              onChange={(v) => { setFrequency(v); clearErr('frequency'); setTouched(true); }}
              options={FREQ_OPTIONS}
              groupId={`${uid}-freq`}
              ariaLabel="Payment frequency"
            />
          </div>
        </div>
      </InputCard>

      {/* ---- Extra payments ---- */}
      <CollapseCard
        id={`${uid}-extras`}
        icon={FiZap}
        title="Extra payments"
        subtitle="Want to finish sooner? See how much interest you save by paying a little extra. Skip this if not."
        optional
        badge={filledExtraCount > 0 ? `${filledExtraCount} added` : undefined}
        open={extrasOpen}
        onToggle={() => setExtrasOpen((o) => !o)}
      >
        {/* Regular extra */}
        <RegularExtraRow
          id={`${uid}-reg`}
          sym={currencySymbol}
          fmt={fmt}
          loanFrequency={frequency}
          loanMonths={yearsNum * 12 + monthsNum}
          value={regular}
          onChange={updRegular}
          error={errors.recurringExtra0}
        />

        {/* One-time payment */}
        <div className="pt-6 border-t border-neutral-100 dark:border-neutral-700/60">
          <OneTimeExtraRow
            id={`${uid}-ot`}
            sym={currencySymbol}
            fmt={fmt}
            loanPayments={n}
            hasFirstDate={hasFirstDate}
            firstPaymentDate={firstPaymentDate}
            value={oneTime}
            onChange={updOneTime}
            error={errors.oneTimeExtra0}
          />
        </div>
      </CollapseCard>

      {/* ---- Error / stale banners ---- */}
      {hasError && !errors.form && (
        <p role="alert" className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0" />
          Please fix the highlighted fields, then press Calculate again.
        </p>
      )}
      {errors.form && (
        <p role="alert" className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0" />
          {errors.form}
        </p>
      )}
      {stale && !hasError && (
        <p className="amc-stale" role="status">
          <SafeIcon icon={FiInfo} aria-hidden="true" />
          <span>Your inputs changed. Press Calculate to update the results.</span>
        </p>
      )}

      {/* ---- Action buttons ---- */}
      <div className="flex flex-col-reverse md:flex-row justify-center items-center gap-4 pt-4">
        <button type="button" onClick={handleClear} disabled={isClearDisabled}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:bg-neutral-50 dark:hover:bg-neutral-700/60 hover:border-neutral-300 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:scale-100"
        >
          <SafeIcon icon={FiRotateCcw} className="w-4 h-4 text-neutral-400 group-hover:text-neutral-500 group-hover:-rotate-45 transition-all duration-200" />
          Clear
        </button>
        <button type="button" onClick={handleCalculate} disabled={isCalculateDisabled}
          style={{ background: '#4f46e5', boxShadow: '0 10px 20px -6px rgba(79,70,229,.45),0 4px 8px -2px rgba(79,70,229,.25)' }}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-10 py-3.5 text-white text-sm font-semibold rounded-lg hover:brightness-[1.08] active:scale-[0.98] active:brightness-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
        >
          <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
          Calculate
        </button>
      </div>

      {isCalculateDisabled && (
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 text-center" role="status">
          To calculate, fill in:{' '}
          {[
            loanAmount.trim() === '' ? 'loan amount' : '',
            annualRate.trim() === '' ? 'interest rate' : '',
            termValue.trim() === '' ? 'loan term' : '',
          ].filter(Boolean).join(', ')}.
        </p>
      )}

      {/* ---- Empty state ---- */}
      {!committed && !hasError && <EmptyState />}

      {/* ---- Results ---- */}
      <div
        ref={resultsRef}
        aria-busy={stale ? true : undefined}
        style={{ scrollMarginTop: 24, opacity: stale ? 0.5 : 1, filter: stale ? 'saturate(.7)' : undefined, transition: 'opacity .25s ease, filter .25s ease' }}
      >
        {!hasError && renderResults()}
      </div>

      {/* ---- Disclaimer ---- */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong>{' '}
          This calculator provides estimates for general information only. It is not a loan offer, a lender quote, or financial, legal or tax advice.
          Results depend on the figures you enter and the calculation and rounding conventions described under Sources. Your lender may calculate interest,
          round amounts or apply payments differently, and fees, taxes, insurance and prepayment charges are not included. Your loan agreement and
          lender&apos;s statements always take precedence; consider consulting a qualified professional before making financial decisions.
        </p>
      </div>

      {/* ---- Sources ---- */}
      <SourcesPanel reduced={prefersReducedMotion} />

      {/* ---- Share bar ---- */}
      {renderShareBar()}
    </div>
  );
};

export default AmortizationCalculator;
