import { useState } from "react";
import { Clipboard, ClipboardCheck, FileText, Sparkles } from "lucide-react";
import SecondaryButton from "../ui/SecondaryButton.jsx";

export default function OptimizationCard({ card, onCopy, disabledActions = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!card?.exampleAfter) return;
    await onCopy?.(card.exampleAfter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="relative space-y-5 rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-all duration-200 ease-out hover:shadow-[var(--shadow-lift)]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--secondary),transparent_90%)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--secondary)]">
              {card?.section ?? "Section"}
            </p>
        <p className="text-sm text-[color:var(--ink-muted)]">
              {card?.issue ?? "Opportunity detected"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--secondary),transparent_90%)] px-3 py-1 text-xs font-semibold text-[color:var(--secondary)]">
          Suggested
        </span>
      </header>

      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Recommendation
        </p>
        <p className="text-sm leading-relaxed text-[color:var(--ink)]">
          {card?.suggestion}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">Before</p>
          <div className="rounded-[var(--radius-card)] border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--color-danger-500),transparent_95%)] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink)]">
            <p>{card?.exampleBefore ?? "Original bullet pending."}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
              After
            </p>
            <SecondaryButton
              icon={copied ? ClipboardCheck : Clipboard}
              onClick={handleCopy}
              disabled={disabledActions}
              className="!px-3 !py-1 text-xs"
              title={disabledActions ? "Upgrade to copy directly." : "Copy optimized bullet"}
            >
              {copied ? "Copied" : "Copy"}
            </SecondaryButton>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--secondary),transparent_92%)] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink)]">
            <p>{card?.exampleAfter ?? "Optimized bullet pending."}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
