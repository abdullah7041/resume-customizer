import Card from "./Card.tsx";
import { cn } from "../../lib/utils/cn.ts";

export default function SectionTitle({ eyebrow, title, description, className }) {
  return (
    <Card
      tone="translucent"
      className={cn("px-6 py-4", className)}
      contentClassName="space-y-3 text-left text-ink-soft"
    >
      {eyebrow && (
        <p className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_35%)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-gold-500 shadow-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-gold-400 to-emerald-500" aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm leading-relaxed text-ink-soft/80">
          {description}
        </p>
      )}
    </Card>
  );
}




