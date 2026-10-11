/**
 * mortgageLogic.ts
 * Calculox Mortgage Calculator: pure calculation engine (no React, no I/O).
 *
 * PROVENANCE: every formula here is standard public-domain loan maths.
 * No competitor text, layout or code is reused. Every rule that depends on a
 * law or convention carries a source comment and an entry in MORTGAGE_SOURCES.
 *
 * Money is rounded to cents each period (payment, interest, costs).
 * The final payment clears the remaining balance.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegionCode = "US" | "IN" | "CA";
export type Compounding = "periodic" | "semi-annual";

/**
 * monthly               : 12 payments a year.
 * biweekly              : TRUE biweekly. Same term, 26 smaller payments a year.
 * accelerated-biweekly  : Half of the monthly payment every 2 weeks (26/yr).
 *                         Equals 13 monthly payments a year, so it pays off sooner.
 */
export type PaymentMode = "monthly" | "biweekly" | "accelerated-biweekly";

export type AmountMode = "percent" | "amount";

export interface AmountInput {
  mode: AmountMode;
  value: number;
}

export interface RegionProfile {
  code: RegionCode;
  label: string;
  currency: "USD" | "INR" | "CAD";
  locale: "en-US" | "en-IN" | "en-CA";
  compounding: Compounding;
  maxTermYears: number;
  defaultTermYears: number;
  supportsPmi: boolean;
}

export interface RecurringCosts {
  /** percent = % of home price per year; amount = currency per year */
  propertyTax?: AmountInput;
  insurance?: AmountInput;
  hoa?: AmountInput;
  other?: AmountInput;
  /** Yearly increase in %, applied at the start of each loan year after year 1 */
  annualIncreasePct?: {
    propertyTax?: number;
    insurance?: number;
    hoa?: number;
    other?: number;
  };
}

export interface PmiInput {
  /** percent = % of the ORIGINAL loan per year; amount = currency per year */
  annualCost: AmountInput;
  /**
   * request80 : PMI stops when the real balance reaches 80% of original value
   *             (borrower asks for cancellation; allowed earlier with extra payments).
   * auto78    : PMI stops at the month the ORIGINAL schedule reaches 78%.
   */
  dropAt?: "request80" | "auto78";
}

export interface ExtraPayments {
  /** Extra amount every month from loan month `fromMonth` (default 1) */
  monthly?: { amount: number; fromMonth?: number };
  /** Extra amount once a year in calendar month 1-12 (Jan = 1) */
  yearly?: { amount: number; calendarMonth: number; fromMonth?: number };
  /** One-time lump sums, `month` = loan month number (1 = first payment month) */
  oneTime?: Array<{ month: number; amount: number }>;
}

export interface RateChange {
  /** Loan month in which the new rate starts (>= 2) */
  atMonth: number;
  newAnnualRatePct: number;
}

export interface Recast {
  /** Loan month in which the lump sum is paid and the payment is recalculated (>= 2) */
  atMonth: number;
  amount: number;
}

export interface MortgageInputs {
  region: RegionCode;
  homePrice: number;
  downPayment: AmountInput;
  termYears: number;
  annualRatePct: number;
  startYear: number;
  /** 1 = Jan ... 12 = Dec */
  startMonth: number;
  paymentMode?: PaymentMode;
  costs?: RecurringCosts;
  pmi?: PmiInput;
  extras?: ExtraPayments;
  rateChange?: RateChange;
  recast?: Recast;
}

export interface ScheduleRow {
  period: number;
  /** Loan month this period falls in (equals period for monthly) */
  month: number;
  loanYear: number;
  /** YYYY-MM-DD (UTC) */
  date: string;
  openingBalance: number;
  /** Scheduled principal + interest paid this period (extras excluded) */
  payment: number;
  interest: number;
  /** Scheduled principal only (extras excluded) */
  principal: number;
  extra: number;
  balance: number;
  propertyTax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  other: number;
  /** payment + extra + all recurring costs */
  totalOutOfPocket: number;
}

export interface YearRow {
  year: number;
  startDate: string;
  endDate: string;
  payments: number;
  interest: number;
  /** Scheduled principal + extras */
  principal: number;
  extra: number;
  endBalance: number;
  propertyTax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  other: number;
}

export interface PmiSummary {
  applies: boolean;
  /** First loan month where balance <= 80% of original value (actual schedule) */
  month80: number | null;
  /** Loan month where the ORIGINAL schedule reaches 78% (automatic termination) */
  month78Scheduled: number | null;
  /** Loan month where the ACTUAL schedule reaches 78% */
  month78Actual: number | null;
  /** Last loan month PMI is charged in this calculation */
  chargedThroughMonth: number | null;
  /** Per-period amount in the first period */
  perPeriodAmount: number;
  totalPaid: number;
}

