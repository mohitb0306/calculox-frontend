"use client";

import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import {
  calculateWHR,
  getWHRVerdict,
  isWHRGuarded,
  getWHRGuardMessage,
  isWHRUnusual,
  getWaistCircumferenceRisk,
  getSouthAsianWaistRisk,
  getWaistToHeightRatio,
  getBMIWHRComparison,
  getWaistChangeThresholds,
  getWaistChangeMessage,
  getWHRScalePosition,
  validateWHRInput,
  validateWHRAge,
  validateWHROptionalHeight,
  validateWHROptionalWeight,
  toCm,
  fromCm,
  WHR_SCALE_TICKS,
  WHR_TAPE_ERROR_OPTIONS,
  DEFAULT_TAPE_ERROR_CM,
  WHR_SOURCES,
  WHRCircumferenceUnit,
  WHRMeasurementUnit,
  WHRGender,
  WHRReference,
  WHRStatus,
} from '@/utils/calculators/whrLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiInfo, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiRotateCcw, FiChevronDown,
  FiDownload, FiImage, FiFileText, FiLoader, FiShare2, FiMail, FiCopy, FiCheck,
  FiArrowDown, FiExternalLink, FiActivity, FiLayers, FiTrendingDown, FiHeart, FiX, FiMaximize2,
} = FiIcons;

interface WHRCalculatorProps {
  onCalculationComplete?: () => void;
  onReportChange?: (report: ShareableReport | null) => void;
  onDownloadReport?: (format: 'image' | 'pdf') => void;
  downloadingFormat?: 'image' | 'pdf' | null;
  onShare?: () => void;
  onEmailShare?: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
}

