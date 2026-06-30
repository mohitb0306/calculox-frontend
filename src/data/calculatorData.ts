import * as FiIcons from 'react-icons/fi';
import { IconType } from 'react-icons';

// Map specific icons for safety
const {
  FiHome, FiDollarSign, FiTrendingUp, FiActivity, FiHeart, FiTarget, 
  FiPercent, FiGlobe, FiClock, FiCalendar, FiCpu, FiBarChart, 
  FiPieChart, FiCreditCard, FiShoppingCart, FiMapPin, FiThermometer, 
  FiZap, FiSettings, FiTool
} = FiIcons;

export interface CalculatorItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: IconType;
  featured: boolean;
  color: string;
  slug?: string; // Optional for compatibility
}

// --- NEW: Interface for Visual Mapping ---
export interface CalculatorVisuals {
  id: string;
  icon: any;
  color: string;
}

export const calculatorData: CalculatorItem[] = [
  // Finance Category
  {
    id: 'emi',
    name: 'EMI Calculator',
    description: 'Calculate your Equated Monthly Installment for loans',
    category: 'Finance',
    icon: FiHome,
    featured: true,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'sip',
    name: 'SIP Calculator',
    description: 'Calculate returns on Systematic Investment Plans',
    category: 'Finance',
    icon: FiTrendingUp,
    featured: true,
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'loan',
    name: 'Loan Eligibility',
    description: 'Check your loan eligibility amount',
    category: 'Finance',
    icon: FiCreditCard,
    featured: false,
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'gst',
    name: 'GST Calculator',
    description: 'Calculate GST inclusive and exclusive amounts',
    category: 'Finance',
    icon: FiPercent,
    featured: true,
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: 'roi',
    name: 'ROI Calculator',
    description: 'Calculate Return on Investment',
    category: 'Finance',
    icon: FiBarChart,
    featured: false,
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    id: 'compound',
    name: 'Compound Interest',
    description: 'Calculate compound interest on investments',
    category: 'Finance',
    icon: FiPieChart,
    featured: false,
    color: 'from-pink-500 to-pink-600'
  },
  {
    id: 'tax',
    name: 'Income Tax',
    description: 'Calculate your income tax liability',
    category: 'Finance',
    icon: FiDollarSign,
    featured: false,
    color: 'from-red-500 to-red-600'
  },

  // Health Category
  {
    id: 'bmi',
    name: 'BMI Calculator',
    description: 'Calculate your Body Mass Index',
    category: 'Health',
    icon: FiActivity,
    featured: true,
    color: 'from-teal-500 to-teal-600'
  },
  {
    id: 'bmr',
    name: 'BMR Calculator',
    description: 'Calculate your Basal Metabolic Rate',
    category: 'Health',
    icon: FiHeart,
    featured: false,
    color: 'from-rose-500 to-rose-600'
  },
  {
    id: 'calorie',
    name: 'Calorie Needs',
    description: 'Calculate your daily calorie requirements',
    category: 'Health',
    icon: FiTarget,
    featured: false,
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    id: 'pregnancy',
    name: 'Pregnancy Due Date',
    description: 'Calculate your pregnancy due date',
    category: 'Health',
    icon: FiCalendar,
    featured: false,
    color: 'from-violet-500 to-violet-600'
  },

  // Utilities Category
  {
    id: 'age',
    name: 'Age Calculator',
    description: 'Calculate your exact age',
    category: 'Utilities',
    icon: FiClock,
    featured: false,
    color: 'from-amber-500 to-amber-600'
  },
  {
    id: 'percentage',
    name: 'Percentage Calculator',
    description: 'Calculate percentages easily',
    category: 'Utilities',
    icon: FiPercent,
    featured: false,
    color: 'from-lime-500 to-lime-600'
  },
  {
    id: 'discount',
    name: 'Discount Calculator',
    description: 'Calculate discounts and final prices',
    category: 'Utilities',
    icon: FiShoppingCart,
    featured: false,
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    id: 'currency',
    name: 'Currency Converter',
    description: 'Convert between different currencies',
    category: 'Utilities',
    icon: FiGlobe,
    featured: false,
    color: 'from-sky-500 to-sky-600'
  },
  {
    id: 'timezone',
    name: 'Time Zone Converter',
    description: 'Convert time between different zones',
    category: 'Utilities',
    icon: FiClock,
    featured: false,
    color: 'from-slate-500 to-slate-600'
  },
  {
    id: 'date',
    name: 'Date Difference',
    description: 'Calculate difference between dates',
    category: 'Utilities',
    icon: FiCalendar,
    featured: false,
    color: 'from-stone-500 to-stone-600'
  },
  {
    id: 'unit',
    name: 'Unit Converter',
    description: 'Convert between different units',
    category: 'Utilities',
    icon: FiTool,
    featured: false,
    color: 'from-zinc-500 to-zinc-600'
  },

  // Business Category
  {
    id: 'tip',
    name: 'Tip Calculator',
    description: 'Calculate tips and split bills',
    category: 'Business',
    icon: FiDollarSign,
    featured: false,
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    id: 'margin',
    name: 'Sales Margin',
    description: 'Calculate profit margins',
    category: 'Business',
    icon: FiBarChart,
    featured: false,
    color: 'from-orange-500 to-red-500'
  }
];

