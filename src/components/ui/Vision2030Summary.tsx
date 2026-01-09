// src/components/ui/Vision2030Summary.tsx
// Quick-access Vision 2030 summary card for the main workspace

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, ChevronDown, ChevronUp, Info, TrendingUp, Sparkles, Upload, Crosshair, Star, Zap, ThumbsUp, Rocket } from 'lucide-react';
import { analyzeVision2030Alignment } from '../../lib/utils/vision2030Analyzer';
import { SectorIcon } from '../../lib/utils/vision2030Icons';
import { EXAMPLE_RESUME_TEXT } from '../../lib/data/exampleResume';
import Vision2030Modal from './Vision2030Modal';
import { Vision2030CalculationModal } from './Vision2030CalculationModal';
import { GlassCard } from './GlassCard';
import { GlassCircle } from './GlassCircle';

interface Vision2030SummaryProps {
    resumeText?: string;
    className?: string;
}

export function Vision2030Summary({ resumeText, className = '' }: Vision2030SummaryProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [expanded, setExpanded] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [calculationModalOpen, setCalculationModalOpen] = useState(false);

    // Determine if we're in demo mode (no resume uploaded)
    const isDemo = !resumeText;

    // Use example resume for demo, real data when resume is uploaded
    const textToAnalyze = isDemo ? EXAMPLE_RESUME_TEXT : resumeText;

    // Analyze resume for Vision 2030 alignment
    const analysis = useMemo(() => {
        return analyzeVision2030Alignment(textToAnalyze, isArabic ? 'ar' : 'en');
    }, [textToAnalyze, isArabic]);

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-400';
        if (score >= 40) return 'text-amber-400';
        return 'text-red-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-500/20';
        if (score >= 40) return 'bg-amber-500/20';
        return 'bg-red-500/20';
    };

    // Get encouragement message based on score
    const getEncouragementMessage = (score: number): { message: string; icon: 'star' | 'zap' | 'thumbsUp' | 'rocket' } => {
        if (score >= 80) return {
            message: t('vision2030.summary.excellent', 'Excellent Vision 2030 alignment!'),
            icon: 'star'
        };
        if (score >= 70) return {
            message: t('vision2030.summary.strong', 'Strong alignment with Vision 2030!'),
            icon: 'zap'
        };
        if (score >= 60) return {
            message: t('vision2030.summary.good', 'Good foundation for Vision 2030!'),
            icon: 'thumbsUp'
        };
        return {
            message: t('vision2030.summary.building', 'Building your Vision 2030 profile!'),
            icon: 'rocket'
        };
    };

    // Render icon based on type
    const renderEncouragementIcon = (iconType: string) => {
        const iconClass = "w-4 h-4 text-emerald-400";
        switch (iconType) {
            case 'star': return <Star className={iconClass} />;
            case 'zap': return <Zap className={iconClass} />;
            case 'thumbsUp': return <ThumbsUp className={iconClass} />;
            case 'rocket': return <Rocket className={iconClass} />;
            default: return <Star className={iconClass} />;
        }
    };

    // Demo mode banner component
    const DemoBanner = () => (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
                <Upload className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-xs font-medium text-amber-400">
                        {t('vision2030.demoMode', 'Example Analysis')}
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                        {t('vision2030.demoBanner', 'This shows how a well-optimized resume aligns with Vision 2030. Upload yours to see your personal score!')}
                    </p>
                </div>
            </div>
        </div>
    );
    return (
        <GlassCard className={`p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                    <GlassCircle size="lg" variant="success" className="shrink-0">
                        <Target className="w-5 h-5 text-white" />
                    </GlassCircle>
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            {t('vision2030.title', 'Vision 2030 Alignment')}
                            <button
                                type="button"
                                onClick={() => setCalculationModalOpen(true)}
                                className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full hover:bg-emerald-200 hover:text-emerald-900 transition-colors ring-1 ring-emerald-300"
                                title={isArabic ? 'كيف يتم حساب النتيجة؟' : 'How is this score calculated?'}
                                aria-label={isArabic ? 'عرض تفاصيل الحساب' : 'Show calculation details'}
                            >
                                ?
                            </button>
                        </h3>
                        <p className="text-xs text-white/60">
                            {t('vision2030.subtitle', 'How your skills align with Saudi priorities')}
                        </p>
                    </div>
                </div>
                {analysis && (
                    <div className={`px-3 py-1.5 rounded-full ${getScoreBg(analysis.overallScore)}`}>
                        <span className={`text-xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                            {analysis.overallScore}%
                        </span>
                    </div>
                )}
            </div>

            {/* Demo Mode Banner */}
            {isDemo && <DemoBanner />}

            {/* Score Bar */}
            {analysis && (
                <div className="mb-4">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#006C35] to-[#4ade80] transition-all duration-500"
                            style={{ width: `${analysis.overallScore}%` }}
                        />
                    </div>
                    {/* Encouragement Message */}
                    <div className="mt-2 flex items-center gap-2">
                        {renderEncouragementIcon(getEncouragementMessage(analysis.overallScore).icon)}
                        <span className="text-xs text-emerald-300 font-medium">
                            {getEncouragementMessage(analysis.overallScore).message}
                        </span>
                    </div>
                </div>
            )}

            {/* Detected Career Path */}
            {analysis && analysis.detectedCareer && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 mb-3">
                    <Crosshair className="w-4 h-4" />
                    <span>
                        {isArabic
                            ? `المسار المهني المكتشف: ${analysis.detectedCareer.archetypeNameAr}`
                            : `Detected Career Path: ${analysis.detectedCareer.archetypeNameEn}`
                        }
                    </span>
                    <span className="text-xs text-white/50">
                        ({analysis.detectedCareer.confidence})
                    </span>
                </div>
            )}

            {/* All Sectors */}
            {analysis && analysis.sectorBreakdown.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-[#4ade80]" />
                        <span className="text-sm font-medium text-white/80">
                            {isArabic ? 'جميع القطاعات' : 'All Sectors'}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {analysis.sectorBreakdown.map((sector) => (
                            <div
                                key={sector.sectorId}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${sector.score > 0
                                    ? 'bg-white/5 border-white/10'
                                    : 'bg-white/[0.02] border-white/5'
                                    }`}
                            >
                                <SectorIcon
                                    sectorId={sector.sectorId}
                                    className={`w-4 h-4 ${sector.score > 0 ? 'text-[#4ade80]' : 'text-white/30'
                                        }`}
                                />
                                <span className={`text-xs ${sector.score > 0 ? 'text-white/80' : 'text-white/40'
                                    }`}>
                                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                                </span>
                                <span className={`text-xs font-medium ${sector.score > 0 ? 'text-emerald-400' : 'text-white/30'
                                    }`}>
                                    {sector.score}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Expandable Details */}
            {analysis && expanded && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                    {/* Matched Skills */}
                    {analysis.matchedSkills.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-[#4ade80]" />
                                <span className="text-sm font-medium text-white/80">
                                    {t('vision2030.matchedSkills', 'Matched Vision 2030 Skills')}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.matchedSkills.map((skill, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-0.5 text-xs rounded-full bg-[#006C35]/20 text-[#4ade80]"
                                    >
                                        {isArabic ? skill.skillNameAr : skill.skillNameEn}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested Keywords from Top Sectors */}
                    {analysis.sectorBreakdown.slice(0, 3).some(s => s.suggestedKeywords.length > 0) && (
                        <div>
                            <span className="text-sm font-medium text-white/80">
                                {t('vision2030.suggestions', 'Suggested Skills to Add')}:
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {analysis.sectorBreakdown
                                    .slice(0, 3)
                                    .flatMap(s => s.suggestedKeywords)
                                    .slice(0, 6)
                                    .map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#4ade80] hover:text-white transition-colors"
                >
                    <Info className="w-3 h-3" />
                    {t('vision2030.matchSection.learnMore', 'Learn about Vision 2030')}
                </button>
                {analysis && (
                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors"
                    >
                        {expanded ? (
                            <>
                                {isArabic ? 'إخفاء' : 'Hide'}
                                <ChevronUp className="w-3 h-3" />
                            </>
                        ) : (
                            <>
                                {t('vision2030.matchSection.viewDetails', 'View Details')}
                                <ChevronDown className="w-3 h-3" />
                            </>
                        )}
                    </button>
                )}
            </div>

            <Vision2030Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
            <Vision2030CalculationModal
                isOpen={calculationModalOpen}
                onClose={() => setCalculationModalOpen(false)}
                isArabic={isArabic}
            />
        </GlassCard>
    );
}

export default Vision2030Summary;

