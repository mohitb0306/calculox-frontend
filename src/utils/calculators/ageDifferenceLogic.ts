// --- TYPES ---
// Age Difference Calculator's own logic file, matching the bmiLogic.ts /
// bmrLogic.ts / whrLogic.ts / dateLogic.ts / birthdayLogic.ts pattern:
// pure functions only (validation, calendar math, lookups) — no state, no
// UI.
//
// This file deliberately BUILDS ON dateLogic.ts rather than duplicating
// it — dateLogic.ts's own header describes itself as the shared engine
// for the whole date-based family (Chronological Age, Birthday, Age
// Difference) — and reuses birthdayLogic.ts's generation/zodiac lookups
// so the two-person comparisons here agree exactly with what a visitor
// would see if they ran each birth date through Birthday Calculator on
// its own. Only genuinely two-person math (the gap itself, the
// percentage-of-life framing, catch-up projections) lives here.

import {
  type ValidationResult,
  type SourceEntry,
  type AgeBreakdown,
  validateDateInput,
  calculateAge,
  formatWithCommas,
} from './dateLogic';

import {
  getGeneration,
  getWesternZodiac,
  type GenerationInfo,
  type WesternZodiacInfo,
} from './birthdayLogic';

export type { ValidationResult, SourceEntry, AgeBreakdown };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MEAN_YEAR_DAYS = 365.2425; // Gregorian mean year — see DATE_SOURCES

// --- INPUT MODES ---
// Mirrors the three ways every competitor in this space accepts input
// (exact birthdates, ages, or birth years alone) — birthdates give
// calendar-accurate results, the other two are necessarily
// approximations and are labeled as such wherever they're shown.
export type AgeDifferenceInputMode = 'birthdates' | 'ages' | 'birthYears';

/** Converts an "I am N years old" input into an anchor birth date for the
 *  math below: N years before `asOfDate`, calendar-clamped. This is an
 *  approximation (it assumes the birthday already happened this year at
 *  `asOfDate`'s day-of-month) and callers should present results derived
 *  from it as approximate, not exact. */
export const ageToApproxBirthDate = (ageYears: number, asOfDate: Date): Date => {
  const year = asOfDate.getFullYear() - ageYears;
  const month = asOfDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(asOfDate.getDate(), lastDayOfMonth));
};

/** Converts a birth-year-only input into an anchor birth date: July 1st
 *  of that year, the same "middle of the year" convention demographers
 *  use when only a birth year is known, so the resulting gap isn't
 *  systematically biased toward either end of the year. Approximate by
 *  construction — never treat this as calendar-accurate. */
export const birthYearToApproxBirthDate = (birthYear: number): Date => new Date(birthYear, 6, 1);

// --- VALIDATION ---
// One combined check covering both people, reusing dateLogic's own
// per-date validation so the error bounds (not in the future, within 130
// years) stay identical to every other calculator on the site.
export const validateAgeDifferenceInput = (
  personABirth: Date | null,
  personBBirth: Date | null,
  asOfDate: Date
): ValidationResult => {
  const a = validateDateInput(personABirth, asOfDate);
  if (!a.isValid) return { isValid: false, error: a.error?.replace('date of birth', "Person 1's date of birth") };
  const b = validateDateInput(personBBirth, asOfDate);
  if (!b.isValid) return { isValid: false, error: b.error?.replace('date of birth', "Person 2's date of birth") };
  return { isValid: true };
};

// --- CORE COMPARISON ---

export interface PersonSnapshot {
  birthDate: Date;
  /** This person's own current age as of `asOfDate` — identical to what
   *  Chronological Age Calculator would show for the same birth date. */
  currentAge: AgeBreakdown;
}

export interface AgeDifferenceResult {
  olderBirthDate: Date;
  youngerBirthDate: Date;
  /** True if Person A (the first birth date passed in) is the older of
   *  the two — order-independent inputs, this is how the UI knows which
   *  card to label "older" without the visitor having to sort it out. */
  olderIsPersonA: boolean;
  /** The gap itself, in calendar-accurate years/months/days plus running
   *  totals — computed by feeding the two birth dates straight into
   *  calculateAge (older birth date as "birth", younger birth date as
   *  "as of"), so it inherits the exact same leap-year- and
   *  month-length-aware math as every other age figure on the site,
   *  with no separate diffing logic to keep in sync. */
  gap: AgeBreakdown;
  personA: PersonSnapshot;
  personB: PersonSnapshot;
}

