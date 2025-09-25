import { cn } from "../../lib/cn";

export default function SectionTitle({ eyebrow, title, description, className }) {
  return (
    <div className={cn("group/section-title space-y-2", className)}>
      {eyebrow && (
        <p className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--accent-gold)]">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2
          className="relative text-2xl font-bold text-ink-700 transition-colors duration-[var(--duration-breathe)] dark:text-surface-50 after:pointer-events-none after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[linear-gradient(120deg,transparent_0%,rgba(var(--accent-gold-rgb),0.4)_45%,rgba(var(--accent-gold-rgb),0.8)_55%,transparent_100%)] after:bg-[length:200%_100%] after:opacity-0 after:transition after:duration-[var(--duration-breathe)] after:ease-[var(--transition-snappy)] group-hover/section-title:after:opacity-100 group-focus-within/section-title:after:opacity-100 motion-safe:group-hover/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-safe:group-focus-within/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-reduce:group-hover/section-title:after:animate-none motion-reduce:group-focus-within/section-title:after:animate-none"
        >
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
