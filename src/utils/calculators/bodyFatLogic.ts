// --- TYPES ---

export type BodyFatUnit = 'metric' | 'imperial';
export type BodyFatGender = 'male' | 'female';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface BodyFatFormulaResult {
  formula: 'navy' | 'army' | 'deurenberg';
  label: string; // e.g. "US Navy (circumference)"
  bodyFatPercent: number;
  isPrimary: boolean; // true for Navy — shown as the headline number
  requiresCircumference: boolean; // true for Navy, false for Deurenberg
}

export interface BodyFatResult {
  results: BodyFatFormulaResult[];
  primaryBodyFat: number; // Navy value, used as headline
  averageBodyFat: number; // mean of all computed formulas
  spreadPercent: number; // max - min across computed formulas
  category: string; // e.g. "Fit"
  categoryLabel: string; // e.g. "14% – 17%"
  fatMassKg: number;
  leanMassKg: number;
  confidenceNote: string;
}

export interface BodyFatRange {
  category: string;
  min: number;
  max: number;
  label: string; // e.g. "14 – 17%"
}

export interface SourceEntry {
  metric: string;
  citation: string;
  url?: string;
  linkLabel?: string;
}

// --- VALIDATION ---
// Mirrors validateBMRInput / validateBMIInput's structure and bounds
// (same sanity-limit philosophy as the other two calculators, so all
// three feel consistent).

