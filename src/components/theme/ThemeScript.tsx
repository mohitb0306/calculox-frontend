"use client";

import React from "react";

export const ThemeScript = () => {
  // OPTIMIZATION: Minified the inline script to execute milliseconds faster, 
  // ensuring zero theme flickering (FOUC) during initial page load.
  const scriptCode = `
    !function(){try{var e=localStorage.getItem("calcpro-theme"),t=window.matchMedia("(prefers-color-scheme: dark)").matches,a=!1;a=e?"true"===e:t,a?document.documentElement.classList.add("dark"):document.documentElement.classList.remove("dark")}catch(e){console.error("Error setting theme:",e)}}();
  `;

  return (
    <script
      id="theme-script"
      dangerouslySetInnerHTML={{ __html: scriptCode }}
    />
  );
};