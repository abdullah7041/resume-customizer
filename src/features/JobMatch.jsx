// src/features/JobMatch.jsx
import React, { useState } from "react";
import { Target, TrendingUp, AlertCircle, ChevronRight, Sparkles, Lock, Download, Share2 } from "lucide-react";

// FIXED: Added the .jsx file extension to make the import path explicit.
import { ScoreDisplay, SkillTag } from "../components/shared/CommonComponents.jsx";

const PremiumFeature = ({ title, description, icon }) => (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-2 right-2"><Lock className="w-5 h-5 text-purple-600" /></div>
        <div className="flex items-start space-x-4">
            <div className="text-purple-600">{icon}</div>
            <div>
                <h4 className="font-bold text-gray-800 mb-1">{title}</h4>
                <p className="text-gray-600 text-sm">{description}</p>
            </div>
        </div>
    </div>
);

const JobMatch = ({ onAnalyzeMatch, matchAnalysis, isPremium, onSwitchTab }) => {
    const [jobDescription, setJobDescription] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAnalyzeMatch(jobDescription);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit}>
                <label className="block text-lg font-semibold text-gray-800 mb-4">💼 Job Description</label>
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full h-48 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 resize-none"
                    placeholder="Paste the complete job description here..."
                />
                <button
                    type="submit"
                    className="w-full mt-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                    <Target className="inline mr-2" />
                    Analyze Match Score
                </button>
            </form>

            {matchAnalysis && (
                <div className="space-y-6">
                    <ScoreDisplay score={matchAnalysis.compliance_score || 0} />
                    <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-purple-600" /> Skills Analysis</h3>
                        <div className="flex flex-wrap">
                            {matchAnalysis.skills_match?.map((skill, idx) => <SkillTag key={idx} skill={skill.skill} matched={skill.matched} />)}
                        </div>
                    </div>
                    
                    {!isPremium && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 text-center mb-4">🔒 Unlock Premium to Continue</h3>
                             <PremiumFeature icon={<Sparkles className="w-6 h-6" />} title="Auto-Optimize All Sections" description="AI automatically rewrites weak sections for maximum impact" />
                             <PremiumFeature icon={<Download className="w-6 h-6" />} title="Professional PDF Export" description="Generate ATS-friendly PDFs with optimized formatting" />
                        </div>
                    )}
                     {isPremium && (
                      <button
                        onClick={() => onSwitchTab('optimize')}
                        className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Sparkles className="inline mr-2" />
                        Proceed to Auto-Optimization
                      </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default JobMatch;

