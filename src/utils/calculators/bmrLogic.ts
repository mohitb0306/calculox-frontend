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
  /** Short (few-word) plain-language verdict for the same spread tier as
   *  confidenceNote — meant to lead the sentence so a non-technical reader
   *  gets the takeaway immediately, with confidenceNote as the supporting
   *  detail right after it. Same tier thresholds as confidenceNote; this
   *  is purely a second, shorter piece of copy for the same result. */
  confidenceVerdict: string;
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

/** Macro split (grams + %) for a given calorie total, kept within the
 *  NASEM/USDA AMDR — see MACRO_SPLIT_BY_GOAL for the exact source and the
 *  reasoning behind each goal's chosen percentages. */
export interface MacroBreakdown {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
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
  /** Protein/carb/fat split for this tier's dailyCalories. Always present,
   *  always within the official AMDR bounds. */
  macros: MacroBreakdown;
}

// --- LIFE-STAGE ADJUSTMENTS ---
// Optional, additive-only adjustments layered on top of the base TDEE/goal
// numbers above. See getLifeStageAdjustment() for the cited figures.

export type LifeStage = 'none' | 'pregnant' | 'breastfeeding' | 'pcos' | 'perimenopause';
export type PregnancyTrimester = 'first' | 'second' | 'third';
export type BreastfeedingStage = 'months_1_6' | 'months_7_12';

export interface LifeStageAdjustment {
  lifeStage: LifeStage;
  label: string; // e.g. "Pregnancy \u2014 2nd Trimester"
  /** kcal/day to ADD on top of an already-computed TDEE/goal figure. 0 for
   *  'none', PCOS, perimenopause, and 1st-trimester pregnancy \u2014 in those
   *  cases 0 is the correct, cited value, not a placeholder for "unknown". */
  calorieAddition: number;
  /** True only when calorieAddition comes from a specific cited guideline
   *  (pregnancy 2nd/3rd trimester, either breastfeeding stage). */
  hasNumericAdjustment: boolean;
  /** Educational note for the UI. Always present for PCOS/perimenopause
   *  (no numeric adjustment exists, so the note IS the feature); present
   *  for 1st-trimester pregnancy to explain the 0 kcal figure; absent
   *  otherwise. */
  note?: string;
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

// Hard-enforced bound for Body Fat % — unlike Age, an out-of-range body
// fat is rejected outright (not just a soft warning), since it's an
// optional input rather than one of the core required figures. Named
// constants for the same reason as AGE_VALIDATED_MIN/MAX below: single
// source of truth shared with the UI.
export const BODY_FAT_MIN = 3;
export const BODY_FAT_MAX = 60;

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
  if (bodyFat < BODY_FAT_MIN || bodyFat > BODY_FAT_MAX) {
    return { isValid: false, error: `Body fat percentage must be between ${BODY_FAT_MIN}% and ${BODY_FAT_MAX}%.` };
  }
  return { isValid: true };
};

// The age range these formulas were validated against. Named constants
// (rather than repeating 15/80 as magic numbers) so getAgeRangeWarning
// below and the Age input's live min/max highlighting in
// BMRCalculator.tsx can never drift out of sync with each other.
export const AGE_VALIDATED_MIN = 15;
export const AGE_VALIDATED_MAX = 80;

/**
 * Non-blocking warning shown when age falls outside the 15-80 range these
 * formulas were validated against. Calculation proceeds regardless — this
 * is purely informational, same spirit as the pregnancy notice in BMI but
 * without hiding any result.
 */
