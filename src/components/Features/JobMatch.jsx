import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Info, Loader2, Sparkles } from "lucide-react";
import Button from "../ui/Button.jsx";
import AnimatedCard from "../ui/AnimatedCard.jsx";
import { AnimatedCounter } from "../ui/AnimatedCounter.jsx";
import { FadeInWhenVisible } from "../ui/ParallaxSection.jsx";
import Input from "../ui/Input.jsx";
import SectionTitle from "../ui/SectionTitle.jsx";
import Tooltip from "../ui/Tooltip.jsx";

const resolveVariant = (score) => {
  if (score >= 75) {
    return {
      gradient: "from-secondary-400 via-accent-400 to-secondary-500",
      glow: "bg-secondary-500/30",
      conic: "rgba(34,197,94,0.9)",
      label: "🎯 Strong alignment",
      emoji: "🌟",
    };
  }
  if (score >= 50) {
    return {
      gradient: "from-warning-400 via-warning-500 to-accent-500",
      glow: "bg-warning-500/30",
      conic: "rgba(249,191,36,0.9)",
      label: "⚡ Moderate alignment",
      emoji: "💡",
    };
  }
  return {
    gradient: "from-danger-500 via-danger-400 to-warning-500",
    glow: "bg-danger-500/30",
    conic: "rgba(239,68,68,0.88)",
    label: "🔧 Needs attention",
    emoji: "📝",
  };
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
};

