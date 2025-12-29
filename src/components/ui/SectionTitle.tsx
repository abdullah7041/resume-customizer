import { GlassCard } from "./GlassCard";
import { cn } from "../../lib/utils/cn";
import { GlassCircle } from "./GlassCircle";
import type { ReactNode } from "react";

interface SectionTitleProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

export default function SectionTitle({ eyebrow, title, description, icon, className }: SectionTitleProps) {
  return (
    <GlassCard
      variant="subtle"
      padding="md"
      className={cn("text-left", className)}
    >
      {(eyebrow || icon) && (
        <div className="flex items-center gap-3 rtl:flex-row-reverse mb-3">
          {eyebrow && (
            <p className="inline-flex items-center gap-2 flex-row rtl:flex-row-reverse rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400 flex-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-amber-400 to-emerald-500" aria-hidden="true" />
              {eyebrow}
            </p>
          )}
          {icon && (
            <GlassCircle size="md" variant="success" className="shrink-0">
              <span className="text-emerald-400">{icon}</span>
            </GlassCircle>
          )}
        </div>
      )}
      {title && (
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm leading-relaxed text-gray-400 mt-2">
          {description}
        </p>
      )}
    </GlassCard>
  );
}