export interface Savings {
  baselineInterest: number;
  baselinePeriods: number;
  interestSaved: number;
  periodsSaved: number;
  monthsSaved: number;
  extraPaidTotal: number;
}

export interface MortgageResult {
  region: RegionCode;
  currency: RegionProfile["currency"];
  locale: RegionProfile["locale"];
  paymentMode: PaymentMode;
  periodsPerYear: number;

  homePrice: number;
  downPaymentAmount: number;
  downPaymentPct: number;
  loanAmount: number;
  ltvPct: number;

  /** Rate per payment period, as a fraction (e.g. 0.005417) */
  periodicRate: number;
  /** Scheduled principal + interest per period at the start */
  scheduledPayment: number;
  /** Scheduled payment converted to a per-month figure (x periods/yr / 12) */
  monthlyEquivalentPI: number;

  firstPeriod: {
    principalAndInterest: number;
    propertyTax: number;
    insurance: number;
    pmi: number;
    hoa: number;
    other: number;
    total: number;
  };

  totals: {
    interest: number;
    /** Sum of scheduled P&I payments + extras (calculator "total of payments") */
    principalAndInterestPaid: number;
    extrasPaid: number;
    propertyTax: number;
    insurance: number;
    pmi: number;
    hoa: number;
    other: number;
    outOfPocket: number;
  };

  payoff: {
    periods: number;
    months: number;
    years: number;
    /** Date of the last payment, YYYY-MM-DD (UTC) */
    date: string;
  };

  /** Null when no extras / recast were supplied */
  savings: Savings | null;
  pmi: PmiSummary;
  events: {
    rateChange: { atMonth: number; newPayment: number } | null;
    recast: { atMonth: number; lumpApplied: number; newPayment: number } | null;
  };

