// --- TYPES ---

export type BMRUnit = 'metric' | 'imperial';
export type BMRGender = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'
  | 'extra_active';

export type BMRGoal =
  | 'aggressive_cut'
  | 'mild_cut'
  | 'maintain'
  | 'mild_bulk'
  | 'aggressive_bulk';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface BMRFormulaResult {
  formula: 'mifflin_st_jeor' | 'harris_benedict' | 'katch_mcardle' | 'cunningham' | 'schofield';
  label: string; // e.g. "Mifflin-St Jeor"
  bmr: number; // kcal/day
  isPrimary: boolean; // true for Mifflin-St Jeor (shown as the headline number)
  requiresBodyFat: boolean; // true for Katch-McArdle / Cunningham
}

export interface BMRResult {
  results: BMRFormulaResult[];
  primaryBmr: number; // Mifflin-St Jeor value, used as headline
  averageBmr: number; // mean of all computed formulas
  spreadKcal: number; // max - min across computed formulas
  confidenceNote: string; // human-readable interpretation of the spread
  /** Present only when body fat % was not provided but Katch-McArdle/Cunningham
   *  were still computed via the Boer LBM estimate. */
  estimatedLbmKg?: number;
  /** Non-null when age falls outside the 15-80 range these formulas were
   *  validated against — informational only, calculation still proceeds. */
  ageRangeWarning?: string;
}

export interface TDEEEntry {
  level: ActivityLevel;
  label: string; // e.g. "Sedentary: little or no exercise"
  description: string; // e.g. "Desk job, no regular exercise"
  multiplier: number;
  calories: number; // primaryBmr * multiplier
}

export interface GoalCalorieEntry {
  goal: BMRGoal;
  label: string; // e.g. "Mild Weight Loss"
  dailyCalories: number;
  deltaFromMaintenance: number; // negative for cuts, positive for surplus
  expectedChangePerWeekKg: number;
  /** True when dailyCalories falls below a commonly-cited unsupervised-diet
   *  safety floor for the given gender. Does not alter dailyCalories itself
   *  — purely a display flag so the UI can warn instead of recommend. */
  isUnsafeLow?: boolean;
  /** Human-readable warning text, present only when isUnsafeLow is true. */
  safetyWarning?: string;
}

export interface SourceEntry {
  metric: string;
  citation: string;
  url?: string;
  linkLabel?: string;
}

// --- VALIDATION ---
// Mirrors validateBMIInput's structure and bounds exactly (same weight/height
// sanity limits as bmiLogic.ts, so the two calculators feel consistent).

