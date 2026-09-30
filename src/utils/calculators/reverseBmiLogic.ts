import {
  getBMIRanges,
  validateBMIInput,
  type BMIRange,
  type BMIRegion,
  type BMIUnit,
  type ValidationResult,
} from './bmiLogic';

/**
 * Reverse BMI logic — adults only. Two directions: height + target BMI -> weight, weight + target BMI -> height.
 * (Weight + height -> BMI is deliberately not here: that is the BMI calculator's job.)
 *
 * PROVENANCE (all public domain):
 *  - BMI = weight(kg) / height(m)^2 and its algebraic rearrangements: standard public math.
 *  - Imperial form BMI = 703 x weight(lb) / height(in)^2: standard public unit-converted form
 *    (identical to the constant already used in bmiLogic.calculateBMI).
 *  - Category cut-offs are NOT hard-coded here: they come from getBMIRanges() in bmiLogic.ts
 *    (WHO adult classification / WHO Asia-Pacific), so labels always match the BMI calculator.
 *  - Difference, percent change and weeks-to-goal are plain arithmetic.
 * Nothing in this file is copied from any website, competitor or proprietary model.
 */

export type { BMIRegion, BMIUnit };
export type ReverseMode = 'weight' | 'height';

/** Solve for weight: height + target BMI. Height in cm (metric) or inches (imperial). */
export interface SolveWeightInput {
  mode: 'weight';
  unit: BMIUnit;
  region: BMIRegion;
  height: number;
  targetBMI: number;
}
/** Solve for height: weight + target BMI. Weight in kg (metric) or lb (imperial). */
export interface SolveHeightInput {
  mode: 'height';
  unit: BMIUnit;
  region: BMIRegion;
  weight: number;
  targetBMI: number;
}
export type ReverseInput = SolveWeightInput | SolveHeightInput;

export interface ReverseResult {
  mode: ReverseMode;
  unit: BMIUnit;
  region: BMIRegion;
  /** kg (metric) or lb (imperial). */
  weight: number;
  /** cm (metric) or inches (imperial). */
  height: number;
  bmi: number;
  category: string;
}

export type ReverseOutcome =
  | { ok: true; result: ReverseResult }
  | { ok: false; error: string };

// --- LIMITS -------------------------------------------------------------

/**
 * Data-entry sanity bounds for the form, in each field's displayed unit.
 * These MUST match validateBMIInput in bmiLogic.ts (height 30-300 cm / 12-118 in,
 * weight 1-500 kg / 2-1100 lb). They live here, once, so the component never keeps its own copy.
 * Pace bounds are sanity limits only, not advice.
 */
export const REVERSE_INPUT_LIMITS = {
  metric: {
    height: { min: 30, max: 300, label: 'cm' },
    weight: { min: 1, max: 500, label: 'kg' },
    pace: { min: 0.05, max: 5, label: 'kg' },
  },
  imperial: {
    height: { min: 12, max: 118, label: 'in' },
    weight: { min: 2, max: 1100, label: 'lbs' },
    // 11 lbs (not 10) so the same pace is valid in both units: the metric cap of 5 kg is 11.02 lbs,
    // and a value of 5 kg/wk converted on a unit toggle must not fail imperial validation.
    pace: { min: 0.1, max: 11, label: 'lbs' },
  },
} as const;

/** Target BMI limits follow the span of the app's own BMI bands (first band min, last band max). */
export const getTargetBMILimits = (region: BMIRegion): { min: number; max: number } => {
  const ranges = getBMIRanges(region);
  return { min: ranges[0].min, max: ranges[ranges.length - 1].max };
};

// --- CORE MATH ----------------------------------------------------------

/** BMI = kg / m^2  ->  kg = BMI x m^2   |   lb = BMI x in^2 / 703 */
export const weightForBMI = (targetBMI: number, height: number, unit: BMIUnit): number => {
  if (unit === 'metric') {
    const m = height / 100;
    return targetBMI * m * m;
  }
  return (targetBMI * height * height) / 703;
};

/** m = sqrt(kg / BMI)  ->  cm   |   in = sqrt(703 x lb / BMI) */
export const heightForBMI = (weight: number, targetBMI: number, unit: BMIUnit): number => {
  if (unit === 'metric') return Math.sqrt(weight / targetBMI) * 100;
  return Math.sqrt((703 * weight) / targetBMI);
};

