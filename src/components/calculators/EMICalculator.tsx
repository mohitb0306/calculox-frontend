"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiInfo, FiTrendingUp, FiDollarSign } = FiIcons;

interface EMICalculatorProps {
  onCalculationComplete?: () => void;
}

const EMICalculator: React.FC<EMICalculatorProps> = ({ onCalculationComplete }) => {
  const [loanAmount, setLoanAmount] = useState<number | string>(500000);
  const [interestRate, setInterestRate] = useState<number | string>(8.5);
  const [loanTenure, setLoanTenure] = useState<number | string>(20);
  const [results, setResults] = useState({
    emi: 0,
    totalInterest: 0,
    totalAmount: 0,
  });

  useEffect(() => {
    const principal = parseFloat(loanAmount.toString());
    const rate = parseFloat(interestRate.toString()) / 100 / 12;
    const tenure = parseFloat(loanTenure.toString()) * 12;

    if (principal > 0 && rate > 0 && tenure > 0) {
      const emiAmount = (principal * rate * Math.pow(1 + rate, tenure)) / (Math.pow(1 + rate, tenure) - 1);
      const totalAmountPayable = emiAmount * tenure;
      const totalInterestPayable = totalAmountPayable - principal;

      setResults({
        emi: emiAmount,
        totalInterest: totalInterestPayable,
        totalAmount: totalAmountPayable,
      });
      
      if (onCalculationComplete) {
        onCalculationComplete();
      }

    } else {
      setResults({ emi: 0, totalInterest: 0, totalAmount: 0 });
    }
  }, [loanAmount, interestRate, loanTenure, onCalculationComplete]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const generateAmortizationData = () => {
    const data = [];
    let remainingBalance = parseFloat(loanAmount.toString());
    const monthlyRate = parseFloat(interestRate.toString()) / 100 / 12;
    const tenureMonths = parseFloat(loanTenure.toString()) * 12;
    if (!remainingBalance || !monthlyRate || !tenureMonths || !results.emi) return [];
    
    // Generate data points (limited to 30 points to keep chart clean)
    const step = Math.ceil(tenureMonths / 30);
    
    for (let i = 1; i <= tenureMonths; i++) {
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = results.emi - interestPayment;
      remainingBalance -= principalPayment;
      
      // Only push data points based on step or last month
      if (i % step === 0 || i === tenureMonths) {
        data.push({
          year: Math.round(i / 12 * 10) / 10, // Convert months to years
          principal: parseFloat(loanAmount.toString()) - (remainingBalance > 0 ? remainingBalance : 0),
          interest: (results.emi * i) - (parseFloat(loanAmount.toString()) - (remainingBalance > 0 ? remainingBalance : 0)),
          balance: Math.max(0, remainingBalance)
        });
      }
    }
    
    return data;
  };

  const pieData = [
    { name: 'Principal', value: parseFloat(loanAmount.toString()), color: '#3B82F6' },
    { name: 'Interest', value: results.totalInterest, color: '#EF4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Loan Amount
          </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            placeholder="Enter loan amount"
          />
          <input
            type="range"
            min="100000"
            max="10000000"
            step="50000"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            className="w-full mt-2 accent-blue-600"
          />
          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            <span>₹1L</span>
            <span>₹1Cr</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Interest Rate (% per annum)
          </label>
          <input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            step="0.1"
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            placeholder="Enter interest rate"
          />
          <input
            type="range"
            min="1"
            max="20"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="w-full mt-2 accent-blue-600"
          />
          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            <span>1%</span>
            <span>20%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Loan Tenure (Years)
          </label>
          <input
            type="number"
            value={loanTenure}
            onChange={(e) => setLoanTenure(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
            placeholder="Enter loan tenure"
          />
          <input
            type="range"
            min="1"
            max="30"
            value={loanTenure}
            onChange={(e) => setLoanTenure(e.target.value)}
            className="w-full mt-2 accent-blue-600"
          />
          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            <span>1 Year</span>
            <span>30 Years</span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <SafeIcon icon={FiDollarSign} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Monthly EMI</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Amount to pay monthly</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(results.emi)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border border-green-200 dark:border-green-800"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <SafeIcon icon={FiTrendingUp} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Total Interest</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Interest over tenure</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(results.totalInterest)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
               <SafeIcon icon={FiInfo} className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Total Amount</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total payable amount</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(results.totalAmount)}
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700"
        >
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Principal vs Interest Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => formatCurrency(Number(value))}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center space-x-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Principal</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Interest</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700"
        >
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Amortization Schedule
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={generateAmortizationData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="year" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#6B7280', fontSize: 12}} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#6B7280', fontSize: 12}} 
                tickFormatter={(val) => `${(val/100000).toFixed(0)}L`}
              />
              <Tooltip 
                formatter={(value: any) => formatCurrency(Number(value))} 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line type="monotone" dataKey="principal" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Principal Paid" />
              <Line type="monotone" dataKey="interest" stroke="#EF4444" strokeWidth={3} dot={false} name="Interest Paid" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
};

export default EMICalculator;