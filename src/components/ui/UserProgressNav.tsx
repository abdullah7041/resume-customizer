import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Target, Sparkles, Download, Check, ChevronLeft, X, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { cn } from '../../lib/utils/cn';
import { getCompatibleStorageItem, removeCompatibleStorageItem, setCompatibleStorageItem } from '../../lib/utils/storage-migration';

interface UserProgressNavProps {
    mode?: 'fixed' | 'inline';
    className?: string;
}

const STORAGE_KEY = 'watheq:workflow-panel-position';
const MINIMIZED_STORAGE_KEY = 'watheq:workflow-panel-minimized';
const LAST_STEP_STORAGE_KEY = 'watheq:workflow-panel-last-step';

interface Position {
    x: number;
    y: number;
}

function getInitialPosition(): Position {
    if (typeof window === 'undefined') return { x: 0, y: 0 };

    try {
        const saved = getCompatibleStorageItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate the position is still within viewport
            const maxX = window.innerWidth - 288; // 72rem = 288px panel width
            const maxY = window.innerHeight - 200; // Approximate panel height
            return {
                x: Math.min(Math.max(0, parsed.x), maxX),
                y: Math.min(Math.max(0, parsed.y), maxY)
            };
        }
    } catch {
        // Ignore parse errors
    }
    return { x: 0, y: 0 }; // Defaults to CSS positioning
}

export function UserProgressNav({ mode = 'fixed', className }: UserProgressNavProps) {
    const { t } = useTranslation();
    const originalResume = useResumeStore((state) => state.originalResume);
    const optimizationMetrics = useResumeStore((state) => state.optimizationMetrics);
    const optimizations = useResumeStore((state) => state.optimizations);
    const hasDownloaded = useResumeStore((state) => state.hasDownloaded);
    const [isMinimized, setIsMinimized] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = getCompatibleStorageItem(MINIMIZED_STORAGE_KEY);
        return saved !== null ? saved === 'true' : true;
    });

    // Persist minimized state preference
    useEffect(() => {
        setCompatibleStorageItem(MINIMIZED_STORAGE_KEY, String(isMinimized));
    }, [isMinimized]);

    // Track the highest step the user has seen to prevent auto-opening on refresh
    const [lastSeenStep, setLastSeenStep] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const saved = getCompatibleStorageItem(LAST_STEP_STORAGE_KEY);
        return saved ? parseInt(saved, 10) : 0;
    });

    // Drag state
    const [position, setPosition] = useState<Position>(getInitialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

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

    // Auto-expand only on FORWARD progress (when moving to a new step)
    useEffect(() => {
        if (currentStepIndex > lastSeenStep) {
            setIsMinimized(false);
            setLastSeenStep(currentStepIndex);
            setCompatibleStorageItem(LAST_STEP_STORAGE_KEY, String(currentStepIndex));
        } else if (currentStepIndex !== lastSeenStep) {
            // Sync without expanding if going backward or just syncing
            setLastSeenStep(currentStepIndex);
            setCompatibleStorageItem(LAST_STEP_STORAGE_KEY, String(currentStepIndex));
        }
    }, [currentStepIndex, lastSeenStep]);

    // Save position to localStorage when it changes
    useEffect(() => {
        if (position.x !== 0 || position.y !== 0) {
            setCompatibleStorageItem(STORAGE_KEY, JSON.stringify(position));
        }
    }, [position]);

    // Drag handlers
    const hasDraggedRef = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (mode !== 'fixed') return;
        e.preventDefault();
        setIsDragging(true);
        hasDraggedRef.current = false;
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: position.x,
            posY: position.y
        };
    }, [mode, position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStartRef.current) return;

        const deltaX = e.clientX - dragStartRef.current.mouseX;
        const deltaY = e.clientY - dragStartRef.current.mouseY;

        // Mark as dragged if moved more than 5 pixels
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasDraggedRef.current = true;
        }

        const newX = dragStartRef.current.posX + deltaX;
        const newY = dragStartRef.current.posY + deltaY;

        // Constrain to viewport
        const maxX = window.innerWidth - 288;
        const maxY = window.innerHeight - 100;

        setPosition({
            x: Math.min(Math.max(-window.innerWidth + 320, newX), maxX),
            y: Math.min(Math.max(-80, newY), maxY)
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    // Add/remove global mouse listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Reset position handler
    const handleResetPosition = useCallback(() => {
        setPosition({ x: 0, y: 0 });
        removeCompatibleStorageItem(STORAGE_KEY);
    }, []);

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
            <div
                className={cn(
                    "fixed top-24 right-4 z-50 hidden md:block",
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleResetPosition}
            >
                <button
                    onClick={(e) => {
                        // Only open if no actual drag occurred
                        if (!hasDraggedRef.current) setIsMinimized(false);
                    }}
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 backdrop-blur-md transition-all",
                        "bg-gradient-to-br from-emerald-500/80 to-teal-500/80 shadow-lg",
                        !isDragging && "hover:scale-110"
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
                "relative flex flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-white/80 dark:bg-black/40 backdrop-blur-xl shadow-2xl transition-all duration-300",
                mode === 'inline' ? "h-full" : ""
            )}
        >
            {/* Header - Draggable */}
            <div
                ref={dragRef}
                onMouseDown={handleMouseDown}
                onDoubleClick={mode === 'fixed' ? handleResetPosition : undefined}
                className={cn(
                    "flex items-center justify-between bg-gradient-to-r from-emerald-100/80 to-emerald-50/40 dark:from-emerald-900/80 dark:to-emerald-900/40 px-4 py-3 border-b border-emerald-500/20",
                    mode === 'fixed' && "cursor-grab select-none",
                    isDragging && "cursor-grabbing"
                )}
            >
                <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-100">
                    {mode === 'fixed' && (
                        <GripVertical className="h-4 w-4 text-emerald-400/50 flex-shrink-0" />
                    )}
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
                <div className="absolute left-[28px] top-[4.5rem] bottom-6 w-px bg-gray-200 dark:bg-white/5" />
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
                                step.isActive ? "bg-emerald-50 dark:bg-white/5 border border-emerald-200/50 dark:border-white/5" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                            )}
                        >
                            <div
                                className={cn(
                                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-500",
                                    step.isCompleted
                                        ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        : step.isActive
                                            ? "border-emerald-400 bg-emerald-900/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                                            : "border-gray-300 dark:border-white/10 bg-gray-100 dark:bg-black/40 text-gray-400 dark:text-white/20"
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
                                    step.isCompleted ? "text-emerald-700 dark:text-emerald-100/90 line-through decoration-emerald-500/30" :
                                        step.isActive ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-white/40"
                                )}>
                                    {step.label}
                                </span>
                                {step.isActive && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{t('nav.workflowSteps.inProgress')}</span>
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
            <div
                className={cn(
                    "fixed top-24 right-4 z-50 hidden w-72 md:block transition-shadow",
                    isDragging && "shadow-2xl",
                    className
                )}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
            >
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
