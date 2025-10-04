import { cn } from "../../lib/cn";

export default function SectionTitle({ eyebrow, title, description, className }) {
  return (
    <div
      className={cn(
        "group/section-title relative overflow-hidden rounded-[calc(var(--radius-card)_/_2.1)] border border-[color:color-mix(in_oklab,var(--panel-stroke),transparent_52%)] bg-[color:var(--panel-bg)] px-6 py-5 shadow-[0_26px_64px_-46px_color-mix(in_oklab,var(--emerald-900),transparent_70%)] backdrop-blur-xl transition-all duration-[var(--duration-breathe)] ease-[var(--transition-snappy)]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--panel-highlight),transparent_10%)_0%,transparent_70%)] before:opacity-80 before:content-['']",
        className,
      )}
    >
      {eyebrow && (
        <p className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--panel-stroke),transparent_35%)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--accent)] shadow-[0_10px_30px_-24px_color-mix(in_oklab,var(--emerald-900),transparent_70%)]">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2
          className="relative text-2xl font-bold text-[color:var(--ink)] transition-colors duration-[var(--duration-breathe)] after:pointer-events-none after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:rounded-full after:bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklab,var(--accent-gold),transparent_55%)_45%,var(--accent-gold)_55%,transparent_100%)] after:bg-[length:200%_100%] after:opacity-0 after:transition after:duration-[var(--duration-breathe)] after:ease-[var(--transition-snappy)] group-hover/section-title:after:opacity-100 group-focus-within/section-title:after:opacity-100 motion-safe:group-hover/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-safe:group-focus-within/section-title:after:animate-[accent-shimmer_1.6s_linear] motion-reduce:group-hover/section-title:after:animate-none motion-reduce:group-focus-within/section-title:after:animate-none"
        >
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}