export const validateBodyFatInput = (
  weight: number,
  height: number,
  age: number,
  unit: BodyFatUnit
): ValidationResult => {
  if (!Number.isFinite(weight) || Number.isNaN(weight) || weight <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for weight.' };
  }
  if (!Number.isFinite(height) || Number.isNaN(height) || height <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for height.' };
  }
  if (!Number.isFinite(age) || Number.isNaN(age) || age <= 0 || age > 130) {
    return { isValid: false, error: 'Please enter a realistic age.' };
  }

  const limits = unit === 'metric'
    ? { w: [1, 500], h: [30, 300] }
    : { w: [2, 1100], h: [12, 118] };

  if (weight < limits.w[0] || weight > limits.w[1]) {
    return { isValid: false, error: `Weight must be between ${limits.w[0]} and ${limits.w[1]} ${unit === 'metric' ? 'kg' : 'lbs'}.` };
  }
  if (height < limits.h[0] || height > limits.h[1]) {
    return { isValid: false, error: `Height must be between ${limits.h[0]} and ${limits.h[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }

  return { isValid: true };
};

// Circumference bounds are intentionally generous sanity bounds for data
// entry (same spirit as bmiLogic's waist validation), not clinical
// cut-offs. The Navy formula additionally requires waist > neck (and, for
// women, waist + hip > neck) since it takes log10 of that difference —
// validateCircumferences below catches this before it reaches the formula.

export const validateCircumferences = (
  gender: BodyFatGender,
  neckCm: number,
  waistCm: number,
  hipCm: number | null,
  unit: BodyFatUnit
): ValidationResult => {
  const limits = unit === 'metric'
    ? { neck: [15, 80], waist: [40, 300], hip: [40, 300] }
    : { neck: [6, 32], waist: [15, 120], hip: [15, 120] };

  if (!Number.isFinite(neckCm) || neckCm <= 0 || neckCm < limits.neck[0] || neckCm > limits.neck[1]) {
    return { isValid: false, error: `Neck must be between ${limits.neck[0]} and ${limits.neck[1]} ${unit === 'metric' ? 'cm' : 'in'}.` };
  }
  if (!Number.isFinite(waistCm) || waistCm <= 0 || waistCm < limits.waist[0] || waistCm > limits.waist[1]) {
    return { isValid: false, error: `Waist must be between ${limits.waist[0]} and ${limits.waist[1]} ${unit === 'metric' ? 'cm' : 'in'}.` };
  }

  if (gender === 'female') {
    if (!Number.isFinite(hipCm) || (hipCm as number) <= 0 || (hipCm as number) < limits.hip[0] || (hipCm as number) > limits.hip[1]) {
      return { isValid: false, error: `Hip must be between ${limits.hip[0]} and ${limits.hip[1]} ${unit === 'metric' ? 'cm' : 'in'}.` };
    }
    if (waistCm + (hipCm as number) <= neckCm) {
      return { isValid: false, error: 'Waist + hip must be greater than neck — double-check your measurements.' };
    }
  } else if (waistCm <= neckCm) {
    return { isValid: false, error: 'Waist must be greater than neck — double-check your measurements.' };
  }

  return { isValid: true };
};

// --- UNIT CONVERSION ---

interface MetricInputs {
  weightKg: number;
  heightCm: number;
}

const toMetric = (weight: number, height: number, unit: BodyFatUnit): MetricInputs => {
  if (unit === 'metric') {
    return { weightKg: weight, heightCm: height };
  }
  return {
    weightKg: weight / 2.20462,
    heightCm: height * 2.54,
  };
};

const circumferenceToInches = (value: number, unit: BodyFatUnit): number =>
  unit === 'metric' ? value / 2.54 : value;

// --- US NAVY CIRCUMFERENCE METHOD (Hodgdon & Beckett, 1984) ---
// Naval Health Research Center technical report — a U.S. government work,
// public domain. All measurements are converted to inches internally since
// that's the unit the original coefficients were derived in; the UI can
// still display cm to the user.

export const calculateNavyBodyFat = (
  gender: BodyFatGender,
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm: number | null,
  circumferenceUnit: BodyFatUnit
): number => {
  const heightIn = heightCm / 2.54; // height always tracked in cm internally
  const neckIn = circumferenceToInches(neckCm, circumferenceUnit);
  const waistIn = circumferenceToInches(waistCm, circumferenceUnit);
  const hipIn = hipCm !== null ? circumferenceToInches(hipCm, circumferenceUnit) : 0;

  if (gender === 'male') {
    return 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  }
  return 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
};

// --- US ARMY ONE-SITE ABDOMINAL METHOD (Army Directive 2023-11, June 2023) ---
// Replaced the old neck/waist/hip Army tape test (which was identical to
// the Navy formula) with a simpler single-site abdominal circumference +
// weight formula. Source: official DA Form 5500 (recruiting.army.mil), a
// U.S. Army form — public domain. Abdomen is measured at the navel, the
// same landmark this app already uses for Waist, so no extra input field
// is required — the Waist value is reused as the abdomen measurement.

export const calculateArmyBodyFat = (
  gender: BodyFatGender,
  weightLb: number,
  abdomenIn: number
): number => {
  return gender === 'male'
    ? -26.97 - (0.12 * weightLb) + (1.99 * abdomenIn)
    : -9.15 - (0.015 * weightLb) + (1.27 * abdomenIn);
};

// --- BMI-BASED / DEURENBERG METHOD (1991) ---
// Deurenberg P, Weststrate JA, Seidell JC — British Journal of Nutrition,
// a peer-reviewed, publicly published equation. sex: 1 = male, 0 = female.

export const calculateDeurenbergBodyFat = (
  bmi: number,
  age: number,
  gender: BodyFatGender
): number => {
  const sex = gender === 'male' ? 1 : 0;
  return 1.20 * bmi + 0.23 * age - 10.8 * sex - 5.4;
};

// --- CATEGORY TABLE ---
// Standard, widely-republished body-fat category bands (commonly
// attributed to the American Council on Exercise). Wording below is
// original, not copied from any single source.

const MALE_RANGES: BodyFatRange[] = [
  { category: 'Essential fat', min: 2, max: 5, label: '2 – 5%' },
  { category: 'Athletic', min: 6, max: 13, label: '6 – 13%' },
  { category: 'Fit', min: 14, max: 17, label: '14 – 17%' },
  { category: 'Acceptable', min: 18, max: 24, label: '18 – 24%' },
  { category: 'Obese', min: 25, max: 100, label: '25%+' },
];

const FEMALE_RANGES: BodyFatRange[] = [
  { category: 'Essential fat', min: 10, max: 13, label: '10 – 13%' },
  { category: 'Athletic', min: 14, max: 20, label: '14 – 20%' },
  { category: 'Fit', min: 21, max: 24, label: '21 – 24%' },
  { category: 'Acceptable', min: 25, max: 31, label: '25 – 31%' },
  { category: 'Obese', min: 32, max: 100, label: '32%+' },
];

export const getBodyFatRanges = (gender: BodyFatGender): BodyFatRange[] =>
  gender === 'male' ? MALE_RANGES : FEMALE_RANGES;

export const getBodyFatCategory = (bodyFatPercent: number, gender: BodyFatGender): BodyFatRange => {
  const ranges = getBodyFatRanges(gender);
  const clamped = Math.min(Math.max(bodyFatPercent, ranges[0].min), ranges[ranges.length - 1].min);
  return ranges.find((r) => clamped >= r.min && clamped <= r.max) ?? ranges[ranges.length - 1];
};

/**
 * Confidence/agreement note across the two computed formulas — same
 * "explain the spread instead of hiding it" philosophy as getBMRInsight
 * in bmrLogic.ts.
 */
export const getBodyFatInsight = (spreadPercent: number): string => {
  if (spreadPercent < 2) {
    return 'Both methods agree closely, so either value is a reasonable estimate.';
  }
  if (spreadPercent <= 5) {
    return 'A small difference between the circumference-based and BMI-based estimates is normal — the Navy method is generally considered more accurate for most body types.';
  }
  return 'These two methods diverge more than usual, which can happen for very muscular or very lean individuals. The Navy method (based on your actual measurements) is typically the more reliable of the two here.';
};

// --- MAIN CALCULATION ---
// Computes both formulas simultaneously — same "show everything" approach
// as bmiLogic.ts and bmrLogic.ts — and derives fat/lean mass from the
// primary (Navy) result.

export const calculateBodyFat = (
  weight: number,
  height: number,
  age: number,
  gender: BodyFatGender,
  unit: BodyFatUnit,
  bmi: number,
  neck: number,
  waist: number,
  hip: number | null,
  circumferenceUnit: BodyFatUnit
): BodyFatResult => {
  const { weightKg, heightCm } = toMetric(weight, height, unit);

  const navy = calculateNavyBodyFat(gender, heightCm, neck, waist, hip, circumferenceUnit);
  const deurenberg = calculateDeurenbergBodyFat(bmi, age, gender);

  // Army formula needs weight in lb and abdomen in inches regardless of
  // the units the user is entering elsewhere — converted here so callers
  // never have to think about it.
  const weightLb = weightKg * 2.20462;
  const abdomenIn = circumferenceToInches(waist, circumferenceUnit);
  const army = calculateArmyBodyFat(gender, weightLb, abdomenIn);

  const results: BodyFatFormulaResult[] = [
    { formula: 'navy', label: 'US Navy (circumference)', bodyFatPercent: navy, isPrimary: true, requiresCircumference: true },
    { formula: 'army', label: 'US Army (abdominal)', bodyFatPercent: army, isPrimary: false, requiresCircumference: true },
    { formula: 'deurenberg', label: 'BMI-based (Deurenberg)', bodyFatPercent: deurenberg, isPrimary: false, requiresCircumference: false },
  ];

  const values = results.map((r) => r.bodyFatPercent).filter((v) => Number.isFinite(v) && v > 0);
  const averageBodyFat = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const spreadPercent = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;

  const primaryBodyFat = Number.isFinite(navy) && navy > 0 ? navy : averageBodyFat;
  const { category, label: categoryLabel } = getBodyFatCategory(primaryBodyFat, gender);

  const fatMassKg = weightKg * (primaryBodyFat / 100);
  const leanMassKg = weightKg - fatMassKg;

  return {
    results,
    primaryBodyFat,
    averageBodyFat,
    spreadPercent,
    category,
    categoryLabel,
    fatMassKg,
    leanMassKg,
    confidenceNote: getBodyFatInsight(spreadPercent),
  };
};

// --- SOURCES & REFERENCES ---

export const BODY_FAT_SOURCES: SourceEntry[] = [
  {
    metric: 'US Navy Circumference Method',
    citation: 'Hodgdon JA & Beckett MB (1984), Naval Health Research Center Report No. 84-11 — a U.S. government technical report developed for military fitness assessment; U.S. government works of this kind are public domain.',
    url: 'https://apps.dtic.mil/sti/citations/ADA143284',
    linkLabel: 'Hodgdon & Beckett (1984) — Naval Health Research Center',
  },
  {
    metric: 'US Army One-Site Abdominal Formula',
    citation: 'Official U.S. Army tape-test formula per Army Directive 2023-11 (June 2023), reproduced on DA Form 5500 — a U.S. Army form and, as such, public domain. Uses body weight and abdominal circumference measured at the navel.',
    url: 'https://recruiting.army.mil/Portals/15/DA5500.pdf',
    linkLabel: 'DA Form 5500 — U.S. Army Body Fat Content Worksheet (Male)',
  },
  {
    metric: 'BMI-Based / Deurenberg Formula',
    citation: 'Deurenberg P, Weststrate JA, Seidell JC (1991), British Journal of Nutrition — a peer-reviewed equation estimating body fat percentage from BMI, age, and sex.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2043597/',
    linkLabel: 'Deurenberg et al. (1991) — British Journal of Nutrition',
  },
  {
    metric: 'Body Fat Category Bands',
    citation: 'A widely-republished set of body-fat percentage bands (Essential, Athletic, Fit, Acceptable, Obese) commonly attributed to the American Council on Exercise — used here as general educational reference ranges, not a diagnostic standard.',
    url: 'https://www.acefitness.org/',
    linkLabel: 'American Council on Exercise (ACE)',
  },
];
