import React from "react";
import * as FiIcons from "react-icons/fi";
import { IconType } from "react-icons";

interface SafeIconProps {
  icon: any; // Can be a string name or a React Component
  className?: string;
  [key: string]: any; // Allow other props like onClick, etc.
}

const SafeIcon: React.FC<SafeIconProps> = ({ icon, className, ...props }) => {
  let IconComponent: IconType | null = null;

  try {
    // Case 1: Icon is already a React Component (function/object)
    if (typeof icon === "function" || typeof icon === "object") {
      IconComponent = icon as IconType;
    }
    // Case 2: Icon is a string name (e.g., "FiCpu" or "Calculator")
    else if (typeof icon === "string") {
      // Handle cases where the prefix 'Fi' might be missing
      const iconName = icon.startsWith("Fi") ? icon : `Fi${icon}`;
      // @ts-ignore - Dynamic access to icon library
      IconComponent = FiIcons[iconName as keyof typeof FiIcons];
    }
  } catch (e) {
    console.warn("Icon load failed:", icon);
    IconComponent = null;
  }

  // Fallback to FiAlertTriangle to match old project's error state
  const ComponentToRender = IconComponent || FiIcons.FiAlertTriangle;

  return <ComponentToRender className={className} {...props} />;
};

export default SafeIcon;