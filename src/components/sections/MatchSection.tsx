import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Info,
  Zap,
  Wrench
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import Tooltip from '../ui/Tooltip';
import { AnimatedCounter } from '../ui/AnimatedCounter';

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
  onToast?: (toast: Toast) => void;
  onClear?: () => void;
}

export function MatchSection({
  onAnalyzeMatchAI,
  matchAnalysis,
  isAnalyzing = false,
  hasResume = false,
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
      await onAnalyzeMatchAI(trimmedJob);
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

  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? t('sections.match.hints.uploadFirst', 'Upload or paste your resume first.')
    : !jobText.trim()
      ? t('sections.match.hints.pasteJob', 'Paste a job description to continue.')
      : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
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
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.match.results.title', 'Match Results')}
          </h3>
        </div>

        {isAnalyzing ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <p>{t('sections.match.analyzingText', 'Analyzing text similarities…')}</p>
          </div>
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

              {/* Popover */}
              {whyOpen && (
                <div
                  ref={popoverRef}
                  className="absolute left-4 right-4 bottom-4 z-50 rounded-xl border border-white/20 bg-slate-900/95 p-4 backdrop-blur-xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                    {t('sections.match.results.howItWorks', 'How It Works')}
                  </p>
                  <p className="text-sm text-white/90">
                    <strong>{t('sections.match.results.coverage', 'Coverage')}</strong> {t('sections.match.results.coverageDesc', 'measures what percentage of key job requirements appear in your resume.')}
                  </p>
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
  );
}