export const calculateAgeDifference = (
  personABirth: Date,
  personBBirth: Date,
  asOfDate: Date
): AgeDifferenceResult => {
  const olderIsPersonA = personABirth.getTime() <= personBBirth.getTime();
  const olderBirthDate = olderIsPersonA ? personABirth : personBBirth;
  const youngerBirthDate = olderIsPersonA ? personBBirth : personABirth;

  return {
    olderBirthDate,
    youngerBirthDate,
    olderIsPersonA,
    gap: calculateAge(olderBirthDate, youngerBirthDate),
    personA: { birthDate: personABirth, currentAge: calculateAge(personABirth, asOfDate) },
    personB: { birthDate: personBBirth, currentAge: calculateAge(personBBirth, asOfDate) },
  };
};

// --- LIFE-STAGE OVERLAY ---
// "When the younger person was born, the older one was already X years,
// Y months old" — the same `gap` figure above, reframed as a felt
// moment rather than a static number. No new math; kept as a thin,
// named helper purely so the component doesn't have to re-derive the
// sentence's meaning inline.
export const getLifeStageOverlay = (gap: AgeBreakdown): { years: number; months: number; days: number } => ({
  years: gap.years,
  months: gap.months,
  days: gap.days,
});

// --- AGE-GAP-AS-PERCENTAGE-OF-LIFE ---
// The one statistic none of the competitor calculators show: a fixed
// calendar gap is a shrinking fraction of both people's lives as they
// age. A 5-year gap between a 20- and 25-year-old is a 25% difference;
// the same 5-year gap between a 60- and 65-year-old is only ~8%. The
// absolute gap in days never changes — only its size relative to how
// much life has been lived does.
export interface AgeGapPercentagePoint {
  /** The younger person's whole-year age at this sample point. */
  youngerAge: number;
  /** The older person's whole-year age at this sample point (youngerAge
   *  + the fixed gap, so always youngerAge + a constant). */
  olderAge: number;
  /** The gap expressed as a percentage of the younger person's age at
   *  this point: gapYears / youngerAge * 100. */
  gapPercent: number;
}

/** Samples the "gap as % of life" curve from just after the younger
 *  person's birth out to `endAge`, every `stepYears` years, plus a final
 *  point exactly at `endAge` so the chart always reaches its right
 *  edge cleanly. The gap in years is derived from real elapsed days
 *  (not the calendar years/months/days breakdown) so the percentage
 *  math is smooth rather than staircase-shaped. */
export const getAgeGapPercentageSeries = (
  olderBirthDate: Date,
  youngerBirthDate: Date,
  opts?: { endAge?: number; stepYears?: number }
): AgeGapPercentagePoint[] => {
  const gapYears = (youngerBirthDate.getTime() - olderBirthDate.getTime()) / (MEAN_YEAR_DAYS * MS_PER_DAY);
  const endAge = opts?.endAge ?? 90;
  const stepYears = opts?.stepYears ?? 5;

  // Below age 1 the percentage figure explodes toward infinity (a fixed
  // gap divided by a near-zero age) and stops being a meaningful
  // statistic, so the series intentionally starts at age 1.
  const startAge = 1;

  const points: AgeGapPercentagePoint[] = [];
  for (let youngerAge = startAge; youngerAge < endAge; youngerAge += stepYears) {
    points.push({
      youngerAge,
      olderAge: Math.round((youngerAge + gapYears) * 10) / 10,
      gapPercent: Math.round((gapYears / youngerAge) * 1000) / 10,
    });
  }
  // Always include the exact end point so the chart's right edge lines
  // up with the axis label rather than stopping short at the last
  // multiple of stepYears below it.
  points.push({
    youngerAge: endAge,
    olderAge: Math.round((endAge + gapYears) * 10) / 10,
    gapPercent: Math.round((gapYears / endAge) * 1000) / 10,
  });
  return points;
};

// --- CATCH-UP PROJECTION ---
// The gap in years never closes — but there's a genuinely interesting
// future (or past) date worth naming: the day the younger person turns
// the exact age the older person is *right now*. Framed carefully as a
// projection, not a claim that the age gap disappears.
export const getCatchUpDate = (youngerBirthDate: Date, olderCurrentAgeYears: number): Date => {
  const year = youngerBirthDate.getFullYear() + olderCurrentAgeYears;
  const month = youngerBirthDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(youngerBirthDate.getDate(), lastDayOfMonth));
};

