import { AlertTriangle, AlertCircle, Info, ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './ui/GlassCard';
import type { GapAnalysisItem } from '@/types/analysis';

interface GapAnalysisCardProps {
    gaps: GapAnalysisItem[];
    className?: string;
}

const severityConfig = {
    critical: {
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/30',
        labelKey: 'critical' as const,
    },
    moderate: {
        icon: AlertCircle,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/30',
        labelKey: 'moderate' as const,
    },
    minor: {
        icon: Info,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        border: 'border-blue-200 dark:border-blue-500/30',
        labelKey: 'minor' as const,
    }
};

export function GapAnalysisCard({ gaps, className = '' }: GapAnalysisCardProps) {
    const { t } = useTranslation();
    // Change to Set for multiple expanded items
    const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() => new Set([0]));

    if (!gaps || gaps.length === 0) return null;

    const criticalCount = gaps.filter(g => g.severity === 'critical').length;
    const moderateCount = gaps.filter(g => g.severity === 'moderate').length;
    const _minorCount = gaps.filter(g => g.severity === 'minor').length;

    const toggleGap = (index: number) => {
        setExpandedIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedIndices(new Set(gaps.map((_, i) => i)));
    };

    const collapseAll = () => {
        setExpandedIndices(new Set());
    };

    const allExpanded = gaps.length > 0 && expandedIndices.size === gaps.length;

    return (
        <GlassCard className={className}>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            {t('optimize.gapAnalysis.title', 'Gap Analysis')}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {t('optimize.gapAnalysis.subtitle', 'Critical missing requirements found in your resume')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-2 text-sm">
                            {criticalCount > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                                    {criticalCount} {t('optimize.gapAnalysis.criticalCount', 'Critical')}
                                </span>
                            )}
                            {moderateCount > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                                    {moderateCount} {t('optimize.gapAnalysis.moderateCount', 'Moderate')}
                                </span>
                            )}
                        </div>

                        {/* Expand/Collapse All Controls */}
                        <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 p-0.5">
                            <button
                                type="button"
                                onClick={allExpanded ? collapseAll : expandAll}
                                className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                            >
                                {allExpanded
                                    ? t('optimize.gapAnalysis.collapseAll', 'Collapse All')
                                    : t('optimize.gapAnalysis.expandAll', 'Expand All')
                                }
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gap List */}
                <div className="space-y-3">
                    {gaps.map((gap, index) => {
                        const config = severityConfig[gap.severity];
                        const Icon = config.icon;
                        const isExpanded = expandedIndices.has(index);

                        return (
                            <div
                                key={index}
                                className={`
                                    group rounded-xl border transition-[background-color,border-color,box-shadow] duration-200 overflow-hidden
                                    ${isExpanded
                                        ? `bg-gray-50 dark:bg-white/5 ${config.border} shadow-lg shadow-black/5 dark:shadow-black/20`
                                        : 'bg-transparent border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/10'
                                    }
                                `}
                            >
                                {/* Clickable Header */}
                                <button
                                    type="button"
                                    onClick={() => toggleGap(index)}
                                    className="w-full px-4 py-3.5 flex items-start text-left gap-3"
                                >
                                    <div className={`mt-0.5 p-1.5 rounded-lg ${config.bg} ${config.border} border`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color} opacity-80`}>
                                                {t(`optimize.gapAnalysis.${config.labelKey}`)}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium mt-1 leading-relaxed">
                                            {gap.requirement}
                                        </p>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                <div className={`
                                    grid transition-[grid-template-rows,opacity] duration-[260ms] ease-emphasized
                                    ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
                                `}>
                                    <div className="overflow-hidden">
                                        <div className="px-4 pb-4 pt-0 space-y-4">
                                            {/* Divider */}
                                            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="p-3 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/5">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
                                                        {t('optimize.gapAnalysis.currentState', 'Current State')}
                                                    </p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                        {gap.currentState}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10">
                                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500/70 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                                        <Sparkles className="w-3 h-3" />
                                                        {t('optimize.gapAnalysis.recommendation', 'Recommendation')}
                                                    </p>
                                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                                        {gap.recommendation}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </GlassCard>
    );
}
