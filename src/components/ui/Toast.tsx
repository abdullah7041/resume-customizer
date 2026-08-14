import { AlertTriangle, CheckCircle2, Info, X, Loader2 } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "../../lib/utils/cn";

const variants = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconColor: "text-emerald-400",
    glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] shadow-emerald-500/20",
    titleColor: "text-emerald-900 dark:text-emerald-50",
  },
  danger: {
    icon: AlertTriangle,
    border: "border-rose-500/30",
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconColor: "text-rose-400",
    glow: "shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)] shadow-rose-500/20",
    titleColor: "text-rose-900 dark:text-rose-50",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-500/30",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconColor: "text-amber-400",
    glow: "shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] shadow-amber-500/20",
    titleColor: "text-amber-900 dark:text-amber-50",
  },
  info: {
    icon: Info,
    border: "border-teal-500/30",
    gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
    iconColor: "text-teal-500",
    glow: "shadow-[0_0_20px_-5px_rgba(13,148,136,0.3)] shadow-teal-500/20",
    titleColor: "text-teal-950 dark:text-teal-50",
  },
  loading: {
    icon: Loader2,
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconColor: "text-emerald-500",
    glow: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] shadow-emerald-500/20",
    titleColor: "text-emerald-950 dark:text-emerald-50",
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
      {/* initial={false} skips an entrance burst for toasts already present on
          first mount; later additions still animate in, removals animate out,
          and `layout` on each toast reflows the stack smoothly. Transform
          motion is stripped automatically under prefers-reduced-motion by the
          app-level MotionConfig reducedMotion="user". */}
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}

export default function Toast({ title, description, type = "info", onDismiss }) {
  const variant = variants[type] ?? variants.info;
  const Icon = variant.icon;

  return (
    <m.div
      role="status"
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ type: "spring", stiffness: 400, damping: 34, mass: 0.8 }}
      className={cn(
        "group pointer-events-auto relative overflow-hidden rounded-xl border bg-white/95 dark:bg-[#031713]/80 p-4 backdrop-blur-xl transition-colors duration-200 hover:bg-white dark:hover:bg-[#031713]/90 shadow-lg",
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
            <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-400/90 font-light">
              {description}
            </p>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="group/close -mr-1 -mt-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </m.div>
  );
}




