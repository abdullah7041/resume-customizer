import { AlertTriangle, AlertCircle, Info, ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './ui/GlassCard';

export interface GapItem {
    requirement: string;
    currentState: string;
    severity: 'critical' | 'moderate' | 'minor';
    recommendation: string;
}

interface GapAnalysisCardProps {
    gaps: GapItem[];
    className?: string;
}

const severityConfig = {
    critical: {
        icon: AlertTriangle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        label: 'Critical Gap',
        labelAr: 'فجوة حرجة'
    },
    moderate: {
        icon: AlertCircle,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Moderate Gap',
        labelAr: 'فجوة متوسطة'
    },
    minor: {
        icon: Info,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        label: 'Minor Gap',
        labelAr: 'فجوة بسيطة'
    }
};

export function GapAnalysisCard({ gaps, className = '' }: GapAnalysisCardProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    // Change to Set for multiple expanded items
    const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0]));

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
        <GlassCard className={className} variant="elevated">
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-purple-400" />
                            {t('optimize.gapAnalysis.title', 'Gap Analysis')}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {t('optimize.gapAnalysis.subtitle', 'Critical missing requirements found in your resume')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-2 text-sm">
                            {criticalCount > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                                    {criticalCount} {isArabic ? 'حرجة' : 'Critical'}
                                </span>
                            )}
                            {moderateCount > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                                    {moderateCount} {isArabic ? 'متوسطة' : 'Moderate'}
                                </span>
                            )}
                        </div>

                        {/* Expand/Collapse All Controls */}
                        <div className="flex items-center bg-white/5 rounded-lg border border-white/5 p-0.5">
                            <button
                                onClick={allExpanded ? collapseAll : expandAll}
                                className="px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                            >
                                {allExpanded
                                    ? (isArabic ? 'طي الكل' : 'Collapse All')
                                    : (isArabic ? 'توسيع الكل' : 'Expand All')
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
                                    group rounded-xl border transition-all duration-300 overflow-hidden
                                    ${isExpanded
                                        ? `bg-white/5 ${config.border} shadow-lg shadow-black/20`
                                        : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10'
                                    }
                                `}
                            >
                                {/* Clickable Header */}
                                <button
                                    onClick={() => toggleGap(index)}
                                    className="w-full px-4 py-3.5 flex items-start text-left gap-3"
                                >
                                    <div className={`mt-0.5 p-1.5 rounded-lg ${config.bg} ${config.border} border`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color} opacity-80`}>
                                                {isArabic ? config.labelAr : config.label}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                        <p className="text-sm text-white font-medium mt-1 leading-relaxed">
                                            {gap.requirement}
                                        </p>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                <div className={`
                                    grid transition-all duration-300 ease-in-out
                                    ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
                                `}>
                                    <div className="overflow-hidden">
                                        <div className="px-4 pb-4 pt-0 space-y-4">
                                            {/* Divider */}
                                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                                                        {t('optimize.gapAnalysis.currentState', 'Current State')}
                                                    </p>
                                                    <p className="text-xs text-gray-300 leading-relaxed">
                                                        {gap.currentState}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                                    <p className="text-[10px] text-emerald-500/70 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                                        <Sparkles className="w-3 h-3" />
                                                        {t('optimize.gapAnalysis.recommendation', 'Recommendation')}
                                                    </p>
                                                    <p className="text-xs text-emerald-300 leading-relaxed">
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