// --- GENERATION & ZODIAC, TWO-PERSON ---
// Thin wrappers around birthdayLogic.ts's own lookups so a change to
// those tables (a newly-named generation, a corrected zodiac cutoff)
// automatically stays in sync here rather than needing a parallel edit.

export interface TwoPersonGeneration {
  personA: GenerationInfo;
  personB: GenerationInfo;
  sameGeneration: boolean;
}

export const compareGenerations = (personABirth: Date, personBBirth: Date): TwoPersonGeneration => {
  const personA = getGeneration(personABirth.getFullYear());
  const personB = getGeneration(personBBirth.getFullYear());
  return { personA, personB, sameGeneration: personA.label === personB.label };
};

export interface TwoPersonZodiac {
  personA: WesternZodiacInfo;
  personB: WesternZodiacInfo;
  sameSign: boolean;
}

export const compareZodiac = (personABirth: Date, personBBirth: Date): TwoPersonZodiac => {
  const personA = getWesternZodiac(personABirth);
  const personB = getWesternZodiac(personBBirth);
  return { personA, personB, sameSign: personA.sign === personB.sign };
};

// --- FORMATTING HELPERS ---

/** "3 years, 2 months" / "2 months, 5 days" / "5 days" / "Same day" —
 *  drops zero-value leading units rather than always showing all three,
 *  since a same-day-of-month gap ("1 year, 0 months, 0 days") reads
 *  oddly with trailing zeros spelled out. */
export const formatAgeGap = (gap: AgeBreakdown): string => {
  const parts: string[] = [];
  if (gap.years > 0) parts.push(`${gap.years} ${gap.years === 1 ? 'year' : 'years'}`);
  if (gap.months > 0) parts.push(`${gap.months} ${gap.months === 1 ? 'month' : 'months'}`);
  if (gap.days > 0 || parts.length === 0) parts.push(`${gap.days} ${gap.days === 1 ? 'day' : 'days'}`);
  return parts.join(', ');
};

export { formatWithCommas };

// --- SOURCES & REFERENCES ---
// Calendar-math citations (leap years, the age-calculation convention,
// Feb 29 handling) live in dateLogic.ts's own DATE_SOURCES and generation
// citations live in birthdayLogic.ts's own BIRTHDAY_SOURCES — both
// apply here unchanged and should be shown alongside these in the
// component's Sources drawer rather than repeated. Only the
// relationship/age-gap statistics genuinely specific to this calculator
// are listed here.
export const AGE_DIFFERENCE_SOURCES: SourceEntry[] = [
  {
    metric: 'Average Age Gap in US Couples',
    citation: 'The most recent US Current Population Survey data (2014) puts the average age difference between opposite-sex spouses at roughly 2.3 years. Reporting on anonymized Facebook relationship data separately put the international average nearer 2.4 years, with an older male partner in the majority of different-sex couples. Both figures are population averages, not a "normal" or recommended range for any individual couple.',
    url: 'https://www.bbc.com/worklife/article/20220317-age-gaps-the-relationship-taboo-that-wont-die',
    linkLabel: 'BBC Worklife — Age gaps: the relationship taboo that won\u2019t die',
  },
  {
    metric: 'Age Gaps in Same-Sex Couples',
    citation: 'Multiple independent analyses, including US Census Bureau research, have found that same-sex couples tend to have a somewhat larger average age gap than opposite-sex couples. This calculator does not treat any age gap size as more or less typical based on the genders involved.',
    url: 'https://www.census.gov/content/dam/Census/library/working-papers/2023/demo/sehsd-wp2023-10.pdf',
    linkLabel: 'US Census Bureau — working paper (PDF)',
  },
  {
    metric: 'Relationship Satisfaction by Age-Gap Size',
    citation: 'A study published in the Journal of Population Economics found couples with smaller age gaps (up to about three years) tended to report higher relationship satisfaction on average than couples with larger gaps, with satisfaction declining further as the gap widened past roughly six years. This is a population-level correlation from one study, not a rule that applies to any specific couple.',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6785043/',
    linkLabel: 'NCBI / Journal of Population Economics — study (PMC)',
  },
  {
    metric: '"Half-Your-Age-Plus-Seven" Rule',
    citation: 'A long-standing pop-culture rule of thumb suggests a socially acceptable minimum partner age as (one\u2019s own age \u00f7 2) + 7. It originates in informal etiquette writing, not research, and is presented here only as a cultural reference point some visitors may recognize \u2014 not as guidance this calculator endorses or applies to its results.',
  },
];
