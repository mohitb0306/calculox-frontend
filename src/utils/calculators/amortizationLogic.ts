
/**
 * amortizationLogic.ts
 * Calculox Amortization Calculator: pure calculation engine (no React, no I/O).
 *
 * PROVENANCE: every formula here is standard loan mathematics (formulas are not
 * subject to copyright). No third-party text, layout or code is reused. The
 * conventions we chose ourselves (rounding, extra-payment timing, date rules)
 * are written out below and are listed in AMORTIZATION_SOURCES.
 *
 * This is a UNIVERSAL calculator: no regions, no country rules, one standard
 * periodic-compounding model (rate per period = annual rate / payments per
 * year). The currency symbol is display-only and never changes the maths.
 *
 * Shared helpers are reused from mortgageLogic.ts so there is one tested
 * payment formula across the site. The Mortgage REGION_PROFILES and the
 * mortgage-only payment modes are NOT used.
 *
 * CONVENTIONS (summarised for visitors in the Sources panel on the page)
 *  1. Money is rounded to cents every row. The regular payment is rounded to
 *     cents; the LAST row clears whatever balance is left, so the final payment
 *     usually differs from the regular payment by a small amount (cents on
 *     typical loans; larger on very big loans, where cent-rounding accumulates).
 *  2. Interest for a row = opening balance x rate per period (rounded).
 *  3. An extra payment is applied on a payment date, after that row's regular
 *     payment. Extras are capped at the balance still owed.
 *  4. A recurring extra falls on its own calendar rhythm (weekly, monthly,
 *     quarterly, half-yearly, yearly) starting at its start payment. If it
 *     falls between two payment dates, it is applied on the NEXT payment date.
 *  5. Dates move by calendar month and are clamped to the last day of short
 *     months (31 Jan -> 28/29 Feb). All date maths is done in UTC on
 *     "YYYY-MM-DD" strings, so time zones and daylight-saving never shift a
 *     date.
 *  6. With no first-payment date the schedule is shown by payment number only
 *     (row.date is null). Extras then must be placed by payment number. Date
 *     maths still runs internally on a hidden anchor calendar (NO_DATE_ANCHOR),
 *     which only affects how weekly extras map onto payment numbers.
 *  7. Weekly and bi-weekly loans use 52 and 26 payments per year (not 52.18).
 *     Rate per period = annual rate / payments per year.
 *
 * Phase 1 scope: validation, calculateAmortization (schedule, extras, savings,
 * yearly summary), balance lookups, currency formatting, sources.
 * Later phases (not here): shorten-vs-lower-payment comparison, interest
 * between two dates, work-backwards solvers, interest-only, balloon,
 * rate change, skipped payments.
 */

import {
  annuityPayment,
  periodicRate,
  roundCents,
  MAX_SCHEDULE_ROWS,
  MAX_RATE_PCT,
} from "./mortgageLogic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How often the regular payment is made. */
export type AmortFrequency = "monthly" | "semi-monthly" | "biweekly" | "weekly";

/** How often a recurring extra payment is made (independent of the loan's own frequency). */
export type ExtraFrequency = "weekly" | "monthly" | "quarterly" | "half-yearly" | "yearly";

export interface RecurringExtra {
  /** Amount added each time the extra falls due. 0 is ignored. */
  amount: number;
  frequency: ExtraFrequency;
  /** Payment number (1-based) of the first extra. Default 1. */
  startPayment?: number;
  /** Last payment number (inclusive) an extra may fall in. Default: until the loan ends. */
  endPayment?: number | null;
}

export interface OneTimeExtra {
  /** Extra amount. 0 is ignored. */
  amount: number;
  /** Apply at this payment number (1-based). Give this OR `date`, not both. */
  payment?: number;
  /** Apply at the first payment on/after this ISO date ("YYYY-MM-DD"). Needs a first-payment date. */
  date?: string;
}