export const roundTo = (value: number, decimals = 1): number => {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
};

/** Category label for a BMI value, using the same first-band-whose-max-exceeds-value walk as calculateBMI. */
export const getCategoryForBMI = (bmi: number, region: BMIRegion): string => {
  const ranges = getBMIRanges(region);
  for (const range of ranges) {
    if (bmi < range.max) return range.category;
  }
  return ranges[ranges.length - 1].category;
};

// --- VALIDATION ---------------------------------------------------------

const validateTargetBMI = (targetBMI: number, region: BMIRegion): ValidationResult => {
  if (!Number.isFinite(targetBMI) || targetBMI <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for target BMI.' };
  }
  const { min, max } = getTargetBMILimits(region);
  if (targetBMI < min || targetBMI > max) {
    return { isValid: false, error: `Target BMI must be between ${min} and ${max}.` };
  }
  return { isValid: true };
};

/** Reuses validateBMIInput for weight/height limits so limits never drift from the BMI calculator. */
export const validateReverseInput = (input: ReverseInput): ValidationResult => {
  switch (input.mode) {
    case 'weight': {
      // Weight is a placeholder within limits; only height is being checked here.
      const h = validateBMIInput(input.unit === 'metric' ? 50 : 110, input.height, input.unit);
      if (!h.isValid) return h;
      return validateTargetBMI(input.targetBMI, input.region);
    }
    case 'height': {
      const w = validateBMIInput(input.weight, input.unit === 'metric' ? 170 : 67, input.unit);
      if (!w.isValid) return w;
      return validateTargetBMI(input.targetBMI, input.region);
    }
  }
};

// --- SOLVE --------------------------------------------------------------

export const solveReverseBMI = (input: ReverseInput): ReverseOutcome => {
  const check = validateReverseInput(input);
  if (!check.isValid) return { ok: false, error: check.error ?? 'Please check your entries.' };

  let weight: number;
  let height: number;
  const bmi = input.targetBMI;

  if (input.mode === 'weight') {
    height = input.height;
    weight = weightForBMI(bmi, height, input.unit);
  } else {
    weight = input.weight;
    height = heightForBMI(weight, bmi, input.unit);
  }

  // The solved value must itself be inside the app's accepted limits.
  const solved = validateBMIInput(weight, height, input.unit);
  if (!solved.isValid) {
    return { ok: false, error: `The result falls outside the supported range. ${solved.error ?? ''}`.trim() };
  }

  return {
    ok: true,
    result: {
      mode: input.mode,
      unit: input.unit,
      region: input.region,
      weight,
      height,
      bmi,
      category: getCategoryForBMI(bmi, input.region),
    },
  };
};

// --- RANGES & TABLES ----------------------------------------------------

/** Step used to express a band's upper edge the way labels do (e.g. "18.5 - 24.9"). Same convention as bmiLogic ideal weight. */
const BAND_EDGE_STEP = 0.1;

export interface HealthyWeightRange {
  bmiMin: number;
  bmiMax: number;
  weightMin: number;
  weightMax: number;
}

const findNormalBand = (region: BMIRegion): BMIRange => {
  const ranges = getBMIRanges(region);
  return ranges.find((r) => r.category === 'Normal range') ?? ranges[1];
};

/** Weight span for the region's "Normal range" band at a given height (WHO 18.5-24.9, Asia-Pacific 18.5-22.9). */
export const getHealthyWeightRange = (height: number, unit: BMIUnit, region: BMIRegion): HealthyWeightRange => {
  const band = findNormalBand(region);
  const bmiMax = roundTo(band.max - BAND_EDGE_STEP, 1);
  return {
    bmiMin: band.min,
    bmiMax,
    weightMin: weightForBMI(band.min, height, unit),
    weightMax: weightForBMI(bmiMax, height, unit),
  };
};

export interface CategoryWeightRow {
  category: string;
  label: string;
  /** null for the open-ended first band. */
  weightFrom: number | null;
  /** null for the open-ended last band. */
  weightTo: number | null;
}

