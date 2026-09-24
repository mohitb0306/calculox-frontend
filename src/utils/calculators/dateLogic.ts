// --- TYPES ---
// Shared logic engine for the date-based calculator family (Chronological
// Age, Birthday, Age Difference). Mirrors the separation-of-concerns
// pattern used by bmiLogic.ts / bmrLogic.ts / bodyFatLogic.ts: this file
// holds pure functions only (validation, calendar math, lookups) — no
// state, no UI. Deliberately self-contained, matching whrLogic.ts's
// convention of not importing sibling logic files.

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

/** Calendar-accurate elapsed time between two instants, broken down into
 *  completed years/months/days plus running totals in coarser units. */
export interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
}

export interface NextBirthdayInfo {
  date: Date;
  daysUntil: number;
  dayOfWeek: string;
  turningAge: number;
  isToday: boolean;
}

export interface MilestoneEntry {
  age: number;
  label: string;
  date: Date;
  achieved: boolean;
  daysAway: number; // negative once achieved (days since), positive if upcoming
  dayOfWeek: string;
}

export interface DayCountMilestone {
  dayCount: number;
  label: string;
  date: Date;
  achieved: boolean;
  daysAway: number;
}

export interface PetYearsResult {
  /** Equivalent age in "dog years" — the inverse of the widely-published
   *  human-year-equivalence table (see PET_YEARS_SOURCES). */
  dogYears: number;
  /** Equivalent age in "cat years" — same inversion, cat table. */
  catYears: number;
}

export interface WeekdayTally {
  day: string;
  count: number;
}

const AGE_MIN_YEARS = 0;
const AGE_MAX_YEARS = 130;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- VALIDATION ---
// Mirrors validateBMIInput / validateBMRInput's structure: a single
// isValid/error shape, sanity bounds rather than clinical cut-offs.

export const validateDateInput = (birthDate: Date | null, asOfDate: Date): ValidationResult => {
  if (!birthDate || Number.isNaN(birthDate.getTime())) {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }
  if (Number.isNaN(asOfDate.getTime())) {
    return { isValid: false, error: 'Please enter a valid "as of" date.' };
  }
  if (birthDate.getTime() > asOfDate.getTime()) {
    return { isValid: false, error: 'Date of birth cannot be in the future relative to the "as of" date.' };
  }
  const years = (asOfDate.getTime() - birthDate.getTime()) / (365.2425 * MS_PER_DAY);
  if (years > AGE_MAX_YEARS) {
    return { isValid: false, error: `Please enter a realistic date of birth (within the last ${AGE_MAX_YEARS} years).` };
  }
  if (years < AGE_MIN_YEARS) {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }
  return { isValid: true };
};

// --- CORE AGE CALCULATION ---
// Calendar-aware, not a naive (end-start)/msPerYear divide: the
// years/months/days breakdown is walked in local calendar terms (matching
// each field to a real calendar boundary), the same discipline bmiLogic.ts
// applies to unit conversion — a raw millisecond delta would silently
// misreport this whenever a leap year, or a run of 31- vs 30-day months,
// falls inside the interval. Running totals (totalHours/Minutes/Seconds)
// intentionally DO use a plain millisecond delta — Date.getTime() is a
// UTC-epoch instant, so that delta is real elapsed time regardless of
// DST transitions in between; it's only the *calendar* breakdown above
// that requires date-component arithmetic rather than millisecond math.

export const calculateAge = (birthDate: Date, asOfDate: Date): AgeBreakdown => {
  let years = asOfDate.getFullYear() - birthDate.getFullYear();
  let months = asOfDate.getMonth() - birthDate.getMonth();
  let days = asOfDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    // Last day of the month immediately before asOfDate's month — this is
    // how many days "borrowed" from that month to make `days` non-negative.
    const prevMonthLastDay = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMs = Math.max(0, asOfDate.getTime() - birthDate.getTime());

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalWeeks: Math.floor(totalMs / (MS_PER_DAY * 7)),
    totalDays: Math.floor(totalMs / MS_PER_DAY),
    totalHours: Math.floor(totalMs / MS_PER_HOUR),
    totalMinutes: Math.floor(totalMs / MS_PER_MINUTE),
    totalSeconds: Math.floor(totalMs / MS_PER_SECOND),
  };
};

// --- LEAP-YEAR (FEB 29) BIRTHDAYS ---

export const isFeb29Birthday = (birthDate: Date): boolean =>
  birthDate.getMonth() === 1 && birthDate.getDate() === 29;

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Resolves the calendar date a Feb-29 birthday is observed on in a given
 * (possibly non-leap) year. There's no single universal convention — this
 * follows the same approach most jurisdictions and calendar tools use for
 * legal/annual purposes: Feb 28 in a non-leap year, Feb 29 in a leap year.
 */
