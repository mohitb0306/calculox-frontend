"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  calculateBMR,
  calculateTDEE,
  getGoalCalories,
  validateBMRInput,
  validateBodyFatInput,
  BMRUnit,
  BMRGender,
  ActivityLevel,
  BMRResult,
  TDEEEntry,
  GoalCalorieEntry,
  BMR_SOURCES,
} from '@/utils/calculators/bmrLogic';
import type { ShareableReport } from '@/lib/reports/types';

const {
  FiAlertCircle, FiInfo, FiZap, FiArrowDown, FiImage, FiFileText, FiLoader,
  FiRotateCcw, FiCheckCircle, FiExternalLink, FiTrendingUp, FiTrendingDown,
  FiMinus, FiShield, FiShare2, FiMail, FiCopy, FiCheck, FiChevronDown,
  FiDownload,
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
  { level: 'sedentary', label: 'Sedentary', description: 'Little or no exercise' },
  { level: 'light', label: 'Light', description: 'Light exercise 1\u20133 days/week' },
  { level: 'moderate', label: 'Moderate', description: 'Moderate exercise 3\u20135 days/week' },
  { level: 'active', label: 'Active', description: 'Hard exercise 6\u20137 days/week' },
  { level: 'very_active', label: 'Very Active', description: 'Very hard exercise + physical job' },
  { level: 'extra_active', label: 'Extra Active', description: 'Professional athlete / very demanding job' },
];

