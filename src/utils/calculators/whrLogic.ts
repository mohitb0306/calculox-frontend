// --- TYPES ---

/** Unit for waist/hip circumference inputs — kept separate from height/weight's
 *  own unit system, since the mockup gives circumference its own cm/in toggle. */
export type WHRCircumferenceUnit = 'cm' | 'in';

/** Unit for the optional height/weight fields — mirrors bmiLogic's BMIUnit so the
 *  BMI cross-check card can be built the same way as BMICalculator.tsx does it. */
export type WHRMeasurementUnit = 'metric' | 'imperial';

export type WHRGender = 'male' | 'female';
export type WHRReference = 'global' | 'india';
export type WHRStatus = 'below' | 'border' | 'above';
export type WaistRiskLevel = 'low' | 'increased' | 'substantially-increased';

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

export interface WHRResult {
  whr: number;
  cutoff: number;
  /** Uncertainty half-width on the ratio, propagated from the assumed per-measurement
   *  tape error (see calculateWHR's doc comment for the formula). */
  marginOfError: number;
  rangeLow: number;
  rangeHigh: number;
  status: WHRStatus;
}

export interface WHRVerdict {
  chipLabel: string;
  chipTone: 'ok' | 'warn' | 'bad';
  verdictText: string;
}

export interface WaistCircumferenceRisk {
  level: WaistRiskLevel;
  label: string;
  increasedThresholdCm: number;
  substantialThresholdCm: number;
}

export interface SouthAsianWaistRisk {
  atOrAbove: boolean;
  thresholdCm: number;
}

export interface WaistToHeightRatio {
  whtr: number;
  aboveBoundary: boolean;
  boundary: number;
}

export interface BMIWHRComparison {
  bmi: number;
  bmiCategory: string;
  /** Whether the chosen reference's BMI bands consider this BMI elevated (Overweight or Obese). */
  bmiElevated: boolean;
  /** Whether the WHR is at/above (or borderline against) the cut-off. */
  whrElevated: boolean;
  agreement: 'both' | 'bmi-only' | 'whr-only' | 'neither';
  bandLabel: string;
  headline: string;
  explanation: string;
}

export interface WaistChangeThresholds {
  /** Waist (cm) at which the ratio would just reach the cut-off, at the current hip size. */
  justBelowCm: number;
  /** Only set when status is 'below': how much further the waist could rise before reaching the cut-off. */
  headroomCm?: number;
  /** Only set when status is not 'below': waist (cm) that clears the cut-off outside the tape-error band entirely. */
  clearCm?: number;
}

// --- CONSTANTS ---

/** WHO (2008/2011) sex-specific WHR cut-offs linked to substantially increased health risk. */
export const WHR_CUTOFFS: Record<WHRGender, number> = {
  male: 0.9,
  female: 0.85,
};

/** WHO general waist-circumference risk thresholds, in cm. */
export const WAIST_RISK_THRESHOLDS_CM: Record<WHRGender, { increased: number; substantial: number }> = {
  male: { increased: 94, substantial: 102 },
  female: { increased: 80, substantial: 88 },
};

/** Misra et al. (2009) South Asian waist-circumference thresholds, in cm — used when reference is 'india'. */
export const SOUTH_ASIAN_WAIST_THRESHOLD_CM: Record<WHRGender, number> = {
  male: 90,
  female: 80,
};

/** Ashwell, Gunn & Gibson (2012) waist-to-height ratio boundary. */
export const WHTR_BOUNDARY = 0.5;

/** BMI bands (kg/m²) used only for the BMI+WHR comparison card — global (WHO) vs India (Asian)
 *  thresholds. Same numbers bmiLogic.ts uses for its 'who'/'asia-pacific' regions, kept
 *  independent here so whrLogic.ts has no import dependency on bmiLogic.ts — callers pass in an
 *  already-computed BMI. [0] is the Normal/Overweight boundary, [1] is the Overweight/Obese one. */
export const BMI_GRID_THRESHOLDS: Record<WHRReference, [number, number]> = {
  global: [25, 30],
  india: [23, 25],
};

const BMI_BAND_LABELS: [string, string, string] = ['Normal range', 'Overweight', 'Obese'];

/** Selectable assumed per-measurement slip, in cm, regardless of the display unit — matches
 *  the mockup's ±0.5 / ±1 / ±2 cm dropdown. Each option carries a single-word qualifier, kept
 *  deliberately short so the whole control still fits on one line next to the scale legend —
 *  the fuller explanation lives in the info tooltip next to the control instead. */
