"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import {
  calculateBodyFat,
  validateBodyFatInput,
  validateHipInput,
  validateNeckWaistRelationship,
  validateSkinfoldInput,
  getBodyFatCategory,
  getBodyFatCategories,
  getIdealBodyFatTarget,
  calculateWaistToHeightRatio,
  BODY_FAT_SOURCES,
  BodyFatUnit,
  BodyFatGender,
  BodyFatResult,
  SkinfoldSites3,
} from '@/utils/calculators/bodyFatLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiTarget, FiTrendingUp, FiAlertCircle, FiInfo, FiHeart, FiArrowDown, FiBarChart2,
  FiImage, FiFileText, FiLoader, FiRotateCcw, FiCheckCircle, FiExternalLink, FiPercent,
  FiLayers, FiMaximize2, FiShield, FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown,
  FiDownload, FiActivity, FiZap,
} = FiIcons;

interface BodyFatCalculatorProps {
  onCalculationComplete?: () => void;
  /** Fired whenever the current result changes — becomes null when there is
   * no shareable result (no calculation yet, or a validation error). */
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- DYNAMIC PREMIUM COLOR MAPPER (ACE body fat categories) ---
const getCategoryColors = (category: string) => {
  switch (category) {
    case 'Essential Fat':
      return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', grad: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800', border: 'border-indigo-500 dark:border-indigo-400', bgLight: 'bg-indigo-50 dark:bg-indigo-900/20', shadow: 'shadow-indigo-500/10', hex: '#4f46e5' };
    case 'Athletes':
      return { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500', grad: 'from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-200 dark:border-sky-800', border: 'border-sky-500 dark:border-sky-400', bgLight: 'bg-sky-50 dark:bg-sky-900/20', shadow: 'shadow-sky-500/10', hex: '#0ea5e9' };
    case 'Fitness':
      return { text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500', grad: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800', border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', shadow: 'shadow-green-500/10', hex: '#10b981' };
    case 'Average':
      return { text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-500', grad: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800', border: 'border-yellow-500 dark:border-yellow-400', bgLight: 'bg-yellow-50 dark:bg-yellow-900/20', shadow: 'shadow-yellow-500/10', hex: '#eab308' };
    case 'Obese':
      return { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-500', grad: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800', border: 'border-red-500 dark:border-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', shadow: 'shadow-red-500/10', hex: '#ef4444' };
    default:
      return { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-500', grad: 'from-neutral-50 to-neutral-100 dark:from-neutral-900/20 dark:to-neutral-800/20 border-neutral-200 dark:border-neutral-800', border: 'border-neutral-500 dark:border-neutral-400', bgLight: 'bg-neutral-50 dark:bg-neutral-900/20', shadow: 'shadow-neutral-500/10', hex: '#737373' };
  }
};

const METHOD_ACCENTS: Record<string, string> = {
  navy: '#4f46e5',
  bmi: '#0ea5e9',
  ymca: '#10b981',
  rfm: '#eab308',
  skinfold_jp3: '#ec4899',
};

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

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
      inputMode="decimal"
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

// --- MEASUREMENT GUIDANCE ---
const MEASUREMENT_TIPS: Record<'waist' | 'neck' | 'hip' | 'wrist', string> = {
  waist: 'Wrap the tape horizontally around your navel (men) or the narrowest point of your torso (women). Don\u2019t pull the tape tight or suck in your stomach.',
  neck: 'Measure just below the larynx (Adam\u2019s apple), with the tape sloping slightly downward toward the front.',
  hip: 'Measure around the widest point of your hips/glutes, keeping the tape level all the way around.',
  wrist: 'Measure around the wrist bone, just past the wrist crease. Used only by the YMCA method for women.',
};

const SKINFOLD_SITE_TIPS: Record<string, string> = {
  chest: 'A diagonal fold halfway between the armpit and nipple.',
  abdomen: 'A vertical fold about 2cm to the right of the navel.',
  thigh: 'A vertical fold on the front of the thigh, halfway between hip and knee.',
  triceps: 'A vertical fold on the back of the upper arm, halfway between shoulder and elbow.',
  suprailiac: 'A diagonal fold just above the hip bone (iliac crest).',
};

const BodyFatCalculator: React.FC<BodyFatCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // --- STATE ---
  const [gender, setGender] = useState<BodyFatGender>('male');
  const [unit, setUnit] = useState<BodyFatUnit>('imperial');
  const [advancedMode, setAdvancedMode] = useState(false);

  const [age, setAge] = useState<number | string>('');
  const [weight, setWeight] = useState<number | string>('');
  const [height, setHeight] = useState<number | string>('');
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');
  const [waist, setWaist] = useState<number | string>('');
  const [neck, setNeck] = useState<number | string>('');
  const [hip, setHip] = useState<number | string>('');
  const [wrist, setWrist] = useState<number | string>('');

  const [chest, setChest] = useState<number | string>('');
  const [abdomen, setAbdomen] = useState<number | string>('');
  const [thighM, setThighM] = useState<number | string>('');
  const [triceps, setTriceps] = useState<number | string>('');
  const [suprailiac, setSuprailiac] = useState<number | string>('');
  const [thighF, setThighF] = useState<number | string>('');

  // Prevents unit-toggle round-trip drift on height, same pattern as BMICalculator
  const preciseHeightCmRef = useRef<number | null>(null);
  const heightImperialEditedRef = useRef<boolean>(false);

  const [hasCalculated, setHasCalculated] = useState(false);
  const [result, setResult] = useState<BodyFatResult | null>(null);

  const [ageError, setAgeError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [waistError, setWaistError] = useState<string | null>(null);
  const [neckError, setNeckError] = useState<string | null>(null);
  const [hipError, setHipError] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [skinfoldError, setSkinfoldError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  const actionButtonsRef = useRef<HTMLDivElement | null>(null);
  const activeCategoryRowRef = useRef<HTMLDivElement | null>(null);
  const [categoryPulse, setCategoryPulse] = useState(false);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [downloadMenuOpen]);

  const resetCalculation = () => {
    setHasCalculated(false);
    setResult(null);
    onReportChange?.(null);
  };

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight || !waist || !neck) return true;
    if (unit === 'metric' && !height) return true;
    if (unit === 'imperial' && (!heightFt || !heightIn)) return true;
    if (gender === 'female' && !hip) return true;
    return false;
  }, [age, weight, waist, neck, unit, height, heightFt, heightIn, gender, hip]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !waist && !neck && !hip && !wrist && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, waist, neck, hip, wrist, hasCalculated]);

  const handleClear = () => {
    if (isClearDisabled) return;
    setGender('male');
    setUnit('imperial');
    setAdvancedMode(false);
    setAge(''); setWeight(''); setHeight(''); setHeightFt(''); setHeightIn('');
    setWaist(''); setNeck(''); setHip(''); setWrist('');
    setChest(''); setAbdomen(''); setThighM('');
    setTriceps(''); setSuprailiac(''); setThighF('');
    preciseHeightCmRef.current = null;
    heightImperialEditedRef.current = false;
    setAgeError(null); setWeightError(null); setHeightError(null); setWaistError(null);
    setNeckError(null); setHipError(null); setRelationshipError(null); setSkinfoldError(null);
    resetCalculation();
  };

  // Global unit toggle — converts every already-entered field to the new
  // unit rather than blanking the form, same intent as BMICalculator's
  // per-field toggles, applied here to one shared toggle since
  // bodyFatLogic's calculateBodyFat/validateBodyFatInput take a single
  // shared `unit` param across weight/height/waist/neck/hip/wrist.
  const handleUnitToggle = (newUnit: BodyFatUnit) => {
    if (newUnit === unit) return;
    resetCalculation();

    const kgToLbs = (v: number) => Math.round(v * 2.20462 * 10) / 10;
    const lbsToKg = (v: number) => Math.round((v / 2.20462) * 10) / 10;
    const cmToIn = (v: number) => Math.round((v / 2.54) * 10) / 10;
    const inToCm = (v: number) => Math.round(v * 2.54 * 10) / 10;

    const w = parseFloat(weight.toString());
    if (!Number.isNaN(w)) setWeight(newUnit === 'imperial' ? kgToLbs(w) : lbsToKg(w));

    const wa = parseFloat(waist.toString());
    if (!Number.isNaN(wa)) setWaist(newUnit === 'imperial' ? cmToIn(wa) : inToCm(wa));

    const ne = parseFloat(neck.toString());
    if (!Number.isNaN(ne)) setNeck(newUnit === 'imperial' ? cmToIn(ne) : inToCm(ne));

    const hi = parseFloat(hip.toString());
    if (!Number.isNaN(hi)) setHip(newUnit === 'imperial' ? cmToIn(hi) : inToCm(hi));

    const wr = parseFloat(wrist.toString());
    if (!Number.isNaN(wr)) setWrist(newUnit === 'imperial' ? cmToIn(wr) : inToCm(wr));

    if (newUnit === 'imperial') {
      const h = parseFloat(height.toString());
      if (!Number.isNaN(h)) {
        preciseHeightCmRef.current = h;
        heightImperialEditedRef.current = false;
        const totalInches = h / 2.54;
        let ft = Math.floor(totalInches / 12);
        let inch = Math.round(totalInches % 12);
        if (inch === 12) { inch = 0; ft += 1; }
        setHeightFt(ft);
        setHeightIn(inch);
      }
    } else {
      const ft = parseFloat(heightFt.toString());
      const inc = parseFloat(heightIn.toString());
      if (!Number.isNaN(ft) && !Number.isNaN(inc)) {
        if (!heightImperialEditedRef.current && preciseHeightCmRef.current !== null) {
          setHeight(preciseHeightCmRef.current);
        } else {
          const totalInches = (ft * 12) + inc;
          const cm = Math.round(totalInches * 2.54);
          setHeight(cm);
          preciseHeightCmRef.current = cm;
        }
        heightImperialEditedRef.current = false;
      }
    }

    setUnit(newUnit);
  };

  const handleAgeBlur = () => {
    const raw = age.toString().trim();
    if (raw === '') { setAgeError(null); return; }
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && !Number.isNaN(n) && (n < 15 || n > 100)) {
      setAgeError('Please enter an age between 15 and 100.');
    } else {
      setAgeError(null);
    }
  };

  const activeHeight = unit === 'imperial'
    ? (parseFloat(heightFt.toString()) || 0) * 12 + (parseFloat(heightIn.toString()) || 0)
    : parseFloat(height.toString());

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    let isValid = true;

    const a = parseInt(age.toString(), 10);
    if (Number.isNaN(a) || a < 15 || a > 100) {
      setAgeError('Please enter an age between 15 and 100.');
      isValid = false;
    } else {
      setAgeError(null);
    }

    const w = parseFloat(weight.toString());
    const h = activeHeight;
    const wa = parseFloat(waist.toString());
    const ne = parseFloat(neck.toString());
    const hi = gender === 'female' ? parseFloat(hip.toString()) : undefined;
    const wr = gender === 'female' ? parseFloat(wrist.toString()) : undefined;

    const wLimits = unit === 'metric' ? { min: 1, max: 500, label: 'kg' } : { min: 2, max: 1100, label: 'lbs' };
    const hLimits = unit === 'metric' ? { min: 30, max: 300, label: 'cm' } : { min: 12, max: 118, label: 'in' };
    const cLimits = unit === 'metric' ? { min: 15, max: 200, label: 'cm' } : { min: 6, max: 80, label: 'in' };

    const weightInvalid = !Number.isFinite(w) || Number.isNaN(w) || w <= 0 || w < wLimits.min || w > wLimits.max;
    const heightInvalid = !Number.isFinite(h) || Number.isNaN(h) || h <= 0 || h < hLimits.min || h > hLimits.max;
    const waistInvalid = !Number.isFinite(wa) || Number.isNaN(wa) || wa <= 0 || wa < cLimits.min || wa > cLimits.max;
    const neckInvalid = !Number.isFinite(ne) || Number.isNaN(ne) || ne <= 0 || ne < cLimits.min || ne > cLimits.max;

    setWeightError(weightInvalid ? `Weight must be between ${wLimits.min}-${wLimits.max} ${wLimits.label}.` : null);
    setHeightError(heightInvalid ? `Height must be between ${hLimits.min}-${hLimits.max} ${hLimits.label}.` : null);
    setWaistError(waistInvalid ? `Waist must be between ${cLimits.min}-${cLimits.max} ${cLimits.label}.` : null);
    setNeckError(neckInvalid ? `Neck must be between ${cLimits.min}-${cLimits.max} ${cLimits.label}.` : null);
    if (weightInvalid || heightInvalid || waistInvalid || neckInvalid) isValid = false;

    if (gender === 'female') {
      const hipInvalid = hi === undefined || !Number.isFinite(hi) || Number.isNaN(hi) || hi <= 0 || hi < cLimits.min || hi > cLimits.max;
      setHipError(hipInvalid ? `Hip must be between ${cLimits.min}-${cLimits.max} ${cLimits.label}.` : null);
      if (hipInvalid) isValid = false;
    } else {
      setHipError(null);
    }

    if (!isValid) {
      setHasCalculated(false);
      setRelationshipError(null);
      return;
    }

    const relCheck = validateNeckWaistRelationship(wa, ne, gender, hi);
    if (!relCheck.isValid) {
      setRelationshipError(relCheck.error ?? null);
      setHasCalculated(false);
      return;
    }
    setRelationshipError(null);

    let skinfoldSites: SkinfoldSites3 | undefined;
    if (advancedMode) {
      const site1 = parseFloat((gender === 'male' ? chest : triceps).toString());
      const site2 = parseFloat((gender === 'male' ? abdomen : suprailiac).toString());
      const site3 = parseFloat((gender === 'male' ? thighM : thighF).toString());
      let skinfoldOk = true;
      for (const v of [site1, site2, site3]) {
        const check = validateSkinfoldInput(v);
        if (!check.isValid) {
          setSkinfoldError(check.error ?? 'Please enter valid skinfold measurements (2-100mm).');
          skinfoldOk = false;
          break;
        }
      }
      if (!skinfoldOk) { setHasCalculated(false); return; }
      setSkinfoldError(null);
      skinfoldSites = { site1Mm: site1, site2Mm: site2, site3Mm: site3 };
    } else {
      setSkinfoldError(null);
    }

    // BMI (needed only for the BMI-based method) — computed inline rather
    // than pulling in the full bmiLogic module, since only the raw ratio
    // is needed here, not category/region logic.
    const heightM = unit === 'metric' ? h / 100 : h * 0.0254;
    const weightKgForBmi = unit === 'metric' ? w : w / 2.20462;
    const bmi = weightKgForBmi / (heightM * heightM);

    const computed = calculateBodyFat(w, h, wa, ne, a, bmi, gender, unit, hi, wr, skinfoldSites);
    setResult(computed);
    setHasCalculated(true);
    onCalculationComplete?.();

    const category = getBodyFatCategory(computed.primaryBodyFat, gender);
    const colors = getCategoryColors(category);
    const idealTarget = getIdealBodyFatTarget(computed.primaryBodyFat, unit === 'metric' ? w : w / 2.20462, gender);

    const report: ShareableReport = {
      title: 'BODY FAT RESULT',
      headlineValue: `${computed.primaryBodyFat.toFixed(1)}%`,
      headlineLabel: category,
      accentColor: colors.hex,
      meta: [gender === 'male' ? 'Male' : 'Female', unit === 'metric' ? 'Metric Units' : 'Imperial Units'],
      sections: [
        {
          heading: 'Result Summary',
          rows: [
            { label: 'Body Fat (U.S. Navy Method)', value: `${computed.primaryBodyFat.toFixed(1)}%` },
            { label: 'Category', value: category },
            { label: 'Fat Mass', value: `${computed.fatMassKg.toFixed(1)} ${unit === 'metric' ? 'kg' : 'lbs'}` },
            { label: 'Lean Mass', value: `${computed.leanMassKg.toFixed(1)} ${unit === 'metric' ? 'kg' : 'lbs'}` },
          ],
        },
        {
          heading: 'All Methods',
          rows: computed.results.map((r) => ({ label: r.label, value: `${r.bodyFatPercent.toFixed(1)}%` })),
        },
        {
          heading: 'Goal',
          rows: idealTarget.fatToLoseKg > 0
            ? [{ label: `Fat to lose for ${idealTarget.targetCategory}`, value: `${idealTarget.fatToLoseKg.toFixed(1)} ${unit === 'metric' ? 'kg' : 'lbs'}` }]
            : [{ label: 'Status', value: `Already within the ${idealTarget.targetCategory} range` }],
        },
      ],
      pdfOnlySections: [
        {
          heading: 'Your Inputs',
          rows: [
            { label: 'Age', value: `${a}` },
            { label: 'Biological Sex', value: gender === 'male' ? 'Male' : 'Female' },
            { label: 'Weight', value: `${w} ${unit === 'metric' ? 'kg' : 'lbs'}` },
            { label: 'Height', value: unit === 'metric' ? `${h} cm` : `${Math.floor(h / 12)}'${Math.round(h % 12)}"` },
            { label: 'Waist', value: `${wa} ${unit === 'metric' ? 'cm' : 'in'}` },
            { label: 'Neck', value: `${ne} ${unit === 'metric' ? 'cm' : 'in'}` },
            ...(gender === 'female' && hi ? [{ label: 'Hip', value: `${hi} ${unit === 'metric' ? 'cm' : 'in'}` }] : []),
          ],
        },
      ],
      disclaimer: 'For informational purposes only — not medical advice.',
      fileNameBase: 'body-fat-result',
    };
    onReportChange?.(report);

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

  const hasError = Boolean(ageError || weightError || heightError || waistError || neckError || hipError || relationshipError || skinfoldError);

  const category = result ? getBodyFatCategory(result.primaryBodyFat, gender) : '';
  const currentColors = getCategoryColors(category);
  const categoryBands = useMemo(() => getBodyFatCategories(gender), [gender]);

  const idealTarget = useMemo(() => {
    if (!result) return null;
    const w = parseFloat(weight.toString());
    const weightKg = unit === 'metric' ? w : w / 2.20462;
    return getIdealBodyFatTarget(result.primaryBodyFat, weightKg, gender);
  }, [result, weight, unit, gender]);

  const whtr = useMemo(() => {
    if (!result) return null;
    const h = activeHeight;
    const wa = parseFloat(waist.toString());
    const heightCm = unit === 'metric' ? h : h * 2.54;
    const waistCm = unit === 'metric' ? wa : wa * 2.54;
    return calculateWaistToHeightRatio(waistCm, heightCm);
  }, [result, activeHeight, waist, unit]);

  const activeRangeIndex = useMemo(() => {
    if (!result) return -1;
    return categoryBands.findIndex((b) => b.category === category);
  }, [categoryBands, category, result]);

  // --- GAUGE MATH (semicircular scale, same construction as BMICalculator's
  // speedometer — arc segments per category band, needle at the Navy-method
  // value). Scale is gender-specific since ACE band widths differ by sex.
  const minScale = 0;
  const maxScale = gender === 'male' ? 35 : 40;
  const scaleRange = maxScale - minScale;

  const valueToAngle = useMemo(() => (val: number) => {
    const clamped = Math.min(Math.max(val, minScale), maxScale);
    return ((clamped - minScale) / scaleRange) * 180;
  }, [maxScale, scaleRange]);

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

  const needleAngle = useMemo(
    () => (!result || hasError ? -90 : valueToAngle(result.primaryBodyFat) - 90),
    [result, hasError, valueToAngle]
  );

  const springConfig = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 50, damping: 12, mass: 0.8 };

  const handleJumpToCategory = () => {
    activeCategoryRowRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    setCategoryPulse(true);
    window.setTimeout(() => setCategoryPulse(false), prefersReducedMotion ? 1100 : 2600);
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

  return (
    <div className="space-y-5">
      {/* INPUT CARD — unified bordered/shadowed surface matching BMI/BMR */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">

          {/* About you — Gender + Age */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400">About you</h4>
              <SegmentedToggle
                groupId="bf-unit"
                ariaLabel="Unit system"
                size="sm"
                value={unit}
                onChange={(v) => handleUnitToggle(v)}
                options={[{ value: 'imperial', label: 'Imperial' }, { value: 'metric', label: 'Metric' }]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Biological Sex</label>
                <SegmentedToggle
                  groupId="bf-gender"
                  ariaLabel="Biological sex"
                  value={gender}
                  onChange={(v) => { setGender(v); resetCalculation(); }}
                  options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                />
              </div>
              <div>
                <label htmlFor="bf-age-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Age</label>
                <NumberField
                  id="bf-age-input"
                  value={age}
                  onChange={(v) => { setAge(v); resetCalculation(); }}
                  onBlur={handleAgeBlur}
                  suffix="yrs"
                  error={!!ageError}
                  ariaLabel="Age"
                  placeholder="e.g. 30"
                />
                {ageError && <p className="text-xs font-semibold text-red-500 mt-1.5">{ageError}</p>}
              </div>
            </div>
          </div>

          {/* Body measurements */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Body measurements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Weight</label>
                <NumberField
                  value={weight}
                  onChange={(v) => { setWeight(v); resetCalculation(); }}
                  suffix={unit === 'metric' ? 'kg' : 'lbs'}
                  error={!!weightError}
                  ariaLabel="Weight"
                  placeholder={unit === 'metric' ? 'e.g. 75' : 'e.g. 165'}
                />
                {weightError && <p className="text-xs font-semibold text-red-500 mt-1.5">{weightError}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Height</label>
                {unit === 'metric' ? (
                  <NumberField
                    value={height}
                    onChange={(v) => { setHeight(v); resetCalculation(); }}
                    suffix="cm"
                    error={!!heightError}
                    ariaLabel="Height"
                    placeholder="e.g. 175"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumberField
                      value={heightFt}
                      onChange={(v) => { setHeightFt(v); heightImperialEditedRef.current = true; resetCalculation(); }}
                      suffix="ft"
                      error={!!heightError}
                      ariaLabel="Height (feet)"
                      placeholder="5"
                    />
                    <NumberField
                      value={heightIn}
                      onChange={(v) => { setHeightIn(v); heightImperialEditedRef.current = true; resetCalculation(); }}
                      suffix="in"
                      error={!!heightError}
                      ariaLabel="Height (inches)"
                      placeholder="9"
                    />
                  </div>
                )}
                {heightError && <p className="text-xs font-semibold text-red-500 mt-1.5">{heightError}</p>}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Neck</label>
                  <InfoTip text={MEASUREMENT_TIPS.neck} />
                </div>
                <NumberField
                  value={neck}
                  onChange={(v) => { setNeck(v); resetCalculation(); }}
                  suffix={unit === 'metric' ? 'cm' : 'in'}
                  error={!!neckError}
                  ariaLabel="Neck circumference"
                  placeholder={unit === 'metric' ? 'e.g. 38' : 'e.g. 15'}
                />
                {neckError && <p className="text-xs font-semibold text-red-500 mt-1.5">{neckError}</p>}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Waist</label>
                  <InfoTip text={MEASUREMENT_TIPS.waist} />
                </div>
                <NumberField
                  value={waist}
                  onChange={(v) => { setWaist(v); resetCalculation(); }}
                  suffix={unit === 'metric' ? 'cm' : 'in'}
                  error={!!waistError}
                  ariaLabel="Waist circumference"
                  placeholder={unit === 'metric' ? 'e.g. 85' : 'e.g. 33'}
                />
                {waistError && <p className="text-xs font-semibold text-red-500 mt-1.5">{waistError}</p>}
              </div>

              {gender === 'female' && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Hip</label>
                    <InfoTip text={MEASUREMENT_TIPS.hip} />
                  </div>
                  <NumberField
                    value={hip}
                    onChange={(v) => { setHip(v); resetCalculation(); }}
                    suffix={unit === 'metric' ? 'cm' : 'in'}
                    error={!!hipError}
                    ariaLabel="Hip circumference"
                    placeholder={unit === 'metric' ? 'e.g. 98' : 'e.g. 38'}
                  />
                  {hipError && <p className="text-xs font-semibold text-red-500 mt-1.5">{hipError}</p>}
                </div>
              )}

              {gender === 'female' && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Wrist</label>
                    <InfoTip text={MEASUREMENT_TIPS.wrist} />
                  </div>
                  <NumberField
                    value={wrist}
                    onChange={(v) => { setWrist(v); resetCalculation(); }}
                    suffix={unit === 'metric' ? 'cm' : 'in'}
                    ariaLabel="Wrist circumference"
                    placeholder={unit === 'metric' ? 'e.g. 16' : 'e.g. 6.3'}
                  />
                  <p className="text-xs font-medium text-neutral-400 mt-1.5">Used by the YMCA method only.</p>
                </div>
              )}
            </div>

            {relationshipError && (
              <div className="flex items-start gap-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mt-5">
                <SafeIcon icon={FiAlertCircle} className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{relationshipError}</span>
              </div>
            )}
          </div>

          {/* Advanced Mode — skinfold */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedMode((v) => !v)}
              className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer group"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                <SafeIcon icon={FiLayers} className="w-3.5 h-3.5" />
              </span>
              {advancedMode ? 'Hide Advanced Mode (Skinfold Calipers)' : 'Advanced Mode: Add Skinfold Measurements'}
              <SafeIcon icon={FiChevronDown} className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${advancedMode ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {advancedMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-5">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed max-w-2xl">
                      Enter 3-site caliper measurements (mm) for a Jackson-Pollock skinfold estimate — the most direct method here if you have calipers on hand.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {gender === 'male' ? (
                        <>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Chest</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.chest} />
                            </div>
                            <NumberField value={chest} onChange={(v) => { setChest(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Chest skinfold" placeholder="e.g. 12" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Abdomen</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.abdomen} />
                            </div>
                            <NumberField value={abdomen} onChange={(v) => { setAbdomen(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Abdomen skinfold" placeholder="e.g. 18" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Thigh</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.thigh} />
                            </div>
                            <NumberField value={thighM} onChange={(v) => { setThighM(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Thigh skinfold" placeholder="e.g. 15" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Triceps</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.triceps} />
                            </div>
                            <NumberField value={triceps} onChange={(v) => { setTriceps(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Triceps skinfold" placeholder="e.g. 16" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Suprailiac</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.suprailiac} />
                            </div>
                            <NumberField value={suprailiac} onChange={(v) => { setSuprailiac(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Suprailiac skinfold" placeholder="e.g. 14" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Thigh</label>
                              <InfoTip text={SKINFOLD_SITE_TIPS.thigh} />
                            </div>
                            <NumberField value={thighF} onChange={(v) => { setThighF(v); resetCalculation(); }} suffix="mm" error={!!skinfoldError} ariaLabel="Thigh skinfold" placeholder="e.g. 20" />
                          </div>
                        </>
                      )}
                    </div>
                    {skinfoldError && (
                      <div className="flex items-start gap-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mt-4">
                        <SafeIcon icon={FiAlertCircle} className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{skinfoldError}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      <p className="text-xs font-medium text-neutral-400 text-right px-1">* Advanced Mode is optional — the four methods above it already produce a full result.</p>

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
          Calculate Body Fat
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
            Fill in your measurements above, then press Calculate to see your personalized body composition results.
          </p>
        </motion.div>
      )}

      {/* RESULTS SECTIONS */}
      {hasCalculated && !hasError && result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 pt-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight leading-snug">
              Your Body Fat Results
            </h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {renderDownloadButtons()}
            </div>
          </div>

          {/* Gauge headline card */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden flex flex-col items-center">
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 opacity-20 blur-[80px] rounded-full pointer-events-none transition-colors duration-700 ${currentColors.bg}`} />

            <div className="w-full flex justify-between items-center mb-6 z-10">
              <h3 className="text-lg md:text-xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">Body Fat (U.S. Navy Method)</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/50 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                ACE Reference
              </span>
            </div>

            <div className="relative w-full max-w-[360px] mx-auto z-10">
              <svg viewBox="0 0 400 220" className="w-full h-auto overflow-visible filter drop-shadow-sm" aria-hidden="true">
                <path d={describeArc(200, 180, 150, 0, 180)} fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" className="text-neutral-100 dark:text-neutral-700/50" />

                {categoryBands.map((band, i) => {
                  const startAngle = valueToAngle(band.min);
                  const endAngle = valueToAngle(Math.min(band.max, maxScale));
                  const segmentColors = getCategoryColors(band.category);
                  return (
                    <path
                      key={band.category}
                      d={describeArc(200, 180, 150, startAngle, endAngle - (i === categoryBands.length - 1 ? 0 : 1.5))}
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
                  key={result.primaryBodyFat}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm ${currentColors.text}`}
                  aria-live="polite"
                >
                  {result.primaryBodyFat.toFixed(1)}%
                </motion.span>
                <span className={`text-sm font-bold uppercase tracking-[0.15em] mt-1 ${currentColors.text}`}>
                  {category}
                </span>
                <button
                  type="button"
                  onClick={handleJumpToCategory}
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
                  See in Reference Table
                </button>
              </div>
            </div>

            {result.essentialFatWarning && (
              <div className="w-full flex items-start gap-2 mt-6 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 z-10">
                <SafeIcon icon={FiAlertCircle} className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{result.essentialFatWarning}</span>
              </div>
            )}
          </div>

          {/* Quick stats — consolidated single card, matching BMI's Additional Metrics treatment */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-5 sm:p-6 md:p-8">
            <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-5">Additional Metrics</h3>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  <SafeIcon icon={FiZap} className="w-4 h-4 text-neutral-400" /> Fat Mass
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{result.fatMassKg.toFixed(1)} {unit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  <SafeIcon icon={FiActivity} className="w-4 h-4 text-neutral-400" /> Lean Mass
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{result.leanMassKg.toFixed(1)} {unit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  <SafeIcon icon={FiBarChart2} className="w-4 h-4 text-neutral-400" /> Average (All Methods)
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{result.averageBodyFat.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  <SafeIcon icon={FiMaximize2} className="w-4 h-4 text-neutral-400" /> Waist-to-Height
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {whtr ? whtr.ratio.toFixed(2) : '—'} <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 ml-1">{whtr?.category}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Confidence / agreement card — colored left accent stripe */}
          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md group">
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-300 ${currentColors.bg}`} />
            <div className="relative z-10 flex flex-col md:flex-row items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                <SafeIcon icon={FiBarChart2} className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Method Agreement</h3>
                <p className={`font-extrabold text-base ${currentColors.text} mb-1`}>{result.confidenceVerdict}</p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal text-[15px] md:text-base">
                  {result.confidenceNote}
                </p>
              </div>
            </div>
          </div>

          {/* All Methods comparison — horizontal bars scaled to the same gauge axis */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-5 sm:p-6 md:p-8">
            <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <SafeIcon icon={FiBarChart2} className="w-4 h-4" /> All Methods
            </h3>
            <div className="space-y-5">
              {result.results.map((r) => {
                const pct = Math.min(Math.max((r.bodyFatPercent / maxScale) * 100, 2), 100);
                const accent = METHOD_ACCENTS[r.method] ?? '#737373';
                return (
                  <div key={r.method}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                        {r.label}
                        {r.isPrimary && (
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accent}1A`, color: accent }}>
                            Primary
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">{r.bodyFatPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-700/60 leading-relaxed">
              The Navy Method is used as the headline figure above; the others are shown for context and cross-checking.
            </p>
          </div>

          {/* Goal card */}
          {idealTarget && (
            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md group">
              <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-300 ${idealTarget.fatToLoseKg > 0 ? 'bg-indigo-500' : 'bg-green-500'}`} />
              <div className="relative z-10 flex flex-col md:flex-row items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${idealTarget.fatToLoseKg > 0 ? 'text-indigo-500 dark:text-indigo-400' : 'text-green-500 dark:text-green-400'}`}>
                  <SafeIcon icon={idealTarget.fatToLoseKg > 0 ? FiArrowDown : FiCheckCircle} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Goal</h3>
                  {idealTarget.fatToLoseKg > 0 ? (
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal text-[15px] md:text-base">
                      Losing approximately <strong className="text-neutral-900 dark:text-white font-extrabold">{idealTarget.fatToLoseKg.toFixed(1)} {unit === 'metric' ? 'kg' : 'lbs'}</strong> of fat — with lean mass held constant, as a simplifying estimate — would bring you into the <strong className="text-neutral-900 dark:text-white">{idealTarget.targetCategory}</strong> range ({idealTarget.targetPercent}% or under).
                    </p>
                  ) : (
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal text-[15px] md:text-base">
                      You're already within the <strong className="text-neutral-900 dark:text-white">{idealTarget.targetCategory}</strong> range ({idealTarget.targetPercent}% or under) — nice work maintaining it.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Category reference table */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-5 sm:p-6 md:p-8">
            <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-5 flex items-center gap-2">
              <SafeIcon icon={FiPercent} className="w-4 h-4" /> {gender === 'male' ? 'Men' : 'Women'} — ACE Reference Ranges
            </h3>
            <div className="space-y-2">
              {categoryBands.map((band, i) => {
                const rowColors = getCategoryColors(band.category);
                const isActive = i === activeRangeIndex;
                return (
                  <motion.div
                    key={band.category}
                    ref={isActive ? activeCategoryRowRef : undefined}
                    animate={isActive && categoryPulse ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                    style={isActive && categoryPulse ? { boxShadow: `0 0 0 3px ${rowColors.hex}59` } : undefined}
                    className={`flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 rounded-xl transition-colors duration-300 ${isActive ? rowColors.bgLight : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${rowColors.bg} shadow-sm`}></div>
                      <span className={`text-sm sm:text-base tracking-tight ${isActive ? 'font-black text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>
                        {band.category}
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
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap ${
                      isActive
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 dark:text-neutral-400 border-neutral-200/70 dark:border-neutral-700/50'
                    }`}>
                      {band.min}–{band.max >= 100 ? `${band.max === 100 ? band.min : band.max}+` : `${band.max}%`}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {renderShareBar()}

          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
            <p className="leading-normal">
              <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator provides estimates for general informational purposes, not medical advice or a diagnostic measurement. Circumference- and BMI-based methods are estimates, not direct measurements of body fat — DXA, hydrostatic weighing, or a BodPod scan are the accepted clinical gold standards. Always consult a healthcare professional before making decisions based on these results.
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
                    {BODY_FAT_SOURCES.length} references — every formula and threshold used above, cited
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
                  {BODY_FAT_SOURCES.map((source, i) => (
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
        </motion.div>
      )}
    </div>
  );
};

export default BodyFatCalculator;
