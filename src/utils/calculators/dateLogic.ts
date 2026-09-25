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
// Calendar-aware, not a naive (end-start)/msPerYear divide. The
// years/months/days breakdown counts whole calendar months from the birth
// date, clamping the day-of-month to the target month's length (Jan 31 + 1
// month = Feb 28; Feb 29 + 12 months = Feb 28 in a non-leap year), then
// counts the remaining days from that anchor. This is the same rule
// Java's Period.between and Python's dateutil.relativedelta use, and it
// keeps age consistent with resolveObservedBirthday below (a Feb-29
// birthday is reached on Feb 28 in a non-leap year).
//
// An earlier version borrowed days from the previous month and then
// clamped a negative result to 0, which under-reported days for people
// born on the 29th-31st (e.g. Jan 31 -> Mar 2 showed "1m 0d", not "1m 2d")
// and disagreed with the Feb-28 birthday convention for leaplings.
//
// Running totals (totalHours/Minutes/Seconds) intentionally DO use a plain
// millisecond delta: Date.getTime() is a UTC-epoch instant, so that delta
// is real elapsed time regardless of DST transitions in between. The
// calendar breakdown uses dates only, so age ticks over at local midnight
// on the birthday, not at the exact time of birth.

/** Adds whole calendar months to `date`, clamping the day-of-month to the
 *  target month's length. Returns local midnight of the resulting day. */
const addMonthsClamped = (date: Date, months: number): Date => {
  const total = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDayOfMonth));
};

export const calculateAge = (birthDate: Date, asOfDate: Date): AgeBreakdown => {
  const birthDay = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  const asOfDay = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());

  let totalMonths =
    (asOfDay.getFullYear() - birthDay.getFullYear()) * 12 + (asOfDay.getMonth() - birthDay.getMonth());
  if (addMonthsClamped(birthDay, totalMonths).getTime() > asOfDay.getTime()) {
    totalMonths -= 1;
  }
  totalMonths = Math.max(0, totalMonths);

  const anchor = addMonthsClamped(birthDay, totalMonths);
  // Math.round absorbs the 23h/25h days around DST changes.
  const days = Math.max(0, Math.round((asOfDay.getTime() - anchor.getTime()) / MS_PER_DAY));

  const totalMs = Math.max(0, asOfDate.getTime() - birthDate.getTime());

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
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
 * (possibly non-leap) year. There's no single universal convention — some
 * jurisdictions treat Mar 1 as the anniversary, others Feb 28 (see the
 * "Legal age" source in DATE_SOURCES). This calculator uses Feb 28 in a
 * non-leap year and Feb 29 in a leap year, applied consistently across age,
 * next birthday, milestones and the weekday tally.
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
    // Calendar arithmetic (day-of-month overflow), NOT birth + N*24h in
    // milliseconds: across a DST change the ms version lands at 23:00 the
    // day before (or 01:00 the day after) and shows the wrong date.
    const date = new Date(
      birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate() + dayCount,
      birthDate.getHours(), birthDate.getMinutes(), birthDate.getSeconds(), birthDate.getMilliseconds()
    );
    const achieved = date.getTime() <= asOfDate.getTime();
    const daysAway = Math.round((date.getTime() - asOfDate.getTime()) / MS_PER_DAY);
    return {
      dayCount,
      label: `${dayCount.toLocaleString('en-US')}-Day Milestone`,
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

// --- POPULATION-AVERAGE ESTIMATES ---
// Explicitly labeled as population-average estimates derived from
// published resting-rate figures, never presented as personal biometrics
// — same disclaimer discipline as bmiLogic's getGenderContextNote.

const AVG_RESTING_HEART_RATE_BPM = 70; // Assumed round figure inside AHA's 60–100 bpm normal adult range (NOT the midpoint, which is 80)
const AVG_BREATHS_PER_MINUTE = 16; // Midpoint of the 12–20 breaths/min normal adult resting range (MedlinePlus)
const AVG_SLEEP_HOURS_PER_DAY = 7.5; // Assumed round figure inside CDC's 7+ h (18–60), 7–9 h (61–64), 7–8 h (65+) recommendations; a recommendation, not a measured average

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
    metric: 'Calendar Arithmetic (Gregorian Leap-Year Rule)',
    citation: 'Dates follow the Gregorian calendar: a year is a leap year if it is divisible by 4, except century years not divisible by 400. That gives 97 leap years per 400 years and a mean year of 365.2425 days, the value used for the age-range check and the sleep-years conversion.',
    url: 'https://aa.usno.navy.mil/faq/leap_years',
    linkLabel: 'U.S. Naval Observatory \u2014 Leap Years',
  },
  {
    metric: 'Age Calculation Convention',
    citation: 'Age is counted as completed years, months and days between the date of birth and the \u201cas of\u201d date on the Gregorian calendar. When a birth day-of-month does not exist in a later month (for example the 31st), the last day of that month is used. Age advances at local midnight, not at the exact time of birth.',
    url: 'https://en.wikipedia.org/wiki/Gregorian_calendar',
    linkLabel: 'Gregorian Calendar \u2014 reference',
  },
  {
    metric: 'Feb 29 (Leap-Day) Birthdays',
    citation: 'There is no single universal rule for when a Feb 29 birthday is observed in a non-leap year \u2014 depending on the jurisdiction it is treated as Feb 28 or March 1. This calculator uses Feb 28 consistently for age, next birthday and milestones. For anything legally significant, such as an age-restricted right, check the rules where you live.',
    url: 'https://en.wikipedia.org/wiki/Legal_age',
    linkLabel: 'Wikipedia \u2014 Legal age (leap-day birthdays)',
  },
  {
    metric: 'Resting Heart Rate (heartbeat estimate)',
    citation: `American Heart Association \u2014 a normal adult resting heart rate is 60\u2013100 beats per minute. ${AVG_RESTING_HEART_RATE_BPM} bpm is an assumed round figure within that range, used as a rough population-average estimate, not a personal measurement. One adult rate is applied across the whole lifespan even though infants and children have faster resting rates, so the total is approximate.`,
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse',
    linkLabel: 'American Heart Association \u2014 All About Heart Rate',
  },
  {
    metric: 'Resting Respiratory Rate (breath estimate)',
    citation: `MedlinePlus (U.S. National Library of Medicine) gives a normal adult resting breathing rate of 12\u201320 breaths per minute; ${AVG_BREATHS_PER_MINUTE} breaths/minute, the midpoint, is used here as a rough estimate. Infants and children breathe faster, so lifetime totals are approximate.`,
    url: 'https://medlineplus.gov/ency/article/007198.htm',
    linkLabel: 'MedlinePlus \u2014 Rapid shallow breathing (normal rates)',
  },
  {
    metric: 'Average Sleep Duration',
    citation: `CDC recommends 7 or more hours of sleep per night for adults aged 18\u201360 (7\u20139 hours for ages 61\u201364, 7\u20138 hours for 65+). ${AVG_SLEEP_HOURS_PER_DAY} hours/day is an assumed round figure within those recommendations, used to project total lifetime sleep. It is a recommendation, not a measured average, and one adult figure is applied to every age even though children and infants need more sleep.`,
    url: 'https://www.cdc.gov/sleep/about/index.html',
    linkLabel: 'CDC \u2014 About Sleep',
  },
];
