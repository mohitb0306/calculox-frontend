"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SafeIcon from "@/components/common/SafeIcon";
import * as FiIcons from "react-icons/fi";
import {
  calculateChildBMI,
  validateChildBMIInput,
  getAgeInMonths,
  kgToUnit,
  ChildSex,
  ChildBMIUnit,
} from "@/utils/calculators/childBmiLogic";

const { FiUser, FiAlertCircle, FiInfo, FiHeart, FiActivity, FiCalendar, FiRotateCcw } = FiIcons;

// --- CATEGORY -> COLOR MAPPING (kept consistent with the adult BMICalculator's tone system) ---
const getCategoryColors = (tone: "low" | "normal" | "watch" | "high") => {
  switch (tone) {
    case "low":
      return {
        text: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500",
        grad: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800",
      };
    case "normal":
      return {
        text: "text-green-600 dark:text-green-500",
        bg: "bg-green-500",
        grad: "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800",
      };
    case "watch":
      return {
        text: "text-yellow-600 dark:text-yellow-500",
        bg: "bg-yellow-500",
        grad: "from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800",
      };
    case "high":
      return {
        text: "text-red-500 dark:text-red-400",
        bg: "bg-red-500",
        grad: "from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800",
      };
  }
};

export default function ChildBMICalculator() {
  const [unit, setUnit] = useState<ChildBMIUnit>("metric");
  const [sex, setSex] = useState<ChildSex>("male");
  const [dob, setDob] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [error, setError] = useState<string>("");

  const ageMonths = useMemo(() => {
    if (!dob) return null;
    const parsed = new Date(dob);
    if (isNaN(parsed.getTime())) return null;
    return getAgeInMonths(parsed);
  }, [dob]);

  const result = useMemo(() => {
    setError("");
    if (ageMonths === null) return null;
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!weight || !height) return null;

    const validation = validateChildBMIInput(w, h, ageMonths, unit);
    if (!validation.isValid) {
      setError(validation.error || "Please check your inputs.");
      return null;
    }
    return calculateChildBMI(w, h, ageMonths, sex, unit);
  }, [weight, height, ageMonths, sex, unit]);

  const colors = result ? getCategoryColors(result.categoryTone) : null;

  const handleReset = () => {
    setDob("");
    setWeight("");
    setHeight("");
    setError("");
  };

  const handleUnitToggle = (next: ChildBMIUnit) => {
    if (next === unit) return;
    setWeight("");
    setHeight("");
    setUnit(next);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6 md:p-8">
        {/* Unit toggle */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
            {(["metric", "imperial"] as ChildBMIUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => handleUnitToggle(u)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  unit === u
                    ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {u === "metric" ? "kg / cm" : "lb / in"}
              </button>
            ))}
          </div>
        </div>

        {/* Sex selector */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Child's sex
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["male", "female"] as ChildSex[]).map((s) => (
              <button
                key={s}
                onClick={() => setSex(s)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  sex === s
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <SafeIcon icon={FiUser} className="w-4 h-4" />
                {s === "male" ? "Boy" : "Girl"}
              </button>
            ))}
          </div>
        </div>

        {/* Date of birth */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Date of birth
          </label>
          <div className="relative">
            <SafeIcon
              icon={FiCalendar}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            />
            <input
              type="date"
              value={dob}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDob(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            We calculate your child's exact age in months from this date, since growth
            references are month-by-month. Covers ages 2–19 years.
          </p>
        </div>

        {/* Weight / Height */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Weight ({unit === "metric" ? "kg" : "lb"})
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={unit === "metric" ? "e.g. 18" : "e.g. 40"}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Height ({unit === "metric" ? "cm" : "in"})
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={unit === "metric" ? "e.g. 105" : "e.g. 41"}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Reset */}
        {(dob || weight || height) && (
          <button
            onClick={handleReset}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <SafeIcon icon={FiRotateCcw} className="w-3.5 h-3.5" />
            Reset
          </button>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm"
            >
              <SafeIcon icon={FiAlertCircle} className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {result && colors && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-6 p-6 rounded-2xl bg-gradient-to-br ${colors.grad} border`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Age {result.ageLabel} · {result.bmi.toFixed(1)} BMI
                  </p>
                  <p className={`text-2xl font-bold ${colors.text}`}>{result.category}</p>
                </div>
                <div className={`w-12 h-12 rounded-full ${colors.bg} bg-opacity-15 flex items-center justify-center`}>
                  <SafeIcon icon={FiActivity} className={`w-6 h-6 ${colors.text}`} />
                </div>
              </div>

              {/* Percentile bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <span>0th percentile</span>
                  <span className="font-semibold">
                    {result.percentile.toFixed(0)}th percentile for age &amp; sex
                  </span>
                  <span>100th</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/60 dark:bg-black/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.percentile}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${colors.bg}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                  <p className="text-neutral-500 dark:text-neutral-400 text-xs mb-0.5">Z-score</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-100">
                    {result.zScore >= 0 ? "+" : ""}
                    {result.zScore.toFixed(2)} SD
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                  <p className="text-neutral-500 dark:text-neutral-400 text-xs mb-0.5">
                    Healthy weight range at this height
                  </p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-100">
                    {kgToUnit(result.healthyWeightMinKg, unit).toFixed(1)}–
                    {kgToUnit(result.healthyWeightMaxKg, unit).toFixed(1)} {unit === "metric" ? "kg" : "lb"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <SafeIcon icon={FiHeart} className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-400" />
                <p>{result.insight}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disclaimer + source */}
        <div className="mt-6 flex items-start gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          <SafeIcon icon={FiInfo} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>
            Based on the World Health Organization's official BMI-for-age growth reference
            (ages 2–19). This tool is for general information only and is not a medical
            diagnosis — always confirm growth concerns with a pediatrician.
          </p>
        </div>
      </div>
    </div>
  );
}
