// --- TYPES ---

export type BodyFatUnit = 'metric' | 'imperial';
export type BodyFatGender = 'male' | 'female';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SourceEntry {
  metric: string;
  citation: string;
  url?: string;
  linkLabel?: string;
}

export interface BodyFatMethodResult {
  method: 'navy' | 'bmi' | 'ymca' | 'rfm' | 'skinfold_jp3';
  label: string;
  bodyFatPercent: number;
  isPrimary: boolean; // true for the Navy method (headline number)
  requiresSkinfold: boolean; // true only for skinfold_jp3
}

export interface BodyFatResult {
  results: BodyFatMethodResult[];
  primaryBodyFat: number; // Navy method value, used as headline
  averageBodyFat: number; // mean across all computed methods
  spreadPercent: number; // max - min across computed methods (percentage points)
  confidenceNote: string; // human-readable interpretation of the spread
  /** Short plain-language verdict for the same spread tier as confidenceNote —
   *  meant to lead the sentence, with confidenceNote as supporting detail
   *  right after it. Same "verdict + detail" pairing as BMR's
   *  confidenceVerdict / confidenceNote. */
  confidenceVerdict: string;
  fatMassKg: number; // Navy-method-derived fat mass, in the input unit's weight system
  leanMassKg: number; // weight - fatMass, same unit system
  /** Non-null when the Navy-method result falls at/under the sex-specific
   *  essential-fat floor — informational only, calculation still proceeds,
   *  same non-blocking pattern as BMR's ageRangeWarning. */
  essentialFatWarning?: string;
}

export interface BodyFatCategory {
  category: string;
  min: number;
  max: number;
}

export interface WaistToHeightResult {
  ratio: number;
  category: string; // NICE 2022 bands — sex- and age-independent by design
}

export interface IdealBodyFatTarget {
  targetCategory: string; // the category the user is being measured against ("Fitness")
  targetPercent: number; // the upper bound of that category, used as the target
  fatToLoseKg: number; // 0 if already at/under target
}

// --- VALIDATION ---
// Mirrors validateBMIInput / validateWaistInput's structure and bounds
// exactly, so all three calculators feel consistent.