const resolveObservedBirthday = (birthDate: Date, targetYear: number): Date => {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  if (month === 1 && day === 29 && !isLeapYear(targetYear)) {
    return new Date(targetYear, 1, 28);
  }
  return new Date(targetYear, month, day);
};

// --- NEXT BIRTHDAY ---

export const getNextBirthday = (birthDate: Date, asOfDate: Date): NextBirthdayInfo => {
  const asOfMidnight = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  let candidateYear = asOfMidnight.getFullYear();
  let candidate = resolveObservedBirthday(birthDate, candidateYear);

  if (candidate.getTime() < asOfMidnight.getTime()) {
    candidateYear += 1;
    candidate = resolveObservedBirthday(birthDate, candidateYear);
  }

  const isToday = candidate.getTime() === asOfMidnight.getTime();
  const daysUntil = Math.round((candidate.getTime() - asOfMidnight.getTime()) / MS_PER_DAY);
  const turningAge = candidateYear - birthDate.getFullYear();

  return {
    date: candidate,
    daysUntil,
    dayOfWeek: WEEKDAY_LABELS[candidate.getDay()],
    turningAge,
    isToday,
  };
};

// --- MILESTONE BIRTHDAYS ---
// A fixed, commonly-referenced set of "notable" birthdays (legal, cultural,
// or round-number milestones), not tied to any one jurisdiction's specific
// legal ages — presented as a countdown table, not a claim about rights.

// Kept deliberately short: first birthday, teens, legal/cultural adulthood
// (18, 21), the round decades people actually celebrate, retirement age (65),
// and the two "big late-life" markers (80, 100).
const MILESTONE_AGES: number[] = [1, 13, 18, 21, 30, 40, 50, 65, 80, 100];

export const getMilestoneBirthdays = (birthDate: Date, asOfDate: Date): MilestoneEntry[] => {
  return MILESTONE_AGES.map((age) => {
    const date = resolveObservedBirthday(birthDate, birthDate.getFullYear() + age);
    const achieved = date.getTime() <= asOfDate.getTime();
    const daysAway = Math.round((date.getTime() - asOfDate.getTime()) / MS_PER_DAY);
    return {
      age,
      label: `${age}${ordinalSuffix(age)} Birthday`,
      date,
      achieved,
      daysAway,
      dayOfWeek: WEEKDAY_LABELS[date.getDay()],
    };
  });
};

/** Returns just the next un-achieved milestone, for a compact headline. */
export const getNextMilestone = (milestones: MilestoneEntry[]): MilestoneEntry | null =>
  milestones.find((m) => !m.achieved) ?? null;

const ordinalSuffix = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// --- DAY-COUNT MILESTONES ---
// A distinctly "chronological" framing (day-count anniversaries) rather
// than birthday-count — deliberately not shown by the Birthday Calculator,
// which owns birth-year trivia instead.

const DAY_COUNT_MILESTONES: number[] = [1000, 5000, 10000, 15000, 20000, 25000, 30000];

export const getDayCountMilestones = (birthDate: Date, asOfDate: Date): DayCountMilestone[] => {
  return DAY_COUNT_MILESTONES.map((dayCount) => {
    const date = new Date(birthDate.getTime() + dayCount * MS_PER_DAY);
    const achieved = date.getTime() <= asOfDate.getTime();
    const daysAway = Math.round((date.getTime() - asOfDate.getTime()) / MS_PER_DAY);
    return {
      dayCount,
      label: `${dayCount.toLocaleString()}-Day Milestone`,
      date,
      achieved,
      daysAway,
    };
  });
};

// --- BIRTHDAY WEEKDAY RETROSPECTIVE ---
// How many of the person's past birthdays fell on each day of the week —
// real, verifiable calendar math, not a lookup or an estimate.

export const getBirthdayWeekdayTally = (birthDate: Date, asOfDate: Date): WeekdayTally[] => {
  const counts = new Array(7).fill(0);
  const ageNow = calculateAge(birthDate, asOfDate).years;
  for (let a = 1; a <= ageNow; a++) {
    const d = resolveObservedBirthday(birthDate, birthDate.getFullYear() + a);
    if (d.getTime() <= asOfDate.getTime()) {
      counts[d.getDay()] += 1;
    }
  }
  return WEEKDAY_LABELS.map((day, i) => ({ day, count: counts[i] }));
};

/** The next future year in which the birthday falls on the same weekday
 *  it did in `asOfDate`'s year — satisfying, verifiable calendar trivia. */
