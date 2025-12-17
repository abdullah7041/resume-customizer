import React from "react";
import Card from "./Card";
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
    <Card
      tone="glass"
      glow
      className={cn("items-center justify-center text-center", className)}
      contentClassName="flex flex-col items-center justify-center gap-6"
    >
      {Icon && (
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_20%)] text-emerald-400 shadow-soft">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-ink-soft/80">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </Card>
  );
}




