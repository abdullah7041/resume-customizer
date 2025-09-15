import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton.jsx";
import SectionTitle from "../ui/SectionTitle.jsx";

const scoreTone = (score) => {
  if (score >= 85) return "from-secondary-500 to-accent-500";
  if (score >= 60) return "from-warning-500 to-accent-500";
  return "from-danger-500 to-primary-500";
};

export default function JobMatch({ onAnalyzeMatch, matchAnalysis, isAnalyzing = false }) {
  const [jobText, setJobText] = useState("");
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setError("");
    try {
      await onAnalyzeMatch(jobText);
    } catch (err) {
      setError(err.message);
    }
  };

  const hasResults = Boolean(matchAnalysis);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Step 2"
          title="Match to a Saudi job role"
          description="Paste the job description to uncover keyword gaps and alignment opportunities."
        />
        <textarea
          className="min-h-[220px] w-full rounded-[var(--radius-card)] border border-secondary-500/20 bg-surface-50/70 px-5 py-4 text-sm leading-relaxed text-ink-700 shadow-inner transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-white/10 dark:bg-surface-900/70 dark:text-sand-50 dark:focus-visible:ring-offset-surface-900"
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
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={handleAnalyze} loading={isAnalyzing} disabled={!jobText.trim()}>
            Analyze match
          </PrimaryButton>
        </div>
      </div>

      <aside className="space-y-4 rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/70 p-6 shadow-soft backdrop-blur-xl dark:border-white/5 dark:bg-surface-900/60">
        {isAnalyzing ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-2xl bg-secondary-500/15" />
            <div className="h-3 w-full rounded-full bg-secondary-500/15" />
            <div className="h-3 w-3/4 rounded-full bg-secondary-500/10" />
            <div className="space-y-2">
              <div className="h-3 w-5/6 rounded-full bg-secondary-500/10" />
              <div className="h-3 w-2/3 rounded-full bg-secondary-500/10" />
            </div>
          </div>
        ) : hasResults ? (
          <div className="space-y-5">
            <div
              className={`relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br ${scoreTone(matchAnalysis.score)} p-6 text-surface-50 shadow-soft`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Match score</div>
              <div className="mt-3 text-4xl font-bold tracking-tight">{matchAnalysis.score}</div>
              <p className="mt-2 text-xs text-white/80">Out of 100 — higher is better alignment.</p>
            </div>

            {matchAnalysis.missingKeywords?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">
                  Missing keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {matchAnalysis.missingKeywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-semibold text-secondary-500"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matchAnalysis.suggestions?.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent-500">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Suggestions
                </h3>
                <ul className="space-y-2 text-sm leading-relaxed text-ink-700 dark:text-sand-50">
                  {matchAnalysis.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-secondary-500/10 bg-surface-50/80 px-4 py-3 shadow-soft dark:border-white/10 dark:bg-surface-900/70"
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
            <p>Paste a job description to see Saudi-specific recommendations here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
