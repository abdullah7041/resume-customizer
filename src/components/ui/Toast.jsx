import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";

const variants = {
  success: {
    icon: CheckCircle2,
    className: "bg-success-500 text-surface-50",
  },
  danger: {
    icon: AlertTriangle,
    className: "bg-danger-500 text-surface-50",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-warning-500 text-ink-900",
  },
  info: {
    icon: Info,
    className: "bg-primary-500 text-surface-50",
  },
};

export function ToastContainer({ children }) {
  return (
    <div
      className="pointer-events-none fixed top-5 right-5 z-50 flex w-full max-w-xs flex-col gap-2.5"
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
        "pointer-events-auto overflow-hidden rounded-2xl shadow-soft backdrop-blur-lg",
        variant.className
      )}
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-50/20 text-surface-50">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="flex-1 space-y-1 text-sm">
          <p className="font-semibold tracking-wide">{title}</p>
          {description && <p className="text-xs/relaxed opacity-90">{description}</p>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-current transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] hover:bg-surface-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-0"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
