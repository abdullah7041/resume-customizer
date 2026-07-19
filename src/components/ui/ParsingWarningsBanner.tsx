// src/components/ui/ParsingWarningsBanner.tsx
// Reusable banner that surfaces parse-quality warnings to the user.
// Reads resumeData from the store; returns null when there's nothing to show.

import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '@/lib/stores/resumeStore';
import { getParsingWarnings } from '@/lib/validation/parsingWarnings';
import { cn } from '@/lib/utils/cn';

export function ParsingWarningsBanner() {
    const { t } = useTranslation();
    const originalResume = useResumeStore((s) => s.originalResume);
    const [expanded, setExpanded] = useState(false);

    if (!originalResume) return null;

    const warnings = getParsingWarnings(originalResume);
    if (warnings.length === 0) return null;

    return (
        <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-start">
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
                    aria-expanded={expanded}
                >
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t('upload.warnings.title')}
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs tabular-nums">{warnings.length}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                </button>
            </div>

            {expanded && (
                <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="space-y-2">
                        {warnings.map((warning) => (
                            <div
                                key={warning.code}
                                className={cn(
                                    'text-xs p-2 rounded-lg border',
                                    warning.level === 'warning'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100'
                                        : 'bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-500/10 dark:border-teal-500/20 dark:text-teal-100'
                                )}
                            >
                                <span className="font-semibold mr-1">
                                    [{t(`upload.warnings.sections.${warning.sectionId}`)}]
                                </span>
                                {t(warning.messageKey)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