// --- STATUS COLOR MAPPER (same palette convention as BMICalculator/BodyFatCalculator) ---
const getStatusColors = (status: WHRStatus | 'neutral') => {
  switch (status) {
    case 'below':
      return { text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500', border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', hex: '#10b981' };
    case 'border':
      return { text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500 dark:border-yellow-400', bgLight: 'bg-yellow-50 dark:bg-yellow-900/20', hex: '#eab308' };
    case 'above':
      return { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-500', border: 'border-red-500 dark:border-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', hex: '#ef4444' };
    default:
      return { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-500', border: 'border-neutral-500 dark:border-neutral-400', bgLight: 'bg-neutral-50 dark:bg-neutral-900/20', hex: '#737373' };
  }
};

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// Native <select> theming — identical approach to BMICalculator's region dropdown.
const whrSelectOptionThemeCSS = `
  .whr-native-select option {
    background-color: #ffffff;
    color: #262626;
  }
  .dark .whr-native-select option {
    background-color: #262626;
    color: #f5f5f5;
  }
`;

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
    <span ref={wrapperRef} className="relative inline-flex flex-shrink-0">
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

// --- STATUS PILL (mockup's .pill) ---
const StatusPill: React.FC<{ tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }> = ({ tone, children }) => {
  const toneClass =
    tone === 'ok' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-green-100 dark:ring-green-800/40'
    : tone === 'warn' ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ring-yellow-100 dark:ring-yellow-800/40'
    : tone === 'bad' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 ring-red-100 dark:ring-red-800/40'
    : 'bg-neutral-100 dark:bg-neutral-900/50 text-neutral-600 dark:text-neutral-300 ring-neutral-200 dark:ring-neutral-700';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-[13px] font-bold ring-1 whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  );
};

// --- MODAL (portal-based, same overlay pattern as InfoTip's createPortal use) ---
const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({
  open, onClose, title, children,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-2xl p-5 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <SafeIcon icon={FiX} className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body
  );
};

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

/** Snapshot of the numbers at the moment Calculate was pressed. Kept in cm so the
 *  logic module always receives one consistent unit, exactly as whrLogic expects. */
interface WHRSnapshot {
  waistCm: number;
  hipCm: number;
  unit: WHRCircumferenceUnit;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: WHRGender;
  isPregnant: boolean;
}

const WHRCalculator: React.FC<WHRCalculatorProps> = ({ onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null, onShare, onEmailShare, onCopyLink, linkCopied = false }) => {
  const prefersReducedMotion = useReducedMotion();

  // About you
  const [gender, setGender] = useState<WHRGender>('male');
  const [age, setAge] = useState<number | string>('');
  const [reference, setReference] = useState<WHRReference>('global');
  const [isPregnant, setIsPregnant] = useState<boolean>(false);

  // Measurements (waist + hip share one unit, as in the mockup)
  const [unit, setUnit] = useState<WHRCircumferenceUnit>('cm');
  const [waist, setWaist] = useState<number | string>('');
  const [hip, setHip] = useState<number | string>('');

  // Optional height / weight
  const [height, setHeight] = useState<number | string>('');
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');
  const [heightUnit, setHeightUnit] = useState<WHRMeasurementUnit>('metric');
  const [weight, setWeight] = useState<number | string>('');
  const [weightUnit, setWeightUnit] = useState<WHRMeasurementUnit>('metric');

  // Assumed tape error — re-reads the result live, no need to press Calculate again
  const [tapeErrorCm, setTapeErrorCm] = useState<number>(DEFAULT_TAPE_ERROR_CM);

  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<WHRSnapshot | null>(null);

  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [weightError, setWeightError] = useState<string | null>(null);

  const [showSources, setShowSources] = useState<boolean>(false);
  const sourcesPanelRef = useRef<HTMLDivElement | null>(null);
  const [sourcesPulse, setSourcesPulse] = useState<boolean>(false);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonsRef = useRef<HTMLDivElement | null>(null);
  const optionalSectionRef = useRef<HTMLDivElement | null>(null);

  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

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

  // Height typed in the active unit: cm when metric, total inches when imperial.
  const activeHeight = useMemo(() => {
    if (heightUnit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    const total = (ft * 12) + inc;
    return total || 0;
  }, [heightUnit, height, heightFt, heightIn]);

  const isCalculateDisabled = useMemo(() => !waist || !hip, [waist, hip]);

  const isClearDisabled = useMemo(
    () => !waist && !hip && !age && !height && !heightFt && !heightIn && !weight && !isPregnant && !hasCalculated,
    [waist, hip, age, height, heightFt, heightIn, weight, isPregnant, hasCalculated]
  );

  const resetCalculation = () => {
    setHasCalculated(false);
    setSnapshot(null);
    setMeasurementError(null);
    setAgeError(null);
    setHeightError(null);
    setWeightError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setGender('male');
    setAge('');
    setReference('global');
    setIsPregnant(false);
    setUnit('cm');
    setWaist(''); setHip('');
    setHeight(''); setHeightFt(''); setHeightIn(''); setWeight('');
    setHeightUnit('metric'); setWeightUnit('metric');
    setTapeErrorCm(DEFAULT_TAPE_ERROR_CM);
    resetCalculation();
  };

  // Converting waist/hip on a unit switch mirrors the mockup's behaviour.
  const handleCircumferenceUnitToggle = (newUnit: WHRCircumferenceUnit) => {
    if (newUnit === unit) return;
    resetCalculation();
    const convert = (v: number | string) => {
      const n = parseFloat(v.toString());
      if (Number.isNaN(n) || n <= 0) return '';
      return Math.round(newUnit === 'in' ? n / 2.54 : n * 2.54);
    };
    setWaist(convert(waist));
    setHip(convert(hip));
    setUnit(newUnit);
  };

  const handleHeightUnitToggle = (newUnit: WHRMeasurementUnit) => {
    if (newUnit === heightUnit) return;
    resetCalculation();
    if (newUnit === 'imperial') {
      const h = parseFloat(height.toString());
      if (!Number.isNaN(h)) {
        const totalInches = h / 2.54;
        let ft = Math.floor(totalInches / 12);
        let inch = Math.round(totalInches % 12);
        if (inch === 12) { inch = 0; ft += 1; }
        setHeightFt(ft); setHeightIn(inch);
      }
    } else {
      const ft = parseFloat(heightFt.toString());
      const inc = parseFloat(heightIn.toString());
      if (!Number.isNaN(ft) && !Number.isNaN(inc)) {
        setHeight(Math.round(((ft * 12) + inc) * 2.54));
      }
    }
    setHeightUnit(newUnit);
  };

  const handleWeightUnitToggle = (newUnit: WHRMeasurementUnit) => {
    if (newUnit === weightUnit) return;
    resetCalculation();
    const w = parseFloat(weight.toString());
    if (!Number.isNaN(w)) setWeight(newUnit === 'imperial' ? Math.round(w * 2.20462) : Math.round(w / 2.20462));
    setWeightUnit(newUnit);
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const waistVal = parseFloat(waist.toString());
    const hipVal = parseFloat(hip.toString());
    let isValid = true;

    const measurementValidation = validateWHRInput(waistVal, hipVal, unit);
    if (!measurementValidation.isValid) {
      setMeasurementError(measurementValidation.error ?? null);
      isValid = false;
    } else {
      setMeasurementError(null);
    }

    const ageRaw = age.toString().trim();
    const ageVal = ageRaw === '' ? null : parseFloat(ageRaw);
    const ageValidation = validateWHRAge(ageVal);
    if (!ageValidation.isValid) {
      setAgeError(ageValidation.error ?? null);
      isValid = false;
    } else {
      setAgeError(null);
    }

    const heightProvided = activeHeight > 0;
    const heightValidation = validateWHROptionalHeight(heightProvided ? activeHeight : null, heightUnit);
    if (!heightValidation.isValid) {
      setHeightError(heightValidation.error ?? null);
      isValid = false;
    } else {
      setHeightError(null);
    }

    const weightRaw = weight.toString().trim();
    const weightVal = weightRaw === '' ? null : parseFloat(weightRaw);
    const weightValidation = validateWHROptionalWeight(weightVal, weightUnit);
    if (!weightValidation.isValid) {
      setWeightError(weightValidation.error ?? null);
      isValid = false;
    } else {
      setWeightError(null);
    }

    if (!isValid) { setHasCalculated(false); setSnapshot(null); return; }

    const heightCm = heightProvided ? (heightUnit === 'metric' ? activeHeight : activeHeight * 2.54) : null;
    const weightKg = weightVal !== null && weightVal > 0 ? (weightUnit === 'metric' ? weightVal : weightVal / 2.20462) : null;

    setSnapshot({
      waistCm: toCm(waistVal, unit),
      hipCm: toCm(hipVal, unit),
      unit,
      age: ageVal !== null && !Number.isNaN(ageVal) ? ageVal : null,
      heightCm,
      weightKg,
      gender,
      isPregnant: gender === 'female' ? isPregnant : false,
    });
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

  // --- DERIVED RESULTS ---
  // Everything below comes from whrLogic.ts. The tape-error dropdown and the
  // Global/India toggle feed straight in here, so both re-read the result live
  // without the person pressing Calculate again (same as the mockup).
  const results = useMemo(() => {
    if (!hasCalculated || !snapshot) return null;

    const whrResult = calculateWHR(snapshot.waistCm, snapshot.hipCm, 'cm', snapshot.gender, tapeErrorCm);
    const guarded = isWHRGuarded(snapshot.isPregnant, snapshot.age);
    const guardMessage = guarded ? getWHRGuardMessage(snapshot.isPregnant) : null;
    const verdict = getWHRVerdict(snapshot.gender, whrResult.status, whrResult.cutoff);
    const unusual = isWHRUnusual(whrResult.whr);

    const waistRisk = getWaistCircumferenceRisk(snapshot.waistCm, snapshot.gender);
    const southAsian = reference === 'india' ? getSouthAsianWaistRisk(snapshot.waistCm, snapshot.gender) : null;
    const whtr = snapshot.heightCm ? getWaistToHeightRatio(snapshot.waistCm, snapshot.heightCm) : null;

    const bmi = snapshot.heightCm && snapshot.weightKg
      ? snapshot.weightKg / Math.pow(snapshot.heightCm / 100, 2)
      : null;
    const comparison = bmi !== null
      ? getBMIWHRComparison(bmi, whrResult.status, reference)
      : null;

    const changes = getWaistChangeThresholds(
      snapshot.hipCm,
      snapshot.waistCm,
      whrResult.cutoff,
      whrResult.marginOfError,
      whrResult.status
    );
    const changeMessage = getWaistChangeMessage(whrResult.status, snapshot.waistCm, whrResult.cutoff, changes, snapshot.unit);

    return { whrResult, guarded, guardMessage, verdict, unusual, waistRisk, southAsian, whtr, bmi, comparison, changes, changeMessage };
  }, [hasCalculated, snapshot, tapeErrorCm, reference]);

  const hasError = Boolean(measurementError || ageError || heightError || weightError);
  const displayUnit: WHRCircumferenceUnit = snapshot?.unit ?? unit;
  const unitName = displayUnit === 'cm' ? 'cm' : 'in';

  /** Converts a cm value from whrLogic into the unit the person is actually using. */
  const showLen = (valueCm: number) => fromCm(valueCm, displayUnit).toFixed(1);

  const currentColors = getStatusColors(results && !results.guarded ? results.whrResult.status : 'neutral');

  const unitsSummary = useMemo(() => {
    const parts: string[] = [unit === 'cm' ? 'metric' : 'imperial'];
    if (activeHeight > 0) parts.push(heightUnit);
    if (weight) parts.push(weightUnit);
    if (parts.every((p) => p === 'metric')) return 'Metric Units';
    if (parts.every((p) => p === 'imperial')) return 'Imperial Units';
    return 'Mixed Units';
  }, [unit, heightUnit, weightUnit, activeHeight, weight]);

  // --- SHAREABLE REPORT (same wiring as BodyFatCalculator) ---
  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || !results || !snapshot || results.guarded) return null;

    const { whrResult, verdict, waistRisk, southAsian, whtr, bmi } = results;
    const colors = getStatusColors(whrResult.status);

    const mainRows: Array<{ label: string; value: string }> = [
      { label: 'Waist-to-Hip Ratio', value: whrResult.whr.toFixed(2) },
      { label: 'WHO Cut-off', value: `${whrResult.cutoff.toFixed(2)} (${snapshot.gender === 'male' ? 'men' : 'women'})` },
      { label: 'Range Allowing for Measuring Slip', value: `${whrResult.rangeLow.toFixed(2)} \u2013 ${whrResult.rangeHigh.toFixed(2)} (\u00b1${fromCm(tapeErrorCm, displayUnit).toFixed(1)} ${unitName} per measurement)` },
      { label: 'Verdict', value: verdict.chipLabel },
    ];

    const waistRows: Array<{ label: string; value: string }> = [
      { label: 'Waist Circumference', value: `${showLen(snapshot.waistCm)} ${unitName} \u2014 ${waistRisk.label}` },
    ];
    if (southAsian) {
      waistRows.push({
        label: 'South Asian Waist Check',
        value: southAsian.atOrAbove ? `At or above ${showLen(southAsian.thresholdCm)} ${unitName}` : `Below ${showLen(southAsian.thresholdCm)} ${unitName}`,
      });
    }
    if (whtr) {
      waistRows.push({
        label: 'Waist-to-Height Ratio',
        value: `${whtr.whtr.toFixed(2)} (${whtr.aboveBoundary ? 'above' : 'under'} ${whtr.boundary.toFixed(2)})`,
      });
    }
    if (bmi !== null && results.comparison) {
      waistRows.push({ label: 'BMI', value: `${bmi.toFixed(1)} \u2014 ${results.comparison.bmiCategory} (${results.comparison.bandLabel})` });
    }

    const sections: ShareableReport['sections'] = [
      { heading: 'Key Results', rows: mainRows, variant: 'output' },
      { heading: 'Waist Checks', rows: waistRows, variant: 'output' },
    ];

    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Biological Sex', value: snapshot.gender === 'male' ? 'Male' : 'Female' },
      ...(snapshot.age !== null ? [{ label: 'Age', value: `${snapshot.age} years` }] : []),
      { label: 'Reference Values', value: reference === 'india' ? 'India (South Asian)' : 'Global (WHO)' },
      { label: 'Waist', value: `${showLen(snapshot.waistCm)} ${unitName}` },
      { label: 'Hip', value: `${showLen(snapshot.hipCm)} ${unitName}` },
      ...(snapshot.heightCm ? [{ label: 'Height', value: heightUnit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"` }] : []),
      ...(snapshot.weightKg ? [{ label: 'Weight', value: `${weight} ${weightUnit === 'metric' ? 'kg' : 'lbs'}` }] : []),
      { label: 'Measuring Accuracy Allowed', value: `\u00b1${fromCm(tapeErrorCm, displayUnit).toFixed(1)} ${unitName} per measurement` },
    ];

    return {
      title: 'Waist-to-Hip Ratio Result',
      headlineValue: whrResult.whr.toFixed(2),
      headlineLabel: verdict.chipLabel,
      accentColor: colors.hex,
      meta: [`WHO cut-off ${whrResult.cutoff.toFixed(2)}`, unitsSummary],
      sections,
      pdfOnlySections: [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }],
      disclaimer: 'Screening estimate only \u2014 not a diagnosis or medical advice.',
      fileNameBase: `waist-to-hip-ratio-${whrResult.whr.toFixed(2)}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCalculated, hasError, results, snapshot, reference, tapeErrorCm, unitsSummary, unitName, displayUnit, height, heightFt, heightIn, heightUnit, weight, weightUnit]);

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

  // --- LINEAR SCALE (replaces the semicircle gauge: the tape-error band needs a straight axis) ---
  const renderScale = () => {
    if (!results || results.guarded) return null;
    const { whr, cutoff, rangeLow, rangeHigh } = results.whrResult;

    const pinPos = getWHRScalePosition(whr);
    const cutPos = getWHRScalePosition(cutoff);
    const lowPos = getWHRScalePosition(rangeLow);
    const highPos = getWHRScalePosition(rangeHigh);
    const labelPos = Math.min(94, Math.max(6, pinPos));

    const ariaLabel = `Ratio ${whr.toFixed(2)} on a scale from 0.60 to 1.10. WHO cut-off ${cutoff.toFixed(2)}. Range with tape error ${rangeLow.toFixed(2)} to ${rangeHigh.toFixed(2)}.`;

    return (
      <div className="w-full mt-8">
        <div className="relative pt-10" role="img" aria-label={ariaLabel}>
          {/* Track */}
          <div className="relative h-3.5 rounded-full bg-neutral-100 dark:bg-neutral-900/60">
            <div className="absolute left-0 top-0 bottom-0 rounded-l-full bg-green-200 dark:bg-green-900/60" style={{ width: `${cutPos}%` }} />
            <div className="absolute right-0 top-0 bottom-0 rounded-r-full bg-red-200 dark:bg-red-900/50" style={{ left: `${cutPos}%` }} />

            {/* Tape-error band */}
            <div
              className="absolute -top-1.5 -bottom-1.5 rounded-lg border-2 border-indigo-500 dark:border-indigo-400 bg-indigo-500/15 dark:bg-indigo-400/20"
              style={{ left: `${lowPos}%`, width: `${Math.max(1, highPos - lowPos)}%` }}
            />

            {/* Cut-off line */}
            <div className="absolute -top-3 h-[58px] w-0.5 -translate-x-1/2 bg-neutral-900 dark:bg-white" style={{ left: `${cutPos}%` }} />

            {/* Pin + label */}
            <motion.div
              className="absolute top-1/2 w-5 h-5 rounded-full border-4 border-indigo-500 dark:border-indigo-400 bg-white dark:bg-neutral-900 shadow-md z-20"
              style={{ transform: 'translate(-50%, -50%)' }}
              initial={prefersReducedMotion ? { left: `${pinPos}%` } : { left: '0%' }}
              animate={{ left: `${pinPos}%` }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 14 }}
            />
            <div
              className="absolute bottom-7 -translate-x-1/2 rounded-lg bg-neutral-900 dark:bg-white px-2.5 py-0.5 text-sm font-bold text-white dark:text-neutral-900 z-20 whitespace-nowrap"
              style={{ left: `${labelPos}%` }}
            >
              {whr.toFixed(2)}
            </div>
          </div>

          {/* Ticks */}
          <div className="relative h-5 mt-4">
            {WHR_SCALE_TICKS.filter((t) => Math.abs(t - cutoff) >= 0.03).map((tick) => (
              <span key={tick} className="absolute -translate-x-1/2 text-xs font-medium text-neutral-400 dark:text-neutral-500" style={{ left: `${getWHRScalePosition(tick)}%` }}>
                {tick.toFixed(2)}
              </span>
            ))}
          </div>

          {/* Cut-off caption */}
          <div className="relative h-6 mt-1">
            <span className="absolute -translate-x-1/2 text-xs font-bold text-neutral-700 dark:text-neutral-200 whitespace-nowrap" style={{ left: `${cutPos}%` }}>
              WHO cut-off {cutoff.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Legend — its own row, wraps freely on narrow screens without dragging the control below along with it. */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 pt-4 border-t border-neutral-200/70 dark:border-neutral-700/50 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-2">
            <i className="inline-block w-3 h-3 rounded-full border-[3px] border-indigo-500 dark:border-indigo-400 bg-white dark:bg-neutral-900" />
            Your ratio
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="inline-block w-5 h-3 rounded border-2 border-indigo-500 dark:border-indigo-400 bg-indigo-500/15 dark:bg-indigo-400/20" />
            Range allowing for measuring slip
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="inline-block w-0.5 h-3.5 bg-neutral-900 dark:bg-white" />
            WHO cut-off
          </span>
        </div>

        {/* Measuring accuracy — always its own row (never wraps mid-control), so it reads as a
            deliberate line rather than an overflow from the legend above. */}
        <div className="flex flex-nowrap items-center justify-end gap-x-3 mt-3.5 pt-3.5 border-t border-neutral-200/50 dark:border-neutral-700/40">
          <span className="inline-flex items-center gap-1.5 min-w-0 text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
            Measuring accuracy
            <InfoTip
              widthClass="w-64"
              text="Allows for normal tape-measuring slip. Precise = very careful measuring, Typical = a normal reading, Rough = a quick estimate. A wider setting shades a bigger range above."
            />
          </span>
          <span className="relative inline-flex flex-shrink-0">
            <select
              value={tapeErrorCm}
              onChange={(e) => setTapeErrorCm(parseFloat(e.target.value))}
              aria-label="How much tape-measuring error to allow for"
              className="whr-native-select appearance-none rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white text-xs font-bold pl-2.5 pr-7 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 cursor-pointer dark:[color-scheme:dark]"
            >
              {WHR_TAPE_ERROR_OPTIONS.map((opt) => (
                <option key={opt.cm} value={opt.cm}>
                  ±{fromCm(opt.cm, displayUnit).toFixed(1)} {unitName} · {opt.qualifier}
                </option>
              ))}
            </select>
            <SafeIcon icon={FiChevronDown} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: whrSelectOptionThemeCSS }} />

      {/* "Where to measure" guide — opened from the button next to Measurements */}
      <Modal open={showGuideModal} onClose={() => setShowGuideModal(false)} title="Where to measure">
        <svg
          viewBox="34 0 236 270"
          className="w-full h-auto block max-w-[260px] mx-auto"
          role="img"
          aria-label="Front view of a torso. The waist line sits halfway between the lowest rib and the top of the hip bone. The hip line sits at the widest part of the buttocks."
        >
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="text-neutral-400 dark:text-neutral-500">
            <circle cx="100" cy="22" r="14" />
            <path d="M86 40 C68 44 58 52 56 68 C54 92 64 112 68 132 C71 148 62 166 58 186 C56 200 60 236 64 262 L92 262 L97 210 L103 210 L108 262 L136 262 C140 236 144 200 142 186 C138 166 129 148 132 132 C136 112 146 92 144 68 C142 52 132 44 114 40" />
          </g>
          <g stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" className="text-neutral-400 dark:text-neutral-500">
            <line x1="72" y1="112" x2="146" y2="112" />
            <line x1="66" y1="166" x2="146" y2="166" />
          </g>
          <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-indigo-500 dark:text-indigo-400">
            <line x1="60" y1="139" x2="146" y2="139" />
            <line x1="52" y1="194" x2="146" y2="194" />
          </g>
          <g fontSize="11" fill="currentColor" className="text-neutral-400 dark:text-neutral-500">
            <text x="152" y="116">Lowest rib</text>
            <text x="152" y="170">Top of hip bone</text>
          </g>
          <g fontSize="12" fontWeight="700" fill="currentColor" className="text-indigo-500 dark:text-indigo-400">
            <text x="152" y="143">Waist (halfway)</text>
            <text x="152" y="198">Hip (widest part)</text>
          </g>
        </svg>
        <ul className="mt-3 space-y-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 list-disc pl-4 leading-relaxed">
          <li>Waist: halfway between the lowest rib and the top of the hip bone.</li>
          <li>Hip: around the widest part of the buttocks, tape level all the way round.</li>
        </ul>
      </Modal>

      {/* INPUT CARD — unified bordered surface matching BMI/BMR/Body Fat */}
      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-5 sm:p-6 md:p-8">
          <div className="space-y-6">

              {/* About you */}
              <div>
                <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mb-4">About you</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Biological Sex</span>
                    <SegmentedToggle
                      groupId="whr-sex"
                      ariaLabel="Biological sex selection"
                      value={gender}
                      onChange={(v) => { setGender(v as WHRGender); if (v === 'male') setIsPregnant(false); resetCalculation(); }}
                      options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label htmlFor="whr-age-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Age<span className="align-super text-sm ml-0.5">*</span>
                      </label>
                      <InfoTip align="end" widthClass="w-64" text="Optional. Used only to flag results for under-18s, where the adult WHO cut-offs don't apply." />
                    </div>
                    <NumberField
                      id="whr-age-input"
                      value={age}
                      onChange={(v) => { setAge(v); resetCalculation(); }}
                      suffix="years"
                      error={!!ageError}
                      min="1" max="130"
                      placeholder="e.g. 34"
                    />
                    {ageError && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 leading-tight">
                        <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {ageError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Reference Values</span>
                    <InfoTip
                      widthClass="w-64"
                      text="India adds the South Asian waist check and Asian BMI bands. The WHO waist-to-hip cut-offs stay the same for everyone."
                    />
                  </div>
                  <SegmentedToggle
                    groupId="whr-reference"
                    ariaLabel="Reference values"
                    value={reference}
                    onChange={(v) => setReference(v as WHRReference)}
                    options={[{ value: 'global', label: 'Global' }, { value: 'india', label: 'India' }]}
                  />
                  <p className="mt-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    India adds the South Asian waist check and Asian BMI bands. WHR cut-offs stay the same.
                  </p>
                </div>
              </div>

              {/* Measurements */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400">Measurements</h4>
                      <InfoTip widthClass="w-64" text="Waist: halfway between your lowest rib and the top of your hip bone. Hip: around the widest part of the buttocks, tape level all the way round." />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      className="inline-flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-600 bg-transparent text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors cursor-pointer"
                    >
                      <SafeIcon icon={FiMaximize2} className="w-3 h-3" />
                      How to measure
                    </button>
                  </div>
                  <SegmentedToggle
                    groupId="whr-unit-circ"
                    size="sm"
                    ariaLabel="Measurement unit"
                    value={unit}
                    onChange={(v) => handleCircumferenceUnitToggle(v as WHRCircumferenceUnit)}
                    options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="whr-waist-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Waist</label>
                    <NumberField
                      id="whr-waist-input"
                      value={waist}
                      onChange={(v) => { setWaist(v); resetCalculation(); }}
                      suffix={unitName}
                      error={!!measurementError}
                      min={unit === 'cm' ? '40' : '16'}
                      max={unit === 'cm' ? '300' : '118'}
                      placeholder={unit === 'cm' ? 'e.g. 88' : 'e.g. 35'}
                    />
                  </div>
                  <div>
                    <label htmlFor="whr-hip-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">Hip</label>
                    <NumberField
                      id="whr-hip-input"
                      value={hip}
                      onChange={(v) => { setHip(v); resetCalculation(); }}
                      suffix={unitName}
                      error={!!measurementError}
                      min={unit === 'cm' ? '40' : '16'}
                      max={unit === 'cm' ? '300' : '118'}
                      placeholder={unit === 'cm' ? 'e.g. 100' : 'e.g. 39'}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Use a soft tape, snug but not tight. Breathe out normally before reading it.
                </p>
                {measurementError && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-red-500">
                    <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {measurementError}
                  </p>
                )}
              </div>

              {/* Pregnancy guard — female only, highlighted in a bordered card with plain background */}
              {gender === 'female' && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3.5">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                      Pregnant, or gave birth in the last two months?
                    </span>
                    <InfoTip
                      widthClass="w-64"
                      align="end"
                      text="Waist size changes during pregnancy and in the weeks after birth, so we show your ratio without a risk category."
                    />
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPregnant}
                    aria-label="Pregnant, or gave birth in the last two months"
                    onClick={() => { setIsPregnant((p) => !p); resetCalculation(); }}
                    className={`relative inline-flex flex-shrink-0 h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 ${isPregnant ? 'bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${isPregnant ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}

              {/* Height & weight — optional but always visible, each field has its own unit toggle */}
              <div ref={optionalSectionRef}>
                <div className="flex items-center gap-1.5 mb-4">
                  <h4 className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
                    Height &amp; Weight<span className="align-super text-sm ml-0.5">*</span>
                  </h4>
                  <InfoTip widthClass="w-64" text="Optional. Adds waist-to-height ratio and a BMI cross-check to your result." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label htmlFor="whr-height-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Height</label>
                      <SegmentedToggle
                        groupId="whr-unit-height"
                        size="sm"
                        ariaLabel="Height unit"
                        value={heightUnit}
                        onChange={(v) => handleHeightUnitToggle(v as WHRMeasurementUnit)}
                        options={[{ value: 'imperial', label: 'ft' }, { value: 'metric', label: 'cm' }]}
                      />
                    </div>
                    {heightUnit === 'metric' ? (
                      <NumberField
                        id="whr-height-input"
                        value={height}
                        onChange={(v) => { setHeight(v); resetCalculation(); }}
                        suffix="cm"
                        error={!!heightError}
                        min="30" max="300"
                        placeholder="e.g. 170"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <NumberField id="whr-height-input" value={heightFt} onChange={(v) => { setHeightFt(v); resetCalculation(); }} suffix="ft" error={!!heightError} min="1" max="9" placeholder="1-9" />
                        <NumberField value={heightIn} onChange={(v) => { setHeightIn(v); resetCalculation(); }} suffix="in" error={!!heightError} min="0" max="11" placeholder="0-11" />
                      </div>
                    )}
                    {heightError && <p className="mt-2.5 text-sm font-medium text-red-500">{heightError}</p>}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label htmlFor="whr-weight-input" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Weight</label>
                      <SegmentedToggle
                        groupId="whr-unit-weight"
                        size="sm"
                        ariaLabel="Weight unit"
                        value={weightUnit}
                        onChange={(v) => handleWeightUnitToggle(v as WHRMeasurementUnit)}
                        options={[{ value: 'imperial', label: 'lbs' }, { value: 'metric', label: 'kg' }]}
                      />
                    </div>
                    <NumberField
                      id="whr-weight-input"
                      value={weight}
                      onChange={(v) => { setWeight(v); resetCalculation(); }}
                      suffix={weightUnit === 'metric' ? 'kg' : 'lbs'}
                      error={!!weightError}
                      min={weightUnit === 'metric' ? '1' : '2'}
                      max={weightUnit === 'metric' ? '500' : '1100'}
                      placeholder={weightUnit === 'metric' ? 'e.g. 68' : 'e.g. 150'}
                    />
                    {weightError && <p className="mt-2.5 text-sm font-medium text-red-500">{weightError}</p>}
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Adds waist-to-height ratio and a BMI cross-check to your result.
                </p>
              </div>
          </div>
        </div>
      </div>

      <p className="text-xs font-medium text-neutral-400 text-right px-1">* Optional — not required to calculate your ratio.</p>

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
      {(!hasCalculated || hasError || !results) && (
        <motion.div initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center text-center py-14 px-6 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            <circle cx="50" cy="26" r="13" stroke="currentColor" strokeWidth="5" />
            <path d="M28 88 C28 62 38 50 50 50 C62 50 72 62 72 88" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <line x1="32" y1="64" x2="68" y2="64" stroke="currentColor" strokeWidth="4" strokeDasharray="3 5" />
            <line x1="26" y1="80" x2="74" y2="80" stroke="currentColor" strokeWidth="4" strokeDasharray="3 5" />
          </svg>
          <h3 className="mt-5 text-lg font-extrabold text-neutral-500 dark:text-neutral-400">Your Results Will Appear Here</h3>
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-400 dark:text-neutral-500 leading-relaxed">
            Enter your sex, waist and hip, then press Calculate. Height and weight are optional and add two more checks.
          </p>
        </motion.div>
      )}

      {/* RESULTS */}
      {hasCalculated && !hasError && results && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6 pt-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">Your Waist-to-Hip Result</h3>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">{renderDownloadButtons()}</div>
          </div>

          {results.guarded ? (
            /* GUARDED: ratio shown, risk category withheld */
            <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-rose-200 dark:border-rose-900/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-3">
                  <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white" aria-live="polite">
                    {results.whrResult.whr.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 pb-2">waist ÷ hip</span>
                </div>
                <StatusPill tone="neutral">No risk category shown</StatusPill>
              </div>
              <div className="flex flex-col md:flex-row items-start gap-4 mt-6 pt-6 border-t border-neutral-200/70 dark:border-neutral-700/50">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-50 dark:bg-rose-900/20 shadow-sm border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
                  <SafeIcon icon={FiHeart} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">{results.guardMessage?.title}</h3>
                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{results.guardMessage?.body}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Unusual-ratio alert */}
              {results.unusual && (
                <div className="flex items-start gap-3 rounded-2xl border border-yellow-200 dark:border-yellow-800/40 bg-yellow-50 dark:bg-yellow-500/10 px-4 py-3.5 text-sm font-medium text-yellow-800 dark:text-yellow-300" role="alert">
                  <SafeIcon icon={FiAlertTriangle} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>This ratio is unusual. Check that both measurements use the same unit and the landmarks shown above.</span>
                </div>
              )}

              {/* HERO — ratio, verdict, linear scale */}
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden">
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 opacity-20 blur-[80px] rounded-full pointer-events-none transition-colors duration-700 ${currentColors.bg}`} />
                <div className="relative z-10">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex items-end gap-3">
                      <motion.span
                        key={results.whrResult.whr}
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-sm ${currentColors.text}`}
                        aria-live="polite"
                      >
                        {results.whrResult.whr.toFixed(2)}
                      </motion.span>
                      <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 pb-2">waist ÷ hip</span>
                    </div>
                    <StatusPill tone={results.verdict.chipTone}>{results.verdict.chipLabel}</StatusPill>
                  </div>

                  <p className="mt-4 max-w-[62ch] text-[15px] md:text-base font-normal text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {results.verdict.verdictText}
                  </p>

                  {renderScale()}
                </div>
              </div>

              {/* WAIST CHECKS — its own full-width section */}
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                    <SafeIcon icon={FiActivity} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">Waist Checks</h3>
                    <p className="text-xs font-semibold text-neutral-400 mt-0.5">
                      {reference === 'india' ? 'Global and South Asian thresholds shown, side by side.' : 'Switch Reference Values to India above to add the South Asian check.'}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-neutral-200/70 dark:divide-neutral-700/50">
                  <div className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">Waist circumference — general</span>
                      <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {showLen(snapshot!.waistCm)} {unitName} · risk from {showLen(results.waistRisk.increasedThresholdCm)} {unitName}, substantial from {showLen(results.waistRisk.substantialThresholdCm)} {unitName}
                      </span>
                    </div>
                    <StatusPill tone={results.waistRisk.level === 'low' ? 'ok' : results.waistRisk.level === 'increased' ? 'warn' : 'bad'}>
                      {results.waistRisk.label}
                    </StatusPill>
                  </div>

                  {results.southAsian && (
                    <div className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">Waist circumference — South Asian</span>
                        <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Stricter threshold: {showLen(results.southAsian.thresholdCm)} {unitName}</span>
                      </div>
                      <StatusPill tone={results.southAsian.atOrAbove ? 'warn' : 'ok'}>
                        {results.southAsian.atOrAbove ? `At or above ${showLen(results.southAsian.thresholdCm)} ${unitName}` : `Below ${showLen(results.southAsian.thresholdCm)} ${unitName}`}
                      </StatusPill>
                    </div>
                  )}

                  {results.whtr ? (
                    <div className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">Waist-to-height ratio</span>
                        <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {results.whtr.whtr.toFixed(2)} · flags at {results.whtr.boundary.toFixed(2)} or above
                        </span>
                      </div>
                      <StatusPill tone={results.whtr.aboveBoundary ? 'warn' : 'ok'}>
                        {results.whtr.aboveBoundary ? `Above ${results.whtr.boundary.toFixed(2)}` : `Under ${results.whtr.boundary.toFixed(2)}`}
                      </StatusPill>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        window.requestAnimationFrame(() => optionalSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' }));
                      }}
                      className="w-full flex items-center justify-between gap-3 py-4 text-left cursor-pointer group"
                    >
                      <span className="text-sm font-semibold text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Add height to also see waist-to-height ratio
                      </span>
                      <SafeIcon icon={FiMaximize2} className="w-3.5 h-3.5 flex-shrink-0 text-neutral-300 dark:text-neutral-600 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  )}
                </div>
              </div>

              {/* BMI + WHR COMPARISON — its own full-width section, no grid to decode */}
              <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-50 dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                    <SafeIcon icon={FiLayers} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">BMI + Waist-to-Hip, Compared</h3>
                    <p className="text-xs font-semibold text-neutral-400 mt-0.5">
                      {results.comparison ? `Using ${results.comparison.bandLabel}.` : 'Two independent measures read together, for a fuller picture.'}
                    </p>
                  </div>
                </div>

                {results.comparison ? (
                  <>
                    <div className="flex items-stretch gap-3 sm:gap-4">
                      <div className="flex-1 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 px-4 py-5 text-center">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">Your BMI</span>
                        <span className="block text-3xl font-extrabold text-neutral-900 dark:text-white mt-1.5">{results.comparison.bmi.toFixed(1)}</span>
                        <span className={`inline-block mt-2.5 text-xs font-bold ${results.comparison.bmiElevated ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-500'}`}>
                          {results.comparison.bmiCategory}
                        </span>
                      </div>
                      <div className="flex items-center justify-center flex-shrink-0 w-6 sm:w-8">
                        <span className="text-xl font-black text-neutral-200 dark:text-neutral-700">+</span>
                      </div>
                      <div className="flex-1 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 px-4 py-5 text-center">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">Waist-to-Hip</span>
                        <span className="block text-3xl font-extrabold text-neutral-900 dark:text-white mt-1.5">{results.whrResult.whr.toFixed(2)}</span>
                        <span className={`inline-block mt-2.5 text-xs font-bold ${results.comparison.whrElevated ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-500'}`}>
                          {results.comparison.whrElevated ? 'Elevated' : 'Below cut-off'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-neutral-200/70 dark:border-neutral-700/50">
                      <StatusPill tone={results.comparison.agreement === 'neither' ? 'ok' : results.comparison.agreement === 'both' ? 'bad' : 'warn'}>
                        {results.comparison.headline}
                      </StatusPill>
                      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-relaxed">{results.comparison.explanation}</p>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.requestAnimationFrame(() => optionalSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' }));
                    }}
                    className="w-full rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/20 px-4 py-9 text-center hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-colors cursor-pointer group"
                  >
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Add height and weight</p>
                    <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mt-1">to see how your BMI and waist-to-hip ratio compare</p>
                  </button>
                )}
              </div>

              {/* WHAT WOULD CHANGE THIS — one headline stat, one sentence, nothing to reconcile */}
              <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-sm">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${currentColors.bg}`} />
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                      <SafeIcon icon={FiTrendingDown} className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">What Would Change This</h3>
                      <p className="text-xs font-semibold text-neutral-400 mt-0.5">Holding your hip measurement steady</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white dark:bg-neutral-900/40 border border-neutral-200/70 dark:border-neutral-700/50 px-5 py-5 text-center sm:text-left sm:flex sm:items-center sm:gap-5">
                    <div className="flex-shrink-0">
                      <span className="block text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{results.changeMessage.value}</span>
                      <span className="block text-xs font-bold uppercase tracking-wide text-neutral-400 mt-1">{results.changeMessage.label}</span>
                    </div>
                    <p className="mt-3 sm:mt-0 text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-relaxed sm:border-l sm:border-neutral-200 dark:sm:border-neutral-700 sm:pl-5">
                      {results.changeMessage.caption}
                    </p>
                  </div>

                  <p className="text-xs font-normal text-neutral-500 dark:text-neutral-400 leading-relaxed mt-4">
                    In practice, hips often shrink a little as the waist does — so a real change in your ratio is usually smaller than this simple estimate suggests.
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {renderShareBar()}

      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 space-y-3 mt-5">
        <p className="leading-normal">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This calculator gives a screening estimate, not a diagnosis. Waist-to-hip ratio is one signal among many, and tape measurements vary between readings. Talk to a doctor before changing your diet or exercise routine.
        </p>
      </div>

      {/* SOURCES */}
      <div ref={sourcesPanelRef} style={sourcesPulse ? { boxShadow: '0 0 0 3px rgba(99,102,241,0.35)' } : undefined} className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 mt-4 overflow-hidden transition-shadow duration-300">
        <button type="button" onClick={toggleSources} aria-expanded={showSources} className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left cursor-pointer hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400">
              <SafeIcon icon={FiFileText} className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-tight">Sources</span>
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-500 mt-0.5 leading-snug">{WHR_SOURCES.length} references — every threshold used above, cited</span>
            </div>
          </div>
          <span className={`flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ease-out ${showSources ? 'rotate-180' : ''}`}>
            <SafeIcon icon={FiArrowDown} className="w-4 h-4" />
          </span>
        </button>
        <motion.div initial={false} animate={{ height: showSources ? 'auto' : 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }} style={{ overflow: 'hidden' }} aria-hidden={!showSources}>
          <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4">
            <ol className="list-none space-y-4 divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {WHR_SOURCES.map((source, i) => (
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

export default WHRCalculator;