export interface AmortizationInputs {
  loanAmount: number;
  /** Nominal yearly rate in percent, e.g. 6 for 6%. */
  annualRatePct: number;
  termYears: number;
  termMonths: number;
  frequency: AmortFrequency;
  /** ISO date ("YYYY-MM-DD") of payment number 1, or null for a schedule without dates. */
  firstPaymentDate: string | null;
  recurringExtras?: RecurringExtra[];
  oneTimeExtras?: OneTimeExtra[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ScheduleRow {
  /** Payment number, starting at 1. */
  n: number;
  /** ISO date, or null when no first-payment date was given. */
  date: string | null;
  opening: number;
  /** The regular payment made in this row (interest + principal). */
  payment: number;
  interest: number;
  /** Principal repaid by the regular payment (payment - interest). */
  principal: number;
  /** Extra payment actually applied in this row (after capping). */
  extra: number;
  closing: number;
}

export interface YearRow {
  /** Calendar year when dates exist, otherwise loan year (1, 2, 3 ...). */
  label: number;
  kind: "calendar" | "loan";
  firstPayment: number;
  lastPayment: number;
  payments: number;
  interest: number;
  principal: number;
  extra: number;
  totalPaid: number;
  endBalance: number;
}

export interface BaselineSummary {
  totalInterest: number;
  totalPaid: number;
  paymentsMade: number;
  payoffDate: string | null;
}

export interface Savings {
  interestSaved: number;
  paymentsSaved: number;
  /** Approximate time saved in whole months (paymentsSaved x 12 / payments per year). */
  timeSavedMonths: number;
}

export interface AmortizationResult {
  /** The regular payment, rounded to cents. */
  regularPayment: number;
  /** Payments the loan would take with no extras. */
  scheduledPayments: number;
  paymentsPerYear: number;
  /** Payments actually made (fewer than scheduled when extras shorten the loan). */
  paymentsMade: number;
  totalInterest: number;
  totalExtra: number;
  /** Everything paid: regular payments plus extras. */
  totalPaid: number;
  /** Date of the last payment, or null when no first-payment date was given. */
  payoffDate: string | null;
  /** Last row's regular payment (usually differs slightly from regularPayment). */
  finalPayment: number;
  rows: ScheduleRow[];
  yearly: YearRow[];
  /** The same loan with NO extras; null when no extras were entered. */
  baseline: BaselineSummary | null;
  /** Null when no extras were entered. */
  savings: Savings | null;
}

export class AmortizationInputError extends Error {
  errors: Record<string, string>;
  constructor(errors: Record<string, string>) {
    super("Invalid amortization inputs");
    this.name = "AmortizationInputError";
    this.errors = errors;
  }
}

// ---------------------------------------------------------------------------
// Limits (our choices, not legal limits; owner can change them)
// ---------------------------------------------------------------------------

export const MIN_LOAN_AMOUNT = 1;
export const MAX_LOAN_AMOUNT = 1e12;
export const MAX_TERM_YEARS = 100;
export const MAX_TERM_MONTHS_FIELD = 1200;
export { MAX_SCHEDULE_ROWS, MAX_RATE_PCT };

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;
/** Anchor used for date maths when the visitor gave no date. Never shown. */
const NO_DATE_ANCHOR = "2001-01-01";

// ---------------------------------------------------------------------------
// Date helpers (UTC, ISO "YYYY-MM-DD" strings)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Strict ISO date -> UTC ms, or null if malformed / not a real calendar day / out of range. */
export function parseIsoDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const t = Date.UTC(y, mo, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return t;
}

export function toIsoDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Adds calendar months, clamping the day to the last day of a shorter month. */
function addMonthsUtc(t: number, months: number): number {
  const d = new Date(t);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay));
}

/** Same month as `t`, but on `day` (clamped to the last day of that month). */
function withDayUtc(t: number, day: number): number {
  const d = new Date(t);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(day, lastDay));
}

export function periodsPerYearFor(freq: AmortFrequency): number {
  switch (freq) {
    case "monthly":
      return 12;
    case "semi-monthly":
      return 24;
    case "biweekly":
      return 26;
    case "weekly":
      return 52;
  }
}