export const getAgeRangeWarning = (age: number): string | undefined => {
  if (age < AGE_VALIDATED_MIN || age > AGE_VALIDATED_MAX) {
    return `These formulas were validated for ages ${AGE_VALIDATED_MIN}\u2013${AGE_VALIDATED_MAX} \u2014 results outside that range are less reliable.`;
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
  const confidenceVerdict = getBMRConfidenceVerdict(spreadKcal, hasRealBodyFat);

  return {
    results,
    primaryBmr: Number.isFinite(mifflin) && mifflin > 0 ? mifflin : 0,
    averageBmr,
    spreadKcal,
    confidenceNote,
    confidenceVerdict,
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
    return 'All formulas agree closely, so any of the values above is a reasonable estimate.';
  }
  if (spreadKcal <= 150) {
    return 'Weight- and height-based formulas (Mifflin-St Jeor, Harris-Benedict, Schofield) naturally diverge from body-composition formulas (Katch-McArdle, Cunningham) for people who are very lean or carry a higher body fat percentage \u2014 this is expected, not a sign of error.';
  }
  return hasRealBodyFat
    ? 'A wider-than-usual spread is common for people with more muscle or body fat than average. Since a measured body fat percentage was entered, Katch-McArdle and Cunningham can use it directly, making them the more reliable estimates here.'
    : 'This spread is wider than usual. Entering an actual body fat percentage, rather than an estimated one, would let Katch-McArdle and Cunningham produce a more reliable result.';
};

/**
 * Short, plain-language verdict for the same spread tier as getBMRInsight
 * above — a few words meant to be read first (bolded), with the fuller
 * getBMRInsight sentence following as supporting detail. Same thresholds,
 * same branching \u2014 this is only a second, shorter piece of copy for the
 * same computed result, not a new calculation.
 */
export const getBMRConfidenceVerdict = (spreadKcal: number, hasRealBodyFat: boolean): string => {
  if (spreadKcal < 75) {
    return 'This estimate is highly reliable.';
  }
  if (spreadKcal <= 150) {
    return 'This is within the expected range.';
  }
  return hasRealBodyFat
    ? 'Prioritize the body-composition formulas.'
    : 'Add your body fat percentage for a more precise estimate.';
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

// --- MACRO BREAKDOWN ---
// Grams are derived from each goal tier's dailyCalories using the
// NASEM/USDA Acceptable Macronutrient Distribution Range (AMDR) for
// adults: Protein 10-35%, Carbohydrate 45-65%, Fat 20-35% of total
// calories (Dietary Reference Intakes for Energy, Carbohydrate, Fiber,
// Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids \u2014 National
// Academies of Sciences, Engineering, and Medicine; see BMR_SOURCES).
// Conversions: protein/carbs = 4 kcal/g, fat = 9 kcal/g.
//
// The percentages below are ONE documented choice within those official
// ranges per goal \u2014 not a separate published standard, and no split from
// any competitor site:
//  - Aggressive Cut (35P/45C/20F): protein pinned to the AMDR's UPPER
//    bound to help preserve lean mass during a larger deficit; carbs and
//    fat pinned to their AMDR LOWER bounds since the calorie deficit
//    itself is doing the work, not carb/fat restriction.
//  - Mild Cut (30P/45C/25F): still elevated protein for lean-mass
//    retention, with a bit more fat headroom than the aggressive tier.
//  - Maintain (20P/50C/30F): a balanced split near the middle of all
//    three AMDR ranges \u2014 no cut- or bulk-specific bias.
//  - Mild Bulk (20P/55C/25F): moderate protein (AMDR midpoint) with carbs
//    shifted up to help fuel training and support a surplus.
//  - Aggressive Bulk (15P/60C/25F): protein nearer the AMDR floor is
//    still a large gram amount at these higher absolute calories; carbs
//    shifted toward the AMDR's upper end to fuel the bigger surplus.
// Every value stays within its own AMDR bound and each row sums to 100%.
const MACRO_SPLIT_BY_GOAL: Record<BMRGoal, { proteinPct: number; carbsPct: number; fatPct: number }> = {
  aggressive_cut: { proteinPct: 35, carbsPct: 45, fatPct: 20 },
  mild_cut: { proteinPct: 30, carbsPct: 45, fatPct: 25 },
  maintain: { proteinPct: 20, carbsPct: 50, fatPct: 30 },
  mild_bulk: { proteinPct: 20, carbsPct: 55, fatPct: 25 },
  aggressive_bulk: { proteinPct: 15, carbsPct: 60, fatPct: 25 },
};

const PROTEIN_KCAL_PER_G = 4;
const CARBS_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;

export const calculateMacros = (dailyCalories: number, goal: BMRGoal): MacroBreakdown => {
  const { proteinPct, carbsPct, fatPct } = MACRO_SPLIT_BY_GOAL[goal];
  return {
    proteinPct,
    carbsPct,
    fatPct,
    proteinGrams: (dailyCalories * (proteinPct / 100)) / PROTEIN_KCAL_PER_G,
    carbsGrams: (dailyCalories * (carbsPct / 100)) / CARBS_KCAL_PER_G,
    fatGrams: (dailyCalories * (fatPct / 100)) / FAT_KCAL_PER_G,
  };
};

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
      macros: calculateMacros(dailyCalories, tier.goal),
    };
  });
};

