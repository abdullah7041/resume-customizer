import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    if (!gaps || gaps.length === 0) return null;

    const criticalCount = gaps.filter(g => g.severity === 'critical').length;
    const moderateCount = gaps.filter(g => g.severity === 'moderate').length;
    const minorCount = gaps.filter(g => g.severity === 'minor').length;

    return (
        <GlassCard className={className}>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        {t('optimize.gapAnalysis.title', 'Gap Analysis')}
                    </h3>
                    <div className="flex gap-3 text-sm">
                        {criticalCount > 0 && (
                            <span className="text-red-400">{criticalCount} {isArabic ? 'حرجة' : 'critical'}</span>
                        )}
                        {moderateCount > 0 && (
                            <span className="text-amber-400">{moderateCount} {isArabic ? 'متوسطة' : 'moderate'}</span>
                        )}
                        {minorCount > 0 && (
                            <span className="text-blue-400">{minorCount} {isArabic ? 'بسيطة' : 'minor'}</span>
                        )}
                    </div>
                </div>

                {/* Gap List */}
                <div className="space-y-3">
                    {gaps.map((gap, index) => {
                        const config = severityConfig[gap.severity];
                        const Icon = config.icon;
                        const isExpanded = expandedIndex === index;

                        return (
                            <div
                                key={index}
                                className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}
                            >
                                {/* Clickable Header */}
                                <button
                                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className={`w-5 h-5 ${config.color}`} />
                                        <div>
                                            <span className={`text-xs font-medium ${config.color}`}>
                                                {isArabic ? config.labelAr : config.label}
                                            </span>
                                            <p className="text-sm text-white font-medium mt-0.5">
                                                {gap.requirement}
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3 border-t border-white/10">
                                        <div className="pt-3">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                {t('optimize.gapAnalysis.currentState', 'Current State')}
                                            </p>
                                            <p className="text-sm text-gray-300">{gap.currentState}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                {t('optimize.gapAnalysis.recommendation', 'Recommendation')}
                                            </p>
                                            <p className="text-sm text-emerald-400">{gap.recommendation}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </GlassCard>
    );
}
