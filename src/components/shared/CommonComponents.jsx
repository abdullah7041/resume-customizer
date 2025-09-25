import PrimaryButton from "../ui/PrimaryButton.jsx";
import { cn } from "../../lib/cn";

export { PrimaryButton };

export function Card({ children, className }) {
  return (
    <div
      className={cn(
    "rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/95 p-6 shadow-soft backdrop-blur-sm sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60",
        className
      )}
    >
      {children}
    </div>
  );
}
