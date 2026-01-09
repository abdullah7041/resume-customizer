import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
  Zap,
  Wrench,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import Tooltip from '../ui/Tooltip';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { analyzeVision2030Alignment, Vision2030Analysis } from '../../lib/utils/vision2030Analyzer';
import Vision2030Modal from '../ui/Vision2030Modal';
import { MatchSkeleton } from './MatchSection.skeleton';
import { SectorIcon } from '../../lib/utils/vision2030Icons';
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';

// === EXTRACTED FROM features/JobMatch.tsx ===
const resolveVariant = (score: number) => {
  if (score >= 70) {
    return {
      gradient: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      glow: "bg-emerald-500/20",
      strokeStart: "#10B981",
      strokeEnd: "#34D399",
      label: "Strong Match",
      labelAr: "تطابق قوي",
      icon: Target,
      text: "text-emerald-400"
    };
  }
  if (score >= 40) {
    return {
      gradient: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
      glow: "bg-amber-500/20",
      strokeStart: "#F59E0B",
      strokeEnd: "#FBBF24",
      label: "Good Start",
      labelAr: "بداية جيدة",
      icon: Zap,
      text: "text-amber-400"
    };
  }
  return {
    gradient: "from-rose-500/20 via-rose-500/10 to-rose-500/5",
    glow: "bg-rose-500/20",
    strokeStart: "#F43F5E",
    strokeEnd: "#FB7185",
    label: "Needs Work",
    labelAr: "يحتاج تحسين",
    icon: Wrench,
    text: "text-rose-400"
  };
};

const LAST_JOB_KEY = "airo:lastJobDescription";
const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface MatchResult {
  score: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  topHits?: string[];
  suggestions?: string[];
  reasoning?: string;
  categoryScores?: {
    hard_skills: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
    experience: { score: number; max: number; matched?: string[]; gaps?: string[]; reasoning?: string };
    education: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
    soft_skills: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
  } | null;
  gapAnalysis?: GapItem[];
  keywordStrategy?: {
    mirroredPhrases?: string[];
    structuralChanges?: string[];
    hiddenMatches?: HiddenMatch[];
  } | null;
}

interface Toast {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
}

interface MatchSectionProps {
  onAnalyzeMatchAI: (jobDescription: string) => Promise<MatchResult>;
  matchAnalysis: MatchResult | null;
  isAnalyzing?: boolean;
  hasResume?: boolean;
  resumeText?: string;
  onToast?: (toast: Toast) => void;
  onClear?: () => void;
}

