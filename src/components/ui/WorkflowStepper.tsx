/**
 * WorkflowStepper
 *
 * Visible guided workflow for the core resume flow:
 *   Resume → Job Ad → Match → Optimize → Export / Pipeline
 *
 * Each step is completed / active / upcoming / locked, with distinct, accessible
 * states. Steps are buttons that navigate to the owning tab; locked steps are
 * disabled with a tooltip. Styling follows the Warm Saudi Premium direction —
 * warm surfaces, calm emerald accents, low-noise borders.
 */

import { Check, Lock } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

export type WorkflowStepStatus = 'completed' | 'active' | 'upcoming' | 'locked';

export interface WorkflowStep {
  id: string;
  label: string;
  hint?: string;
  status: WorkflowStepStatus;
  /** Tab to navigate to when the step is clicked. */
  targetTab: string;
  /** Shown via title when the step is locked. */
  lockedReason?: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  onStepClick: (targetTab: string) => void;
  className?: string;
}

export function WorkflowStepper({ steps, onStepClick, className }: WorkflowStepperProps) {
  return (
    <nav aria-label="Resume workflow" className={cn('w-full', className)}>
      {/* Glass shell wrapper for strong light-mode visibility */}
      <div className="rounded-2xl border border-[color:var(--glass-border-strong)] bg-[color:var(--surface-glass)] p-2.5 shadow-sm [backdrop-filter:blur(14px)] [-webkit-backdrop-filter:blur(14px)] dark:border-white/[0.12] dark:bg-[#041c17]/[0.80]">
        <ol className="flex w-full items-stretch gap-1.5 sm:gap-2">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isLocked = step.status === 'locked';
            const stepNumber = index + 1;

            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => !isLocked && onStepClick(step.targetTab)}
                  disabled={isLocked}
                  aria-current={isActive ? 'step' : undefined}
                  title={isLocked ? step.lockedReason : undefined}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition-colors sm:px-3',
                    isActive &&
                      'border-emerald-800/[0.70] bg-emerald-700/[0.90] shadow-md shadow-emerald-900/[0.20]',
                    isCompleted &&
                      'border-emerald-500/40 bg-emerald-500/[0.12] hover:bg-emerald-500/[0.18]',
                    step.status === 'upcoming' &&
                      'border-[color:var(--glass-border)] bg-white/60 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10',
                    isLocked &&
                      'cursor-not-allowed border-[color:var(--glass-border)] bg-[color:var(--surface-control)] opacity-80 dark:bg-transparent dark:opacity-60'
                  )}
                >
                  {/* Step marker */}
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      isActive && 'border border-white/25 bg-white/[0.18] text-white shadow-sm',
                      isCompleted && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                      step.status === 'upcoming' &&
                        'bg-gray-200/70 text-gray-600 dark:bg-white/10 dark:text-gray-300',
                      isLocked && 'bg-gray-200/60 text-gray-500 dark:bg-white/5 dark:text-gray-500'
                    )}
                    aria-hidden="true"
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isLocked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      stepNumber
                    )}
                  </span>

                  {/* Label always visible; hint hidden on small screens to reduce clutter */}
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span
                      className={cn(
                        'truncate text-xs font-bold',
                        isActive
                          ? 'text-white'
                          : isCompleted
                            ? 'text-gray-800 dark:text-emerald-100/90'
                            : 'text-gray-600 dark:text-emerald-100/70'
                      )}
                    >
                      {step.label}
                    </span>
                    {step.hint && (
                      <span className={cn(
                        'hidden truncate text-[11px] sm:block',
                        isActive
                          ? 'text-white/80'
                          : 'text-gray-500 dark:text-emerald-100/55'
                      )}>
                        {step.hint}
                      </span>
                    )}
                  </span>
                </button>

                {/* Connector */}
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mx-1 hidden h-px w-3 shrink-0 sm:block lg:w-5',
                      isCompleted ? 'bg-emerald-500/40' : 'bg-[color:var(--glass-border)]'
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default WorkflowStepper;
