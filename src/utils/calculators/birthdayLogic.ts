// --- TYPES ---
// Birthday Calculator's own logic file, matching the bmiLogic.ts /
// bmrLogic.ts / whrLogic.ts / dateLogic.ts pattern: pure functions only
// (validation, calendar math, lookups) — no state, no UI.
//
// This file deliberately BUILDS ON dateLogic.ts rather than duplicating
// it: dateLogic.ts's own header describes itself as the shared logic
// engine for the whole date-based calculator family (Chronological Age,
// Birthday, Age Difference), so generic pieces (validation, the Feb-29
// midnight convention, formatting helpers) are imported from there. Only
// genuinely Birthday-specific math lives here.

import {
  type ValidationResult,
  type SourceEntry,
  type NextBirthdayInfo,
  validateDateInput,
  getNextBirthday,
  calculateAge,
  isLeapYear,
  atMidnight,
  getWeekdayLabel,
  formatWithCommas,
  isFeb29Birthday,
} from './dateLogic';

export type { ValidationResult, SourceEntry, NextBirthdayInfo };

// --- CURRENT AGE ---
// Re-exported as-is from dateLogic.ts (the Chronological Age Calculator's
// own engine) rather than reimplemented here — Birthday Calculator only
// needs a single, static "as of now" years/months/days snapshot for the
// Next Birthday card's header (see CurrentAgeCaption in
// BirthdayCalculator.tsx), not the live-ticking, totalSeconds-down-to-the-
// second breakdown that calculator builds on top of this same function.
export const calculateCurrentAge = calculateAge;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// --- VALIDATION ---
// Re-exported as-is: the same sanity bounds (not-in-the-future, within
// 130 years) apply to a birth date regardless of which calculator is
// asking, so there is no Birthday-specific variant to write.
export const validateBirthdayInput = validateDateInput;

// --- LEAP-DAY (FEB 29) RESOLUTION ---
// dateLogic.ts's own resolveObservedBirthday is intentionally private
// (not exported), so this is a small, deliberate duplicate — kept
// byte-for-byte in sync with the same convention (Feb 28 in a non-leap
// year, Feb 29 in a leap year) so a Feb-29 birthday lands on the same
// calendar date across the Age and Birthday calculators. If that
// convention ever changes, update both copies together.
const resolveBirthdayInYear = (birthDate: Date, targetYear: number): Date => {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  if (month === 1 && day === 29 && !isLeapYear(targetYear)) {
    return new Date(targetYear, 1, 28);
  }
  return new Date(targetYear, month, day);
};

// --- LIVE COUNTDOWN ---

export interface CountdownBreakdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Pure ms-delta breakdown between `now` and a future `targetDate` —
 *  the same "epoch-instant delta" approach dateLogic.ts uses for its
 *  running totals, so the countdown ticks smoothly through DST changes
 *  instead of drifting by an hour. Clamped at zero so a stale `now`
 *  (e.g. right as the birthday arrives) never shows a negative count. */
