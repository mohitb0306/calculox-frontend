/**
 * autoLoanLogic.ts
 * Calculox Auto Loan Calculator: pure calculation engine (no React, no I/O).
 *
 * PROVENANCE: every formula here is standard loan mathematics (formulas are not
 * subject to copyright). No third-party text, layout or code is reused.
 * Rules that depend on a law or convention are listed in AUTO_LOAN_SOURCES.
 *
 * Money is rounded to cents every period. The final payment clears the
 * remaining balance. The payment helpers are shared with the Mortgage engine
 * so there is one tested payment formula. The Mortgage REGION_PROFILES are NOT
 * used: they carry mortgage-only rules (for example Canadian semi-annual
 * compounding and terms measured in years).
 *
 * Phase 1 scope: validation, calculateAutoLoan (incl. flat rate, extra
 * payments, savings), compareTerms, flatToReducingApr, maxFinancedForPayment,
 * solveAffordability. Phase 4 still to add: solveEffectiveApr.
 *
 * Date convention: the first payment falls in the chosen start month/year.
 * The payoff date is the month of the last payment.
 */

import { annuityPayment, periodicRate, roundCents } from "./mortgageLogic";
import type { RegionCode } from "./mortgageLogic";

// ---------------------------------------------------------------------------
// Limits (our choices, not legal limits; owner can change them)
// ---------------------------------------------------------------------------

export const MAX_AUTO_PRICE = 1_000_000_000;
export const MAX_AUTO_APR_PCT = 40; // owner to confirm (open item 1)
export const MAX_SALES_TAX_PCT = 30;
export const MAX_PROCESSING_FEE_PCT = 10;
export const MAX_GST_ON_FEE_PCT = 50;
export const NO_LOAN_THRESHOLD = 1; // amount financed below this = "no loan needed"
export const LONG_TERM_MONTHS = 72; // warning above this
export const TERM_COMPARE_MONTHS: readonly number[] = [36, 48, 60, 72, 84];
const START_YEAR_WINDOW = 5;

// ---------------------------------------------------------------------------
// Region settings
// ---------------------------------------------------------------------------

export interface AutoRegionProfile {
  code: RegionCode;
  label: string;
  currency: string;
  locale: string;
  /** Car loans compound monthly: rate per month = APR / 12 in every region. */
  defaultTermMonths: number;
  maxTermMonths: number; // our cap
  priceLabel: string;
  showSalesTax: boolean;
  hasProcessingFee: boolean;
  supportsFlatRate: boolean;
}

export const AUTO_REGION_PROFILES: Record<RegionCode, AutoRegionProfile> = {
  US: {
    code: "US",
    label: "United States",
    currency: "USD",
    locale: "en-US",
    defaultTermMonths: 60,
    maxTermMonths: 96,
    priceLabel: "Vehicle price",
    showSalesTax: true,
    hasProcessingFee: false,
    supportsFlatRate: false,
  },
  IN: {
    code: "IN",
    label: "India",
    currency: "INR",
    locale: "en-IN",
    defaultTermMonths: 60,
    maxTermMonths: 84,
    priceLabel: "On-road price",
    showSalesTax: false, // GST is already inside the on-road price
    hasProcessingFee: true,
    supportsFlatRate: true,
  },
  CA: {
    code: "CA",
    label: "Canada",
    currency: "CAD",
    locale: "en-CA",
    defaultTermMonths: 60,
    maxTermMonths: 96,
    priceLabel: "Vehicle price",
    showSalesTax: true,
    hasProcessingFee: false,
    supportsFlatRate: false,
  },
};