/**
 * Payment dates (UTC ms) for payments 1..count.
 *  monthly      : same day each month (clamped).
 *  weekly       : every 7 days.   biweekly: every 14 days.
 *  semi-monthly : two per month. First date's day D and a second day 15 days
 *                 apart: D<=15 -> D and D+15 in the same month; D>15 -> D and
 *                 D-15 in the NEXT month (e.g. 20th and 5th). Clamped for short months.
 */
function paymentTimes(firstT: number, freq: AmortFrequency, count: number): number[] {
  const out: number[] = [];
  const day = new Date(firstT).getUTCDate();
  for (let k = 0; k < count; k++) {
    switch (freq) {
      case "monthly":
        out.push(addMonthsUtc(firstT, k));
        break;
      case "weekly":
        out.push(firstT + k * 7 * DAY_MS);
        break;
      case "biweekly":
        out.push(firstT + k * 14 * DAY_MS);
        break;
      case "semi-monthly": {
        const m = Math.floor(k / 2);
        if (k % 2 === 0) out.push(addMonthsUtc(firstT, m));
        else if (day <= 15) out.push(withDayUtc(addMonthsUtc(firstT, m), day + 15));
        else out.push(withDayUtc(addMonthsUtc(firstT, m + 1), day - 15));
        break;
      }
    }
  }
  return out;
}

/** Public: ISO dates for payments 1..count (for the UI and tests). */
export function getPaymentDates(firstPaymentDate: string, freq: AmortFrequency, count: number): string[] {
  const t = parseIsoDate(firstPaymentDate);
  if (t === null || !(count > 0)) return [];
  return paymentTimes(t, freq, Math.floor(count)).map(toIsoDate);
}

/** Convenience: the date of payment 1 if the loan starts on `loanStartDate` (one period later). */
export function firstPaymentFromLoanStart(loanStartDate: string, freq: AmortFrequency): string | null {
  const t = parseIsoDate(loanStartDate);
  if (t === null) return null;
  switch (freq) {
    case "monthly":
      return toIsoDate(addMonthsUtc(t, 1));
    case "weekly":
      return toIsoDate(t + 7 * DAY_MS);
    case "biweekly":
      return toIsoDate(t + 14 * DAY_MS);
    case "semi-monthly":
      return toIsoDate(t + 15 * DAY_MS);
  }
}

const EXTRA_MONTH_STEP: Record<Exclude<ExtraFrequency, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  "half-yearly": 6,
  yearly: 12,
};

function extraOccurrenceTime(base: number, freq: ExtraFrequency, i: number): number {
  if (freq === "weekly") return base + i * 7 * DAY_MS;
  return addMonthsUtc(base, i * EXTRA_MONTH_STEP[freq]);
}

// ---------------------------------------------------------------------------
// Small maths helpers (exported so tests and the UI can reuse them)
// ---------------------------------------------------------------------------

/** Number of regular payments for a term: total months x payments per year / 12, rounded. */
export function scheduledPaymentCount(termYears: number, termMonths: number, freq: AmortFrequency): number {
  const totalMonths = termYears * 12 + termMonths;
  return Math.round((totalMonths * periodsPerYearFor(freq)) / 12);
}

/**
 * Balance after k payments with NO extras (closed form):
 *   B(k) = P(1+r)^k - M((1+r)^k - 1)/r;  r = 0 -> P - M*k
 * Used to cross-check the row-by-row schedule.
 */
