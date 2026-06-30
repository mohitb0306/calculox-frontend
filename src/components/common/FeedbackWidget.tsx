"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiMessageCircle, FiX, FiSend, FiSmile, FiMeh, FiFrown } = FiIcons;

const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toast.error('Please enter your feedback');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      toast.success('Thank you for your feedback!');
      setFeedback('');
      setEmail('');
      setSentiment(null);
      setIsSubmitting(false);
      setIsOpen(false);
    }, 1000);
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-40 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <SafeIcon icon={FiMessageCircle} className="w-5 h-5 text-indigo-500" />
        <span className="text-sm font-medium">Feedback</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)} // Close when clicking backdrop
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()} // Prevent close when clicking content
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-indigo-500 to-violet-600">
                <h3 className="text-lg font-semibold text-white">Share Your Feedback</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full"
                >
                  <SafeIcon icon={FiX} className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-6">
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
                    How was your experience using CalcPro? Your feedback helps us improve.
                  </p>

                  {/* Sentiment Selection */}
                  <div className="flex justify-center space-x-6 mb-6">
                    {[
                      { value: 'positive', icon: FiSmile, label: 'Good', color: 'text-green-500 border-green-500' },
                      { value: 'neutral', icon: FiMeh, label: 'Okay', color: 'text-yellow-500 border-yellow-500' },
                      { value: 'negative', icon: FiFrown, label: 'Bad', color: 'text-red-500 border-red-500' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSentiment(option.value)}
                        className={`flex flex-col items-center space-y-2 p-3 rounded-lg transition-all ${
                          sentiment === option.value
                            ? `border-2 ${option.color} bg-white dark:bg-neutral-700`
                            : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <SafeIcon
                          icon={option.icon}
                          className={`w-8 h-8 ${sentiment === option.value ? option.color : 'text-neutral-400'}`}
                        />
                        <span className={`text-sm ${
                          sentiment === option.value
                            ? option.color
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Feedback Text */}
                  <div className="mb-4">
                    <label htmlFor="feedback" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Your Feedback
                    </label>
                    <textarea
                      id="feedback"
                      rows={4}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Tell us what you liked or how we can improve..."
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white resize-none outline-none"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="mb-6">
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white outline-none"
                    />
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      We'll email you if we need more information.
                    </p>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 mr-3 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !feedback.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-lg hover:from-indigo-600 hover:to-violet-700 transition-all duration-200 font-medium flex items-center space-x-2 disabled:opacity-70 text-sm"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <SafeIcon icon={FiSend} className="w-4 h-4" />
                        <span>Send Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FeedbackWidget;