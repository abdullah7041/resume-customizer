import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";

const variants = {
  success: {
    icon: CheckCircle2,
    accent: "from-emerald-500 via-teal-500 to-green-600",
    ring: "ring-2 ring-emerald-500/20 shadow-[0_8px_24px_rgba(16,185,129,0.25)]",
    iconBg: "bg-emerald-500",
  },
  danger: {
    icon: AlertTriangle,
    accent: "from-rose-500 via-red-500 to-pink-600",
    ring: "ring-2 ring-rose-500/20 shadow-[0_8px_24px_rgba(244,63,94,0.25)]",
    iconBg: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    accent: "from-amber-500 via-orange-500 to-yellow-600",
    ring: "ring-2 ring-amber-500/20 shadow-[0_8px_24px_rgba(245,158,11,0.25)]",
    iconBg: "bg-amber-500",
  },
  info: {
    icon: Info,
    accent: "from-blue-500 via-cyan-500 to-sky-600",
    ring: "ring-2 ring-blue-500/20 shadow-[0_8px_24px_rgba(59,130,246,0.25)]",
    iconBg: "bg-blue-500",
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
        "pointer-events-auto overflow-hidden rounded-xl border border-white/20 bg-[color:var(--surface-glass)] p-0.5 backdrop-blur-glass animate-glass-in transition-all duration-300 hover:scale-[1.02]",
        variant.ring
      )}
    >
      <div className={cn("relative flex items-start gap-3 rounded-[inherit] bg-gradient-to-br p-4 text-sm", variant.accent)}>
        <span className={cn("mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow-lg", variant.iconBg)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1 space-y-1.5 text-left">
          <p className="font-bold tracking-wide text-white drop-shadow-md leading-tight">{title}</p>
          {description && <p className="text-sm leading-relaxed text-white/95">{description}</p>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Dismiss notification"
            title="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
