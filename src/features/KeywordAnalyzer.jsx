// src/features/KeywordAnalyzer.jsx
// Keyword density visualization and analysis component

import { useMemo } from "react";
import { TrendingUp, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { useKeywordAnalysis } from "../hooks/useKeywordAnalysis.js";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/cn.js";

const KeywordBar = ({ keyword, count, score, maxScore, variant = "default", isLoading = false }) => {
  // Calculate percentage based on count relative to max, capped at 100%
  const percentage = maxScore > 0 ? Math.min((count / maxScore) * 100, 100) : 0;
  // Display score capped at 100%
  const displayScore = Math.min(score, 100);

  const colors = {
    default: "bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-500",
    matched: "bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500",
    missing: "bg-gradient-to-r from-rose-400 via-pink-500 to-orange-400",
    emphasis: "bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500"
  };

  const glowColors = {
    default: "shadow-[0_0_12px_rgba(20,184,166,0.4)]",
    matched: "shadow-[0_0_12px_rgba(34,197,94,0.4)]",
    missing: "shadow-[0_0_12px_rgba(244,63,94,0.4)]",
    emphasis: "shadow-[0_0_12px_rgba(139,92,246,0.4)]"
  };

  return (
    <div className="group flex items-center gap-4 py-2.5 px-3 rounded-xl transition-all duration-300 hover:bg-white/5 dark:hover:bg-white/5">
      <div className="w-28 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate block">
          {keyword}
        </span>
      </div>
      <div className="flex-1 relative h-7 bg-gray-200/50 dark:bg-gray-800/80 rounded-full overflow-hidden backdrop-blur-sm border border-gray-300/30 dark:border-gray-600/30">
        {/* Animated shimmer background */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
        {/* Progress bar with glow effect */}
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out relative",
            colors[variant],
            glowColors[variant],
            "after:absolute after:inset-0 after:bg-gradient-to-t after:from-transparent after:via-white/20 after:to-white/30 after:rounded-full"
          )}
          style={{
            width: `${percentage}%`,
            animation: 'growBar 0.8s ease-out'
          }}
        />
      </div>
      <div className="w-24 text-right flex items-center justify-end gap-1.5">
        <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100/80 dark:bg-gray-700/80 px-2 py-0.5 rounded-md">
          {count}×
        </span>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-md",
          displayScore >= 70 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
            displayScore >= 40 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
              "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
        )}>
          {displayScore}%
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
        <span className="ml-auto text-sm text-gray-600 dark:text-gray-200">
          {keywords.length} keywords
        </span>
      </div>

      {keywords.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-200 italic">{emptyMessage}</p>
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
    ? "text-emerald-600 dark:text-emerald-400"
    : overallMatch >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <Card className="p-6 border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)] backdrop-blur-soft shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg shadow-sm border border-emerald-500/20">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Keyword Analysis</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Based on job description frequency</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Match Score</span>
          <span className={cn("text-3xl font-bold tracking-tight", matchColor)}>
            {overallMatch}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Missing Keywords */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <h4 className="font-bold text-base text-gray-900 dark:text-white">Critical Gaps</h4>
            </div>
            <span className="text-sm font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full">
              {toAdd?.length || 0}
            </span>
          </div>

          <div className="rounded-xl p-3 min-h-[120px]">
            {toAdd && toAdd.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {toAdd.slice(0, 8).map((kw, idx) => (
                  <span
                    key={idx}
                    className="group relative inline-flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-600 dark:text-rose-300 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-300 hover:shadow-md hover:-translate-y-0.5 cursor-help"
                    title={kw.reason}
                  >
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    {kw.term}
                  </span>
                ))}
                {toAdd.length > 8 && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    +{toAdd.length - 8} more
                  </span>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
                <p className="text-xs text-gray-500">No critical gaps found</p>
              </div>
            )}
          </div>
        </div>

        {/* Need Emphasis */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-base text-gray-900 dark:text-white">Boost Frequency</h4>
            </div>
            <span className="text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full">
              {needEmphasis?.length || 0}
            </span>
          </div>

          <div className="rounded-xl p-3 min-h-[120px]">
            {needEmphasis && needEmphasis.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {needEmphasis.slice(0, 8).map((kw, idx) => (
                  <span
                    key={idx}
                    className="group relative inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-600 dark:text-amber-300 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-300 hover:shadow-md hover:-translate-y-0.5 cursor-help"
                    title={`Increase from ${kw.resumeCount} to ${kw.jobCount} mentions`}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    {kw.term}
                    <span className="ml-1.5 opacity-70 text-xs">{kw.resumeCount}→{kw.jobCount}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
                <p className="text-xs text-gray-500">Frequency looks good</p>
              </div>
            )}
          </div>
        </div>

        {/* Well Represented */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h4 className="font-bold text-base text-gray-900 dark:text-white">Your Strengths</h4>
            </div>
            <span className="text-sm font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full">
              {wellRepresented?.length || 0}
            </span>
          </div>

          <div className="rounded-xl p-3 min-h-[120px]">
            {wellRepresented && wellRepresented.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {wellRepresented.slice(0, 8).map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {kw.term}
                  </span>
                ))}
                {wellRepresented.length > 8 && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                    +{wellRepresented.length - 8} more
                  </span>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-2">
                <p className="text-xs text-gray-500">No strong matches yet</p>
              </div>
            )}
          </div>
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400"></div>
            <p className="text-gray-700 dark:text-gray-200">Analyzing keywords...</p>
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
              <p className="text-sm text-gray-700 dark:text-gray-200">Resume Words</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.resume?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200">Unique Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.resume?.uniqueWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200">Job Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.job?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200">Match Rate</p>
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