/** One row per BMI band for the user's height. Open-ended first/last bands leave one side null. */
export const getCategoryWeightTable = (height: number, unit: BMIUnit, region: BMIRegion): CategoryWeightRow[] => {
  const ranges = getBMIRanges(region);
  return ranges.map((r, i) => ({
    category: r.category,
    label: r.label,
    weightFrom: i === 0 ? null : weightForBMI(r.min, height, unit),
    weightTo: i === ranges.length - 1 ? null : weightForBMI(roundTo(r.max - BAND_EDGE_STEP, 1), height, unit),
  }));
};

export const DEFAULT_WHAT_IF_TARGETS = [18.5, 22, 25, 30] as const;

export interface WhatIfRow {
  targetBMI: number;
  weight: number;
  category: string;
}

export const getWhatIfTable = (
  height: number,
  unit: BMIUnit,
  region: BMIRegion,
  targets: readonly number[] = DEFAULT_WHAT_IF_TARGETS
): WhatIfRow[] =>
  targets.map((t) => ({
    targetBMI: t,
    weight: weightForBMI(t, height, unit),
    category: getCategoryForBMI(t, region),
  }));

// --- CURRENT VS TARGET & PACE ------------------------------------------

export interface WeightDifference {
  /** target - current (negative = lower than current). */
  difference: number;
  /** difference / current x 100. */
  percent: number;
  direction: 'lower' | 'higher' | 'same';
}

export const getWeightDifference = (current: number, target: number): WeightDifference => {
  const difference = target - current;
  return {
    difference,
    percent: current > 0 ? (difference / current) * 100 : 0,
    direction: Math.abs(difference) < 0.05 ? 'same' : difference < 0 ? 'lower' : 'higher',
  };
};

/** Pure arithmetic: weeks = |difference| / chosen weekly pace. The user picks the pace; no recommendation is made. */
export const getWeeksAtPace = (difference: number, weeklyPace: number): number | null => {
  if (!Number.isFinite(weeklyPace) || weeklyPace <= 0) return null;
  return Math.abs(difference) / weeklyPace;
};

// --- UNIT DISPLAY HELPERS ----------------------------------------------

export const feetInchesToInches = (feet: number, inches: number): number => feet * 12 + inches;

export const inchesToFeetInches = (totalInches: number): { feet: number; inches: number } => {
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: totalInches - feet * 12 };
};

/** 1 stone = 14 lb (standard definition). */
export const poundsToStone = (lb: number): { stone: number; pounds: number } => {
  const stone = Math.floor(lb / 14);
  return { stone, pounds: lb - stone * 14 };
};

// --- SAFETY NOTES -------------------------------------------------------

export type SafetyTone = 'info' | 'caution';
export interface SafetyNote {
  id: string;
  tone: SafetyTone;
  text: string;
}

/**
 * PROJECT HEURISTIC (not from a published source): a change larger than this share of current
 * body weight is flagged for extra care. Adjust freely; it makes no medical claim.
 */
export const LARGE_CHANGE_PERCENT = 20;

export const getSafetyNotes = (opts: {
  targetBMI: number;
  region: BMIRegion;
  current?: number | null;
  target?: number | null;
}): SafetyNote[] => {
  const notes: SafetyNote[] = [
    {
      id: 'screening',
      tone: 'info',
      text: 'BMI is a screening measure. It does not account for muscle, age or body composition, so treat any result as a starting point.',
    },
  ];
  const band = findNormalBand(opts.region);
  if (opts.targetBMI < band.min) {
    notes.push({
      id: 'below-range',
      tone: 'caution',
      text: 'This target sits below the healthy range for the selected standard. A health professional can help you decide what is right for you.',
    });
  }
  if (opts.current && opts.target && opts.current > 0) {
    const { percent } = getWeightDifference(opts.current, opts.target);
    if (Math.abs(percent) > LARGE_CHANGE_PERCENT) {
      notes.push({
        id: 'large-change',
        tone: 'caution',
        text: 'This is a large change from your current weight. Consider talking it through with a health professional before setting a goal.',
      });
    }
  }
  return notes;
};

// --- SOURCES (cite by title + link; all wording is our own) -------------

