import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Lock, Sparkles } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import { cn } from "../lib/utils/cn.ts";
import OptimizationCard from "../components/shared/OptimizationCard.jsx";

const emptyKeywords = { add: [], remove: [], neutral: [] };
const CHIP_LABELS = {
  add: "Add",
  neutral: "Keep",
  remove: "De-emphasize",
};

const PreviewBanner = ({ onUpgrade }) => (
  <Card
    tone="translucent"
    glow
    className="bg-[image:var(--gradient-muted-value)] text-white"
    contentClassName="space-y-4"
  >
    <div className="flex flex-wrap items-center gap-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-soft">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-400/90">
          Preview mode
        </p>
        <p className="text-sm text-white/80">
          Free preview run—results will not be saved until you upgrade.
        </p>
        <div className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85 shadow-soft">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="leading-none">Preview lets you test the flow. Upgrade to save/export.</span>
        </div>
      </div>
    </div>
    <div>
      <Button onClick={onUpgrade} className="w-full justify-center sm:w-auto">
        Unlock premium insights
      </Button>
    </div>
  </Card>
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
  hasMatchAnalysis = false,
  onClear,
}) {
  const [viewMode, setViewMode] = useState("split"); // "split" | "diff" (diff not fully implemented in card yet, using split default)
  const [chipsAnimated, setChipsAnimated] = useState(false);
  const chipsShownRef = useRef(false);

  const keywordBuckets = useMemo(() => ({
    add: keywords?.add ?? [],
    remove: keywords?.remove ?? [],
    neutral: keywords?.neutral ?? [],
  }), [keywords]);

  const watermarkVisible = !isPremium && previewUsed;
  const showPreviewBanner = !isPremium && !previewUsed;

  const handleRun = () => onOptimize?.("auto");

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
        action={
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode("split")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === "split"
                    ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode("diff")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  viewMode === "diff"
                    ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Inline Diff
              </button>
            </div>
            {optimizations.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs font-medium text-ink-500 hover:text-danger-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        }
      />

      {showPreviewBanner && <PreviewBanner onUpgrade={onUpgrade} />}

      {
        !hasMatchAnalysis && (
          <Card
            tone="translucent"
            className="border-warning-500/30 bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)]"
            contentClassName="space-y-3 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-warning-500/15 text-warning-500 shadow-soft">
                <Info className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-warning-500">
                  Match analysis required
                </p>
                <p className="text-sm text-ink-soft">
                  Run a match analysis first to provide job context for optimization.
                </p>
              </div>
            </div>
          </Card>
        )
      }

      <Button
        icon={Sparkles}
        onClick={handleRun}
        loading={isOptimizing}
        disabled={isOptimizing || !hasMatchAnalysis}
        className="w-full justify-center min-h-[44px]"
      >
        {hasMatchAnalysis ? "Optimize Resume with AI" : "Run Match Analysis First"}
      </Button>

      <section className="space-y-4">
        <Card tone="translucent" className="p-5" contentClassName="space-y-4 text-left">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500/90">
              Keyword focus
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(["add", "neutral", "remove"]).map((bucket) => (
              <div key={bucket} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/75">
                  {CHIP_LABELS[bucket]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(keywordBuckets[bucket] ?? []).length > 0 ? (
                    keywordBuckets[bucket].map((token) => (
                      <span
                        key={token}
                        className={cn(
                          "relative overflow-hidden rounded-pill border px-3 py-1 text-xs font-semibold shadow-soft transition-colors",
                          bucket === "add" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                          bucket === "neutral" && "border-blue-500/30 bg-blue-500/10 text-blue-500",
                          bucket === "remove" && "border-rose-500/30 bg-rose-500/10 text-rose-500",
                          chipsAnimated && "keyword-chip-shimmer"
                        )}
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-soft/60">No items yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="relative space-y-4">
          {watermarkVisible && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center text-[2.75rem] font-black uppercase tracking-[0.45em] text-emerald-500/10 sm:px-0 sm:text-6xl sm:tracking-[0.6em]">
              Preview
            </div>
          )}

          {isOptimizing ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)] backdrop-blur-soft"
                />
              ))}
            </div>
          ) : optimizations.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {optimizations.map((card, index) => (
                <OptimizationCard
                  key={`${card.section}-${index}`}
                  card={card}
                  index={index}
                  onCopy={onCopy}
                  disabledActions={false}
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <Card tone="translucent" className="p-8" contentClassName="space-y-2 text-center text-sm text-ink-soft">
              <p className="opacity-80">Run an analysis to see AI optimization cards appear here.</p>
            </Card>
          )}
        </div>
      </section>
    </div >
  );
}



