"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiCheck, FiX, FiStar } = FiIcons;

const PricingClient = () => {
  const plans = [
    {
      name: 'Free',
      price: '0',
      description: 'Basic access for personal use',
      features: [
        { name: 'Access to 5 basic calculators', included: true },
        { name: 'Standard calculation speed', included: true },
        { name: 'Save up to 5 calculations', included: true },
        { name: 'Email support', included: false },
        { name: 'Ad-free experience', included: false },
      ],
      cta: 'Get Started',
      popular: false,
      color: 'from-neutral-500 to-neutral-600',
    },
    {
      name: 'Pro',
      price: '9.99',
      description: 'Perfect for professionals',
      features: [
        { name: 'Access to all calculators', included: true },
        { name: 'Enhanced calculation speed', included: true },
        { name: 'Unlimited saved calculations', included: true },
        { name: 'Email support', included: true },
        { name: 'Ad-free experience', included: true },
      ],
      cta: 'Start Free Trial',
      popular: true,
      color: 'from-primary-500 to-primary-600',
    },
    {
      name: 'Enterprise',
      price: '29.99',
      description: 'For teams and businesses',
      features: [
        { name: 'Access to all calculators', included: true },
        { name: 'Maximum calculation speed', included: true },
        { name: 'Unlimited saved calculations', included: true },
        { name: 'Priority email support', included: true },
        { name: 'Ad-free experience', included: true },
      ],
      cta: 'Contact Sales',
      popular: false,
      color: 'from-violet-500 to-violet-600',
    },
  ];

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 py-20 min-h-screen font-inter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400">
            Choose the plan that best suits your needs. All plans include access to our core features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`relative bg-white dark:bg-neutral-800 rounded-xl shadow-lg overflow-hidden border ${
                plan.popular 
                  ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/20' 
                  : 'border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg flex items-center space-x-1 shadow-sm">
                    <SafeIcon icon={FiStar} className="w-3 h-3" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">${plan.price}</span>
                  <span className="text-neutral-600 dark:text-neutral-400 ml-1 font-medium">/month</span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">{plan.description}</p>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature.name} className="flex items-start">
                      {feature.included ? (
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                          <SafeIcon icon={FiCheck} className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-400 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                          <SafeIcon icon={FiX} className="w-3 h-3" />
                        </div>
                      )}
                      <span
                        className={`text-sm ${
                          feature.included
                            ? 'text-neutral-700 dark:text-neutral-300'
                            : 'text-neutral-400 dark:text-neutral-500 line-through decoration-neutral-300'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className={`w-full block text-center py-3 rounded-xl font-bold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/20'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 md:p-12 text-center text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to perform calculations like a pro?</h2>
            <p className="text-indigo-100 mb-8 max-w-2xl mx-auto text-lg">
              Join thousands of users who trust Calculox for their financial, health, and business needs.
              Try it free for 14 days.
            </p>
            <Link
              href="/register"
              className="inline-block bg-white text-indigo-700 px-8 py-3.5 rounded-xl hover:bg-indigo-50 transition-all duration-200 font-bold shadow-lg transform hover:-translate-y-0.5"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingClient;