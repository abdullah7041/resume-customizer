// src/components/Features/JobMatch.jsx
import React, { useState } from 'react';
import { Target, TrendingUp, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
// CORRECTED: This import now points to a real file.
import { ScoreDisplay, SkillTag } from '../shared/CommonComponents';

/**
 * A component for the "Match" tab.
 * It handles job description input and displays the analysis results.
 *
 * @param {object} props
 * @param {Function} props.onAnalyzeMatch - Function from parent to trigger analysis.
 * @param {object|null} props.matchAnalysis - The analysis result from parent.
 * @param {boolean} props.isPremium - User's premium status.
 * @param {Function} props.onSwitchTab - Function to change the active tab.
 */
const JobMatch = ({ onAnalyzeMatch, matchAnalysis, isPremium, onSwitchTab }) => {
  const [jobDescription, setJobDescription] = useState('');

  const handleAnalyze = () => {
    if (!jobDescription.trim()) {
      // In a real app, we'd use a notification system instead of alert().
      alert('Please paste the job description.');
      return;
    }
    onAnalyzeMatch(jobDescription);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-lg font-semibold text-gray-800 mb-4">
          💼 Job Description
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          className="w-full h-48 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none"
          placeholder="Paste the complete job description here..."
        />
      </div>

      <button
        onClick={handleAnalyze}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
        disabled={!jobDescription.trim()}
      >
        <Target className="inline mr-2" />
        Analyze Match Score
      </button>

      {matchAnalysis && (
        <div className="space-y-6">
          <ScoreDisplay score={matchAnalysis.compliance_score || 0} />

          <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              Skills Analysis
            </h3>
            <div className="space-y-2">
              {matchAnalysis.skills_match?.map((skill, idx) => (
                <SkillTag key={idx} skill={skill.skill} matched={skill.matched} />
              ))}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-purple-600" />
              Improvement Suggestions
            </h3>
            <ul className="space-y-3">
              {matchAnalysis.phrasing_tips?.map((tip, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <ChevronRight className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
          
          {isPremium && (
             <button
              onClick={() => onSwitchTab('optimize')} 
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Sparkles className="inline mr-2" />
              Proceed to Optimization
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default JobMatch;