export function MatchSection({
  onAnalyzeMatchAI,
  matchAnalysis,
  isAnalyzing = false,
  hasResume = false,
  resumeText = '',
  onToast,
  onClear
}: MatchSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // === STATE FROM features/JobMatch.tsx ===
  const [jobText, setJobText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LAST_JOB_KEY) ?? "";
  });
  const [error, setError] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [v2030Expanded, setV2030Expanded] = useState(false);
  const [v2030ModalOpen, setV2030ModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Persist job description to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobText && jobText.trim().length > 0) {
      window.localStorage.setItem(LAST_JOB_KEY, jobText);
    } else {
      window.localStorage.removeItem(LAST_JOB_KEY);
    }
  }, [jobText]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!whyOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (
        !popoverRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setWhyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [whyOpen]);

  const handleAnalyze = async () => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = t('sections.match.errors.noJob', 'Paste the job description before analyzing.');
      setError(message);
      onToast?.({
        type: "warning",
        title: t('sections.match.errors.jobNeeded', 'Job description needed'),
        description: message,
      });
      return;
    }
    setError("");
    try {
      const result = await onAnalyzeMatchAI(trimmedJob);
      // Track match analysis run
      if (result && typeof result.score === 'number') {
        analytics.trackMatchAnalysis(result.score);
      }
    } catch (err) {
      setError((err as Error)?.message || t('sections.match.errors.analyzeFailed', 'We could not analyze this match.'));
    }
  };

  // Computed values
  const hasResults = Boolean(matchAnalysis);
  const rawScore = Number.isFinite(matchAnalysis?.score) ? matchAnalysis!.score : null;
  const score = rawScore != null ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
  const variant = resolveVariant(score ?? 0);
  const progress = score == null ? 0 : Math.max(0, Math.min(100, score));
  const ringOffset = useMemo(
    () => RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE,
    [progress]
  );
  const missing = matchAnalysis?.missingKeywords?.slice(0, 6) ?? [];
  const hits = matchAnalysis?.topHits?.slice(0, 6) ?? [];

  // Vision 2030 analysis - compute when resume text and results are available
  const v2030Analysis = useMemo<Vision2030Analysis | null>(() => {
    if (!resumeText || !hasResults) return null;
    return analyzeVision2030Alignment(resumeText, isArabic ? 'ar' : 'en');
  }, [resumeText, hasResults, isArabic]);

  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? t('sections.match.hints.uploadFirst', 'Upload or paste your resume first.')
    : !jobText.trim()
      ? t('sections.match.hints.pasteJob', 'Paste a job description to continue.')
      : "";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <GlassCard variant="elevated">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <GlassCircle size="md" variant="success">
                <Target className="w-5 h-5 text-emerald-400" />
              </GlassCircle>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t('sections.match.jobInput.title', 'Match a Role')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('sections.match.subtitle', 'Paste the job description to uncover keyword gaps')}
                </p>
              </div>
            </div>
            {jobText && (
              <button
                onClick={() => {
                  setJobText("");
                  onClear?.();
                }}
                className="text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>

          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={t('sections.match.jobInput.placeholder', 'Paste the job description here...')}
            className={cn(
              'w-full h-64 p-4 rounded-xl resize-none mb-4',
              'bg-white/5 border border-white/10',
              'text-white placeholder-gray-500',
              'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
              'transition-all',
              error && 'border-red-500/50'
            )}
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* No Resume Warning */}
          {!hasResume && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-400">{t('sections.match.noResume', 'Upload your resume first')}</p>
            </div>
          )}

          <GlassButton
            onClick={handleAnalyze}
            disabled={buttonDisabled}
            isLoading={isAnalyzing}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 me-2" />
            {isAnalyzing ? t('sections.match.analyzing', 'Analyzing...') : t('sections.match.analyze', 'Analyze Match with AI')}
          </GlassButton>

          {disabledHint && (
            <p className="text-xs text-gray-500 mt-2 text-center">{disabledHint}</p>
          )}
        </GlassCard>

        {/* Results Section */}
        <GlassCard variant="elevated">
          <div className="flex items-center gap-3 mb-6">
            <GlassCircle size="md" variant="blue">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </GlassCircle>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.match.results.title', 'Match Results')}
            </h3>
          </div>

          {isAnalyzing ? (
            <MatchSkeleton />
          ) : hasResults && score !== null ? (
            <div className="space-y-5">
              {/* Score Ring Display */}
              <div className="relative rounded-2xl overflow-hidden">
                {/* Background gradient */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br',
                  variant.gradient
                )}>
                  <div className={cn('absolute inset-0 opacity-40 blur-3xl', variant.glow)} />
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 text-white">
                  <div className="flex flex-col items-center gap-4">
                    {/* SVG Ring */}
                    <div className="relative h-32 w-32">
                      <div className={cn('absolute inset-0 rounded-full blur-2xl opacity-40', variant.glow)} />
                      <svg
                        className="absolute inset-0 h-full w-full rotate-[-90deg]"
                        viewBox="0 0 120 120"
                      >
                        <defs>
                          <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={variant.strokeStart} />
                            <stop offset="100%" stopColor={variant.strokeEnd} />
                          </linearGradient>
                          <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <circle
                          cx="60"
                          cy="60"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-white/10"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="url(#score-gradient)"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={RING_CIRCUMFERENCE}
                          strokeDashoffset={ringOffset}
                          filter="url(#glow-shadow)"
                          className="transition-[stroke-dashoffset] duration-1000 ease-out"
                        />
                      </svg>

                      {/* Inner Score */}
                      <div className="absolute inset-4 grid place-items-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md">
                        <div className="flex flex-col items-center justify-center text-center">
                          <variant.icon className="w-5 h-5 mb-1 text-white/90" />
                          <Tooltip
                            content={`${score}/100 - ${isArabic ? variant.labelAr : variant.label}`}
                            position="bottom"
                          >
                            <div className="flex items-baseline gap-0.5 cursor-help">
                              <AnimatedCounter
                                to={score}
                                duration={1500}
                                className="text-4xl font-black text-white"
                              />
                              <span className="text-[10px] font-bold text-white/70">/100</span>
                            </div>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Score Label */}
                    <div className="text-center">
                      <p className={cn('text-sm font-bold uppercase tracking-[0.2em]', variant.text)}>
                        {isArabic ? variant.labelAr : variant.label}
                      </p>
                      <p className="mt-1 text-sm text-white/80">
                        {matchAnalysis?.reasoning || (
                          score >= 70
                            ? t('sections.match.results.strongMessage', 'Your profile is highly aligned with this role.')
                            : score >= 40
                              ? t('sections.match.results.moderateMessage', 'Addressing a few key gaps could boost your chances.')
                              : t('sections.match.results.weakMessage', 'Consider tailoring your experience to the job requirements.')
                        )}
                      </p>
                    </div>

                    {/* Score Breakdown Button */}
                    <button
                      ref={buttonRef}
                      type="button"
                      onClick={() => setWhyOpen(!whyOpen)}
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-all"
                    >
                      <Info className="h-3.5 w-3.5" />
                      {t('sections.match.results.breakdown', 'Score Breakdown')}
                    </button>
                  </div>
                </div>

                {/* Popover - Category Breakdown */}
                {whyOpen && (
                  <div
                    ref={popoverRef}
                    className="absolute left-4 right-4 bottom-4 z-50 rounded-xl border border-white/20 bg-slate-900/95 p-4 backdrop-blur-xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3">
                      {t('sections.match.results.howItWorks', 'Score Breakdown')}
                    </p>
                    {matchAnalysis?.categoryScores ? (
                      <div className="space-y-2">
                        {[
                          { key: 'hard_skills', label: isArabic ? 'المهارات التقنية' : 'Hard Skills', color: 'bg-blue-500' },
                          { key: 'experience', label: isArabic ? 'الخبرة' : 'Experience', color: 'bg-purple-500' },
                          { key: 'education', label: isArabic ? 'التعليم' : 'Education', color: 'bg-amber-500' },
                          { key: 'soft_skills', label: isArabic ? 'المهارات الشخصية' : 'Soft Skills', color: 'bg-emerald-500' }
                        ].map(cat => {
                          const data = matchAnalysis.categoryScores?.[cat.key as keyof typeof matchAnalysis.categoryScores];
                          if (!data) return null;
                          return (
                            <div key={cat.key} className="flex items-center gap-2">
                              <span className="text-xs text-white/70 w-24 truncate">{cat.label}</span>
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${(data.score / data.max) * 100}%` }} />
                              </div>
                              <span className="text-xs text-white/90 w-10 text-end">{data.score}/{data.max}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-white/90">
                        <strong>{t('sections.match.results.coverage', 'Coverage')}</strong> {t('sections.match.results.coverageDesc', 'measures what percentage of key job requirements appear in your resume.')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Missing Keywords */}
              {missing.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    {t('sections.match.results.missing', 'Missing Keywords')} ({missing.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {missing.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-sm border border-rose-500/20 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/20 transition-all cursor-pointer"
                        title={t('sections.match.results.addKeyword', 'Add this keyword to your resume')}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Keywords (Top Hits) */}
              {hits.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('sections.match.results.keywords', 'Recognized Strengths')} ({hits.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {hits.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm border border-emerald-500/20"
                      >
                        <CheckCircle2 className="w-3 h-3 inline me-1" />
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {matchAnalysis?.suggestions && matchAnalysis.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    {t('sections.match.results.suggestions', 'Suggestions')}
                  </h4>
                  <ul className="space-y-2">
                    {matchAnalysis.suggestions.map((suggestion, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gap Analysis Section */}
              {matchAnalysis?.gapAnalysis && matchAnalysis.gapAnalysis.length > 0 && (
                <GapAnalysisCard gaps={matchAnalysis.gapAnalysis} />
              )}

              {/* Hidden Matches - Skills that match using different terminology */}
              {matchAnalysis?.keywordStrategy?.hiddenMatches && matchAnalysis.keywordStrategy.hiddenMatches.length > 0 && (
                <HiddenMatchesCard matches={matchAnalysis.keywordStrategy.hiddenMatches} />
              )}

              {/* Mirrored Keywords - JD phrases injected into optimized content */}
              {matchAnalysis?.keywordStrategy && (
                matchAnalysis.keywordStrategy.mirroredPhrases?.length || matchAnalysis.keywordStrategy.structuralChanges?.length
              ) ? (
                <MirroredKeywordsCard
                  mirroredPhrases={matchAnalysis.keywordStrategy.mirroredPhrases || []}
                  structuralChanges={matchAnalysis.keywordStrategy.structuralChanges || []}
                />
              ) : null}

              {/* Vision 2030 Alignment Section */}
              {v2030Analysis && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setV2030Expanded(!v2030Expanded)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#006C35]/20 to-emerald-500/10 border border-[#006C35]/30 hover:border-[#006C35]/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#006C35' }}>
                        2030
                      </div>
                      <div className="text-start">
                        <h4 className="text-white font-semibold">
                          {t('vision2030.matchSection.title', 'Vision 2030 Alignment')}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {t('vision2030.subtitle', 'How your skills align with Saudi national priorities')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <span className={cn(
                          "text-2xl font-bold",
                          v2030Analysis.overallScore >= 70 ? "text-emerald-400" :
                            v2030Analysis.overallScore >= 40 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {v2030Analysis.overallScore}
                        </span>
                        <span className="text-gray-500 text-sm">/100</span>
                      </div>
                      {v2030Expanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                      )}
                    </div>
                  </button>

                  {v2030Expanded && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Top Sectors */}
                      {v2030Analysis.sectorBreakdown.slice(0, 4).length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-400 mb-2">
                            {t('vision2030.sectorBreakdown', 'Sector Breakdown')}
                          </h5>
                          <div className="grid grid-cols-2 gap-2">
                            {v2030Analysis.sectorBreakdown.slice(0, 4).map((sector) => (
                              <div
                                key={sector.sectorId}
                                className="p-3 rounded-lg bg-white/5 border border-white/10"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-7 h-7 rounded-lg bg-[#006C35]/20 flex items-center justify-center">
                                    <SectorIcon sectorId={sector.sectorId} className="w-4 h-4 text-[#4ade80]" />
                                  </div>
                                  <span className="text-sm text-white truncate">
                                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${sector.score}%`,
                                      backgroundColor: '#006C35'
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {sector.matchedCount}/{sector.totalSkills} {t('vision2030.skills', 'skills')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matched V2030 Skills */}
                      {v2030Analysis.matchedSkills.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-400 mb-2">
                            {t('vision2030.matchedSkills', 'Matched Vision 2030 Skills')}
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {v2030Analysis.matchedSkills.map((skill, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 text-xs rounded-full border"
                                style={{ backgroundColor: 'rgba(0, 108, 53, 0.2)', borderColor: 'rgba(0, 108, 53, 0.5)', color: '#4ade80' }}
                              >
                                {isArabic ? skill.skillNameAr : skill.skillNameEn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Learn More Button */}
                      <button
                        type="button"
                        onClick={() => setV2030ModalOpen(true)}
                        className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-white"
                        style={{ color: '#4ade80' }}
                      >
                        <Info className="w-4 h-4" />
                        {t('vision2030.matchSection.learnMore', 'Learn about Vision 2030')}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('sections.match.emptyState', 'Paste a job description to see match insights here')}</p>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Vision 2030 Info Modal */}
      <Vision2030Modal
        isOpen={v2030ModalOpen}
        onClose={() => setV2030ModalOpen(false)}
      />
    </>
  );
}
