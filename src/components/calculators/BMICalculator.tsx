"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiActivity, FiTarget, FiTrendingUp } = FiIcons;

interface BMICalculatorProps {
  onCalculationComplete?: () => void;
}

const BMICalculator: React.FC<BMICalculatorProps> = ({ onCalculationComplete }) => {
  const [weight, setWeight] = useState<number | string>(70);
  const [height, setHeight] = useState<number | string>(170);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [bmi, setBmi] = useState(0);
  const [category, setCategory] = useState('');
  const [idealWeight, setIdealWeight] = useState({ min: 0, max: 0 });

  useEffect(() => {
    const calculateBMI = () => {
      let weightInKg = parseFloat(weight.toString());
      let heightInM = parseFloat(height.toString());

      if (unit === 'imperial') {
        weightInKg = Number(weight) * 0.453592; // pounds to kg
        heightInM = Number(height) * 0.0254; // inches to meters
      } else {
        heightInM = Number(height) / 100; // cm to meters
      }

      if (weightInKg > 0 && heightInM > 0) {
        const bmiValue = weightInKg / (heightInM * heightInM);
        setBmi(bmiValue);
        setBMICategory(bmiValue);
        calculateIdealWeight(heightInM);
        
        if (onCalculationComplete) {
          onCalculationComplete();
        }
      }
    };
    calculateBMI();
  }, [weight, height, unit, onCalculationComplete]);

  const setBMICategory = (bmiValue: number) => {
    if (bmiValue < 18.5) setCategory('Underweight');
    else if (bmiValue < 25) setCategory('Normal');
    else if (bmiValue < 30) setCategory('Overweight');
    else setCategory('Obese');
  };

  const calculateIdealWeight = (heightInM: number) => {
    const minWeight = 18.5 * heightInM * heightInM;
    const maxWeight = 24.9 * heightInM * heightInM;
    
    if (unit === 'imperial') {
      setIdealWeight({ min: minWeight * 2.20462, max: maxWeight * 2.20462 });
    } else {
      setIdealWeight({ min: minWeight, max: maxWeight });
    }
  };

  // --- EXACT COLOR MAPPING FROM OLD PROJECT ---
  const getBMIColor = () => {
    if (bmi < 18.5) return 'text-blue-600 dark:text-blue-400';
    if (bmi < 25) return 'text-green-600 dark:text-green-400';
    if (bmi < 30) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getBMIBgColor = () => {
    if (bmi < 18.5) return 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800';
    if (bmi < 25) return 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800';
    if (bmi < 30) return 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800';
    return 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800';
  };

  const bmiRanges = [
    { range: 'Below 18.5', category: 'Underweight', color: 'bg-blue-500' },
    { range: '18.5 - 24.9', category: 'Normal', color: 'bg-green-500' },
    { range: '25.0 - 29.9', category: 'Overweight', color: 'bg-yellow-500' },
    { range: '30.0 & Above', category: 'Obese', color: 'bg-red-500' }
  ];

  return (
    <div className="space-y-6">
      {/* Unit Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-neutral-200 dark:bg-neutral-700 p-1 rounded-lg flex">
          <button
            onClick={() => setUnit('metric')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              unit === 'metric'
                ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Metric
          </button>
          <button
            onClick={() => setUnit('imperial')}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              unit === 'imperial'
                ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Imperial
          </button>
        </div>
      </div>
      
      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Weight {unit === 'metric' ? '(kg)' : '(lbs)'}
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            placeholder={`Enter weight in ${unit === 'metric' ? 'kg' : 'lbs'}`}
          />
          <input
            type="range"
            min={unit === 'metric' ? '30' : '66'}
            max={unit === 'metric' ? '200' : '440'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full mt-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Height {unit === 'metric' ? '(cm)' : '(inches)'}
          </label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            placeholder={`Enter height in ${unit === 'metric' ? 'cm' : 'inches'}`}
          />
          <input
            type="range"
            min={unit === 'metric' ? '100' : '39'}
            max={unit === 'metric' ? '250' : '98'}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full mt-2"
          />
        </div>
      </div>
      
      {/* Results Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-br ${getBMIBgColor()} rounded-xl p-6 border`}
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center">
              <SafeIcon icon={FiActivity} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Your BMI</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Body Mass Index</p>
            </div>
          </div>
          <div className={`text-2xl font-bold ${getBMIColor()}`}>
            {bmi.toFixed(1)}
          </div>
          <div className={`text-sm font-medium ${getBMIColor()} mt-1`}>
            {category}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <SafeIcon icon={FiTarget} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Ideal Weight</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Healthy range</p>
            </div>
          </div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {idealWeight.min.toFixed(1)} - {idealWeight.max.toFixed(1)}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {unit === 'metric' ? 'kg' : 'lbs'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-xl p-6 border border-teal-200 dark:border-teal-800"
        >
         <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center">
              <SafeIcon icon={FiTrendingUp} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Weight Status</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Health indicator</p>
            </div>
          </div>
          <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
            {parseFloat(weight.toString()) > idealWeight.max ? 'Above Ideal' : 
             parseFloat(weight.toString()) < idealWeight.min ? 'Below Ideal' : 'Within Range'}
          </div>
        </motion.div>
      </div>
      
      {/* Category Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700"
      >
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
          BMI Categories
        </h3>
        <div className="space-y-3">
          {bmiRanges.map((range, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-700">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded ${range.color}`}></div>
                <span className="font-medium text-neutral-900 dark:text-white">{range.category}</span>
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{range.range}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default BMICalculator;