export interface TapeErrorOption {
  cm: number;
  qualifier: string;
}
export const WHR_TAPE_ERROR_OPTIONS: TapeErrorOption[] = [
  { cm: 0.5, qualifier: 'Precise' },
  { cm: 1, qualifier: 'Typical' },
  { cm: 2, qualifier: 'Rough' },
];
export const DEFAULT_TAPE_ERROR_CM = 1;

/** Fixed scale bounds for the linear WHR scale visual (not sex- or reference-dependent). */
export const WHR_SCALE_MIN = 0.6;
export const WHR_SCALE_MAX = 1.1;
export const WHR_SCALE_TICKS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1];

// --- UNIT CONVERSION ---

export const toCm = (value: number, unit: WHRCircumferenceUnit): number =>
  unit === 'cm' ? value : value * 2.54;

export const fromCm = (valueCm: number, unit: WHRCircumferenceUnit): number =>
  unit === 'cm' ? valueCm : valueCm / 2.54;

// --- VALIDATION ---
// Bounds mirror the generous sanity-check philosophy already used in bmiLogic.ts's
// validateWaistInput and bodyFatLogic.ts's validateCircumferences — practical data-entry
// guards, not clinical cut-offs. Given per-unit directly (not derived by conversion) so the
// displayed range always reads as a clean, human number in either unit.

export const validateWHRInput = (
  waist: number,
  hip: number,
  unit: WHRCircumferenceUnit
): ValidationResult => {
  if (!Number.isFinite(waist) || Number.isNaN(waist) || waist <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for waist.' };
  }
  if (!Number.isFinite(hip) || Number.isNaN(hip) || hip <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for hip.' };
  }

  const limits = unit === 'cm' ? [40, 300] : [16, 118];
  if (waist < limits[0] || waist > limits[1]) {
    return { isValid: false, error: `Waist must be between ${limits[0]} and ${limits[1]} ${unit}.` };
  }
  if (hip < limits[0] || hip > limits[1]) {
    return { isValid: false, error: `Hip must be between ${limits[0]} and ${limits[1]} ${unit}.` };
  }

  return { isValid: true };
};

/** Age is optional — used only to gate the pregnancy/under-18 guard and shown in "About you". */
export const validateWHRAge = (age?: number | null): ValidationResult => {
  if (age === undefined || age === null || (typeof age === 'number' && Number.isNaN(age))) {
    return { isValid: true };
  }
  if (!Number.isFinite(age) || age <= 0 || age > 130) {
    return { isValid: false, error: 'Please enter a realistic age.' };
  }
  return { isValid: true };
};

/** Height is optional — unlocks waist-to-height ratio and, with weight, the BMI×WHR grid.
 *  Bounds match bmiLogic.ts's validateBMIInput so the two calculators feel consistent. */