// --- NEW: Visuals Mapping Array (Matches logic used in Client Page) ---
export const calculatorVisuals: CalculatorVisuals[] = [
  { id: 'emi', icon: FiHome, color: 'from-blue-500 to-blue-600' },
  { id: 'sip', icon: FiTrendingUp, color: 'from-green-500 to-green-600' },
  { id: 'loan', icon: FiCreditCard, color: 'from-purple-500 to-purple-600' },
  { id: 'gst', icon: FiPercent, color: 'from-orange-500 to-orange-600' },
  { id: 'roi', icon: FiBarChart, color: 'from-indigo-500 to-indigo-600' },
  { id: 'compound', icon: FiPieChart, color: 'from-pink-500 to-pink-600' },
  { id: 'tax', icon: FiDollarSign, color: 'from-red-500 to-red-600' },
  { id: 'bmi', icon: FiActivity, color: 'from-teal-500 to-teal-600' },
  { id: 'bmr', icon: FiHeart, color: 'from-rose-500 to-rose-600' },
  { id: 'calorie', icon: FiTarget, color: 'from-emerald-500 to-emerald-600' },
  { id: 'pregnancy', icon: FiCalendar, color: 'from-violet-500 to-violet-600' },
  { id: 'age', icon: FiClock, color: 'from-amber-500 to-amber-600' },
  { id: 'percentage', icon: FiPercent, color: 'from-lime-500 to-lime-600' },
  { id: 'discount', icon: FiShoppingCart, color: 'from-cyan-500 to-cyan-600' },
  { id: 'currency', icon: FiGlobe, color: 'from-sky-500 to-sky-600' },
  { id: 'timezone', icon: FiClock, color: 'from-slate-500 to-slate-600' },
  { id: 'date', icon: FiCalendar, color: 'from-stone-500 to-stone-600' },
  { id: 'unit', icon: FiTool, color: 'from-zinc-500 to-zinc-600' },
  { id: 'tip', icon: FiDollarSign, color: 'from-yellow-500 to-yellow-600' },
  { id: 'margin', icon: FiBarChart, color: 'from-orange-500 to-red-500' }
];

// --- NEW: Helper to get visuals by slug ---
export const getVisuals = (slug: string) => {
  if (!slug) return { id: 'default', icon: FiIcons.FiCpu, color: 'from-gray-500 to-gray-600' };
  
  const match = calculatorVisuals.find(c => c.id === slug || slug.includes(c.id));
  
  return match || { 
    id: slug, 
    icon: FiIcons.FiCpu, 
    color: 'from-gray-500 to-gray-600' 
  };
};

export const categories = [
  {
    id: 'all',
    name: 'All Categories',
    icon: FiCpu
  },
  {
    id: 'Finance',
    name: 'Finance',
    icon: FiDollarSign
  },
  {
    id: 'Health',
    name: 'Health',
    icon: FiHeart
  },
  {
    id: 'Utilities',
    name: 'Utilities',
    icon: FiSettings
  },
  {
    id: 'Business',
    name: 'Business',
    icon: FiBarChart
  },
];