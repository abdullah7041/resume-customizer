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

import { Check, ChevronRight, Lock } from 'lucide-react';
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
    <nav aria-label="Resume workflow" className={cn('workflow-stepper w-full', className)}>
      <div className="overflow-hidden rounded-xl border border-emerald-700/15 bg-emerald-100/75 p-1 shadow-sm dark:border-emerald-400/15 dark:bg-emerald-950/70">
        <ol className="grid w-full auto-cols-fr grid-flow-col items-stretch">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isLocked = step.status === 'locked';
            const stepNumber = index + 1;

            return (
              <li key={step.id} className="relative flex min-w-0 items-stretch">
                <button
                  type="button"
                  onClick={() => !isLocked && onStepClick(step.targetTab)}
                  disabled={isLocked}
                  aria-current={isActive ? 'step' : undefined}
                  title={isLocked ? step.lockedReason : undefined}
                  className={cn(
                    'group flex h-full w-full items-center gap-2.5 rounded-lg px-3 py-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] lg:px-4',
                    isActive &&
                      'bg-emerald-700 text-white shadow-sm',
                    isCompleted &&
                      'hover:bg-emerald-500/15',
                    step.status === 'upcoming' &&
                      'hover:bg-emerald-500/10',
                    isLocked &&
                      'cursor-not-allowed opacity-65'
                  )}
                >
                  {/* Step marker */}
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      isActive && 'border border-white/25 bg-white/[0.18] text-white shadow-sm',
                      isCompleted && 'bg-emerald-700 text-white',
                      step.status === 'upcoming' &&
                        'bg-emerald-700/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
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
                        'text-xs font-bold leading-snug lg:text-sm',
                        isActive
                          ? 'text-white'
                          : isCompleted
                            ? 'text-emerald-950 dark:text-emerald-50'
                            : 'text-emerald-950 dark:text-emerald-100/80'
                      )}
                    >
                      {step.label}
                    </span>
                    {step.hint && (
                      <span className={cn(
                        'mt-0.5 hidden text-[11px] sm:block',
                        isActive
                          ? 'text-white/80'
                          : 'text-emerald-950/70 dark:text-emerald-100/65'
                      )}>
                        {step.hint}
                      </span>
                    )}
                  </span>
                </button>
                {index < steps.length - 1 && <ChevronRight className="pointer-events-none absolute -end-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-emerald-700/55 rtl:rotate-180 dark:text-emerald-300/50" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default WorkflowStepper;