export const validateBodyFatInput = (
  weight: number,
  height: number,
  waist: number,
  neck: number,
  unit: BodyFatUnit
): ValidationResult => {
  if (!Number.isFinite(weight) || Number.isNaN(weight) || weight <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for weight.' };
  }
  if (!Number.isFinite(height) || Number.isNaN(height) || height <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for height.' };
  }
  if (!Number.isFinite(waist) || Number.isNaN(waist) || waist <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for waist circumference.' };
  }
  if (!Number.isFinite(neck) || Number.isNaN(neck) || neck <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for neck circumference.' };
  }

  const wLimits = unit === 'metric' ? [1, 500] : [2, 1100];
  const hLimits = unit === 'metric' ? [30, 300] : [12, 118];
  const cLimits = unit === 'metric' ? [15, 200] : [6, 80]; // waist/neck/hip circumference bounds

  if (weight < wLimits[0] || weight > wLimits[1]) {
    return { isValid: false, error: `Weight must be between ${wLimits[0]} and ${wLimits[1]} ${unit === 'metric' ? 'kg' : 'lbs'}.` };
  }
  if (height < hLimits[0] || height > hLimits[1]) {
    return { isValid: false, error: `Height must be between ${hLimits[0]} and ${hLimits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }
  if (waist < cLimits[0] || waist > cLimits[1]) {
    return { isValid: false, error: `Waist circumference must be between ${cLimits[0]} and ${cLimits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }
  if (neck < cLimits[0] || neck > cLimits[1]) {
    return { isValid: false, error: `Neck circumference must be between ${cLimits[0]} and ${cLimits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }

  return { isValid: true };
};

// Hip is only collected for women (Navy method requirement) — validated
// separately so the male flow never has to pass a dummy value through.
export const validateHipInput = (hip: number, unit: BodyFatUnit): ValidationResult => {
  if (!Number.isFinite(hip) || Number.isNaN(hip) || hip <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for hip circumference.' };
  }
  const limits = unit === 'metric' ? [15, 200] : [6, 80];
  if (hip < limits[0] || hip > limits[1]) {
    return { isValid: false, error: `Hip circumference must be between ${limits[0]} and ${limits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }
  return { isValid: true };
};

// Guards the Navy formula's log10(waist - neck) term, which breaks down
// (negative or zero argument) when neck is not meaningfully smaller than
// waist. Checked separately from the numeric bounds above because this is
// a relationship between two fields, not a single-field range.
export const validateNeckWaistRelationship = (waist: number, neck: number, gender: BodyFatGender, hip?: number): ValidationResult => {
  const comparisonWaist = gender === 'female' && hip ? waist + hip : waist;
  if (comparisonWaist <= neck) {
    return {
      isValid: false,
      error: gender === 'female'
        ? 'Waist + hip must be greater than neck circumference for the calculation to work.'
        : 'Waist circumference must be greater than neck circumference for the calculation to work.',
    };
  }
  return { isValid: true };
};

// Skinfold measurements (mm) — used only in Advanced Mode.
export const validateSkinfoldInput = (mm: number): ValidationResult => {
  if (!Number.isFinite(mm) || Number.isNaN(mm) || mm <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for this skinfold measurement.' };
  }
  if (mm < 2 || mm > 100) {
    return { isValid: false, error: 'Skinfold measurements must be between 2mm and 100mm.' };
  }
  return { isValid: true };
};

// --- UNIT CONVERSION ---
// Converts once to metric internally (cm/kg), same approach bmrLogic.ts
// uses, so no formula below has to duplicate unit math.

interface MetricInputs {
  weightKg: number;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number;
}

const toMetric = (
  weight: number,
  height: number,
  waist: number,
  neck: number,
  unit: BodyFatUnit,
  hip?: number
): MetricInputs => {
  if (unit === 'metric') {
    return { weightKg: weight, heightCm: height, waistCm: waist, neckCm: neck, hipCm: hip };
  }
  return {
    weightKg: weight / 2.20462,
    heightCm: height * 2.54,
    waistCm: waist * 2.54,
    neckCm: neck * 2.54,
    hipCm: hip !== undefined ? hip * 2.54 : undefined,
  };
};

// --- US NAVY METHOD (Hodgdon & Beckett, 1984) ---
// Naval Health Research Center technical report — a US government work,
// public domain. Circumference-based; the primary/headline method.
// Computed directly in metric (cm) internally regardless of input unit,
// per the official SI-units form of the formula.

export const calculateNavyBodyFat = (
  heightCm: number,
  waistCm: number,
  neckCm: number,
  gender: BodyFatGender,
  hipCm?: number
): number => {
  let bfp: number;
  if (gender === 'male') {
    bfp = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    const hip = hipCm ?? 0;
    bfp = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hip - neckCm) + 0.22100 * Math.log10(heightCm)) - 450;
  }
  return Number.isFinite(bfp) && bfp > 0 ? bfp : 0;
};

// --- BMI-BASED METHOD (Deurenberg et al., 1991) ---
// American Journal of Clinical Nutrition — published regression equation
// requiring only weight, height and age (no tape measure). Adult
// coefficients used here; a separate published set exists for children
// but is out of scope for this calculator.

export const calculateBMIBodyFat = (bmi: number, age: number, gender: BodyFatGender): number => {
  const bfp = gender === 'male'
    ? 1.20 * bmi + 0.23 * age - 16.2
    : 1.20 * bmi + 0.23 * age - 5.4;
  return Number.isFinite(bfp) && bfp > 0 ? bfp : 0;
};

// --- YMCA METHOD ---
// Long-standing published fitness-industry circumference method, distinct
// from and older than the Navy method. Requires wrist circumference for
// women only (not requested from men). All inputs in inches/pounds per
// the original published form — converted internally so the UI can still
// collect metric or imperial.

export const calculateYMCABodyFat = (
  weightLbs: number,
  waistInches: number,
  gender: BodyFatGender,
  hipInches?: number,
  wristInches?: number
): number => {
  let bfp: number;
  if (gender === 'male') {
    bfp = ((-98.42 + 4.15 * waistInches - 0.082 * weightLbs) / weightLbs) * 100;
  } else {
    const hip = hipInches ?? 0;
    const wrist = wristInches ?? 0;
    bfp = ((-76.76 + 4.15 * (waistInches + hip - wrist) - 0.082 * weightLbs) / weightLbs) * 100;
  }
  return Number.isFinite(bfp) && bfp > 0 ? bfp : 0;
};

// --- RELATIVE FAT MASS \u2014 RFM (Woolcott & Bergman, 2018) ---
// Published in Scientific Reports (Nature) \u2014 requires only height and
// waist, no BMI or weight. Cited by the authors as outperforming
// BMI-based estimates against DXA-measured body fat across a large
// cross-validation sample.

export const calculateRFM = (heightCm: number, waistCm: number, gender: BodyFatGender): number => {
  const bfp = gender === 'male'
    ? 64 - 20 * (heightCm / waistCm)
    : 76 - 20 * (heightCm / waistCm);
  return Number.isFinite(bfp) && bfp > 0 ? bfp : 0;
};

// --- SKINFOLD: JACKSON-POLLOCK 3-SITE (1978/1985) + SIRI (1961) ---
// Classic exercise-physiology formulas, ubiquitously published in academic
// and coaching literature. Two-step process: (1) sum of 3 skinfolds \u2192
// body density, (2) Siri equation converts density \u2192 body fat %.
// Sites: men = chest, abdomen, thigh; women = triceps, suprailiac, thigh.
// All skinfold inputs in millimeters.

export interface SkinfoldSites3 {
  site1Mm: number; // chest (men) / triceps (women)
  site2Mm: number; // abdomen (men) / suprailiac (women)
  site3Mm: number; // thigh (both)
}

export const calculateSkinfoldBodyFat = (
  sites: SkinfoldSites3,
  age: number,
  gender: BodyFatGender
): number => {
  const sum = sites.site1Mm + sites.site2Mm + sites.site3Mm;

  let bodyDensity: number;
  if (gender === 'male') {
    bodyDensity = 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age;
  } else {
    bodyDensity = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  }

  // Siri (1961): converts body density (g/cm\u00b3) to body fat percentage.
  const bfp = (495 / bodyDensity) - 450;
  return Number.isFinite(bfp) && bfp > 0 ? bfp : 0;
};

// --- MAIN ORCHESTRATOR ---
// Computes every method the current inputs support (skinfold only when
// Advanced Mode data is supplied), same "show everything, then reconcile"
// philosophy as calculateBMR in bmrLogic.ts.

export const calculateBodyFat = (
  weight: number,
  height: number,
  waist: number,
  neck: number,
  age: number,
  bmi: number,
  gender: BodyFatGender,
  unit: BodyFatUnit,
  hip?: number,
  wrist?: number,
  skinfoldSites?: SkinfoldSites3
): BodyFatResult => {
  const { weightKg, heightCm, waistCm, neckCm, hipCm } = toMetric(weight, height, waist, neck, unit, hip);

  const navy = calculateNavyBodyFat(heightCm, waistCm, neckCm, gender, hipCm);
  const bmiMethod = calculateBMIBodyFat(bmi, age, gender);

  const weightLbs = unit === 'metric' ? weightKg * 2.20462 : weight;
  const waistInches = unit === 'metric' ? waistCm / 2.54 : waist;
  const hipInches = hipCm !== undefined ? (unit === 'metric' ? hipCm / 2.54 : hip) : undefined;
  const ymca = calculateYMCABodyFat(weightLbs, waistInches, gender, hipInches, wrist);

  const rfm = calculateRFM(heightCm, waistCm, gender);

  const results: BodyFatMethodResult[] = [
    { method: 'navy', label: 'U.S. Navy Method', bodyFatPercent: navy, isPrimary: true, requiresSkinfold: false },
    { method: 'bmi', label: 'BMI-Based (Deurenberg)', bodyFatPercent: bmiMethod, isPrimary: false, requiresSkinfold: false },
    { method: 'ymca', label: 'YMCA Method', bodyFatPercent: ymca, isPrimary: false, requiresSkinfold: false },
    { method: 'rfm', label: 'Relative Fat Mass (RFM)', bodyFatPercent: rfm, isPrimary: false, requiresSkinfold: false },
  ];

  if (skinfoldSites) {
    const skinfold = calculateSkinfoldBodyFat(skinfoldSites, age, gender);
    results.push({ method: 'skinfold_jp3', label: 'Skinfold (Jackson-Pollock 3-Site)', bodyFatPercent: skinfold, isPrimary: false, requiresSkinfold: true });
  }

  const values = results.map((r) => r.bodyFatPercent).filter((v) => Number.isFinite(v) && v > 0);
  const averageBodyFat = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  const spreadPercent = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;

  const fatMassKg = weightKg * (navy / 100);
  const leanMassKg = weightKg - fatMassKg;

  return {
    results,
    primaryBodyFat: navy,
    averageBodyFat,
    spreadPercent,
    confidenceNote: getBodyFatInsight(spreadPercent, !!skinfoldSites),
    confidenceVerdict: getBodyFatConfidenceVerdict(spreadPercent, !!skinfoldSites),
    fatMassKg: unit === 'metric' ? fatMassKg : fatMassKg * 2.20462,
    leanMassKg: unit === 'metric' ? leanMassKg : leanMassKg * 2.20462,
    essentialFatWarning: getEssentialFatWarning(navy, gender),
  };
};

/**
 * Confidence/agreement note across the computed methods.
 * < 4 pts spread: methods agree closely.
 * 4-8 pts: normal range \u2014 expected divergence between circumference-based
 * and BMI-based estimates, especially for very lean or muscular people.
 * > 8 pts: flagged explicitly; skinfold recommended as the tie-breaker
 * when Advanced Mode data is available.
 */
export const getBodyFatInsight = (spreadPercent: number, hasSkinfold: boolean): string => {
  if (spreadPercent < 4) {
    return 'All methods agree closely, so any of the values above is a reasonable estimate.';
  }
  if (spreadPercent <= 8) {
    return 'Circumference-based methods (Navy, YMCA, RFM) and the BMI-based estimate naturally diverge for people who are very lean or more muscular than average \u2014 this is expected, not a sign of error.';
  }
  return hasSkinfold
    ? 'A wider-than-usual spread is common for atypical body compositions. Since skinfold measurements were entered, that result is generally the most reliable estimate here.'
    : 'This spread is wider than usual. Adding skinfold measurements (Advanced Mode) would give a more precise, direct estimate rather than relying on circumference alone.';
};

/**
 * Short, plain-language verdict for the same spread tier as
 * getBodyFatInsight \u2014 a few words meant to be read first, with the
 * fuller sentence following as supporting detail. Same thresholds, same
 * branching \u2014 not a new calculation.
 */
export const getBodyFatConfidenceVerdict = (spreadPercent: number, hasSkinfold: boolean): string => {
  if (spreadPercent < 4) {
    return 'This estimate is highly reliable.';
  }
  if (spreadPercent <= 8) {
    return 'This is within the expected range.';
  }
  return hasSkinfold
    ? 'Prioritize the skinfold result.'
    : 'Add skinfold measurements for a more precise estimate.';
};

// --- ESSENTIAL FAT SAFETY FLOOR ---
// Non-blocking warning only \u2014 same pattern as BMR's ageRangeWarning and
// BMI's pregnancy notice. Never hides or alters the computed result.

export const getEssentialFatWarning = (bodyFatPercent: number, gender: BodyFatGender): string | undefined => {
  const floor = gender === 'male' ? 5 : 13;
  if (bodyFatPercent > 0 && bodyFatPercent <= floor) {
    return `This result is at or below the commonly cited essential-fat floor (${floor}% for ${gender === 'male' ? 'men' : 'women'}). Body fat this low can affect hormonal and organ function \\u2014 this is informational only; please discuss sustained levels this low with a medical professional.`;
  }
  return undefined;
};

// --- ACE BODY FAT CATEGORIES ---
// American Council on Exercise's published categorization table, the same
// one calculator.net references \u2014 not proprietary, widely reproduced in
// exercise-science textbooks and NASM/ACE certification material.

export const getBodyFatCategories = (gender: BodyFatGender): BodyFatCategory[] => {
  if (gender === 'male') {
    return [
      { category: 'Essential Fat', min: 2, max: 5 },
      { category: 'Athletes', min: 6, max: 13 },
      { category: 'Fitness', min: 14, max: 17 },
      { category: 'Average', min: 18, max: 24 },
      { category: 'Obese', min: 25, max: 100 },
    ];
  }
  return [
    { category: 'Essential Fat', min: 10, max: 13 },
    { category: 'Athletes', min: 14, max: 20 },
    { category: 'Fitness', min: 21, max: 24 },
    { category: 'Average', min: 25, max: 31 },
    { category: 'Obese', min: 32, max: 100 },
  ];
};

export const getBodyFatCategory = (bodyFatPercent: number, gender: BodyFatGender): string => {
  const bands = getBodyFatCategories(gender);
  for (const band of bands) {
    if (bodyFatPercent >= band.min && bodyFatPercent <= band.max) {
      return band.category;
    }
  }
  return bands[bands.length - 1].category;
};

// --- IDEAL BODY FAT TARGET ---
// Uses the "Fitness" band's upper bound as the target \u2014 a documented,
// non-arbitrary choice consistent with the ACE table above, rather than a
// static age-lookup table like calculator.net's Jackson & Pollock chart.

export const getIdealBodyFatTarget = (
  currentBodyFatPercent: number,
  weightKg: number,
  gender: BodyFatGender
): IdealBodyFatTarget => {
  const fitnessBand = getBodyFatCategories(gender).find((b) => b.category === 'Fitness')!;
  const targetPercent = fitnessBand.max;

  if (currentBodyFatPercent <= targetPercent) {
    return { targetCategory: 'Fitness', targetPercent, fatToLoseKg: 0 };
  }

  // Solve for the weight loss that brings body fat % down to targetPercent,
  // assuming lean mass stays constant (standard simplifying assumption
  // used by comparable calculators \u2014 framed as an estimate in the UI).
  const leanMassKg = weightKg * (1 - currentBodyFatPercent / 100);
  const targetWeightKg = leanMassKg / (1 - targetPercent / 100);
  const fatToLoseKg = Math.max(0, weightKg - targetWeightKg);

  return { targetCategory: 'Fitness', targetPercent, fatToLoseKg };
};

// --- WAIST-TO-HEIGHT RATIO (add-on, reuses already-collected waist) ---
// NICE 2022 guidance bands \u2014 sex- and age-independent by design, same
// standard already used for calculateWaistMetrics in bmiLogic.ts, kept
// here too since waist is already collected for the Navy method.

export const calculateWaistToHeightRatio = (waistCm: number, heightCm: number): WaistToHeightResult => {
  const ratio = heightCm > 0 ? waistCm / heightCm : 0;
  let category: string;
  if (ratio < 0.40) category = 'Slim';
  else if (ratio < 0.50) category = 'Healthy';
  else if (ratio < 0.60) category = 'Increased risk';
  else category = 'High risk';

  return { ratio: Number.isFinite(ratio) ? ratio : 0, category };
};

// --- SOURCES & REFERENCES ---
// One entry per formula/standard actually implemented above.

export const BODY_FAT_SOURCES: SourceEntry[] = [
  {
    metric: 'U.S. Navy Method',
    citation: 'Hodgdon JA & Beckett MB (1984), Naval Health Research Center Technical Report \u2014 a U.S. government work; the primary/headline method used above, requiring only waist, neck, height (plus hip for women).',
    url: 'https://www.calculator.net/pdf/navy-physical-readiness-program.pdf',
    linkLabel: 'Hodgdon & Beckett (1984) \u2014 Naval Health Research Center',
  },
  {
    metric: 'BMI-Based Method',
    citation: 'Deurenberg P, Weststrate JA & Seidell JC (1991), British Journal of Nutrition \u2014 a published regression estimating body fat % from BMI, age and sex without any circumference measurement.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2043597/',
    linkLabel: 'Deurenberg et al. (1991) \u2014 British Journal of Nutrition',
  },
  {
    metric: 'YMCA Method',
    citation: 'A long-standing published fitness-industry circumference method, distinct from the Navy method, widely reproduced in exercise-science and personal-training reference material.',
  },
  {
    metric: 'Relative Fat Mass (RFM)',
    citation: 'Woolcott OO & Bergman RN (2018), Scientific Reports (Nature) \u2014 requires only height and waist; the authors\u2019 cross-validation against DXA found it more accurate than BMI-based estimates.',
    url: 'https://www.nature.com/articles/s41598-018-29362-1',
    linkLabel: 'Woolcott & Bergman (2018) \u2014 Scientific Reports',
  },
  {
    metric: 'Skinfold \u2014 Jackson-Pollock 3-Site',
    citation: 'Jackson AS & Pollock ML (1978, 1985), British Journal of Nutrition / published exercise-physiology literature \u2014 the classic 3-site skinfold protocol used in Advanced Mode when caliper measurements are entered.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/718832/',
    linkLabel: 'Jackson & Pollock (1978) \u2014 British Journal of Nutrition',
  },
  {
    metric: 'Siri Equation (Density \u2192 Body Fat %)',
    citation: 'Siri WE (1961), reprinted in Brozek & Henschel (eds.), Techniques for Measuring Body Composition \u2014 converts body density from the skinfold protocol into body fat percentage.',
  },
  {
    metric: 'ACE Body Fat Categories',
    citation: 'American Council on Exercise \u2014 published categorization table (Essential Fat / Athletes / Fitness / Average / Obese), sex-specific, widely reproduced in NASM/ACE certification material.',
    url: 'https://www.acefitness.org/resources/everyone/blog/6741/what-are-the-guidelines-for-percentage-of-body-fat-loss/',
    linkLabel: 'American Council on Exercise \u2014 Body Fat Percentage Guidelines',
  },
  {
    metric: 'Waist-to-Height Ratio',
    citation: 'NICE (UK National Institute for Health and Care Excellence), 2022 guidance \u2014 "keep your waist to less than half your height" (WHtR < 0.50); sex- and age-independent by design.',
    url: 'https://www.nice.org.uk/guidance/ng246',
    linkLabel: 'NICE (2022) \u2014 Waist-to-Height Ratio Guidance',
  },
];