export const getCountdownBreakdown = (targetDate: Date, now: Date): CountdownBreakdown => {
  const totalMs = Math.max(0, targetDate.getTime() - now.getTime());
  return {
    totalMs,
    days: Math.floor(totalMs / MS_PER_DAY),
    hours: Math.floor((totalMs % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND),
  };
};

/** Re-exported for convenience so BirthdayCalculator.tsx has one import
 *  source for "when's the next birthday" — identical calculation to the
 *  Age Calculator's, deliberately not reimplemented. */
export const getNextBirthdayInfo = getNextBirthday;

// --- GOLDEN BIRTHDAY ---
// A widely-known but informally-defined tradition (also called a
// "champagne" or "lucky" birthday): the birthday on which a person's new
// age equals the calendar day of the month they were born (e.g. turning
// 17 on the 17th). There is no single official coining or governing
// body for the term — sources disagree even on decade of origin — so
// this is presented as a popular tradition, not attributed to one
// citable authority. The math itself is exact and unambiguous.

// Shared resolver behind Golden Birthday and its two "missed it" variants
// below (Double Golden, Platinum) — each one is just "the birthday where
// you turn a specific target age," computed identically. Keeping that
// math in one place instead of copying it three times is the same
// pattern already used elsewhere in this file (see getUpcomingBirthdays).
interface MilestoneBirthdayInfo {
  targetAge: number;
  date: Date;
  achieved: boolean;
  isToday: boolean;
  daysAway: number; // negative if already passed
}

const resolveMilestoneBirthday = (birthDate: Date, asOfDate: Date, targetAge: number): MilestoneBirthdayInfo => {
  const asOfMidnight = atMidnight(asOfDate);
  const date = resolveBirthdayInYear(birthDate, birthDate.getFullYear() + targetAge);
  const daysAway = Math.round((date.getTime() - asOfMidnight.getTime()) / MS_PER_DAY);
  return {
    targetAge,
    date,
    achieved: date.getTime() <= asOfMidnight.getTime(),
    isToday: date.getTime() === asOfMidnight.getTime(),
    daysAway,
  };
};

export interface GoldenBirthdayInfo extends MilestoneBirthdayInfo {
  goldenDay: number; // the day-of-month, i.e. the target age
}

export const getGoldenBirthday = (birthDate: Date, asOfDate: Date): GoldenBirthdayInfo => {
  const goldenDay = birthDate.getDate();
  return { goldenDay, ...resolveMilestoneBirthday(birthDate, asOfDate, goldenDay) };
};

// --- DOUBLE GOLDEN BIRTHDAY ---
// An informal extension for people whose golden birthday already passed
// in early childhood: the birthday where your age is exactly double your
// birth day-of-month (born on the 15th -> double golden at 30). Sources
// disagree on what "double golden" even means — some use day x 2 (the
// most common version, used here), others define it as age digits
// summing to the birth date, or age matching the last two digits of
// birth year. Rather than pick a single site's idiosyncratic version,
// this calculator sticks to the day x 2 definition, since it's the one
// used consistently across independent, unrelated sources.
export interface DoubleGoldenBirthdayInfo extends MilestoneBirthdayInfo {
  doubleGoldenAge: number;
}

export const getDoubleGoldenBirthday = (birthDate: Date, asOfDate: Date): DoubleGoldenBirthdayInfo => {
  const doubleGoldenAge = birthDate.getDate() * 2;
  return { doubleGoldenAge, ...resolveMilestoneBirthday(birthDate, asOfDate, doubleGoldenAge) };
};

// --- PLATINUM BIRTHDAY ---
// Another informal "missed it" variant: the birthday where your age is
// your birth day-of-month with its digits reversed, treating the day as
// two digits (the 3rd -> "03" -> "30" -> platinum at 30; the 14th ->
// "14" -> "41" -> platinum at 41). Same caveat as Double Golden: a couple
// of sources use "platinum birthday" for something else (age matching
// the last two digits of birth year), so this calculator uses the
// digit-reversal definition, which is the one that shows up consistently
// across independent guides. For palindromic days (11th, 22nd), reversing
// the digits changes nothing, so the platinum birthday is identical to
// the golden birthday.
export interface PlatinumBirthdayInfo extends MilestoneBirthdayInfo {
  platinumAge: number;
  sameAsGolden: boolean;
}

export const getPlatinumBirthday = (birthDate: Date, asOfDate: Date): PlatinumBirthdayInfo => {
  const day = birthDate.getDate();
  const platinumAge = Number(String(day).padStart(2, '0').split('').reverse().join(''));
  return { platinumAge, sameAsGolden: platinumAge === day, ...resolveMilestoneBirthday(birthDate, asOfDate, platinumAge) };
};

// --- FORWARD BIRTHDAY TABLE ---
// The Age Calculator's Day-Count Milestones and weekday tally are
// retrospective (how many days/birthdays have passed). This is the
// Birthday Calculator's forward-looking counterpart: the next N
// birthdays with the weekday each will fall on, useful for planning
// ahead rather than looking back.

export interface UpcomingBirthday {
  turningAge: number;
  date: Date;
  dayOfWeek: string;
  daysAway: number;
  isWeekend: boolean;
}

export const getUpcomingBirthdays = (birthDate: Date, asOfDate: Date, count: number): UpcomingBirthday[] => {
  const asOfMidnight = atMidnight(asOfDate);
  const next = getNextBirthday(birthDate, asOfDate);
  const results: UpcomingBirthday[] = [];
  for (let i = 0; i < count; i++) {
    const date = resolveBirthdayInYear(birthDate, next.date.getFullYear() + i);
    const daysAway = Math.round((date.getTime() - asOfMidnight.getTime()) / MS_PER_DAY);
    const dow = date.getDay();
    results.push({
      turningAge: date.getFullYear() - birthDate.getFullYear(),
      date,
      dayOfWeek: getWeekdayLabel(date),
      daysAway,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return results;
};

// --- DAY-OF-YEAR BORN ---
// Simple, exact calendar arithmetic: which numbered day of its calendar
// year the birth date fell on (Jan 1 = day 1), and how many days
// remained in that year afterward. Same Gregorian rules as the rest of
// the date-based family, no new convention introduced.

export interface DayOfYearInfo {
  dayOfYear: number;
  daysRemainingInBirthYear: number;
  yearLength: 365 | 366;
  // The actual historical weekday the birth date fell on (e.g.
  // "Wednesday") — distinct from every other weekday already surfaced
  // elsewhere in this file (getNextBirthdayInfo/getUpcomingBirthdays both
  // report the weekday of a future occurrence, never of the birth date
  // itself), so this is the one place that fact is computed.
  weekdayBorn: string;
  // Calendar quarter (Jan–Mar = 1, ... Oct–Dec = 4) the birth date falls
  // in — plain Gregorian arithmetic, no convention to cite.
  quarter: 1 | 2 | 3 | 4;
}

export const getDayOfYearBorn = (birthDate: Date): DayOfYearInfo => {
  const year = birthDate.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.round((atMidnight(birthDate).getTime() - startOfYear.getTime()) / MS_PER_DAY) + 1;
  const yearLength: 365 | 366 = isLeapYear(year) ? 366 : 365;
  return {
    dayOfYear,
    daysRemainingInBirthYear: yearLength - dayOfYear,
    yearLength,
    weekdayBorn: getWeekdayLabel(birthDate),
    quarter: (Math.floor(birthDate.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
  };
};

// --- FORMATTING ---
export { formatWithCommas, getWeekdayLabel };

// Re-exported as-is, same reasoning as validateBirthdayInput above: whether
// a date is Feb 29 doesn't depend on which calculator is asking, so
// ChronologicalAgeCalculator.tsx's own leap-birthday note ("Born on Feb 29
// — a true leap-year baby...") can be reproduced here from the same
// single source of truth instead of a second, potentially-drifting copy.
export { isFeb29Birthday };

// --- BIRTH DATE PROFILE ---
// A set of well-known, popularly-referenced facts tied to a calendar date
// of birth — distinct from the calendar math above in that each one is a
// lookup against a fixed table (zodiac date ranges, birthstones by month,
// generation year ranges) rather than a derived calculation. Presented
// together as one "Birth Date Profile" section, same as the Age
// Calculator's "Curiosities" section: fun, citable-where-possible, and
// explicitly framed as entertainment/tradition rather than science where
// that's the honest framing (astrology, numerology).

// -- Western (tropical) zodiac --
// Fixed calendar date ranges, the same convention astronomy sources use
// to describe the (non-scientific) 12-sign tropical zodiac — not the
// separately-defined astronomical/IAU constellation boundaries, which use
// different dates entirely and are commonly confused with these. Ranges
// are inclusive of both endpoints and checked as (month, day) pairs so
// leap years don't affect them.
export type WesternZodiacSign =
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo'
  | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export interface WesternZodiacInfo {
  sign: WesternZodiacSign;
  symbol: string;
  dateRange: string;
}

// NOTE: `start` months are 0-indexed (0 = January) and must line up with
// each row's own `dateRange` label — e.g. Aquarius's "Jan 20" is month 0,
// not month 1. An earlier version had every row here shifted one month
// index too high (Aquarius pointed at Feb 20 instead of Jan 20, and so on
// down the table), which silently returned the *previous* sign for nearly
// every birth date. Only the Dec 22–Jan 19 wraparound happened to come out
// right by coincidence. Keep every `start` here in sync with its
// `dateRange` string if either ever changes.
const WESTERN_ZODIAC_TABLE: { sign: WesternZodiacSign; symbol: string; dateRange: string; start: [number, number] }[] = [
  { sign: 'Capricorn', symbol: '♑', dateRange: 'Dec 22 – Jan 19', start: [0, 1] },
  { sign: 'Aquarius', symbol: '♒', dateRange: 'Jan 20 – Feb 18', start: [0, 20] },
  { sign: 'Pisces', symbol: '♓', dateRange: 'Feb 19 – Mar 20', start: [1, 19] },
  { sign: 'Aries', symbol: '♈', dateRange: 'Mar 21 – Apr 19', start: [2, 21] },
  { sign: 'Taurus', symbol: '♉', dateRange: 'Apr 20 – May 20', start: [3, 20] },
  { sign: 'Gemini', symbol: '♊', dateRange: 'May 21 – Jun 20', start: [4, 21] },
  { sign: 'Cancer', symbol: '♋', dateRange: 'Jun 21 – Jul 22', start: [5, 21] },
  { sign: 'Leo', symbol: '♌', dateRange: 'Jul 23 – Aug 22', start: [6, 23] },
  { sign: 'Virgo', symbol: '♍', dateRange: 'Aug 23 – Sep 22', start: [7, 23] },
  { sign: 'Libra', symbol: '♎', dateRange: 'Sep 23 – Oct 22', start: [8, 23] },
  { sign: 'Scorpio', symbol: '♏', dateRange: 'Oct 23 – Nov 21', start: [9, 23] },
  { sign: 'Sagittarius', symbol: '♐', dateRange: 'Nov 22 – Dec 21', start: [10, 22] },
  { sign: 'Capricorn', symbol: '♑', dateRange: 'Dec 22 – Jan 19', start: [11, 22] },
];

export const getWesternZodiac = (birthDate: Date): WesternZodiacInfo => {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  // Walk the table's "start" boundaries in calendar order (Jan onward,
  // wrapping to the Dec 22 entry) and take the last one at or before the
  // birth date — i.e. the sign whose range we're currently inside.
  let match = WESTERN_ZODIAC_TABLE[0];
  for (const entry of WESTERN_ZODIAC_TABLE) {
    const [sMonth, sDay] = entry.start;
    if (month > sMonth || (month === sMonth && day >= sDay)) {
      match = entry;
    }
  }
  const { sign, symbol, dateRange } = match;
  return { sign, symbol, dateRange };
};

// -- Chinese zodiac --
// The 12-animal cycle assigned by lunar year, not the Gregorian calendar
// year — the lunar new year falls on a different Gregorian date each
// year (typically late Jan–mid Feb), so a birth date in that window can
// belong to the *previous* animal year. Pinning down the exact lunar new
// year date for every possible birth year would require a lunar
// calendar table this file doesn't have, so this uses Feb 4 as a fixed
// cutoff approximation (the lunar new year almost always falls within a
// few weeks of it) and says so plainly in BIRTH_PROFILE_SOURCES rather
// than presenting it as exact.
export type ChineseZodiacAnimal =
  | 'Rat' | 'Ox' | 'Tiger' | 'Rabbit' | 'Dragon' | 'Snake'
  | 'Horse' | 'Goat' | 'Monkey' | 'Rooster' | 'Dog' | 'Pig';

const CHINESE_ZODIAC_ANIMALS: ChineseZodiacAnimal[] = [
  'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
  'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig',
];
const CHINESE_ZODIAC_SYMBOLS: Record<ChineseZodiacAnimal, string> = {
  Rat: '🐀', Ox: '🐂', Tiger: '🐅', Rabbit: '🐇', Dragon: '🐉', Snake: '🐍',
  Horse: '🐎', Goat: '🐐', Monkey: '🐒', Rooster: '🐓', Dog: '🐕', Pig: '🐖',
};
// 1900 was a Year of the Rat under this approximation; the cycle repeats
// every 12 years afterward.
const CHINESE_ZODIAC_REFERENCE_YEAR = 1900;

export interface ChineseZodiacInfo {
  animal: ChineseZodiacAnimal;
  symbol: string;
  isApproximate: boolean;
  // The approximate Gregorian window this animal year covers, using the
  // same fixed Feb 4 cutoff as the calculation above (see isApproximate)
  // rather than the true, variable lunar new year date.
  cycleYearRange: string;
}

export const getChineseZodiac = (birthDate: Date): ChineseZodiacInfo => {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  // Before the ~Feb 4 cutoff, treat the birth as still belonging to the
  // previous lunar year's animal.
  const isBeforeCutoff = month === 0 || (month === 1 && day < 4);
  const lunarYear = birthDate.getFullYear() - (isBeforeCutoff ? 1 : 0);
  const offset = ((lunarYear - CHINESE_ZODIAC_REFERENCE_YEAR) % 12 + 12) % 12;
  const animal = CHINESE_ZODIAC_ANIMALS[offset];
  // Flag as approximate for any birth date close enough to the real
  // (variable) lunar new year window that the fixed Feb 4 cutoff could
  // disagree with the true lunar calendar.
  const isApproximate = (month === 0 && day >= 15) || (month === 1 && day <= 25);
  const cycleYearRange = `Feb 4, ${lunarYear} \u2013 Feb 3, ${lunarYear + 1}`;
  return { animal, symbol: CHINESE_ZODIAC_SYMBOLS[animal], isApproximate, cycleYearRange };
};

// -- Birthstone & birth flower --
// Traditional US (Jewelers of America modern list) birthstone-by-month
// assignments and commonly-cited birth flowers. Some months have more
// than one widely-used stone; both are shown rather than picking one.
export interface BirthMonthLoreInfo {
  month: number; // 0-11
  monthName: string;
  birthstones: string[];
  birthFlower: string;
}

const BIRTH_MONTH_LORE: { birthstones: string[]; birthFlower: string }[] = [
  { birthstones: ['Garnet'], birthFlower: 'Carnation' },
  { birthstones: ['Amethyst'], birthFlower: 'Violet' },
  { birthstones: ['Aquamarine', 'Bloodstone'], birthFlower: 'Daffodil' },
  { birthstones: ['Diamond'], birthFlower: 'Daisy' },
  { birthstones: ['Emerald'], birthFlower: 'Lily of the Valley' },
  { birthstones: ['Pearl', 'Alexandrite'], birthFlower: 'Rose' },
  { birthstones: ['Ruby'], birthFlower: 'Larkspur' },
  { birthstones: ['Peridot', 'Spinel'], birthFlower: 'Gladiolus' },
  { birthstones: ['Sapphire'], birthFlower: 'Aster' },
  { birthstones: ['Opal', 'Tourmaline'], birthFlower: 'Marigold' },
  { birthstones: ['Topaz', 'Citrine'], birthFlower: 'Chrysanthemum' },
  { birthstones: ['Turquoise', 'Zircon', 'Tanzanite'], birthFlower: 'Narcissus (Paperwhite)' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const getBirthMonthLore = (birthDate: Date): BirthMonthLoreInfo => {
  const month = birthDate.getMonth();
  const lore = BIRTH_MONTH_LORE[month];
  return { month, monthName: MONTH_NAMES[month], ...lore };
};

// -- Generation label --
// Named generation cohorts by birth-year range. Silent Generation through
// Generation Z follow the cutoffs commonly cited by Pew Research Center.
// Generation Alpha and Generation Beta follow demographer Mark McCrindle,
// who coined both names; Pew itself has said it won't name new generations
// past Gen Z. Only the LAST entry in this table is open-ended (no fixed
// upper bound) — that's always whichever cohort is currently the newest
// and youngest, so as new cohorts get named, close off the previous
// "current" entry with a real endYear and append the new one after it,
// rather than leaving more than one entry open-ended at a time.
export interface GenerationInfo {
  label: string;
  yearRange: string;
}

const GENERATION_TABLE: { label: string; startYear: number; endYear: number | null }[] = [
  { label: 'The Greatest Generation', startYear: -Infinity as unknown as number, endYear: 1927 },
  { label: 'The Silent Generation', startYear: 1928, endYear: 1945 },
  { label: 'Baby Boomers', startYear: 1946, endYear: 1964 },
  { label: 'Generation X', startYear: 1965, endYear: 1980 },
  { label: 'Millennials', startYear: 1981, endYear: 1996 },
  { label: 'Generation Z', startYear: 1997, endYear: 2012 },
  { label: 'Generation Alpha', startYear: 2013, endYear: 2024 },
  { label: 'Generation Beta', startYear: 2025, endYear: null },
];

export const getGeneration = (birthYear: number): GenerationInfo => {
  const entry = GENERATION_TABLE.find(
    (g) => birthYear >= g.startYear && (g.endYear === null || birthYear <= g.endYear)
  ) ?? GENERATION_TABLE[GENERATION_TABLE.length - 1];
  const yearRange = entry.endYear === null
    ? `${entry.startYear}–present`
    : entry.startYear === (-Infinity as unknown as number)
      ? `Before ${entry.endYear + 1}`
      : `${entry.startYear}–${entry.endYear}`;
  return { label: entry.label, yearRange };
};

// -- Life Path Number --
// Classic numerology digit-reduction: sum every digit of the full birth
// date, then repeatedly reduce the sum to a single digit — except when
// the sum lands on 11, 22 or 33 ("master numbers"), which are
// conventionally left unreduced. Presented purely as popular numerology,
// not a factual or scientific claim.
export interface LifePathNumberInfo {
  number: number;
  isMasterNumber: boolean;
}

const reduceToLifePathDigit = (n: number): number => {
  let value = n;
  while (value > 9 && value !== 11 && value !== 22 && value !== 33) {
    value = String(value)
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return value;
};

export const getLifePathNumber = (birthDate: Date): LifePathNumberInfo => {
  const digits = `${birthDate.getFullYear()}${birthDate.getMonth() + 1}${birthDate.getDate()}`;
  const rawSum = digits.split('').reduce((sum, digit) => sum + Number(digit), 0);
  const number = reduceToLifePathDigit(rawSum);
  return { number, isMasterNumber: number === 11 || number === 22 || number === 33 };
};

// --- SOURCES & REFERENCES ---
// The golden birthday is an informal tradition with no single citable
// defining authority (see comment above), so it's documented here in the
// calculator's own words rather than linked to a source, in keeping with
// the "no copyrighted content" requirement — the entries below cover only
// the calendar rules the calculations actually rely on.

export const BIRTHDAY_SOURCES: SourceEntry[] = [
  {
    metric: 'Calendar Arithmetic (Gregorian Leap-Year Rule)',
    citation: 'Dates follow the Gregorian calendar: a year is a leap year if it is divisible by 4, except century years not divisible by 400. This determines year length for the day-of-year calculation and which years a Feb 29 birthday is observed on directly.',
    url: 'https://aa.usno.navy.mil/faq/leap_years',
    linkLabel: 'U.S. Naval Observatory \u2014 Leap Years',
  },
  {
    metric: 'Feb 29 (Leap-Day) Birthdays',
    citation: 'There is no single universal rule for when a Feb 29 birthday is observed in a non-leap year. This calculator uses Feb 28, the same convention used by the Chronological Age Calculator, so a leap-day birthday lines up consistently across every date-based tool on this site.',
    url: 'https://en.wikipedia.org/wiki/Legal_age',
    linkLabel: 'Wikipedia \u2014 Legal age (leap-day birthdays)',
  },
  {
    metric: 'Golden Birthday',
    citation: 'A "golden birthday" (also called a champagne or lucky birthday) is the birthday on which a person\u2019s new age equals the calendar day of the month they were born \u2014 for example, turning 17 on the 17th. It is a popular tradition rather than an official or legally defined term, and different sources describe its origin differently, so no single source is cited here; the calculation itself (age = day of birth) is unambiguous.',
  },
  {
    metric: 'Double Golden & Platinum Birthday',
    citation: 'These are informal "missed your golden birthday" variants with no governing definition, and different sites describe them differently \u2014 including some overlap, where one site\u2019s "double golden" is another\u2019s "platinum." This calculator uses the two versions that appear consistently across independent, unrelated sources: Double Golden Birthday is age = birth day-of-month \u00d7 2 (born on the 15th, turning 30); Platinum Birthday is age = the birth day-of-month with its digits reversed (born on the 3rd, turning 30; born on the 14th, turning 41).',
  },
  {
    metric: 'Western (Tropical) Zodiac Sign',
    citation: 'Sign date ranges follow the standard 12-sign tropical zodiac used in Western astrology and almanacs \u2014 a cultural and astrological tradition, not an astronomical classification. It is shown for entertainment purposes only.',
    url: 'https://en.wikipedia.org/wiki/Astrological_sign',
    linkLabel: 'Wikipedia \u2014 Astrological sign',
  },
  {
    metric: 'Chinese Zodiac Animal',
    citation: 'The 12-animal cycle is assigned by lunar year, and the lunar new year falls on a different Gregorian date each year (typically late January to mid-February). This calculator approximates the cutoff as February 4th; a birth date close to the real lunar new year may belong to a different animal year than shown here.',
    url: 'https://en.wikipedia.org/wiki/Chinese_zodiac',
    linkLabel: 'Wikipedia \u2014 Chinese zodiac',
  },
  {
    metric: 'Birthstone & Birth Flower',
    citation: 'Birthstones follow the modern list commonly published by US jewelry trade associations; several months have more than one traditionally-associated stone. Birth flowers follow commonly-cited English-language floriography lists. Both vary somewhat by country and by source.',
    url: 'https://en.wikipedia.org/wiki/Birthstone',
    linkLabel: 'Wikipedia \u2014 Birthstone',
  },
  {
    metric: 'Generation Label',
    citation: 'Generation year ranges from the Silent Generation through Generation Z follow the cutoffs commonly used by Pew Research Center, which has said it will not name any further generations past Gen Z. Generation Alpha (2013\u20132024) and Generation Beta (2025 onward) follow the year ranges from demographer Mark McCrindle, who coined both names. These are all analytical conventions, not hard scientific lines, and other organizations sometimes use slightly different year ranges \u2014 for example, some place Generation Alpha\'s start at 2010 rather than 2013.',
    url: 'https://en.wikipedia.org/wiki/Generation_Beta',
    linkLabel: 'Wikipedia \u2014 Generation Beta',
  },
  {
    metric: 'Life Path Number',
    citation: 'The Life Path Number is calculated by summing all digits of the birth date and reducing the total to a single digit, except for the "master numbers" 11, 22 and 33, which are conventionally left unreduced. This is a popular numerology practice presented for entertainment purposes only, not a scientific or factual claim.',
  },
];
