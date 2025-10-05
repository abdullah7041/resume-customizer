import { cn } from "../../lib/cn";

export default function SectionTitle({ eyebrow, title, description, className }) {
  return (
    <div
      className={cn(
        "group/section-title relative overflow-hidden rounded-[calc(var(--radius-card)_/_2.1)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] px-6 py-5 shadow-[var(--shadow-soft)] transition-[box-shadow] duration-300 ease-[var(--transition-snappy)]",
        "hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {eyebrow && (
        <p className="inline-flex items-center rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--surface),transparent_5%)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--accent)]">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2
          className="relative mt-2 text-2xl font-semibold tracking-tight text-[color:var(--ink)]"
        >
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}
