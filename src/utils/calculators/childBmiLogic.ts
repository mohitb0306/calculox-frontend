/**
 * Child & Teen BMI Calculator — calculation logic.
 *
 * WHY THIS IS DIFFERENT FROM THE ADULT BMI CALCULATOR:
 * A raw BMI number (weight / height²) means something different for every age and sex
 * in childhood, so children are never classified against fixed thresholds like adults.
 * Instead, a child's BMI is converted into a Z-score / percentile against an official
 * age-and-sex-specific reference curve — the same method pediatricians use.
 *
 * DATA SOURCE (real, official, not approximated):
 *  - Ages 2–5 years:  WHO Multicentre Growth Reference Study (2006) BMI-for-age LMS table
 *  - Ages 5–19 years: WHO Growth Reference (2007) BMI-for-age LMS table
 *  Both are published by the World Health Organization and are the same standard used
 *  by CDC, NHS, and pediatricians worldwide for children in this age range.
 *  Raw values embedded in whoGrowthData.ts, extracted verbatim from the official tables.
 *
 * METHOD:
 *  1. Compute BMI = weight(kg) / height(m)²
 *  2. Look up L, M, S for the child's exact age (interpolated between the nearest
 *     published months) from the correct sex-specific table
 *  3. Convert BMI to a Z-score using the LMS (Cole) formula
 *  4. Convert Z-score to a percentile using the standard normal distribution
 *  5. Classify into a category using WHO's own age-band-specific cut-offs
 *     (the cut-offs themselves change at the 5-year mark — this is handled automatically)
 */

import {
  WHO_BMI_U5_MALE,
  WHO_BMI_U5_FEMALE,
  WHO_BMI_5TO19_MALE,
  WHO_BMI_5TO19_FEMALE,
} from "./whoGrowthData";

export type ChildSex = "male" | "female";
export type ChildBMIUnit = "metric" | "imperial";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ChildBMIResult {
  bmi: number;
  ageMonths: number;
  ageYears: number;
  ageLabel: string;
  zScore: number;
  percentile: number;
  category: string;
  categoryTone: "low" | "normal" | "watch" | "high";
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  insight: string;
}

type LMSRow = [number, number, number, number]; // [ageMonths, L, M, S]

/** WHO's official BMI-for-age classification changes at the 5-year mark. */
const AGE_BAND_SPLIT_MONTHS = 60;
const MIN_AGE_MONTHS = 24; // 2 years
const MAX_AGE_MONTHS = 228; // 19 years

// --------------------------------------------------------------------------
// Age helpers
// --------------------------------------------------------------------------

/** Computes age in whole months from a date of birth to a reference date (defaults to today). */
export const getAgeInMonths = (dob: Date, referenceDate: Date = new Date()): number => {
  let months =
    (referenceDate.getFullYear() - dob.getFullYear()) * 12 +
    (referenceDate.getMonth() - dob.getMonth());
  if (referenceDate.getDate() < dob.getDate()) months -= 1;
  return months;
};

export const formatAgeLabel = (ageMonths: number): string => {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
};

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

export const validateChildBMIInput = (
  weight: number,
  height: number,
  ageMonths: number,
  unit: ChildBMIUnit
): ValidationResult => {
  if (!Number.isFinite(weight) || weight <= 0) {
    return { isValid: false, error: "Please enter a valid positive number for weight." };
  }
  if (!Number.isFinite(height) || height <= 0) {
    return { isValid: false, error: "Please enter a valid positive number for height." };
  }
  if (!Number.isFinite(ageMonths) || ageMonths < MIN_AGE_MONTHS || ageMonths > MAX_AGE_MONTHS) {
    return {
      isValid: false,
      error: "This calculator covers children aged 2 to 19 years. For younger infants, please consult a pediatrician's growth chart.",
    };
  }

  const limits =
    unit === "metric" ? { w: [5, 150], h: [70, 210] } : { w: [11, 330], h: [27, 83] };

  if (weight < limits.w[0] || weight > limits.w[1]) {
    return {
      isValid: false,
      error: `Weight looks out of range (${limits.w[0]}–${limits.w[1]} ${unit === "metric" ? "kg" : "lbs"}). Please double-check it.`,
    };
  }
  if (height < limits.h[0] || height > limits.h[1]) {
    return {
      isValid: false,
      error: `Height looks out of range (${limits.h[0]}–${limits.h[1]} ${unit === "metric" ? "cm" : "in"}). Please double-check it.`,
    };
  }

  return { isValid: true };
};

// --------------------------------------------------------------------------
// LMS lookup + interpolation
// --------------------------------------------------------------------------

const getTable = (ageMonths: number, sex: ChildSex): LMSRow[] => {
  if (ageMonths < AGE_BAND_SPLIT_MONTHS) {
    return sex === "male" ? WHO_BMI_U5_MALE : WHO_BMI_U5_FEMALE;
  }
  return sex === "male" ? WHO_BMI_5TO19_MALE : WHO_BMI_5TO19_FEMALE;
};

/** Linearly interpolates L, M, S for a fractional age between the two nearest published months. */
const interpolateLMS = (ageMonths: number, sex: ChildSex): { L: number; M: number; S: number } => {
  const table = getTable(ageMonths, sex);
  const clamped = Math.min(Math.max(ageMonths, table[0][0]), table[table.length - 1][0]);

  let lower = table[0];
  let upper = table[table.length - 1];
  for (let i = 0; i < table.length - 1; i++) {
    if (clamped >= table[i][0] && clamped <= table[i + 1][0]) {
      lower = table[i];
      upper = table[i + 1];
      break;
    }
  }

  const [ageLo, lLo, mLo, sLo] = lower;
  const [ageHi, lHi, mHi, sHi] = upper;
  const span = ageHi - ageLo;
  const t = span === 0 ? 0 : (clamped - ageLo) / span;

  return {
    L: lLo + (lHi - lLo) * t,
    M: mLo + (mHi - mLo) * t,
    S: sLo + (sHi - sLo) * t,
  };
};