export const getNextSameWeekdayBirthdayYear = (birthDate: Date, asOfDate: Date): { year: number; date: Date } => {
  const thisYearBirthday = resolveObservedBirthday(birthDate, asOfDate.getFullYear());
  const targetWeekday = thisYearBirthday.getDay();
  for (let y = asOfDate.getFullYear() + 1; y <= asOfDate.getFullYear() + 40; y++) {
    const d = resolveObservedBirthday(birthDate, y);
    if (d.getDay() === targetWeekday) {
      return { year: y, date: d };
    }
  }
  // Practically unreachable (the weekday cycle repeats well within 40
  // years), but keeps the function total rather than possibly-undefined.
  return { year: asOfDate.getFullYear() + 6, date: resolveObservedBirthday(birthDate, asOfDate.getFullYear() + 6) };
};

// --- DOG YEARS / CAT YEARS ---
// Uses the modern, widely-published non-linear human-year-equivalence
// tables (see DATE_SOURCES) — NOT the old, debunked "1 pet year = 7 human
// years" myth. Those tables map a *pet's* age to an equivalent human age
// (front-loaded: a lot of maturity in year one, less per year after).
// "Your age in dog/cat years" runs that mapping in reverse: given the
// person's own age as the human-equivalent figure, solve for the pet age
// that would map to it, by inverting each linear segment of the table.
// This is a playful equivalence, not a veterinary or biological claim —
// presented as such in the UI.

const invertSegment = (age: number, breakpoints: Array<[number, number]>): number => {
  // breakpoints: sorted [petAge, humanEquivalent] anchor pairs. Finds the
  // segment `age` falls in and linearly interpolates the pet-age solution.
  for (let i = 1; i < breakpoints.length; i++) {
    const [petPrev, humanPrev] = breakpoints[i - 1];
    const [petNext, humanNext] = breakpoints[i];
    if (age <= humanNext || i === breakpoints.length - 1) {
      const span = humanNext - humanPrev;
      const t = span > 0 ? (age - humanPrev) / span : 0;
      return petPrev + t * (petNext - petPrev);
    }
  }
  return 0;
};

// [dog age, human-equivalent age] anchors from AVMA's published chart for
// a medium-size dog (21\u201350 lbs) \u2014 the specific weight class AVMA's own
// chart footnotes this table to. Verified against AVMA's own poster PDF
// (ebusiness.avma.org/files/productdownloads/PetsAgeFasterPoster.pdf) and
// cross-checked against independent secondary reporting of the same AVMA
// figures. Per-year anchors are used, not a flat rate, because the actual
// published growth isn't linear after year 2 \u2014 it runs roughly +4 to +5
// human years per dog year (a fixed +5/year, used in an earlier version of
// this table, overstated every anchor from year 3 on by up to 6 years).
// Beyond the chart's published range (year 16), extrapolated at the same
// ~+4.5/year average the published years already show.
const DOG_ANCHORS: Array<[number, number]> = [
  [0, 0], [1, 15], [2, 24], [3, 28], [4, 32], [5, 36], [6, 42], [7, 47],
  [8, 51], [9, 56], [10, 60], [11, 65], [12, 69], [13, 74], [14, 78],
  [15, 83], [16, 87], [25, 128],
];

// [cat age, human-equivalent age] anchors from AVMA's published chart for
// cats (AVMA doesn't split this one by weight/breed the way it does for
// dogs). A flat +4 human years per cat year after year 2 \u2014 confirmed both
// against AVMA's own poster PDF and independent secondary reporting of the
// same AVMA figures. Beyond the chart's published range (year 16),
// extrapolated at that same +4/year rate.
const CAT_ANCHORS: Array<[number, number]> = [
  [0, 0], [1, 15], [2, 24], [3, 28], [4, 32], [5, 36], [6, 40], [7, 44],
  [8, 48], [9, 52], [10, 56], [11, 60], [12, 64], [13, 68], [14, 72],
  [15, 76], [16, 80], [25, 116],
];

export const calculatePetYears = (humanAgeYears: number): PetYearsResult => {
  const age = Math.max(0, humanAgeYears);
  return {
    dogYears: Math.round(invertSegment(age, DOG_ANCHORS) * 10) / 10,
    catYears: Math.round(invertSegment(age, CAT_ANCHORS) * 10) / 10,
  };
};

// --- POPULATION-AVERAGE ESTIMATES ---
// Explicitly labeled as population-average estimates derived from
// published resting-rate figures, never presented as personal biometrics
// — same disclaimer discipline as bmiLogic's getGenderContextNote.

const AVG_RESTING_HEART_RATE_BPM = 70; // American Heart Association, healthy resting adult average
const AVG_BREATHS_PER_MINUTE = 16; // Commonly cited average adult resting respiratory rate
const AVG_SLEEP_HOURS_PER_DAY = 7.5; // CDC-cited recommended/average adult sleep duration

export interface LifetimeEstimates {
  estimatedHeartbeats: number;
  estimatedBreaths: number;
  estimatedSleepHours: number;
  estimatedSleepYears: number;
}