const GOAL_STYLES: Record<string, { icon: IconType; text: string; bgLight: string; border: string }> = {
  aggressive_cut: { icon: FiTrendingDown, text: 'text-red-600 dark:text-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  mild_cut: { icon: FiTrendingDown, text: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
  maintain: { icon: FiMinus, text: 'text-blue-600 dark:text-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  mild_bulk: { icon: FiTrendingUp, text: 'text-teal-600 dark:text-teal-400', bgLight: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800' },
  aggressive_bulk: { icon: FiTrendingUp, text: 'text-green-600 dark:text-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
};

// --- CONFIDENCE COLOR MAPPER ---
// Same role as getCategoryColors() in BMICalculator.tsx, keyed by formula
// spread (kcal) instead of a BMI category string.
const getConfidenceColors = (spreadKcal: number) => {
  if (spreadKcal < 75) {
    return {
      text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500',
      grad: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800',
      border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20',
      shadow: 'shadow-green-500/10', hex: '#10b981',
    };
  }
  if (spreadKcal <= 150) {
    return {
      text: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-500',
      grad: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800',
      border: 'border-amber-500 dark:border-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-900/20',
      shadow: 'shadow-amber-500/10', hex: '#f59e0b',
    };
  }
  return {
    text: 'text-orange-600 dark:text-orange-500', bg: 'bg-orange-500',
    grad: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800',
    border: 'border-orange-500 dark:border-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20',
    shadow: 'shadow-orange-500/10', hex: '#f97316',
  };
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

// --- ACCESSIBLE INFO TOOLTIP --- (copied verbatim from BMICalculator.tsx —
// opens on hover AND tap, closes on outside click, for touch-device parity)
const InfoTip: React.FC<{ text: string; widthClass?: string }> = ({ text, widthClass = 'w-56' }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-expanded={open}
        aria-label="More information"
        className="cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <SafeIcon icon={FiInfo} className="w-4 h-4" />
      </button>
      <span
        role="tooltip"
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${widthClass} bg-neutral-900 text-white text-xs rounded p-2 transition-opacity pointer-events-none z-10 text-center ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
};

const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const formatKcal = (n: number): string => `${Math.round(n).toLocaleString()} kcal`;

const BMRCalculator: React.FC<BMRCalculatorProps> = ({
  onCalculationComplete, onReportChange, onDownloadReport, downloadingFormat = null,
  onShare, onEmailShare, onCopyLink, linkCopied = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // --- State ---
  const [unit, setUnit] = useState<BMRUnit>('imperial');
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<BMRGender>('male');

  const [weight, setWeight] = useState<number | string>('');
  const [height, setHeight] = useState<number | string>('');
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');
  const [bodyFat, setBodyFat] = useState<number | string>('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

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

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight) return true;
    if (unit === 'metric' && !height) return true;
    if (unit === 'imperial' && (!heightFt || !heightIn)) return true;
    return false;
  }, [age, weight, height, heightFt, heightIn, unit]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !bodyFat && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, bodyFat, hasCalculated]);

  const activeHeight = useMemo(() => {
    if (unit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    return (ft * 12) + inc;
  }, [unit, height, heightFt, heightIn]);

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
    resetCalculation();
  };

  const handleUnitToggle = (newUnit: BMRUnit) => {
    if (newUnit === unit) return;
    resetCalculation();

    const w = parseFloat(weight.toString());
    if (!Number.isNaN(w)) {
      setWeight(newUnit === 'imperial' ? Math.round(w * 2.20462) : Math.round(w / 2.20462));
    }

    if (newUnit === 'imperial') {
      const h = parseFloat(height.toString());
      if (!Number.isNaN(h)) {
        const totalInches = h / 2.54;
        let ft = Math.floor(totalInches / 12);
        let inch = Math.round(totalInches % 12);
        if (inch === 12) {
          inch = 0;
          ft += 1;
        }
        setHeightFt(ft);
        setHeightIn(inch);
      }
    } else {
      const ft = parseFloat(heightFt.toString());
      const inc = parseFloat(heightIn.toString());
      if (!Number.isNaN(ft) && !Number.isNaN(inc)) {
        const totalInches = (ft * 12) + inc;
        setHeight(Math.round(totalInches * 2.54));
      }
    }

    setUnit(newUnit);
  };

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const w = parseFloat(weight.toString());
    const h = activeHeight;
    const a = parseInt(age.toString(), 10);

    let isValid = true;

    const validation = validateBMRInput(w, h, a, unit);
    if (!validation.isValid) {
      const limits = unit === 'metric' ? { w: [1, 500], h: [30, 300] } : { w: [2, 1100], h: [12, 118] };
      const weightInvalid = !Number.isFinite(w) || Number.isNaN(w) || w <= 0 || w < limits.w[0] || w > limits.w[1];
      const heightInvalid = !Number.isFinite(h) || Number.isNaN(h) || h <= 0 || h < limits.h[0] || h > limits.h[1];
      const ageInvalid = !Number.isFinite(a) || Number.isNaN(a) || a <= 0 || a > 130;

      setWeightError(weightInvalid ? validation.error ?? 'Invalid weight.' : null);
      setHeightError(heightInvalid && !weightInvalid ? validation.error ?? 'Invalid height.' : null);
      setAgeError(ageInvalid && !weightInvalid && !heightInvalid ? validation.error ?? 'Invalid age.' : null);
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

    const bmrResult = calculateBMR(w, h, a, gender, unit, hasBodyFatInput ? bf : null);
    const tdee = calculateTDEE(bmrResult.primaryBmr);
    const activeTdeeCalories = tdee.find((t) => t.level === activityLevel)?.calories ?? bmrResult.primaryBmr * 1.2;
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
  const activeTdeeEntry = useMemo(
    () => tdeeRows.find((t) => t.level === activityLevel) ?? null,
    [tdeeRows, activityLevel]
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

    const formulaRows = result.results.map((r) => ({
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
      { label: 'Height', value: unit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"` },
      { label: 'Weight', value: `${weight} ${unit === 'metric' ? 'kg' : 'lbs'}` },
      { label: 'Activity Level', value: activityMeta?.label ?? '\u2014' },
    ];
    const bf = parseFloat(bodyFat.toString());
    if (!Number.isNaN(bf) && bf > 0) {
      inputRows.push({ label: 'Body Fat %', value: `${bf}%` });
    }
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    // Quick-share PNG stays a compact snapshot — just the formula
    // comparison, same "trim the long reference content" reasoning
    // BMICalculator.tsx applies to its own Detailed Classification table.
    const imageSections: ShareableReport['sections'] = [sections[0]];

    return {
      title: 'BMR Result',
      headlineValue: Math.round(result.primaryBmr).toString(),
      headlineLabel: 'Calories/day at rest',
      accentColor: colors.hex,
      meta: ['Mifflin-St Jeor', unit === 'metric' ? 'Metric Units' : 'Imperial Units'],
      sections,
      pdfOnlySections,
      imageSections,
      disclaimer: 'For informational purposes only \u2014 not medical advice.',
      fileNameBase: `bmr-result-${Math.round(result.primaryBmr)}`,
    };
  }, [hasCalculated, hasError, result, tdeeRows, goalRows, activityLevel, age, gender, unit, height, heightFt, heightIn, weight, bodyFat]);

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

      {/* SECTION 1: Settings Switchers */}
      <div>
        <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 text-center md:text-left">
          Measurement Unit
        </label>
        <div className="bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg flex w-full max-w-md mx-auto md:mx-0" role="group" aria-label="Unit selection">
          <button
            type="button"
            aria-pressed={unit === 'imperial'}
            onClick={() => handleUnitToggle('imperial')}
            className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 cursor-pointer ${
              unit === 'imperial' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Imperial
          </button>
          <button
            type="button"
            aria-pressed={unit === 'metric'}
            onClick={() => handleUnitToggle('metric')}
            className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 cursor-pointer ${
              unit === 'metric' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Metric
          </button>
        </div>
      </div>

      <hr className="border-t border-neutral-200 dark:border-neutral-800" />

      {/* SECTION 2: Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="bmr-age-input" className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Age
            <InfoTip widthClass="w-56" text="These formulas were validated for ages 15–80. Outside that range results still calculate, but are less reliable." />
          </label>
          <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-offset-0 ${
            ageError ? 'border-red-500 focus-within:ring-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500'
          }`}>
            <input
              id="bmr-age-input"
              type="number"
              value={age}
              onChange={(e) => { setAge(e.target.value); resetCalculation(); }}
              className={`flex-1 min-w-0 w-full px-4 py-3 bg-transparent text-neutral-900 dark:text-white focus:outline-none ${noSpinnerClass}`}
            />
            <span className="flex items-center flex-shrink-0 px-3.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
              years
            </span>
          </div>
          {ageError && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 leading-tight">
              <SafeIcon icon={FiAlertCircle} className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {ageError}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Biological Sex
            <InfoTip text="Every formula below uses different coefficients for men and women, based on typical differences in muscle mass and body composition." />
          </label>
          <div className="flex bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg h-[50px]">
            <button
              type="button"
              onClick={() => { setGender('male'); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all cursor-pointer ${gender === 'male' ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => { setGender('female'); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all cursor-pointer ${gender === 'female' ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Female
            </button>
          </div>
        </div>
      </div>

      <hr className="border-t border-neutral-200 dark:border-neutral-800" />

      {/* SECTION 3: Measurements — Height, Weight, and optional Body Fat % */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div>
          <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5">
            Height
          </label>
          {unit === 'metric' ? (
            <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 shadow-sm overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500 ${
              heightError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
            }`}>
              <input
                type="number"
                value={height}
                onChange={(e) => { setHeight(e.target.value); resetCalculation(); }}
                className={`flex-1 min-w-0 w-full px-3.5 py-2.5 bg-transparent focus:outline-none ${noSpinnerClass}`}
              />
              <span className="flex items-center flex-shrink-0 px-3.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
                cm
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 shadow-sm overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500 ${
                heightError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
              }`}>
                <input
                  type="number"
                  value={heightFt}
                  onChange={(e) => { setHeightFt(e.target.value); resetCalculation(); }}
                  className={`flex-1 min-w-0 w-full px-3.5 py-2.5 bg-transparent focus:outline-none ${noSpinnerClass}`}
                  min="1" max="9"
                />
                <span className="flex items-center flex-shrink-0 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
                  ft
                </span>
              </div>
              <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 shadow-sm overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500 ${
                heightError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
              }`}>
                <input
                  type="number"
                  value={heightIn}
                  onChange={(e) => { setHeightIn(e.target.value); resetCalculation(); }}
                  className={`flex-1 min-w-0 w-full px-3.5 py-2.5 bg-transparent focus:outline-none ${noSpinnerClass}`}
                  min="0" max="11"
                />
                <span className="flex items-center flex-shrink-0 px-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
                  in
                </span>
              </div>
            </div>
          )}
          {heightError && <p className="mt-2.5 text-sm font-medium text-red-500">{heightError}</p>}
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5">
            Weight
          </label>
          <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 shadow-sm overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500 ${
            weightError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
          }`}>
            <input
              type="number"
              value={weight}
              onChange={(e) => { setWeight(e.target.value); resetCalculation(); }}
              className={`flex-1 min-w-0 w-full px-3.5 py-2.5 bg-transparent focus:outline-none ${noSpinnerClass}`}
            />
            <span className="flex items-center flex-shrink-0 px-3.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
              {unit === 'metric' ? 'kg' : 'lbs'}
            </span>
          </div>
          {weightError && <p className="mt-2.5 text-sm font-medium text-red-500">{weightError}</p>}
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-1.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5">
            Body Fat
            <span className="text-xs font-semibold text-neutral-400 normal-case">— Optional</span>
            <InfoTip
              widthClass="w-64"
              text="Add this for a more accurate Katch-McArdle and Cunningham result. Without it, we estimate your lean body mass from your height and weight instead."
            />
          </label>
          <div className={`flex items-stretch w-full rounded-lg border bg-white dark:bg-neutral-700 shadow-sm overflow-hidden transition-shadow focus-within:ring-2 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-500 ${
            bodyFatError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600 focus-within:border-neutral-400 dark:focus-within:border-neutral-500'
          }`}>
            <input
              type="number"
              value={bodyFat}
              onChange={(e) => { setBodyFat(e.target.value); resetCalculation(); }}
              className={`flex-1 min-w-0 w-full px-3.5 py-2.5 bg-transparent focus:outline-none ${noSpinnerClass}`}
            />
            <span className="flex items-center flex-shrink-0 px-3.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/70 border-l border-neutral-300 dark:border-neutral-600 whitespace-nowrap">
              %
            </span>
          </div>
          {bodyFatError && <p className="mt-2.5 text-sm font-medium text-red-500">{bodyFatError}</p>}
        </div>
      </div>

      <hr className="border-t border-neutral-200 dark:border-neutral-800" />

      {/* SECTION 4: Activity Level — drives the TDEE table and goal targets */}
      <div className="max-w-2xl mx-auto">
        <label className="flex items-center justify-center md:justify-start gap-1.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2.5">
          Activity Level
          <InfoTip widthClass="w-60" text="How much you move day-to-day, outside of resting. This scales your BMR up into a full daily calorie estimate (TDEE)." />
        </label>
        <div className="relative">
          <select
            value={activityLevel}
            onChange={(e) => { setActivityLevel(e.target.value as ActivityLevel); resetCalculation(); }}
            className="w-full appearance-none rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white px-3.5 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 cursor-pointer"
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

          {/* PRIMARY HEADLINE CARD */}
          <div className={`bg-gradient-to-br ${confidenceColors.grad} rounded-3xl p-6 sm:p-8 border shadow-sm text-center`}>
            <p className="text-sm font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
              Mifflin-St Jeor (Primary)
            </p>
            <p className={`text-5xl sm:text-6xl font-black tracking-tight ${confidenceColors.text}`}>
              {Math.round(result.primaryBmr).toLocaleString()}
            </p>
            <p className="mt-1 text-base font-semibold text-neutral-600 dark:text-neutral-300">
              Calories/day at rest
            </p>
          </div>

          {result.estimatedLbmKg !== undefined && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <SafeIcon icon={FiInfo} className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium leading-relaxed">
                Katch-McArdle and Cunningham below use an estimated lean body mass of{' '}
                <strong>{result.estimatedLbmKg.toFixed(1)} kg</strong>, derived from your height and weight — enter your body fat % above for a more precise result.
              </p>
            </div>
          )}

          {/* CONFIDENCE / INSIGHT */}
          <div className="flex items-start gap-3 p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${confidenceColors.bgLight}`}>
              <SafeIcon icon={FiShield} className={`w-4 h-4 ${confidenceColors.text}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Spread across formulas: {Math.round(result.spreadKcal)} kcal
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {result.confidenceNote}
              </p>
            </div>
          </div>

          {/* COMPARE FORMULAS PANEL */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white">
                Compare Formulas
              </h3>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {result.results.map((r) => (
                <div
                  key={r.formula}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 sm:px-8 py-4 sm:py-5 ${
                    r.isPrimary ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                  }`}
                >
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
              ))}
            </div>
          </div>

          {/* TDEE TABLE — all six tiers shown at once */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white">
                TDEE by Activity Level
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Total Daily Energy Expenditure — your BMR scaled up by how active you are.
              </p>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {tdeeRows.map((row) => {
                const isActive = row.level === activityLevel;
                return (
                  <div
                    key={row.level}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-6 sm:px-8 py-4 sm:py-5 relative ${
                      isActive ? 'bg-neutral-50 dark:bg-neutral-700/20' : ''
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-0 w-1.5 h-full bg-indigo-500" />}
                    <div>
                      <span className={`text-base tracking-tight ${isActive ? 'font-black text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>
                        {row.label}
                      </span>
                      <span className="block sm:inline sm:ml-2 text-xs text-neutral-400">{row.description}</span>
                      {isActive && (
                        <span className="ml-0 sm:ml-2 inline-block mt-1 sm:mt-0 text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                          Your Selection
                        </span>
                      )}
                    </div>
                    <span className={`text-base sm:text-lg font-bold tracking-tight ${isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {formatKcal(row.calories)}<span className="text-xs font-semibold text-neutral-400 ml-1">/day</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GOAL-BASED CALORIE TARGETS */}
          <div>
            <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white mb-1">
              Goal-Based Calorie Targets
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Based on your {activeTdeeEntry?.label ?? 'selected'} TDEE of {activeTdeeEntry ? formatKcal(activeTdeeEntry.calories) : '\u2014'}/day. Uses the standard ~7,700 kcal \u2248 1 kg conversion \u2014 an approximation, not a guarantee.
            </p>
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
                  <div key={g.goal} className={`rounded-2xl border p-5 ${cardBg} ${cardBorder}`}>
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
                          <> · \u2248 {g.expectedChangePerWeekKg > 0 ? '+' : ''}{g.expectedChangePerWeekKg.toFixed(2)} kg/week</>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
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