  yearly: YearRow[];
  schedule: ScheduleRow[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface StrategyCompareOptions {
  extraMonthly?: number;
  /** Default: 15 when the term is longer than 15 years, otherwise skipped */
  shorterTermYears?: number;
  recastLump?: number;
  /** Default 60 */
  recastAtMonth?: number;
}

export interface StrategyOutcome {
  id:
    | "standard"
    | "extra-monthly"
    | "accelerated-biweekly"
    | "true-biweekly"
    | "shorter-term"
    | "recast";
  label: string;
  /** P&I per payment (after the recast for the recast strategy) */
  payment: number;
  paymentsPerYear: number;
  payoffMonths: number;
  payoffDate: string;
  totalInterest: number;
  interestSaved: number;
  monthsSaved: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Region profiles
// ---------------------------------------------------------------------------

export const REGION_PROFILES: Record<RegionCode, RegionProfile> = {
  US: {
    code: "US",
    label: "United States",
    currency: "USD",
    locale: "en-US",
    compounding: "periodic",
    maxTermYears: 40,
    defaultTermYears: 30,
    supportsPmi: true,
  },
  IN: {
    code: "IN",
    label: "India",
    currency: "INR",
    locale: "en-IN",
    compounding: "periodic",
    maxTermYears: 30,
    defaultTermYears: 20,
    supportsPmi: false,
  },
  CA: {
    code: "CA",
    label: "Canada",
    currency: "CAD",
    locale: "en-CA",
    // Fixed-rate Canadian mortgages are quoted compounded semi-annually, not in advance.
    // See MORTGAGE_SOURCES: canada-semi-annual
    compounding: "semi-annual",
    maxTermYears: 30,
    defaultTermYears: 25,
    supportsPmi: false,
  },
};

export function getRegionProfile(region: RegionCode): RegionProfile {
  return REGION_PROFILES[region];
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_RATE_PCT = 30;
/** 40 years x 26 biweekly periods. The UI should still show yearly rows first. */
export const MAX_SCHEDULE_ROWS = 1040;
const MAX_HOME_PRICE = 1e12;

// ---------------------------------------------------------------------------
// Small maths helpers (exported so tests and the UI can reuse them)
// ---------------------------------------------------------------------------

export function roundCents(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function periodsPerYear(mode: PaymentMode): number {
  return mode === "monthly" ? 12 : 26;
}

/**
 * Interest rate per payment period.
 * periodic    : annual / k          (US, India: standard convention)
 * semi-annual : (1 + annual/2)^(2/k) - 1   (Canada, fixed rate)
 */
export function periodicRate(
  annualPct: number,
  k: number,
  compounding: Compounding
): number {
  const j = annualPct / 100;
  if (j === 0) return 0;
  if (compounding === "semi-annual") return Math.pow(1 + j / 2, 2 / k) - 1;
  return j / k;
}

/**
 * Standard amortising payment (public-domain maths):
 *   M = P * r * (1+r)^n / ((1+r)^n - 1);  r = 0 -> P / n
 */
export function annuityPayment(principal: number, r: number, n: number): number {
  if (n <= 0) return principal;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

function monthOfPeriod(p: number, k: number): number {
  return Math.floor(((p - 1) * 12) / k) + 1;
}

function resolveAnnual(a: AmountInput | undefined, base: number): number {
  if (!a || !(a.value > 0)) return 0;
  return a.mode === "percent" ? (base * a.value) / 100 : a.value;
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class MortgageInputError extends Error {
  errors: Record<string, string>;
  constructor(errors: Record<string, string>) {
    super("Invalid mortgage inputs: " + Object.values(errors).join("; "));
    this.name = "MortgageInputError";
    this.errors = errors;
  }
}

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function checkAmount(
  errors: Record<string, string>,
  key: string,
  label: string,
  a: AmountInput | undefined,
  maxPercent: number
) {
  if (!a) return;
  if (!isNum(a.value) || a.value < 0) {
    errors[key] = `${label} must be zero or more.`;
  } else if (a.mode === "percent" && a.value > maxPercent) {
    errors[key] = `${label} cannot be more than ${maxPercent}%.`;
  }
}

export function validateMortgageInputs(input: MortgageInputs): ValidationResult {
  const errors: Record<string, string> = {};
  const profile = REGION_PROFILES[input.region];
  if (!profile) {
    return { valid: false, errors: { region: "Choose a supported region." } };
  }
  const mode = input.paymentMode ?? "monthly";
  const k = periodsPerYear(mode);

  if (!isNum(input.homePrice) || input.homePrice <= 0 || input.homePrice > MAX_HOME_PRICE) {
    errors.homePrice = "Enter a home price greater than zero.";
  }

  const dp = input.downPayment;
  if (!dp || !isNum(dp.value) || dp.value < 0) {
    errors.downPayment = "Down payment must be zero or more.";
  } else if (isNum(input.homePrice) && input.homePrice > 0) {
    const downAmt = dp.mode === "percent" ? (input.homePrice * dp.value) / 100 : dp.value;
    if (downAmt >= input.homePrice) {
      errors.downPayment = "Down payment must be less than the home price.";
    }
  }

  if (!isNum(input.annualRatePct) || input.annualRatePct < 0 || input.annualRatePct > MAX_RATE_PCT) {
    errors.annualRatePct = `Interest rate must be between 0% and ${MAX_RATE_PCT}%.`;
  }

  if (!isNum(input.termYears) || input.termYears < 1) {
    errors.termYears = "Loan term must be at least 1 year.";
  } else if (input.termYears > profile.maxTermYears) {
    errors.termYears = `Loan term cannot be more than ${profile.maxTermYears} years for ${profile.label}.`;
  } else if (Math.round(input.termYears * k) > MAX_SCHEDULE_ROWS) {
    errors.termYears = "Loan term is too long for this payment frequency.";
  }

  if (!Number.isInteger(input.startMonth) || input.startMonth < 1 || input.startMonth > 12) {
    errors.startMonth = "Choose a start month.";
  }
  if (!Number.isInteger(input.startYear) || input.startYear < 1900 || input.startYear > 2200) {
    errors.startYear = "Enter a valid start year.";
  }

  const c = input.costs;
  if (c) {
    checkAmount(errors, "propertyTax", "Property tax", c.propertyTax, 25);
    checkAmount(errors, "insurance", "Home insurance", c.insurance, 25);
    checkAmount(errors, "hoa", "HOA fee", c.hoa, 25);
    checkAmount(errors, "other", "Other costs", c.other, 25);
    const inc = c.annualIncreasePct;
    if (inc) {
      for (const key of ["propertyTax", "insurance", "hoa", "other"] as const) {
        const v = inc[key];
        if (v !== undefined && (!isNum(v) || v < 0 || v > 50)) {
          errors[`${key}Increase`] = "Yearly increase must be between 0% and 50%.";
        }
      }
    }
  }

  if (input.pmi) {
    checkAmount(errors, "pmi", "PMI", input.pmi.annualCost, 10);
  }

  const ex = input.extras;
  if (ex) {
    if (ex.monthly) {
      if (!isNum(ex.monthly.amount) || ex.monthly.amount < 0) errors.extraMonthly = "Extra monthly payment must be zero or more.";
      if (ex.monthly.fromMonth !== undefined && (!Number.isInteger(ex.monthly.fromMonth) || ex.monthly.fromMonth < 1)) {
        errors.extraMonthly = "Extra payment start month must be 1 or more.";
      }
    }
    if (ex.yearly) {
      if (!isNum(ex.yearly.amount) || ex.yearly.amount < 0) errors.extraYearly = "Extra yearly payment must be zero or more.";
      if (!Number.isInteger(ex.yearly.calendarMonth) || ex.yearly.calendarMonth < 1 || ex.yearly.calendarMonth > 12) {
        errors.extraYearly = "Choose a month for the yearly extra payment.";
      }
    }
    if (ex.oneTime) {
      for (const o of ex.oneTime) {
        if (!isNum(o.amount) || o.amount < 0 || !Number.isInteger(o.month) || o.month < 1) {
          errors.extraOneTime = "One-time payments need an amount of zero or more and a month of 1 or more.";
          break;
        }
      }
    }
  }

  const termMonths = isNum(input.termYears) ? Math.round(input.termYears * 12) : 0;
  if (input.rateChange) {
    const rc = input.rateChange;
    if (!Number.isInteger(rc.atMonth) || rc.atMonth < 2 || rc.atMonth > termMonths) {
      errors.rateChange = "Rate change month must be within the loan term (month 2 or later).";
    } else if (!isNum(rc.newAnnualRatePct) || rc.newAnnualRatePct < 0 || rc.newAnnualRatePct > MAX_RATE_PCT) {
      errors.rateChange = `New rate must be between 0% and ${MAX_RATE_PCT}%.`;
    }
  }
  if (input.recast) {
    const rec = input.recast;
    if (!Number.isInteger(rec.atMonth) || rec.atMonth < 2 || rec.atMonth > termMonths) {
      errors.recast = "Recast month must be within the loan term (month 2 or later).";
    } else if (!isNum(rec.amount) || rec.amount < 0) {
      errors.recast = "Recast lump sum must be zero or more.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Core simulation (balance only; costs are attached afterwards)
// ---------------------------------------------------------------------------

interface Norm {
  input: MortgageInputs;
  profile: RegionProfile;
  mode: PaymentMode;
  k: number;
  homePrice: number;
  downAmount: number;
  loan: number;
  termYears: number;
  totalPeriods: number;
}

interface LoanRow {
  period: number;
  month: number;
  loanYear: number;
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

interface SimFlags {
  extras: boolean;
  recast: boolean;
  rateChange: boolean;
}

interface SimOut {
  rows: LoanRow[];
  initialPayment: number;
  initialRate: number;
  rateChangeEvent: { atMonth: number; newPayment: number } | null;
  recastEvent: { atMonth: number; lumpApplied: number; newPayment: number } | null;
}

function normalise(input: MortgageInputs): Norm {
  const profile = REGION_PROFILES[input.region];
  const mode = input.paymentMode ?? "monthly";
  const k = periodsPerYear(mode);
  const downAmount = roundCents(
    input.downPayment.mode === "percent"
      ? (input.homePrice * input.downPayment.value) / 100
      : input.downPayment.value
  );
  return {
    input,
    profile,
    mode,
    k,
    homePrice: input.homePrice,
    downAmount,
    loan: roundCents(input.homePrice - downAmount),
    termYears: input.termYears,
    totalPeriods: Math.round(input.termYears * k),
  };
}

/** Scheduled payment for a balance over `remainingPeriods` periods. */
function schedulePayment(n: Norm, balance: number, annualPct: number, remainingPeriods: number): number {
  const comp = n.profile.compounding;
  if (n.mode === "accelerated-biweekly") {
    // Half of the equivalent MONTHLY payment, paid every 2 weeks.
    const months = Math.max(1, Math.round((remainingPeriods * 12) / n.k));
    const rm = periodicRate(annualPct, 12, comp);
    return roundCents(annuityPayment(balance, rm, months) / 2);
  }
  const r = periodicRate(annualPct, n.k, comp);
  return roundCents(annuityPayment(balance, r, remainingPeriods));
}

function simulateLoan(n: Norm, flags: SimFlags): SimOut {
  const { input, k } = n;
  const comp = n.profile.compounding;
  const ex = flags.extras ? input.extras : undefined;
  const rc = flags.rateChange ? input.rateChange : undefined;
  const rec = flags.recast ? input.recast : undefined;

  let balance = n.loan;
  let annual = input.annualRatePct;
  let r = periodicRate(annual, k, comp);
  let payment = schedulePayment(n, balance, annual, n.totalPeriods);
  const initialPayment = payment;
  const initialRate = r;

  // Lump sums keyed by loan month
  const lumpByMonth = new Map<number, number>();
  const addLump = (m: number, amt: number) => lumpByMonth.set(m, (lumpByMonth.get(m) ?? 0) + amt);
  if (ex?.oneTime) for (const o of ex.oneTime) if (o.amount > 0) addLump(o.month, o.amount);
  const yearlyExtra = ex?.yearly && ex.yearly.amount > 0 ? ex.yearly : undefined;
  const maxMonths = Math.ceil((n.totalPeriods * 12) / k) + 2;
  if (yearlyExtra) {
    const from = yearlyExtra.fromMonth ?? 1;
    for (let m = from; m <= maxMonths; m++) {
      const calMonth = ((input.startMonth - 1 + (m - 1)) % 12) + 1;
      if (calMonth === yearlyExtra.calendarMonth) addLump(m, yearlyExtra.amount);
    }
  }
  const monthlyExtra = ex?.monthly && ex.monthly.amount > 0 ? ex.monthly : undefined;

  const rows: LoanRow[] = [];
  let rateChangeEvent: SimOut["rateChangeEvent"] = null;
  let recastEvent: SimOut["recastEvent"] = null;

  for (let p = 1; balance > 0.004 && p <= n.totalPeriods + 2; p++) {
    const month = monthOfPeriod(p, k);
    const firstOfMonth = p === 1 || month !== monthOfPeriod(p - 1, k);
    const remaining = n.totalPeriods - (p - 1);
    const opening = balance;
    let recastLump = 0;

    // 1) Rate change: re-amortise the remaining balance over the remaining term
    if (firstOfMonth && rc && month === rc.atMonth) {
      annual = rc.newAnnualRatePct;
      r = periodicRate(annual, k, comp);
      payment = schedulePayment(n, balance, annual, Math.max(1, remaining));
      rateChangeEvent = { atMonth: month, newPayment: payment };
    }

    // 2) Recast: lump sum first, then re-amortise over the SAME remaining term
    if (firstOfMonth && rec && month === rec.atMonth && rec.amount > 0) {
      recastLump = Math.min(roundCents(rec.amount), balance);
      balance = roundCents(balance - recastLump);
      if (balance > 0.004) payment = schedulePayment(n, balance, annual, Math.max(1, remaining));
      recastEvent = { atMonth: month, lumpApplied: recastLump, newPayment: balance > 0.004 ? payment : 0 };
      if (balance <= 0.004) {
        rows.push({
          period: p, month, loanYear: Math.floor((p - 1) / k) + 1,
          openingBalance: opening, payment: 0, interest: 0, principal: 0,
          extra: recastLump, balance: 0,
        });
        break;
      }
    }

    // 3) Scheduled payment. Final period (or payment >= payoff) clears the balance.
    const interest = roundCents(balance * r);
    let due = payment;
    if (remaining <= 1 || due >= roundCents(balance + interest)) due = roundCents(balance + interest);
    const principal = Math.max(0, roundCents(due - interest));

    // 4) Extra payments (capped at what is still owed)
    let extraWanted = 0;
    if (monthlyExtra && month >= (monthlyExtra.fromMonth ?? 1)) {
      extraWanted += (monthlyExtra.amount * 12) / k;
    }
    if (firstOfMonth) extraWanted += lumpByMonth.get(month) ?? 0;
    const extra = Math.max(0, Math.min(roundCents(extraWanted), roundCents(balance - principal)));

    let newBalance = roundCents(balance - principal - extra);
    if (newBalance < 0.005) newBalance = 0;

    rows.push({
      period: p,
      month,
      loanYear: Math.floor((p - 1) / k) + 1,
      openingBalance: opening,
      payment: due,
      interest,
      principal,
      extra: roundCents(extra + recastLump),
      balance: newBalance,
    });
    balance = newBalance;
  }

  return { rows, initialPayment, initialRate, rateChangeEvent, recastEvent };
}

function firstMonthAtOrBelow(rows: LoanRow[], threshold: number): number | null {
  for (const row of rows) if (row.balance <= threshold) return row.month;
  return null;
}

function dateForPeriod(n: Norm, p: number): string {
  const { startYear, startMonth } = n.input;
  if (n.mode === "monthly") return toIsoDate(Date.UTC(startYear, startMonth - 1 + (p - 1), 1));
  return toIsoDate(Date.UTC(startYear, startMonth - 1, 1) + (p - 1) * 14 * 86400000);
}

function hasExtras(i: MortgageInputs): boolean {
  const e = i.extras;
  const extrasOn =
    !!e &&
    ((e.monthly?.amount ?? 0) > 0 ||
      (e.yearly?.amount ?? 0) > 0 ||
      (e.oneTime ?? []).some((o) => o.amount > 0));
  return extrasOn || (!!i.recast && i.recast.amount > 0);
}

// ---------------------------------------------------------------------------
// Public: main calculation
// ---------------------------------------------------------------------------

export function calculateMortgage(input: MortgageInputs): MortgageResult {
  const v = validateMortgageInputs(input);
  if (!v.valid) throw new MortgageInputError(v.errors);

  const n = normalise(input);
  const { k, profile } = n;
  const warnings: string[] = [];

  const actual = simulateLoan(n, { extras: true, recast: true, rateChange: true });
  const rows = actual.rows;

  // ---- PMI (US only) ----
  // Source: Homeowners Protection Act of 1998 (see MORTGAGE_SOURCES: hpa-1998, cfpb-pmi).
  //   - Borrower may request cancellation when the balance is scheduled to reach 80% of ORIGINAL value
  //     (earlier if extra payments bring it there).
  //   - Servicer must terminate automatically when the balance is SCHEDULED to reach 78%.
  const ltvPct = (n.loan / n.homePrice) * 100;
  const pmiRequested = !!input.pmi && resolveAnnual(input.pmi.annualCost, n.loan) > 0;
  if (pmiRequested && !profile.supportsPmi) {
    warnings.push(`PMI is not modelled for ${profile.label}, so it was ignored.`);
  }
  const pmiApplies = pmiRequested && profile.supportsPmi && ltvPct > 80;

  let month80: number | null = null;
  let month78Scheduled: number | null = null;
  let month78Actual: number | null = null;
  let pmiThrough: number | null = null;
  if (pmiApplies) {
    const original = simulateLoan(n, { extras: false, recast: false, rateChange: false });
    month80 = firstMonthAtOrBelow(rows, 0.8 * n.homePrice);
    month78Actual = firstMonthAtOrBelow(rows, 0.78 * n.homePrice);
    month78Scheduled = firstMonthAtOrBelow(original.rows, 0.78 * n.homePrice);
    const dropAt = input.pmi?.dropAt ?? "request80";
    pmiThrough = dropAt === "auto78" ? month78Scheduled : month80;
  }

  // ---- Recurring costs per period ----
  const c = input.costs;
  const annualTax = resolveAnnual(c?.propertyTax, n.homePrice);
  const annualIns = resolveAnnual(c?.insurance, n.homePrice);
  const annualHoa = resolveAnnual(c?.hoa, n.homePrice);
  const annualOther = resolveAnnual(c?.other, n.homePrice);
  const annualPmi = pmiApplies ? resolveAnnual(input.pmi?.annualCost, n.loan) : 0;
  const inc = c?.annualIncreasePct ?? {};
  const grow = (base: number, pct: number | undefined, year: number) =>
    base * Math.pow(1 + (pct ?? 0) / 100, year - 1);

  const schedule: ScheduleRow[] = rows.map((row) => {
    const propertyTax = roundCents(grow(annualTax, inc.propertyTax, row.loanYear) / k);
    const insurance = roundCents(grow(annualIns, inc.insurance, row.loanYear) / k);
    const hoa = roundCents(grow(annualHoa, inc.hoa, row.loanYear) / k);
    const other = roundCents(grow(annualOther, inc.other, row.loanYear) / k);
    const pmi =
      pmiApplies && pmiThrough !== null && row.month <= pmiThrough ? roundCents(annualPmi / k) : 0;
    return {
      period: row.period,
      month: row.month,
      loanYear: row.loanYear,
      date: dateForPeriod(n, row.period),
      openingBalance: row.openingBalance,
      payment: row.payment,
      interest: row.interest,
      principal: row.principal,
      extra: row.extra,
      balance: row.balance,
      propertyTax,
      insurance,
      pmi,
      hoa,
      other,
      totalOutOfPocket: roundCents(row.payment + row.extra + propertyTax + insurance + pmi + hoa + other),
    };
  });

  // ---- Totals ----
  const sum = (f: (r: ScheduleRow) => number) => roundCents(schedule.reduce((a, r) => a + f(r), 0));
  const totals = {
    interest: sum((r) => r.interest),
    principalAndInterestPaid: sum((r) => r.payment + r.extra),
    extrasPaid: sum((r) => r.extra),
    propertyTax: sum((r) => r.propertyTax),
    insurance: sum((r) => r.insurance),
    pmi: sum((r) => r.pmi),
    hoa: sum((r) => r.hoa),
    other: sum((r) => r.other),
    outOfPocket: sum((r) => r.totalOutOfPocket),
  };

  // ---- Yearly summary ----
  const yearly: YearRow[] = [];
  for (const row of schedule) {
    let y = yearly[yearly.length - 1];
    if (!y || y.year !== row.loanYear) {
      y = {
        year: row.loanYear, startDate: row.date, endDate: row.date, payments: 0, interest: 0,
        principal: 0, extra: 0, endBalance: row.balance, propertyTax: 0, insurance: 0, pmi: 0, hoa: 0, other: 0,
      };
      yearly.push(y);
    }
    y.endDate = row.date;
    y.payments = roundCents(y.payments + row.payment + row.extra);
    y.interest = roundCents(y.interest + row.interest);
    y.principal = roundCents(y.principal + row.principal + row.extra);
    y.extra = roundCents(y.extra + row.extra);
    y.endBalance = row.balance;
    y.propertyTax = roundCents(y.propertyTax + row.propertyTax);
    y.insurance = roundCents(y.insurance + row.insurance);
    y.pmi = roundCents(y.pmi + row.pmi);
    y.hoa = roundCents(y.hoa + row.hoa);
    y.other = roundCents(y.other + row.other);
  }

  // ---- Savings vs "no extras / no recast" (rate change is kept) ----
  let savings: Savings | null = null;
  if (hasExtras(input)) {
    const base = simulateLoan(n, { extras: false, recast: false, rateChange: true });
    const baseInterest = roundCents(base.rows.reduce((a, r) => a + r.interest, 0));
    const periodsSaved = base.rows.length - rows.length;
    savings = {
      baselineInterest: baseInterest,
      baselinePeriods: base.rows.length,
      interestSaved: roundCents(baseInterest - totals.interest),
      periodsSaved,
      monthsSaved: roundCents((periodsSaved * 12) / k),
      extraPaidTotal: totals.extrasPaid,
    };
  }

  const first = schedule[0];
  const lastRow = schedule[schedule.length - 1];
  const months = roundCents((schedule.length * 12) / k);

  return {
    region: input.region,
    currency: profile.currency,
    locale: profile.locale,
    paymentMode: n.mode,
    periodsPerYear: k,
    homePrice: n.homePrice,
    downPaymentAmount: n.downAmount,
    downPaymentPct: roundCents((n.downAmount / n.homePrice) * 100),
    loanAmount: n.loan,
    ltvPct: roundCents(ltvPct),
    periodicRate: actual.initialRate,
    scheduledPayment: actual.initialPayment,
    monthlyEquivalentPI: roundCents((actual.initialPayment * k) / 12),
    firstPeriod: {
      principalAndInterest: first.payment,
      propertyTax: first.propertyTax,
      insurance: first.insurance,
      pmi: first.pmi,
      hoa: first.hoa,
      other: first.other,
      total: roundCents(first.payment + first.propertyTax + first.insurance + first.pmi + first.hoa + first.other),
    },
    totals,
    payoff: {
      periods: schedule.length,
      months,
      years: roundCents(months / 12),
      date: lastRow.date,
    },
    savings,
    pmi: {
      applies: pmiApplies,
      month80,
      month78Scheduled,
      month78Actual,
      chargedThroughMonth: pmiThrough,
      perPeriodAmount: pmiApplies ? roundCents(annualPmi / k) : 0,
      totalPaid: totals.pmi,
    },
    events: { rateChange: actual.rateChangeEvent, recast: actual.recastEvent },
    yearly,
    schedule,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Public: strategy comparison (principal & interest only)
// ---------------------------------------------------------------------------

export function compareStrategies(
  input: MortgageInputs,
  options: StrategyCompareOptions = {}
): StrategyOutcome[] {
  // Clean comparison: P&I only, no costs / PMI / user extras. Rate change is kept.
  const clean: MortgageInputs = {
    ...input,
    costs: undefined,
    pmi: undefined,
    extras: undefined,
    recast: undefined,
    paymentMode: "monthly",
  };
  const baseline = calculateMortgage(clean);
  const out: StrategyOutcome[] = [];

  const push = (
    id: StrategyOutcome["id"],
    label: string,
    res: MortgageResult,
    payment: number,
    note: string
  ) => {
    out.push({
      id,
      label,
      payment,
      paymentsPerYear: res.periodsPerYear,
      payoffMonths: res.payoff.months,
      payoffDate: res.payoff.date,
      totalInterest: res.totals.interest,
      interestSaved: roundCents(baseline.totals.interest - res.totals.interest),
      monthsSaved: roundCents(baseline.payoff.months - res.payoff.months),
      note,
    });
  };

  push("standard", "Standard monthly payments", baseline, baseline.scheduledPayment, "Your loan as entered, with no extras.");

  if ((options.extraMonthly ?? 0) > 0) {
    const r = calculateMortgage({ ...clean, extras: { monthly: { amount: options.extraMonthly as number } } });
    push("extra-monthly", "Extra payment every month", r, r.scheduledPayment + (options.extraMonthly as number),
      "Regular payment plus the extra amount, every month.");
  }

  const accel = calculateMortgage({ ...clean, paymentMode: "accelerated-biweekly" });
  push("accelerated-biweekly", "Biweekly: half the monthly payment", accel, accel.scheduledPayment,
    "26 half-payments a year equals 13 monthly payments, so it pays off sooner. Lender methods vary slightly.");

  const trueBi = calculateMortgage({ ...clean, paymentMode: "biweekly" });
  push("true-biweekly", "Biweekly: true biweekly amortisation", trueBi, trueBi.scheduledPayment,
    "Same term as monthly. Smaller payments spread over 26 periods, so savings are small.");

  const shorter = options.shorterTermYears ?? (input.termYears > 15 ? 15 : undefined);
  if (shorter !== undefined && shorter < input.termYears && shorter >= 1) {
    const r = calculateMortgage({ ...clean, termYears: shorter });
    push("shorter-term", `${shorter}-year term`, r, r.scheduledPayment,
      "Higher payment, much less interest. Lenders may also offer a lower rate on shorter terms.");
  }

  if ((options.recastLump ?? 0) > 0) {
    const r = calculateMortgage({
      ...clean,
      recast: { atMonth: options.recastAtMonth ?? 60, amount: options.recastLump as number },
    });
    push("recast", "Lump sum + recast", r, r.events.recast?.newPayment ?? r.scheduledPayment,
      "Payment drops after the lump sum; payoff date stays the same. FHA, VA and USDA loans generally cannot be recast.");
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sources (shown in the UI "Sources" accordion).
// status "verified"   : the URL was opened and the claim checked on 1 Oct 2026.
// status "to-verify"  : confirm the link/wording before publishing.
// ---------------------------------------------------------------------------

export interface MortgageSource {
  id: string;
  title: string;
  url: string;
  note: string;
  status: "verified" | "to-verify";
}

export const MORTGAGE_SOURCES: MortgageSource[] = [
  {
    id: "amortization-formula",
    title: "Standard loan amortisation formula",
    url: "",
    note: "Public-domain maths: M = P*r*(1+r)^n / ((1+r)^n - 1). No source link needed.",
    status: "verified",
  },
  {
    id: "cfpb-pmi",
    title: "CFPB: When can I remove private mortgage insurance (PMI) from my loan?",
    url: "https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/",
    note: "Request cancellation at 80% of original value (earlier with extra payments); automatic termination when scheduled to reach 78%.",
    status: "verified",
  },
  {
    id: "hpa-1998",
    title: "Homeowners Protection Act of 1998 (Public Law 105-216)",
    url: "https://www.govinfo.gov/app/details/PLAW-105publ216",
    note: "US law behind the 80% / 78% PMI rules. Confirm wording again when writing the page copy.",
    status: "to-verify",
  },
  {
    id: "canada-semi-annual",
    title: "Canadian fixed-rate mortgages: interest compounded semi-annually, not in advance",
    url: "https://www.rbcroyalbank.com/mortgages/_assets-custom/terms.html",
    note: "Lender disclosures describe fixed-rate interest as compounded semi-annually, not in advance. Add a government explanation (e.g. Interest Act, s. 6, or FCAC) before publishing.",
    status: "to-verify",
  },
  {
    id: "india-prepayment",
    title: "RBI guidance on prepayment charges for floating-rate loans (India)",
    url: "",
    note: "Find the current RBI direction and link it before stating anything about prepayment penalties.",
    status: "to-verify",
  },
];

export const MORTGAGE_LAST_REVIEWED = "2026-10-01";
