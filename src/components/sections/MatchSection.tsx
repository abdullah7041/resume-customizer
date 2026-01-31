import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { GlassTextarea } from '../ui/GlassTextarea';
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

  Code2,
  Briefcase,
  GraduationCap,
  Users
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import Tooltip from '../ui/Tooltip';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { MatchSkeleton } from './MatchSection.skeleton';
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useFeatureTracking } from '../../hooks/useFeatureTracking';
import { FeedbackModal } from '../Feedback/FeedbackModal';

// === EXTRACTED FROM features/JobMatch.tsx ===
const resolveVariant = (score: number) => {
  if (score >= 70) {
    return {
      gradient: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      glow: "bg-emerald-500/30",
      strokeStart: "#10B981",
      strokeEnd: "#34D399",
      label: "Strong Match",
      labelAr: "تطابق قوي",
      icon: Target,
      text: "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { credits, isLoading: creditsLoading, refetch: refetchCredits } = useUserCredits();
  const { trackFeatureUse, shouldShowFeedback, dismissFeedback } = useFeatureTracking();

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

  const handleAnalyzeActual = async () => {
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
        trackFeatureUse('match'); // Track for feedback prompt

        // Check if we should show feedback modal (with 5-10 second delay for better UX)
        if (shouldShowFeedback) {
          const delay = 5000 + Math.random() * 5000; // Random 5-10 seconds
          setTimeout(() => {
            setShowFeedbackModal(true);
          }, delay);
        }
      }
      // Refresh credits after consumption
      setTimeout(() => refetchCredits(), 500);
    } catch (err) {
      setError((err as Error)?.message || t('sections.match.errors.analyzeFailed', 'We could not analyze this match.'));
    }
  };

  // Wrapper function that shows confirmation modal first
  const handleAnalyze = () => {
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

    // Wait for credits to load before showing modal
    if (creditsLoading) {
      return;
    }

    setShowConfirmModal(true);
  };

  // Handler for confirmed match analysis action
  const handleConfirmMatch = async () => {
    setShowConfirmModal(false);
    await handleAnalyzeActual();
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
        <GlassCard>
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
                className="text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-all"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>

          <GlassTextarea
            id="jobDescription"
            name="jobDescription"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={t('sections.match.jobInput.placeholder', 'Paste the job description here...')}
            className="w-full h-64 mb-4 font-mono text-sm leading-relaxed"
            error={error}
          />



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
            className="w-full group relative overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-none transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-emerald-900/20"
            variant="prominent"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <Sparkles className={cn("w-4 h-4 me-2", isAnalyzing && "animate-spin")} />
            {isAnalyzing ? t('sections.match.analyzing', 'Analyzing...') : t('sections.match.analyze', 'Analyze Match with AI')}
          </GlassButton>

          {disabledHint && (
            <p className="text-xs text-gray-500 mt-2 text-center">{disabledHint}</p>
          )}
        </GlassCard>

        {/* Results Section */}
        <GlassCard>
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
            <div className="flex flex-col h-full gap-5">
              {/* Score Ring Display - Fixed at top */}
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
                      <div className="absolute inset-4 grid place-items-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-inner shadow-white/5 overflow-hidden">
                        {/* Inner highlight pulse */}
                        {score >= 70 && (
                          <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                        )}
                        <div className="flex flex-col items-center justify-center text-center relative z-10">
                          <Tooltip
                            content={`${score}/100 - ${isArabic ? variant.labelAr : variant.label}`}
                            position="bottom"
                          >
                            <div className="flex flex-col items-center cursor-help">
                              <AnimatedCounter
                                to={score}
                                duration={1500}
                                className="text-5xl font-black text-white tracking-tight drop-shadow-lg"
                              />
                              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-[-2px]">Score</span>
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
                    className="absolute left-2 right-2 bottom-2 z-50 rounded-2xl border border-white/20 bg-slate-900/80 p-5 backdrop-blur-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                        {t('sections.match.results.howItWorks', 'Score Breakdown')}
                      </p>
                      <button
                        onClick={() => setWhyOpen(false)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {matchAnalysis?.categoryScores ? (
                      <div className="space-y-3">
                        {[
                          { key: 'hard_skills', label: isArabic ? 'المهارات التقنية' : 'Hard Skills', color: 'bg-blue-500', text: 'text-blue-400', icon: Code2 },
                          { key: 'experience', label: isArabic ? 'الخبرة' : 'Experience', color: 'bg-purple-500', text: 'text-purple-400', icon: Briefcase },
                          { key: 'education', label: isArabic ? 'التعليم' : 'Education', color: 'bg-amber-500', text: 'text-amber-400', icon: GraduationCap },
                          { key: 'soft_skills', label: isArabic ? 'المهارات الشخصية' : 'Soft Skills', color: 'bg-emerald-500', text: 'text-emerald-400', icon: Users }
                        ].map(cat => {
                          const data = matchAnalysis.categoryScores?.[cat.key as keyof typeof matchAnalysis.categoryScores];
                          if (!data) return null;
                          const CatIcon = cat.icon;
                          const percent = Math.min(100, (data.score / data.max) * 100);

                          return (
                            <div key={cat.key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <CatIcon className={cn("w-3.5 h-3.5", cat.text)} />
                                  <span className="text-white/80 font-medium">{cat.label}</span>
                                </div>
                                <span className={cn("font-bold", cat.text)}>{data.score}/{data.max}</span>
                              </div>
                              <div className="h-2.5 w-full bg-black/20 rounded-full overflow-hidden ring-1 ring-white/5">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700 ease-out", cat.color)}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-white/90 leading-relaxed">
                        <strong>{t('sections.match.results.coverage', 'Coverage')}</strong> {t('sections.match.results.coverageDesc', 'measures what percentage of key job requirements appear in your resume.')}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                        {t('sections.match.results.calculation.title', 'How is this calculated?')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60">
                        <div>
                          <span className="text-blue-400 font-medium block mb-0.5">{isArabic ? 'المهارات التقنية' : 'Hard Skills'}</span>
                          {isArabic ? 'مطابقة الكلمات المفتاحية التقنية' : 'Matching technical keywords'}
                        </div>
                        <div>
                          <span className="text-purple-400 font-medium block mb-0.5">{isArabic ? 'الخبرة' : 'Experience'}</span>
                          {isArabic ? 'المسميات الوظيفية وسنوات الخبرة' : 'Job titles & years relevance'}
                        </div>
                        <div>
                          <span className="text-amber-400 font-medium block mb-0.5">{isArabic ? 'التعليم' : 'Education'}</span>
                          {isArabic ? 'الدرجة العلمية ومجال الدراسة' : 'Degree & field match'}
                        </div>
                        <div>
                          <span className="text-emerald-400 font-medium block mb-0.5">{isArabic ? 'المهارات الشخصية' : 'Soft Skills'}</span>
                          {isArabic ? 'السمات الشخصية والقيادية' : 'Behavioral & leadership traits'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto glass-scrollbar space-y-5 pr-2 -mr-2 max-h-[500px]">

                {/* Missing Keywords */}
                {missing.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400/90">
                      <div className="p-1 rounded bg-rose-500/20">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.missing', 'Missing Keywords')} <span className="text-white/40">({missing.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {missing.map((keyword, i) => (
                        <span
                          key={i}
                          className="group px-3 py-1.5 bg-rose-500/5 text-rose-300/90 rounded-lg text-sm border border-rose-500/10 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer hover:scale-[1.02]"
                          title={t('sections.match.results.addKeyword', 'Consider adding this keyword')}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Keywords (Top Hits) */}
                {hits.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400/90">
                      <div className="p-1 rounded bg-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.keywords', 'Recognized Strengths')} <span className="text-white/40">({hits.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {hits.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-emerald-500/5 text-emerald-300/90 rounded-lg text-sm border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3 inline me-1.5 opacity-60" />
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {matchAnalysis?.suggestions && matchAnalysis.suggestions.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400/90">
                      <div className="p-1 rounded bg-amber-500/20">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.suggestions', 'Suggestions')}
                    </h4>
                    <ul className="space-y-2">
                      {matchAnalysis.suggestions.map((suggestion, i) => (
                        <li
                          key={i}
                          className="p-3 rounded-xl bg-white/5 border border-white/5 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                        >
                          <span className="text-amber-400 mr-2">•</span>
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


              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 animate-fade-in">
              <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000 animate-pulse" />
                <div className="relative p-6 rounded-full bg-white/5 border border-white/10 group-hover:border-white/20 transition-all duration-500 group-hover:scale-110">
                  <Target className="w-10 h-10 text-gray-400 group-hover:text-blue-400 transition-colors duration-500" />
                </div>
              </div>
              <h4 className="text-lg font-medium text-white mb-2">
                {t('sections.match.emptyState.title', 'Ready to Analyze')}
              </h4>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                {t('sections.match.emptyState', 'Paste a job description to see how well your resume matches the requirements.')}
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Vision 2030 Info Modal */}

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmMatch}
        feature="ai_match"
        currentCredits={credits?.remaining || 0}
        isLoading={isAnalyzing}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          dismissFeedback();
        }}
      />
    </>
  );
}