export function closedFormBalance(principal: number, r: number, payment: number, k: number): number {
  if (r === 0) return principal - payment * k;
  const f = Math.pow(1 + r, k);
  return principal * f - (payment * (f - 1)) / r;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateAmortizationInputs(input: AmortizationInputs): ValidationResult {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(input.loanAmount) || input.loanAmount < MIN_LOAN_AMOUNT || input.loanAmount > MAX_LOAN_AMOUNT) {
    errors.loanAmount = `Enter a loan amount between ${MIN_LOAN_AMOUNT} and ${MAX_LOAN_AMOUNT.toLocaleString("en-US")}.`;
  }

  if (!Number.isFinite(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > MAX_RATE_PCT) {
    errors.annualRatePct = `Enter an interest rate between 0% and ${MAX_RATE_PCT}%.`;
  }

  const yearsOk = Number.isInteger(input.termYears) && input.termYears >= 0 && input.termYears <= MAX_TERM_YEARS;
  const monthsOk =
    Number.isInteger(input.termMonths) && input.termMonths >= 0 && input.termMonths <= MAX_TERM_MONTHS_FIELD;
  let n = 0;
  if (!yearsOk || !monthsOk) {
    errors.term = `Enter whole numbers for the term (years 0 to ${MAX_TERM_YEARS}, months 0 to ${MAX_TERM_MONTHS_FIELD}).`;
  } else {
    n = scheduledPaymentCount(input.termYears, input.termMonths, input.frequency);
    if (n < 1) {
      errors.term = "The loan term must be at least one payment long.";
    } else if (n > MAX_SCHEDULE_ROWS) {
      errors.term = `This term and payment frequency would need ${n.toLocaleString("en-US")} payments. The limit is ${MAX_SCHEDULE_ROWS.toLocaleString("en-US")}. Try a shorter term or less frequent payments.`;
    }
  }

  let firstT: number | null = null;
  if (input.firstPaymentDate !== null) {
    firstT = parseIsoDate(input.firstPaymentDate);
    if (firstT === null) {
      errors.firstPaymentDate = `Enter a valid date between ${MIN_YEAR} and ${MAX_YEAR}.`;
    }
  }

  const termIsUsable = !errors.term && n >= 1;
  const times = termIsUsable ? paymentTimes(firstT ?? (parseIsoDate(NO_DATE_ANCHOR) as number), input.frequency, n) : [];

  (input.recurringExtras ?? []).forEach((e, i) => {
    const key = `recurringExtra${i}`;
    if (!Number.isFinite(e.amount) || e.amount < 0 || e.amount > MAX_LOAN_AMOUNT) {
      errors[key] = "Enter a valid extra payment amount (0 or more).";
      return;
    }
    if (!(e.amount > 0)) return; // zero is ignored
    const start = e.startPayment ?? 1;
    if (!Number.isInteger(start) || start < 1 || (termIsUsable && start > n)) {
      errors[key] = termIsUsable
        ? `The extra payment start must be a payment number from 1 to ${n}.`
        : "The extra payment start must be a whole payment number of 1 or more.";
      return;
    }
    if (e.endPayment != null && (!Number.isInteger(e.endPayment) || e.endPayment < start)) {
      errors[key] = "The extra payment end must be a whole payment number that is not before the start.";
    }
  });

  (input.oneTimeExtras ?? []).forEach((e, i) => {
    const key = `oneTimeExtra${i}`;
    if (!Number.isFinite(e.amount) || e.amount < 0 || e.amount > MAX_LOAN_AMOUNT) {
      errors[key] = "Enter a valid one-time payment amount (0 or more).";
      return;
    }
    if (!(e.amount > 0)) return;
    const hasPayment = e.payment !== undefined && e.payment !== null;
    const hasDate = e.date !== undefined && e.date !== null && e.date !== "";
    if (hasPayment === hasDate) {
      errors[key] = "Place a one-time payment with either a payment number or a date.";
      return;
    }
    if (hasPayment) {
      const p = e.payment as number;
      if (!Number.isInteger(p) || p < 1 || (termIsUsable && p > n)) {
        errors[key] = termIsUsable
          ? `The payment number must be from 1 to ${n}.`
          : "The payment number must be a whole number of 1 or more.";
      }
      return;
    }
    // date placement
    if (input.firstPaymentDate === null || firstT === null) {
      errors[key] = "Placing a payment by date needs a first payment date.";
      return;
    }
    const t = parseIsoDate(e.date as string);
    if (t === null) {
      errors[key] = "Enter a valid date for the one-time payment.";
      return;
    }
    if (termIsUsable && t > times[times.length - 1]) {
      errors[key] = "That date is after the final scheduled payment.";
    }
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Extra-payment schedule: how much extra falls due at each payment number
// ---------------------------------------------------------------------------

/** Smallest 1-based payment number whose date is on/after t, or n+1 if none. */
function windowIndex(times: number[], t: number, from: number): number {
  let k = Math.max(1, from);
  while (k <= times.length && times[k - 1] < t) k++;
  return k;
}

function buildExtrasDue(input: AmortizationInputs, times: number[], n: number): number[] {
  const due = new Array<number>(n + 2).fill(0); // index 1..n used

  for (const rec of input.recurringExtras ?? []) {
    if (!(rec.amount > 0)) continue;
    const start = rec.startPayment ?? 1;
    const end = rec.endPayment == null ? n : Math.min(rec.endPayment, n);
    const base = times[start - 1];
    const last = times[n - 1];
    let k = start;
    for (let i = 0; ; i++) {
      const t = extraOccurrenceTime(base, rec.frequency, i);
      if (t > last) break;
      k = windowIndex(times, t, k);
      if (k > end || k > n) break;
      due[k] += rec.amount;
    }
  }

  for (const one of input.oneTimeExtras ?? []) {
    if (!(one.amount > 0)) continue;
    let k: number;
    if (one.payment !== undefined && one.payment !== null) {
      k = one.payment;
    } else {
      const t = parseIsoDate(one.date as string) as number;
      k = windowIndex(times, t, 1);
    }
    if (k >= 1 && k <= n) due[k] += one.amount;
  }

  return due;
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

interface SimOutput {
  rows: ScheduleRow[];
  regularPayment: number;
}

function simulate(input: AmortizationInputs, n: number, times: number[], due: number[] | null, hasDates: boolean): SimOutput {
  const k = periodsPerYearFor(input.frequency);
  const r = periodicRate(input.annualRatePct, k, "periodic");
  const regularPayment = roundCents(annuityPayment(input.loanAmount, r, n));

  const rows: ScheduleRow[] = [];
  let balance = roundCents(input.loanAmount);

  for (let i = 1; i <= n; i++) {
    const opening = balance;
    const interest = roundCents(opening * r);
    // The last scheduled row clears whatever is left; earlier rows never pay more than is owed.
    const owed = roundCents(opening + interest);
    const pay = i === n ? owed : Math.min(regularPayment, owed);
    const principal = roundCents(pay - interest);
    balance = roundCents(opening - principal);

    let extra = 0;
    if (due && due[i] > 0 && balance > 0) {
      extra = Math.min(roundCents(due[i]), balance);
      balance = roundCents(balance - extra);
    }

    rows.push({
      n: i,
      date: hasDates ? toIsoDate(times[i - 1]) : null,
      opening,
      payment: pay,
      interest,
      principal,
      extra,
      closing: balance,
    });

    if (balance <= 0) break;
  }

  return { rows, regularPayment };
}

function summarise(rows: ScheduleRow[]) {
  let interest = 0;
  let paid = 0;
  let extra = 0;
  for (const row of rows) {
    interest += row.interest;
    paid += row.payment + row.extra;
    extra += row.extra;
  }
  return { interest: roundCents(interest), paid: roundCents(paid), extra: roundCents(extra) };
}

function buildYearly(rows: ScheduleRow[], k: number, hasDates: boolean): YearRow[] {
  const map = new Map<number, YearRow>();
  for (const row of rows) {
    const label = hasDates ? Number((row.date as string).slice(0, 4)) : Math.ceil(row.n / k);
    let y = map.get(label);
    if (!y) {
      y = {
        label,
        kind: hasDates ? "calendar" : "loan",
        firstPayment: row.n,
        lastPayment: row.n,
        payments: 0,
        interest: 0,
        principal: 0,
        extra: 0,
        totalPaid: 0,
        endBalance: row.closing,
      };
      map.set(label, y);
    }
    y.lastPayment = row.n;
    y.payments += 1;
    y.interest = roundCents(y.interest + row.interest);
    y.principal = roundCents(y.principal + row.principal);
    y.extra = roundCents(y.extra + row.extra);
    y.totalPaid = roundCents(y.totalPaid + row.payment + row.extra);
    y.endBalance = row.closing;
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/** Throws AmortizationInputError if the inputs are invalid; call validateAmortizationInputs first to show messages. */
export function calculateAmortization(input: AmortizationInputs): AmortizationResult {
  const v = validateAmortizationInputs(input);
  if (!v.valid) throw new AmortizationInputError(v.errors);

  const k = periodsPerYearFor(input.frequency);
  const n = scheduledPaymentCount(input.termYears, input.termMonths, input.frequency);
  const hasDates = input.firstPaymentDate !== null;
  const firstT = parseIsoDate(hasDates ? (input.firstPaymentDate as string) : NO_DATE_ANCHOR) as number;
  const times = paymentTimes(firstT, input.frequency, n);

  const hasExtras =
    (input.recurringExtras ?? []).some((e) => e.amount > 0) || (input.oneTimeExtras ?? []).some((e) => e.amount > 0);

  const due = hasExtras ? buildExtrasDue(input, times, n) : null;
  const main = simulate(input, n, times, due, hasDates);
  const mainTotals = summarise(main.rows);
  const last = main.rows[main.rows.length - 1];

  let baseline: BaselineSummary | null = null;
  let savings: Savings | null = null;
  if (hasExtras) {
    const base = simulate(input, n, times, null, hasDates);
    const baseTotals = summarise(base.rows);
    const baseLast = base.rows[base.rows.length - 1];
    baseline = {
      totalInterest: baseTotals.interest,
      totalPaid: baseTotals.paid,
      paymentsMade: base.rows.length,
      payoffDate: baseLast.date,
    };
    const paymentsSaved = base.rows.length - main.rows.length;
    savings = {
      interestSaved: roundCents(baseTotals.interest - mainTotals.interest),
      paymentsSaved,
      timeSavedMonths: Math.round((paymentsSaved * 12) / k),
    };
  }

  return {
    regularPayment: main.regularPayment,
    scheduledPayments: n,
    paymentsPerYear: k,
    paymentsMade: main.rows.length,
    totalInterest: mainTotals.interest,
    totalExtra: mainTotals.extra,
    totalPaid: mainTotals.paid,
    payoffDate: last.date,
    finalPayment: last.payment,
    rows: main.rows,
    yearly: buildYearly(main.rows, k, hasDates),
    baseline,
    savings,
  };
}

// ---------------------------------------------------------------------------
// Balance lookups
// ---------------------------------------------------------------------------

/** Balance owed right after payment number `k` (k = 0 -> the original loan; past the last payment -> 0). */
export function getBalanceAfterPayment(result: AmortizationResult, loanAmount: number, k: number): number {
  if (!(k >= 1)) return roundCents(loanAmount);
  if (k >= result.rows.length) return result.rows[result.rows.length - 1].closing;
  return result.rows[Math.floor(k) - 1].closing;
}

export interface BalanceOnDate {
  balance: number;
  /** How many payments had been made by that date. */
  paymentsMade: number;
  /** Date of the most recent payment on/before that date, or null if none yet. */
  lastPaymentDate: string | null;
  /** True once the final payment has been made. */
  paidOff: boolean;
}

/**
 * Balance owed on a calendar date. Interest in this model accrues one payment
 * period at a time, so between two payment dates the balance is the balance
 * after the most recent payment. Returns null when the schedule has no dates
 * or the date is invalid.
 */
export function getBalanceOnDate(result: AmortizationResult, loanAmount: number, isoDate: string): BalanceOnDate | null {
  const t = parseIsoDate(isoDate);
  if (t === null || result.rows.length === 0 || result.rows[0].date === null) return null;

  let made = 0;
  for (const row of result.rows) {
    if ((parseIsoDate(row.date as string) as number) <= t) made = row.n;
    else break;
  }
  if (made === 0) {
    return { balance: roundCents(loanAmount), paymentsMade: 0, lastPaymentDate: null, paidOff: false };
  }
  const row = result.rows[made - 1];
  return {
    balance: row.closing,
    paymentsMade: made,
    lastPaymentDate: row.date,
    paidOff: made === result.rows.length && row.closing === 0,
  };
}

// ---------------------------------------------------------------------------
// Display helpers (display only; never used in the maths)
// ---------------------------------------------------------------------------

export interface CurrencyOption {
  symbol: string;
  label: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { symbol: "$", label: "Dollar ($)" },
  { symbol: "€", label: "Euro (€)" },
  { symbol: "£", label: "Pound (£)" },
  { symbol: "₹", label: "Rupee (₹)" },
  { symbol: "¥", label: "Yen / Yuan (¥)" },
];

export const DEFAULT_CURRENCY_SYMBOL = "$";

/** "1,234.50" with the symbol in front; negatives read "-$1,234.50". Fixed en-US grouping so server and browser agree. */
export function formatMoney(amount: number, symbol: string = DEFAULT_CURRENCY_SYMBOL): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const text = Math.abs(safe).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${safe < 0 ? "-" : ""}${symbol}${text}`;
}

/** "3 years, 2 months" / "5 months" / "0 months". */
export function formatMonthsAsYearsMonths(totalMonths: number): string {
  const m = Math.max(0, Math.round(totalMonths));
  const y = Math.floor(m / 12);
  const rest = m % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "year" : "years"}`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Sources (shown in the UI "Sources" accordion)
// status "verified"   : the URL and claim were checked on the review date.
// status "to-verify"  : confirm the link/wording before publishing.
// ---------------------------------------------------------------------------

export interface AmortizationSource {
  id: string;
  title: string;
  url?: string;
  note: string;
  status: "verified" | "to-verify";
}

export const AMORTIZATION_LAST_REVIEWED = "2026-10-23";

export const AMORTIZATION_SOURCES: AmortizationSource[] = [
  {
    id: "level-payment-formula",
    title: "The level-payment (annuity) formula",
    note: "Standard textbook loan mathematics: payment = P x r / (1 - (1+r)^-n), which is the same as P x r x (1+r)^n / ((1+r)^n - 1), where P is the loan amount, r the rate per payment period and n the number of payments. A mathematical fact, free for anyone to use. With a rate of exactly zero the payment is simply the loan divided by the number of payments.",
    status: "verified",
  },
  {
    id: "cfpb-actuarial-method",
    title: "CFPB, Regulation Z Appendix J: annual percentage rate computations",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/J/",
    note: "US federal regulation (12 CFR Part 1026, Appendix J). It defines the nominal annual rate as the rate per payment period multiplied by the number of periods in a year, which is the convention used here (rate per period = annual rate / payments per year). It concerns APR calculation; this calculator does not include fees and does not compute a regulated APR.",
    status: "verified",
  },
  {
    id: "effective-annual-rate",
    title: "Effective annual rate",
    note: "Standard compound-interest formula: effective annual rate = (1 + i/k)^k - 1, where i is the nominal annual rate and k the payments per year. Shown for information only; it is not an APR.",
    status: "verified",
  },
  {
    id: "our-conventions",
    title: "Our rounding, timing and date rules",
    note: "Money is rounded to cents on every row and the last row clears the remaining balance, so the final payment usually differs slightly from the regular payment. Extra payments are applied on a payment date after that row's regular payment and are capped at the balance owed. Dates move by calendar month and short months use their last day. Weekly and bi-weekly loans use 52 and 26 payments per year. Your lender may round or time things differently, so their statement is the one that counts.",
    status: "verified",
  },
];
