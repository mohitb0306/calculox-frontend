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
  FiClock, FiGlobe,
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
  <div className={`relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm p-4 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-20 -left-14 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl" aria-hidden="true" />
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
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/30" aria-hidden="true">
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

// Sizes a number to fit its tile at any width (tile is a size container; cqw = 1% of inner width).
const fitNumberStyle = (text: string, maxRem: number, minRem = 0.875): React.CSSProperties => ({
  fontSize: `clamp(${minRem}rem, ${(70 / (Math.max(text.length, 1) * 0.58)).toFixed(2)}cqw, ${maxRem}rem)`,
});

// --- PREMIUM RESULT COMPONENTS (Mortgage hero, Loan Summary, Extra-payment savings, PMI timeline) ---
// All layout, spacing, colour and light/dark theming for these two sections live in the scoped stylesheet
// below (plain CSS, `.mgr-*`). That keeps them independent of which Tailwind utilities the site build happens
// to generate, and dark mode follows the site's `.dark` class exactly like selectOptionThemeCSS does.
// Responsiveness uses container queries on the cards themselves, so the layout reacts to the space the card
// really has (phone, tablet, wide column) rather than to the viewport. Motion honours prefers-reduced-motion.

const MGR_CSS = `
.mgr-hero, .mgr-sum { --mgr-ease: cubic-bezier(.22, 1, .36, 1); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.mgr-hero *, .mgr-hero *::before, .mgr-hero *::after,
.mgr-sum *, .mgr-sum *::before, .mgr-sum *::after { box-sizing: border-box; }
.mgr-sr, .mgr-sum .sr-only, .mgr-hero .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.mgr-hero svg, .mgr-sum svg { display: block; }

/* ============================ HERO ============================ */
.mgr-hero {
  position: relative; isolation: isolate; overflow: hidden; container-type: inline-size;
  border-radius: 28px; color: #fff;
  background: #065f46;
  box-shadow: 0 32px 64px -28px rgba(4,47,36,.75), 0 2px 8px rgba(4,47,36,.2);
}
.dark .mgr-hero {
  background: #054837;
  box-shadow: 0 36px 72px -32px rgba(0,0,0,.92), 0 0 0 1px rgba(255,255,255,.07);
}
/* Card-level glass edge: a bright, lit top-left rim that fades across the surface. */
.mgr-hero::after {
  content: ""; position: absolute; inset: 0; z-index: 3; border-radius: inherit; padding: 1px; pointer-events: none;
  background: rgba(255,255,255,.08);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
.mgr-hero__fx { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
/* Aurora: four blurred colour pools drifting very slowly behind the glass panels. */
.mgr-orb { position: absolute; width: clamp(240px, 50cqi, 440px); aspect-ratio: 1; border-radius: 50%; filter: blur(64px); opacity: .52; will-change: transform; animation: mgr-drift 30s ease-in-out infinite alternate; }
.dark .mgr-orb { opacity: .4; }
.mgr-orb--a { top: -18%; right: -10%; background: rgba(52,211,153,.9); }
.mgr-orb--b { bottom: -24%; left: -12%; background: rgba(56,189,248,.75); animation-duration: 36s; animation-direction: alternate-reverse; }
.mgr-orb--c { top: 32%; left: 36%; width: clamp(180px, 36cqi, 320px); background: rgba(16,185,129,.55); animation-duration: 42s; }
.mgr-orb--d { bottom: -20%; right: -8%; background: rgba(251,191,36,.6); animation-duration: 34s; animation-direction: alternate-reverse; }
@keyframes mgr-drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(6%, 8%, 0) scale(1.08); } }
.mgr-hero__sheen { position: absolute; inset: 0; background: rgba(255,255,255,.08); }
.mgr-hero__rings {
  position: absolute; inset: 0;
  background: transparent;
  -webkit-mask-image: radial-gradient(70% 90% at 100% 0%, #000 0%, transparent 70%); mask-image: radial-gradient(70% 90% at 100% 0%, #000 0%, transparent 70%);
}
/* Fine film grain gives the glass a tactile, frosted surface. */
.mgr-hero__grain { position: absolute; inset: 0; opacity: .06; mix-blend-mode: overlay; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
.mgr-hero__edge { position: absolute; left: 36px; right: 36px; top: 0; height: 1px; background: rgba(255,255,255,.65); }

.mgr-hero__in { padding: clamp(20px, 4.6cqi, 34px); display: flex; flex-direction: column; gap: clamp(18px, 3cqi, 24px); }
.mgr-hero__main { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(18px, 3.2cqi, 28px); align-items: stretch; }
@container (min-width: 680px) { .mgr-hero__main--split { grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); } }

.mgr-lead { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
@container (min-width: 680px) { .mgr-hero__main--split .mgr-lead { justify-content: center; padding-right: 8px; } }
.mgr-eyebrow { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; line-height: 1.3; }
.mgr-eyebrow__mark { width: 16px; height: 3px; border-radius: 999px; background: #f59e0b; box-shadow: 0 0 10px rgba(252,211,77,.45); flex: none; }
.mgr-eyebrow__t { white-space: nowrap; color: #fff; }
.mgr-eyebrow__sub { white-space: nowrap; font-weight: 600; color: rgba(255,255,255,.65); }
@container (min-width: 440px) { .mgr-eyebrow__sub { padding-left: 10px; border-left: 1px solid rgba(255,255,255,.22); } }

.mgr-amt-wrap { container-type: inline-size; }
.mgr-amt { display: block; width: 100%; white-space: nowrap; font-weight: 700; letter-spacing: -.035em; line-height: 1.05; background: #ffffff; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; filter: drop-shadow(0 8px 20px rgba(0,0,0,.22)); }
.mgr-amt__c { font-size: .42em; font-weight: 700; letter-spacing: -.01em; vertical-align: super; position: relative; top: -.08em; margin-left: .06em; -webkit-text-fill-color: rgba(255,255,255,.78); color: rgba(255,255,255,.78); }
.mgr-cap { margin: 10px 0 0; font-size: 13.5px; line-height: 1.45; font-weight: 500; color: rgba(255,255,255,.74); }

.mgr-panel {
  position: relative; min-width: 0; border-radius: 22px; padding: clamp(18px, 3.4cqi, 24px);
  background: rgba(255,255,255,.12);
  -webkit-backdrop-filter: blur(20px) saturate(140%); backdrop-filter: blur(20px) saturate(140%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 20px 44px -24px rgba(1,24,18,.7);
  animation: mgr-rise .65s var(--mgr-ease) both;
}
.mgr-bd { animation-delay: .1s; }
@keyframes mgr-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mgr-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.dark .mgr-panel { background: rgba(255,255,255,.09); box-shadow: inset 0 1px 0 rgba(255,255,255,.15), 0 22px 46px -26px rgba(0,0,0,.82); }
/* Gradient hairline border: bright on the lit top-left edge, fading across the glass. */
.mgr-panel::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: rgba(255,255,255,.08);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .mgr-panel { background: rgba(3,46,36,.55); }
  .dark .mgr-panel { background: rgba(0,0,0,.38); }
}
.mgr-panel__title { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; line-height: 1.3; color: rgba(255,255,255,.92); }

/* ---- First payment split card ---- */
.mgr-split { display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }
.mgr-split__body { display: flex; align-items: center; gap: 18px; }
@container (max-width: 340px) { .mgr-split__body { flex-direction: column; align-items: stretch; } }
.mgr-donut { position: relative; width: 104px; height: 104px; flex: none; margin: 0 auto; }
.mgr-donut svg { width: 100%; height: 100%; transform: rotate(-90deg); filter: drop-shadow(0 6px 14px rgba(0,0,0,.3)); }
.mgr-donut__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; }
.mgr-donut__v { font-size: 18px; font-weight: 800; letter-spacing: -.03em; line-height: 1; color: #fff; }
.mgr-donut__k { margin-top: 4px; font-size: 8.5px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; color: rgba(255,255,255,.68); }
.mgr-legend { flex: 1 1 170px; min-width: 0; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
.mgr-legend li {
  display: flex; flex-direction: column; gap: 4px; padding: 9px 12px; border-radius: 13px;
  background: rgba(0,0,0,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.06);
}
.mgr-legend__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.mgr-legend__l { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 11.5px; font-weight: 600; line-height: 1.2; color: rgba(255,255,255,.82); }
.mgr-legend__l span:last-child { white-space: nowrap; }
.mgr-legend__pct {
  display: inline-block; padding: 1.5px 6.5px; border-radius: 999px; font-style: normal;
  font-size: 10.5px; font-weight: 800; line-height: 1.3; color: rgba(255,255,255,.9);
  background: rgba(255,255,255,.11); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
}
.mgr-swatch { width: 9px; height: 9px; border-radius: 3px; flex: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 2px 6px rgba(0,0,0,.4); }
.mgr-legend__v { display: block; font-size: 14.5px; font-weight: 700; letter-spacing: -.015em; line-height: 1.2; color: #fff; white-space: nowrap; }
.mgr-note { margin: 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.12); font-size: 12px; line-height: 1.5; font-weight: 500; color: rgba(255,255,255,.72); }

.mgr-gic { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 9px; color: #fcd34d; background: rgba(255,255,255,.22); box-shadow: inset 0 1px 0 rgba(255,255,255,.32), inset 0 0 0 1px rgba(255,255,255,.12), 0 6px 14px -6px rgba(0,0,0,.45); }
.mgr-gic svg { width: 14px; height: 14px; }

/* ---- Total monthly payment (glass breakdown) ---- */
.mgr-bd { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; padding: clamp(18px, 3.6cqi, 26px); }
@container (min-width: 700px) {
  .mgr-bd { grid-template-columns: minmax(230px, .88fr) minmax(0, 1.12fr); gap: 0; align-items: center; }
  .mgr-bd__sum { padding-right: clamp(22px, 3.6cqi, 36px); }
  .mgr-bd__tbl { padding-left: clamp(22px, 3.6cqi, 36px); border-left: 1px solid rgba(255,255,255,.13); }
}
.mgr-bd__sum { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.mgr-bd__sub { margin: 6px 0 0; font-size: 12.5px; line-height: 1.4; font-weight: 500; color: rgba(255,255,255,.68); }
.mgr-bd__total { margin: 14px 0 0; display: block; white-space: nowrap; font-weight: 800; letter-spacing: -.035em; line-height: 1.04; color: #fff; }
.mgr-bd__total .mgr-amt__c { font-size: .46em; }
.mgr-stack { display: flex; gap: 3px; height: 10px; margin-top: 18px; padding: 2px; border-radius: 999px; background: rgba(0,0,0,.26); box-shadow: inset 0 1px 2px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08); }
.mgr-stack > div { height: 100%; flex-basis: 0; min-width: 5px; border-radius: 999px; transform-origin: left center; box-shadow: inset 0 1px 0 rgba(255,255,255,.45); animation: mgr-grow .85s var(--mgr-ease) .2s both; }
.mgr-bd__hint { margin: 12px 0 0; font-size: 12.5px; line-height: 1.5; font-weight: 500; color: rgba(255,255,255,.74); }
.mgr-bd__hint b { font-weight: 800; color: #fff; }

.mgr-bd__tbl { min-width: 0; }
@container (max-width: 699px) {
  .mgr-bd__tbl { padding-top: 16px; border-top: 1px solid rgba(255,255,255,.13); }
}
.mgr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mgr-table th, .mgr-table td { padding: 10px 0; text-align: right; vertical-align: middle; }
.mgr-table thead th { padding: 0 0 10px; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); border-bottom: 1px solid rgba(255,255,255,.14); }
.mgr-table tbody tr + tr > * { border-top: 1px solid rgba(255,255,255,.08); }
.mgr-table tbody tr:last-child > * { padding-bottom: 2px; }
.mgr-table .mgr-c-k { text-align: left; font-weight: 700; color: #fff; width: 100%; padding-right: 12px; }
.mgr-row__k { display: flex; align-items: center; gap: 10px; min-width: 0; line-height: 1.25; }
.mgr-row__k i { width: 10px; height: 10px; border-radius: 3.5px; flex: none; background: var(--c2); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 0 0 3px rgba(255,255,255,.06); }
.mgr-row__n { display: block; flex: 1 1 auto; min-width: 0; }
.mgr-row__label { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 700; color: rgba(255,255,255,.94); }
.mgr-row__bar { display: block; height: 3.5px; margin-top: 6px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.11); }
.mgr-row__bar b { display: block; height: 100%; min-width: 3px; border-radius: 999px; background: var(--c2); }
.mgr-pill { display: inline-block; min-width: 44px; padding: 2.5px 8.5px; border-radius: 999px; text-align: center; font-size: 11px; font-weight: 800; color: var(--c1); background: rgba(255,255,255,.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
@supports (background: color-mix(in srgb, red 10%, transparent)) {
  .mgr-pill { background: color-mix(in srgb, var(--c2) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c1) 34%, transparent); }
}
.mgr-table .mgr-c-p { padding: 8px 0 8px 10px; white-space: nowrap; }
.mgr-table thead th.mgr-c-p { padding: 0 0 10px 10px; font-size: 10px; font-weight: 800; letter-spacing: .14em; color: rgba(255,255,255,.55); }
.mgr-table .mgr-c-v { padding-left: 14px; white-space: nowrap; font-size: 13px; font-weight: 800; letter-spacing: -.01em; color: #fff; }
.mgr-table thead th.mgr-c-v { padding: 0 0 10px 14px; font-size: 10px; font-weight: 800; letter-spacing: .14em; color: rgba(255,255,255,.55); }
@container (max-width: 420px) {
  .mgr-row__k { gap: 8px; }
  .mgr-row__label { white-space: normal; }
  .mgr-table .mgr-c-p, .mgr-table thead th.mgr-c-p { padding-left: 8px; }
  .mgr-table .mgr-c-v { padding-left: 8px; font-size: 13px; }
  .mgr-table thead th.mgr-c-v { padding-left: 8px; }
  .mgr-table .mgr-c-k { padding-right: 6px; }
}
@container (max-width: 319px) { .mgr-table .mgr-c-p { display: none; } }

/* ---- Hero bottom facts strip ---- */
.mgr-facts {
  margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
}
@container (min-width: 560px) {
  .mgr-facts { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
}
.mgr-fact {
  min-width: 0; display: flex; align-items: center; gap: 11px; padding: 11px 14px; border-radius: 16px;
  background: rgba(0,0,0,.16); box-shadow: inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 0 1px rgba(255,255,255,.07);
}
.mgr-fact__ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; color: var(--c1); background: rgba(255,255,255,.09); box-shadow: inset 0 1px 0 rgba(255,255,255,.24), inset 0 0 0 1px rgba(255,255,255,.12); }
@supports (background: color-mix(in srgb, red 10%, transparent)) { .mgr-fact__ic { background: color-mix(in srgb, var(--c2) 24%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.24), inset 0 0 0 1px color-mix(in srgb, var(--c1) 34%, transparent); } }
.mgr-fact__ic svg { width: 14px; height: 14px; }
.mgr-fact__body { min-width: 0; flex: 1 1 auto; }
.mgr-fact dt { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: rgba(255,255,255,.62); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgr-fact dd { margin: 3px 0 0; font-size: 15px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: #fff; overflow-wrap: anywhere; }

/* ======================== LOAN SUMMARY ======================== */
.mgr-sum {
  position: relative; isolation: isolate; overflow: hidden; container-type: inline-size;
  border-radius: 28px; color: #171717;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 4px 12px rgba(15,23,42,.04), 0 28px 56px -30px rgba(15,118,110,.28);
}
.dark .mgr-sum {
  color: #fafafa;
  background: #171b24;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 28px 56px -28px rgba(0,0,0,.78);
}
.mgr-sum__glow { position: absolute; z-index: -1; pointer-events: none; top: -110px; right: -90px; width: 320px; height: 320px; border-radius: 50%; background: rgba(16,185,129,.13); }
.mgr-sum__glow--b { top: auto; right: auto; bottom: -120px; left: -90px; background: rgba(14,165,233,.09); }
.dark .mgr-sum__glow { opacity: .65; }
.mgr-sum__in { padding: clamp(18px, 4.2cqi, 28px); }

.mgr-sum__head { display: flex; align-items: center; gap: 12px; }
.mgr-badge { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 12px; color: #fff; background: #059669; box-shadow: inset 0 1px 0 rgba(255,255,255,.38), 0 8px 18px -6px rgba(16,185,129,.55); }
.mgr-badge svg { width: 18px; height: 18px; }
.mgr-sum__title { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.015em; line-height: 1.25; color: #0a0a0a; }
.dark .mgr-sum__title { color: #fff; }
.mgr-sum__sub { margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; font-weight: 500; color: #64748b; }
.dark .mgr-sum__sub { color: #9ca3af; }

.mgr-tiles { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(12px, 2.2cqi, 16px); margin-top: clamp(16px, 3.2cqi, 22px); }
@container (min-width: 460px) { .mgr-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 1020px) { .mgr-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mgr-tilewrap { min-width: 0; }

.mgr-tile {
  --t: #10b981; --t2: #059669; --tx: #047857; --glow: rgba(16,185,129,.09); --ring: rgba(16,185,129,.38); --lift: rgba(16,185,129,.25);
  position: relative; overflow: hidden; min-width: 0; height: 100%; display: flex; flex-direction: column; container-type: inline-size;
  padding: 18px; border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
  transition: transform .25s var(--mgr-ease), box-shadow .25s var(--mgr-ease);
}
.dark .mgr-tile {
  background: rgba(255,255,255,.05);
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 10px 24px -14px rgba(0,0,0,.5);
}
.mgr-tile::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: var(--glow); }
.mgr-tile::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--t2); opacity: .85; }
@media (hover: hover) {
  .mgr-tile:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px var(--ring), 0 14px 28px -16px var(--lift); }
}
.mgr-tile--emerald { --t: #10b981; --t2: #059669; --tx: #047857; --glow: rgba(16,185,129,.1); --ring: rgba(16,185,129,.4); --lift: rgba(16,185,129,.3); }
.mgr-tile--rose    { --t: #fb7185; --t2: #e11d48; --tx: #be123c; --glow: rgba(244,63,94,.09);  --ring: rgba(244,63,94,.38);  --lift: rgba(244,63,94,.28); }
.mgr-tile--sky     { --t: #38bdf8; --t2: #0284c7; --tx: #0369a1; --glow: rgba(14,165,233,.1);  --ring: rgba(14,165,233,.4);  --lift: rgba(14,165,233,.28); }
.mgr-tile--amber   { --t: #fbbf24; --t2: #d97706; --tx: #b45309; --glow: rgba(245,158,11,.1);  --ring: rgba(245,158,11,.42); --lift: rgba(245,158,11,.28); }
.dark .mgr-tile--emerald { --tx: #6ee7b7; --glow: rgba(16,185,129,.12); }
.dark .mgr-tile--rose    { --tx: #fda4af; --glow: rgba(244,63,94,.11); }
.dark .mgr-tile--sky     { --tx: #7dd3fc; --glow: rgba(14,165,233,.12); }
.dark .mgr-tile--amber   { --tx: #fcd34d; --glow: rgba(245,158,11,.12); }

.mgr-tile__head { position: relative; display: flex; align-items: center; gap: 10px; }
.mgr-ic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; color: #fff; background: var(--t2); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 14px -6px var(--t2); }
.mgr-ic svg { width: 15px; height: 15px; }
.mgr-tile__label { min-width: 0; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: #64748b; }
.dark .mgr-tile__label { color: #a1a1aa; }
.mgr-tile__value { position: relative; display: block; width: 100%; margin-top: 14px; white-space: nowrap; font-weight: 700; letter-spacing: -.025em; line-height: 1.1; color: #0b1220; }
.dark .mgr-tile__value { color: #fff; }
.mgr-tile__sub { position: relative; margin-top: 6px; min-height: 1.35em; font-size: 12.5px; line-height: 1.35; font-weight: 600; color: #64748b; }
.dark .mgr-tile__sub { color: #a1a1aa; }
.mgr-tile__sub b { font-weight: 800; color: var(--tx); }
.mgr-tile__foot { position: relative; margin-top: auto; padding-top: 14px; }
.mgr-meter { display: flex; gap: 2.5px; height: 6px; overflow: hidden; border-radius: 999px; background: rgba(15,23,42,.07); }
.dark .mgr-meter { background: rgba(255,255,255,.09); }
.mgr-meter > i { display: block; height: 100%; border-radius: 999px; background: var(--t2); }
.mgr-mkey { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 11px; font-weight: 700; color: #64748b; }
.dark .mgr-mkey { color: #a1a1aa; }
.mgr-mkey span { display: inline-flex; align-items: center; gap: 5px; }
.mgr-mkey i { width: 7px; height: 7px; border-radius: 2.5px; }

.mgr-tl { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #64748b; }
.dark .mgr-tl { color: #a1a1aa; }
.mgr-tl__date { white-space: nowrap; }
.mgr-tl__track { position: relative; flex: 1 1 auto; min-width: 24px; height: 4px; margin: 0 3px; border-radius: 999px; background: var(--t2); }
.mgr-tl__track::before, .mgr-tl__track::after {
  content: ""; position: absolute; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 50%;
  background: var(--t); box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--t2);
}
.dark .mgr-tl__track::before, .dark .mgr-tl__track::after { box-shadow: 0 0 0 2px #171b24, 0 0 0 3.5px var(--t); }
.mgr-tl__track::before { left: -2px; }
.mgr-tl__track::after { right: -2px; background: var(--t2); }

.mgr-insights { display: grid; gap: 8px; margin-top: clamp(14px, 2.8cqi, 18px); }
.mgr-insight {
  display: flex; align-items: center; gap: 11px; padding: 11px 14px; border-radius: 14px;
  font-size: 13px; line-height: 1.5; font-weight: 500; color: #334155;
  background: rgba(16,185,129,.08);
  box-shadow: inset 0 0 0 1px rgba(16,185,129,.18);
}
.dark .mgr-insight {
  color: #d4d4d8;
  background: rgba(16,185,129,.11);
  box-shadow: inset 0 0 0 1px rgba(52,211,153,.18);
}
.mgr-insight__ic {
  width: 26px; height: 26px; flex: none; display: grid; place-items: center; border-radius: 8px;
  background: rgba(16,185,129,.14); color: #059669;
}
.dark .mgr-insight__ic { background: rgba(52,211,153,.15); color: #6ee7b7; }
.mgr-insight__ic svg { width: 14px; height: 14px; }
.mgr-insight b { font-weight: 800; color: #0f172a; }
.dark .mgr-insight b { color: #fff; }
/* ======================= EXTRA PAYMENT SAVINGS (dark "before vs after" card) ======================= */
.mgr-sv, .mgr-pm { --mgr-ease: cubic-bezier(.22, 1, .36, 1); position: relative; isolation: isolate; overflow: hidden; container-type: inline-size; border-radius: 28px; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.mgr-sv *, .mgr-sv *::before, .mgr-sv *::after, .mgr-pm *, .mgr-pm *::before, .mgr-pm *::after { box-sizing: border-box; }
.mgr-sv svg, .mgr-pm svg { display: block; }
.mgr-sv .sr-only, .mgr-pm .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* Same card language as Loan Summary / Where Your Money Goes (the section itself also carries .mgr-sum). */
.mgr-sv__badge { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 12px; color: #422006; background: #fbbf24; box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 8px 18px -6px rgba(245,158,11,.55); }
.mgr-sv__badge svg { width: 18px; height: 18px; }
.mgr-pm__title button { color: rgba(255,255,255,.7); }
.mgr-pm__title button:hover, .dark .mgr-pm__title button:hover { color: #fff; }

.mgr-sv__main { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(12px, 2.2cqi, 16px); margin-top: clamp(16px, 3.2cqi, 22px); }
@container (min-width: 720px) { .mgr-sv__main--split { grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr); } }

.mgr-sv__lead, .mgr-sv__cmp, .mgr-sv__fact {
  position: relative; min-width: 0; border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
}
.dark .mgr-sv__lead, .dark .mgr-sv__cmp, .dark .mgr-sv__fact {
  background: rgba(255,255,255,.05);
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 10px 24px -14px rgba(0,0,0,.5);
}
.mgr-sv__lead, .mgr-sv__cmp { overflow: hidden; padding: clamp(18px, 3.4cqi, 24px); }
.mgr-sv__lead::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(16,185,129,.12); }
.mgr-sv__lead::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #fbbf24; opacity: .9; }
.mgr-sv__lead > *, .mgr-sv__cmp > * { position: relative; }

.mgr-sv__lead { display: flex; flex-direction: column; gap: 14px; }
.mgr-sv__eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; line-height: 1.3; color: #475569; }
.dark .mgr-sv__eyebrow { color: #d4d4d8; }
.mgr-sv__eyebrow i { width: 16px; height: 3px; border-radius: 999px; background: #f59e0b; flex: none; }
.mgr-sv__amtwrap { container-type: inline-size; }
.mgr-sv__amt { display: block; width: 100%; white-space: nowrap; font-weight: 700; letter-spacing: -.035em; line-height: 1.08; background: #047857; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.dark .mgr-sv__amt { background-image: #ecfdf5; }

.mgr-sv__chip { margin: 0; display: flex; align-items: center; gap: 10px; align-self: stretch; padding: 7px 14px 7px 7px; border-radius: 16px; font-size: 12.5px; line-height: 1.4; font-weight: 600; color: #065f46; background: rgba(16,185,129,.1); box-shadow: inset 0 0 0 1px rgba(16,185,129,.2); }
.dark .mgr-sv__chip { color: #d1fae5; background: rgba(16,185,129,.14); box-shadow: inset 0 0 0 1px rgba(52,211,153,.22); }
.mgr-sv__chip b { flex: none; padding: 2px 9px; border-radius: 999px; font-weight: 800; color: #fff; background: #059669; box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }

.mgr-sv__duo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: auto; padding-top: 4px; }
.mgr-sv__row { container-type: inline-size; }
.mgr-sv__row { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 12px 14px; border-radius: 16px; background: rgba(15,23,42,.035); box-shadow: inset 0 0 0 1px rgba(15,23,42,.06); }
.dark .mgr-sv__row { background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
.mgr-sv__fic { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 10px; color: #b45309; background: rgba(245,158,11,.14); box-shadow: inset 0 0 0 1px rgba(245,158,11,.28); }
.dark .mgr-sv__fic { color: #fcd34d; background: rgba(251,191,36,.12); box-shadow: inset 0 0 0 1px rgba(251,191,36,.26); }
.mgr-sv__fic svg { width: 14px; height: 14px; }
.mgr-sv__rk { flex: 1 1 128px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mgr-sv__rs { font-size: 11.5px; line-height: 1.3; font-weight: 600; color: #64748b; }
.dark .mgr-sv__rs { color: #a1a1aa; }
.mgr-sv__rv { flex: 0 1 auto; margin-left: auto; max-width: 100%; text-align: right; white-space: nowrap; font-size: 15px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; color: #0f172a; }
.dark .mgr-sv__rv { color: #fff; }
@container (max-width: 270px) { .mgr-sv__rv { flex-basis: 100%; margin-left: 44px; text-align: left; } }
.mgr-sv__k { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: #64748b; }
.dark .mgr-sv__k { color: #a1a1aa; }
.mgr-sv__v { display: block; margin-top: 4px; font-size: 16px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; color: #0f172a; overflow-wrap: anywhere; }
.dark .mgr-sv__v { color: #fff; }

.mgr-sv__cmp { display: flex; flex-direction: column; gap: 18px; }
.mgr-sv__grp { display: flex; flex-direction: column; gap: 14px; }
.mgr-sv__grp + .mgr-sv__grp { padding-top: 18px; border-top: 1px solid rgba(15,23,42,.08); }
.dark .mgr-sv__grp + .mgr-sv__grp { border-top-color: rgba(255,255,255,.09); }
.mgr-sv__bar { min-width: 0; }
.mgr-sv__barhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; }
.mgr-sv__barlabel { font-size: 12.5px; font-weight: 600; color: #475569; }
.dark .mgr-sv__barlabel { color: #d4d4d8; }
.mgr-sv__cut { display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 800; letter-spacing: 0; line-height: 1.4; color: #047857; background: rgba(16,185,129,.12); box-shadow: inset 0 0 0 1px rgba(16,185,129,.26); }
.dark .mgr-sv__cut { color: #6ee7b7; background: rgba(16,185,129,.16); box-shadow: inset 0 0 0 1px rgba(52,211,153,.3); }
.mgr-sv__barvalue { font-size: 14.5px; font-weight: 800; letter-spacing: -.01em; color: #0f172a; white-space: nowrap; }
.dark .mgr-sv__barvalue { color: #fff; }
.mgr-sv__barvalue em { margin-left: 7px; font-style: normal; font-size: 11px; font-weight: 600; letter-spacing: 0; color: #64748b; }
.dark .mgr-sv__barvalue em { color: #a1a1aa; }
.mgr-sv__track { height: 8px; margin-top: 8px; border-radius: 999px; overflow: hidden; background: rgba(15,23,42,.07); }
.dark .mgr-sv__track { background: rgba(255,255,255,.09); }
.mgr-sv__track > i { display: block; height: 100%; border-radius: 999px; }
.mgr-sv__bar--base .mgr-sv__track > i { background: #64748b; }
.dark .mgr-sv__bar--base .mgr-sv__track > i { background: #94a3b8; }
.mgr-sv__bar--with .mgr-sv__track > i { background: #10b981; }
.mgr-sv__bar--with .mgr-sv__barvalue { color: #047857; }
.dark .mgr-sv__bar--with .mgr-sv__barvalue { color: #6ee7b7; }

.mgr-sv__facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: clamp(12px, 2.2cqi, 16px); margin-top: clamp(12px, 2.2cqi, 16px); }
.mgr-sv__fact { min-width: 0; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; }
.mgr-sv__fact > span:last-child { min-width: 0; }
.mgr-sv__fact .mgr-sv__v { font-size: 15px; }
.mgr-sv .mgr-insights { margin-top: clamp(12px, 2.2cqi, 16px); }

/* ======================= WHEN PMI ENDS (violet header band + milestone timeline) ======================= */
.mgr-pm { color: #171717; background: #ffffff; box-shadow: 0 0 0 1px rgba(23,23,23,.08), 0 4px 12px rgba(15,23,42,.04), 0 24px 48px -28px rgba(109,40,217,.3); }
.dark .mgr-pm { color: #fafafa; background: #201d2e; box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 28px 56px -28px rgba(0,0,0,.8); }
.mgr-pm__top { position: relative; isolation: isolate; overflow: hidden; padding: clamp(18px, 4.2cqi, 28px); color: #fff; background: #5b21b6; box-shadow: inset 0 -1px 0 rgba(255,255,255,.12); }
.dark .mgr-pm__top { background: #43188a; }
.mgr-pm__top::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: rgba(196,181,253,.38); }
.mgr-pm__top::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: transparent; -webkit-mask-image: radial-gradient(70% 120% at 100% 0%, #000 0%, transparent 70%); mask-image: radial-gradient(70% 120% at 100% 0%, #000 0%, transparent 70%); }
.mgr-pm__head { display: flex; align-items: center; gap: 12px; }
.mgr-pm__badge { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 12px; color: #fff; background: rgba(255,255,255,.16); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), inset 0 0 0 1px rgba(255,255,255,.18), 0 8px 18px -8px rgba(0,0,0,.5); }
.mgr-pm__badge svg { width: 18px; height: 18px; }
.mgr-pm__title { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.015em; line-height: 1.25; color: #fff; }
.mgr-pm__sub { margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; font-weight: 500; color: rgba(255,255,255,.74); }
.mgr-pm__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: clamp(16px, 3cqi, 22px); }
.mgr-pm__kpi { container-type: inline-size; min-width: 0; padding: 13px 15px; border-radius: 16px; background: rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 0 0 1px rgba(255,255,255,.1); }
.mgr-pm__kpi--main { background: rgba(255,255,255,.2); box-shadow: inset 0 1px 0 rgba(255,255,255,.32), inset 0 0 0 1px rgba(255,255,255,.18); }
.mgr-pm__k { display: block; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: rgba(255,255,255,.72); }
.mgr-pm__v { display: block; width: 100%; margin-top: 7px; white-space: nowrap; font-weight: 700; letter-spacing: -.025em; line-height: 1.1; color: #fff; }
.mgr-pm__s { display: block; margin-top: 4px; min-height: 1.35em; font-size: 12px; line-height: 1.35; font-weight: 600; color: rgba(255,255,255,.7); }

.mgr-pm__body { padding: clamp(18px, 4.2cqi, 28px); }
.mgr-pm__sech { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 14px; }
.mgr-pm__eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #6d28d9; }
.dark .mgr-pm__eyebrow { color: #c4b5fd; }
.mgr-pm__cap { font-size: 12.5px; font-weight: 500; color: #64748b; }
.dark .mgr-pm__cap { color: #9ca3af; }
.mgr-pm__track { position: relative; height: 12px; margin-top: 14px; border-radius: 999px; background: rgba(109,40,217,.1); box-shadow: inset 0 1px 2px rgba(15,23,42,.08); }
.dark .mgr-pm__track { background: rgba(255,255,255,.09); box-shadow: inset 0 1px 2px rgba(0,0,0,.4); }
.mgr-pm__fill { position: absolute; top: 0; bottom: 0; left: 0; min-width: 12px; border-radius: 999px; background: #7c3aed; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px -4px rgba(124,58,237,.6); }
.mgr-pm__tick { position: absolute; top: -5px; bottom: -5px; width: 2px; margin-left: -1px; border-radius: 2px; background: #334155; box-shadow: 0 0 0 1.5px #fff; }
.dark .mgr-pm__tick { background: #e4e4e7; box-shadow: 0 0 0 1.5px #18161f; }
.mgr-pm__marks { position: relative; height: 22px; margin-top: 7px; }
.mgr-pm__m80 { position: absolute; top: 0; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; transform: translateX(-50%); font-size: 11px; font-weight: 800; line-height: 1.4; color: #6d28d9; }
.dark .mgr-pm__m80 { color: #c4b5fd; }
.mgr-pm__m80::before { content: "▲"; font-size: 8px; }
.mgr-pm__m80--start { transform: translateX(-6px); }
.mgr-pm__m80--end { transform: translateX(calc(-100% + 6px)); }
.mgr-pm__ends { display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; }
.dark .mgr-pm__ends { color: #71717a; }

.mgr-pm__steps { list-style: none; margin: clamp(18px, 3.4cqi, 24px) 0 0; padding: 0; }
.mgr-pm__step { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; padding: 13px 0 13px 36px; }
.mgr-pm__step::before { content: ""; position: absolute; left: 9px; top: 0; bottom: 0; width: 2px; background: rgba(109,40,217,.2); }
.dark .mgr-pm__step::before { background: rgba(167,139,250,.28); }
.mgr-pm__step:first-child::before { top: 50%; }
.mgr-pm__step:last-child::before { bottom: 50%; }
.mgr-pm__step:only-child::before { display: none; }
.mgr-pm__node { position: absolute; left: 0; top: 50%; width: 20px; height: 20px; margin-top: -10px; display: grid; place-items: center; border-radius: 50%; color: #fff; background: #fff; box-shadow: inset 0 0 0 2px #c4b5fd; }
.dark .mgr-pm__node { background: #18161f; box-shadow: inset 0 0 0 2px #7c3aed; }
.mgr-pm__node::after { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6; }
.mgr-pm__node svg { width: 11px; height: 11px; }
.mgr-pm__step--end .mgr-pm__node { background: #6d28d9; box-shadow: 0 0 0 4px rgba(139,92,246,.22), 0 6px 14px -4px rgba(109,40,217,.65); }
.mgr-pm__step--end .mgr-pm__node::after { display: none; }
.mgr-pm__sk { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13.5px; font-weight: 600; line-height: 1.35; color: #475569; }
.dark .mgr-pm__sk { color: #a1a1aa; }
.mgr-pm__sv { margin-left: auto; text-align: right; white-space: nowrap; font-size: 14px; font-weight: 800; letter-spacing: -.01em; color: #0f172a; }
.dark .mgr-pm__sv { color: #fff; }
.mgr-pm__step--end .mgr-pm__sk { font-weight: 800; color: #5b21b6; }
.dark .mgr-pm__step--end .mgr-pm__sk { color: #ddd6fe; }
.mgr-pm__step--end .mgr-pm__sv { color: #6d28d9; font-size: 15px; }
.dark .mgr-pm__step--end .mgr-pm__sv { color: #c4b5fd; }
.mgr-pm__fine { display: flex; align-items: flex-start; gap: 8px; margin: clamp(14px, 2.8cqi, 18px) 0 0; padding-top: 14px; border-top: 1px solid rgba(15,23,42,.08); font-size: 12px; line-height: 1.5; font-weight: 500; color: #64748b; }
.dark .mgr-pm__fine { border-top-color: rgba(255,255,255,.08); color: #9ca3af; }
.mgr-pm__fine svg { width: 14px; height: 14px; flex: none; margin-top: 2px; }
.mgr-pm__body .mgr-insights { margin-top: 0; }

.mgr-warn { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; font-size: 12px; font-weight: 600; line-height: 1.45; color: #b45309; }
.dark .mgr-warn { color: #fbbf24; }
.mgr-warn svg { width: 14px; height: 14px; flex: none; margin-top: 2px; }


/* ======================= WHERE YOUR MONEY GOES (donut panel + interactive rows) ======================= */
.mgr-wg__body { margin-top: clamp(16px, 3.2cqi, 22px); }
.mgr-wg__main { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(14px, 2.6cqi, 20px); align-items: stretch; }
@container (min-width: 640px) { .mgr-wg__main { grid-template-columns: minmax(250px, 310px) minmax(0, 1fr); } }
.mgr-wg__panel {
  position: relative; min-width: 0; display: grid; place-items: center; padding: clamp(16px, 3.4cqi, 24px); border-radius: 22px; overflow: hidden;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
}
.dark .mgr-wg__panel { background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 10px 24px -14px rgba(0,0,0,.5); }
.mgr-wg__panel::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(16,185,129,.1); }
.mgr-wg__ring { position: relative; container-type: inline-size; width: 100%; max-width: 262px; aspect-ratio: 1; }
.mgr-wg__ring svg { width: 100%; height: 100%; overflow: visible; }
.mgr-wg__track { stroke: rgba(15,23,42,.07); }
.dark .mgr-wg__track { stroke: rgba(255,255,255,.08); }
.mgr-wg__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0 23%; text-align: center; pointer-events: none; }
.mgr-wg__ck { max-width: 100%; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; line-height: 1.25; color: #64748b; overflow-wrap: anywhere; }
.dark .mgr-wg__ck { color: #a1a1aa; }
.mgr-wg__cv { max-width: 100%; white-space: nowrap; font-size: clamp(1rem, 10cqw, 1.5rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; color: #0f172a; }
.dark .mgr-wg__cv { color: #fff; }
.mgr-wg__cs { max-width: 100%; min-height: 1.3em; white-space: nowrap; font-size: 12px; font-weight: 700; line-height: 1.3; color: #64748b; }
.dark .mgr-wg__cs { color: #a1a1aa; }

.mgr-wg__list { list-style: none; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.mgr-wg__row {
  --c: #10b981;
  appearance: none; width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 0; border-radius: 16px; text-align: left; font: inherit; color: inherit; cursor: pointer;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
  transition: opacity .2s ease, box-shadow .2s ease, transform .2s var(--mgr-ease);
}
.dark .mgr-wg__row { background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.04); }
.mgr-wg__row[data-dim="true"] { opacity: .5; }
.mgr-wg__row[data-on="true"] { box-shadow: 0 0 0 1.5px var(--c), 0 12px 24px -16px var(--c); }
@media (hover: hover) { .mgr-wg__row:hover { transform: translateY(-1px); } }
.mgr-wg__row:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
.mgr-wg__dot { width: 12px; height: 12px; flex: none; border-radius: 4px; background: var(--c); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 2px 6px -1px var(--c); }
.mgr-wg__rn { flex: 1 1 auto; min-width: 0; }
.mgr-wg__rl { display: block; font-size: 13px; font-weight: 700; line-height: 1.3; color: #0f172a; overflow-wrap: anywhere; }
.dark .mgr-wg__rl { color: #fff; }
.mgr-wg__rbar { display: block; height: 4px; margin-top: 7px; border-radius: 999px; overflow: hidden; background: rgba(15,23,42,.07); }
.dark .mgr-wg__rbar { background: rgba(255,255,255,.09); }
.mgr-wg__rbar i { display: block; height: 100%; min-width: 3px; border-radius: 999px; background: var(--c); transform-origin: left center; animation: mgr-grow .8s var(--mgr-ease) .25s both; }
.mgr-wg__rv { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
.mgr-wg__rv b { white-space: nowrap; font-size: 13.5px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; color: #0f172a; }
.dark .mgr-wg__rv b { color: #fff; }
.mgr-wg__rv em { font-style: normal; font-size: 11.5px; font-weight: 700; line-height: 1.2; color: #64748b; }
.dark .mgr-wg__rv em { color: #a1a1aa; }
@container (max-width: 380px) {
  .mgr-wg__row { gap: 10px; padding: 10px 12px; }
  .mgr-wg__rv b { font-size: 13.5px; }
}
.mgr-wg .mgr-insights { margin-top: clamp(14px, 2.8cqi, 18px); }


/* ======================= BALANCE OVER TIME (readout tiles + chart panel) ======================= */
.mgr-bc__body { margin-top: clamp(16px, 3.2cqi, 22px); }
.mgr-bc__panel {
  position: relative; min-width: 0; overflow: hidden; display: flex; flex-direction: column; gap: 14px; padding: clamp(14px, 3cqi, 22px); border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
}
.dark .mgr-bc__panel { background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05), 0 10px 24px -14px rgba(0,0,0,.5); }
.mgr-bc__panel::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(16,185,129,.09); }
.mgr-bc__panel > * { position: relative; }
.mgr-bc__read { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
@container (max-width: 470px) { .mgr-bc__read { grid-template-columns: repeat(2, minmax(0, 1fr)); } .mgr-bc__rd--when { grid-column: 1 / -1; } }
.mgr-bc__rd { position: relative; overflow: hidden; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px 14px; border-radius: 16px; background: rgba(15,23,42,.035); box-shadow: inset 0 0 0 1px rgba(15,23,42,.06); }
.dark .mgr-bc__rd { background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
.mgr-bc__rk { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: #64748b; }
.dark .mgr-bc__rk { color: #a1a1aa; }
.mgr-bc__rk i { width: 7px; height: 7px; flex: none; border-radius: 2.5px; }
.mgr-bc__rd--bal .mgr-bc__rk { color: #047857; }
.mgr-bc__rd--bal .mgr-bc__rk i { background: #10b981; }
.mgr-bc__rd--int .mgr-bc__rk { color: #be123c; }
.mgr-bc__rd--int .mgr-bc__rk i { background: #f43f5e; }
.dark .mgr-bc__rd--bal .mgr-bc__rk { color: #6ee7b7; }
.dark .mgr-bc__rd--int .mgr-bc__rk { color: #fda4af; }
.mgr-bc__rv { font-size: 15px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; color: #0f172a; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.dark .mgr-bc__rv { color: #fff; }
.mgr-bc__rs { font-size: 11.5px; font-weight: 600; line-height: 1.3; color: #64748b; }
.dark .mgr-bc__rs { color: #a1a1aa; }
.mgr-bc__rm { display: block; height: 4px; margin-top: 4px; border-radius: 999px; overflow: hidden; background: rgba(15,23,42,.07); }
.dark .mgr-bc__rm { background: rgba(255,255,255,.09); }
.mgr-bc__rm b { display: block; height: 100%; min-width: 3px; border-radius: 999px; transition: width .35s var(--mgr-ease); }
.mgr-bc__rd--bal .mgr-bc__rm b { background: #059669; }
.mgr-bc__rd--int .mgr-bc__rm b { background: #e11d48; }
.mgr-bc__rd--when::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #f43f5e; opacity: .75; }

.mgr-bc__chart { width: 100%; border-radius: 14px; outline: none; }
.mgr-bc__chart:focus-visible { outline: 2px solid rgba(16,185,129,.6); outline-offset: 2px; }
.mgr-bc__grid { stroke: rgba(15,23,42,.09); }
.dark .mgr-bc__grid { stroke: rgba(255,255,255,.1); }
.mgr-bc__tick { fill: #64748b; font-variant-numeric: tabular-nums; }
.dark .mgr-bc__tick { fill: #a1a1aa; }
.mgr-bc__cursor { stroke: rgba(100,116,139,.5); stroke-dasharray: 3 3; }
.mgr-bc__dot { stroke: #ffffff; }
.dark .mgr-bc__dot { stroke: #171b24; }
.mgr-bc__line { stroke-dasharray: 1; animation: mgr-draw 1.1s var(--mgr-ease) .1s both; }
.mgr-bc__area { animation: mgr-fade .9s ease .35s both; }
.mgr-bc__ends { animation: mgr-fade .5s ease .9s both; }
@keyframes mgr-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes mgr-fade { from { opacity: 0; } to { opacity: 1; } }
.mgr-bc__key { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; font-weight: 700; color: #475569; }
.dark .mgr-bc__key { color: #d4d4d8; }
.mgr-bc__key span { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px 4px 9px; border-radius: 999px; background: rgba(15,23,42,.04); box-shadow: inset 0 0 0 1px rgba(15,23,42,.06); }
.dark .mgr-bc__key span { background: rgba(255,255,255,.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
.mgr-bc__key i { width: 14px; height: 4px; border-radius: 999px; }
.mgr-bc .mgr-insights { margin-top: clamp(14px, 2.8cqi, 18px); }

@media (prefers-reduced-motion: reduce) {
  .mgr-orb, .mgr-panel, .mgr-stack > div, .mgr-wg__rbar i, .mgr-bc__line, .mgr-bc__area, .mgr-bc__ends { animation: none !important; }
  .mgr-tile, .mgr-wg__row { transition: none; }
  .mgr-tile:hover, .mgr-wg__row:hover { transform: none; }
}

/* ======================= EMPTY STATE (.mgr-empty) ======================= */
.mgr-empty { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; padding: clamp(36px, 8vw, 56px) clamp(20px, 5vw, 32px); border-radius: 28px; border: 1.5px dashed rgba(100,116,139,.35); background: rgba(248,250,252,.7); }
.dark .mgr-empty { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.02); }
.mgr-empty__icon { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; color: #047857; background: rgba(16,185,129,.1); box-shadow: inset 0 0 0 1px rgba(16,185,129,.22); }
.dark .mgr-empty__icon { color: #6ee7b7; background: rgba(52,211,153,.12); box-shadow: inset 0 0 0 1px rgba(52,211,153,.26); }
.mgr-empty__title { margin: 18px 0 0; font-size: 18px; font-weight: 800; letter-spacing: -.02em; color: #334155; }
.dark .mgr-empty__title { color: #e2e8f0; }
.mgr-empty__text { margin: 8px 0 0; max-width: 24rem; font-size: 14px; line-height: 1.6; font-weight: 500; color: #526074; }
.dark .mgr-empty__text { color: #a1a1aa; }

/* ======================= COMPARE WAYS TO PAY OFF FASTER (.mgr-cp) ======================= */
.mgr-cp__body { margin-top: clamp(16px, 3.2cqi, 22px); }

/* Context hint + used-params row */
.mgr-cp__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mgr-cp__hint { font-size: 12.5px; line-height: 1.5; font-weight: 500; color: #64748b; }
.dark .mgr-cp__hint { color: #9ca3af; }
.mgr-cp__param { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #4338ca; background: rgba(99,102,241,.09); box-shadow: inset 0 0 0 1px rgba(99,102,241,.2); }
.dark .mgr-cp__param { color: #a5b4fc; background: rgba(99,102,241,.12); box-shadow: inset 0 0 0 1px rgba(99,102,241,.28); }
.mgr-cp__param svg { width: 10px; height: 10px; flex: none; }

/* Card list */
.mgr-cp__list { list-style: none; margin: clamp(14px, 2.8cqi, 20px) 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }

/* Each strategy card */
.mgr-cp__card {
  --cp-accent: #94a3b8;
  --cp-accent-rgb: 148,163,184;
  --cp-accent-dark: #64748b;
  position: relative; overflow: hidden; min-width: 0; border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 4px 12px rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.04);
  transition: transform .2s var(--mgr-ease), box-shadow .2s var(--mgr-ease);
}
.dark .mgr-cp__card {
  background: rgba(255,255,255,.055);
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px -16px rgba(0,0,0,.55);
}
@media (hover: hover) { .mgr-cp__card:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px rgba(var(--cp-accent-rgb),.28), 0 12px 28px -16px rgba(var(--cp-accent-rgb),.2), 0 4px 8px rgba(15,23,42,.04); } }
.dark .mgr-cp__card:hover { box-shadow: 0 0 0 1px rgba(var(--cp-accent-rgb),.32), inset 0 1px 0 rgba(255,255,255,.06), 0 16px 36px -20px rgba(0,0,0,.7); }
/* Best pick keeps its green ring on hover (the generic hover rule above would otherwise replace it). */
@media (hover: hover) { .mgr-cp__card--best:hover { box-shadow: 0 0 0 2px #10b981, 0 20px 40px -20px rgba(16,185,129,.42), 0 4px 10px rgba(15,23,42,.04); } }
@media (hover: hover) { .dark .mgr-cp__card--best:hover { box-shadow: 0 0 0 2px rgba(52,211,153,.7), inset 0 1px 0 rgba(255,255,255,.07), 0 22px 44px -22px rgba(0,0,0,.75); } }
/* Text-safe accent per strategy (AA on the tinted cells in light and dark). */
.mgr-cp__card { --cp-text: #475569; }
.dark .mgr-cp__card { --cp-text: #cbd5e1; }
.mgr-cp__card[data-id="extra-monthly"] { --cp-text: #047857; }
.mgr-cp__card[data-id="biweekly-half"] { --cp-text: #4338ca; }
.mgr-cp__card[data-id="biweekly-true"] { --cp-text: #6d28d9; }
.mgr-cp__card[data-id="shorter-term"]  { --cp-text: #b45309; }
.mgr-cp__card[data-id="recast"]        { --cp-text: #0369a1; }
.dark .mgr-cp__card[data-id="extra-monthly"] { --cp-text: #6ee7b7; }
.dark .mgr-cp__card[data-id="biweekly-half"] { --cp-text: #a5b4fc; }
.dark .mgr-cp__card[data-id="biweekly-true"] { --cp-text: #c4b5fd; }
.dark .mgr-cp__card[data-id="shorter-term"]  { --cp-text: #fcd34d; }
.dark .mgr-cp__card[data-id="recast"]        { --cp-text: #7dd3fc; }

/* Accent colour per strategy — set on each card via inline style */
.mgr-cp__card[data-id="standard"]         { --cp-accent: #94a3b8; --cp-accent-rgb: 148,163,184; --cp-accent-dark: #64748b; }
.mgr-cp__card[data-id="extra-monthly"]     { --cp-accent: #10b981; --cp-accent-rgb: 16,185,129;  --cp-accent-dark: #047857; }
.mgr-cp__card[data-id="biweekly-half"]     { --cp-accent: #6366f1; --cp-accent-rgb: 99,102,241;  --cp-accent-dark: #4f46e5; }
.mgr-cp__card[data-id="biweekly-true"]     { --cp-accent: #8b5cf6; --cp-accent-rgb: 139,92,246;  --cp-accent-dark: #7c3aed; }
.mgr-cp__card[data-id="shorter-term"]      { --cp-accent: #f59e0b; --cp-accent-rgb: 245,158,11;  --cp-accent-dark: #b45309; }
.mgr-cp__card[data-id="recast"]            { --cp-accent: #0ea5e9; --cp-accent-rgb: 14,165,233;  --cp-accent-dark: #0369a1; }

/* Top accent bar — 3px line across the full width */
.mgr-cp__accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--cp-accent-dark); opacity: .75; border-radius: 22px 22px 0 0; }
.dark .mgr-cp__accent-bar { opacity: .9; }

/* Ambient glow in the top-left corner, tinted to the accent */
.mgr-cp__card::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(var(--cp-accent-rgb),.07); }
.dark .mgr-cp__card::before { background: rgba(var(--cp-accent-rgb),.1); }

/* Best-pick highlight — stronger glow ring + filled tint */
.mgr-cp__card--best {
  background: #f0fdf8;
  box-shadow: 0 0 0 2px #10b981, 0 16px 36px -20px rgba(16,185,129,.35), 0 4px 10px rgba(15,23,42,.04);
}
.dark .mgr-cp__card--best {
  background: rgba(16,185,129,.09);
  box-shadow: 0 0 0 2px rgba(52,211,153,.55), inset 0 1px 0 rgba(255,255,255,.07), 0 18px 40px -22px rgba(0,0,0,.7);
}
.mgr-cp__card--best::before { background: rgba(16,185,129,.14); }

/* Header row: rank number + name + badge */
.mgr-cp__card-head { position: relative; display: flex; align-items: center; gap: clamp(10px, 1.8cqi, 14px); padding: clamp(15px, 3cqi, 20px) clamp(15px, 3cqi, 20px) 0; }
.mgr-cp__rank {
  flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  font-size: 11px; font-weight: 800; letter-spacing: -.01em; line-height: 1;
  background: rgba(var(--cp-accent-rgb),.12); color: var(--cp-text);
  box-shadow: inset 0 0 0 1.5px rgba(var(--cp-accent-rgb),.28);
  transition: box-shadow .2s ease;
}
.dark .mgr-cp__rank { background: rgba(var(--cp-accent-rgb),.16); color: var(--cp-text); box-shadow: inset 0 0 0 1.5px rgba(var(--cp-accent-rgb),.35); }
.mgr-cp__card--best .mgr-cp__rank { background: rgba(16,185,129,.15); color: #047857; box-shadow: inset 0 0 0 1.5px rgba(16,185,129,.4), 0 0 10px rgba(16,185,129,.25); }
.dark .mgr-cp__card--best .mgr-cp__rank { color: #34d399; background: rgba(52,211,153,.18); box-shadow: inset 0 0 0 1.5px rgba(52,211,153,.42), 0 0 12px rgba(52,211,153,.2); }
.mgr-cp__card-name { flex: 1 1 auto; min-width: 0; font-size: clamp(13px, 2.4cqi, 14.5px); font-weight: 700; letter-spacing: -.015em; line-height: 1.3; color: #0f172a; }
.dark .mgr-cp__card-name { color: #fff; }

/* "Most interest saved" badge */
.mgr-cp__best-badge {
  flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px 4px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 800; letter-spacing: .03em; white-space: nowrap;
  color: #fff; background: #047857;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 4px 12px -4px rgba(16,185,129,.55);
}
.dark .mgr-cp__best-badge { background: #065f46; box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 6px 16px -6px rgba(16,185,129,.4); }
.mgr-cp__best-badge svg { width: 11px; height: 11px; flex: none; opacity: .9; }

/* Note text */
.mgr-cp__card-note { position: relative; margin: 5px 0 0; padding: 0 clamp(15px, 3cqi, 20px) 0 calc(clamp(15px, 3cqi, 20px) + 28px + clamp(10px, 1.8cqi, 14px)); font-size: 12px; line-height: 1.5; font-weight: 500; color: #64748b; }
.dark .mgr-cp__card-note { color: #9ca3af; }

/* Stats grid */
.mgr-cp__stats { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: clamp(12px, 2.4cqi, 16px); }
@container (min-width: 640px) { .mgr-cp__stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
/* Narrow cards (phones): let the badge drop under the name and use the full width for the note. */
@container (max-width: 440px) {
  .mgr-cp__card-head { flex-wrap: wrap; row-gap: 8px; }
  .mgr-cp__best-badge { margin-left: calc(28px + clamp(10px, 1.8cqi, 14px)); }
  .mgr-cp__card-note { padding-left: clamp(15px, 3cqi, 20px); }
}

/* Stat cell */
.mgr-cp__stat {
  min-width: 0; container-type: inline-size; padding: 12px 14px; border-radius: 16px;
  background: rgba(15,23,42,.032); box-shadow: inset 0 0 0 1px rgba(15,23,42,.055);
  transition: background .15s ease;
}
.dark .mgr-cp__stat { background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }

/* "You save" stat cell — always slightly coloured, stronger on best card */
.mgr-cp__stat--save { background: rgba(var(--cp-accent-rgb),.07); box-shadow: inset 0 0 0 1px rgba(var(--cp-accent-rgb),.15); }
.dark .mgr-cp__stat--save { background: rgba(var(--cp-accent-rgb),.1); box-shadow: inset 0 0 0 1px rgba(var(--cp-accent-rgb),.2); }
.mgr-cp__card--best .mgr-cp__stat--save { background: rgba(16,185,129,.12); box-shadow: inset 0 0 0 1px rgba(16,185,129,.28); }
.dark .mgr-cp__card--best .mgr-cp__stat--save { background: rgba(52,211,153,.14); box-shadow: inset 0 0 0 1px rgba(52,211,153,.3); }

.mgr-cp__sk { display: block; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; line-height: 1.25; color: #526074; }
.dark .mgr-cp__sk { color: #a1a1aa; }
.mgr-cp__sv { display: block; margin-top: 5px; font-size: clamp(11.5px, 8cqw, 13.5px); font-weight: 800; letter-spacing: -.02em; line-height: 1.2; color: #0f172a; overflow-wrap: anywhere; }
.dark .mgr-cp__sv { color: #fff; }
.mgr-cp__stat--save .mgr-cp__sv { color: var(--cp-text); }
.dark .mgr-cp__stat--save .mgr-cp__sv { color: var(--cp-text); }
.mgr-cp__card--best .mgr-cp__stat--save .mgr-cp__sv { color: #047857; }
.dark .mgr-cp__card--best .mgr-cp__stat--save .mgr-cp__sv { color: #6ee7b7; }
.mgr-cp__ss { display: block; margin-top: 2px; font-size: 11px; font-weight: 600; line-height: 1.3; color: #526074; }
.dark .mgr-cp__ss { color: #a1a1aa; }
.mgr-cp__stat--save .mgr-cp__ss { color: var(--cp-text); }
.dark .mgr-cp__stat--save .mgr-cp__ss { color: var(--cp-text); }

/* Interest-saved mini progress bar (inside the save stat) */
.mgr-cp__savebar { display: block; height: 3px; margin-top: 7px; border-radius: 999px; overflow: hidden; background: rgba(var(--cp-accent-rgb),.15); }
.dark .mgr-cp__savebar { background: rgba(var(--cp-accent-rgb),.2); }
.mgr-cp__savebar i { display: block; height: 100%; border-radius: 999px; background: var(--cp-accent-dark); animation: mgr-grow .85s var(--mgr-ease) .2s both; }
.mgr-cp__card--best .mgr-cp__savebar { background: rgba(16,185,129,.15); }
.mgr-cp__card--best .mgr-cp__savebar i { background: #059669; }

/* Divider + fine print */
.mgr-cp__fine { margin-top: clamp(12px, 2.2cqi, 16px); padding-top: clamp(12px, 2.2cqi, 16px); border-top: 1px solid rgba(15,23,42,.07); font-size: 12px; line-height: 1.5; font-weight: 500; color: #64748b; }
.dark .mgr-cp__fine { border-top-color: rgba(255,255,255,.08); color: #9ca3af; }

@media (prefers-reduced-motion: reduce) {
  .mgr-cp__card { transition: none; }
  .mgr-cp__card:hover { transform: none; }
  .mgr-cp__savebar i { animation: none; }
  .mgr-ys__dl, .mgr-ys__row, .mgr-ys__chevron, .mgr-ys__showmore button, .mgr-ys__showmore svg { transition: none; }
}

/* ======================= PAYMENT SCHEDULE (.mgr-ys) ======================= */
.mgr-ys .mgr-sum__head { flex-wrap: nowrap; }
.mgr-ys__dl {
  appearance: none; flex: none; margin-left: auto; display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px;
  border: 0; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 700; letter-spacing: .01em; line-height: 1; white-space: nowrap; cursor: pointer;
  color: #047857; background: rgba(16,185,129,.12);
  box-shadow: inset 0 0 0 1px rgba(16,185,129,.28);
  transition: background .15s ease, box-shadow .15s ease, transform .15s ease;
}
.dark .mgr-ys__dl { color: #6ee7b7; background: rgba(52,211,153,.16); box-shadow: inset 0 0 0 1px rgba(52,211,153,.3); }
.mgr-ys__dl svg { width: 14px; height: 14px; flex: none; }
@media (hover: hover) { .mgr-ys__dl:hover { background: rgba(16,185,129,.18); box-shadow: inset 0 0 0 1px rgba(16,185,129,.45), 0 8px 18px -10px rgba(16,185,129,.5); transform: translateY(-1px); } }
.dark .mgr-ys__dl:hover { background: rgba(52,211,153,.2); }
.mgr-ys__dl:active { transform: scale(.97); }
.mgr-ys__dl:focus-visible { outline: 2px solid rgba(16,185,129,.7); outline-offset: 2px; }
/* Narrow cards: icon-only round button so the title keeps its room. */
@container (max-width: 420px) {
  .mgr-ys__dl { width: 36px; padding: 0; justify-content: center; }
  .mgr-ys__dl-t { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
}
.mgr-ys__body { margin-top: clamp(14px, 2.8cqi, 20px); }
.mgr-ys__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mgr-ys__row {
  overflow: hidden; border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(15,23,42,.07), 0 2px 6px rgba(15,23,42,.03);
  transition: box-shadow .15s ease;
}
.dark .mgr-ys__row {
  background: rgba(255,255,255,.05);
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.05);
}
.mgr-ys__row[data-open="true"] {
  box-shadow: 0 0 0 1.5px rgba(16,185,129,.45), 0 8px 20px -12px rgba(16,185,129,.2);
  background: #f0fdf8;
}
.dark .mgr-ys__row[data-open="true"] {
  box-shadow: 0 0 0 1.5px rgba(52,211,153,.35), 0 8px 20px -12px rgba(0,0,0,.4);
  background: rgba(16,185,129,.07);
}
.mgr-ys__btn { appearance: none; width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 0; border-radius: 0; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.mgr-ys__btn:focus-visible { outline: 2px solid rgba(16,185,129,.6); outline-offset: -2px; border-radius: 18px; }
.mgr-ys__year { width: 60px; flex: none; }
.mgr-ys__yn { display: block; font-size: 13.5px; font-weight: 800; line-height: 1.25; color: #0f172a; }
.dark .mgr-ys__yn { color: #fff; }
.mgr-ys__yd { display: block; font-size: 10.5px; font-weight: 600; color: #94a3b8; }
.dark .mgr-ys__yd { color: #71717a; }
.mgr-ys__grid { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; }
@container (min-width: 500px) { .mgr-ys__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mgr-ys__opt { display: none; }
@container (min-width: 500px) { .mgr-ys__opt { display: block; } }
.mgr-ys__chevron { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: rgba(15,23,42,.05); color: #94a3b8; transition: transform .2s ease, background .15s ease; }
.dark .mgr-ys__chevron { background: rgba(255,255,255,.07); color: #71717a; }
.mgr-ys__row[data-open="true"] .mgr-ys__chevron { transform: rotate(180deg); background: rgba(16,185,129,.12); color: #047857; }
.dark .mgr-ys__row[data-open="true"] .mgr-ys__chevron { background: rgba(52,211,153,.15); color: #34d399; }
.mgr-ys__detail { border-top: 1px solid rgba(15,23,42,.06); padding: 12px 14px 14px; }
.dark .mgr-ys__detail { border-top-color: rgba(255,255,255,.07); }
.mgr-ys__dsummary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-bottom: 12px; }
@container (min-width: 480px) { .mgr-ys__dsummary { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mgr-ys__dstat { min-width: 0; }
.mgr-ys__dk { display: block; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; line-height: 1.25; color: #64748b; }
.dark .mgr-ys__dk { color: #a1a1aa; }
.mgr-ys__dv { display: block; margin-top: 3px; font-size: 13.5px; font-weight: 700; letter-spacing: -.01em; color: #0f172a; overflow-wrap: anywhere; }
.dark .mgr-ys__dv { color: #fff; }
.mgr-ys__thead { display: none; }
@container (min-width: 480px) {
  .mgr-ys__thead { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr 1.1fr; gap: 10px; padding: 8px 0; border-top: 1px solid rgba(15,23,42,.06); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; }
  .dark .mgr-ys__thead { border-top-color: rgba(255,255,255,.07); color: #71717a; }
}
.mgr-ys__payments { margin: 0; padding: 0; list-style: none; border-top: 1px solid rgba(15,23,42,.06); }
.dark .mgr-ys__payments { border-top-color: rgba(255,255,255,.07); }
.mgr-ys__payment { padding: 9px 0; border-bottom: 1px solid rgba(15,23,42,.04); font-variant-numeric: tabular-nums; }
.dark .mgr-ys__payment { border-bottom-color: rgba(255,255,255,.05); }
.mgr-ys__payment:last-child { border-bottom: 0; }
.mgr-ys__pmob { display: block; }
.mgr-ys__pdesk { display: none; }
@container (min-width: 480px) {
  .mgr-ys__pmob { display: none; }
  .mgr-ys__pdesk { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr 1.1fr; gap: 10px; align-items: baseline; font-size: 12.5px; }
}
.mgr-ys__pmob-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.mgr-ys__pmob-top span:first-child { font-size: 13px; font-weight: 700; color: #0f172a; }
.dark .mgr-ys__pmob-top span:first-child { color: #fff; }
.mgr-ys__pmob-top span:last-child { font-size: 13px; font-weight: 800; color: #0f172a; }
.dark .mgr-ys__pmob-top span:last-child { color: #fff; }
.mgr-ys__pmob-sub { margin-top: 2px; font-size: 11.5px; font-weight: 500; color: #64748b; }
.dark .mgr-ys__pmob-sub { color: #9ca3af; }
.mgr-ys__pdesk span:first-child { font-weight: 700; color: #0f172a; }
.dark .mgr-ys__pdesk span:first-child { color: #fff; }
.mgr-ys__pdesk span:last-child { text-align: right; font-weight: 800; color: #0f172a; }
.dark .mgr-ys__pdesk span:last-child { color: #fff; }
.mgr-ys__pdesk span { font-weight: 600; color: #475569; }
.dark .mgr-ys__pdesk span { color: #cbd5e1; }
.mgr-ys__showmore { margin-top: 14px; display: flex; justify-content: center; }
.mgr-ys__showmore button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 20px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: rgba(15,23,42,.04); font-size: 13px; font-weight: 700; color: #475569; cursor: pointer; transition: background .15s, box-shadow .15s; font: inherit; }
.dark .mgr-ys__showmore button { border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #cbd5e1; }
.mgr-ys__showmore button:hover { background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.25); color: #047857; }
.dark .mgr-ys__showmore button:hover { background: rgba(52,211,153,.1); border-color: rgba(52,211,153,.28); color: #34d399; }
.mgr-ys__showmore button:focus-visible { outline: 2px solid rgba(16,185,129,.6); outline-offset: 2px; }
.mgr-ys__showmore svg { width: 14px; height: 14px; transition: transform .2s ease; }
/* ======================= FLAT COLOUR SYSTEM (solid, no gradients) ======================= */
/* Decorative glows, sheens and grain are removed; colour comes from solid, vibrant section accents. */
.mgr-orb, .mgr-sum__glow, .mgr-hero__sheen, .mgr-hero__rings, .mgr-hero__grain, .mgr-hero__edge, .mgr-pm__top::before, .mgr-pm__top::after { display: none; }
.mgr-hero::after, .mgr-panel::before { background: rgba(255,255,255,.16); }
.mgr-hero { background: #047857; }
.dark .mgr-hero { background: #064e3b; }
.mgr-hero .mgr-cap, .mgr-hero .mgr-eyebrow__sub { color: rgba(255,255,255,.88); }
.mgr-eyebrow__mark { background: #fbbf24; box-shadow: none; }
.mgr-donut__k, .mgr-note, .mgr-bd__sub, .mgr-bd__hint, .mgr-amt__c { color: rgba(255,255,255,.88); }
.mgr-table thead th, .mgr-table thead th.mgr-c-p, .mgr-table thead th.mgr-c-v { color: rgba(255,255,255,.8); }

/* One vibrant colour per card: top bar + header badge */
.mgr-sum { --sec: #0ea5e9; border-top: 4px solid var(--sec); }
.mgr-sv { --sec: #f59e0b; }
.mgr-wg { --sec: #ec4899; }
.mgr-bc { --sec: #14b8a6; }
.mgr-cp { --sec: #6366f1; }
.mgr-ys { --sec: #10b981; }
.mgr-sum .mgr-badge { background: var(--sec); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 6px 14px -6px var(--sec); }
.mgr-sv__badge { background: #f59e0b; }
.mgr-pm { border-top: 4px solid #8b5cf6; }
.mgr-pm__top { background: #6d28d9; }
.dark .mgr-pm__top { background: #5b21b6; }

/* Loan summary tiles + chips: solid vivid fills */
.mgr-tile::after { height: 3px; opacity: 1; }
.mgr-ic { background: var(--t2); }
.mgr-meter > i, .mgr-tl__track { background: var(--t2); }

/* Compare cards: bright accent bar, solid rank bubble and bar */
.mgr-cp__accent-bar { height: 4px; background: var(--cp-accent); opacity: 1; }
.mgr-cp__rank, .dark .mgr-cp__rank { background: var(--cp-accent-dark); color: #fff; box-shadow: none; }
.mgr-cp__card--best .mgr-cp__rank, .dark .mgr-cp__card--best .mgr-cp__rank { background: #047857; color: #fff; box-shadow: 0 0 0 3px rgba(16,185,129,.25); }
.mgr-cp__savebar i { background: var(--cp-accent); }
.mgr-cp__card--best .mgr-cp__savebar i { background: #10b981; }
.mgr-cp__best-badge { background: #047857; box-shadow: 0 4px 12px -4px rgba(4,120,87,.55); }
.dark .mgr-cp__best-badge { background: #059669; }
.mgr-cp__param { background: #6366f1; color: #fff; box-shadow: none; }
.dark .mgr-cp__param { background: #4f46e5; color: #fff; box-shadow: none; }

/* Savings + schedule accents */
.mgr-sv__chip b { background: #059669; }
.mgr-ys__dl { background: #10b981; color: #fff; box-shadow: none; }
.dark .mgr-ys__dl { background: #059669; color: #fff; box-shadow: none; }
`;

// Each component keeps its own flat hue; `c1` is the light tint, `c2` the solid colour used for fills.
const HERO_PART_COLORS: Record<string, [string, string]> = {
  'Principal & interest': ['#a7f3d0', '#10b981'],
  'Property tax': ['#bae6fd', '#0ea5e9'],
  'Insurance': ['#fed7aa', '#f97316'],
  'PMI': ['#ddd6fe', '#8b5cf6'],
  'HOA / fees': ['#fbcfe8', '#ec4899'],
  'Other': ['#e2e8f0', '#94a3b8'],
};
const partColors = (label: string): React.CSSProperties =>
  ({ '--c1': (HERO_PART_COLORS[label] ?? HERO_PART_COLORS.Other)[0], '--c2': (HERO_PART_COLORS[label] ?? HERO_PART_COLORS.Other)[1] } as React.CSSProperties);

// Splits "$2,844.31" into ["$2,844", ".31"] so the cents can be set smaller. Formats that don't end in
// two decimals (for example a trailing currency symbol) simply render whole.
const splitCents = (text: string): [string, string] => {
  const m = text.match(/^(.*\d)([.,]\d{2})$/);
  return m ? [m[1], m[2]] : [text, ''];
};

const pctLabel = (pct: number): string => (pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`);

// Principal-vs-interest donut for the very first payment (static: no motion).
const FirstPaymentSplit: React.FC<{
  principal: number;
  interest: number;
  fmt2: (n: number) => string;
}> = ({ principal, interest, fmt2 }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const total = principal + interest;
  if (!(total > 0)) return null;
  const interestPct = Math.min(100, Math.max(0, (interest / total) * 100));
  const principalPct = 100 - interestPct;
  const gap = principalPct > 0 && interestPct > 0 ? 1.8 : 0;
  const pLen = Math.max(principalPct - gap, 0);
  const iLen = Math.max(interestPct - gap, 0);
  const arc = (len: number, offset: number, color: string) => (
    <circle
      cx="60"
      cy="60"
      r="49"
      fill="none"
      stroke={color}
      strokeWidth="10.5"
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray={`${len} ${100 - len}`}
      strokeDashoffset={-offset}
    />
  );
  return (
    <div className="mgr-panel mgr-split" role="group" aria-label="How your first payment is split">
      <p className="mgr-panel__title"><span className="mgr-gic" aria-hidden="true"><SafeIcon icon={FiPieChart} /></span>Your first payment</p>
      <div className="mgr-split__body">
        <div
          className="mgr-donut"
          role="img"
          aria-label={`Principal ${pctLabel(principalPct)} (${fmt2(principal)}), interest ${pctLabel(interestPct)} (${fmt2(interest)})`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="49" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10.5" />
            <circle cx="60" cy="60" r="39" fill="rgba(0,0,0,.14)" stroke="rgba(255,255,255,.06)" strokeWidth="1" />
            <defs>
              <linearGradient id={`${uid}p`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#10b981" /></linearGradient>
              <linearGradient id={`${uid}i`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f59e0b" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
            </defs>
            {pLen > 0 && arc(pLen, 0, `url(#${uid}p)`)}
            {iLen > 0 && arc(iLen, principalPct, `url(#${uid}i)`)}
          </svg>
          <div className="mgr-donut__c" aria-hidden="true">
            <span className="mgr-donut__v">{pctLabel(interestPct)}</span>
            <span className="mgr-donut__k">Interest</span>
          </div>
        </div>
        <ul className="mgr-legend">
          <li>
            <div className="mgr-legend__top">
              <span className="mgr-legend__l">
                <span className="mgr-swatch" style={{ background: '#10b981' }} aria-hidden="true" />
                <span>Principal</span>
              </span>
              <em className="mgr-legend__pct">{pctLabel(principalPct)}</em>
            </div>
            <span className="mgr-legend__v">{fmt2(principal)}</span>
          </li>
          <li>
            <div className="mgr-legend__top">
              <span className="mgr-legend__l">
                <span className="mgr-swatch" style={{ background: '#f59e0b' }} aria-hidden="true" />
                <span>Interest</span>
              </span>
              <em className="mgr-legend__pct">{pctLabel(interestPct)}</em>
            </div>
            <span className="mgr-legend__v">{fmt2(interest)}</span>
          </li>
        </ul>
      </div>
      <p className="mgr-note">
        {interestPct > 50
          ? 'Early payments are mostly interest. Your principal share grows with every payment.'
          : 'Most of each payment already goes toward paying down your principal.'}
      </p>
    </div>
  );
};

const PaymentHero: React.FC<{
  value: number;
  format: (n: number) => string;
  rateLabel: string;
  termLabel: string;
  regionLabel: string;
  compounding?: boolean;
  totalText?: string;
  parts?: { label: string; value: number }[];
  firstSplit?: { principal: number; interest: number } | null;
  fmt2: (n: number) => string;
}> = ({ value, format, rateLabel, termLabel, regionLabel, compounding, totalText, parts = [], firstSplit, fmt2 }) => {
  const heroText = format(value);
  const [heroMain, heroCents] = splitCents(heroText);
  const facts: { icon: IconType; label: string; value: string; hue: string }[] = [
    { icon: FiPercent, label: 'Interest rate', value: rateLabel, hue: 'Insurance' },
    { icon: FiClock, label: 'Loan term', value: termLabel, hue: 'Property tax' },
    { icon: FiGlobe, label: 'Region', value: regionLabel, hue: 'Principal & interest' },
    ...(compounding ? [{ icon: FiTrendingDown, label: 'Compounding', value: 'Semi-annual', hue: 'PMI' }] : []),
  ];
  const partsTotal = parts.reduce((a, p) => a + p.value, 0);
  const showBreakdown = Boolean(totalText) && parts.length > 0 && partsTotal > 0;
  const showSplit = Boolean(firstSplit) && (firstSplit!.principal + firstSplit!.interest) > 0;
  const [totalMain, totalCents] = splitCents(totalText ?? '');
  const loanPart = parts.find((p) => p.label === 'Principal & interest');
  const loanShare = loanPart && partsTotal > 0 ? (loanPart.value / partsTotal) * 100 : null;

  return (
    <section aria-label="Monthly payment" className="mgr-hero">
      <div className="mgr-hero__fx" aria-hidden="true">
        <div className="mgr-orb mgr-orb--a" />
        <div className="mgr-orb mgr-orb--b" />
        <div className="mgr-orb mgr-orb--c" />
        <div className="mgr-orb mgr-orb--d" />
        <div className="mgr-hero__sheen" />
        <div className="mgr-hero__rings" />
        <div className="mgr-hero__grain" />
        <div className="mgr-hero__edge" />
      </div>

      <div className="mgr-hero__in">
        <div className={`mgr-hero__main${showSplit ? ' mgr-hero__main--split' : ''}`}>
          <div className="mgr-lead">
            <div className="mgr-eyebrow">
              <span className="mgr-eyebrow__mark" aria-hidden="true" />
              <span className="mgr-eyebrow__t">Monthly payment</span>
              <span className="mgr-eyebrow__sub">Principal &amp; interest</span>
            </div>

            <div>
              <div className="mgr-amt-wrap">
                <span className="mgr-amt" style={fitNumberStyle(heroText, 3.4, 1.9)}>
                  <span aria-hidden="true">{heroMain}</span>
                  {heroCents && <span className="mgr-amt__c" aria-hidden="true">{heroCents}</span>}
                  <span className="mgr-sr">{heroText}</span>
                </span>
              </div>
              <p className="mgr-cap">per month, before taxes &amp; other costs</p>
            </div>
          </div>

          {showSplit && firstSplit && (
            <FirstPaymentSplit principal={firstSplit.principal} interest={firstSplit.interest} fmt2={fmt2} />
          )}
        </div>

        {showBreakdown && (
          <section className="mgr-panel mgr-bd" aria-label="Total monthly payment breakdown">
            <div className="mgr-bd__sum">
              <p className="mgr-panel__title"><span className="mgr-gic" aria-hidden="true"><SafeIcon icon={FiLayers} /></span>Total monthly payment</p>
              <p className="mgr-bd__sub">First month, including taxes &amp; costs</p>
              <div className="mgr-amt-wrap">
                <p className="mgr-bd__total" style={fitNumberStyle(totalText as string, 2.1, 1.4)}>
                  <span aria-hidden="true">{totalMain}</span>
                  {totalCents && <span className="mgr-amt__c" aria-hidden="true">{totalCents}</span>}
                  <span className="mgr-sr">{totalText}</span>
                </p>
              </div>
              <div className="mgr-stack" aria-hidden="true">
                {parts.map((p) => (
                  <div key={p.label} style={{ ...partColors(p.label), flexGrow: p.value, background: 'var(--c2)' }} />
                ))}
              </div>
              {loanShare !== null && (
                <p className="mgr-bd__hint">
                  <b>{pctLabel(loanShare)}</b> goes to your loan, <b>{pctLabel(100 - loanShare)}</b> to taxes &amp; costs.
                </p>
              )}
            </div>
            <div className="mgr-bd__tbl">
              <table className="mgr-table">
                <caption className="mgr-sr">Monthly payment components, share of the total and amount</caption>
                <thead>
                  <tr>
                    <th scope="col" className="mgr-c-k" style={{ textAlign: 'left' }}>Component</th>
                    <th scope="col" className="mgr-c-p">Share</th>
                    <th scope="col" className="mgr-c-v">Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.label} style={partColors(p.label)}>
                      <th scope="row" className="mgr-c-k">
                        <span className="mgr-row__k">
                          <i aria-hidden="true" />
                          <span className="mgr-row__n">
                            <span className="mgr-row__label">{p.label}</span>
                            <span className="mgr-row__bar" aria-hidden="true"><b style={{ width: `${Math.min(100, (p.value / partsTotal) * 100)}%` }} /></span>
                          </span>
                        </span>
                      </th>
                      <td className="mgr-c-p"><span className="mgr-pill">{pctLabel((p.value / partsTotal) * 100)}</span></td>
                      <td className="mgr-c-v">{fmt2(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <dl className="mgr-facts" aria-label="Loan terms">
          {facts.map((f) => (
            <div key={f.label} className="mgr-fact" style={partColors(f.hue)}>
              <span className="mgr-fact__ic" aria-hidden="true"><SafeIcon icon={f.icon} /></span>
              <div className="mgr-fact__body">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

type SummaryTone = 'emerald' | 'rose' | 'sky' | 'amber';

const SummaryTile: React.FC<{
  tone: SummaryTone;
  icon: IconType;
  label: string;
  index: number;
  value: string;
  /** When set, the value counts up to this number (formatted by `format`). */
  amount?: { value: number; format: (n: number) => string };
  sub?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ tone, icon, label, index, value, amount, sub, children }) => {
  const reduced = useReducedMotion();
  const valueStyle = fitNumberStyle(value, 1.5, 1.05);
  return (
    // The motion wrapper owns the entrance transform; the tile owns hover, so the two never fight.
    <motion.div
      className="mgr-tilewrap"
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: EASE_OUT }}
    >
      <div className={`mgr-tile mgr-tile--${tone}`}>
        <div className="mgr-tile__head">
          <span className="mgr-ic" aria-hidden="true">
            <SafeIcon icon={icon} />
          </span>
          <span className="mgr-tile__label">{label}</span>
        </div>
        {amount ? (
          <AnimatedAmount value={amount.value} format={amount.format} className="mgr-tile__value" style={valueStyle} />
        ) : (
          <span className="mgr-tile__value" style={valueStyle}>{value}</span>
        )}
        <div className="mgr-tile__sub">{sub ?? '\u00A0'}</div>
        {children && <div className="mgr-tile__foot">{children}</div>}
      </div>
    </motion.div>
  );
};

// Thin animated bar used inside the tiles. `segments` are widths in % with optional explicit colours.
const TileMeter: React.FC<{
  segments: { pct: number; color?: string }[];
  label: string;
  delay?: number;
}> = ({ segments, label, delay = 0.35 }) => {
  const reduced = useReducedMotion();
  return (
    <div className="mgr-meter" role="img" aria-label={label}>
      {segments.map((s, i) => (
        <motion.i
          key={i}
          style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, originX: 0, ...(s.color ? { background: s.color } : null) }}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: delay + i * 0.1, ease: EASE_OUT }}
        />
      ))}
    </div>
  );
};

const LoanSummaryCard: React.FC<{
  loanAmount: number;
  downPaymentAmount: number;
  downPaymentPct: number;
  interest: number;
  totalPaid: number;
  payoffLabel: string;
  durationLabel: string;
  startLabel?: string;
  fullCost?: number;
  warnings?: string[];
  tip: string;
  fmt0: (n: number) => string;
  fmt2: (n: number) => string;
}> = ({
  loanAmount, downPaymentAmount, downPaymentPct, interest, totalPaid, payoffLabel, durationLabel, startLabel,
  fullCost, warnings = [], tip, fmt0, fmt2,
}) => {
  const price = loanAmount + downPaymentAmount;
  const loanShare = price > 0 ? (loanAmount / price) * 100 : 100;
  const interestShare = totalPaid > 0 ? (interest / totalPaid) * 100 : 0;
  const principalShare = 100 - interestShare;
  const perDollar = loanAmount > 0 ? interest / loanAmount : 0;
  const downText = downPaymentAmount > 0 ? `${trimNum(downPaymentPct, 2)}% down · ${fmt0(downPaymentAmount)}` : 'No down payment';

  return (
    <section className="mgr-sum" aria-label="Loan summary">
      <div className="mgr-sum__glow" aria-hidden="true" />
      <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
      <div className="mgr-sum__in">
        <div className="mgr-sum__head">
          <span className="mgr-badge" aria-hidden="true">
            <SafeIcon icon={FiLayers} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h4 className="mgr-sum__title">
              Loan Summary
              <InfoTip text={tip} />
            </h4>
            <p className="mgr-sum__sub">Principal and interest over the full loan term.</p>
          </div>
        </div>

        <div className="mgr-tiles">
          <SummaryTile
            index={0}
            tone="emerald"
            icon={FiHome}
            label="Loan amount"
            value={fmt0(loanAmount)}
            amount={{ value: loanAmount, format: fmt0 }}
            sub={downText}
          >
            <TileMeter segments={[{ pct: loanShare }]} label={`Loan is ${Math.round(loanShare)}% of the home price`} />
          </SummaryTile>

          <SummaryTile
            index={1}
            tone="rose"
            icon={FiPercent}
            label="Total interest"
            value={fmt0(interest)}
            amount={{ value: interest, format: fmt0 }}
            sub={totalPaid > 0 ? <><b>{pctLabel(interestShare)}</b> of total paid</> : undefined}
          >
            <TileMeter segments={[{ pct: interestShare }]} label={`Interest is ${Math.round(interestShare)}% of everything you pay`} delay={0.45} />
          </SummaryTile>

          <SummaryTile
            index={2}
            tone="sky"
            icon={FiLayers}
            label="Total of payments"
            value={fmt0(totalPaid)}
            amount={{ value: totalPaid, format: fmt0 }}
            sub="Principal + interest"
          >
            <TileMeter
              segments={[
                { pct: principalShare, color: '#10b981' },
                { pct: interestShare, color: '#f43f5e' },
              ]}
              label={`Principal ${Math.round(principalShare)}%, interest ${Math.round(interestShare)}%`}
              delay={0.55}
            />
            <div className="mgr-mkey" aria-hidden="true">
              <span><i style={{ background: '#10b981' }} />Principal</span>
              <span><i style={{ background: '#f43f5e' }} />Interest</span>
            </div>
          </SummaryTile>

          <SummaryTile index={3} tone="amber" icon={FiCalendar} label="Payoff date" value={payoffLabel} sub={durationLabel}>
            {startLabel ? (
              <div className="mgr-tl" aria-hidden="true">
                <span className="mgr-tl__date">{startLabel}</span>
                <span className="mgr-tl__track" />
                <span className="mgr-tl__date">{payoffLabel}</span>
              </div>
            ) : null}
          </SummaryTile>
        </div>

        {(perDollar > 0 || (fullCost ?? 0) > 0) && (
          <div className="mgr-insights">
            {perDollar > 0 && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiTrendingDown} />
                </span>
                <span>
                  You pay about <b>{fmt2(perDollar)}</b> in interest for every <b>{fmt2(1)}</b> you borrow.
                </span>
              </p>
            )}
            {(fullCost ?? 0) > 0 && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiPieChart} />
                </span>
                <span>
                  Including the taxes and costs you entered, the full cost over the loan comes to about <b>{fmt0(fullCost as number)}</b>.
                </span>
              </p>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {warnings.map((w) => (
              <li key={w} className="mgr-warn">
                <SafeIcon icon={FiAlertCircle} aria-hidden="true" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const clampPct = (n: number): number => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

// One horizontal comparison bar (grey = without extras, green = with extras).
const SavingsBar: React.FC<{
  label: string;
  value: string;
  sub?: string;
  pct: number;
  kind: 'base' | 'with';
  delay: number;
  reduced: boolean | null;
  /** Optional "-20%" style badge shown beside the label (used on the with-extras bars). */
  cut?: string;
}> = ({ label, value, sub, pct, kind, delay, reduced, cut }) => (
  <div className={`mgr-sv__bar mgr-sv__bar--${kind}`}>
    <div className="mgr-sv__barhead">
      <span className="mgr-sv__barlabel">
        {label}
        {cut && <b className="mgr-sv__cut">{cut}</b>}
      </span>
      <span className="mgr-sv__barvalue">
        {value}
        {sub && <em>{sub}</em>}
      </span>
    </div>
    <div className="mgr-sv__track" aria-hidden="true">
      <motion.i
        style={{ width: `${clampPct(pct)}%`, originX: 0 }}
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay, ease: EASE_OUT }}
      />
    </div>
  </div>
);

// "What Your Extra Payments Save": a dark, celebratory "before vs after" card (deliberately unlike the Loan Summary).
const ExtraSavingsCard: React.FC<{ result: MortgageResult; tip: string }> = ({ result: r, tip }) => {
  const reduced = useReducedMotion();
  const s = r.savings;
  if (!s) return null;
  const loc = r.locale;
  const fmt0 = (n: number) => formatMoney(n, loc, r.currency, 0);
  const fmt2 = (n: number) => formatMoney(n, loc, r.currency, 2);

  const baselineMonths = (s.baselinePeriods * 12) / r.periodsPerYear;
  const payoffLabel = formatMonthYear(r.payoff.date, loc);
  const interestShare = s.baselineInterest > 0 ? clampPct((s.interestSaved / s.baselineInterest) * 100) : 0;
  const withInterestPct = s.baselineInterest > 0 ? (r.totals.interest / s.baselineInterest) * 100 : 0;
  const withTimePct = baselineMonths > 0 ? (r.payoff.months / baselineMonths) * 100 : 0;
  const interestCutPct = clampPct(100 - withInterestPct);
  const timeCutPct = clampPct(100 - withTimePct);
  const interestCut = s.baselineInterest > 0 && interestCutPct >= 1 ? `\u2212${pctLabel(interestCutPct)}` : undefined;
  const timeCut = baselineMonths > 0 && timeCutPct >= 1 ? `\u2212${pctLabel(timeCutPct)}` : undefined;
  const showInterestCmp = s.baselineInterest > 0;
  const showTimeCmp = baselineMonths > 0;
  const showCmp = showInterestCmp || showTimeCmp;
  const perDollar = s.extraPaidTotal > 0 ? Math.max(0, s.interestSaved) / s.extraPaidTotal : 0;
  const savedText = fmt0(s.interestSaved);

  return (
    <section className="mgr-sum mgr-sv" aria-label="What your extra payments save">
      <div className="mgr-sum__glow" aria-hidden="true" />
      <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
      <div className="mgr-sum__in">
        <div className="mgr-sum__head">
          <span className="mgr-sv__badge" aria-hidden="true">
            <SafeIcon icon={FiZap} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h4 className="mgr-sum__title">
              What Your Extra Payments Save
              <InfoTip text={tip} />
            </h4>
            <p className="mgr-sum__sub">Compared with the same loan and no extras.</p>
          </div>
        </div>

        <div className={`mgr-sv__main${showCmp ? ' mgr-sv__main--split' : ''}`}>
          <div className="mgr-sv__lead">
            <span className="mgr-sv__eyebrow"><i />Interest saved</span>
            <div className="mgr-sv__amtwrap">
              <AnimatedAmount value={s.interestSaved} format={fmt0} className="mgr-sv__amt" style={fitNumberStyle(savedText, 3.1, 1.8)} />
            </div>
            {s.baselineInterest > 0 && (
              <p className="mgr-sv__chip"><b>{pctLabel(interestShare)}</b><span>of the interest you would have paid</span></p>
            )}
            <div className="mgr-sv__duo">
              <div className="mgr-sv__row">
                <span className="mgr-sv__fic" aria-hidden="true"><SafeIcon icon={FiClock} /></span>
                <span className="mgr-sv__rk">
                  <span className="mgr-sv__k">Paid off sooner</span>
                </span>
                <span className="mgr-sv__rv">{formatDuration(s.monthsSaved)}</span>
              </div>
              <div className="mgr-sv__row">
                <span className="mgr-sv__fic" aria-hidden="true"><SafeIcon icon={FiCalendar} /></span>
                <span className="mgr-sv__rk">
                  <span className="mgr-sv__k">New payoff date</span>
                  <span className="mgr-sv__rs">{r.payoff.periods} payments</span>
                </span>
                <span className="mgr-sv__rv">{payoffLabel}</span>
              </div>
            </div>
          </div>

          {showCmp && (
            <div className="mgr-sv__cmp">
              <span className="mgr-sv__eyebrow"><i />Without extras vs with extras</span>
              {showInterestCmp && (
                <div className="mgr-sv__grp">
                  <SavingsBar kind="base" label="Interest without extras" value={fmt0(s.baselineInterest)} pct={100} delay={0.2} reduced={reduced} />
                  <SavingsBar kind="with" label="Interest with extras" value={fmt0(r.totals.interest)} pct={withInterestPct} delay={0.35} reduced={reduced} cut={interestCut} />
                </div>
              )}
              {showTimeCmp && (
                <div className="mgr-sv__grp">
                  <SavingsBar kind="base" label="Loan length without extras" value={formatDuration(baselineMonths)} sub={`${s.baselinePeriods} payments`} pct={100} delay={0.3} reduced={reduced} />
                  <SavingsBar kind="with" label="Loan length with extras" value={formatDuration(r.payoff.months)} sub={`${r.payoff.periods} payments`} pct={withTimePct} delay={0.45} reduced={reduced} cut={timeCut} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mgr-sv__facts">
          <div className="mgr-sv__fact">
            <span className="mgr-sv__fic" aria-hidden="true"><SafeIcon icon={FiLayers} /></span>
            <span>
              <span className="mgr-sv__k">Extras you pay</span>
              <span className="mgr-sv__v">{fmt0(s.extraPaidTotal)}</span>
            </span>
          </div>
          {perDollar > 0 && (
            <div className="mgr-sv__fact">
              <span className="mgr-sv__fic" aria-hidden="true"><SafeIcon icon={FiTrendingDown} /></span>
              <span>
                <span className="mgr-sv__k">Interest saved per {fmt2(1)} extra</span>
                <span className="mgr-sv__v">{fmt2(perDollar)}</span>
              </span>
            </div>
          )}
        </div>

        <div className="mgr-insights">
          <p className="mgr-insight" style={{ margin: 0 }}>
            <span className="mgr-insight__ic" aria-hidden="true">
              <SafeIcon icon={FiInfo} />
            </span>
            <span>With no extras this loan would take <b>{formatDuration(baselineMonths)}</b> ({s.baselinePeriods} payments) and cost <b>{fmt0(s.baselineInterest)}</b> in interest. With them it takes <b>{formatDuration(r.payoff.months)}</b> and costs <b>{fmt0(r.totals.interest)}</b>.</span>
          </p>
        </div>
      </div>
    </section>
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
  "mtg-native-select w-full appearance-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 dark:focus-within:border-indigo-500/60 cursor-pointer";
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

// --- BREAKDOWN RING --- (inline SVG donut + interactive legend; styled by the scoped `.mgr-wg*` rules)
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
  // `hover` follows the mouse / keyboard focus; `pinned` is the row the person tapped or clicked.
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
  const maskId = `mgrwg${uid}`;

  return (
    <div className="mgr-wg__main">
      <div className="mgr-wg__panel">
        <div className="mgr-wg__ring">
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
                      transition={{ duration: 1.1, delay: 0.1, ease: EASE_OUT }}
                    />
                  </g>
                </mask>
              </defs>
            )}
            <circle cx="80" cy="80" r={R} fill="none" strokeWidth="22" className="mgr-wg__track" />
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
                      filter: active === a.key ? `drop-shadow(0 0 5px ${a.color}99)` : undefined,
                      cursor: 'pointer',
                      transition: 'opacity 150ms, stroke-width 150ms',
                    }}
                  />
                ))}
              </g>
            </g>
          </svg>
          <div className="mgr-wg__c" aria-hidden="true">
            <span className="mgr-wg__ck">{activeArc ? activeArc.label : centerLabel}</span>
            <span className="mgr-wg__cv">{activeArc ? shareLabel(activeArc.frac) : centerValue}</span>
            <span className="mgr-wg__cs">{activeArc ? fmt(activeArc.value) : '\u00A0'}</span>
          </div>
        </div>
      </div>

      <ul className="mgr-wg__list">
        {arcs.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              className="mgr-wg__row"
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
              <span className="mgr-wg__dot" aria-hidden="true" />
              <span className="mgr-wg__rn">
                <span className="mgr-wg__rl">{a.label}</span>
                <span className="mgr-wg__rbar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.max(0, a.frac * 100))}%` }} />
                </span>
              </span>
              <span className="mgr-wg__rv">
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

// "Where Your Money Goes": same card language as the Loan Summary (header badge, panel + rows, insight callouts).
const MoneyBreakdownCard: React.FC<{
  slices: RingSlice[];
  centerLabel: string;
  centerValue: string;
  fmt: (n: number) => string;
  tip: string;
}> = ({ slices, centerLabel, centerValue, fmt, tip }) => {
  const total = slices.reduce((a, sl) => a + sl.value, 0);
  const interest = slices.find((sl) => sl.key === 'interest');
  const costsTotal = slices.filter((sl) => sl.key !== 'principal' && sl.key !== 'interest').reduce((a, sl) => a + sl.value, 0);
  const showInterest = !!interest && total > 0;
  const showCosts = costsTotal > 0.004 && total > 0;

  return (
    <section className="mgr-sum mgr-wg" aria-label="Where your money goes">
      <div className="mgr-sum__glow" aria-hidden="true" />
      <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
      <div className="mgr-sum__in">
        <div className="mgr-sum__head">
          <span className="mgr-badge" aria-hidden="true">
            <SafeIcon icon={FiPieChart} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h4 className="mgr-sum__title">
              Where Your Money Goes
              <InfoTip text={tip} />
            </h4>
            <p className="mgr-sum__sub">Everything you pay over the life of the loan.</p>
          </div>
        </div>

        <div className="mgr-wg__body">
          <BreakdownRing slices={slices} centerLabel={centerLabel} centerValue={centerValue} fmt={fmt} />
        </div>

        {(showInterest || showCosts) && (
          <div className="mgr-insights">
            {showInterest && interest && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiPercent} />
                </span>
                <span>
                  Interest is <b>{shareLabel(interest.value / total)}</b> of the <b>{fmt(total)}</b> you pay over the life of the loan.
                </span>
              </p>
            )}
            {showCosts && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiLayers} />
                </span>
                <span>
                  The taxes and costs you entered add <b>{fmt(costsTotal)}</b> ({shareLabel(costsTotal / total)} of the total).
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

// --- BALANCE CHART --- (inline SVG, drawn at the container's real pixel width; styled by the scoped `.mgr-bc*` rules)
interface BalancePoint { year: number; balance: number; interest: number; label: string; }

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
  const interestLine = line('interest');
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

  const first = points[0];
  const last = points[points.length - 1];
  // The readout and the cursor are always visible: they follow the pointer / arrow keys, and rest on the payoff point.
  const active = idx !== null ? points[idx] : null;
  const shown = active ?? last;
  const whenLabel = shown.year === 0 ? 'Loan start' : shown.year === last.year ? `Year ${shown.year} · Payoff` : `Year ${shown.year} of ${last.year}`;
  const balLeftPct = first.balance > 0 ? Math.round(Math.min(100, Math.max(0, (shown.balance / first.balance) * 100))) : 0;
  const intPaidPct = last.interest > 0 ? Math.round(Math.min(100, Math.max(0, (shown.interest / last.interest) * 100))) : 0;

  return (
    <div className="mgr-bc__panel">
      <div className="mgr-bc__read" aria-live="polite">
        <div className="mgr-bc__rd mgr-bc__rd--when">
          <span className="mgr-bc__rk">{whenLabel}</span>
          <span className="mgr-bc__rv">{shown.label}</span>
          <span className="mgr-bc__rs">{shown.year === 0 ? 'Before the first payment' : shown.year === last.year ? 'Final payment' : 'End of this year'}</span>
        </div>
        <div className="mgr-bc__rd mgr-bc__rd--bal">
          <span className="mgr-bc__rk"><i />Balance left</span>
          <span className="mgr-bc__rv">{fmt(shown.balance)}</span>
          <span className="mgr-bc__rs">{balLeftPct}% of the loan</span>
          <span className="mgr-bc__rm" aria-hidden="true"><b style={{ width: `${balLeftPct}%` }} /></span>
        </div>
        <div className="mgr-bc__rd mgr-bc__rd--int">
          <span className="mgr-bc__rk"><i />Interest so far</span>
          <span className="mgr-bc__rv">{fmt(shown.interest)}</span>
          <span className="mgr-bc__rs">{intPaidPct}% of all interest</span>
          <span className="mgr-bc__rm" aria-hidden="true"><b style={{ width: `${intPaidPct}%` }} /></span>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="mgr-bc__chart"
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
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.14" />
              </linearGradient>
            </defs>

            {yTicks.map((t, i) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} strokeWidth="1" className="mgr-bc__grid" strokeDasharray={t === 0 ? undefined : '3 4'} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" className="mgr-bc__tick">{yLabels[i]}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={H - 10} textAnchor={t === 0 ? 'start' : t === xMax ? 'end' : 'middle'} fontSize="11" className="mgr-bc__tick">
                {t === 0 ? 'Start' : `Yr ${t}`}
              </text>
            ))}

            <path d={areaPath} fill={`url(#${gid}-area)`} className="mgr-bc__area" />
            <path d={balanceLine} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="mgr-bc__line" />
            <path d={interestLine} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="mgr-bc__line" />

            <g className={active ? undefined : 'mgr-bc__ends'}>
              <line x1={x(shown.year)} x2={x(shown.year)} y1={padT} y2={y(0)} strokeWidth="1" className="mgr-bc__cursor" />
              <circle cx={x(shown.year)} cy={y(shown.balance)} r="9" fill="#10b981" opacity="0.18" />
              <circle cx={x(shown.year)} cy={y(shown.interest)} r="9" fill="#f43f5e" opacity="0.18" />
              <circle cx={x(shown.year)} cy={y(shown.balance)} r="4.5" fill="#10b981" className="mgr-bc__dot" strokeWidth="2" />
              <circle cx={x(shown.year)} cy={y(shown.interest)} r="4.5" fill="#f43f5e" className="mgr-bc__dot" strokeWidth="2" />
            </g>
          </svg>
        ) : (
          <div style={{ height: H }} aria-hidden="true" />
        )}
      </div>

      <div className="mgr-bc__key" aria-hidden="true">
        <span><i style={{ background: '#10b981' }} />Remaining balance</span>
        <span><i style={{ background: '#f43f5e' }} />Interest paid so far</span>
      </div>
    </div>
  );
};

// "Balance Over Time": same card language as the Loan Summary and Where Your Money Goes (badge header, panel, insight callouts).
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
  const showInterest = last.interest > 0.004 && last.year > 0;

  return (
    <section className="mgr-sum mgr-bc" aria-label="Balance over time">
      <div className="mgr-sum__glow" aria-hidden="true" />
      <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
      <div className="mgr-sum__in">
        <div className="mgr-sum__head">
          <span className="mgr-badge" aria-hidden="true">
            <SafeIcon icon={FiTrendingDown} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h4 className="mgr-sum__title">
              Balance Over Time
              <InfoTip text={tip} />
            </h4>
            <p className="mgr-sum__sub">How the loan shrinks while interest adds up.</p>
          </div>
        </div>

        <div className="mgr-bc__body">
          <BalanceChart points={points} locale={locale} currency={currency} fmt={fmt} />
        </div>

        {(half || showInterest) && (
          <div className="mgr-insights">
            {half && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiTrendingDown} />
                </span>
                <span>
                  Your balance drops below half of the loan in <b>year {half.year}</b> ({half.label}), when about <b>{fmt(half.balance)}</b> is left.
                </span>
              </p>
            )}
            {showInterest && (
              <p className="mgr-insight" style={{ margin: 0 }}>
                <span className="mgr-insight__ic" aria-hidden="true">
                  <SafeIcon icon={FiPercent} />
                </span>
                <span>
                  Interest adds up to <b>{fmt(last.interest)}</b> by <b>{last.label}</b>, when the loan is paid off.
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

// --- SCHEDULE CSV --- (table only: every payment of the schedule, plain numbers so Excel / Sheets can calculate with them)
const downloadScheduleCsv = (r: MortgageResult): void => {
  const n2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '');
  const header = ['Payment #', 'Date', 'Loan year', 'Scheduled payment', 'Extra payment', 'Total paid', 'Principal (incl. extra)', 'Interest', 'Balance'];
  const lines = [header.join(',')];
  for (const row of r.schedule) {
    lines.push([
      row.period,
      row.date,
      row.loanYear,
      n2(row.payment),
      n2(row.extra),
      n2(row.payment + row.extra),
      n2(row.principal + row.extra),
      n2(row.interest),
      n2(row.balance),
    ].join(','));
  }
  // BOM so Excel reads it as UTF-8; CRLF line breaks for maximum compatibility.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mortgage-schedule-${r.region.toLowerCase()}-${Math.round(r.scheduledPayment)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      <ul className="mgr-ys__list">
        {visible.map((y) => {
          const isOpen = openYear === y.year;
          const rows = byYear.get(y.year) ?? [];
          const costs = y.propertyTax + y.insurance + y.pmi + y.hoa + y.other;
          const panelId = `${uid}-year-${y.year}`;
          return (
            <li key={y.year} className="mgr-ys__row" data-open={isOpen ? 'true' : 'false'}>
              <button
                type="button"
                onClick={() => setOpenYear(isOpen ? null : y.year)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="mgr-ys__btn"
              >
                <div className="mgr-ys__year">
                  <span className="mgr-ys__yn">Year {y.year}</span>
                  <span className="mgr-ys__yd">{formatMonthYear(y.startDate, loc)}</span>
                </div>
                <div className="mgr-ys__grid">
                  <MiniStat label="Paid" value={fmt0(y.payments)} className="mgr-ys__opt" />
                  <MiniStat label="Principal" value={fmt0(y.principal)} className="mgr-ys__opt" />
                  <MiniStat label="Interest" value={fmt0(y.interest)} />
                  <MiniStat label="Balance" value={fmt0(y.endBalance)} strong />
                </div>
                <span className="mgr-ys__chevron" aria-hidden="true">
                  <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
                </span>
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
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="mgr-ys__detail">
                      <div className="mgr-ys__dsummary">
                        <div className="mgr-ys__dstat"><span className="mgr-ys__dk">Paid this year</span><span className="mgr-ys__dv">{fmt0(y.payments)}</span></div>
                        <div className="mgr-ys__dstat"><span className="mgr-ys__dk">Principal</span><span className="mgr-ys__dv">{fmt0(y.principal)}</span></div>
                        <div className="mgr-ys__dstat"><span className="mgr-ys__dk">Interest</span><span className="mgr-ys__dv">{fmt0(y.interest)}</span></div>
                        {costs > 0.004 && <div className="mgr-ys__dstat"><span className="mgr-ys__dk">Taxes &amp; costs</span><span className="mgr-ys__dv">{fmt0(costs)}</span></div>}
                      </div>
                      <div className="mgr-ys__thead" aria-hidden="true">
                        <span>Date</span><span>Paid</span><span>Principal</span><span>Interest</span><span style={{ textAlign: 'right' }}>Balance</span>
                      </div>
                      <ul className="mgr-ys__payments">
                        {rows.map((row) => (
                          <li key={row.period} className="mgr-ys__payment">
                            <div className="mgr-ys__pmob">
                              <div className="mgr-ys__pmob-top">
                                <span>{rowDate(row.date)}</span>
                                <span>{fmt2(row.balance)}</span>
                              </div>
                              <p className="mgr-ys__pmob-sub">
                                Paid {fmt2(row.payment + row.extra)} · Principal {fmt2(row.principal + row.extra)} · Interest {fmt2(row.interest)}
                              </p>
                            </div>
                            <div className="mgr-ys__pdesk">
                              <span>{rowDate(row.date)}</span>
                              <span>{fmt2(row.payment + row.extra)}</span>
                              <span>{fmt2(row.principal + row.extra)}</span>
                              <span>{fmt2(row.interest)}</span>
                              <span>{fmt2(row.balance)}</span>
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
        <div className="mgr-ys__showmore">
          <button
            type="button"
            onClick={() => { setShowAll((s) => !s); setOpenYear(null); }}
          >
            {showAll ? 'Show fewer years' : `Show all ${years.length} years`}
            <SafeIcon icon={FiChevronDown} style={{ transform: showAll ? 'rotate(180deg)' : undefined }} />
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

// --- PMI TIMELINE (US) --- (renders its own card: violet header band with key figures, timeline bar, milestones)
const PmiTimeline: React.FC<{ result: MortgageResult; inputs: MortgageInputs; tip: string }> = ({ result: r, inputs, tip }) => {
  const reduced = useReducedMotion();
  const loc = r.locale;
  const fmt0 = (n: number) => formatMoney(n, loc, r.currency, 0);
  const fmt2 = (n: number) => formatMoney(n, loc, r.currency, 2);
  const p = r.pmi;

  const header = (
    <div className="mgr-pm__head">
      <span className="mgr-pm__badge" aria-hidden="true">
        <SafeIcon icon={FiShield} />
      </span>
      <div style={{ minWidth: 0 }}>
        <h4 className="mgr-pm__title">
          When PMI Ends
          <InfoTip text={tip} />
        </h4>
        <p className="mgr-pm__sub">Private mortgage insurance on a small down payment.</p>
      </div>
    </div>
  );

  if (!p.applies) {
    return (
      <section className="mgr-pm" aria-label="When PMI ends">
        <div className="mgr-pm__top">{header}</div>
        <div className="mgr-pm__body">
          <div className="mgr-insights">
            <p className="mgr-insight" style={{ margin: 0 }}>
              <span className="mgr-insight__ic" aria-hidden="true">
                <SafeIcon icon={FiCheckCircle} />
              </span>
              <span>
                No PMI is charged in this estimate. Your down payment is {r.downPaymentPct}% of the price (the loan is {r.ltvPct}% of the home value),
                and this calculator only adds PMI when the loan is more than 80% of the home value.
              </span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  const totalMonths = Math.max(1, Math.round(inputs.termYears * 12));
  const through = p.chargedThroughMonth ?? totalMonths;
  const pctOf = (m: number | null) => (m === null ? 0 : Math.min(100, Math.max(0, (m / totalMonths) * 100)));
  const label = (m: number | null) =>
    m === null ? 'Not reached' : `Month ${m} · ${loanMonthLabel(inputs.startYear, inputs.startMonth, m, loc)}`;
  const rule = inputs.pmi?.dropAt === 'auto78' ? '78% (automatic)' : '80% (on request)';
  const m80Pct = p.month80 !== null ? pctOf(p.month80) : null;
  const m80Align = m80Pct === null ? 'center' : m80Pct < 9 ? 'start' : m80Pct > 91 ? 'end' : 'center';
  const perMonthText = fmt2(r.firstPeriod.pmi);
  const throughText = `Month ${through}`;
  const totalText = fmt0(p.totalPaid);

  const steps: { k: string; v: string; tip: string; kind?: 'end' }[] = [
    { k: 'Balance reaches 80% of home value', v: label(p.month80), tip: 'You can usually ask your lender to remove PMI from this point.' },
    { k: 'Scheduled to reach 78% (automatic)', v: label(p.month78Scheduled), tip: 'On the original schedule, PMI should end automatically around here.' },
    ...(p.month78Actual !== null && p.month78Scheduled !== null && p.month78Actual < p.month78Scheduled
      ? [{ k: '78% reached with your extra payments', v: label(p.month78Actual), tip: '' }]
      : []),
    { k: `PMI ends in this estimate (${rule})`, v: label(p.chargedThroughMonth), tip: '', kind: 'end' },
  ];

  return (
    <section className="mgr-pm" aria-label="When PMI ends">
      <div className="mgr-pm__top">
        {header}
        <div className="mgr-pm__kpis">
          <div className="mgr-pm__kpi mgr-pm__kpi--main">
            <span className="mgr-pm__k">PMI per month</span>
            <AnimatedAmount value={r.firstPeriod.pmi} format={fmt2} className="mgr-pm__v" style={fitNumberStyle(perMonthText, 1.6, 1.05)} />
            <span className="mgr-pm__s">First payment</span>
          </div>
          <div className="mgr-pm__kpi">
            <span className="mgr-pm__k">PMI stops after</span>
            <span className="mgr-pm__v" style={fitNumberStyle(throughText, 1.45, 1.05)}>{throughText}</span>
            <span className="mgr-pm__s">{loanMonthLabel(inputs.startYear, inputs.startMonth, through, loc)}</span>
          </div>
          <div className="mgr-pm__kpi">
            <span className="mgr-pm__k">Total PMI paid</span>
            <span className="mgr-pm__v" style={fitNumberStyle(totalText, 1.45, 1.05)}>{totalText}</span>
            <span className="mgr-pm__s">Until PMI ends</span>
          </div>
        </div>
      </div>

      <div className="mgr-pm__body">
        <div className="mgr-pm__sech">
          <span className="mgr-pm__eyebrow">PMI timeline</span>
          <span className="mgr-pm__cap">Charged for the first {through} of {totalMonths} months</span>
        </div>

        {/* Timeline bar: violet = months you pay PMI */}
        <div className="mgr-pm__track" role="img" aria-label={`PMI is charged for the first ${through} of ${totalMonths} months`}>
          <motion.i
            className="mgr-pm__fill"
            style={{ width: `${pctOf(through)}%`, originX: 0 }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT }}
          />
          {m80Pct !== null && <span className="mgr-pm__tick" style={{ left: `${m80Pct}%` }} aria-hidden="true" />}
        </div>
        <div className="mgr-pm__marks" aria-hidden="true">
          {m80Pct !== null && (
            <span className={`mgr-pm__m80 mgr-pm__m80--${m80Align}`} style={{ left: `${m80Pct}%` }}>80%</span>
          )}
        </div>
        <div className="mgr-pm__ends">
          <span>Start</span><span>End of loan</span>
        </div>

        <ol className="mgr-pm__steps">
          {steps.map((row) => (
            <li key={row.k} className={`mgr-pm__step${row.kind ? ` mgr-pm__step--${row.kind}` : ''}`}>
              <span className="mgr-pm__node" aria-hidden="true">
                {row.kind === 'end' && <SafeIcon icon={FiCheck} />}
              </span>
              <span className="mgr-pm__sk">
                {row.k}
                {row.tip && <InfoTip text={row.tip} widthClass="w-56" />}
              </span>
              <span className="mgr-pm__sv">{row.v}</span>
            </li>
          ))}
        </ol>

        <p className="mgr-pm__fine">
          <SafeIcon icon={FiInfo} aria-hidden="true" />
          <span>An estimate only. Your lender&apos;s PMI terms decide the real end date, and some loan types work differently.</span>
        </p>
      </div>
    </section>
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

  // Max interest saved across non-baseline strategies — used to size the mini progress bar.
  const maxSaved = outcomes.reduce((m, o) => (o.id !== 'standard' && o.interestSaved > m ? o.interestSaved : m), 0);

  return (
    <div className="mgr-cp__body">
      <div className="mgr-cp__meta">
        {used.length > 0 ? (
          <>
            <span className="mgr-cp__hint">Comparing:</span>
            {used.map((u) => (
              <span key={u} className="mgr-cp__param">
                <SafeIcon icon={FiZap} aria-hidden="true" />
                {u}
              </span>
            ))}
            <span className="mgr-cp__hint">· Change in Extra payments above, then press Calculate.</span>
          </>
        ) : (
          <p className="mgr-cp__hint">Want more to compare? Add an extra monthly payment, a shorter term or a lump sum + recast in the Extra payments section above, then press Calculate again.</p>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-semibold text-red-500 flex items-center gap-1.5" style={{ marginTop: 12 }}>
          <SafeIcon icon={FiAlertCircle} className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </p>
      ) : (
        <ul className="mgr-cp__list">
          {outcomes.map((o, idx) => {
            const isBase = o.id === 'standard';
            const isBest = best?.id === o.id;
            const per = o.paymentsPerYear === 12 ? '/ mo' : '/ 2 wks';
            const saveValue = isBase ? 'Baseline' : o.interestSaved > 0.5 ? fmt0(o.interestSaved) : 'About the same';
            const saveSub = isBase ? undefined : o.monthsSaved >= 0.5 ? `${formatDuration(o.monthsSaved)} sooner` : 'Same payoff';
            const saveBarPct = !isBase && maxSaved > 0 && o.interestSaved > 0.5
              ? Math.round(Math.min(100, Math.max(2, (o.interestSaved / maxSaved) * 100)))
              : 0;
            return (
              <li key={o.id} className={`mgr-cp__card${isBest ? ' mgr-cp__card--best' : ''}`} data-id={o.id}>
                <span className="mgr-cp__accent-bar" aria-hidden="true" />
                <div className="mgr-cp__card-head">
                  <span className="mgr-cp__rank" aria-hidden="true">{idx + 1}</span>
                  <span className="mgr-cp__card-name">{o.label}</span>
                  {isBest && (
                    <span className="mgr-cp__best-badge">
                      <SafeIcon icon={FiZap} aria-hidden="true" />
                      Most interest saved
                    </span>
                  )}
                </div>
                <p className="mgr-cp__card-note">{o.note}</p>
                <div className="mgr-cp__stats">
                  <div className="mgr-cp__stat">
                    <span className="mgr-cp__sk">Payment</span>
                    <span className="mgr-cp__sv">{fmt2(o.payment)}</span>
                    <span className="mgr-cp__ss">{per}</span>
                  </div>
                  <div className="mgr-cp__stat">
                    <span className="mgr-cp__sk">Paid off</span>
                    <span className="mgr-cp__sv">{formatMonthYear(o.payoffDate, loc)}</span>
                    <span className="mgr-cp__ss">{formatDuration(o.payoffMonths)}</span>
                  </div>
                  <div className="mgr-cp__stat">
                    <span className="mgr-cp__sk">Total interest</span>
                    <span className="mgr-cp__sv">{fmt0(o.totalInterest)}</span>
                  </div>
                  <div className="mgr-cp__stat mgr-cp__stat--save">
                    <span className="mgr-cp__sk">You save</span>
                    <span className="mgr-cp__sv">{saveValue}</span>
                    {saveSub && <span className="mgr-cp__ss">{saveSub}</span>}
                    {saveBarPct > 0 && (
                      <span className="mgr-cp__savebar" aria-hidden="true">
                        <i style={{ width: `${saveBarPct}%` }} />
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mgr-cp__fine">
        Every option starts from the loan above and covers principal and interest only. Taxes, PMI, yearly and one-time
        extras, and other extra payment dates are left out; the extra monthly amount counts from the first payment, so comparisons are like-for-like. Lenders handle biweekly payments differently — treat these as estimates.
      </p>
    </div>
  );
};

// --- SOURCES ---
// The engine's MORTGAGE_SOURCES list is the base. The entries below replace its text and links with checked ones,
// so every link points to an official government page and every note is written in our own words.
// (Optional later: copy these entries back into mortgageLogic.ts and delete this override map.)
const SOURCE_OVERRIDES: Record<string, Partial<MortgageSource>> = {
  'amortization-formula': {
    title: 'CFPB, Regulation Z Appendix J: the actuarial method',
    url: 'https://www.consumerfinance.gov/rules-policy/regulations/1026/J/',
    note: 'US federal rule that describes how a loan balance works over time. Each period, interest is added to the balance and the payment is taken off. A level payment is the amount that brings the balance to zero by the last period.',
    status: 'verified',
  },
  'cfpb-pmi': {
    title: 'CFPB: When can I remove private mortgage insurance (PMI) from my loan?',
    url: 'https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/',
    note: 'Plain-language guidance from the US Consumer Financial Protection Bureau on when you can ask to end PMI and when it ends automatically.',
    status: 'verified',
  },
  'hpa-1998': {
    title: 'Homeowners Protection Act of 1998 (Public Law 105-216)',
    url: 'https://www.govinfo.gov/content/pkg/PLAW-105publ216/html/PLAW-105publ216.htm',
    note: 'US federal law behind the PMI timeline. You can ask to cancel PMI at 80% of the original value, and it ends automatically at 78%. The Act also ends PMI at the midpoint of the original term if you are current.',
    status: 'verified',
  },
  'canada-semi-annual': {
    title: 'Interest Act (Canada), section 6: interest on mortgages with blended payments',
    url: 'https://laws-lois.justice.gc.ca/eng/acts/I-15/FullText.html',
    note: 'The Act requires such a mortgage to state its rate calculated yearly or half-yearly, not in advance. Canadian fixed-rate mortgages are commonly quoted with semi-annual compounding, which is the method used here. Your lender\'s disclosure shows the method that applies to your loan.',
    status: 'verified',
  },
  'india-prepayment': {
    title: 'RBI (Pre-payment Charges on Loans) Directions, 2025',
    url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12878',
    note: 'Reserve Bank of India directions dated 2 July 2025 (RBI/2025-26/64). For loans sanctioned or renewed on or after 1 January 2026, lenders cannot charge prepayment fees on floating-rate loans to individuals for non-business purposes. Fixed-rate and older loans can differ, so check your sanction letter.',
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
      { key: 'hoa', label: 'HOA / fees', value: r.totals.hoa, color: '#d946ef' },
      { key: 'other', label: 'Other costs', value: r.totals.other, color: '#94a3b8' },
    ].filter((sl) => sl.value > 0.004);
    const ringTotal = ringSlices.reduce((a, sl) => a + sl.value, 0);
    const balancePoints: BalancePoint[] = [{ year: 0, balance: r.loanAmount, interest: 0, label: 'Loan start' }];
    let cumInterest = 0;
    r.yearly.forEach((yr) => {
      cumInterest += yr.interest;
      balancePoints.push({ year: yr.year, balance: yr.endBalance, interest: cumInterest, label: formatMonthYear(yr.endDate, loc) });
    });
    const totalText = fmt2(fp.total);
    const firstRow = r.schedule[0];
    const firstSplit = firstRow && firstRow.principal + firstRow.interest > 0
      ? { principal: Math.max(firstRow.principal, 0), interest: Math.max(firstRow.interest, 0) }
      : null;

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
        <PaymentHero
          value={r.scheduledPayment}
          format={fmt2}
          rateLabel={`${inputs.annualRatePct}%`}
          termLabel={`${inputs.termYears} ${inputs.termYears === 1 ? 'year' : 'years'}`}
          regionLabel={REGION_PROFILES[r.region].label}
          compounding={r.region === 'CA'}
          totalText={hasCostsInResult ? totalText : undefined}
          parts={hasCostsInResult ? parts : []}
          firstSplit={firstSplit}
          fmt2={fmt2}
        />

        {/* LOAN SUMMARY */}
        <LoanSummaryCard
          loanAmount={r.loanAmount}
          downPaymentAmount={r.downPaymentAmount}
          downPaymentPct={r.downPaymentPct}
          interest={r.totals.interest}
          totalPaid={r.totals.principalAndInterestPaid}
          payoffLabel={formatMonthYear(r.payoff.date, loc)}
          durationLabel={formatDuration(r.payoff.months)}
          startLabel={r.schedule.length > 0 ? formatMonthYear(r.schedule[0].date, loc) : undefined}
          fullCost={r.totals.outOfPocket - r.totals.principalAndInterestPaid > 0.004 ? r.totals.outOfPocket : undefined}
          warnings={r.warnings}
          tip="Totals cover the loan itself (principal and interest). Taxes and other costs you add are shown separately in the monthly total."
          fmt0={fmt0}
          fmt2={fmt2}
        />

        {/* EXTRA PAYMENT SAVINGS */}
        {r.savings && (
          <ExtraSavingsCard
            result={r}
            tip="Savings compare this loan with the same loan paid on schedule. Interest saved is what you no longer pay the lender."
          />
        )}

        {/* PMI TIMELINE (US only, when a PMI cost was entered) */}
        {inputs.region === 'US' && inputs.pmi && (
          <PmiTimeline
            result={r}
            inputs={inputs}
            tip="PMI is charged while your balance is high compared with the home's original value. Once it falls to 80% you can usually ask to drop it, and it should end automatically near 78%."
          />
        )}

        {/* BREAKDOWN RING */}
        <MoneyBreakdownCard
          slices={ringSlices}
          centerLabel="Total cost"
          centerValue={compactMoney(ringTotal, loc, cur)}
          fmt={fmt0}
          tip="Principal is the amount you borrow. Interest is the cost of borrowing it. Any taxes and costs you entered are included. Tap a row to highlight it."
        />

        {/* BALANCE CHART */}
        <BalanceOverTimeCard
          points={balancePoints}
          locale={loc}
          currency={cur}
          fmt={fmt0}
          tip="Early payments are mostly interest, so the balance falls slowly at first and faster later."
        />

        {/* COMPARE PANEL */}
        <section className="mgr-sum mgr-cp" aria-label="Compare ways to pay off faster">
          <div className="mgr-sum__glow" aria-hidden="true" />
          <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
          <div className="mgr-sum__in">
            <div className="mgr-sum__head">
              <span className="mgr-badge" aria-hidden="true">
                <SafeIcon icon={FiBarChart2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <h4 className="mgr-sum__title">
                  Compare Ways To Pay Off Faster
                  <InfoTip text="Half-monthly biweekly pays 13 monthly payments a year, so it finishes sooner. True biweekly keeps the same term. Set your extra payment, shorter term or recast in the Extra payments section above." />
                </h4>
                <p className="mgr-sum__sub">Extra payments, both biweekly styles, a shorter term and a recast, side by side.</p>
              </div>
            </div>
            <ComparePanel key={inputs.region} inputs={inputs} options={committed.compare} />
          </div>
        </section>

        {/* YEARLY SCHEDULE */}
        <section className="mgr-sum mgr-ys" aria-label="Payment schedule">
          <div className="mgr-sum__glow" aria-hidden="true" />
          <div className="mgr-sum__glow mgr-sum__glow--b" aria-hidden="true" />
          <div className="mgr-sum__in">
            <div className="mgr-sum__head">
              <span className="mgr-badge" aria-hidden="true">
                <SafeIcon icon={FiList} />
              </span>
              <div style={{ minWidth: 0 }}>
                <h4 className="mgr-sum__title">
                  Payment Schedule
                  <InfoTip text="Principal and interest only. Taxes and other costs are shown as a yearly total inside each year." />
                </h4>
                <p className="mgr-sum__sub">Year by year — tap a year to see each payment.</p>
              </div>
              <button
                type="button"
                className="mgr-ys__dl"
                onClick={() => downloadScheduleCsv(r)}
                aria-label={`Download the full payment schedule as a CSV file (${r.schedule.length} payments)`}
                title="Download table (CSV)"
              >
                <SafeIcon icon={FiDownload} aria-hidden="true" />
                <span className="mgr-ys__dl-t">Download table</span>
              </button>
            </div>
            <div className="mgr-ys__body">
              <YearlySchedule result={r} />
            </div>
          </div>
        </section>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <style>{selectOptionThemeCSS + MGR_CSS}</style>

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
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
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
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-500/30" aria-hidden="true">
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
            background: '#4f46e5',
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
          className="mgr-empty"
        >
          <span className="mgr-empty__icon" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <path d="M14 48 L50 18 L86 48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 42 V80 H76 V42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="42" y="56" width="16" height="24" rx="2" stroke="currentColor" strokeWidth="4" />
          </svg>
          </span>
          <h3 className="mgr-empty__title">
            Your Results Will Appear Here
          </h3>
          <p className="mgr-empty__text">
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
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> Estimates for planning and learning only. This is not financial, legal or tax advice, and not a loan offer or lender quote. The pre-filled rate is an example, not a current rate. Real payments depend on your lender&apos;s terms, rounding, fees and local rules, so please confirm the details with your lender or a qualified adviser.
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
              <p>
                Links go to official government pages. The notes above are written in our own words, and no text is copied from them.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MortgageCalculator;
