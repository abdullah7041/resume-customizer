import React from "react";
import { GlassCard } from "./GlassCard";
import { cn } from "../../lib/utils/cn";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: any;
  description: any;
  actions?: any;
  className?: any;
}

export default function EmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <GlassCard
      padding="lg"
      className={cn("text-center", className)}
    >
      <div className="flex flex-col items-center justify-center gap-6">
        {Icon && (
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-lg">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
        )}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          {description && (
            <p className="max-w-md text-sm leading-relaxed text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
      </div>
    </GlassCard>
  );
}




