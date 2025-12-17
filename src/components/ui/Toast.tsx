import { AlertTriangle, CheckCircle2, Info, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils/cn.ts";

const variants = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconColor: "text-emerald-400",
    glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
    titleColor: "text-emerald-50",
  },
  danger: {
    icon: AlertTriangle,
    border: "border-rose-500/30",
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconColor: "text-rose-400",
    glow: "shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]",
    titleColor: "text-rose-50",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-500/30",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconColor: "text-amber-400",
    glow: "shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]",
    titleColor: "text-amber-50",
  },
  info: {
    icon: Info,
    border: "border-sky-500/30",
    gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
    iconColor: "text-sky-400",
    glow: "shadow-[0_0_20px_-5px_rgba(14,165,233,0.3)]",
    titleColor: "text-sky-50",
  },
  loading: {
    icon: Loader2,
    border: "border-indigo-500/30",
    gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconColor: "text-indigo-400",
    glow: "shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]",
    titleColor: "text-indigo-50",
    spin: true,
  },
};

export function ToastContainer({ children }) {
  return (
    <div
      className="pointer-events-none fixed top-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0"
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
        "group pointer-events-auto relative overflow-hidden rounded-xl border bg-[#051315]/80 p-4 backdrop-blur-xl transition-all duration-500 hover:scale-[1.02] hover:bg-[#051315]/90",
        "animate-in slide-in-from-right-8 fade-in duration-300",
        variant.border,
        variant.glow
      )}
    >
      {/* Gradient Background */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", variant.gradient)} />

      {/* Glass Reflection */}
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_50%,transparent_100%)] pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className={cn("mt-0.5 flex-shrink-0 rounded-full p-1", variant.iconColor)}>
          <Icon className={cn("h-5 w-5 drop-shadow-[0_0_8px_currentColor]", variant.spin && "animate-spin")} />
        </div>

        <div className="flex-1 space-y-1">
          <p className={cn("font-medium leading-none tracking-wide", variant.titleColor)}>
            {title}
          </p>
          {description && (
            <p className="text-sm leading-relaxed text-slate-400/90 font-light">
              {description}
            </p>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="group/close -mr-1 -mt-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}




