import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";

const variants = {
  success: {
    icon: CheckCircle2,
    accent: "from-emerald-400/80 to-emerald-500/50",
    ring: "shadow-glass",
  },
  danger: {
    icon: AlertTriangle,
    accent: "from-magenta-600/80 to-royal-600/60",
    ring: "shadow-ring",
  },
  warning: {
    icon: AlertTriangle,
    accent: "from-gold-500/85 to-gold-400/50",
    ring: "shadow-lift",
  },
  info: {
    icon: Info,
    accent: "from-royal-500/80 to-magenta-500/60",
    ring: "shadow-soft",
  },
};

export function ToastContainer({ children }) {
  return (
    <div
      className="pointer-events-none fixed top-6 right-6 z-50 flex w-full max-w-xs flex-col gap-3"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {children}
    </div>
  );
}

export default function Toast({ title, description, type = "info", onDismiss }) {
  const variant = variants[type] ?? variants.info;
  const Icon = variant.icon;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto overflow-hidden rounded-xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_4%)] p-0.5 shadow-card backdrop-blur-glass animate-glass-in",
        variant.ring
      )}
    >
      <div className={cn("relative flex items-start gap-3 rounded-[inherit] bg-gradient-to-br p-4 text-sm text-ink", variant.accent)}>
        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_20%)] text-white shadow-soft">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex-1 space-y-1 text-left">
          <p className="font-semibold tracking-wide text-white drop-shadow-md">{title}</p>
          {description && <p className="text-xs/relaxed text-white/90">{description}</p>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-all duration-snappy ease-snappy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-[color:var(--button-primary-focus)]"
            aria-label="Dismiss notification"
            title="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/30"
        />
      </div>
    </div>
  );
}
