"use client";

import React from "react";
import { FiTool } from "react-icons/fi"; // Import the specific icon used in the old fallback
import SafeIcon from "@/components/common/SafeIcon";
import EMICalculator from "./EMICalculator";
import BMICalculator from "./BMICalculator";
import BMRCalculator from "./BMRCalculator";
import BodyFatCalculator from "./BodyFatCalculator";
import WHRCalculator from "./WHRCalculator";
import ChronologicalAgeCalculator from "./ChronologicalAgeCalculator";

// --- PLACEHOLDERS (To be replaced in Phase 1) ---
// We keep these simple for now, but they will be fully implemented later.
export const SIPCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">SIP Calculator Component (Coming Soon)</div>;
export const GSTCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">GST Calculator Component (Coming Soon)</div>;
export const PercentageCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Percentage Calculator Component (Coming Soon)</div>;
// Birthday Calculator and Age Difference Calculator remain placeholders —
// next in the shared-dateLogic.ts family, per the agreed build order.
export const BirthdayCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Birthday Calculator Component (Coming Soon)</div>;
export const AgeDifferenceCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Age Difference Calculator Component (Coming Soon)</div>;

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
