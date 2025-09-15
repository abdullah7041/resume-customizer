import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-secondary-500/80 bg-transparent px-5 py-2.5 text-sm font-semibold text-secondary-500 transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] hover:bg-secondary-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:text-secondary-400 dark:hover:bg-secondary-500/20 dark:focus-visible:ring-offset-surface-900",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}
