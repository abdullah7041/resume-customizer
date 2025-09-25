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
          className="relative text-2xl font-bold text-[color:color-mix(in_oklab,var(--ink-900),transparent_12%)] transition-colors duration-[var(--duration-breathe)] dark:text-[color:var(--surface-50)] after:pointer-events-none after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklab,var(--accent-gold),transparent_55%)_45%,var(--accent-gold)_55%,transparent_100%)] after:bg-[length:200%_100%] after:opacity-0 after:transition after:duration-[var(--duration-breathe)] after:ease-[var(--transition-snappy)] group-hover/section-title:after:opacity-100 group-focus-within/section-title:after:opacity-100 motion-safe:group-hover/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-safe:group-focus-within/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-reduce:group-hover/section-title:after:animate-none motion-reduce:group-focus-within/section-title:after:animate-none"
        >
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm leading-relaxed text-[color:color-mix(in_oklab,var(--ink-500),transparent_20%)] dark:text-[color:color-mix(in_oklab,var(--surface-50),transparent_30%)]">
          {description}
        </p>
      )}
    </div>
  );
}
