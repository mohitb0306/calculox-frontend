"use client";

import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
      checked ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
    }`}
    aria-pressed={checked}
    aria-label="Toggle Dark Mode"
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
        checked ? "translate-x-7" : "translate-x-1"
      }`}
    />
  </button>
);

export default Toggle;