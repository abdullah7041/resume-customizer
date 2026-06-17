import type { ElementType, ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils/cn';

export interface MobileWorkflowItem {
  value: string;
  label: string;
  icon: ElementType;
  disabledReason?: string;
  isPremium?: boolean;
}

interface MobileWorkflowNavProps {
  primarySteps: MobileWorkflowItem[];
  secondarySteps: MobileWorkflowItem[];
  activeValue: string;
  onStepChange: (value: string) => void;
  gateReason: string;
  rightAction?: ReactNode;
}

export function MobileWorkflowNav({
  primarySteps,
  secondarySteps,
  activeValue,
  onStepChange,
  gateReason,
  rightAction,
}: MobileWorkflowNavProps) {
  const { t, i18n } = useTranslation();
  const isRtl =
    typeof i18n.dir === 'function'
      ? i18n.dir() === 'rtl'
      : i18n.language === 'ar';
  const activePrimaryIndex = primarySteps.findIndex((step) => step.value === activeValue);
  const activeSecondaryStep = secondarySteps.find((step) => step.value === activeValue);
  const activeStep = activePrimaryIndex >= 0 ? primarySteps[activePrimaryIndex] : activeSecondaryStep ?? primarySteps[0];
  const nextStep = primarySteps.slice(Math.max(activePrimaryIndex, 0) + 1).find((step) => !step.disabledReason);
  const ActiveIcon = activeStep.icon;

  const stepProgress =
    activePrimaryIndex >= 0
      ? t('workspace.mobileWorkflow.stepProgress', {
          current: activePrimaryIndex + 1,
          total: primarySteps.length,
          defaultValue: 'Step {{current}} of {{total}}',
        })
      : t('workspace.mobileWorkflow.toolProgress', 'Tool');

  const renderStepButton = (step: MobileWorkflowItem, index: number, isPrimary: boolean) => {
    const Icon = step.icon;
    const isActive = step.value === activeValue;
    const isDisabled = Boolean(step.disabledReason);
    const statusText = isDisabled
      ? t('workspace.mobileWorkflow.locked', 'Locked')
      : isActive
        ? t('workspace.mobileWorkflow.current', 'Current')
        : t('workspace.mobileWorkflow.available', 'Available');

    return (
      <button
        key={step.value}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-current={isActive && isPrimary ? 'step' : undefined}
        title={isDisabled ? step.disabledReason : undefined}
        onClick={() => {
          if (!isDisabled) {
            onStepChange(step.value);
          }
        }}
        className={cn(
          'flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-start transition',
          isActive
            ? 'border-emerald-800/[0.70] bg-emerald-700/[0.90] text-white shadow-md shadow-emerald-900/[0.20]'
            : 'border-[color:var(--glass-border)] bg-white/60 text-gray-800 hover:border-[color:var(--glass-border-strong)] hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:text-emerald-50/85 dark:hover:border-emerald-300/40 dark:hover:bg-emerald-300/10',
          isDisabled && 'cursor-not-allowed border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-600 opacity-90 hover:border-[color:var(--glass-border)] hover:bg-[color:var(--surface-control)] dark:border-white/10 dark:bg-transparent dark:text-white/40 dark:hover:bg-transparent'
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
            isActive
              ? 'border-white/25 bg-white/[0.18] text-white shadow-sm'
              : isDisabled
                ? 'border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/45'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100'
          )}
          aria-hidden="true"
        >
          {isDisabled ? <LockKeyhole className="h-4 w-4" /> : isPrimary && index < activePrimaryIndex ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block break-words text-sm font-bold leading-snug', isActive && 'text-white')}>{step.label}</span>
          <span className={cn('block text-xs font-medium', isActive ? 'text-white/80' : 'text-gray-600 dark:text-emerald-50/62')}>{statusText}</span>
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label={t('workspace.mobileWorkflow.ariaLabel', 'Workflow navigation')}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] p-3 shadow-sm [backdrop-filter:blur(14px)] [-webkit-backdrop-filter:blur(14px)] dark:border-white/[0.15] dark:bg-black/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-200/80">
            {stepProgress}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-3" aria-live="polite">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <ActiveIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-base font-extrabold leading-tight text-gray-950 dark:text-white">
                {activeStep.label}
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-emerald-50/75">
                {nextStep
                  ? t('workspace.mobileWorkflow.nextAction', {
                      label: nextStep.label,
                      defaultValue: 'Next: {{label}}',
                    })
                  : t('workspace.mobileWorkflow.currentStep', 'Current step')}
              </p>
            </div>
          </div>
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>

      {primarySteps.some((step) => step.disabledReason) && (
        <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
          {gateReason}
        </p>
      )}

      {nextStep && (
        <button
          type="button"
          onClick={() => onStepChange(nextStep.value)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <ArrowRight className={cn('h-4 w-4', isRtl && 'rotate-180')} aria-hidden="true" />
          {t('workspace.mobileWorkflow.nextAction', {
            label: nextStep.label,
            defaultValue: 'Next: {{label}}',
          })}
        </button>
      )}

      <details className="mt-3 group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 py-3 text-sm font-bold text-gray-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-emerald-50">
          <span>{t('workspace.mobileWorkflow.openSteps', 'All steps and tools')}</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3 space-y-2">
          {primarySteps.map((step, index) => renderStepButton(step, index, true))}
          {secondarySteps.length > 0 && (
            <div className="pt-2">
              <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-emerald-50/55">
                {t('workspace.mobileWorkflow.moreTools', 'More tools')}
              </p>
              <div className="space-y-2">
                {secondarySteps.map((step, index) => renderStepButton(step, index, false))}
              </div>
            </div>
          )}
        </div>
      </details>
    </nav>
  );
}
