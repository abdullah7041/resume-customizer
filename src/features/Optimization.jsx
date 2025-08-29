// src/components/Features/Optimization.jsx
import React, { useState } from 'react';
import { Sparkles, Lock, Check, Download, Share2 } from 'lucide-react';
// We'll need to import OptimizationCard later
// import OptimizationCard from '../shared/OptimizationCard';

/**
 * A component for the "Optimize" tab.
 * It displays premium upsells and optimization results.
 *
 * @param {object} props
 * @param {boolean} props.isPremium - User's premium status.
 * @param {Function} props.onUpgrade - Function to handle the upgrade action.
 * @param {Function} props.onOptimize - Function from parent to trigger optimization.
 * @param {Array} props.optimizations - List of optimization suggestions.
 */
const Optimization = ({ isPremium, onUpgrade, onOptimize, optimizations }) => {
  const [optimizationMode, setOptimizationMode] = useState('auto');
  const [selectedSection, setSelectedSection] = useState('summary');

  if (!isPremium) {
    return (
      <div className="text-center py-12">
        <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Premium Feature</h3>
        <p className="text-gray-600 mb-6">Unlock AI-powered optimization to transform your resume</p>
        <button
          onClick={onUpgrade}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Upgrade to Premium
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-purple-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          🎯 AI Auto-Optimization Engine
        </h3>
        <p className="text-gray-600">
          The AI will identify and improve weak sections of your resume based on the job match analysis. Choose a mode below to begin.
        </p>
      </div>

      <select
        value={optimizationMode}
        onChange={(e) => setOptimizationMode(e.target.value)}
        className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200"
      >
        <option value="auto">🤖 Automatic (AI decides what to optimize)</option>
        <option value="manual">✋ Manual (Choose a specific section)</option>
      </select>

      {optimizationMode === 'manual' && (
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200"
        >
          <option value="summary">📝 Professional Summary</option>
          <option value="experience">💼 Work Experience</option>
          <option value="skills">🛠️ Skills</option>
          <option value="education">🎓 Education</option>
        </select>
      )}

      <button
        onClick={() => onOptimize(optimizationMode, selectedSection)}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Sparkles className="inline mr-2" />
        Start AI Optimization
      </button>

      {optimizations.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-800">✨ Optimization Results</h3>
          {/* We will map over OptimizationCard components here */}
          <p className="text-center text-gray-500">[Optimization cards will be displayed here]</p>
          
          <div className="flex space-x-4">
            <button className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl">
              <Check className="inline mr-2" /> Accept All
            </button>
            <button className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl">
              <Download className="inline mr-2" /> Export PDF
            </button>
          </div>
           <button className="w-full py-3 bg-white border-2 border-purple-300 text-purple-700 font-semibold rounded-xl">
              <Share2 className="inline mr-2" /> Share Link
            </button>
        </div>
      )}
    </div>
  );
};

export default Optimization;
