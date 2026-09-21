"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import {
  calculateBodyFat,
  getBodyFatRanges,
  validateBodyFatInput,
  validateCircumferences,
  BodyFatUnit,
  BodyFatGender,
  BODY_FAT_SOURCES,
} from '@/utils/calculators/bodyFatLogic';
import type { ShareableReport } from '@/lib/reports/types';

const { FiTarget, FiTrendingUp, FiAlertCircle, FiInfo, FiHeart, FiArrowDown, FiBarChart2, FiImage, FiFileText, FiLoader, FiRotateCcw, FiCheckCircle, FiExternalLink, FiChevronDown, FiDownload, FiShare2, FiMail, FiCopy, FiCheck, FiLayers, FiSliders } = FiIcons;

interface BodyFatCalculatorProps {
  onCalculationComplete?: () => void;
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- DYNAMIC PREMIUM COLOR MAPPER (same palette convention as BMICalculator) ---
const getCategoryColors = (category: string) => {
  switch (category) {
    case 'Essential fat': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500 dark:border-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', hex: '#3b82f6' };
    case 'Athletic': return { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500', border: 'border-teal-500 dark:border-teal-400', bgLight: 'bg-teal-50 dark:bg-teal-900/20', hex: '#14b8a6' };
    case 'Fit': return { text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500', border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', hex: '#10b981' };
    case 'Acceptable': return { text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500 dark:border-yellow-400', bgLight: 'bg-yellow-50 dark:bg-yellow-900/20', hex: '#eab308' };
    case 'Obese': return { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-500', border: 'border-red-500 dark:border-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', hex: '#ef4444' };
    default: return { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-500', border: 'border-neutral-500 dark:border-neutral-400', bgLight: 'bg-neutral-50 dark:bg-neutral-900/20', hex: '#737373' };
  }
};

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// --- ACCESSIBLE INFO TOOLTIP (identical pattern to BMICalculator's InfoTip) ---
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

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
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

// --- SEGMENTED TOGGLE (identical pattern to BMICalculator's SegmentedToggle) ---
interface SegmentedToggleOption<T extends string> { value: T; label: string; }
function SegmentedToggle<T extends string>({
  value, onChange, options, groupId, ariaLabel, size = 'md',
}: {
  value: T; onChange: (v: T) => void; options: SegmentedToggleOption<T>[]; groupId: string; ariaLabel: string; size?: 'sm' | 'md';
}) {
  const prefersReducedMotion = useReducedMotion();
  const isSm = size === 'sm';
  return (
    <div className={`relative inline-flex bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-700/50 rounded-full ${isSm ? 'p-1' : 'flex w-full p-1.5'}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-full transition-colors duration-150 cursor-pointer ${isSm ? 'px-3.5 py-1.5 text-xs' : 'flex-1 px-4 py-2.5 text-sm'} ${active ? 'text-white font-bold' : 'text-neutral-500 dark:text-neutral-400 font-semibold hover:text-neutral-700 dark:hover:text-neutral-200'}`}
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

// --- NUMBER FIELD (identical pattern to BMICalculator's NumberField) ---
const NumberField: React.FC<{
  id?: string; value: number | string; onChange: (v: string) => void; onBlur?: () => void; suffix: string;
  error?: boolean; min?: string; max?: string; placeholder?: string; ariaLabel?: string; disabled?: boolean;
}> = ({ id, value, onChange, onBlur, suffix, error, min, max, placeholder, ariaLabel, disabled }) => (
  <div className={`flex items-stretch w-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-150 bg-neutral-50 dark:bg-neutral-900/40 focus-within:ring-2 focus-within:ring-offset-0 ${disabled ? 'opacity-50' : ''} ${error ? 'border-red-300 dark:border-red-500/60 focus-within:ring-red-400/50 focus-within:border-red-400' : 'border-neutral-200 dark:border-neutral-700 focus-within:ring-indigo-400/50 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/60'}`}>
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
      disabled={disabled}
      className={`flex-1 min-w-0 w-full pl-4 pr-2 py-3 bg-transparent text-neutral-900 dark:text-white font-semibold placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal focus:outline-none disabled:cursor-not-allowed ${noSpinnerClass}`}
    />
    <span className="flex items-center flex-shrink-0 mr-1.5 my-1.5 px-2.5 rounded-lg text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-700/70 whitespace-nowrap">
      {suffix}
    </span>
  </div>
);

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

const BodyFatCalculator: React.FC<BodyFatCalculatorProps> = ({ onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null, onShare, onEmailShare, onCopyLink, linkCopied = false }) => {
  const prefersReducedMotion = useReducedMotion();

  // Personal details
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<BodyFatGender>('male');

  // Height / weight
  const [height, setHeight] = useState<number | string>('');
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');
  const [weight, setWeight] = useState<number | string>('');

  const [neck, setNeck] = useState<number | string>('');
  const [waist, setWaist] = useState<number | string>('');
  const [hip, setHip] = useState<number | string>('');

  // Single master unit toggle (top-right of the input card) drives
  // height, weight and circumference fields together — no more separate
  // per-field unit switches.
  const [unit, setUnit] = useState<BodyFatUnit>('imperial');
  const heightUnit = unit;
  const weightUnit = unit;
  const circumferenceUnit = unit;

  // --- CANONICAL (PRECISE, METRIC) SOURCE OF TRUTH ---
  // Display fields (height/weight/neck/waist/hip above) are rounded for a
  // clean UI, but rounding must never feed back into further conversions —
  // otherwise toggling units repeatedly drifts the value a little each time.
  // So the *true* measurement is kept here, in metric, at full precision,
  // updated only from what the user actually types. Unit toggles read from
  // these refs (never from the current, possibly-rounded, display state) to
  // recompute the display strings, so the underlying value never degrades.
  const heightCmRef = useRef<number | null>(null);
  const weightKgRef = useRef<number | null>(null);
  const neckCmRef = useRef<number | null>(null);
  const waistCmRef = useRef<number | null>(null);
  const hipCmRef = useRef<number | null>(null);

  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [primaryBodyFat, setPrimaryBodyFat] = useState(0);
  const [averageBodyFat, setAverageBodyFat] = useState(0);
  const [armyBodyFat, setArmyBodyFat] = useState(0);
  const [deurenbergBodyFat, setDeurenbergBodyFat] = useState(0);
  const [category, setCategory] = useState('');
  const [fatMassKg, setFatMassKg] = useState(0);
  const [leanMassKg, setLeanMassKg] = useState(0);
  const [confidenceNote, setConfidenceNote] = useState('');

  const [ageError, setAgeError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [circumferenceError, setCircumferenceError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => { if (downloadingFormat) setDownloadMenuOpen(false); }, [downloadingFormat]);

  const activeHeight = useMemo(() => {
    if (heightUnit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    return (ft * 12) + inc;
  }, [heightUnit, height, heightFt, heightIn]);

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight || !neck || !waist) return true;
    if (gender === 'female' && !hip) return true;
    if (heightUnit === 'metric' && !height) return true;
    if (heightUnit === 'imperial' && (!heightFt || !heightIn)) return true;
    return false;
  }, [age, weight, neck, waist, hip, gender, height, heightFt, heightIn, heightUnit]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !neck && !waist && !hip && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, neck, waist, hip, hasCalculated]);

  // Keep the canonical (metric, unrounded) refs in sync with whatever the
  // user actually types, converting once from the *current* display unit —
  // never from an already-rounded intermediate value.
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
  const syncCircCanonical = (v: string, ref: React.MutableRefObject<number | null>) => {
    const n = parseFloat(v);
    ref.current = Number.isNaN(n) ? null : (circumferenceUnit === 'metric' ? n : n * 2.54);
  };

  const resetCalculation = () => {
    setHasCalculated(false);
    setPrimaryBodyFat(0);
    setAverageBodyFat(0);
    setArmyBodyFat(0);
    setDeurenbergBodyFat(0);
    setCategory('');
    setFatMassKg(0);
    setLeanMassKg(0);
    setConfidenceNote('');
    setAgeError(null);
    setHeightError(null);
    setWeightError(null);
    setCircumferenceError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setAge('');
    setGender('male');
    setHeight(''); setHeightFt(''); setHeightIn('');
    setWeight('');
    setNeck(''); setWaist(''); setHip('');
    setUnit('imperial');
    heightCmRef.current = null;
    weightKgRef.current = null;
    neckCmRef.current = null;
    waistCmRef.current = null;
    hipCmRef.current = null;
    resetCalculation();
  };

  // Single master toggle — converts height, weight AND circumferences
  // together in one go, then flips the shared `unit` state once.
  //
  // Crucially, every value shown here is derived from the precise canonical
  // refs (metric, never rounded) rather than from the current display
  // state. If we instead re-converted from the previous rounded display
  // value each time, repeated toggling (imperial -> metric -> imperial...)
  // would compound rounding error and the calculated result would visibly
  // drift on every flip. Reading from the untouched canonical value means
  // toggling back and forth is always lossless — only the display rounds.
  const handleUnitToggle = (newUnit: BodyFatUnit) => {
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

    // Circumferences
    const displayCirc = (cm: number | null) => (cm === null ? '' : (newUnit === 'imperial' ? Math.round(cm / 2.54) : Math.round(cm)));
    setNeck(displayCirc(neckCmRef.current));
    setWaist(displayCirc(waistCmRef.current));
    if (hipCmRef.current !== null) setHip(displayCirc(hipCmRef.current));

    setUnit(newUnit);
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const w = parseFloat(weight.toString());
    const h = activeHeight;
    const a = parseInt(age.toString(), 10);

    let isValid = true;

    if (Number.isNaN(a) || a <= 0 || a > 130) {
      setAgeError('Please enter a realistic age.');
      isValid = false;
    } else {
      setAgeError(null);
    }

    const wKg = weightUnit === 'metric' ? w : w / 2.20462;
    const hCm = heightUnit === 'metric' ? h : h * 2.54;

    const validation = validateBodyFatInput(wKg, hCm, a, 'metric');
    if (!validation.isValid) {
      setWeightError(validation.error?.includes('weight') ? validation.error : null);
      setHeightError(validation.error?.includes('height') ? validation.error : null);
      isValid = false;
    } else {
      setWeightError(null);
      setHeightError(null);
    }

    const neckVal = parseFloat(neck.toString());
    const waistVal = parseFloat(waist.toString());
    const hipVal = gender === 'female' ? parseFloat(hip.toString()) : null;

    const circValidation = validateCircumferences(gender, neckVal, waistVal, hipVal, circumferenceUnit);
    if (!circValidation.isValid) {
      setCircumferenceError(circValidation.error ?? null);
      isValid = false;
    } else {
      setCircumferenceError(null);
    }

    if (!isValid) { setHasCalculated(false); return; }

    const bmi = wKg / Math.pow(hCm / 100, 2);

    const result = calculateBodyFat(wKg, hCm, a, gender, 'metric', bmi, neckVal, waistVal, hipVal, circumferenceUnit);

    setPrimaryBodyFat(result.primaryBodyFat);
    setAverageBodyFat(result.averageBodyFat);
    setArmyBodyFat(result.results.find((r) => r.formula === 'army')?.bodyFatPercent ?? 0);
    setDeurenbergBodyFat(result.results.find((r) => r.formula === 'deurenberg')?.bodyFatPercent ?? 0);
    setCategory(result.category);
    setFatMassKg(result.fatMassKg);
    setLeanMassKg(result.leanMassKg);
    setConfidenceNote(result.confidenceNote);
    setHasCalculated(true);

    onCalculationComplete?.();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = actionButtonsRef.current;
        if (!el) return;
        if (prefersReducedMotion) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        else slowScrollToElement(el, 1800);
      });
    });
  };

  const bodyFatRanges = getBodyFatRanges(gender);
  const currentColors = getCategoryColors(category);
  const hasError = Boolean(ageError || heightError || weightError || circumferenceError);

  const minScale = 0;
  const maxScale = gender === 'male' ? 35 : 45;
  const scaleRange = maxScale - minScale;

  // --- HORIZONTAL BAR GAUGE MATH ---
  // A third distinct shape language: a flat, segmented pill-shaped track
  // (no needle, no ring, no tube) with a floating diamond marker that
  // slides left-to-right to the current value's position.
  const bodyFatToPercent = useMemo(() => (val: number) => {
    const clamped = Math.min(Math.max(val, minScale), maxScale);
    return ((clamped - minScale) / scaleRange) * 100;
  }, [scaleRange, maxScale]);

  const markerPercent = useMemo(() => (!hasCalculated || hasError) ? 0 : bodyFatToPercent(primaryBodyFat), [hasCalculated, hasError, bodyFatToPercent, primaryBodyFat]);

  // Category bands don't start at 0 (e.g. "Essential fat" starts at 2%,
  // not the scale's 0%), so each segment's LEFT edge is chained to the
  // previous segment's right edge rather than its own range.min — this
  // guarantees the colored zones always sum to exactly 100% width with
  // no gap, regardless of how the category boundaries are defined.
  // Intermediate tick labels along the bar (10, 15, 20, 25, 30 for the
  // male 0–35 scale; extends the same every-5 pattern for the female
  // 0–45 scale). The 0% and max%+ endpoints are rendered separately.
  const tickValues = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 10; v <= maxScale - 5; v += 5) ticks.push(v);
    return ticks;
  }, [maxScale]);

  const gaugeSegments = useMemo(() => {
    let prevPercent = 0;
    return bodyFatRanges.map((range) => {
      const rightPercent = bodyFatToPercent(range.max);
      const widthPct = Math.max(0, rightPercent - prevPercent);
      prevPercent = rightPercent;
      return { category: range.category, widthPct, hex: getCategoryColors(range.category).hex };
    });
  }, [bodyFatRanges, bodyFatToPercent]);

  const springConfig = prefersReducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 50, damping: 12, mass: 0.8 };

  const unitsSummary = useMemo(() => {
    const units: BodyFatUnit[] = [heightUnit, weightUnit, circumferenceUnit];
    if (units.every((u) => u === 'metric')) return 'Metric Units';
    if (units.every((u) => u === 'imperial')) return 'Imperial Units';
    return 'Mixed Units';
  }, [heightUnit, weightUnit, circumferenceUnit]);

  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError) return null;
    const colors = getCategoryColors(category);
    const massUnit = weightUnit === 'metric' ? 'kg' : 'lbs';
    const toDisplayMass = (kg: number) => (weightUnit === 'metric' ? kg : kg * 2.20462).toFixed(1);

    const mainRows = [
      { label: 'US Navy Method', value: `${primaryBodyFat.toFixed(1)}%` },
      { label: 'US Army Method', value: `${armyBodyFat.toFixed(1)}%` },
      { label: 'BMI-Based (Deurenberg)', value: `${deurenbergBodyFat.toFixed(1)}%` },
      { label: 'Average Estimate', value: `${averageBodyFat.toFixed(1)}%` },
      { label: 'Fat Mass', value: `${toDisplayMass(fatMassKg)} ${massUnit}` },
      { label: 'Lean Mass', value: `${toDisplayMass(leanMassKg)} ${massUnit}` },
    ];

    const inputRows = [
      { label: 'Age', value: `${age} years` },
      { label: 'Biological Sex', value: gender === 'male' ? 'Male' : 'Female' },
      { label: 'Height', value: heightUnit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"` },
      { label: 'Weight', value: `${weight} ${weightUnit === 'metric' ? 'kg' : 'lbs'}` },
      { label: 'Neck', value: `${neck} ${circumferenceUnit === 'metric' ? 'cm' : 'in'}` },
      { label: 'Waist', value: `${waist} ${circumferenceUnit === 'metric' ? 'cm' : 'in'}` },
      ...(gender === 'female' ? [{ label: 'Hip', value: `${hip} ${circumferenceUnit === 'metric' ? 'cm' : 'in'}` }] : []),
    ];

    return {
      title: 'Body Fat Result',
      headlineValue: `${primaryBodyFat.toFixed(1)}%`,
      headlineLabel: category,
      accentColor: colors.hex,
      meta: ['US Navy Method', unitsSummary],
      sections: [{ heading: 'Key Results', rows: mainRows, variant: 'output' }],
      pdfOnlySections: [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }],
      disclaimer: 'Estimate only — not a diagnostic measurement or medical advice.',
      fileNameBase: `body-fat-result-${primaryBodyFat.toFixed(1)}`,
    };
  }, [hasCalculated, hasError, primaryBodyFat, armyBodyFat, deurenbergBodyFat, averageBodyFat, category, fatMassKg, leanMassKg, weightUnit, unitsSummary, age, gender, height, heightFt, heightIn, heightUnit, weight, neck, waist, hip, circumferenceUnit]);

  useEffect(() => { onReportChange?.(report); }, [report, onReportChange]);

  const renderDownloadButtons = () => (
    <div ref={downloadMenuRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setDownloadMenuOpen((o) => !o)}
        disabled={!report || downloadingFormat !== null}
        aria-haspopup="menu"
        aria-expanded={downloadMenuOpen}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all duration-200 active:scale-[0.97] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title={report ? "Download your result" : "Calculate a result first"}
      >
        <SafeIcon icon={downloadingFormat ? FiLoader : FiDownload} className={`w-3.5 h-3.5 flex-shrink-0 ${downloadingFormat ? 'animate-spin' : ''}`} />
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">{downloadingFormat ? 'Preparing…' : 'Download'}</span>
        <SafeIcon icon={FiChevronDown} className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${downloadMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {downloadMenuOpen && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden">
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('image'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400"><SafeIcon icon={FiImage} className="w-4 h-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PNG Image</span><span className="block text-xs text-neutral-400 mt-0.5">Quick shareable card</span></span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setDownloadMenuOpen(false); onDownloadReport?.('pdf'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-150 cursor-pointer border-t border-neutral-100 dark:border-neutral-700/50">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400"><SafeIcon icon={FiFileText} className="w-4 h-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-bold text-neutral-800 dark:text-neutral-100 leading-tight">PDF Report</span><span className="block text-xs text-neutral-400 mt-0.5">Complete paginated report</span></span>
          </button>
        </div>
      )}
    </div>
  );

  const renderShareBar = () => (
    <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4 pt-5 mt-5 border-t border-neutral-100 dark:border-neutral-800 text-center sm:text-right">
      <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">Like this? Please share</span>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => onShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer" title="Share this calculator">
          <SafeIcon icon={FiShare2} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onEmailShare?.()} className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-sm ring-1 ring-amber-100 dark:ring-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all duration-200 active:scale-95 cursor-pointer" title="Share via email">
          <SafeIcon icon={FiMail} className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onCopyLink?.()} className={`inline-flex items-center gap-1.5 pl-3.5 pr-4 h-10 rounded-full shadow-sm ring-1 transition-all duration-200 active:scale-95 cursor-pointer ${linkCopied ? 'bg-green-50 dark:bg-green-500/10 ring-green-100 dark:ring-green-800/40 text-green-500 dark:text-green-400' : 'bg-violet-50 dark:bg-violet-500/10 ring-violet-100 dark:ring-violet-800/40 text-violet-500 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20'}`} title="Copy link to this calculator">
          <SafeIcon icon={linkCopied ? FiCheck : FiCopy} className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">{linkCopied ? "Copied" : "Link"}</span>
        </button>
      </div>
    </div>
  );

  const toggleSources = () => {
    setShowSources((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => sourcesPanelRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' }), 50);
        setSourcesPulse(true);
        window.setTimeout(() => setSourcesPulse(false), 1600);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* INPUT CARD — unified bordered surface matching BMICalculator/BMRCalculator */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8 space-y-8">

          {/* Master unit toggle — converts height, weight & circumferences together */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Input Fields</h3>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                <SafeIcon icon={FiSliders} className="w-3 h-3" />
                Units
              </span>
              <SegmentedToggle groupId="bf-unit-system" size="sm" ariaLabel="Unit system" value={unit} onChange={(v) => handleUnitToggle(v as BodyFatUnit)} options={[{ value: 'imperial', label: 'Imperial' }, { value: 'metric', label: 'Metric' }]} />
            </div>
          </div>

          {/* Personal details */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Personal details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="bf-age-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Age</label>
                <NumberField id="bf-age-input" value={age} onChange={(v) => { setAge(v); resetCalculation(); }} suffix="years" error={!!ageError} min="1" max="130" placeholder="e.g. 29" />
                {ageError && <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 leading-tight"><SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />{ageError}</p>}
              </div>
              <div>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Biological Sex</span>
                <SegmentedToggle groupId="bf-sex" ariaLabel="Biological sex selection" value={gender} onChange={(v) => { setGender(v as BodyFatGender); resetCalculation(); }} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
              </div>
            </div>
          </div>

          {/* Height / weight */}
          <div>
            <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">Body measurements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="bf-height-input" className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5 block">Height</label>
                {heightUnit === 'metric' ? (
                  <NumberField id="bf-height-input" value={height} onChange={(v) => { setHeight(v); syncHeightCanonicalMetric(v); resetCalculation(); }} suffix="cm" error={!!heightError} min="30" max="300" placeholder="30-300" />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumberField id="bf-height-input" value={heightFt} onChange={(v) => { setHeightFt(v); syncHeightCanonicalImperial(v, heightIn.toString()); resetCalculation(); }} suffix="ft" error={!!heightError} min="1" max="9" placeholder="1-9" />
                    <NumberField value={heightIn} onChange={(v) => { setHeightIn(v); syncHeightCanonicalImperial(heightFt.toString(), v); resetCalculation(); }} suffix="in" error={!!heightError} min="0" max="11" placeholder="0-11" />
                  </div>
                )}
                {heightError && <p className="mt-2.5 text-sm font-medium text-red-500">{heightError}</p>}
              </div>
              <div>
                <label htmlFor="bf-weight-input" className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5 block">Weight</label>
                <NumberField id="bf-weight-input" value={weight} onChange={(v) => { setWeight(v); syncWeightCanonical(v); resetCalculation(); }} suffix={weightUnit === 'metric' ? 'kg' : 'lbs'} error={!!weightError} min={weightUnit === 'metric' ? '1' : '2'} max={weightUnit === 'metric' ? '500' : '1100'} placeholder={weightUnit === 'metric' ? '1-500' : '2-1100'} />
                {weightError && <p className="mt-2.5 text-sm font-medium text-red-500">{weightError}</p>}
              </div>
            </div>
          </div>

          {/* Circumferences — Navy method inputs */}
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400">Circumference measurements</h4>
              <InfoTip widthClass="w-64" text="Measure with a soft tape, snug but not compressing skin. Neck: below the larynx. Waist: at the navel. Hip: at the widest point." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label htmlFor="bf-neck-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Neck</label>
                <NumberField id="bf-neck-input" value={neck} onChange={(v) => { setNeck(v); syncCircCanonical(v, neckCmRef); resetCalculation(); }} suffix={circumferenceUnit === 'metric' ? 'cm' : 'in'} error={!!circumferenceError} placeholder={circumferenceUnit === 'metric' ? 'e.g. 39' : 'e.g. 15.5'} />
              </div>
              <div>
                <label htmlFor="bf-waist-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Waist</label>
                <NumberField id="bf-waist-input" value={waist} onChange={(v) => { setWaist(v); syncCircCanonical(v, waistCmRef); resetCalculation(); }} suffix={circumferenceUnit === 'metric' ? 'cm' : 'in'} error={!!circumferenceError} placeholder={circumferenceUnit === 'metric' ? 'e.g. 91' : 'e.g. 36'} />
              </div>
              <div>
                <label htmlFor="bf-hip-input" className={`text-sm font-medium mb-2 block ${gender === 'female' ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-600'}`}>
                  Hip {gender === 'male' && <span className="text-xs font-normal">(women only)</span>}
                </label>
                <NumberField id="bf-hip-input" value={hip} onChange={(v) => { setHip(v); syncCircCanonical(v, hipCmRef); resetCalculation(); }} suffix={circumferenceUnit === 'metric' ? 'cm' : 'in'} error={!!circumferenceError} disabled={gender === 'male'} placeholder={circumferenceUnit === 'metric' ? 'e.g. 99' : 'e.g. 39'} />
              </div>
            </div>
            {circumferenceError && <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-red-500"><SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />{circumferenceError}</p>}
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div ref={actionButtonsRef} className="flex flex-col-reverse md:flex-row justify-center items-center gap-4 pt-4">
        <button type="button" onClick={handleClear} disabled={isClearDisabled} className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          <SafeIcon icon={FiRotateCcw} className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-500 dark:group-hover:text-neutral-400 group-hover:-rotate-45 transition-all duration-200" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isCalculateDisabled}
          style={{ background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)', boxShadow: '0 10px 20px -6px rgba(79,70,229,0.45), 0 4px 8px -2px rgba(79,70,229,0.25)' }}
          className="group relative w-full md:w-auto inline-flex items-center justify-center gap-2 px-10 py-3.5 text-white text-sm font-semibold rounded-lg hover:brightness-[1.08] active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
          Calculate
        </button>
      </div>

      {/* EMPTY STATE */}
      {!hasCalculated && !hasError && (
        <motion.div initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <circle cx="50" cy="30" r="14" stroke="currentColor" strokeWidth="5" />
            <path d="M25 85 C25 60 35 50 50 50 C65 50 75 60 75 85" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <line x1="30" y1="65" x2="70" y2="65" stroke="currentColor" strokeWidth="4" strokeDasharray="3 5" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">Your Results Will Appear Here</h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Fill in your details and measurements above, then press Calculate to see your estimated body fat percentage.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {hasCalculated && !hasError && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pt-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Your Body Fat Results</h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">{renderDownloadButtons()}</div>
          </div>

          {/* Gauge card */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden flex flex-col items-center">
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 opacity-20 blur-[80px] rounded-full pointer-events-none transition-colors duration-700 ${currentColors.bg}`} />
            <div className="w-full flex justify-between items-center mb-6 z-10">
              <h3 className="text-lg md:text-xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">Body Fat Scale</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/50 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700">US Navy Method</span>
            </div>

            <div className="flex flex-col items-center mt-1 mb-7 z-10">
              <motion.span key={primaryBodyFat} initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm ${currentColors.text}`} aria-live="polite">
                {primaryBodyFat.toFixed(1)}%
              </motion.span>
              <span className={`text-sm font-bold uppercase tracking-[0.15em] mt-1 ${currentColors.text}`}>{category}</span>
            </div>

            <div className="relative w-full max-w-[440px] mx-auto z-10 pt-7 px-2">
              {/* Floating diamond marker, slides horizontally to the current value */}
              <motion.div
                initial={false}
                animate={{ left: `${markerPercent}%` }}
                transition={springConfig}
                style={{ transform: 'translateX(-50%)' }}
                className="absolute top-0 flex flex-col items-center"
              >
                <div className="w-4 h-4 rotate-45 rounded-[3px] shadow-md ring-2 ring-white dark:ring-neutral-900 transition-colors duration-700" style={{ backgroundColor: currentColors.hex }} />
                <div className="w-0.5 h-3 -mt-1 transition-colors duration-700" style={{ backgroundColor: currentColors.hex }} />
              </motion.div>

              {/* Segmented pill track — flush colored zones per category */}
              <div className="flex w-full h-4 rounded-full overflow-hidden shadow-inner border border-black/5 dark:border-white/10">
                {gaugeSegments.map((seg) => (
                  <div key={seg.category} style={{ width: `${seg.widthPct}%`, backgroundColor: seg.hex }} className="h-full transition-colors duration-700" />
                ))}
              </div>

              {/* Scale ticks + labels — every 5%, plus the two endpoints */}
              <div className="relative w-full h-2 mt-1.5">
                {tickValues.map((v) => (
                  <div key={v} className="absolute top-0 w-px h-2 bg-neutral-300 dark:bg-neutral-600" style={{ left: `${bodyFatToPercent(v)}%` }} />
                ))}
              </div>
              <div className="relative w-full h-4 mt-1 text-xs font-bold text-neutral-400 dark:text-neutral-500">
                <span className="absolute left-0">{minScale}%</span>
                {tickValues.map((v) => (
                  <span key={v} className="absolute -translate-x-1/2" style={{ left: `${bodyFatToPercent(v)}%` }}>{v}%</span>
                ))}
                <span className="absolute right-0">{maxScale}%+</span>
              </div>
            </div>
          </div>

          {/* Method comparison */}
          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-sm">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${currentColors.bg}`} />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-5">
                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiBarChart2} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Compare Methods</h3>
                  <p className="text-xs font-semibold text-neutral-400 mt-0.5">Three independent formulas, side by side</p>
                </div>
              </div>
              <div className="divide-y divide-neutral-200/70 dark:divide-neutral-700/50">
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">US Navy (circumference)</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white">{primaryBodyFat.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">US Army (abdominal)</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white">{armyBodyFat.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">BMI-based (Deurenberg)</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white">{deurenbergBodyFat.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className={`text-sm font-bold ${currentColors.text}`}>Average estimate</span>
                  <span className={`text-lg font-extrabold ${currentColors.text}`}>{averageBodyFat.toFixed(1)}%</span>
                </div>
              </div>
              <p className="text-xs font-normal text-neutral-500 dark:text-neutral-400 leading-relaxed mt-4 pt-4 border-t border-neutral-200/70 dark:border-neutral-700/50">
                {confidenceNote}
              </p>
            </div>
          </div>

          {/* Fat mass / lean mass */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/10 ${currentColors.bgLight} shadow-sm`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 ${currentColors.bg}`} />
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiTarget} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Fat Mass</h3>
                  <p className="text-xs font-semibold text-neutral-400">Estimated fat weight</p>
                </div>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {(weightUnit === 'metric' ? fatMassKg : fatMassKg * 2.20462).toFixed(1)}
                <span className="text-sm font-bold text-neutral-500 uppercase ml-2">{weightUnit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
            </div>
            <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/10 ${currentColors.bgLight} shadow-sm`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 ${currentColors.bg}`} />
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                  <SafeIcon icon={FiLayers} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Lean Mass</h3>
                  <p className="text-xs font-semibold text-neutral-400">Muscle, bone &amp; organs</p>
                </div>
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {(weightUnit === 'metric' ? leanMassKg : leanMassKg * 2.20462).toFixed(1)}
                <span className="text-sm font-bold text-neutral-500 uppercase ml-2">{weightUnit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
            </div>
          </div>

          {/* Classification table */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white">Classification ({gender === 'male' ? 'Men' : 'Women'})</h3>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {bodyFatRanges.map((range, index) => {
                const rowColors = getCategoryColors(range.category);
                const isActive = range.category === category;
                return (
                  <div key={index} className={`flex flex-col items-start gap-y-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 pl-6 pr-4 sm:pl-8 sm:pr-6 py-4 sm:py-5 relative transition-colors duration-300 ${isActive ? 'bg-neutral-50 dark:bg-neutral-700/20' : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50'}`}>
                    {isActive && <div className={`absolute left-0 top-0 w-1.5 h-full ${rowColors.bg}`} />}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                      <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full flex-shrink-0 ${rowColors.bg} shadow-sm`}></div>
                      <span className={`text-base sm:text-lg tracking-tight ${isActive ? 'font-black text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>{range.category}</span>
                      {isActive && <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${rowColors.hex}1A`, color: rowColors.hex }}>Your Result</span>}
                    </div>
                    <span className={`text-sm sm:text-base tracking-wide font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border whitespace-nowrap ${isActive ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 shadow-sm' : 'bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 dark:text-neutral-400 border-neutral-200/70 dark:border-neutral-700/50'}`}>
                      {range.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </motion.div>
      )}

      {renderShareBar()}

      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This body fat calculator provides an estimate, not a diagnostic measurement. Clinical methods (DEXA, hydrostatic weighing, Bod Pod) give more precise readings. Always consult a healthcare professional before altering your diet or exercise routine.
        </p>
      </div>

      <div ref={sourcesPanelRef} style={sourcesPulse ? { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' } : undefined} className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300">
        <button type="button" onClick={toggleSources} aria-expanded={showSources} className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources</span>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">{BODY_FAT_SOURCES.length} references — every formula used above, cited</span>
            </div>
          </div>
          <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${showSources ? 'rotate-180' : ''}`}>
            <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
          </span>
        </button>
        <motion.div initial={false} animate={{ height: showSources ? 'auto' : 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }} style={{ overflow: 'hidden' }} aria-hidden={!showSources}>
          <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
            <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {BODY_FAT_SOURCES.map((source, i) => (
                <li key={source.metric} className="flex gap-3 pt-4 first:pt-0 first:mt-0">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-800 dark:text-neutral-200">{source.metric}</p>
                    <p className="leading-relaxed mt-1 text-neutral-600 dark:text-neutral-400">{source.citation}</p>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="nofollow noopener noreferrer" tabIndex={showSources ? 0 : -1} className="group inline-flex items-center gap-1.5 mt-2.5 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold text-[13px]">
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
  );
};

export default BodyFatCalculator;
