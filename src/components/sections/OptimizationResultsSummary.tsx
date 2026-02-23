import { useMemo, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import {
    TrendingUp,
    CheckCircle2,
    Target,
    Sparkles,
    ArrowRight,
    Download,
    Plus,
    Zap,
    Share2,
} from 'lucide-react';

const ShareScoreCard = lazy(() => import('../ui/ShareScoreCard'));

interface OptimizationResultsSummaryProps {
    // Scores
    beforeScore: number;
    afterScore: number; // Current score based on applied optimizations
    potentialScore?: number; // Maximum possible if all applied

    // Optimizations
    totalOptimizations: number;
    appliedOptimizations: number;
    optimizationsBySection: {
        section: string;
        count: number;
        applied: number;
    }[];

    // Keywords
    keywordsAdded: string[];
    keywordsFromJD: string[]; // All keywords from job description
    matchedKeywords?: string[]; // Keywords resume already has

    // Visibility
    isVisible: boolean;
    hasJobDescription: boolean;

    // Actions
    onExport?: () => void;
    onApplyAll?: () => void;

    // Vision 2030
    vision2030?: {
        overallScore: number;
        primarySector: { id: string; nameEn: string; nameAr: string; icon: string } | null;
        secondarySectors: { id: string; nameEn: string; nameAr: string; icon: string }[];
        matchedSkillsCount: number;
        topMatchedSkills: string[];
        detectedCareer: { nameEn: string; nameAr: string } | null;
    } | null;
}

// Animated score display component
function AnimatedScore({
    score,
    label,
    variant
}: {
    score: number;
    label: string;
    variant: 'before' | 'after'
}) {
    const { t } = useTranslation();

    // Determine color based on score
    const getScoreColor = (s: number, isAfter: boolean) => {
        if (!isAfter) return 'text-gray-400';
        if (s >= 80) return 'text-emerald-400';
        if (s >= 60) return 'text-yellow-400';
        return 'text-orange-400';
    };

    const getBgColor = (s: number, isAfter: boolean) => {
        if (!isAfter) return 'bg-white/5';
        if (s >= 80) return 'bg-emerald-500/10';
        if (s >= 60) return 'bg-yellow-500/10';
        return 'bg-orange-500/10';
    };

    return (
        <div className={cn(
            'flex flex-col items-center p-6 rounded-2xl border transition-all',
            getBgColor(score, variant === 'after'),
            variant === 'after'
                ? 'border-emerald-500/30'
                : 'border-white/10'
        )}>
            <span className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                {label}
            </span>
            <div className="flex items-baseline">
                <span className={cn(
                    'text-5xl font-bold tabular-nums transition-colors',
                    getScoreColor(score, variant === 'after')
                )}>
                    {score}
                </span>
                <span className="text-2xl text-gray-500 ml-1">%</span>
            </div>
            <span className="text-sm text-gray-400 mt-1">
                {t('sections.optimizationResults.matchScore', 'Match Score')}
            </span>
        </div>
    );
}

// Circular progress indicator
function ImprovementRing({
    improvement,
    size = 80
}: {
    improvement: number;
    size?: number
}) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(improvement / 30, 1); // Cap at 30% for full ring
    const offset = circumference - (progress * circumference);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                {/* Background ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-white/10"
                />
                {/* Progress ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    className="text-emerald-400 transition-all duration-1000"
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-emerald-400">
                    +{improvement}%
                </span>
            </div>
        </div>
    );
}

// Vision 2030 alignment card component
function Vision2030Card({
    vision2030,
}: {
    vision2030: NonNullable<OptimizationResultsSummaryProps['vision2030']>;
}) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    if (!vision2030.primarySector) return null;

    // Determine alignment level
    const getAlignmentLevel = (score: number) => {
        if (score >= 70) return { label: t('vision2030.strong', 'Strong'), labelClass: 'text-emerald-400' };
        if (score >= 40) return { label: t('vision2030.good', 'Good'), labelClass: 'text-yellow-400' };
        return { label: t('vision2030.basic', 'Basic'), labelClass: 'text-orange-400' };
    };

    const alignment = getAlignmentLevel(vision2030.overallScore);

    return (
        <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/5 rounded-xl border border-emerald-500/20 mb-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg">
                        🇸🇦
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-white">
                            {t('vision2030.resultsAlignment', 'Vision 2030 Alignment')}
                        </h4>
                        <p className="text-xs text-gray-400">
                            {t('vision2030.targetSectors', 'Target Sectors')}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={cn('text-lg font-bold', alignment.labelClass)}>
                        {alignment.label}
                    </span>
                    <p className="text-xs text-gray-500">{vision2030.overallScore}%</p>
                </div>
            </div>

            {/* Primary Sector */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{vision2030.primarySector.icon}</span>
                <span className="text-sm font-medium text-white">
                    {isArabic ? vision2030.primarySector.nameAr : vision2030.primarySector.nameEn}
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                    {t('vision2030.primary', 'Primary')}
                </span>
            </div>

            {/* Secondary Sectors */}
            {vision2030.secondarySectors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {vision2030.secondarySectors.map((sector) => (
                        <span
                            key={sector.id}
                            className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg text-xs text-gray-300"
                        >
                            <span>{sector.icon}</span>
                            <span>{isArabic ? sector.nameAr : sector.nameEn}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* Detected Career */}
            {vision2030.detectedCareer && (
                <div className="mt-3 pt-2 border-t border-white/5">
                    <p className="text-xs text-gray-400">
                        {t('vision2030.detectedCareerPath', 'Detected Career Path')}
                    </p>
                    <p className="text-sm text-white mt-1">
                        {isArabic ? vision2030.detectedCareer.nameAr : vision2030.detectedCareer.nameEn}
                    </p>
                </div>
            )}

            {/* Matched Vision 2030 Skills */}
            {vision2030.topMatchedSkills.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-gray-400 mb-2">
                        {t('vision2030.skillsDetected', 'Vision 2030 Skills Detected')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {vision2030.topMatchedSkills.map((skill, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 bg-white/5 text-gray-300 text-xs rounded-md border border-white/10"
                            >
                                {skill}
                            </span>
                        ))}
                        {vision2030.matchedSkillsCount > 6 && (
                            <span className="px-2 py-1 text-xs text-gray-500">
                                +{vision2030.matchedSkillsCount - 6}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function OptimizationResultsSummary({
    beforeScore,
    afterScore,
    potentialScore,
    totalOptimizations,
    appliedOptimizations,
    optimizationsBySection,
    keywordsAdded,
    keywordsFromJD,
    matchedKeywords,
    isVisible,
    hasJobDescription,
    onExport,
    onApplyAll,
    vision2030,
}: OptimizationResultsSummaryProps) {
    const { t } = useTranslation();

    // Calculate improvement
    const improvement = afterScore - beforeScore;
    const hasImprovement = improvement > 0;
    const allApplied = appliedOptimizations === totalOptimizations;
    const showShareButton = hasJobDescription && improvement > 10;
    const [showShareCard, setShowShareCard] = useState(false);

    // Get applied sections summary
    const appliedSections = useMemo(() => {
        return optimizationsBySection
            .filter(s => s.applied > 0)
            .map(s => {
                return t(`sections.optimizationResults.sectionLabels.${s.section}`, s.section);
            });
    }, [optimizationsBySection, t]);

    // Track visibility
    useMemo(() => {
        if (isVisible && totalOptimizations > 0) {
            analytics.track('results_summary_viewed', {
                before_score: beforeScore,
                after_score: afterScore,
                improvement,
                total_optimizations: totalOptimizations,
                applied_optimizations: appliedOptimizations,
                has_job_description: hasJobDescription,
            });
        }
    }, [isVisible, totalOptimizations, beforeScore, afterScore, improvement, appliedOptimizations, hasJobDescription]);

    if (!isVisible || totalOptimizations === 0) return null;

    return (
        <div className="mt-8">
            <GlassCard
                variant="default"
                padding="lg"
                className="relative overflow-hidden"
            >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-purple-500/20 rounded-xl">
                            <Target className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white">
                                {t('sections.optimizationResults.title', 'Optimization Results')}
                            </h3>
                            <p className="text-sm text-gray-400">
                                {t('sections.optimizationResults.subtitle', 'How your resume improved to match the job')}
                            </p>
                        </div>
                    </div>

                    {/* Score Comparison */}
                    {hasJobDescription && (
                        <div className="flex items-center justify-center gap-4 mb-8">
                            <AnimatedScore
                                score={beforeScore}
                                label={t('sections.optimizationResults.before', 'Before')}
                                variant="before"
                            />

                            <div className="flex flex-col items-center px-4">
                                <ArrowRight className="w-8 h-8 text-emerald-400 mb-2" />
                                {hasImprovement && (
                                    <ImprovementRing improvement={improvement} />
                                )}
                            </div>

                            <AnimatedScore
                                score={afterScore}
                                label={t('sections.optimizationResults.after', 'After')}
                                variant="after"
                            />
                        </div>
                    )}

                    {/* Vision 2030 Alignment Card */}
                    {vision2030 && vision2030.primarySector && (
                        <Vision2030Card vision2030={vision2030} />
                    )}

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">{totalOptimizations}</p>
                            <p className="text-xs text-gray-400">
                                {t('sections.optimizationResults.improvementsFound', 'Improvements Found')}
                            </p>
                        </div>

                        <div className="text-center p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">{appliedOptimizations}</p>
                            <p className="text-xs text-gray-400">
                                {t('sections.optimizationResults.applied', 'Applied')}
                            </p>
                        </div>

                        <div className="text-center p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-yellow-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {hasJobDescription ? `+${improvement}%` : '-'}
                            </p>
                            <p className="text-xs text-gray-400">
                                {t('sections.optimizationResults.scoreBoost', 'Score Boost')}
                            </p>
                            {/* Show potential if not all applied */}
                            {potentialScore && potentialScore > afterScore && (
                                <p className="text-xs text-emerald-400 mt-1">
                                    {t('sections.optimizationResults.potentialBoost', 'Up to +{{points}}% possible', { points: potentialScore - beforeScore })}
                                </p>
                            )}
                        </div>

                        {/* Vision 2030 Stats */}
                        {vision2030 && vision2030.primarySector ? (
                            <div className="text-center p-4 bg-white/5 rounded-xl border border-emerald-500/20 card-shine">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <span className="text-sm">🇸🇦</span>
                                </div>
                                <p className="text-2xl font-bold text-white">
                                    {1 + vision2030.secondarySectors.length}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {t('vision2030.sectors', '2030 Sectors')}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-white/5 rounded-xl opacity-50">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <span className="text-sm">🇸🇦</span>
                                </div>
                                <p className="text-xl font-bold text-white">-</p>
                                <p className="text-xs text-gray-400">
                                    {t('vision2030.sectors', '2030 Sectors')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Keywords Added */}
                    {keywordsAdded.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Plus className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-sm font-medium text-gray-300">
                                    {t('sections.optimizationResults.keywordsAdded', 'Keywords Added to Match JD')}
                                </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {keywordsAdded.slice(0, 10).map((keyword, idx) => (
                                    <span
                                        key={idx}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-sm font-medium',
                                            'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                                            keywordsFromJD.includes(keyword) && 'ring-1 ring-emerald-400'
                                        )}
                                    >
                                        {keyword}
                                        {keywordsFromJD.includes(keyword) && (
                                            <Zap className="w-3 h-3 inline ml-1 text-emerald-400" />
                                        )}
                                    </span>
                                ))}
                                {keywordsAdded.length > 10 && (
                                    <span className="px-3 py-1.5 text-sm text-gray-400">
                                        +{keywordsAdded.length - 10} {t('sections.optimizationResults.more', 'more')}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Keywords Already Matching */}
                    {matchedKeywords && matchedKeywords.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-sm font-medium text-gray-300">
                                    {t('sections.optimizationResults.keywordsMatching', 'Keywords Already Matching JD')}
                                </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {matchedKeywords.slice(0, 8).map((keyword, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/10 text-gray-300 border border-white/10"
                                    >
                                        {keyword}
                                    </span>
                                ))}
                                {matchedKeywords.length > 8 && (
                                    <span className="px-3 py-1.5 text-sm text-gray-400">
                                        +{matchedKeywords.length - 8} {t('sections.optimizationResults.more', 'more')}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Applied Improvements */}
                    {appliedSections.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-300 mb-3">
                                {t('sections.optimizationResults.improvementsApplied', 'Improvements Applied')}
                            </h4>
                            <div className="space-y-2">
                                {appliedSections.map((section, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 text-sm text-gray-300"
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span>{section}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                        {!allApplied && onApplyAll && (
                            <GlassButton
                                variant="primary"
                                size="md"
                                onClick={() => {
                                    analytics.track('apply_all_from_summary');
                                    onApplyAll();
                                }}
                                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                            >
                                {t('sections.optimizationResults.applyAll', 'Apply All ({{remaining}} remaining)', { remaining: totalOptimizations - appliedOptimizations })}
                            </GlassButton>
                        )}

                        {onExport && (
                            <GlassButton
                                variant="secondary"
                                size="md"
                                onClick={() => {
                                    analytics.track('export_from_summary');
                                    onExport();
                                }}
                                leftIcon={<Download className="w-4 h-4" />}
                            >
                                {t('sections.optimizationResults.exportPdf', 'Export PDF')}
                            </GlassButton>
                        )}

                        {showShareButton && (
                            <GlassButton
                                variant="secondary"
                                size="md"
                                onClick={() => {
                                    analytics.track('share_card_opened', {
                                        before_score: beforeScore,
                                        after_score: afterScore,
                                        improvement,
                                    });
                                    setShowShareCard(true);
                                }}
                                leftIcon={<Share2 className="w-4 h-4" />}
                            >
                                {t('sections.optimizationResults.shareResult', 'Share Your Result')}
                            </GlassButton>
                        )}
                    </div>
                </div>
            </GlassCard>

            {showShareCard && (
                <Suspense fallback={null}>
                    <ShareScoreCard
                        beforeScore={beforeScore}
                        afterScore={afterScore}
                        onClose={() => setShowShareCard(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}

export default OptimizationResultsSummary;