export const validateBMRInput = (
  weight: number,
  height: number,
  age: number,
  unit: BMRUnit
): ValidationResult => {
  if (!Number.isFinite(weight) || Number.isNaN(weight) || weight <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for weight.' };
  }
  if (!Number.isFinite(height) || Number.isNaN(height) || height <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for height.' };
  }
  if (!Number.isFinite(age) || Number.isNaN(age) || age <= 0) {
    return { isValid: false, error: 'Please enter a valid age.' };
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
  // Age is NOT bounded here (unlike weight/height) — ages outside the
  // 15-80 "validated" range still calculate, just with a non-blocking
  // warning surfaced separately via getAgeRangeWarning(). Only a wildly
  // implausible age is rejected outright.
  if (age > 130) {
    return { isValid: false, error: 'Please enter a realistic age.' };
  }

  return { isValid: true };
};

// Same "optional, blank = not provided, 0 treated as not provided" pattern
// as validateWaistInput in bmiLogic.ts. Body fat % is unit-independent, so
// (unlike validateWaistInput) there is no unit parameter here.
export const validateBodyFatInput = (bodyFat: number): ValidationResult => {
  if (!bodyFat || bodyFat === 0) {
    return { isValid: true };
  }
  if (!Number.isFinite(bodyFat) || Number.isNaN(bodyFat) || bodyFat < 0) {
    return { isValid: false, error: 'Please enter a valid positive number for body fat percentage.' };
  }
  if (bodyFat < 3 || bodyFat > 60) {
    return { isValid: false, error: 'Body fat percentage must be between 3% and 60%.' };
  }
  return { isValid: true };
};

/**
 * Non-blocking warning shown when age falls outside the 15-80 range these
 * formulas were validated against. Calculation proceeds regardless — this
 * is purely informational, same spirit as the pregnancy notice in BMI but
 * without hiding any result.
 */
export const getAgeRangeWarning = (age: number): string | undefined => {
  if (age < 15 || age > 80) {
    return 'These formulas were validated for ages 15\u201380 \u2014 results outside that range are less reliable.';
  }
  return undefined;
};

// --- UNIT CONVERSION ---
// Converts once to metric internally (same approach bmiLogic.ts uses for
// height/weight) so no formula below has to duplicate unit math.

interface MetricInputs {
  weightKg: number;
  heightCm: number;
}

const toMetric = (weight: number, height: number, unit: BMRUnit): MetricInputs => {
  if (unit === 'metric') {
    return { weightKg: weight, heightCm: height };
  }
  return {
    weightKg: weight / 2.20462,
    heightCm: height * 2.54,
  };
};

// --- LEAN BODY MASS (Boer, 1984) ---
// Used to feed Katch-McArdle / Cunningham when the user hasn't entered a
// body fat percentage. W = kg, H = cm.

export const calculateLBMBoer = (weightKg: number, heightCm: number, gender: BMRGender): number => {
  return gender === 'male'
    ? 0.407 * weightKg + 0.267 * heightCm - 19.2
    : 0.252 * weightKg + 0.473 * heightCm - 48.3;
};

// --- SCHOFIELD / WHO-FAO-UNU (1985) ---
// Weight-based, age-banded. Coefficients verified against the FAO/WHO/UNU
// Table 5.2 (kcal/day form) and the "Revised WHO equations (FAO/WHO/UNU
// 2004)" table reproduced in multiple published clinical-trial protocols.
//
// Band boundary convention (documented explicitly since Schofield's own
// bands are written inclusively at both ends, e.g. "18-30" and "30-60"):
// age <= 30 -> young band, age <= 60 -> mid band, else -> older band.
// An age of exactly 30 or 60 falls into the YOUNGER of its two adjoining
// bands under this convention.

const schofieldCoefficients = (age: number, gender: BMRGender): { a: number; b: number } => {
  if (gender === 'male') {
    if (age <= 30) return { a: 15.057, b: 692.2 };
    if (age <= 60) return { a: 11.472, b: 873.1 };
    return { a: 11.711, b: 587.7 };
  }
  if (age <= 30) return { a: 14.818, b: 486.6 };
  if (age <= 60) return { a: 8.126, b: 845.6 };
  return { a: 9.082, b: 658.5 };
};

// --- MAIN CALCULATION ---
// Computes all five formulas simultaneously (not user-selected one at a
// time), same "show everything" philosophy as bmiLogic.ts's getBMIRanges.

export const calculateBMR = (
  weight: number,
  height: number,
  age: number,
  gender: BMRGender,
  unit: BMRUnit,
  bodyFatPercent?: number | null
): BMRResult => {
  const { weightKg, heightCm } = toMetric(weight, height, unit);

  // --- Lean body mass, for Katch-McArdle / Cunningham ---
  const hasRealBodyFat = typeof bodyFatPercent === 'number' && bodyFatPercent > 0;
  let lbmKg: number;
  let estimatedLbmKg: number | undefined;

  if (hasRealBodyFat) {
    lbmKg = weightKg * (1 - (bodyFatPercent as number) / 100);
  } else {
    lbmKg = calculateLBMBoer(weightKg, heightCm, gender);
    estimatedLbmKg = lbmKg;
  }
  // Guard against a pathological (negative/zero) Boer estimate for extreme
  // inputs — Katch-McArdle/Cunningham simply aren't computed in that case
  // rather than showing a nonsensical negative BMR.
  const lbmIsUsable = Number.isFinite(lbmKg) && lbmKg > 0;

  // --- Mifflin-St Jeor (1990) — primary/default ---
  const mifflin = gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // --- Revised Harris-Benedict (Roza & Shizgal, 1984) ---
  const harrisBenedict = gender === 'male'
    ? 13.397 * weightKg + 4.799 * heightCm - 5.677 * age + 88.362
    : 9.247 * weightKg + 3.098 * heightCm - 4.330 * age + 447.593;

  // --- Schofield / WHO-FAO-UNU (1985) ---
  const { a, b } = schofieldCoefficients(age, gender);
  const schofield = a * weightKg + b;

  const results: BMRFormulaResult[] = [
    { formula: 'mifflin_st_jeor', label: 'Mifflin-St Jeor', bmr: mifflin, isPrimary: true, requiresBodyFat: false },
    { formula: 'harris_benedict', label: 'Revised Harris-Benedict', bmr: harrisBenedict, isPrimary: false, requiresBodyFat: false },
    { formula: 'schofield', label: 'Schofield (WHO/FAO/UNU)', bmr: schofield, isPrimary: false, requiresBodyFat: false },
  ];

  if (lbmIsUsable) {
    // --- Katch-McArdle ---
    const katchMcArdle = 370 + 21.6 * lbmKg;
    // --- Cunningham (1980) ---
    const cunningham = 500 + 22 * lbmKg;

    results.push(
      { formula: 'katch_mcardle', label: 'Katch-McArdle', bmr: katchMcArdle, isPrimary: false, requiresBodyFat: true },
      { formula: 'cunningham', label: 'Cunningham', bmr: cunningham, isPrimary: false, requiresBodyFat: true }
    );
  }

  const bmrValues = results.map((r) => r.bmr).filter((v) => Number.isFinite(v) && v > 0);
  const averageBmr = bmrValues.length > 0 ? bmrValues.reduce((sum, v) => sum + v, 0) / bmrValues.length : 0;
  const spreadKcal = bmrValues.length > 0 ? Math.max(...bmrValues) - Math.min(...bmrValues) : 0;

  const confidenceNote = getBMRInsight(spreadKcal, hasRealBodyFat);

  return {
    results,
    primaryBmr: Number.isFinite(mifflin) && mifflin > 0 ? mifflin : 0,
    averageBmr,
    spreadKcal,
    confidenceNote,
    estimatedLbmKg: !hasRealBodyFat && lbmIsUsable ? estimatedLbmKg : undefined,
    ageRangeWarning: getAgeRangeWarning(age),
  };
};

/**
 * Confidence/agreement note across the computed formulas.
 * < 75 kcal spread: formulas agree closely.
 * 75-150 kcal: normal range, explained by body-composition vs weight/height-only
 * divergence for very lean or higher-body-fat individuals.
 * > 150 kcal: flagged explicitly; Katch-McArdle/Cunningham recommended as more
 * reliable ONLY when real (not Boer-estimated) body fat % was entered.
 */
export const getBMRInsight = (spreadKcal: number, hasRealBodyFat: boolean): string => {
  if (spreadKcal < 75) {
    return 'High confidence \u2014 all formulas agree closely, so any of the values above is a reasonable estimate.';
  }
  if (spreadKcal <= 150) {
    return 'This is a normal spread. Weight/height-only formulas (Mifflin-St Jeor, Harris-Benedict, Schofield) and body-composition formulas (Katch-McArdle, Cunningham) naturally diverge more for people who are very lean or carry a higher body fat percentage.';
  }
  return hasRealBodyFat
    ? 'This spread is wider than usual. Since you entered your actual body fat percentage, the Katch-McArdle and Cunningham results are likely the most reliable estimates here.'
    : 'This spread is wider than usual. Entering your actual body fat percentage (instead of an estimated one) would let Katch-McArdle and Cunningham give a more reliable result.';
};

// --- TDEE ---
// Six-tier activity multiplier table, calculator.net's industry-standard
// tiers (not proprietary). All six rows are returned together so the full
// table can render at once rather than behind a picker.

const ACTIVITY_LEVELS: Array<{ level: ActivityLevel; label: string; description: string; multiplier: number }> = [
  { level: 'sedentary', label: 'Sedentary', description: 'Little or no exercise', multiplier: 1.2 },
  { level: 'light', label: 'Light', description: 'Light exercise 1\u20133 days/week', multiplier: 1.375 },
  { level: 'moderate', label: 'Moderate', description: 'Moderate exercise 3\u20135 days/week', multiplier: 1.55 },
  { level: 'active', label: 'Active', description: 'Hard exercise 6\u20137 days/week', multiplier: 1.725 },
  { level: 'very_active', label: 'Very Active', description: 'Very hard exercise + physical job', multiplier: 1.9 },
  // The blueprint's source table lists 2.2-2.4 for this tier; 2.2 (the
  // low/standard end of that range) is used as the single value below to
  // avoid overstating calorie needs for most "extra active" users.
  { level: 'extra_active', label: 'Extra Active', description: 'Professional athlete / extremely demanding physical job', multiplier: 2.2 },
];

export const calculateTDEE = (primaryBmr: number): TDEEEntry[] => {
  return ACTIVITY_LEVELS.map((tier) => ({
    ...tier,
    calories: primaryBmr * tier.multiplier,
  }));
};

// --- GOAL-BASED CALORIE TARGETS ---
// Uses the standard ~7,700 kcal \u2248 1 kg body-fat conversion, explicitly
// framed in the UI as an approximation, not a guaranteed outcome.

const KCAL_PER_KG = 7700;

const GOAL_TIERS: Array<{ goal: BMRGoal; label: string; delta: number }> = [
  { goal: 'aggressive_cut', label: 'Aggressive Cut', delta: -750 },
  { goal: 'mild_cut', label: 'Mild Cut', delta: -375 },
  { goal: 'maintain', label: 'Maintain', delta: 0 },
  { goal: 'mild_bulk', label: 'Mild Bulk', delta: 300 },
  { goal: 'aggressive_bulk', label: 'Aggressive Bulk', delta: 500 },
];

export const getGoalCalories = (tdee: number, gender: BMRGender): GoalCalorieEntry[] => {
  // Commonly-cited general safety floors for unsupervised calorie targets
  // (e.g. NIH/Mayo-Clinic-style guidance): ~1,500 kcal/day for men, ~1,200
  // kcal/day for women. This is a display-only floor for flagging unusually
  // low results — it does not change how dailyCalories is calculated.
  const safetyFloor = gender === 'male' ? 1500 : 1200;

  return GOAL_TIERS.map((tier) => {
    const dailyCalories = tdee + tier.delta;
    const isUnsafeLow = dailyCalories < safetyFloor;

    return {
      goal: tier.goal,
      label: tier.label,
      dailyCalories,
      deltaFromMaintenance: tier.delta,
      expectedChangePerWeekKg: (tier.delta * 7) / KCAL_PER_KG,
      isUnsafeLow,
      safetyWarning: isUnsafeLow
        ? `This falls below the commonly cited ${safetyFloor.toLocaleString()} kcal/day floor for ${gender === 'male' ? 'men' : 'women'} on an unsupervised diet. Consider a less aggressive goal, or only pursue this with medical guidance.`
        : undefined,
    };
  });
};

// --- SOURCES & REFERENCES ---
// One entry per formula/standard actually implemented above.

export const BMR_SOURCES: SourceEntry[] = [
  {
    metric: 'Mifflin-St Jeor Equation',
    citation: 'Mifflin MD, St Jeor ST, et al. (1990), American Journal of Clinical Nutrition \u2014 the equation recommended by the Academy of Nutrition and Dietetics as the most broadly validated for the general population.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
    linkLabel: 'Mifflin et al. (1990) \u2014 American Journal of Clinical Nutrition',
  },
  {
    metric: 'Revised Harris-Benedict Equation',
    citation: 'Originally published in 1919; the coefficients used here are the 1984 revision by Roza AM and Shizgal HM, published in the American Journal of Clinical Nutrition.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/6741850/',
    linkLabel: 'Roza & Shizgal (1984) \u2014 American Journal of Clinical Nutrition',
  },
  {
    metric: 'Katch-McArdle Formula',
    citation: 'McArdle WD, Katch FI & Katch VL, Exercise Physiology \u2014 estimates BMR from lean body mass rather than total weight, so it requires a body fat percentage (measured or estimated).',
  },
  {
    metric: 'Boer Lean Body Mass Formula',
    citation: 'Boer P. (1984), American Journal of Physiology \u2014 used to estimate lean body mass from height and weight alone when a real body fat percentage isn\u2019t entered.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/6742167/',
    linkLabel: 'Boer (1984) \u2014 American Journal of Physiology',
  },
  {
    metric: 'Cunningham Equation',
    citation: 'Cunningham JJ (1980), American Journal of Clinical Nutrition \u2014 uses the same lean-body-mass value as Katch-McArdle; popular in strength-training contexts.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/7369170/',
    linkLabel: 'Cunningham (1980) \u2014 American Journal of Clinical Nutrition',
  },
  {
    metric: 'Schofield / WHO-FAO-UNU Equation',
    citation: 'Schofield WN (1985), Human Nutrition: Clinical Nutrition. The kJ/day coefficients from that paper convert precisely to the kcal/day figures used here; the same equation was subsequently reprinted in WHO Technical Report Series 724 (1985) and again in the FAO/WHO/UNU Human Energy Requirements report (Rome, 2004), which is why some sources label these coefficients \u201crevised WHO/FAO/UNU (2004)\u201d rather than \u201cSchofield (1985)\u201d \u2014 they are the same numbers.',
    url: 'https://www.fao.org/4/y5686e/y5686e07.htm',
    linkLabel: 'FAO/WHO/UNU \u2014 Human Energy Requirements, Table 5.2',
  },
  {
    metric: 'Activity Multipliers (TDEE)',
    citation: 'A long-standing nutrition-science convention for converting BMR into total daily energy expenditure \u2014 not pinned to one single paper, the same way BMI Prime isn\u2019t attributed to a specific publication in this app\u2019s BMI calculator.',
  },
];
