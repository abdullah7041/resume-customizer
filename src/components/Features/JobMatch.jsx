import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Info, Loader2, Sparkles } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton.jsx";
import SectionTitle from "../ui/SectionTitle.jsx";

const resolveVariant = (score) => {
  if (score >= 75) {
    return {
      gradient: "from-secondary-400 via-accent-400 to-secondary-500",
      glow: "bg-secondary-500/30",
      conic: "rgba(34,197,94,0.9)",
      label: "Strong alignment",
    };
  }
  if (score >= 50) {
    return {
      gradient: "from-warning-400 via-warning-500 to-accent-500",
      glow: "bg-warning-500/30",
      conic: "rgba(249,191,36,0.9)",
      label: "Moderate alignment",
    };
  }
  return {
    gradient: "from-danger-500 via-danger-400 to-warning-500",
    glow: "bg-danger-500/30",
    conic: "rgba(239,68,68,0.88)",
    label: "Needs attention",
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
  onAnalyzeMatch,
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
      await onAnalyzeMatch(trimmedJob);
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
        <textarea
          className="min-h-[220px] w-full rounded-[var(--radius-card)] border border-secondary-500/25 bg-sand-50/95 px-5 py-4 text-sm leading-relaxed text-ink-700 shadow-inner transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/15 dark:bg-zinc-900/60 dark:text-surface-50 dark:focus-visible:ring-offset-zinc-900"
          placeholder="Paste the job description for your next Riyadh role…"
          value={jobText}
          onChange={(event) => setJobText(event.target.value)}
        />
        {error && (
          <p className="flex items-center gap-2 text-sm font-medium text-danger-500" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={handleAnalyze} loading={isAnalyzing} disabled={buttonDisabled}>
              Analyze match
            </PrimaryButton>
          </div>
          {disabledHint && (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">
              {disabledHint}
            </p>
          )}
        </div>
      </div>

      <aside className="relative space-y-5 rounded-[var(--radius-card)] border border-secondary-500/12 bg-sand-50/95 p-6 text-ink-700 shadow-soft backdrop-blur-sm transition-shadow sm:p-7 sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50">
        {isAnalyzing ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-ink-500/80 dark:text-surface-50/70">
            <Loader2 className="h-6 w-6 animate-spin text-secondary-500" aria-hidden="true" />
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
                      className="relative grid h-full w-full place-items-center rounded-full border border-surface-50/20 bg-sand-50/30 p-4 text-ink-900 dark:bg-zinc-900/40"
                      style={{
                        backgroundImage: `conic-gradient(${variant.conic} ${(progress / 100) * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                      }}
                    >
                      <div className="grid place-items-center rounded-full bg-sand-50 px-6 py-6 text-center text-ink-900 shadow-inner dark:bg-zinc-900/70 dark:text-surface-50">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500/80">
                          Match
                        </span>
                        <span className="mt-2 text-4xl font-bold tracking-tight">
                          {score == null ? "—" : score}
                          {score != null && (
                            <span className="text-base font-semibold text-ink-500/70 dark:text-surface-50/70">/100</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-surface-50">
                  <p className="text-sm font-semibold uppercase tracking-[0.32em] text-surface-50/70">
                    {variant.label}
                  </p>
                  <p className="text-sm text-surface-50/80">
                    Weighted by cosine similarity and keyword coverage for the pasted description.
                  </p>
                  <div className="relative" ref={popoverRef}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-surface-50/30 bg-surface-50/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-surface-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900"
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
                        className="absolute right-0 z-50 mt-3 w-72 space-y-3 rounded-2xl border border-secondary-500/20 bg-sand-50/98 p-4 text-left text-sm text-ink-700 shadow-xl backdrop-blur-sm dark:border-secondary-500/25 dark:bg-zinc-900/95 dark:text-surface-50"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Coverage</p>
                          <span className="text-sm font-semibold text-ink-900 dark:text-surface-50">{coverageLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Similarity</p>
                          <span className="text-sm font-semibold text-ink-900 dark:text-surface-50">{cosineLabel}</span>
                        </div>
                        {missing.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Missing</p>
                            <ul className="mt-2 space-y-1 text-xs leading-snug text-ink-600 dark:text-surface-50/80">
                              {missing.slice(0, 4).map((keyword) => (
                                <li key={keyword}>• {keyword}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {matchAnalysis?.explanation?.reason && (
                          <p className="text-xs text-ink-500 dark:text-surface-50/70">
                            {matchAnalysis.explanation.reason}
                          </p>
                        )}
                        {Array.isArray(matchAnalysis?.explanation?.tips) &&
                          matchAnalysis.explanation.tips.length > 0 && (
                            <ul className="space-y-1 text-xs leading-snug text-ink-600 dark:text-surface-50/80">
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">
                  Top missing keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {missing.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-semibold text-secondary-600 dark:border-secondary-400/40 dark:bg-secondary-500/20 dark:text-secondary-100"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hits.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-500/70 dark:text-surface-50/70">
                  Recognized strengths
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hits.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-600 dark:border-accent-400/40 dark:bg-accent-500/20 dark:text-accent-100"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matchAnalysis?.suggestions?.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent-500">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Suggestions
                </h3>
                <ul className="space-y-2 text-sm leading-relaxed text-ink-700 dark:text-surface-50">
                  {matchAnalysis.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-secondary-500/12 bg-sand-50/95 px-4 py-3 shadow-soft dark:border-surface-50/10 dark:bg-zinc-900/60"
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
            <Sparkles className="h-6 w-6 text-secondary-500" aria-hidden="true" />
            <p>Paste a job description to see match insights here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
