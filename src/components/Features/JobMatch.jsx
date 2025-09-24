import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
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
  if (!Number.isFinite(value)) return "0%";
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

  const handleAnalyze = async () => {
    if (!jobText.trim()) {
      setError("Paste the job description before analyzing.");
      return;
    }
    setError("");
    try {
      await onAnalyzeMatch(jobText);
    } catch (err) {
      setError(err?.message || "We could not analyze this match.");
    }
  };

  const hasResults = Boolean(matchAnalysis);
  const score = matchAnalysis?.score ?? 0;
  const variant = resolveVariant(score);
  const progress = Math.max(0, Math.min(100, score));
  const ringOffset = useMemo(
    () => RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE,
    [progress],
  );
  const missing = matchAnalysis?.missingKeywords?.slice(0, 6) ?? [];
  const hits = matchAnalysis?.topHits?.slice(0, 6) ?? [];
  const coverageLabel = formatPercent(matchAnalysis?.coverage ?? 0);
  const cosineLabel = `${Math.round((matchAnalysis?.cosine ?? 0) * 100) / 100}`;

  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? "Upload or paste your resume first."
    : !jobText.trim()
    ? "Paste a job description to continue."
    : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Step 2"
          title="Match to a Saudi job role"
          description="Paste the job description to uncover keyword gaps and alignment opportunities."
        />
        <textarea
          className="min-h-[220px] w-full rounded-[var(--radius-card)] border border-secondary-500/25 bg-surface-50 px-5 py-4 text-sm leading-relaxed text-ink-700 shadow-inner transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/15 dark:bg-zinc-900/60 dark:text-sand-50 dark:focus-visible:ring-offset-zinc-900"
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500/70 dark:text-sand-50/60">
              {disabledHint}
            </p>
          )}
        </div>
      </div>

      <aside className="relative space-y-5 rounded-[var(--radius-card)] border border-secondary-500/12 bg-sand-50/80 p-6 shadow-soft backdrop-blur-sm transition-shadow sm:p-7 sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60">
        {isAnalyzing ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-ink-500/80 dark:text-sand-50/70">
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
                      className="relative grid h-full w-full place-items-center rounded-full border border-surface-50/20 bg-surface-50/10 p-4 text-ink-900 dark:bg-zinc-900/40"
                      style={{
                        backgroundImage: `conic-gradient(${variant.conic} ${(progress / 100) * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                      }}
                    >
                      <div className="grid place-items-center rounded-full bg-surface-50/90 px-6 py-6 text-center text-ink-900 shadow-inner dark:bg-zinc-900/70 dark:text-sand-50">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500/80">
                          Match
                        </span>
                        <span className="mt-2 text-4xl font-bold tracking-tight">
                          {score}
                          <span className="text-base font-semibold text-ink-500/70 dark:text-sand-50/70">/100</span>
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
                  <dl className="grid grid-cols-2 gap-3 text-xs text-surface-50/80">
                    <div className="space-y-1 rounded-2xl bg-surface-50/10 px-3 py-2">
                      <dt className="font-semibold uppercase tracking-[0.3em] text-surface-50/60">Coverage</dt>
                      <dd className="text-sm font-semibold text-surface-50">{coverageLabel}</dd>
                    </div>
                    <div className="space-y-1 rounded-2xl bg-surface-50/10 px-3 py-2">
                      <dt className="font-semibold uppercase tracking-[0.3em] text-surface-50/60">Similarity</dt>
                      <dd className="text-sm font-semibold text-surface-50">{cosineLabel}</dd>
                    </div>
                  </dl>
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-500/70 dark:text-sand-50/70">
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
                <ul className="space-y-2 text-sm leading-relaxed text-ink-700 dark:text-sand-50">
                  {matchAnalysis.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-secondary-500/12 bg-surface-50/90 px-4 py-3 shadow-soft dark:border-surface-50/10 dark:bg-zinc-900/60"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-ink-500/80 dark:text-sand-50/70">
            <Sparkles className="h-6 w-6 text-secondary-500" aria-hidden="true" />
            <p>Paste a job description to see match insights here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