// --- TDEE COMPOSITION BREAKDOWN (display-only) ---
// Decomposes an already-computed total calories figure (TDEE, optionally
// with a life-stage addition applied) into three commonly-cited components
// for display purposes: BMR, Activity, and TEF (Thermic Effect of Food).
// This does NOT change how BMR/TDEE/goal calories are calculated anywhere
// else in this module \u2014 it is a pure decomposition of a number that was
// already computed, for a "Daily Target" breakdown visual.
//
// TEF is estimated as ~10% of total daily energy expenditure \u2014 see
// TEF_PERCENT_OF_TOTAL and the citation in BMR_SOURCES below. This is the
// standard nutrition-science approximation; the activity-level multipliers
// used elsewhere in this file already implicitly include TEF (that's the
// normal convention for those multipliers), so this breakdown re-splits the
// existing total into three parts for DISPLAY rather than adding new
// calories on top of it \u2014 BMR + Activity + TEF always sums back to the
// same total that was passed in.
const TEF_PERCENT_OF_TOTAL = 0.10;

export interface TDEEBreakdown {
  totalCalories: number;
  bmrCalories: number;
  activityCalories: number;
  tefCalories: number;
  bmrPct: number;
  activityPct: number;
  tefPct: number;
}

export const getTDEEBreakdown = (totalCalories: number, primaryBmr: number): TDEEBreakdown => {
  const bmrCalories = Math.round(primaryBmr);
  const tefCalories = Math.round(totalCalories * TEF_PERCENT_OF_TOTAL);
  // Guarded against going negative in case of an unusual combination of
  // inputs (e.g. a very low activity multiplier) \u2014 in every realistic case
  // (multipliers start at 1.2x) this remains comfortably positive.
  const activityCalories = Math.max(0, Math.round(totalCalories) - bmrCalories - tefCalories);
  const total = bmrCalories + activityCalories + tefCalories;

  return {
    totalCalories: total,
    bmrCalories,
    activityCalories,
    tefCalories,
    bmrPct: total > 0 ? Math.round((bmrCalories / total) * 100) : 0,
    activityPct: total > 0 ? Math.round((activityCalories / total) * 100) : 0,
    tefPct: total > 0 ? Math.round((tefCalories / total) * 100) : 0,
  };
};

// --- LIFE-STAGE ADJUSTMENT LOOKUP ---
// Only pregnancy (2nd/3rd trimester) and breastfeeding have an official,
// citable numeric kcal/day addition. PCOS and perimenopause do not \u2014 so
// those resolve to 0 kcal plus an educational note, rather than an
// invented figure. Every number here is additive on top of an
// already-computed TDEE/goal figure; nothing here recalculates BMR/TDEE.

// ACOG (American College of Obstetricians and Gynecologists) — cited
// additional kcal/day needs by trimester.
const PREGNANCY_ADDITION: Record<PregnancyTrimester, number> = {
  first: 0,
  second: 340,
  third: 450,
};

// USDA Dietary Guidelines for Americans — cited additional kcal/day for
// exclusive breastfeeding, by stage.
const BREASTFEEDING_ADDITION: Record<BreastfeedingStage, number> = {
  months_1_6: 330,
  months_7_12: 400,
};

const TRIMESTER_LABEL: Record<PregnancyTrimester, string> = {
  first: '1st Trimester',
  second: '2nd Trimester',
  third: '3rd Trimester',
};

const BREASTFEEDING_LABEL: Record<BreastfeedingStage, string> = {
  months_1_6: 'Months 1\u20136',
  months_7_12: 'Months 7\u201312',
};

