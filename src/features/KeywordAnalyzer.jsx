// src/features/KeywordAnalyzer.jsx
// Keyword density visualization and analysis component

import { useMemo } from "react";
import { TrendingUp, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { useKeywordAnalysis } from "../hooks/useKeywordAnalysis.js";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/cn.js";

const KeywordBar = ({ keyword, count, score, maxScore, variant = "default" }) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  
  const colors = {
    default: "bg-gradient-to-r from-emerald-500 to-teal-600",
    matched: "bg-gradient-to-r from-green-500 to-emerald-600",
    missing: "bg-gradient-to-r from-amber-500 to-orange-600",
    emphasis: "bg-gradient-to-r from-blue-500 to-cyan-600"
  };
  
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
        {keyword}
      </div>
      <div className="flex-1 relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 rounded-full", colors[variant])}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="w-20 text-right">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {count}×
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          ({score}%)
        </span>
      </div>
    </div>
  );
};

const KeywordSection = ({ title, icon: Icon, keywords, variant = "default", emptyMessage }) => {
  const maxScore = keywords.length > 0 ? Math.max(...keywords.map(k => k.score || k.count)) : 0;
  
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {keywords.length} keywords
        </span>
      </div>
      
      {keywords.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {keywords.map((kw, idx) => (
            <KeywordBar
              key={`${kw.term}-${idx}`}
              keyword={kw.term}
              count={kw.count || kw.resumeCount || 0}
              score={kw.score || Math.round((kw.count / maxScore) * 100)}
              maxScore={maxScore}
              variant={variant}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

const SuggestionCard = ({ suggestions }) => {
  const { toAdd, needEmphasis, wellRepresented, overallMatch } = suggestions || {};
  
  const matchColor = overallMatch >= 70 
    ? "text-green-600 dark:text-green-400" 
    : overallMatch >= 50 
    ? "text-amber-600 dark:text-amber-400" 
    : "text-orange-600 dark:text-orange-400";
  
  return (
    <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-750 border-emerald-200 dark:border-emerald-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Match</h3>
        </div>
        <div className={cn("text-3xl font-bold", matchColor)}>
          {overallMatch}%
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Missing Keywords</h4>
          </div>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">
            {toAdd?.length || 0}
          </p>
          {toAdd && toAdd.length > 0 && (
            <ul className="space-y-1">
              {toAdd.slice(0, 5).map((kw, idx) => (
                <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                  • {kw.term} <span className="text-orange-500">({kw.priority})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Need Emphasis</h4>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {needEmphasis?.length || 0}
          </p>
          {needEmphasis && needEmphasis.length > 0 && (
            <ul className="space-y-1">
              {needEmphasis.slice(0, 5).map((kw, idx) => (
                <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                  • {kw.term} <span className="text-blue-500">({kw.resumeCount}→{kw.jobCount})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Well Represented</h4>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
            {wellRepresented?.length || 0}
          </p>
          {wellRepresented && wellRepresented.length > 0 && (
            <ul className="space-y-1">
              {wellRepresented.slice(0, 5).map((kw, idx) => (
                <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                  • {kw.term} <span className="text-green-500">({kw.resumeCount}×)</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};

export default function KeywordAnalyzer({ resumeText, jobDescription }) {
  const { analysis, isAnalyzing, hasData } = useKeywordAnalysis(
    resumeText || "",
    jobDescription || "",
    { enabled: Boolean(resumeText && jobDescription) }
  );
  
  const isEmpty = !resumeText || !jobDescription;
  
  const topResumeKeywords = useMemo(() => {
    return analysis?.resume?.keywords || [];
  }, [analysis]);
  
  const topJobKeywords = useMemo(() => {
    return analysis?.job?.keywords || [];
  }, [analysis]);
  
  const matchedKeywords = useMemo(() => {
    return analysis?.tfidf?.matchedKeywords || [];
  }, [analysis]);
  
  const missingKeywords = useMemo(() => {
    return analysis?.tfidf?.missingKeywords || [];
  }, [analysis]);
  
  if (isEmpty) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <EmptyState
          icon={TrendingUp}
          title="No Data Available"
          description="Upload your resume and add a job description to analyze keyword density and match score."
        />
      </div>
    );
  }
  
  if (isAnalyzing && !hasData) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
            <p className="text-gray-600 dark:text-gray-400">Analyzing keywords...</p>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Match Overview */}
      {analysis?.suggestions && (
        <SuggestionCard suggestions={analysis.suggestions} />
      )}
      
      {/* Matched Keywords */}
      {matchedKeywords.length > 0 && (
        <KeywordSection
          title="Matched Keywords"
          icon={CheckCircle2}
          keywords={matchedKeywords}
          variant="matched"
          emptyMessage="No matching keywords found between resume and job description."
        />
      )}
      
      {/* Missing Keywords */}
      {missingKeywords.length > 0 && (
        <KeywordSection
          title="Missing Keywords (Add These)"
          icon={AlertCircle}
          keywords={missingKeywords}
          variant="missing"
          emptyMessage="Great! Your resume includes all important keywords from the job description."
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resume Keywords */}
        <KeywordSection
          title="Top Resume Keywords"
          icon={TrendingUp}
          keywords={topResumeKeywords}
          variant="default"
          emptyMessage="No keywords extracted from resume."
        />
        
        {/* Job Keywords */}
        <KeywordSection
          title="Top Job Keywords"
          icon={Target}
          keywords={topJobKeywords}
          variant="default"
          emptyMessage="No keywords extracted from job description."
        />
      </div>
      
      {/* Stats Footer */}
      {analysis && (
        <Card className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Resume Words</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.resume?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unique Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.resume?.uniqueWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Job Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.job?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Match Rate</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {analysis.tfidf?.overallMatch || 0}%
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
