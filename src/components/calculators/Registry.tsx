"use client";

import React from "react";
import { FiTool } from "react-icons/fi"; // Import the specific icon used in the old fallback
import SafeIcon from "@/components/common/SafeIcon";
import EMICalculator from "./EMICalculator";
import BMICalculator from "./BMICalculator";

// --- PLACEHOLDERS (To be replaced in Phase 1) ---
// We keep these simple for now, but they will be fully implemented later.
export const SIPCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">SIP Calculator Component (Coming Soon)</div>;
export const GSTCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">GST Calculator Component (Coming Soon)</div>;
export const PercentageCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Percentage Calculator Component (Coming Soon)</div>;
export const AgeCalculator = (props: any) => <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">Age Calculator Component (Coming Soon)</div>;

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
        return <AgeCalculator {...props} />;
        
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