export function getAutoRegionProfile(region: RegionCode): AutoRegionProfile {
  return AUTO_REGION_PROFILES[region] ?? AUTO_REGION_PROFILES.US;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoLoanInputs {
  region: RegionCode;
  price: number;
  down: { mode: "amount" | "percent"; value: number };
  tradeInValue: number;
  tradeInOwed: number; // loan still owed on the trade-in
  rebate: number;
  taxRatePct: number; // US, CA typed rate; India = 0
  tradeInReducesTax: boolean;
  rebateReducesTax: boolean; // default false
  taxableFees: number;
  nonTaxableFees: number;
  processingFeePct?: number; // India
  gstOnFeePct?: number; // India
  financeTaxesAndFees: boolean;
  rateType: "reducing" | "flat"; // flat: India only
  aprPct: number; // or the flat rate when rateType = "flat"
  termMonths: number;
  startMonth?: number; // 1-12 (first payment month); default = current month
  startYear?: number;
  extraMonthly?: number;
  extraOneTime?: { amount: number; monthIndex: number }; // monthIndex: payment number, 1-based
}

export type AutoLoanField =
  | "price"
  | "down"
  | "tradeInValue"
  | "tradeInOwed"
  | "rebate"
  | "taxRatePct"
  | "taxableFees"
  | "nonTaxableFees"
  | "processingFeePct"
  | "gstOnFeePct"
  | "rateType"
  | "aprPct"
  | "termMonths"
  | "startMonth"
  | "startYear"
  | "extraMonthly"
  | "extraOneTime";

export interface AutoLoanValidation {
  valid: boolean;
  errors: Partial<Record<AutoLoanField, string>>;
}

export type AutoLoanWarning = "NEGATIVE_EQUITY_FINANCED" | "LTV_OVER_100" | "LONG_TERM";

export interface BreakdownLine {
  id:
    | "price"
    | "salesTax"
    | "fees"
    | "lenderFee"
    | "down"
    | "rebate"
    | "tradeInEquity"
    | "negativeEquity";
  label: string;
  /** Signed contribution to the amount financed. All lines sum to amountFinanced. */
  amount: number;
}

export interface MonthMark {
  year: number;
  month: number; // 1-12
}

export interface AutoScheduleRow {
  number: number;
  year: number;
  month: number;
  payment: number; // scheduled payment only (extra shown separately)
  interest: number;
  principal: number; // from the scheduled payment only
  extra: number;
  balance: number;
}

export interface AutoYearRow {
  year: number;
  payments: number;
  interest: number;
  principal: number; // scheduled principal + extras
  extra: number;
  endBalance: number;
}

export interface AutoSavings {
  baselineMonths: number;
  baselineInterest: number;
  monthsSaved: number;
  interestSaved: number;
}

export interface AutoLoanResult {
  /** "no-loan": down payment and trade-in cover the cost; nothing is financed. */
  status: "ok" | "no-loan";
  payment: number;
  amountFinanced: number;
  breakdown: BreakdownLine[];
  salesTax: number;
  totalFees: number;
  cashDueAtSigning: number;
  totalInterest: number;
  totalPaid: number; // all loan payments including extras
  totalOutOfPocket: number; // cash due at signing + total paid
  payoffDate: MonthMark | null;
  numberOfPayments: number;
  ltvPct: number;
  negativeEquity: number;
  downAmount: number;
  /** Money credited back to the buyer when equity exceeds the cost (no-loan only). */
  surplusCredit: number;
  /** The reducing-balance APR actually used (equals aprPct unless flat). */
  effectiveAprPct: number;
  flatEmi?: number;
  schedule: AutoScheduleRow[];
  yearRows: AutoYearRow[];
  savings?: AutoSavings;
  warnings: AutoLoanWarning[];
}

export type AutoLoanOutcome =
  | { ok: true; result: AutoLoanResult }
  | { ok: false; errors: AutoLoanValidation["errors"] };

// ---------------------------------------------------------------------------
// Validation (plain-language messages, never raw errors)
// ---------------------------------------------------------------------------

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function validateAutoLoanInputs(
  input: AutoLoanInputs,
  now: Date = new Date()
): AutoLoanValidation {
  const errors: AutoLoanValidation["errors"] = {};
  const profile = getAutoRegionProfile(input.region);
  const set = (f: AutoLoanField, msg: string) => {
    if (!errors[f]) errors[f] = msg;
  };

  // Price
  if (!isNum(input.price) || input.price <= 0) set("price", "Enter the price of the vehicle.");
  else if (input.price > MAX_AUTO_PRICE) set("price", "That price is too large to calculate.");

  // Zero-or-more money fields
  const nonNeg: Array<[AutoLoanField, unknown, string]> = [
    ["tradeInValue", input.tradeInValue, "Trade-in value cannot be negative."],
    ["tradeInOwed", input.tradeInOwed, "The amount owed cannot be negative."],
    ["rebate", input.rebate, "Rebates cannot be negative."],
    ["taxableFees", input.taxableFees, "Fees cannot be negative."],
    ["nonTaxableFees", input.nonTaxableFees, "Fees cannot be negative."],
    ["extraMonthly", input.extraMonthly ?? 0, "Extra payments cannot be negative."],
  ];
  for (const [f, v, msg] of nonNeg) {
    if (!isNum(v)) set(f, "Enter a number, or leave it at zero.");
    else if (v < 0) set(f, msg);
    else if (v > MAX_AUTO_PRICE) set(f, "That amount is too large to calculate.");
  }

  // Down payment
  const d = input.down;
  if (!d || !isNum(d.value)) set("down", "Enter a number, or leave it at zero.");
  else if (d.value < 0) set("down", "Down payment cannot be negative.");
  else if (d.mode === "percent" && d.value > 100)
    set("down", "Down payment cannot be more than 100% of the price.");
  else if (d.mode === "amount" && isNum(input.price) && d.value > input.price)
    set("down", "Down payment cannot be more than the price.");

  if (isNum(input.rebate) && isNum(input.price) && input.rebate > input.price)
    set("rebate", "Rebates cannot be more than the price.");

  // Tax
  if (!isNum(input.taxRatePct) || input.taxRatePct < 0 || input.taxRatePct > MAX_SALES_TAX_PCT)
    set("taxRatePct", `Sales tax rate must be between 0% and ${MAX_SALES_TAX_PCT}%.`);

  // India fee fields
  if (profile.hasProcessingFee) {
    const pf = input.processingFeePct ?? 0;
    const gst = input.gstOnFeePct ?? 0;
    if (!isNum(pf) || pf < 0 || pf > MAX_PROCESSING_FEE_PCT)
      set("processingFeePct", `Processing fee must be between 0% and ${MAX_PROCESSING_FEE_PCT}%.`);
    if (!isNum(gst) || gst < 0 || gst > MAX_GST_ON_FEE_PCT)
      set("gstOnFeePct", `GST on the fee must be between 0% and ${MAX_GST_ON_FEE_PCT}%.`);
  }

  // Rate
  if (input.rateType === "flat" && !profile.supportsFlatRate)
    set("rateType", "Flat-rate loans are only supported for India.");
  if (!isNum(input.aprPct) || input.aprPct < 0 || input.aprPct > MAX_AUTO_APR_PCT)
    set("aprPct", `Interest rate must be between 0% and ${MAX_AUTO_APR_PCT}%.`);

  // Term
  if (!isNum(input.termMonths) || !Number.isInteger(input.termMonths) || input.termMonths < 1)
    set("termMonths", "Enter the loan term in whole months (at least 1).");
  else if (input.termMonths > profile.maxTermMonths)
    set("termMonths", `Loan term cannot be longer than ${profile.maxTermMonths} months.`);

  // Start date
  if (input.startMonth !== undefined) {
    if (!isNum(input.startMonth) || !Number.isInteger(input.startMonth) || input.startMonth < 1 || input.startMonth > 12)
      set("startMonth", "Choose a month from 1 to 12.");
  }
  if (input.startYear !== undefined) {
    const y = now.getFullYear();
    if (
      !isNum(input.startYear) ||
      !Number.isInteger(input.startYear) ||
      input.startYear < y - START_YEAR_WINDOW ||
      input.startYear > y + START_YEAR_WINDOW
    )
      set("startYear", `Choose a year within ${START_YEAR_WINDOW} years of today.`);
  }

  // One-time extra
  const ot = input.extraOneTime;
  if (ot) {
    if (!isNum(ot.amount) || ot.amount < 0) set("extraOneTime", "The one-time extra payment cannot be negative.");
    else if (
      ot.amount > 0 &&
      (!Number.isInteger(ot.monthIndex) ||
        ot.monthIndex < 1 ||
        (isNum(input.termMonths) && ot.monthIndex > input.termMonths))
    )
      set("extraOneTime", "Choose a payment number within the loan term.");
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Rate helpers
// ---------------------------------------------------------------------------

/** Monthly rate (as a fraction) for an APR given in percent. */
function monthlyRate(aprPct: number): number {
  return periodicRate(aprPct, 12, "periodic");
}

/** Flat EMI = (P + P x flat% x years) / months. */
export function flatEmiAmount(principal: number, flatPct: number, termMonths: number): number {
  if (termMonths <= 0) return principal;
  return (principal + principal * (flatPct / 100) * (termMonths / 12)) / termMonths;
}

/**
 * Reducing-balance APR (in percent, 12 x monthly rate x 100) that gives the same
 * payment as a flat-rate loan. Bisection on the monthly rate over 0 to 0.1.
 * Independent of the loan amount.
 */
export function flatToReducingApr(flatPct: number, termMonths: number): number {
  if (!(flatPct > 0) || termMonths < 1) return 0;
  const target = flatEmiAmount(1, flatPct, termMonths); // payment per 1 unit borrowed
  if (target <= 1 / termMonths) return 0;
  let lo = 0;
  let hi = 0.1;
  if (annuityPayment(1, hi, termMonths) < target) return hi * 12 * 100;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (annuityPayment(1, mid, termMonths) < target) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

/** India: processing fee on the base loan, and GST on that fee (both rounded to cents). */
export function indiaLenderFee(baseLoan: number, feePct: number, gstPct: number) {
  const fee = roundCents(Math.max(0, baseLoan) * (feePct / 100));
  const gst = roundCents(fee * (gstPct / 100));
  return { fee, gst, total: roundCents(fee + gst) };
}

/** Most that can be financed for a target payment: M x (1 - (1+r)^-n) / r. */
export function maxFinancedForPayment(targetPayment: number, aprPct: number, termMonths: number): number {
  if (!(targetPayment > 0) || termMonths < 1) return 0;
  const r = monthlyRate(aprPct);
  if (r === 0) return roundCents(targetPayment * termMonths);
  return roundCents((targetPayment * (1 - Math.pow(1 + r, -termMonths))) / r);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

interface ScheduleOut {
  payment: number;
  rows: AutoScheduleRow[];
  totalInterest: number;
  totalPaid: number;
}

function buildSchedule(
  amount: number,
  aprPct: number,
  termMonths: number,
  startMonth: number,
  startYear: number,
  extraMonthly: number,
  extraOneTime?: { amount: number; monthIndex: number }
): ScheduleOut {
  const r = monthlyRate(aprPct);
  const payment = roundCents(annuityPayment(amount, r, termMonths));
  const rows: AutoScheduleRow[] = [];
  let balance = roundCents(amount);
  let totalInterest = 0;
  let totalPaid = 0;
  const base = startYear * 12 + (startMonth - 1);

  for (let k = 1; k <= termMonths && balance > 0; k++) {
    const interest = roundCents(balance * r);
    let due = payment;
    if (k === termMonths || due >= roundCents(balance + interest)) due = roundCents(balance + interest);
    const principal = Math.max(0, roundCents(due - interest));
    let wanted = extraMonthly;
    if (extraOneTime && extraOneTime.amount > 0 && extraOneTime.monthIndex === k) wanted += extraOneTime.amount;
    const extra = Math.max(0, Math.min(roundCents(wanted), roundCents(balance - principal)));
    balance = roundCents(balance - principal - extra);
    if (balance < 0.005) balance = 0;
    const idx = base + (k - 1);
    rows.push({
      number: k,
      year: Math.floor(idx / 12),
      month: (idx % 12) + 1,
      payment: due,
      interest,
      principal,
      extra,
      balance,
    });
    totalInterest = roundCents(totalInterest + interest);
    totalPaid = roundCents(totalPaid + due + extra);
  }
  return { payment, rows, totalInterest, totalPaid };
}

function toYearRows(rows: AutoScheduleRow[]): AutoYearRow[] {
  const out: AutoYearRow[] = [];
  for (const row of rows) {
    let y = out[out.length - 1];
    if (!y || y.year !== row.year) {
      y = { year: row.year, payments: 0, interest: 0, principal: 0, extra: 0, endBalance: 0 };
      out.push(y);
    }
    y.payments = roundCents(y.payments + row.payment + row.extra);
    y.interest = roundCents(y.interest + row.interest);
    y.principal = roundCents(y.principal + row.principal + row.extra);
    y.extra = roundCents(y.extra + row.extra);
    y.endBalance = row.balance;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

export function calculateAutoLoan(input: AutoLoanInputs, now: Date = new Date()): AutoLoanOutcome {
  const v = validateAutoLoanInputs(input, now);
  if (!v.valid) return { ok: false, errors: v.errors };

  const profile = getAutoRegionProfile(input.region);
  const startMonth = input.startMonth ?? now.getMonth() + 1;
  const startYear = input.startYear ?? now.getFullYear();
  const price = roundCents(input.price);

  // 1. Down payment
  const downAmount = roundCents(
    input.down.mode === "percent" ? (price * input.down.value) / 100 : input.down.value
  );

  // 2. Trade-in equity (negative = negative equity)
  const tradeInValue = roundCents(input.tradeInValue);
  const tradeInOwed = roundCents(input.tradeInOwed);
  const equity = roundCents(tradeInValue - tradeInOwed);
  const negativeEquity = equity < 0 ? roundCents(-equity) : 0;
  const rebate = roundCents(input.rebate);

  // 3. India lender fee (processing fee + GST on the fee)
  let lenderFee = 0;
  if (profile.hasProcessingFee) {
    const baseLoan = price - downAmount - rebate - equity;
    lenderFee = indiaLenderFee(baseLoan, input.processingFeePct ?? 0, input.gstOnFeePct ?? 0).total;
  }

  // 4-5. Sales tax
  const taxableFees = roundCents(input.taxableFees);
  const nonTaxableFees = roundCents(input.nonTaxableFees);
  const taxRate = profile.showSalesTax ? input.taxRatePct : 0;
  const taxableAmount = Math.max(
    0,
    price + taxableFees - (input.tradeInReducesTax ? tradeInValue : 0) - (input.rebateReducesTax ? rebate : 0)
  );
  const salesTax = roundCents((taxableAmount * taxRate) / 100);

  // 6. Fees
  const otherFees = roundCents(taxableFees + nonTaxableFees);
  const totalFees = roundCents(otherFees + lenderFee);
  const extrasTotal = roundCents(salesTax + totalFees);

  // 7-8. Amount financed and cash due
  const financedExtras = input.financeTaxesAndFees ? extrasTotal : 0;
  const rawFinanced = roundCents(price + financedExtras - downAmount - rebate - equity);
  const cashDueAtSigning = roundCents(downAmount + (input.financeTaxesAndFees ? 0 : extrasTotal));

  const breakdown: BreakdownLine[] = [{ id: "price", label: "Vehicle price", amount: price }];
  if (input.financeTaxesAndFees) {
    if (salesTax > 0) breakdown.push({ id: "salesTax", label: "Sales tax", amount: salesTax });
    if (otherFees > 0) breakdown.push({ id: "fees", label: "Fees", amount: otherFees });
    if (lenderFee > 0) breakdown.push({ id: "lenderFee", label: "Processing fee and GST", amount: lenderFee });
  }
  if (downAmount > 0) breakdown.push({ id: "down", label: "Down payment", amount: -downAmount });
  if (rebate > 0) breakdown.push({ id: "rebate", label: "Rebates", amount: -rebate });
  if (equity > 0) breakdown.push({ id: "tradeInEquity", label: "Trade-in equity", amount: -equity });
  if (negativeEquity > 0)
    breakdown.push({ id: "negativeEquity", label: "Negative equity rolled into the loan", amount: negativeEquity });

  const common = {
    breakdown,
    salesTax,
    totalFees,
    cashDueAtSigning,
    negativeEquity,
    downAmount,
  };

  // 14 (edge). No loan needed
  if (rawFinanced < NO_LOAN_THRESHOLD) {
    return {
      ok: true,
      result: {
        status: "no-loan",
        payment: 0,
        amountFinanced: 0,
        ...common,
        totalInterest: 0,
        totalPaid: 0,
        totalOutOfPocket: cashDueAtSigning,
        payoffDate: null,
        numberOfPayments: 0,
        ltvPct: 0,
        surplusCredit: rawFinanced < 0 ? roundCents(-rawFinanced) : 0,
        effectiveAprPct: input.aprPct,
        schedule: [],
        yearRows: [],
        warnings: [],
      },
    };
  }

  const amountFinanced = rawFinanced;

  // 9. Flat rate -> reducing rate
  let apr = input.aprPct;
  let flatEmi: number | undefined;
  if (input.rateType === "flat") {
    flatEmi = roundCents(flatEmiAmount(amountFinanced, input.aprPct, input.termMonths));
    apr = flatToReducingApr(input.aprPct, input.termMonths);
  }

  // 10-12. Schedule and totals
  const extraMonthly = input.extraMonthly ?? 0;
  const oneTime = input.extraOneTime && input.extraOneTime.amount > 0 ? input.extraOneTime : undefined;
  const sched = buildSchedule(amountFinanced, apr, input.termMonths, startMonth, startYear, extraMonthly, oneTime);
  const last = sched.rows[sched.rows.length - 1];

  // 14. Extra-payment savings
  let savings: AutoSavings | undefined;
  if (extraMonthly > 0 || oneTime) {
    const base = buildSchedule(amountFinanced, apr, input.termMonths, startMonth, startYear, 0);
    savings = {
      baselineMonths: base.rows.length,
      baselineInterest: base.totalInterest,
      monthsSaved: base.rows.length - sched.rows.length,
      interestSaved: roundCents(base.totalInterest - sched.totalInterest),
    };
  }

  // 13. LTV and warnings
  const ltvPct = (amountFinanced / price) * 100;
  const warnings: AutoLoanWarning[] = [];
  if (negativeEquity > 0) warnings.push("NEGATIVE_EQUITY_FINANCED");
  if (ltvPct > 100) warnings.push("LTV_OVER_100");
  if (input.termMonths > LONG_TERM_MONTHS) warnings.push("LONG_TERM");

  return {
    ok: true,
    result: {
      status: "ok",
      payment: sched.payment,
      amountFinanced,
      ...common,
      totalInterest: sched.totalInterest,
      totalPaid: sched.totalPaid,
      totalOutOfPocket: roundCents(cashDueAtSigning + sched.totalPaid),
      payoffDate: last ? { year: last.year, month: last.month } : null,
      numberOfPayments: sched.rows.length,
      ltvPct,
      surplusCredit: 0,
      effectiveAprPct: apr,
      flatEmi,
      schedule: sched.rows,
      yearRows: toYearRows(sched.rows),
      savings,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Term comparison and affordability
// ---------------------------------------------------------------------------

export interface TermComparisonRow {
  termMonths: number;
  payment: number;
  totalInterest: number;
}

/** Same inputs, different terms (within the region maximum). Extra payments are ignored. */
export function compareTerms(
  input: AutoLoanInputs,
  terms: readonly number[] = TERM_COMPARE_MONTHS,
  now: Date = new Date()
): TermComparisonRow[] {
  const max = getAutoRegionProfile(input.region).maxTermMonths;
  const rows: TermComparisonRow[] = [];
  for (const t of terms) {
    if (t > max) continue;
    const out = calculateAutoLoan(
      { ...input, termMonths: t, extraMonthly: 0, extraOneTime: undefined },
      now
    );
    if (out.ok && out.result.status === "ok")
      rows.push({ termMonths: t, payment: out.result.payment, totalInterest: out.result.totalInterest });
  }
  return rows;
}

/**
 * Highest vehicle price whose monthly payment is at or just under the target.
 * Payment rises with price, so bisection on price (0 to MAX_AUTO_PRICE).
 * Everything except `price` is taken from `base`.
 */
export function solveAffordability(
  base: Omit<AutoLoanInputs, "price">,
  targetPayment: number,
  now: Date = new Date()
): { price: number; result: AutoLoanResult } | null {
  if (!(targetPayment > 0)) return null;
  const paymentAt = (price: number): number => {
    const o = calculateAutoLoan({ ...base, price }, now);
    if (!o.ok) return Number.NaN;
    return o.result.payment;
  };
  let lo = 0.01;
  let hi = MAX_AUTO_PRICE;
  if (!(paymentAt(hi) > targetPayment)) return null; // target too high to bind
  for (let i = 0; i < 200 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    const p = paymentAt(mid);
    if (Number.isNaN(p) || p <= targetPayment) lo = mid;
    else hi = mid;
  }
  const price = roundCents(lo);
  const o = calculateAutoLoan({ ...base, price }, now);
  return o.ok ? { price, result: o.result } : null;
}

// ---------------------------------------------------------------------------
// Sources (same shape as MORTGAGE_SOURCES)
// ---------------------------------------------------------------------------

export interface AutoLoanSource {
  id: string;
  title: string;
  url: string;
  note: string;
  status: "verified" | "to-verify";
}

export const AUTO_LOAN_LAST_REVIEWED = "2026-10-18";

export const AUTO_LOAN_SOURCES: AutoLoanSource[] = [
  {
    id: "amortization-formula",
    title: "CFPB, Regulation Z Appendix J: the actuarial method",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/J/",
    note: "US federal rule that sets out the actuarial method: each period the balance grows by interest and shrinks by the payment made. This calculator applies the same step-by-step method with the standard level-payment formula.",
    status: "verified",
  },
  {
    id: "cfpb-negotiate",
    title: "Ask CFPB: what can I negotiate when shopping for a car or auto loan?",
    url: "https://www.consumerfinance.gov/ask-cfpb/",
    note: "Used for: longer terms cost more interest and raise negative-equity risk; add-ons raise the amount borrowed. Confirm the exact page URL and statement before marking verified.",
    status: "to-verify",
  },
  {
    id: "cfpb-negative-equity",
    title: "CFPB report: Negative Equity in Auto Lending (June 2024)",
    url: "https://www.consumerfinance.gov/data-research/research-reports/",
    note: "Used for: the negative-equity concept and warning wording. Confirm the exact report URL and statement before marking verified.",
    status: "to-verify",
  },
  {
    id: "fed-g19",
    title: "Federal Reserve G.19 Consumer Credit release",
    url: "https://www.federalreserve.gov/releases/g19/current/",
    note: "Only if an average-rate note is added later. Not used in the MVP.",
    status: "to-verify",
  },
  {
    id: "us-state-tax",
    title: "State revenue department or statute (per state)",
    url: "",
    note: "Trade-in tax treatment differs by state. Only needed if a state picker is built. Until then the user types a rate and switches the trade-in rule on or off.",
    status: "to-verify",
  },
  {
    id: "india-gst-fee",
    title: "Official GST rate notifications (CBIC)",
    url: "https://cbic-gst.gov.in/",
    note: "Used for: the 18% GST default on lender processing fees, and the 84-month term cap (our choice). Confirm before showing a default.",
    status: "to-verify",
  },
  {
    id: "canada-monthly",
    title: "A lender's cost-of-borrowing disclosure (Canada)",
    url: "",
    note: "Used for: monthly compounding on car loans, and provincial tax treatment of trade-ins. Confirm against a real disclosure.",
    status: "to-verify",
  },
];
