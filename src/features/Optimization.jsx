import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCheck, FileDown, Info, Lock, Sparkles } from "lucide-react";
import PrimaryButton from "../components/ui/PrimaryButton.jsx";
import SecondaryButton from "../components/ui/SecondaryButton.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import OptimizationCard from "../components/shared/OptimizationCard.jsx";

const modes = [
  { value: "auto", label: "AI automatic" },
  { value: "conservative", label: "Conservative" },
  { value: "aggressive", label: "Aggressive" },
];

const emptyKeywords = { add: [], remove: [], neutral: [] };
const CHIP_LABELS = {
  add: "Add",
  neutral: "Keep",
  remove: "De-emphasize",
};

const PreviewBanner = ({ onUpgrade }) => (
  <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-secondary-500/15 bg-secondary-500/5 p-6 text-left shadow-soft backdrop-blur-sm sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60">
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-500/15 text-secondary-500">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">
          Preview mode
        </p>
        <p className="text-sm text-ink-500 dark:text-surface-50/80">
          Free preview run—results will not be saved until you upgrade.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-secondary-500/20 bg-secondary-500/10 px-3 py-1 text-xs text-secondary-600 shadow-soft dark:border-surface-50/20 dark:bg-zinc-900/60 dark:text-surface-50/70">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="leading-none">Preview lets you test the flow. Upgrade to save/export.</span>
        </div>
      </div>
    </div>
    <div>
      <PrimaryButton onClick={onUpgrade} className="w-full justify-center sm:w-auto">
        Unlock premium insights
      </PrimaryButton>
    </div>
  </div>
);

export default function Optimization({
  isPremium,
  optimizations = [],
  keywords = emptyKeywords,
  isOptimizing = false,
  onOptimize,
  onCopy,
  previewUsed,
  onUpgrade,
  onExport,
  canExport = false,
}) {
  const [mode, setMode] = useState("auto");
  const [chipsAnimated, setChipsAnimated] = useState(false);
  const chipsShownRef = useRef(false);

  const keywordBuckets = useMemo(() => ({
    add: keywords?.add ?? [],
    remove: keywords?.remove ?? [],
    neutral: keywords?.neutral ?? [],
  }), [keywords]);

  const watermarkVisible = !isPremium && previewUsed;
  const showPreviewBanner = !isPremium && !previewUsed;

  const handleRun = () => onOptimize?.(mode);

  useEffect(() => {
    const total =
      (keywordBuckets.add?.length ?? 0) +
      (keywordBuckets.neutral?.length ?? 0) +
      (keywordBuckets.remove?.length ?? 0);
    if (total > 0 && !chipsShownRef.current) {
      chipsShownRef.current = true;
      setChipsAnimated(true);
      const host = typeof window !== "undefined" ? window : globalThis;
      const timer = host.setTimeout(() => setChipsAnimated(false), 2200);
      return () => host.clearTimeout?.(timer);
    }
    return undefined;
  }, [keywordBuckets]);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Step 3"
        title="Polish every section"
        description="Fine-tune your resume with recommendations that resonate in Saudi financial-tech circles."
      />

      {showPreviewBanner && <PreviewBanner onUpgrade={onUpgrade} />}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Optimization mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="w-full rounded-[var(--radius-card)] border border-secondary-500/25 bg-sand-50/95 px-4 py-3 text-sm font-medium text-ink-700 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/15 dark:bg-zinc-900/60 dark:text-surface-50 dark:focus-visible:ring-offset-zinc-900"
          >
            {modes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-500">Actions</span>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              icon={FileDown}
              onClick={() => onExport?.("styled")}
              disabled={!canExport || isOptimizing}
              title={
                !canExport
                  ? "Upload and parse your resume before exporting."
                  : isOptimizing
                  ? "Please wait for the optimization run to finish."
                  : undefined
              }
            >
              Export PDF
            </SecondaryButton>
            <SecondaryButton
              icon={Check}
              disabled={!isPremium}
              title=
                {!isPremium
                  ? previewUsed
                    ? "Upgrade to save results."
                    : "Run a preview to unlock results."
                  : undefined}
            >
              Save to account
            </SecondaryButton>
            <SecondaryButton
              icon={ClipboardCheck}
              disabled={!isPremium}
              title=
                {!isPremium
                  ? previewUsed
                    ? "Upgrade to export your optimized resume."
                    : "Preview your optimizations first."
                  : undefined}
            >
              Export summary
            </SecondaryButton>
          </div>
        </div>
      </div>

      <PrimaryButton
        icon={Sparkles}
        onClick={handleRun}
        loading={isOptimizing}
        disabled={isOptimizing}
        className="w-full justify-center min-h-[44px]"
      >
        Run AI optimization
      </PrimaryButton>

      <section className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-secondary-500/12 bg-sand-50/95 p-5 shadow-soft dark:border-surface-50/10 dark:bg-zinc-900/60">
          <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-secondary-500">
            Keyword focus
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {(["add", "neutral", "remove"]).map((bucket) => (
              <div key={bucket} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500/70 dark:text-surface-50/70">
                  {CHIP_LABELS[bucket]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(keywordBuckets[bucket] ?? []).length > 0 ? (
                    keywordBuckets[bucket].map((token) => (
                      <span
                        key={token}
                        className={`relative overflow-hidden rounded-full border border-secondary-500/20 bg-secondary-500/10 px-3 py-1 text-xs font-semibold text-secondary-600 dark:border-secondary-500/30 dark:bg-secondary-500/20 dark:text-secondary-100 ${
                          chipsAnimated ? "keyword-chip-shimmer" : ""
                        }`}
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-400/80 dark:text-surface-50/50">No items yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative space-y-4">
          {watermarkVisible && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center text-[2.75rem] font-black uppercase tracking-[0.45em] text-secondary-500/10 sm:px-0 sm:text-6xl sm:tracking-[0.6em]">
              Preview
            </div>
          )}

          {isOptimizing ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/90 dark:border-surface-50/10 dark:bg-zinc-900/60"
                />
              ))}
            </div>
          ) : optimizations.length > 0 ? (
            <div className="space-y-4">
              {optimizations.map((card, index) => (
                <OptimizationCard
                  key={`${card.section}-${index}`}
                  card={card}
                  index={index}
                  onCopy={onCopy}
                  disabledActions={!isPremium}
                />
              ))}
            </div>
          ) : (
        <div className="rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/80 p-8 text-center text-sm text-ink-500/80 shadow-soft backdrop-blur-sm dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50/70">
              Run an analysis to see AI optimization cards appear here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
