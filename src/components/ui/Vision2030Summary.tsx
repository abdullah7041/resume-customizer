// src/components/ui/Vision2030Summary.tsx
// Quick-access Vision 2030 summary card for the main workspace

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, ChevronDown, Info, TrendingUp, Sparkles, Upload, Crosshair, Star, Zap, ThumbsUp, Rocket, Check } from 'lucide-react';
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
    // Smart state: Initialize based on persistence or default to collapsed
    const [expanded, setExpanded] = useState(false);

    // Persist state and handle auto-open on new resume
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const storageKey = 'watheq:vision2030_state';
            const savedState = localStorage.getItem(storageKey);
            const currentHash = resumeText ? resumeText.slice(0, 50) : 'demo';

            if (savedState) {
                const { isExpanded, hash } = JSON.parse(savedState);

                // If this is a NEW resume (hash mismatch) and it's not the empty demo state
                // Auto-expand because analysis is "needed"
                if (hash !== currentHash && currentHash !== 'demo') {
                    setExpanded(true);
                    localStorage.setItem(storageKey, JSON.stringify({ isExpanded: true, hash: currentHash }));
                } else {
                    // Otherwise respect the user's last preference
                    setExpanded(isExpanded);
                }
            } else {
                // First time ever? Default to true if we have a resume, false if demo
                // This ensures new users see the feature, but it doesn't annoy demo users
                const initialExpanded = !!resumeText;
                setExpanded(initialExpanded);
                localStorage.setItem(storageKey, JSON.stringify({ isExpanded: initialExpanded, hash: currentHash }));
            }
        } catch (e) {
            console.warn('Failed to restore Vision 2030 state', e);
        }
    }, [resumeText]);

    const toggleExpanded = () => {
        const newState = !expanded;
        setExpanded(newState);

        // Save preference
        if (typeof window !== 'undefined') {
            try {
                const currentHash = resumeText ? resumeText.slice(0, 50) : 'demo';
                localStorage.setItem('watheq:vision2030_state', JSON.stringify({
                    isExpanded: newState,
                    hash: currentHash
                }));
            } catch { }
        }
    };
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
        if (score >= 70) return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]';
        if (score >= 40) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]';
        return 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
        if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
        return 'bg-red-500/10 border-red-500/20';
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
        <div className="mb-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="flex items-start gap-3 relative z-10">
                <div className="p-2 rounded-lg bg-amber-500/10">
                    <Upload className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-1">
                        {t('vision2030.demoMode', 'Example Analysis')}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-white/70 leading-relaxed">
                        {t('vision2030.demoBanner', 'This shows how a well-optimized resume aligns with Vision 2030. Upload yours to see your personal score!')}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <GlassCard className={`p-0 overflow-hidden ${className} transition-all duration-300 border-white/10`}>
            {/* Header - Always Visible */}
            <div
                className={`p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors`}
                onClick={() => toggleExpanded()}
            >
                <div className="flex items-center gap-4 rtl:flex-row-reverse">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse-slow" />
                        <GlassCircle size="lg" variant="success" className="shrink-0 relative z-10 border-emerald-500/30">
                            <Target className="w-6 h-6 text-emerald-400" />
                        </GlassCircle>
                        {analysis && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center z-20">
                                <span className={`text-[10px] font-bold ${analysis.overallScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {Math.round(analysis.overallScore / 10)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                                {t('vision2030.title', 'Vision 2030 Alignment')}
                            </h3>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCalculationModalOpen(true);
                                }}
                                className="group/info relative"
                            >
                                <Info className="w-4 h-4 text-white/40 hover:text-emerald-400 transition-colors" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 dark:text-white/50 font-light">
                            {t('vision2030.subtitle', 'How your skills align with Saudi priorities')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {analysis && (
                        <div className={`px-4 py-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${getScoreBg(analysis.overallScore)}`}>
                            <div className="flex flex-col items-center leading-none">
                                <span className={`text-2xl font-bold tracking-tighter ${getScoreColor(analysis.overallScore)}`}>
                                    {analysis.overallScore}%
                                </span>
                            </div>
                        </div>
                    )}
                    <div
                        className={`p-2 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-300 ${expanded ? 'rotate-180 bg-white/10' : ''}`}
                    >
                        <ChevronDown className="w-4 h-4 text-white/70" />
                    </div>
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-0">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />

                        {/* Demo Mode Banner */}
                        {isDemo && <DemoBanner />}

                        {/* Score Bar */}
                        {analysis && (
                            <div className="mb-6 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg bg-emerald-500/10`}>
                                            {renderEncouragementIcon(getEncouragementMessage(analysis.overallScore).icon)}
                                        </div>
                                        <span className="text-sm font-medium text-emerald-200">
                                            {getEncouragementMessage(analysis.overallScore).message}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400 dark:text-white/40 font-mono">
                                        {analysis.overallScore}/100
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-900/50 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)] transition-all duration-1000 ease-out relative"
                                        style={{ width: `${analysis.overallScore}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Detected Career Path */}
                        {analysis && analysis.detectedCareer && (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-5">
                                <div className="p-2 rounded-full bg-blue-500/10 shrink-0">
                                    <Crosshair className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-300/80 mb-0.5 uppercase tracking-wider font-semibold">
                                        {isArabic ? 'المسار المهني' : 'Detected Career Path'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-blue-100 font-medium">
                                            {isArabic ? analysis.detectedCareer.archetypeNameAr : analysis.detectedCareer.archetypeNameEn}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20">
                                            {analysis.detectedCareer.confidence}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* All Sectors */}
                        {analysis && analysis.sectorBreakdown.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                                        {isArabic ? 'جميع القطاعات' : 'Sector Analysis'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {analysis.sectorBreakdown.map((sector) => (
                                        <div
                                            key={sector.sectorId}
                                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 group ${sector.score > 0
                                                ? 'bg-gradient-to-r from-gray-200/50 dark:from-white/10 to-gray-100 dark:to-white/5 border-gray-200 dark:border-white/10 hover:border-emerald-500/30'
                                                : 'bg-white/[0.02] border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-md ${sector.score > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-white/20'}`}>
                                                    <SectorIcon
                                                        sectorId={sector.sectorId}
                                                        className="w-3.5 h-3.5"
                                                    />
                                                </div>
                                                <span className={`text-xs font-medium ${sector.score > 0 ? 'text-gray-800 dark:text-white/90' : 'text-gray-400 dark:text-white/40'
                                                    }`}>
                                                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                                                </span>
                                            </div>
                                            <span className={`text-xs font-bold ${sector.score > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-white/20'
                                                }`}>
                                                {sector.score}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Expandable Details */}
                        {analysis && (
                            <div className="space-y-5">
                                {/* Matched Skills */}
                                {analysis.matchedSkills.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Sparkles className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                                                {t('vision2030.matchedSkills', 'Matched Vision 2030 Skills')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {analysis.matchedSkills.map((skill, index) => (
                                                <div
                                                    key={index}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 shadow-sm shadow-emerald-900/20"
                                                >
                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                    {isArabic ? skill.skillNameAr : skill.skillNameEn}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Suggested Keywords from Top Sectors */}
                                {analysis.sectorBreakdown.slice(0, 3).some(s => s.suggestedKeywords.length > 0) && (
                                    <div className="bg-amber-500/[0.03] rounded-xl p-4 border border-amber-500/10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1 rounded bg-amber-500/10">
                                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                            </div>
                                            <span className="text-sm font-semibold text-amber-100">
                                                {t('vision2030.suggestions', 'Suggested Skills to Add')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {analysis.sectorBreakdown
                                                .slice(0, 3)
                                                .flatMap(s => s.suggestedKeywords)
                                                .slice(0, 6)
                                                .map((skill, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 transition-colors cursor-default"
                                                    >
                                                        + {skill}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/5">
                            <button
                                type="button"
                                onClick={() => setModalOpen(true)}
                                className="group inline-flex items-center gap-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-2 rounded-lg hover:bg-emerald-500/10"
                            >
                                <Info className="w-4 h-4" />
                                <span className="border-b border-transparent group-hover:border-emerald-300 transition-colors">
                                    {t('vision2030.matchSection.learnMore', 'Learn about Vision 2030')}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
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

