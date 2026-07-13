// src/components/ui/ParsingWarningsBanner.tsx
// Reusable banner that surfaces parse-quality warnings to the user.
// Reads resumeData from the store; returns null when there's nothing to show.

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResumeStore } from '@/lib/stores/resumeStore';
import { getParsingWarnings } from '@/lib/validation/parsingWarnings';
import { cn } from '@/lib/utils/cn';

export function ParsingWarningsBanner() {
    const { t } = useTranslation();
    const originalResume = useResumeStore((s) => s.originalResume);

    if (!originalResume) return null;

    const warnings = getParsingWarnings(originalResume);
    if (warnings.length === 0) return null;

    return (
        <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
            <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 w-full">
                        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            {t('upload.warnings.title')}
                        </h4>
                        <div className="space-y-2">
                            {warnings.map((warning, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        'text-xs p-2 rounded-lg border',
                                        warning.level === 'warning'
                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100'
                                            : 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100'
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
                </div>
            </div>
        </div>
    );
}
