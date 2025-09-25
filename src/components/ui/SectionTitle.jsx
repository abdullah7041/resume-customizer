import { cn } from "../../lib/cn";

export default function SectionTitle({ eyebrow, title, description, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-500">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="text-2xl font-bold text-ink-700 dark:text-surface-50">
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm leading-relaxed text-ink-500/80 dark:text-surface-50/70">
          {description}
        </p>
      )}
    </div>
  );
}