export const validateWHROptionalHeight = (
  height: number | undefined | null,
  unit: WHRMeasurementUnit
): ValidationResult => {
  if (height === undefined || height === null || (typeof height === 'number' && Number.isNaN(height))) {
    return { isValid: true };
  }
  const limits = unit === 'metric' ? [30, 300] : [12, 118];
  if (!Number.isFinite(height) || height <= 0 || height < limits[0] || height > limits[1]) {
    return { isValid: false, error: `Height must be between ${limits[0]} and ${limits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }
  return { isValid: true };
};

/** Weight is optional — combines with height for the BMI×WHR grid only. */
export const validateWHROptionalWeight = (
  weight: number | undefined | null,
  unit: WHRMeasurementUnit
): ValidationResult => {
  if (weight === undefined || weight === null || (typeof weight === 'number' && Number.isNaN(weight))) {
    return { isValid: true };
  }
  const limits = unit === 'metric' ? [1, 500] : [2, 1100];
  if (!Number.isFinite(weight) || weight <= 0 || weight < limits[0] || weight > limits[1]) {
    return { isValid: false, error: `Weight must be between ${limits[0]} and ${limits[1]} ${unit === 'metric' ? 'kg' : 'lbs'}.` };
  }
  return { isValid: true };
};

// --- CORE CALCULATION ---

export const getWHRCutoff = (gender: WHRGender): number => WHR_CUTOFFS[gender];

/**
 * Computes the waist-to-hip ratio plus a propagated uncertainty band from assumed tape error.
 *
 * The ratio itself (`whr`) is unit-independent as long as waist and hip are in the same unit,
 * so no conversion is needed there. The uncertainty band, however, is derived from a tape error
 * that's always specified in cm (the ±0.5/1/2 cm dropdown) regardless of the display unit — so
 * waist/hip are converted to cm internally purely for that propagation step, via standard
 * error propagation for a ratio: sigma_whr = whr * sqrt((err/waist)^2 + (err/hip)^2).
 *
 * `status` follows a three-way read rather than a hard pass/fail: 'below' only when the whole
 * uncertainty band clears the cut-off, 'above' only when the whole band is at/over it, and
 * 'border' whenever the cut-off falls inside the band — i.e. tape error alone could flip the
 * verdict, so re-measuring is the honest next step before trusting either side.
 */
export const calculateWHR = (
  waist: number,
  hip: number,
  unit: WHRCircumferenceUnit,
  gender: WHRGender,
  tapeErrorCm: number = DEFAULT_TAPE_ERROR_CM
): WHRResult => {
  const whr = hip > 0 ? waist / hip : 0;
  const cutoff = getWHRCutoff(gender);

  const waistCm = toCm(waist, unit);
  const hipCm = toCm(hip, unit);
  const marginOfError =
    waistCm > 0 && hipCm > 0
      ? whr * Math.sqrt(Math.pow(tapeErrorCm / waistCm, 2) + Math.pow(tapeErrorCm / hipCm, 2))
      : 0;

  const rangeLow = whr - marginOfError;
  const rangeHigh = whr + marginOfError;

  let status: WHRStatus;
  if (rangeLow >= cutoff) status = 'above';
  else if (rangeHigh < cutoff) status = 'below';
  else status = 'border';

  return {
    whr: isNaN(whr) || !isFinite(whr) ? 0 : whr,
    cutoff,
    marginOfError,
    rangeLow,
    rangeHigh,
    status,
  };
};

// --- PREGNANCY / UNDER-18 GUARD ---
// Per the mockup: the ratio is always shown, but the risk category is withheld — WHO's cut-offs
// were derived for non-pregnant adults, so applying them elsewhere would be misleading.

export const isWHRGuarded = (isPregnantOrRecentlyPostpartum: boolean, age?: number | null): boolean =>
  isPregnantOrRecentlyPostpartum || (typeof age === 'number' && Number.isFinite(age) && age < 18);

export const getWHRGuardMessage = (isPregnantOrRecentlyPostpartum: boolean): { title: string; body: string } => {
  if (isPregnantOrRecentlyPostpartum) {
    return {
      title: 'Ratio only during pregnancy',
      body: 'Waist size changes during pregnancy and in the weeks after birth, so a risk category would not be reliable.',
    };
  }
  return {
    title: 'Ratio only for under 18s',
    body: 'The WHO cut-offs were set for adults, so we show your ratio without a risk category. A clinician can interpret waist measurements for children and teenagers.',
  };
};

// --- VERDICT TEXT ---

export const getWHRVerdict = (gender: WHRGender, status: WHRStatus, cutoff: number): WHRVerdict => {
  const sexWord = gender === 'male' ? 'men' : 'women';
  const cutoffStr = cutoff.toFixed(2);

  const copy: Record<WHRStatus, WHRVerdict> = {
    below: {
      chipLabel: 'Below the WHO cut-off',
      chipTone: 'ok',
      verdictText: `Your ratio is under the WHO cut-off of ${cutoffStr} for ${sexWord}, even after allowing for tape error.`,
    },
    border: {
      chipLabel: 'Borderline: measure again',
      chipTone: 'warn',
      verdictText: `Your ratio is within tape error of the WHO cut-off of ${cutoffStr} for ${sexWord}. Measure twice more before drawing a conclusion.`,
    },
    above: {
      chipLabel: 'At or above the WHO cut-off',
      chipTone: 'bad',
      verdictText: `Your ratio is at or above the WHO cut-off of ${cutoffStr} for ${sexWord}, which the WHO links to substantially increased health risk. This is a screening result, not a diagnosis.`,
    },
  };

  return copy[status];
};

/** Flags an unusual ratio worth a double-check (mismatched units, typo, etc.) — same spirit as
 *  bodyFatLogic's sanity bounds, but on the derived ratio rather than the raw inputs. */
export const isWHRUnusual = (whr: number): boolean => whr < 0.55 || whr > 1.25;

// --- WAIST CHECKS ---

export const getWaistCircumferenceRisk = (waistCm: number, gender: WHRGender): WaistCircumferenceRisk => {
  const { increased, substantial } = WAIST_RISK_THRESHOLDS_CM[gender];
  let level: WaistRiskLevel;
  let label: string;

  // Deliberately no cm figures baked into the label — the component formats the actual
  // threshold numbers itself via fromCm(), so the pill always matches the user's chosen unit.
  if (waistCm >= substantial) {
    level = 'substantially-increased';
    label = 'Substantially increased risk';
  } else if (waistCm >= increased) {
    level = 'increased';
    label = 'Increased risk';
  } else {
    level = 'low';
    label = 'Low risk';
  }

  return { level, label, increasedThresholdCm: increased, substantialThresholdCm: substantial };
};

export const getSouthAsianWaistRisk = (waistCm: number, gender: WHRGender): SouthAsianWaistRisk => {
  const thresholdCm = SOUTH_ASIAN_WAIST_THRESHOLD_CM[gender];
  return { atOrAbove: waistCm >= thresholdCm, thresholdCm };
};

/** Waist-to-height ratio — `waist` and `height` must be in the same unit; the ratio itself
 *  is unit-independent (same reasoning as WHR above). */
export const getWaistToHeightRatio = (waist: number, height: number): WaistToHeightRatio => {
  const whtr = height > 0 ? waist / height : 0;
  return {
    whtr: isNaN(whtr) || !isFinite(whtr) ? 0 : whtr,
    aboveBoundary: whtr >= WHTR_BOUNDARY,
    boundary: WHTR_BOUNDARY,
  };
};

// --- BMI + WHR COMPARISON ---
// Takes an already-computed BMI (kg/m²) rather than computing it here, the same way
// bodyFatLogic.calculateBodyFat takes `bmi` as a parameter instead of importing bmiLogic —
// keeps the calculator logic modules independent of one another.
//
// Deliberately NOT a grid: a mostly-empty matrix of cells reads as a puzzle, not an answer.
// Instead this returns one plain-English read of how the two measures agree or disagree,
// plus the pieces (category, band bounds) a card needs to show its working.

export const getBMIWHRComparison = (
  bmi: number,
  status: WHRStatus,
  reference: WHRReference
): BMIWHRComparison => {
  const [lowerBand, upperBand] = BMI_GRID_THRESHOLDS[reference];
  const bandIndex = bmi < lowerBand ? 0 : bmi < upperBand ? 1 : 2;
  const bmiCategory = BMI_BAND_LABELS[bandIndex];
  const bmiElevated = bandIndex > 0;
  const whrElevated = status !== 'below';
  const bandLabel = reference === 'india' ? 'Asian (India) BMI bands' : 'WHO (Global) BMI bands';

  let agreement: BMIWHRComparison['agreement'];
  let headline: string;
  let explanation: string;

  if (bmiElevated && whrElevated) {
    agreement = 'both';
    headline = 'Both point the same way';
    explanation = 'Your BMI and your waist-to-hip ratio both sit in the higher-risk range. Two independent measures agreeing makes this result more likely to be meaningful.';
  } else if (bmiElevated && !whrElevated) {
    agreement = 'bmi-only';
    headline = 'BMI is elevated, but your waist is proportionate';
    explanation = 'Your BMI sits above the normal range, but your waist-to-hip ratio does not. This can happen when weight is carried more evenly, or on a more muscular frame — BMI cannot tell the difference, but the ratio helps.';
  } else if (!bmiElevated && whrElevated) {
    agreement = 'whr-only';
    headline = 'Your waist-to-hip ratio flags something BMI misses';
    explanation = 'Your BMI looks typical, but your waist-to-hip ratio is elevated. BMI cannot see where weight is carried on the body — this is exactly the pattern it can miss.';
  } else {
    agreement = 'neither';
    headline = 'Both in the lower-risk range';
    explanation = 'Your BMI and your waist-to-hip ratio are both in the lower-risk range, so neither raises a flag here.';
  }

  if (status === 'border') {
    explanation += ' Your waist-to-hip ratio is currently borderline, so treat this comparison as provisional until you re-measure.';
  }

  return { bmi, bmiCategory, bmiElevated, whrElevated, agreement, bandLabel, headline, explanation };
};

// --- "WHAT WOULD CHANGE THIS" ---
// All returned values are in cm; the UI converts to the display unit with fromCm().

export const getWaistChangeThresholds = (
  hipCm: number,
  waistCm: number,
  cutoff: number,
  marginOfErrorCm: number,
  status: WHRStatus
): WaistChangeThresholds => {
  const justBelowCm = cutoff * hipCm;

  if (status === 'below') {
    return {
      justBelowCm,
      headroomCm: justBelowCm - waistCm,
    };
  }

  // marginOfErrorCm here is the tape-error-driven margin expressed in the same cm units as
  // hipCm, mirroring the mockup's `(cut - sig) * hc`.
  return {
    justBelowCm,
    clearCm: (cutoff - marginOfErrorCm) * hipCm,
  };
};

export interface WaistChangeMessage {
  /** Short label for the headline stat — what the big number below it represents. */
  label: string;
  /** Pre-formatted, unit-aware value for the headline stat, e.g. "4.2 cm" or "1.7 in". */
  value: string;
  /** One full, plain-English sentence explaining the number and its "hips held constant" assumption. */
  caption: string;
}

/**
 * Turns the raw cm thresholds from getWaistChangeThresholds into one clear headline stat and
 * a full sentence — no side-by-side rows to reconcile, no unlabeled deltas. Unit-aware, the
 * same way validateWHRInput and friends build their own unit-aware strings.
 */
export const getWaistChangeMessage = (
  status: WHRStatus,
  waistCm: number,
  cutoff: number,
  changes: WaistChangeThresholds,
  unit: WHRCircumferenceUnit
): WaistChangeMessage => {
  const fmt = (cm: number) => `${Math.abs(fromCm(cm, unit)).toFixed(1)} ${unit}`;

  if (status === 'below' && changes.headroomCm !== undefined) {
    const headroom = Math.max(0, changes.headroomCm);
    return {
      label: 'Room before the WHO cut-off',
      value: fmt(headroom),
      caption: `Your waist could grow by about ${fmt(headroom)} — up to around ${fmt(changes.justBelowCm)} in total — before your ratio would reach the WHO cut-off of ${cutoff.toFixed(2)}. This assumes your hips stay the same size.`,
    };
  }

  const clearCm = changes.clearCm ?? changes.justBelowCm;
  const lossCm = Math.max(0, waistCm - clearCm);
  return {
    label: 'Waist change to clear the cut-off',
    value: fmt(lossCm),
    caption: `Bringing your waist in by about ${fmt(lossCm)} — down to around ${fmt(clearCm)} — would put your ratio clearly below the WHO cut-off of ${cutoff.toFixed(2)}, even allowing for tape error. This assumes your hips stay the same size.`,
  };
};

// --- SCALE HELPERS ---
// Pure position math for the linear scale visual — keeps percentage-position logic out of the
// component, same "component just renders, logic computes" split as the rest of this file.

export const getWHRScalePosition = (value: number): number => {
  const pct = ((value - WHR_SCALE_MIN) / (WHR_SCALE_MAX - WHR_SCALE_MIN)) * 100;
  return Math.min(100, Math.max(0, pct));
};

// --- SOURCES & REFERENCES ---
// Carried over from the mockup's Sources accordion, including its own "Phase 0" verification
// note — these are the same placeholders flagged there, not yet independently confirmed.

export const WHR_SOURCES: SourceEntry[] = [
  {
    metric: 'WHR cut-offs and measurement protocol',
    citation: 'WHO expert consultation on waist circumference and waist-hip ratio (Geneva, 2008; published 2011).',
  },
  {
    metric: 'South Asian waist thresholds',
    citation: 'Misra A et al. (2009), Consensus statement for Asian Indians, Journal of the Association of Physicians of India.',
  },
  {
    metric: 'Waist-to-height ratio boundary of 0.5',
    citation: 'Ashwell M, Gunn P, Gibson S (2012), Obesity Reviews.',
  },
  {
    metric: 'Waist and WHR reclassifying BMI-based cardiovascular risk',
    citation: 'Dardari ZA et al. (2026), Journal of the American College of Cardiology.',
  },
  {
    metric: 'General waist circumference thresholds',
    citation: 'WHO / NHLBI. Placeholder — confirm against the original documents before launch.',
  },
];
