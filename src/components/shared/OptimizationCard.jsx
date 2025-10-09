import { useState } from "react";
import { Clipboard, ClipboardCheck, FileText, Sparkles } from "lucide-react";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

export default function OptimizationCard({ card, onCopy, disabledActions = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!card?.exampleAfter) return;
    await onCopy?.(card.exampleAfter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card tone="translucent" className="space-y-5" contentClassName="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
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
        <span className="rounded-pill border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)] px-3 py-1 text-xs font-semibold text-emerald-500">
          Suggested
        </span>
      </header>

      <div className="space-y-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold-500">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Recommendation
        </p>
        <p className="text-sm leading-relaxed text-ink">
          {card?.suggestion}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/80">Before</p>
          <div className="rounded-lg border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_25%)] px-4 py-3 text-sm leading-relaxed text-ink">
            <p>{card?.exampleBefore ?? "Original bullet pending."}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-soft/80">
              After
            </p>
            <Button
              variant="secondary"
              icon={copied ? ClipboardCheck : Clipboard}
              onClick={handleCopy}
              disabled={disabledActions}
              className="!px-3 !py-1 text-xs"
              title={disabledActions ? "Upgrade to copy directly." : "Copy optimized bullet"}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="rounded-lg border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_15%)] px-4 py-3 text-sm leading-relaxed text-ink">
            <p>{card?.exampleAfter ?? "Optimized bullet pending."}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
