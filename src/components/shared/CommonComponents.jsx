import PrimaryButton from "../ui/PrimaryButton.jsx";
import { cn } from "../../lib/cn";

export { PrimaryButton };

export function Card({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-secondary-500/10 bg-surface-50/90 p-6 shadow-soft backdrop-blur-xl dark:border-surface-50/10 dark:bg-surface-900/70",
        className
      )}
    >
      {children}
    </div>
  );
}