/** Same shape as the SourceEntry list used by BMICalculator.tsx so the Sources panel renders identically. */
export interface ReverseSource {
  metric: string;
  citation: string;
  /** Omitted for plain public mathematics that has no single source page. */
  url?: string;
  linkLabel?: string;
}

// Every link below was opened and checked against the numbers used in this calculator.
// The wording of each summary is our own; only titles, links and numeric cut-offs are taken from sources.
// Project-made choices (input limits, what-if targets, the 20% large-change caution) are disclosed in the panel footer.
export const REVERSE_BMI_SOURCES: ReverseSource[] = [
  {
    metric: 'BMI Formula and Its Rearrangements',
    citation:
      'BMI is weight in kilograms divided by height in metres squared. Solving for weight multiplies the BMI by height squared; solving for height takes the square root of weight divided by BMI. The imperial form uses the standard factor of 703 with pounds and inches. This is plain public mathematics.',
  },
  {
    metric: 'Unit Conversions',
    citation:
      'One inch is exactly 2.54 centimetres and one pound is exactly 0.45359237 kilograms, by international agreement. Secondary figures use 1 kg = 2.20462 lb, and one stone is 14 pounds. These are standard definitions.',
  },
  {
    metric: 'Adult BMI Categories',
    citation:
      'The adult cut-offs (18.5, 25, 30, 35 and 40), the three obesity classes, the scope of adults 20 and older, and the reminder that BMI is a screening measure rather than a diagnosis.',
    url: 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html',
    linkLabel: 'CDC \u2014 Adult BMI Categories',
  },
  {
    metric: 'Overweight and Obesity Definitions',
    citation: 'Confirms the adult definitions of overweight (25 to 29.9) and obesity (30 and above).',
    url: 'https://www.cdc.gov/nchs/dqs/topics/overweight-obesity.html',
    linkLabel: 'CDC NCHS \u2014 Overweight and Obesity',
  },
  {
    metric: 'WHO Thinness Cut-offs',
    citation:
      'Explains the cut-offs behind the Global standard: below 18.5 for underweight and below 17.0 for moderate and severe thinness.',
    url: 'https://apps.who.int/nutrition/landscape/help.aspx?menu=0&helpid=420',
    linkLabel: 'WHO Nutrition Landscape Information System \u2014 BMI indicators',
  },
  {
    metric: 'Asia-Pacific BMI Classification',
    citation:
      'The Asia-Pacific standard: a normal range of 18.5 to 22.9, overweight from 23.0, and obesity classes from 25.0 and 30.0. It comes from a 2000 report by the WHO Western Pacific Region, IASO and IOTF for Asian populations.',
    url: 'https://www.worldobesity.org/about/about-obesity/obesity-classification',
    linkLabel: 'World Obesity Federation \u2014 Obesity Classification',
  },
  {
    metric: 'WHO Expert Consultation on BMI in Asian Populations',
    citation:
      'A 2004 WHO review found that risk of type 2 diabetes and heart disease can rise at BMIs below 25 in Asian populations. It named further action points (23.0, 27.5, 32.5 and 37.5) instead of one new set of cut-offs, which is why the Asia-Pacific option is shown as an alternative view.',
    url: 'https://doi.org/10.1016/S0140-6736(03)15268-3',
    linkLabel: 'The Lancet 2004;363(9403):157\u2013163',
  },
  {
    metric: 'Weekly Pace Background',
    citation:
      'Background for the pace guide only: people who lose weight at a gradual, steady pace of about 1 to 2 pounds a week are more likely to keep it off than people who lose it quickly. The calculator never recommends a pace.',
    url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
    linkLabel: 'CDC \u2014 Steps for Losing Weight',
  },
  {
    metric: 'Healthy Weight Range',
    citation:
      'Calculated by multiplying the lower and upper edges of the selected standard\u2019s normal band (upper edge 24.9 or 22.9) by height squared. It is a derived figure, not a separately published guideline.',
  },
  {
    metric: 'Difference, Percent Change and Weeks at Pace',
    citation:
      'Difference is target minus current weight. Percent change is that difference divided by current weight. Weeks is the size of the difference divided by the weekly pace you choose. All plain arithmetic.',
  },
];
