"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { calculateBMI, getBMIRanges, validateBMIInput, validateWaistInput, calculateWaistMetrics, getBMIInsight, getGenderContextNote, generateBMIGrid, BMIUnit, BMIRegion } from '@/utils/calculators/bmiLogic';
import type { ShareableReport } from '@/lib/reports/types';

const { FiActivity, FiTarget, FiTrendingUp, FiAlertCircle, FiInfo, FiHeart, FiBarChart2, FiArrowDown } = FiIcons;

interface BMICalculatorProps {
  onCalculationComplete?: () => void;
  /**
   * Fired whenever the current result changes — including becoming null when
   * there is no shareable result (no calculation yet, a validation error, or
   * the pregnancy safety disclaimer). A future header/toolbar component can
   * use this to receive the report and pass it into generateResultImage /
   * generateResultPdf without BMICalculator needing to know anything about
   * where those download/share icons live.
   */
  onReportChange?: (report: ShareableReport | null) => void;
}

// --- DYNAMIC PREMIUM COLOR MAPPER ---
const getCategoryColors = (category: string) => {
  switch(category) {
    case 'Severe thinness': return { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', grad: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-800', border: 'border-indigo-500 dark:border-indigo-400', bgLight: 'bg-indigo-50 dark:bg-indigo-900/20', shadow: 'shadow-indigo-500/10', hex: '#4f46e5' };
    case 'Moderate thinness': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', grad: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800', border: 'border-blue-500 dark:border-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', shadow: 'shadow-blue-500/10', hex: '#2563eb' };
    case 'Mild thinness': return { text: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500', grad: 'from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-200 dark:border-sky-800', border: 'border-sky-500 dark:border-sky-400', bgLight: 'bg-sky-50 dark:bg-sky-900/20', shadow: 'shadow-sky-500/10', hex: '#0ea5e9' };
    case 'Underweight': return { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', grad: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800', border: 'border-blue-500 dark:border-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-900/20', shadow: 'shadow-blue-500/10', hex: '#3b82f6' };
    case 'Normal range': return { text: 'text-green-600 dark:text-green-500', bg: 'bg-green-500', grad: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800', border: 'border-green-500 dark:border-green-400', bgLight: 'bg-green-50 dark:bg-green-900/20', shadow: 'shadow-green-500/10', hex: '#10b981' };
    case 'Overweight': 
    case 'Pre-obese': return { text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-500', grad: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800', border: 'border-yellow-500 dark:border-yellow-400', bgLight: 'bg-yellow-50 dark:bg-yellow-900/20', shadow: 'shadow-yellow-500/10', hex: '#eab308' };
    case 'Obese Class I': 
    case 'Obesity Class I': return { text: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-500', grad: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800', border: 'border-orange-500 dark:border-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-900/20', shadow: 'shadow-orange-500/10', hex: '#f97316' };
    case 'Obese Class II': 
    case 'Obesity Class II': return { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-500', grad: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800', border: 'border-red-500 dark:border-red-400', bgLight: 'bg-red-50 dark:bg-red-900/20', shadow: 'shadow-red-500/10', hex: '#ef4444' };
    case 'Obese Class III': return { text: 'text-rose-700 dark:text-rose-500', bg: 'bg-rose-600', grad: 'from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-800', border: 'border-rose-500 dark:border-rose-400', bgLight: 'bg-rose-50 dark:bg-rose-900/20', shadow: 'shadow-rose-500/10', hex: '#be123c' };
    default: return { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-500', grad: 'from-neutral-50 to-neutral-100 dark:from-neutral-900/20 dark:to-neutral-800/20 border-neutral-200 dark:border-neutral-800', border: 'border-neutral-500 dark:border-neutral-400', bgLight: 'bg-neutral-50 dark:bg-neutral-900/20', shadow: 'shadow-neutral-500/10', hex: '#737373' };
  }
};

const BMICalculator: React.FC<BMICalculatorProps> = ({ onCalculationComplete, onReportChange }) => {
  const prefersReducedMotion = useReducedMotion();
  
  // State
  const [age, setAge] = useState<number | string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [isAthletic, setIsAthletic] = useState<boolean>(false);
  const [isPregnant, setIsPregnant] = useState<boolean>(false);
  
  const [weight, setWeight] = useState<number | string>('');
  const [height, setHeight] = useState<number | string>('');
  const [waist, setWaist] = useState<number | string>('');
  
  // Split state for Imperial inputs
  const [heightFt, setHeightFt] = useState<number | string>('');
  const [heightIn, setHeightIn] = useState<number | string>('');

  const [unit, setUnit] = useState<BMIUnit>('metric');
  const [region, setRegion] = useState<BMIRegion>('who');
  
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [bmi, setBmi] = useState(0);
  const [category, setCategory] = useState('');
  const [idealWeight, setIdealWeight] = useState({ min: 0, max: 0 });
  const [bmiPrime, setBmiPrime] = useState(0);
  const [ponderalIndex, setPonderalIndex] = useState(0);
  const [whtr, setWhtr] = useState(0);
  const [whtrCategory, setWhtrCategory] = useState('');
  const [waistRiskLevel, setWaistRiskLevel] = useState('');
  
  const [weightError, setWeightError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [waistError, setWaistError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  // Step 8: visually links the gauge to its matching row in the Detailed
  // Classification table — a ref to scroll to, plus a brief highlight pulse.
  const activeClassificationRowRef = useRef<HTMLDivElement | null>(null);
  const [classificationPulse, setClassificationPulse] = useState<boolean>(false);

  const isCalculateDisabled = useMemo(() => {
    if (!age || !weight) return true;
    if (unit === 'metric' && !height) return true;
    if (unit === 'imperial' && (!heightFt || !heightIn)) return true;
    return false;
  }, [age, weight, height, heightFt, heightIn, unit]);

  const isClearDisabled = useMemo(() => {
    return !age && !weight && !height && !heightFt && !heightIn && !waist && !hasCalculated;
  }, [age, weight, height, heightFt, heightIn, waist, hasCalculated]);

  const resetCalculation = () => {
    setHasCalculated(false);
    setBmi(0);
    setCategory('');
    setIdealWeight({ min: 0, max: 0 });
    setBmiPrime(0);
    setPonderalIndex(0);
    setWhtr(0);
    setWhtrCategory('');
    setWaistRiskLevel('');
    
    setWeightError(null);
    setHeightError(null);
    setWaistError(null);
    setAgeError(null);
  };

  const handleClear = () => {
    if (isClearDisabled) return;
    setAge('');
    setGender('male');
    setIsAthletic(false);
    setIsPregnant(false);
    setWeight('');
    setHeight('');
    setWaist('');
    setHeightFt('');
    setHeightIn('');
    setUnit('metric');
    setRegion('who');
    
    setWeightError(null);
    setHeightError(null);
    setWaistError(null);
    setAgeError(null);
    
    resetCalculation();
  };

  const handleAgeChange = (value: string) => {
    setAge(value);
    resetCalculation();
    const parsedAge = parseInt(value, 10);
    if (!Number.isNaN(parsedAge) && (parsedAge < 20 || parsedAge > 120)) {
      setAgeError('Standard adult BMI calculations require an age between 20 and 120.');
    } else {
      setAgeError(null);
    }
  };

  const handleUnitToggle = (newUnit: BMIUnit) => {
    if (newUnit === unit) return;
    
    resetCalculation();
    const w = parseFloat(weight.toString());
    
    if (!Number.isNaN(w)) {
      if (newUnit === 'imperial') {
        const h = parseFloat(height.toString());
        setWeight(+(w * 2.20462).toFixed(1));
        if (!Number.isNaN(h)) {
          const totalInches = h / 2.54;
          setHeightFt(Math.floor(totalInches / 12));
          setHeightIn(Math.round(totalInches % 12));
        }
      } else {
        const ft = parseFloat(heightFt.toString());
        const inc = parseFloat(heightIn.toString());
        setWeight(+(w / 2.20462).toFixed(1));
        if (!Number.isNaN(ft) && !Number.isNaN(inc)) {
          const totalInches = (ft * 12) + inc;
          setHeight(+(totalInches * 2.54).toFixed(1));
        }
      }
    }
    setUnit(newUnit);
  };

  const activeHeight = useMemo(() => {
    if (unit === 'metric') return parseFloat(height.toString()) || 0;
    const ft = parseFloat(heightFt.toString()) || 0;
    const inc = parseFloat(heightIn.toString()) || 0;
    return (ft * 12) + inc;
  }, [unit, height, heightFt, heightIn]);

  const handleCalculate = () => {
    if (isCalculateDisabled) return;

    const w = parseFloat(weight.toString());
    const h = activeHeight;
    const a = parseInt(age.toString(), 10);

    let isValid = true;

    if (Number.isNaN(a) || a < 20 || a > 120) {
      setAgeError('Standard adult BMI calculations require an age between 20 and 120.');
      isValid = false;
    } else {
      setAgeError(null);
    }

    const validation = validateBMIInput(w, h, unit);

    if (!validation.isValid) {
      const limits = unit === 'metric' ? { w: [1, 500], h: [30, 300] } : { w: [2, 1100], h: [12, 118] };
      const weightInvalid = !Number.isFinite(w) || Number.isNaN(w) || w <= 0 || w < limits.w[0] || w > limits.w[1];
      const heightInvalid = !Number.isFinite(h) || Number.isNaN(h) || h <= 0 || h < limits.h[0] || h > limits.h[1];

      setWeightError(weightInvalid ? validation.error ?? 'Invalid weight.' : null);
      setHeightError(heightInvalid && !weightInvalid ? validation.error ?? 'Invalid height.' : null);
      isValid = false;
    } else {
      setWeightError(null);
      setHeightError(null);
    }

    if (!isValid) {
      setHasCalculated(false);
      return;
    }

    // Waist circumference is optional — only validate/compute if the user provided one.
    const wc = parseFloat(waist.toString());
    const hasWaistInput = !Number.isNaN(wc) && wc > 0;

    if (hasWaistInput) {
      const waistValidation = validateWaistInput(wc, unit);
      if (!waistValidation.isValid) {
        setWaistError(waistValidation.error ?? 'Invalid waist circumference.');
        setHasCalculated(false);
        return;
      }
    }
    setWaistError(null);

    const result = calculateBMI(w, h, unit, region);
    
    setBmi(result.bmi);
    setCategory(result.category);
    setIdealWeight({ min: result.idealWeightMin, max: result.idealWeightMax });
    setBmiPrime(result.bmiPrime);
    setPonderalIndex(result.ponderalIndex);

    if (hasWaistInput) {
      const waistMetrics = calculateWaistMetrics(wc, h, unit, gender);
      setWhtr(waistMetrics.whtr);
      setWhtrCategory(waistMetrics.whtrCategory);
      setWaistRiskLevel(waistMetrics.waistRiskLevel);
    } else {
      setWhtr(0);
      setWhtrCategory('');
      setWaistRiskLevel('');
    }

    setHasCalculated(true);

    if (onCalculationComplete) {
      onCalculationComplete();
    }
  };

  const bmiRanges = getBMIRanges(region);
  const currentColors = getCategoryColors(category);
  const hasError = Boolean(weightError || heightError || ageError);

  const activeRangeIndex = useMemo(() => {
    if (!hasCalculated) return -1;
    return bmiRanges.findIndex((r) => r.category === category);
  }, [bmiRanges, category, hasCalculated]);

  // --- ELITE 4K SVG GEOMETRY ENGINE ---
  const minScale = 10;
  const maxScale = 50;
  const scaleRange = maxScale - minScale;

  const bmiToAngle = useMemo(() => (val: number) => {
    const clamped = Math.min(Math.max(val, minScale), maxScale);
    return ((clamped - minScale) / scaleRange) * 180;
  }, []);

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

  const needleAngle = useMemo(() => (!hasCalculated || hasError) ? -90 : bmiToAngle(bmi) - 90, [hasCalculated, hasError, bmiToAngle, bmi]);

  const springConfig = prefersReducedMotion 
    ? { duration: 0 } 
    : { type: "spring" as const, stiffness: 50, damping: 12, mass: 0.8 };

  const gridData = useMemo(() => {
    if (!hasCalculated || hasError || bmi === 0) return null;
    return generateBMIGrid(parseFloat(weight.toString()), activeHeight, unit, region);
  }, [hasCalculated, hasError, bmi, weight, activeHeight, unit, region]);

  // --- STEP B: SHAREABLE REPORT (feeds the shared report engine) ---
  // Builds a calculator-agnostic ShareableReport from this calculator's own
  // state. This is the ONLY place BMICalculator talks to the report engine —
  // it never draws pixels or PDF content itself; generateResultImage.ts and
  // generateResultPdf.ts (used elsewhere, e.g. a future header/toolbar) do
  // that from this object. null means "nothing shareable right now" (no
  // calculation yet, a validation error, or the pregnancy disclaimer).
  const report = useMemo<ShareableReport | null>(() => {
    if (!hasCalculated || hasError || isPregnant) return null;

    const colors = getCategoryColors(category);

    const mainRows: Array<{ label: string; value: string }> = [
      {
        label: 'Ideal Weight Range',
        value: idealWeight.max === 0 ? '--' : `${idealWeight.min.toFixed(1)} \u2013 ${idealWeight.max.toFixed(1)} ${unit === 'metric' ? 'kg' : 'lbs'}`,
      },
      { label: 'BMI Prime', value: bmiPrime === 0 ? '--' : bmiPrime.toFixed(2) },
      { label: 'Ponderal Index', value: ponderalIndex === 0 ? '--' : `${ponderalIndex.toFixed(1)} kg/m\u00b3` },
    ];

    const sections: ShareableReport['sections'] = [{ heading: 'Key Results', rows: mainRows, variant: 'output' }];

    if (whtrCategory || waistRiskLevel) {
      const waistRows: Array<{ label: string; value: string }> = [];
      if (whtrCategory) {
        waistRows.push({ label: 'Waist-to-Height Ratio', value: `${whtr.toFixed(2)} (${whtrCategory})` });
      }
      if (waistRiskLevel) {
        waistRows.push({ label: 'Waist Risk (WHO)', value: waistRiskLevel });
      }
      sections.push({ heading: 'Waist Metrics', rows: waistRows, variant: 'output' });
    }

    // Full Detailed Classification table (every band, not just the matched
    // one) so the "Complete Report" PDF can show it in full, same as the
    // on-page table.
    const classificationRows = getBMIRanges(region).map((range) => ({
      label: range.category,
      value: range.category === category ? `${range.label} \u2014 Your Result` : range.label,
    }));
    sections.push({
      heading: `Detailed Classification (${region === 'asia-pacific' ? 'Asia-Pacific' : 'WHO'})`,
      rows: classificationRows,
      variant: 'output',
    });

    // "Your Inputs" recap — PDF ("Complete Report") only, never in the quick
    // shareable image. Mirrors exactly what was typed into the form.
    const inputRows: Array<{ label: string; value: string }> = [
      { label: 'Age', value: `${age} years` },
      { label: 'Biological Sex', value: gender === 'male' ? 'Male' : 'Female' },
      { label: 'Athletic Build', value: isAthletic ? 'Yes' : 'No' },
      {
        label: 'Height',
        value: unit === 'metric' ? `${height} cm` : `${heightFt}' ${heightIn}"`,
      },
      { label: 'Weight', value: `${weight} ${unit === 'metric' ? 'kg' : 'lbs'}` },
    ];
    const wc = parseFloat(waist.toString());
    if (!Number.isNaN(wc) && wc > 0) {
      inputRows.push({ label: 'Waist Circumference', value: `${waist} ${unit === 'metric' ? 'cm' : 'in'}` });
    }
    const pdfOnlySections: ShareableReport['sections'] = [{ heading: 'Your Inputs', rows: inputRows, variant: 'input' }];

    return {
      title: 'BMI Result',
      headlineValue: bmi.toFixed(1),
      headlineLabel: category,
      accentColor: colors.hex,
      meta: [region === 'who' ? 'WHO Standard' : 'Asia-Pacific Standard', unit === 'metric' ? 'Metric Units' : 'Imperial Units'],
      sections,
      pdfOnlySections,
      disclaimer: 'For informational purposes only \u2014 not medical advice.',
      fileNameBase: `bmi-result-${bmi.toFixed(1)}`,
    };
  }, [hasCalculated, hasError, isPregnant, bmi, category, idealWeight, bmiPrime, ponderalIndex, whtr, whtrCategory, waistRiskLevel, region, unit, age, gender, isAthletic, height, heightFt, heightIn, weight, waist]);

  // Tell a parent component (e.g. a future header/toolbar) about the current
  // report whenever it changes, including changing to null.
  useEffect(() => {
    onReportChange?.(report);
  }, [report, onReportChange]);

  const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const getWeightStatusSubtext = () => {
    const w = parseFloat(weight.toString());
    if (w > idealWeight.max) return "Consider an active, balanced routine.";
    if (w < idealWeight.min) return "Focus on nutrient-dense meals.";
    return "Keep up the excellent habits!";
  };

  const handleJumpToClassification = () => {
    activeClassificationRowRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    setClassificationPulse(true);
    window.setTimeout(() => setClassificationPulse(false), 1600);
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: Settings Switchers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 text-center md:text-left">
            Measurement Unit
          </label>
          <div className="bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg flex w-full" role="group" aria-label="Unit selection">
            <button
              type="button"
              aria-pressed={unit === 'metric'}
              onClick={() => handleUnitToggle('metric')}
              className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 ${
                unit === 'metric' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Metric
            </button>
            <button
              type="button"
              aria-pressed={unit === 'imperial'}
              onClick={() => handleUnitToggle('imperial')}
              className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 ${
                unit === 'imperial' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Imperial
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 text-center md:text-left">
            Calculation Standard
          </label>
          <div className="bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg flex w-full" role="group" aria-label="Region selection">
            <button
              type="button"
              aria-pressed={region === 'who'}
              onClick={() => { setRegion('who'); resetCalculation(); }}
              className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 ${
                region === 'who' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Global (WHO)
            </button>
            <button
              type="button"
              aria-pressed={region === 'asia-pacific'}
              onClick={() => { setRegion('asia-pacific'); resetCalculation(); }}
              className={`flex-1 px-4 py-2.5 rounded-md font-bold transition-all duration-200 ${
                region === 'asia-pacific' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Asia-Pacific
            </button>
          </div>
        </div>
      </div>

      <hr className="border-t border-neutral-200 dark:border-neutral-800" />
      
      {/* SECTION 2: Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="age-input" className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Age (years)
            <span className="group relative cursor-pointer">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-neutral-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                Standard adult BMI guidelines apply to individuals aged 20 to 120.
              </span>
            </span>
          </label>
          <input
            id="age-input"
            type="number"
            value={age}
            onChange={(e) => handleAgeChange(e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white ${noSpinnerClass} ${
              ageError ? 'border-red-500 focus:ring-red-500' : 'border-neutral-300 dark:border-neutral-600 focus:ring-primary-500'
            }`}
            placeholder="e.g. 30" min="20" max="120"
          />
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
            <span className="group relative cursor-pointer">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-neutral-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                While the BMI formula is identical for all adults, biological sex influences healthy body fat and muscle distribution limits.
              </span>
            </span>
          </label>
          <div className="flex bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg h-[50px]">
            <button
              type="button"
              onClick={() => { setGender('male'); setIsPregnant(false); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${gender === 'male' ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => { setGender('female'); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${gender === 'female' ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Female
            </button>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Athletic Build?
            <span className="group relative cursor-pointer">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-neutral-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                Select 'Yes' if you have significant muscle mass. This adjusts the clinical interpretation of high BMI scores.
              </span>
            </span>
          </label>
          <div className="flex bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg h-[50px]">
            <button
              type="button"
              onClick={() => { setIsAthletic(false); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${!isAthletic ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => { setIsAthletic(true); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${isAthletic ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Yes
            </button>
          </div>
        </div>
      </div>

      {gender === 'female' && (
        <div className="max-w-md mx-auto">
          <label className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Currently Pregnant?
            <span className="group relative cursor-pointer">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-neutral-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                WHO and CDC guidance states standard BMI weight-status categories don't apply during pregnancy, since weight naturally increases for reasons unrelated to body fat.
              </span>
            </span>
          </label>
          <div className="flex bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg h-[50px]">
            <button
              type="button"
              onClick={() => { setIsPregnant(false); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${!isPregnant ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => { setIsPregnant(true); resetCalculation(); }}
              className={`flex-1 rounded-md font-medium transition-all ${isPregnant ? 'bg-white dark:bg-neutral-600 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
            >
              Yes
            </button>
          </div>
        </div>
      )}

      <hr className="border-t border-neutral-200 dark:border-neutral-800" />

      {/* SECTION 3: Measurements (Constrained Width) */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 sm:p-5 md:p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-4">
            Height {unit === 'metric' ? '(cm)' : '(ft & in)'}
          </label>
          
          {unit === 'metric' ? (
            <input
              id="height-input"
              type="number"
              value={height}
              onChange={(e) => { setHeight(e.target.value); resetCalculation(); }}
              className={`w-full px-4 py-3.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-700 shadow-sm ${noSpinnerClass}`}
              placeholder="e.g. 170"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type="number"
                  value={heightFt}
                  onChange={(e) => { setHeightFt(e.target.value); resetCalculation(); }}
                  className={`w-full px-4 py-3.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-700 shadow-sm ${noSpinnerClass}`}
                  placeholder="ft" min="3" max="8"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium pointer-events-none">ft</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={heightIn}
                  onChange={(e) => { setHeightIn(e.target.value); resetCalculation(); }}
                  className={`w-full px-4 py-3.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-700 shadow-sm ${noSpinnerClass}`}
                  placeholder="in" min="0" max="11"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium pointer-events-none">in</span>
              </div>
            </div>
          )}
          {heightError && <p className="mt-3 text-sm font-medium text-red-500">{heightError}</p>}
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 sm:p-5 md:p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <label htmlFor="weight-input" className="block text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-4">
            Weight {unit === 'metric' ? '(kg)' : '(lbs)'}
          </label>
          <input
            id="weight-input"
            type="number"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); resetCalculation(); }}
            className={`w-full px-4 py-3.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-700 shadow-sm ${noSpinnerClass}`}
            placeholder={`e.g. ${unit === 'metric' ? '70' : '150'}`}
          />
          {weightError && <p className="mt-3 text-sm font-medium text-red-500">{weightError}</p>}
        </div>
      </div>

      {!isPregnant && (
        <div className="max-w-3xl mx-auto">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 sm:p-5 md:p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <label htmlFor="waist-input" className="flex items-center gap-1.5 text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-4">
              Waist Circumference {unit === 'metric' ? '(cm)' : '(inches)'}
              <span className="text-xs font-semibold text-neutral-400 normal-case">— Optional</span>
              <span className="group relative cursor-pointer">
                <SafeIcon icon={FiInfo} className="w-4 h-4 text-neutral-400" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-neutral-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                  Add this to see your waist-to-height ratio and WHO's waist-circumference risk screen — both complement BMI by flagging central body fat that BMI alone can miss. Measure midway between your lowest rib and hip bone.
                </span>
              </span>
            </label>
            <input
              id="waist-input"
              type="number"
              value={waist}
              onChange={(e) => { setWaist(e.target.value); resetCalculation(); }}
              className={`w-full px-4 py-3.5 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-neutral-700 shadow-sm ${noSpinnerClass}`}
              placeholder={`e.g. ${unit === 'metric' ? '85' : '33'}`}
            />
            {waistError && <p className="mt-3 text-sm font-medium text-red-500">{waistError}</p>}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse md:flex-row justify-center items-center gap-4 pt-4">
        <button
          type="button"
          onClick={handleClear}
          disabled={isClearDisabled}
          className="w-full md:w-auto px-8 py-3.5 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-neutral-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={isCalculateDisabled}
          className="w-full md:w-auto px-12 py-3.5 bg-indigo-600 hover:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold uppercase tracking-wider rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          Calculate
        </button>
      </div>

      {/* EMPTY STATE (Step 7) — subtle placeholder shown before any calculation,
          instead of a blank gap under the form. Hidden once a validation error is
          showing (those messages already sit next to the relevant field) and once
          a result exists. Purely decorative/informational — no logic, no state. */}
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
            Fill in your age, height, and weight above, then press Calculate to see your personalized BMI results.
          </p>
        </motion.div>
      )}

      {/* RESULTS SECTIONS - Hidden until calculated */}
      {hasCalculated && !hasError && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="space-y-6 pt-4"
        >
          {isPregnant ? (
            <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-rose-200 dark:border-rose-900/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] flex flex-col md:flex-row items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-50 dark:bg-rose-900/20 shadow-sm border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
                <SafeIcon icon={FiHeart} className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">Standard BMI Categories Don't Apply During Pregnancy</h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  BMI reflects total body weight, which naturally increases during pregnancy due to the growing baby, placenta, and fluids — not body fat. Applying standard weight-status categories (underweight, normal, overweight, obese) to your current weight would be misleading, so we're not showing one.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-3">
                  CDC and IOM pregnancy weight-gain guidelines are instead based on your BMI calculated from your <strong className="text-neutral-900 dark:text-white">pre-pregnancy</strong> weight. If you'd like that figure, re-run this calculator with your pre-pregnancy weight and toggle "Currently Pregnant" to No.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mt-3">
                  For personalized weight-gain guidance during pregnancy, please consult your healthcare provider.
                </p>
              </div>
            </div>
          ) : (
          <>
          {/* ELITE 4K SVG GAUGE & OVERLAY (Compact Profile) */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] relative overflow-hidden flex flex-col items-center">
            
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 opacity-20 blur-[80px] rounded-full pointer-events-none transition-colors duration-700 ${currentColors.bg}`} />

            <div className="w-full flex justify-between items-center mb-6 z-10">
              <h3 className="text-lg md:text-xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">BMI Scale</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/50 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700">
                {region === 'who' ? 'WHO Standard' : 'Asia-Pacific'}
              </span>
            </div>

            <div className="relative w-full max-w-[360px] mx-auto z-10">
              <svg viewBox="0 0 400 220" className="w-full h-auto overflow-visible filter drop-shadow-sm" aria-hidden="true">
                <path d={describeArc(200, 180, 150, 0, 180)} fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" className="text-neutral-100 dark:text-neutral-700/50" />
                
                {bmiRanges.map((range, i) => {
                  const startAngle = bmiToAngle(range.min);
                  const endAngle = bmiToAngle(range.max);
                  const segmentColors = getCategoryColors(range.category);
                  return (
                    <path
                      key={i}
                      d={describeArc(200, 180, 150, startAngle, endAngle - (i === bmiRanges.length - 1 ? 0 : 1.5))}
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
                  key={bmi}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm ${currentColors.text}`}
                  aria-live="polite"
                >
                  {bmi.toFixed(1)}
                </motion.span>
                <span className={`text-sm font-bold uppercase tracking-[0.15em] mt-1 ${currentColors.text}`}>
                  {category}
                </span>
                <button
                  type="button"
                  onClick={handleJumpToClassification}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  style={{ borderColor: currentColors.hex, color: currentColors.hex }}
                >
                  <SafeIcon icon={FiArrowDown} className="w-3.5 h-3.5" />
                  See in Classification Table
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC WELLNESS OVERVIEW CARD */}
          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md group">
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-300 ${currentColors.bg}`} />
            <div className="relative z-10 flex flex-col md:flex-row items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white dark:bg-neutral-900/50 shadow-sm border border-neutral-100 dark:border-neutral-700/50 ${currentColors.text}`}>
                <SafeIcon icon={FiHeart} className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-2">Wellness Overview</h3>
                <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium md:text-lg">
                  {getBMIInsight(category, isAthletic)}
                </p>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-700/50">
                  {getGenderContextNote(gender)}
                </p>
              </div>
            </div>
          </div>

          {/* PREMIUM RESULTS CARDS (UNIFIED STYLING) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-500 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-purple-600 dark:text-purple-400">
                  <SafeIcon icon={FiTarget} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Healthy Weight</h3>
                  <p className="text-xs font-semibold text-neutral-400">Standard guideline</p>
                </div>
              </div>
              <div className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {idealWeight.max === 0 ? '--' : `${idealWeight.min.toFixed(1)} - ${idealWeight.max.toFixed(1)}`}
                <span className="text-base font-bold text-neutral-500 uppercase ml-2">{unit === 'metric' ? 'kg' : 'lbs'}</span>
              </div>
              <div className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mt-2">
                Optimal target for your height.
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-500 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-teal-600 dark:text-teal-400">
                  <SafeIcon icon={FiTrendingUp} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Weight Status</h3>
                  <p className="text-xs font-semibold text-neutral-400">Health indicator</p>
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {idealWeight.max === 0
                  ? '--'
                  : parseFloat(weight.toString()) > idealWeight.max ? 'Above Guideline' : 
                    parseFloat(weight.toString()) < idealWeight.min ? 'Below Guideline' : 'Within Range'}
              </div>
              <div className="text-sm font-bold text-teal-600 dark:text-teal-500 mt-2">
                {getWeightStatusSubtext()}
              </div>
            </div>
          </div>

          {/* SECONDARY METRICS: BMI PRIME & PONDERAL INDEX */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-sky-500 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-sky-600 dark:text-sky-400">
                  <SafeIcon icon={FiActivity} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">BMI Prime</h3>
                  <p className="text-xs font-semibold text-neutral-400">Ratio to normal limit (25)</p>
                </div>
              </div>
              <div className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {bmiPrime === 0 ? '--' : bmiPrime.toFixed(2)}
              </div>
              <div className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mt-2">
                {bmiPrime === 0 ? 'Enter your details above.' : bmiPrime < 1 ? 'Below the normal-weight ceiling.' : 'At or above the normal-weight ceiling.'}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500 transition-opacity" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-amber-600 dark:text-amber-400">
                  <SafeIcon icon={FiBarChart2} className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Ponderal Index</h3>
                  <p className="text-xs font-semibold text-neutral-400">Height-weighted alternative</p>
                </div>
              </div>
              <div className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {ponderalIndex === 0 ? '--' : ponderalIndex.toFixed(1)}
                <span className="text-base font-bold text-neutral-500 uppercase ml-2">kg/m³</span>
              </div>
              <div className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mt-2">
                More reliable than BMI for very tall or short individuals.
              </div>
            </div>
          </div>

          {/* WAIST-TO-HEIGHT RATIO & WHO WAIST-RISK (only shown when waist was provided) */}
          {whtrCategory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
                <div className={`absolute top-0 left-0 w-full h-1.5 transition-opacity ${
                  whtrCategory === 'High risk' ? 'bg-red-500' : whtrCategory === 'Increased risk' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-cyan-600 dark:text-cyan-400">
                    <SafeIcon icon={FiTarget} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Waist-to-Height Ratio</h3>
                    <p className="text-xs font-semibold text-neutral-400">NICE guideline (WHtR &lt; 0.50)</p>
                  </div>
                </div>
                <div className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {whtr.toFixed(2)}
                </div>
                <div className={`text-sm font-bold mt-2 ${
                  whtrCategory === 'High risk' ? 'text-red-500' : whtrCategory === 'Increased risk' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {whtrCategory}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 shadow-md hover:shadow-lg transition-shadow group">
                <div className={`absolute top-0 left-0 w-full h-1.5 transition-opacity ${
                  waistRiskLevel === 'Substantially increased risk' ? 'bg-red-500' : waistRiskLevel === 'Increased risk' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900/50 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700/50 text-orange-600 dark:text-orange-400">
                    <SafeIcon icon={FiAlertCircle} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Waist Risk (WHO)</h3>
                    <p className="text-xs font-semibold text-neutral-400">Sex-specific threshold, in cm</p>
                  </div>
                </div>
                <div className={`text-2xl md:text-3xl font-black tracking-tight ${
                  waistRiskLevel === 'Substantially increased risk' ? 'text-red-500' : waistRiskLevel === 'Increased risk' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {waistRiskLevel}
                </div>
                <div className="text-sm font-bold text-neutral-500 dark:text-neutral-400 mt-2">
                  {gender === 'male' ? 'Threshold: 94cm / 102cm (men)' : 'Threshold: 80cm / 88cm (women)'}
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC BMI MATRIX GRID */}
          {gridData && (
            <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden overflow-x-auto">
              <div className="p-6 md:p-8 min-w-[600px]">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white mb-2">Your BMI Matrix</h3>
                    <span className="text-sm font-medium text-neutral-500">Center highlights your exact metrics</span>
                  </div>
                  {/* Universal Color Legend */}
                  <div className="flex gap-4 text-xs font-bold uppercase tracking-wider bg-neutral-50 dark:bg-neutral-900/50 py-2 px-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></span>Under</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></span>Normal</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm"></span>Over</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-sm"></span>Obese</div>
                  </div>
                </div>
                
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border-b border-r border-neutral-200 dark:border-neutral-700 text-xs text-neutral-400 uppercase tracking-wide">
                        W \ H
                      </th>
                      {gridData.heights.map((h, i) => (
                        <th key={i} className={`p-2 border-b border-neutral-200 dark:border-neutral-700 text-sm font-bold ${i === 4 ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
                          {unit === 'metric' ? `${h} cm` : `${Math.floor(h/12)}'${h%12}"`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridData.weights.map((w, rowIdx) => (
                      <tr key={rowIdx}>
                        <td className={`p-2 border-r border-neutral-200 dark:border-neutral-700 text-sm font-bold ${rowIdx === 4 ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
                          {w} {unit === 'metric' ? 'kg' : 'lbs'}
                        </td>
                        {gridData.heights.map((h, colIdx) => {
                          const cell = gridData.grid[rowIdx][colIdx];
                          const colors = getCategoryColors(cell.category);
                          const isCenter = rowIdx === 4 && colIdx === 4;
                          return (
                            <td key={colIdx} className="p-1 border border-transparent">
                              <div className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${isCenter ? 'ring-2 ring-offset-2 ring-neutral-800 dark:ring-white scale-110 shadow-lg z-10 relative' : 'opacity-90'} ${colors.bg} text-white`}>
                                {cell.bmi.toFixed(1)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* REFINED CATEGORY TABLE */}
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800/30">
              <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white">
                Detailed Classification {region === 'asia-pacific' ? '(Asia-Pacific)' : '(WHO)'}
              </h3>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {bmiRanges.map((range, index) => {
                const rowColors = getCategoryColors(range.category);
                const isActive = index === activeRangeIndex;
                return (
                  <div
                    key={index}
                    ref={isActive ? activeClassificationRowRef : undefined}
                    className={`flex items-center justify-between px-6 md:px-8 py-5 transition-all duration-300 relative ${
                      isActive ? 'bg-neutral-50 dark:bg-neutral-700/20 shadow-inner' : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50'
                    } ${isActive && classificationPulse ? 'scale-[1.01]' : ''}`}
                    style={isActive && classificationPulse ? { boxShadow: `inset 0 0 0 2px ${rowColors.hex}` } : undefined}
                  >
                    {/* Left Accent for active row — same color as the gauge needle's category */}
                    {isActive && (
                      <div className={`absolute left-0 top-0 w-1.5 h-full ${rowColors.bg}`} />
                    )}

                    <div className="flex items-center space-x-5 pl-2">
                      <div className={`w-3.5 h-3.5 rounded-full ${rowColors.bg} shadow-sm`}></div>
                      <span className={`text-lg tracking-tight ${isActive ? 'font-black text-neutral-900 dark:text-white' : 'font-semibold text-neutral-600 dark:text-neutral-400'}`}>
                        {range.category}
                      </span>
                      {isActive && (
                        <span
                          className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${rowColors.hex}1A`, color: rowColors.hex }}
                        >
                          Your Result
                        </span>
                      )}
                    </div>
                    <span className={`text-base tracking-wide font-bold px-4 py-2 rounded-lg border ${
                      isActive ? `bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 shadow-sm` : 'bg-transparent text-neutral-500 border-transparent'
                    }`}>
                      {range.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          </>
          )}
        </motion.div>
      )}

      {/* Concise Legal/Medical Disclaimer */}
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3 mt-8">
        <p className="leading-relaxed">
          <strong className="text-neutral-900 dark:text-neutral-200">Disclaimer:</strong> This BMI calculator provides a general guide, not medical advice. BMI does not account for muscle mass, age, or ethnic differences; highly muscular individuals may be falsely classified as overweight. Always consult a healthcare professional before altering your diet or lifestyle.
        </p>
      </div>
    </div>
  );
};

export default BMICalculator;
