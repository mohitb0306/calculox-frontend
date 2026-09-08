export type BMIUnit = 'metric' | 'imperial';
export type BMIRegion = 'who' | 'asia-pacific';

export interface BMIResult {
  bmi: number;
  category: string;
  idealWeightMin: number;
  idealWeightMax: number;
  /** BMI ÷ 25 — a dimensionless ratio to WHO/CDC's global upper-normal limit (25 kg/m²). */
  bmiPrime: number;
  /** Ponderal Index in kg/m³ (mass ÷ height³), computed in metric internally regardless of input unit. More reliable than BMI for very tall/short individuals. */
  ponderalIndex: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface BMIRange {
  min: number;
  max: number;
  label: string;
  category: string;
}

export const validateBMIInput = (weight: number, height: number, unit: BMIUnit): ValidationResult => {
  if (!Number.isFinite(weight) || Number.isNaN(weight) || weight <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for weight.' };
  }
  if (!Number.isFinite(height) || Number.isNaN(height) || height <= 0) {
    return { isValid: false, error: 'Please enter a valid positive number for height.' };
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

export const validateWaistInput = (waist: number, unit: BMIUnit): ValidationResult => {
  // Waist circumference is optional — an empty/zero value is valid (simply "not provided").
  if (!waist || waist === 0) {
    return { isValid: true };
  }
  if (!Number.isFinite(waist) || Number.isNaN(waist) || waist < 0) {
    return { isValid: false, error: 'Please enter a valid positive number for waist circumference.' };
  }

  const limits = unit === 'metric' ? [30, 300] : [12, 118];
  if (waist < limits[0] || waist > limits[1]) {
    return { isValid: false, error: `Waist circumference must be between ${limits[0]} and ${limits[1]} ${unit === 'metric' ? 'cm' : 'inches'}.` };
  }

  return { isValid: true };
};

export interface WaistMetrics {
  /** Waist-to-height ratio (waist ÷ height, same units — unit-independent). */
  whtr: number;
  /** Category per NICE's 2022 waist-to-height guideline (sex- and age-independent by design). */
  whtrCategory: string;
  /** Risk level per WHO's official sex-specific waist-circumference thresholds (defined in cm). */
  waistRiskLevel: string;
}

/**
 * Computes waist-to-height ratio and WHO waist-circumference risk level.
 *
 * These are two DISTINCT, independently-sourced guidelines, not one metric:
 *  - WHtR bands (Slim / Healthy / Increased risk / High risk) come from NICE's 2022
 *    guidance ("keep your waist to less than half your height", WHtR < 0.50), which
 *    is explicitly sex- and age-independent by design.
 *  - waistRiskLevel comes from WHO's own official waist-circumference cut-off table,
 *    which IS sex-specific (94/80 cm increased risk, 102/88 cm substantially increased
 *    risk, for men/women respectively) — this is the one legitimate place sex affects
 *    a threshold, per WHO's own guidance document.
 *
 * `height` and `waist` must be passed in the same unit (both cm, or both inches) —
 * the ratio itself is unit-independent, but waistRiskLevel converts to cm internally
 * since WHO's table is defined in centimeters.
 */
export const calculateWaistMetrics = (
  waist: number,
  height: number,
  unit: BMIUnit,
  gender: BMIGender
): WaistMetrics => {
  const whtr = height > 0 ? waist / height : 0;

  let whtrCategory = '';
  if (whtr < 0.40) whtrCategory = 'Slim';
  else if (whtr < 0.50) whtrCategory = 'Healthy';
  else if (whtr < 0.60) whtrCategory = 'Increased risk';
  else whtrCategory = 'High risk';

  const waistCm = unit === 'metric' ? waist : waist * 2.54;
  let waistRiskLevel = '';
  if (gender === 'male') {
    if (waistCm >= 102) waistRiskLevel = 'Substantially increased risk';
    else if (waistCm >= 94) waistRiskLevel = 'Increased risk';
    else waistRiskLevel = 'Low risk';
  } else {
    if (waistCm >= 88) waistRiskLevel = 'Substantially increased risk';
    else if (waistCm >= 80) waistRiskLevel = 'Increased risk';
    else waistRiskLevel = 'Low risk';
  }

  return {
    whtr: isNaN(whtr) || !isFinite(whtr) ? 0 : whtr,
    whtrCategory,
    waistRiskLevel,
  };
};

export const calculateBMI = (
  weight: number,
  height: number,
  unit: BMIUnit,
  region: BMIRegion
): BMIResult => {
  let bmi = 0;
  let heightInMeters = 0;

  if (unit === 'metric') {
    heightInMeters = height / 100;
    bmi = weight / (heightInMeters * heightInMeters);
  } else {
    bmi = 703 * (weight / (height * height));
    heightInMeters = height * 0.0254;
  }

  let category = '';
  const minMultiplier = 18.5;
  const maxMultiplier = region === 'asia-pacific' ? 22.9 : 24.9;

  if (region === 'who') {
    if (bmi < 16.0) category = 'Severe thinness';
    else if (bmi <= 16.9) category = 'Moderate thinness';
    else if (bmi <= 18.4) category = 'Mild thinness';
    else if (bmi <= 24.9) category = 'Normal range';
    else if (bmi <= 29.9) category = 'Pre-obese';
    else if (bmi <= 34.9) category = 'Obese Class I';
    else if (bmi <= 39.9) category = 'Obese Class II';
    else category = 'Obese Class III';
  } else if (region === 'asia-pacific') {
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi <= 22.9) category = 'Normal range';
    else if (bmi <= 24.9) category = 'Overweight';
    else if (bmi <= 29.9) category = 'Obesity Class I';
    else category = 'Obesity Class II';
  }

  let idealWeightMin = minMultiplier * (heightInMeters * heightInMeters);
  let idealWeightMax = maxMultiplier * (heightInMeters * heightInMeters);

  if (unit === 'imperial') {
    idealWeightMin = idealWeightMin * 2.20462;
    idealWeightMax = idealWeightMax * 2.20462;
  }

  // BMI Prime: ratio of BMI to WHO/CDC's global upper-normal limit (25 kg/m²).
  // Uses the fixed 25 denominator per the official definition, independent of the
  // selected regional standard, so it stays comparable across regions.
  const bmiPrime = bmi / 25;

  // Ponderal Index: always computed in metric (kg/m³) internally for a consistent,
  // unit-independent value, converting weight to kg first when the input is imperial.
  const weightInKg = unit === 'metric' ? weight : weight / 2.20462;
  const ponderalIndex = heightInMeters > 0 ? weightInKg / Math.pow(heightInMeters, 3) : 0;

  return {
    bmi: isNaN(bmi) || !isFinite(bmi) ? 0 : bmi,
    category,
    idealWeightMin: isNaN(idealWeightMin) ? 0 : idealWeightMin,
    idealWeightMax: isNaN(idealWeightMax) ? 0 : idealWeightMax,
    bmiPrime: isNaN(bmiPrime) || !isFinite(bmiPrime) ? 0 : bmiPrime,
    ponderalIndex: isNaN(ponderalIndex) || !isFinite(ponderalIndex) ? 0 : ponderalIndex,
  };
};

export const getBMIRanges = (region: BMIRegion): BMIRange[] => {
  if (region === 'who') {
    return [
      { min: 10, max: 16.0, label: '< 16.0', category: 'Severe thinness' },
      { min: 16.0, max: 17.0, label: '16.0 - 16.9', category: 'Moderate thinness' },
      { min: 17.0, max: 18.5, label: '17.0 - 18.4', category: 'Mild thinness' },
      { min: 18.5, max: 25.0, label: '18.5 - 24.9', category: 'Normal range' },
      { min: 25.0, max: 30.0, label: '25.0 - 29.9', category: 'Pre-obese' },
      { min: 30.0, max: 35.0, label: '30.0 - 34.9', category: 'Obese Class I' },
      { min: 35.0, max: 40.0, label: '35.0 - 39.9', category: 'Obese Class II' },
      { min: 40.0, max: 50.0, label: '≥ 40.0', category: 'Obese Class III' },
    ];
  } else {
    return [
      { min: 10, max: 18.5, label: '< 18.5', category: 'Underweight' },
      { min: 18.5, max: 23.0, label: '18.5 - 22.9', category: 'Normal range' },
      { min: 23.0, max: 25.0, label: '23.0 - 24.9', category: 'Overweight' },
      { min: 25.0, max: 30.0, label: '25.0 - 29.9', category: 'Obesity Class I' },
      { min: 30.0, max: 50.0, label: '≥ 30.0', category: 'Obesity Class II' },
    ];
  }
};

export type BMIGender = 'male' | 'female';

/**
 * Informational-only note on body composition context by sex.
 *
 * IMPORTANT: Per CDC's official guidance ("For adults, the interpretation of BMI
 * does not depend on sex or age"), this must NEVER be used to alter the BMI value,
 * category, or any classification. It exists purely to surface CDC's own stated
 * limitation ("At the same BMI, women tend to have more body fat than men") as
 * context — the score and category are identical for both inputs.
 */
export const getGenderContextNote = (gender: BMIGender): string => {
  return gender === 'female'
    ? "Note: at the same BMI, women typically carry more body fat than men — a normal physiological difference, not a flaw in your result. Your category above is unaffected; WHO and CDC classify BMI identically for all adults regardless of sex."
    : "Note: at the same BMI, men typically carry less body fat than women. Your category above is unaffected; WHO and CDC classify BMI identically for all adults regardless of sex.";
};

export const getBMIInsight = (category: string, isAthletic: boolean): string => {
  if (isAthletic && (category === 'Overweight' || category === 'Pre-obese' || category.includes('Obese'))) {
    return "Since you have an athletic build, your higher BMI is likely reflecting your muscle mass rather than excess body fat. Muscle is denser than fat, meaning standard BMI guidelines often classify fit athletes as 'overweight.' Continue focusing on your performance and overall wellness rather than relying strictly on standard scale metrics.";
  }
  
  switch(category) {
    case 'Severe thinness':
    case 'Moderate thinness':
    case 'Mild thinness':
    case 'Underweight':
      return "Your BMI suggests you are currently below the standard weight range. Being underweight can sometimes mean your body is missing out on essential nutrients. Consider focusing on nutrient-dense foods and speaking with a wellness professional to ensure you are fueling your body optimally.";
    case 'Normal range':
      return "Excellent! Your BMI is comfortably within the standard healthy range. Maintaining a balanced weight supports your overall energy levels, mobility, and long-term wellness. Keep up your positive daily habits with a balanced diet and regular physical activity.";
    case 'Overweight':
    case 'Pre-obese':
      return "Your BMI indicates you are slightly above the standard healthy weight range. Minor, sustainable lifestyle adjustments—such as increasing daily movement or optimizing portion sizes—can be great proactive steps toward feeling your best and supporting long-term wellness.";
    case 'Obese Class I':
    case 'Obesity Class I':
    case 'Obese Class II':
    case 'Obesity Class II':
    case 'Obese Class III':
      return "Your BMI falls outside the standard healthy range. While BMI is just one indicator, being in this range can place extra stress on your body over time. Exploring sustainable wellness goals, perhaps with the guidance of a health professional, can be a great step toward optimizing your long-term vitality.";
    default:
      return "Please enter your precise metrics above to generate a personalized wellness overview.";
  }
};

export const generateBMIGrid = (centerWeight: number, centerHeight: number, unit: BMIUnit, region: BMIRegion) => {
  const weights: number[] = [];
  const heights: number[] = [];
  
  const wStep = unit === 'metric' ? 5 : 10;
  const hStep = unit === 'metric' ? 3 : 2;

  for (let i = -4; i <= 4; i++) {
    weights.push(Math.max(1, Math.round(centerWeight + (i * wStep))));
    heights.push(Math.max(1, Math.round(centerHeight + (i * hStep))));
  }

  weights.reverse();

  const grid = weights.map(w => {
    return heights.map(h => {
      const res = calculateBMI(w, h, unit, region);
      return {
        weight: w,
        height: h,
        bmi: res.bmi,
        category: res.category
      };
    });
  });

  return { weights, heights, grid };
};
