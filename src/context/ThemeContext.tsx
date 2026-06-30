"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // 1. Default to false (Light) for Server-Side Rendering match
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 2. INITIAL LOAD: Read from LocalStorage or System Preference
  useEffect(() => {
    setMounted(true); // Mark as mounted so we know we are on the client

    const saved = localStorage.getItem("calcpro-theme");
    
    if (saved) {
      // Restore user preference
      const parsedValue = JSON.parse(saved);
      setIsDark(parsedValue);
      
      // Apply immediately to prevent flash
      if (parsedValue) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Fallback to system preference
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // 3. UPDATES: Sync state changes to LocalStorage & DOM
  useEffect(() => {
    // block this effect from running on initial server render or before mount check
    if (!mounted) return;

    localStorage.setItem("calcpro-theme", JSON.stringify(isDark));
    
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark, mounted]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // 4. RENDER: Always provide context to avoid "useTheme" errors
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};