
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { FiTool } from "react-icons/fi"; // Import the specific icon used in the old fallback
import SafeIcon from "@/components/common/SafeIcon";
import EMICalculator from "./EMICalculator";
import BMICalculator from "./BMICalculator";
import BMRCalculator from "./BMRCalculator";
import BodyFatCalculator from "./BodyFatCalculator";
import WHRCalculator from "./WHRCalculator";
import ChronologicalAgeCalculator from "./ChronologicalAgeCalculator";
import BirthdayCalculator from "./BirthdayCalculator";
import AgeDifferenceCalculator from "./AgeDifferenceCalculator";
import ReverseBMICalculator from "./ReverseBMICalculator";
import type { MortgagePreset } from "./MortgageCalculator"; // type-only: erased at build, keeps the dynamic chunk separate
import type { AutoLoanPreset } from "./AutoLoanCalculator"; // type-only: erased at build, keeps the dynamic chunk separate

// Mortgage is the largest calculator (schedule, charts, compare panel), so it is code-split.
// The calculator UI is not SEO content (description/FAQ come from the CMS), so a plain skeleton is fine.
const MortgageCalculator = dynamic(() => import("./MortgageCalculator"), {
  loading: () => (
    <div className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400" role="status" aria-live="polite">
      Loading calculator…
    </div>
  ),
});

// Auto Loan is also code-split (charts, schedule, sources panel).
const AutoLoanCalculator = dynamic(() => import("./AutoLoanCalculator"), {
  loading: () => (
    <div className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400" role="status" aria-live="polite">
      Loading calculator…
    </div>
  ),
});

// Landing-page presets for Auto Loan aliases (Phase 3 slugs only). A preset only changes the STARTING state;
// no numbers are pre-filled. Phase 4 slugs are added later.
const AUTO_LOAN_PRESETS: Record<string, AutoLoanPreset> = {
  "auto-loan-calculator-with-trade-in": { region: "US", openTradeIn: true },
  "car-loan-emi-calculator": { region: "IN" },
  "car-loan-calculator-canada": { region: "CA" },
};

// Landing-page presets for Mortgage aliases. A preset only changes the STARTING state.
// Same component for every alias; never fork it (see the Age Difference note below).
const MORTGAGE_PRESETS: Record<string, MortgagePreset> = {
  "mortgage-calculator-with-extra-payments": { region: "US", extraMonthly: 200, openExtras: true },
  "mortgage-payoff-calculator": { region: "US", openExtras: true },
  "biweekly-mortgage-calculator": { region: "US" }, // the Compare panel shows both biweekly types
  "mortgage-pmi-calculator": { region: "US", openCosts: true }, // PMI field lives in Taxes & costs
  "canadian-mortgage-calculator": { region: "CA" },
  "home-loan-emi-calculator": { region: "IN", termYears: 20 },
  "15-vs-30-year-mortgage-calculator": { region: "US", termYears: 15 },
};

// --- PLACEHOLDERS (To be replaced in Phase 1) ---
// We keep these simple for now, but they will be fully implemented later.
export const SIPCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">SIP Calculator Component (Coming Soon)</div>;
export const GSTCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">GST Calculator Component (Coming Soon)</div>;
export const PercentageCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Percentage Calculator Component (Coming Soon)</div>;

// --- REGISTRY MAPPING ---
export const renderCalculatorComponent = (key: string, props: any) => {
  if (!key) return null;
  const normalizedKey = key.toLowerCase();

  switch (normalizedKey) {
    case "emi": 
    case "emi-calculator": 
        return <EMICalculator {...props} />;
        
    case "bmi":
    case "bmi-calculator":
        return <BMICalculator {...props} />;

    case "reverse-bmi-calculator":
    case "reverse-bmi":
        return <ReverseBMICalculator {...props} />;

    case "bmr":
    case "bmr-calculator":
        return <BMRCalculator {...props} />;

    case "bodyfat":
    case "body-fat":
    case "body-fat-calculator":
        return <BodyFatCalculator {...props} />;

    case "whr":
    case "whr-calculator":
    case "waist-to-hip":
    case "waist-to-hip-ratio":
    case "waist-to-hip-ratio-calculator":
        return <WHRCalculator {...props} />;

    case "mortgage":
    case "mortgage-calculator":
    // Long-tail SEO aliases: same component, preset above, H1/meta/FAQ from the CMS.
    case "mortgage-calculator-with-extra-payments":
    case "mortgage-payoff-calculator":
    case "biweekly-mortgage-calculator":
    case "mortgage-pmi-calculator":
    case "canadian-mortgage-calculator":
    case "home-loan-emi-calculator":
    case "15-vs-30-year-mortgage-calculator":
        return <MortgageCalculator {...props} preset={MORTGAGE_PRESETS[normalizedKey]} />;

    case "auto-loan":
    case "auto-loan-calculator":
    case "car-loan-calculator":
    case "car-payment-calculator":
    // Long-tail SEO aliases: same component, preset above, H1/meta/FAQ from the CMS.
    case "auto-loan-calculator-with-trade-in":
    case "car-loan-emi-calculator":
    case "car-loan-calculator-canada":
        return <AutoLoanCalculator {...props} preset={AUTO_LOAN_PRESETS[normalizedKey]} />;

    case "sip": 
    case "sip-calculator":
        return <SIPCalculator {...props} />;
        
    case "gst": 
    case "gst-calculator":
        return <GSTCalculator {...props} />;
        
    case "percentage": 
    case "percentage-calculator":
        return <PercentageCalculator {...props} />;
        
    case "age": 
    case "age-calculator":
    case "chronological-age":
    case "chronological-age-calculator":
        return <ChronologicalAgeCalculator {...props} />;

    case "birthday":
    case "birthday-calculator":
        return <BirthdayCalculator {...props} />;

    case "age-difference":
    case "age-difference-calculator":
    case "age-gap-calculator":
    case "age-gap":
    // Long-tail SEO aliases — same component, distinct landing-page
    // metadata/H1 supplied by each route (see the "programmatic SEO"
    // play in the Age Difference blueprint). Add new aliases here only;
    // never fork the component per-alias.
    case "marriage-age-calculator":
    case "couple-age-difference-calculator":
    case "sibling-age-gap-calculator":
    case "age-gap-in-relationships-calculator":
    case "who-is-older-calculator":
        return <AgeDifferenceCalculator {...props} />;

    default: 
      // This UI matches the old CalculatorPage.jsx default case exactly
      return (
        <div className="text-center py-12">
           <SafeIcon icon={FiTool} className="w-12 h-12 mx-auto text-gray-400 mb-4" />
           <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
             Calculator Not Implemented
           </h3>
           <p className="text-gray-500 mt-2">
             The component for &apos;{key}&apos; has not been linked yet.
           </p>
        </div>
      );
  }
};
