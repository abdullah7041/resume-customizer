// src/components/shared/CommonComponents.jsx
import React from 'react';

/**
 * A reusable component to display the resume-to-job match score.
 * It dynamically changes color based on the score.
 */
export const ScoreDisplay = ({ score }) => {
  const getColorClass = () => {
    if (score >= 85) return 'from-green-500 to-emerald-600';
    if (score >= 70) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getDescription = () => {
    if (score >= 85) return 'Excellent Match! 🎉';
    if (score >= 70) return 'Good Match! 👍';
    return 'Needs Improvement 📈';
  };

  return (
    <div className={`bg-gradient-to-br ${getColorClass()} text-white p-8 rounded-2xl shadow-2xl text-center relative overflow-hidden`}>
      <div className="absolute inset-0 bg-white/10 animate-pulse" />
      <div className="relative z-10">
        <div className="text-6xl font-bold mb-2">{score}</div>
        <div className="text-xl opacity-95">{getDescription()}</div>
      </div>
    </div>
  );
};

/**
 * A reusable component for displaying a skill tag.
 * It shows whether a skill from the job description was found in the resume.
 */
export const SkillTag = ({ skill, matched = false }) => (
  <span className={`
    inline-block px-3 py-1 rounded-lg text-sm font-medium m-1
    ${matched 
      ? 'bg-green-100 text-green-800 border border-green-300' 
      : 'bg-gray-100 text-gray-700 border border-gray-300'
    }
  `}>
    {skill}
  </span>
);