// --------------------------------------------------------------------------
// LMS (Cole) Z-score method
// --------------------------------------------------------------------------

/** Converts a measured BMI to a Z-score using the LMS method. */
const bmiToZScore = (bmi: number, L: number, M: number, S: number): number => {
  if (Math.abs(L) < 1e-6) {
    return Math.log(bmi / M) / S;
  }
  return (Math.pow(bmi / M, L) - 1) / (L * S);
};

/** Inverse LMS — the BMI value at a given Z-score (used for "healthy weight range"). */
const zScoreToBMI = (z: number, L: number, M: number, S: number): number => {
  if (Math.abs(L) < 1e-6) {
    return M * Math.exp(S * z);
  }
  return M * Math.pow(1 + L * S * z, 1 / L);
};

/** Standard normal CDF via the Abramowitz–Stegun approximation (max error ~1.5e-7). */
const standardNormalCDF = (z: number): number => {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
};

// --------------------------------------------------------------------------
// Category classification — WHO's own age-band-specific cut-offs
// --------------------------------------------------------------------------

interface CategoryResult {
  category: string;
  tone: "low" | "normal" | "watch" | "high";
}

const classify = (zScore: number, ageMonths: number): CategoryResult => {
  if (ageMonths < AGE_BAND_SPLIT_MONTHS) {
    // WHO Child Growth Standards (0–5 years) BMI-for-age cut-offs
    if (zScore < -3) return { category: "Severely underweight", tone: "low" };
    if (zScore < -2) return { category: "Underweight", tone: "low" };
    if (zScore <= 2) return { category: "Healthy weight", tone: "normal" };
    if (zScore <= 3) return { category: "Overweight", tone: "watch" };
    return { category: "Obesity", tone: "high" };
  }
  // WHO Growth Reference (5–19 years) BMI-for-age cut-offs
  if (zScore < -3) return { category: "Severe thinness", tone: "low" };
  if (zScore < -2) return { category: "Thinness", tone: "low" };
  if (zScore <= 1) return { category: "Healthy weight", tone: "normal" };
  if (zScore <= 2) return { category: "Overweight", tone: "watch" };
  return { category: "Obesity", tone: "high" };
};

const getInsight = (category: string, ageMonths: number): string => {
  const childWord = ageMonths < AGE_BAND_SPLIT_MONTHS ? "child" : "child or teen";
  switch (category) {
    case "Severely underweight":
    case "Severe thinness":
      return `Your ${childWord}'s BMI is well below the healthy range for their age. This can sometimes signal a nutrition or growth concern — please share this result with a pediatrician.`;
    case "Underweight":
    case "Thinness":
      return `Your ${childWord}'s BMI is below the typical healthy range for their age and sex. It's worth mentioning at their next check-up, especially if this is a recent change.`;
    case "Healthy weight":
      return `Great news — your ${childWord}'s BMI falls within the healthy range for their age and sex. Keep supporting balanced meals and regular active play.`;
    case "Overweight":
      return `Your ${childWord}'s BMI is a bit above the typical healthy range for their age. Small, sustainable habits — more active play, balanced portions — can help over time. This is common and very manageable.`;
    case "Obesity":
      return `Your ${childWord}'s BMI is notably above the healthy range for their age. This is a good result to discuss with a pediatrician, who can look at the full growth picture, not just this one number.`;
    default:
      return "Enter accurate measurements to see a personalized result.";
  }
};

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export const calculateChildBMI = (
  weight: number,
  height: number,
  ageMonths: number,
  sex: ChildSex,
  unit: ChildBMIUnit
): ChildBMIResult => {
  // Normalize to metric internally regardless of input unit
  const weightKg = unit === "metric" ? weight : weight * 0.453592;
  const heightCm = unit === "metric" ? height : height * 2.54;
  const heightM = heightCm / 100;

  const bmi = weightKg / (heightM * heightM);

  const { L, M, S } = interpolateLMS(ageMonths, sex);
  const zScore = bmiToZScore(bmi, L, M, S);
  const percentileRaw = standardNormalCDF(zScore) * 100;
  const percentile = Math.min(99.9, Math.max(0.1, percentileRaw));

  const { category, tone } = classify(zScore, ageMonths);
  const insight = getInsight(category, ageMonths);

  // "Healthy weight range" band for this child's current height:
  // upper bound differs by age band, matching the classify() thresholds above.
  const upperZ = ageMonths < AGE_BAND_SPLIT_MONTHS ? 2 : 1;
  const lowerBmi = zScoreToBMI(-2, L, M, S);
  const upperBmi = zScoreToBMI(upperZ, L, M, S);
  const healthyWeightMinKg = lowerBmi * heightM * heightM;
  const healthyWeightMaxKg = upperBmi * heightM * heightM;

  return {
    bmi: Number.isFinite(bmi) ? bmi : 0,
    ageMonths,
    ageYears: ageMonths / 12,
    ageLabel: formatAgeLabel(ageMonths),
    zScore: Number.isFinite(zScore) ? zScore : 0,
    percentile: Number.isFinite(percentile) ? percentile : 50,
    category,
    categoryTone: tone,
    healthyWeightMinKg,
    healthyWeightMaxKg,
    insight,
  };
};

export const kgToUnit = (kg: number, unit: ChildBMIUnit): number =>
  unit === "metric" ? kg : kg / 0.453592;