export const getLifeStageAdjustment = (
  lifeStage: LifeStage,
  trimester?: PregnancyTrimester,
  breastfeedingStage?: BreastfeedingStage
): LifeStageAdjustment => {
  if (lifeStage === 'pregnant') {
    const t = trimester ?? 'first';
    const addition = PREGNANCY_ADDITION[t];
    return {
      lifeStage,
      label: `Pregnancy \u2014 ${TRIMESTER_LABEL[t]}`,
      calorieAddition: addition,
      hasNumericAdjustment: addition > 0,
      note: t === 'first'
        ? 'ACOG cites no additional calorie need during the 1st trimester \u2014 your base targets below already apply.'
        : undefined,
    };
  }
  if (lifeStage === 'breastfeeding') {
    const s = breastfeedingStage ?? 'months_1_6';
    return {
      lifeStage,
      label: `Breastfeeding \u2014 ${BREASTFEEDING_LABEL[s]}`,
      calorieAddition: BREASTFEEDING_ADDITION[s],
      hasNumericAdjustment: true,
    };
  }
  if (lifeStage === 'pcos') {
    return {
      lifeStage,
      label: 'PCOS',
      calorieAddition: 0,
      hasNumericAdjustment: false,
      note: 'PCOS can affect insulin sensitivity and metabolism \u2014 there\u2019s no universal calorie adjustment for this; please consult a doctor or registered dietitian for personalized guidance.',
    };
  }
  if (lifeStage === 'perimenopause') {
    return {
      lifeStage,
      label: 'Perimenopause',
      calorieAddition: 0,
      hasNumericAdjustment: false,
      note: 'Perimenopause can shift metabolism and body composition \u2014 there\u2019s no universal calorie adjustment for this; please consult a doctor or registered dietitian for personalized guidance.',
    };
  }
  return {
    lifeStage: 'none',
    label: 'None',
    calorieAddition: 0,
    hasNumericAdjustment: false,
  };
};

/**
 * Adds a life-stage kcal/day addition on top of an already-computed
 * figure (TDEE or a goal-calorie target). Purely additive \u2014 never
 * mutates or recalculates the base figure, and returns the base figure
 * unchanged when calorieAddition is 0.
 */
export const applyLifeStageAddition = (baseCalories: number, adjustment: LifeStageAdjustment): number =>
  baseCalories + adjustment.calorieAddition;

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
  {
    metric: 'Macro Breakdown (AMDR)',
    citation: 'National Academies of Sciences, Engineering, and Medicine \u2014 Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Defines the Acceptable Macronutrient Distribution Range for adults (Protein 10\u201335%, Carbohydrate 45\u201365%, Fat 20\u201335% of total calories) used to compute the gram splits above; the exact percentage chosen within each range for each goal is documented in code comments.',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK56068/',
    linkLabel: 'National Academies \u2014 Dietary Reference Intakes (AMDR)',
  },
  {
    metric: 'Pregnancy Calorie Additions',
    citation: 'American College of Obstetricians and Gynecologists (ACOG) \u2014 cites no additional calorie need in the 1st trimester, approximately +340 kcal/day in the 2nd trimester, and approximately +450 kcal/day in the 3rd trimester, added on top of pre-pregnancy energy needs.',
    url: 'https://www.acog.org/womens-health/faqs/nutrition-during-pregnancy',
    linkLabel: 'ACOG \u2014 Nutrition During Pregnancy',
  },
  {
    metric: 'Breastfeeding Calorie Additions',
    citation: 'USDA Dietary Guidelines for Americans \u2014 cites approximately +330 kcal/day for exclusive breastfeeding in months 1\u20136 postpartum and approximately +400 kcal/day in months 7\u201312, added on top of pre-pregnancy energy needs.',
    url: 'https://www.dietaryguidelines.gov/',
    linkLabel: 'USDA \u2014 Dietary Guidelines for Americans',
  },
  {
    metric: 'Thermic Effect of Food (TEF) \u2014 Daily Target Breakdown',
    citation: 'A narrative review of diet-induced-thermogenesis research estimates basal metabolism at roughly 60% of total daily energy expenditure and the thermic effect of food at approximately 10%, with the remainder attributable to physical activity \u2014 the same three-way split used to break your daily target down into BMR / Activity / TEF above.',
    url: 'https://www.sciencedirect.com/science/article/pii/S2589936824000239',
    linkLabel: 'Diet-Induced Thermogenesis \u2014 Narrative Review (2024)',
  },
];
