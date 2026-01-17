import { useState, useEffect, useRef } from 'react';
import { Upload, Target, Sparkles, Download, Check, ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { cn } from '../../lib/utils/cn';

interface UserProgressNavProps {
    mode?: 'fixed' | 'inline';
    className?: string;
}

export function UserProgressNav({ mode = 'fixed', className }: UserProgressNavProps) {
    const { t } = useTranslation();
    const originalResume = useResumeStore((state) => state.originalResume);
    const optimizationMetrics = useResumeStore((state) => state.optimizationMetrics);
    const optimizations = useResumeStore((state) => state.optimizations);
    const hasDownloaded = useResumeStore((state) => state.hasDownloaded);
    const [isMinimized, setIsMinimized] = useState(true);

    // Derive current step
    const hasResume = !!originalResume;
    const hasMatch = !!optimizationMetrics?.beforeScore;
    const hasOptimization = optimizations.length > 0;

    // Calculate generic active step index (0-3)
    let currentStepIndex = 0;
    if (hasResume) currentStepIndex = 1;
    if (hasMatch) currentStepIndex = 2;
    if (hasOptimization) currentStepIndex = 3;
    if (hasDownloaded) currentStepIndex = 4;

    const isFirstMount = useRef(true);

    // Auto-expand when step changes
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        setIsMinimized(false);
    }, [currentStepIndex]);

    const steps = [
        {
            id: 'upload',
            label: t('nav.workflowSteps.upload'),
            icon: Upload,
            isCompleted: hasResume,
            isActive: currentStepIndex === 0,
        },
        {
            id: 'match',
            label: t('nav.workflowSteps.match'),
            icon: Target,
            isCompleted: hasMatch,
            isActive: currentStepIndex === 1,
        },
        {
            id: 'optimize',
            label: t('nav.workflowSteps.optimize'),
            icon: Sparkles,
            isCompleted: hasOptimization,
            isActive: currentStepIndex === 2,
        },
        {
            id: 'download',
            label: t('nav.workflowSteps.download'),
            icon: Download,
            isCompleted: hasDownloaded,
            isActive: currentStepIndex === 3,
        },
    ];

    if (isMinimized && mode === 'fixed') {
        return (
            <div className="fixed top-24 right-4 z-50 hidden md:block">
                <button
                    onClick={() => setIsMinimized(false)}
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 backdrop-blur-md transition-all hover:scale-110",
                        "bg-gradient-to-br from-emerald-500/80 to-teal-500/80 shadow-lg"
                    )}
                >
                    <ChevronLeft className="h-6 w-6 text-white" />
                </button>
            </div>
        );
    }

    const content = (
        <div
            className={cn(
                "relative flex flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-black/40 backdrop-blur-xl shadow-2xl transition-all duration-300",
                mode === 'inline' ? "h-full" : ""
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-900/80 to-emerald-900/40 px-4 py-3 border-b border-emerald-500/20">
                <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-100">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    {t('nav.workflowSteps.yourWorkflow')}
                </h3>
                {mode === 'fixed' && (
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="rounded-full p-1 text-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="p-4 space-y-1 flex-1">
                {/* Progress Line */}
                <div className="absolute left-[28px] top-[4.5rem] bottom-6 w-px bg-white/5" />
                <div
                    className="absolute left-[28px] top-[4.5rem] w-px bg-gradient-to-b from-emerald-500 to-emerald-500/0 transition-all duration-700 ease-out"
                    style={{ height: `${(currentStepIndex / (steps.length - 1)) * 80}%` }}
                />

                {steps.map((step, idx) => {
                    const Icon = step.isCompleted ? Check : step.icon;
                    // idx is used for mapping, but we don't need isNext for now

                    return (
                        <div
                            key={step.id}
                            className={cn(
                                "relative flex items-center gap-3 py-2 px-2 rounded-lg transition-all duration-300",
                                step.isActive ? "bg-white/5 border border-white/5" : "hover:bg-white/[0.02]"
                            )}
                        >
                            <div
                                className={cn(
                                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
                                    step.isCompleted
                                        ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        : step.isActive
                                            ? "border-emerald-400 bg-emerald-900/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                                            : "border-white/10 bg-black/40 text-white/20"
                                )}
                            >
                                {step.isActive && (
                                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
                                )}
                                <Icon className="h-3 w-3" />
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                                <span className={cn(
                                    "text-xs font-semibold tracking-wide truncate transition-colors duration-300",
                                    step.isCompleted ? "text-emerald-100/90 line-through decoration-emerald-500/30" :
                                        step.isActive ? "text-white" : "text-white/40"
                                )}>
                                    {step.label}
                                </span>
                                {step.isActive && (
                                    <span className="text-[10px] text-emerald-400 font-medium">{t('nav.workflowSteps.inProgress')}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    if (mode === 'fixed') {
        return (
            <div className={cn("fixed top-24 right-4 z-50 hidden w-72 md:block", className)}>
                {content}
            </div>
        );
    }

    return (
        <div className={className}>
            {content}
        </div>
    );
}