export const getLifetimeEstimates = (totalMinutesAlive: number): LifetimeEstimates => {
  const estimatedHeartbeats = Math.round(totalMinutesAlive * AVG_RESTING_HEART_RATE_BPM);
  const estimatedBreaths = Math.round(totalMinutesAlive * AVG_BREATHS_PER_MINUTE);
  const totalDaysAlive = totalMinutesAlive / (60 * 24);
  const estimatedSleepHours = Math.round(totalDaysAlive * AVG_SLEEP_HOURS_PER_DAY);
  const estimatedSleepYears = Math.round((estimatedSleepHours / 24 / 365.2425) * 10) / 10;
  return { estimatedHeartbeats, estimatedBreaths, estimatedSleepHours, estimatedSleepYears };
};

// --- FORMATTING HELPERS ---

// Locale is pinned to 'en-US' deliberately (rather than calling
// toLocaleString() with no argument) so every visitor sees the same
// digit grouping — 570,737, not 5,70,737 — regardless of their device's
// own locale/region setting. Leaving the locale unspecified is what
// causes that inconsistency: it silently follows whichever locale the
// browser reports, so the exact same number renders with different
// comma placement for different visitors.
export const formatWithCommas = (n: number): string => Math.round(n).toLocaleString('en-US');

export const getWeekdayLabel = (date: Date): string => WEEKDAY_LABELS[date.getDay()];

/** Returns a copy of `date` with its time-of-day zeroed to local midnight.
 *  Used wherever a time-of-day is optional and defaults to midnight (e.g.
 *  "time of birth" fields across the date-based calculator family) — kept
 *  here, rather than inlined per-component, since Birthday and Age
 *  Difference will need the same default. */
export const atMidnight = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** True if `date`'s time-of-day is exactly local midnight — the
 *  representation this calculator family uses for "no time provided". */
export const isAtMidnight = (date: Date): boolean =>
  date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;

// --- SOURCES & REFERENCES ---

export const DATE_SOURCES: SourceEntry[] = [
  {
    metric: 'Age Calculation Convention',
    citation: 'Age is calculated by completed years/months/days in the Gregorian calendar — the universal convention for stating a person\u2019s age, as opposed to counting elapsed calendar years regardless of whether the birthday has occurred yet.',
    url: 'https://en.wikipedia.org/wiki/Gregorian_calendar',
    linkLabel: 'Gregorian Calendar \u2014 reference',
  },
  {
    metric: 'Feb 29 (Leap-Day) Birthdays',
    citation: 'There is no single universal legal convention for observing a Feb 29 birthday in a non-leap year; this calculator follows the common approach of treating Feb 28 as the observed date in non-leap years, consistent with how most calendar and scheduling tools resolve it.',
  },
  {
    metric: 'Resting Heart Rate (heartbeat estimate)',
    citation: `American Heart Association \u2014 a normal adult resting heart rate is generally cited as 60\u2013100 beats per minute; ${AVG_RESTING_HEART_RATE_BPM} bpm (the midpoint) is used here as a population-average estimate, not a personal measurement.`,
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse',
    linkLabel: 'American Heart Association \u2014 All About Heart Rate',
  },
  {
    metric: 'Resting Respiratory Rate (breath estimate)',
    citation: `A normal adult resting respiratory rate is commonly cited as 12\u201320 breaths per minute in clinical references; ${AVG_BREATHS_PER_MINUTE} breaths/minute is used here as a population-average midpoint estimate.`,
  },
  {
    metric: 'Average Sleep Duration',
    citation: `CDC recommends adults get 7 or more hours of sleep per night; ${AVG_SLEEP_HOURS_PER_DAY} hours/day is used here as a population-average estimate to project total lifetime sleep hours, not a personal sleep-tracking figure.`,
    url: 'https://www.cdc.gov/sleep/about/index.html',
    linkLabel: 'CDC \u2014 About Sleep',
  },
  {
    metric: 'Dog Years / Cat Years Equivalence',
    citation: 'Uses AVMA\u2019s own published non-linear human-year-equivalence charts (year 1 \u2248 15 human years, year 2 \u2248 +9, then roughly +4\u2013+5 per subsequent dog year or a flat +4 per subsequent cat year) to replace the older, debunked "1 pet year = 7 human years" rule of thumb. The dog figures are AVMA\u2019s medium-size-dog (21\u201350 lb) chart specifically, since AVMA doesn\u2019t publish one flat dog table. Presented here as a playful equivalence, inverted to express a human\u2019s own age in pet-year terms \u2014 not a veterinary or biological claim, and not breed-adjusted beyond that one weight class.',
    url: 'https://www.avma.org/resources/pet-owners/petcare/how-determine-age-your-dog-cat',
    linkLabel: 'American Veterinary Medical Association \u2014 How to Determine the Age of Your Dog or Cat',
  },
];
