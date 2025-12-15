import { useState } from "react";
import { Clipboard, ClipboardCheck, FileText, Sparkles, ChevronDown } from "lucide-react";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { cn } from "../../lib/cn";

export default function OptimizationCard({ card, onCopy, disabledActions = false, viewMode = "split" }) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!card?.exampleAfter) return;
    await onCopy?.(card.exampleAfter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card
      tone="translucent"
      className="transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500/30 dark:hover:border-emerald-400/30"
      contentClassName="space-y-0"
    >
      <header
        className="flex cursor-pointer items-start justify-between gap-4 p-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_25%)] text-emerald-500 shadow-soft">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500/90">
              {card?.section ?? "Section"}
            </p>
            <p className="text-sm text-ink-soft">
              {card?.issue ?? "Opportunity detected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-pill border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)] px-3 py-1 text-xs font-semibold text-emerald-500 sm:inline-flex">
            Suggested
          </span>
          <button
            type="button"
            className="text-ink-soft transition-transform duration-300 hover:text-ink"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 p-4 pt-0">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold-500">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Recommendation
              </p>
              <p className="text-sm leading-relaxed text-ink">
                {card?.suggestion}
              </p>
            </div>

            <div className={cn(
              "grid gap-4",
              viewMode === "split" ? "md:grid-cols-2" : "grid-cols-1"
            )}>
              {/* Before Section - Hide in diff mode unless we want to show it distinctly? 
                      Actually, "Inline Diff" usually implies merging them. 
                      For now, let's keep it simple: Split = Side-by-Side, Diff = Unified View 
                  */}

              {viewMode === "split" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/80">Before</p>
                  <div className="h-full rounded-lg border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_25%)] px-4 py-3 text-sm leading-relaxed text-ink">
                    <p>{card?.exampleBefore ?? "Original bullet pending."}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">
                    {viewMode === "split" ? "After" : "Optimized View"}
                  </p>
                  <Button
                    variant="secondary"
                    icon={copied ? ClipboardCheck : Clipboard}
                    onClick={handleCopy}
                    disabled={disabledActions}
                    className="text-xs h-7 px-3"
                    title={disabledActions ? "Upgrade to copy directly." : "Copy optimized bullet"}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="relative h-full overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed text-ink shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)] dark:border-emerald-400/20 dark:bg-emerald-400/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-50" />

                  {viewMode === "diff" && card?.exampleBefore ? (
                    <p className="relative">
                      <span className="line-through text-red-500/70 bg-red-50 dark:bg-red-900/20 px-1 rounded decoration-1 mr-1">
                        {card.exampleBefore}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded">
                        {card.exampleAfter}
                      </span>
                    </p>
                  ) : (
                    <p className="relative">{card?.exampleAfter ?? "Optimized bullet pending."}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