const LAST_JOB_KEY = "airo:lastJobDescription";
const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function JobMatch({
  onAnalyzeMatchAI,
  matchAnalysis,
  isAnalyzing = false,
  hasResume = false,
  onToast,
}) {
  const [jobText, setJobText] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(LAST_JOB_KEY) ?? "";
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobText && jobText.trim().length > 0) {
      window.localStorage.setItem(LAST_JOB_KEY, jobText);
    } else {
      window.localStorage.removeItem(LAST_JOB_KEY);
    }
  }, [jobText]);

  const notify = onToast ?? null;

  const handleAnalyze = async () => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = "Paste the job description before analyzing.";
      setError(message);
      notify?.({
        type: "warning",
        title: "Job description needed",
        description: "Paste the job description before analyzing the match.",
      });
      return;
    }
    setError("");
    try {
      await onAnalyzeMatchAI(trimmedJob);
    } catch (err) {
      setError(err?.message || "We could not analyze this match.");
    }
  };

  const hasResults = Boolean(matchAnalysis);
  const rawScore = Number.isFinite(matchAnalysis?.score) ? matchAnalysis.score : null;
  const score = rawScore != null ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
  const variant = resolveVariant(score ?? 0);
  const progress = score == null ? 0 : Math.max(0, Math.min(100, score));
  const ringOffset = useMemo(
    () => RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE,
    [progress],
  );
  const missing = matchAnalysis?.missingKeywords?.slice(0, 6) ?? [];
  const hits = matchAnalysis?.topHits?.slice(0, 6) ?? [];
  const coverageLabel = formatPercent(matchAnalysis?.coverage);
  const cosineLabel = formatPercent(matchAnalysis?.cosine);
  const popoverRef = useRef(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? "Upload or paste your resume first."
    : !jobText.trim()
    ? "Paste a job description to continue."
    : "";

  useEffect(() => {
    if (!whyOpen) return undefined;
    const handleClick = (event) => {
      if (!popoverRef.current?.contains(event.target)) {
        setWhyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [whyOpen]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Step 2"
          title="Match to a Saudi job role"
          description="Paste the job description to uncover keyword gaps and alignment opportunities."
        />
        <Input
          multiline
          label="Job description"
          placeholder="Paste the job description for your next Riyadh role…"
          value={jobText}
          onChange={(event) => setJobText(event.target.value)}
          inputClassName="min-h-[220px]"
          error={Boolean(error)}
        />
        {error && (
          <p className="flex items-center gap-2 text-sm font-medium text-danger-500" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleAnalyze}
            loading={isAnalyzing}
            disabled={buttonDisabled}
            icon={Sparkles}
            className="justify-center sm:justify-start"
          >
            Analyze Match with AI
          </Button>
          {disabledHint && (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">
              {disabledHint}
            </p>
          )}
          {!disabledHint && (
            <p className="text-xs text-ink-500/70 dark:text-surface-50/60">
              AI provides intelligent insights with deeper analysis of your resume match
            </p>
          )}
        </div>
      </div>

      <AnimatedCard 
        as="aside" 
        tone="translucent" 
        className="space-y-5" 
        contentClassName="space-y-5 text-ink"
        enableTilt={hasResults}
        tiltIntensity={15}
      >
        {isAnalyzing ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-ink-500/80 dark:text-surface-50/70">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" aria-hidden="true" />
            <p>Analyzing text similarities…</p>
          </div>
        ) : hasResults ? (
          <div className="space-y-5">
            <div
              className={`relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br ${variant.gradient} p-6 text-surface-50 shadow-soft`}
            >
              <div className={`absolute inset-0 opacity-40 blur-3xl ${variant.glow}`} aria-hidden="true" />
              <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
                <div className="grid place-items-center">
                  <div className="relative h-36 w-36">
                    <div className="absolute inset-0 rounded-full bg-surface-50/10" aria-hidden="true" />
                    <svg
                      className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rotate-[-90deg]"
                      viewBox="0 0 120 120"
                      aria-hidden="true"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={RING_RADIUS}
                        fill="none"
                        stroke={variant.conic}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={ringOffset}
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                      />
                    </svg>
                    <div
                      className="relative grid h-full w-full place-items-center rounded-full border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_25%)] p-3 text-ink backdrop-blur-soft"
                      style={{
                        backgroundImage: `conic-gradient(${variant.conic} ${(progress / 100) * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                      }}
                    >
                      <div className="grid place-items-center rounded-full bg-[color:var(--surface-glass-strong)] px-4 py-4 text-center text-ink shadow-inner">
                        <span className="text-xl mb-0.5" role="img" aria-label="Match quality">
                          {variant.emoji}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-emerald-500 opacity-80">
                          Match
                        </span>
                        <Tooltip
                          content={`${score != null ? score : 0}/100 - ${variant.label.split(' ')[1]} match with job requirements`}
                          position="bottom"
                        >
                          <div className="mt-1 flex items-baseline justify-center gap-0.5 cursor-help">
                            {score != null ? (
                              <AnimatedCounter
                                to={score}
                                duration={1500}
                                className="text-3xl font-bold tracking-tight leading-none"
                              />
                            ) : (
                              <span className="text-3xl font-bold tracking-tight leading-none">—</span>
                            )}
                            {score != null && (
                              <span className="text-sm font-semibold text-ink-soft opacity-80 leading-none">/100</span>
                            )}
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-surface-50">
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-surface-50/70">
                    {variant.label}
                  </p>
                  <p className="text-sm text-surface-50/80">
                    AI-powered analysis evaluating your resume's alignment with job requirements.
                  </p>
                  <div className="relative" ref={popoverRef}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-surface-50 transition active:scale-[0.95] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      onClick={() => setWhyOpen((prev) => !prev)}
                      aria-expanded={whyOpen}
                      aria-controls="match-why-popover"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" /> Why
                    </button>
                    {whyOpen && (
                      <div
                        id="match-why-popover"
                        role="dialog"
                        className="absolute right-0 z-50 mt-3 w-72 space-y-4 rounded-2xl border-2 border-emerald-500/30 bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_5%)] p-5 text-left text-sm text-ink shadow-[0_8px_32px_rgba(0,0,0,0.24)] backdrop-blur-glass"
                      >
                        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2.5">
                          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">Coverage</p>
                          <span className="text-lg font-bold text-ink">{coverageLabel}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2.5">
                          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">Similarity</p>
                          <span className="text-lg font-bold text-ink">{cosineLabel}</span>
                        </div>
                        {missing.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500">Missing</p>
                            <ul className="mt-2 space-y-1 text-xs leading-snug text-ink-soft">
                              {missing.slice(0, 4).map((keyword) => (
                                <li key={keyword}>• {keyword}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {matchAnalysis?.explanation?.reason && (
                          <p className="text-xs text-ink-soft opacity-80">
                            {matchAnalysis.explanation.reason}
                          </p>
                        )}
                        {Array.isArray(matchAnalysis?.explanation?.tips) &&
                          matchAnalysis.explanation.tips.length > 0 && (
                            <ul className="space-y-1 text-xs leading-snug text-ink-soft">
                              {matchAnalysis.explanation.tips.slice(0, 3).map((tip, index) => (
                                <li key={`${tip}-${index}`}>• {tip}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}
                  </div>
                  {score == null && (
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-surface-50/70">
                      — Not enough data
                    </p>
                  )}
                </div>
              </div>
            </div>

            {missing.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">
                  Top missing keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {missing.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_18%)] px-3 py-1 text-xs font-semibold text-emerald-500 shadow-soft"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hits.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink opacity-80">
                  Recognized strengths
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hits.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_15%)] px-3 py-1 text-xs font-semibold text-ink"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matchAnalysis?.suggestions?.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Suggestions
                </h3>
                <ul className="space-y-2 text-sm leading-relaxed text-ink">
                  {matchAnalysis.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_15%)] px-4 py-3 shadow-soft backdrop-blur-soft"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-ink-500/80 dark:text-surface-50/70">
            <Sparkles className="h-6 w-6 text-emerald-500" aria-hidden="true" />
            <p>Paste a job description to see match insights here.</p>
          </div>
        )}
      </AnimatedCard>
    </div>
  );
}
