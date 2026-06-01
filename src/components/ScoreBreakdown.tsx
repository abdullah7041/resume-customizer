import { TrendingUp, Code2, Briefcase, GraduationCap, Users, Info, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';

// New categorical scores structure
export interface CategoryScore {
    score: number;
    max: number;
    matched?: string[];
    missing?: string[];
    gaps?: string[];
    reasoning?: string;
}

export interface CategoryScoresData {
    hard_skills: CategoryScore;
    experience: CategoryScore;
    education: CategoryScore;
    soft_skills: CategoryScore;
}

// Legacy structure for backwards compatibility
export interface ScoreBreakdownData {
    base_score: number;
    skill_match_bonus: number;
    keyword_coverage_bonus: number;
    gap_penalties: number;
    final_score: number;
    score_explanation: string;
}

interface ScoreBreakdownProps {
    data?: ScoreBreakdownData | null;
    categoryScores?: CategoryScoresData | null;
    beforeScore: number;
    afterScore: number;
    isPlaceholderScore?: boolean;
    isPlaceholderImprovement?: boolean;
    className?: string;
}

const CATEGORY_CONFIG = {
    hard_skills: {
        icon: Code2,
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/20',
        barClass: 'bg-blue-500',
        variant: 'blue' as const
    },
    experience: {
        icon: Briefcase,
        colorClass: 'text-purple-400',
        bgClass: 'bg-purple-500/20',
        barClass: 'bg-purple-500',
        variant: 'purple' as const
    },
    education: {
        icon: GraduationCap,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/20',
        barClass: 'bg-amber-500',
        variant: 'warning' as const
    },
    soft_skills: {
        icon: Users,
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/20',
        barClass: 'bg-emerald-500',
        variant: 'success' as const
    }
} as const;

export function ScoreBreakdown({
    data,
    categoryScores,
    beforeScore,
    afterScore,
    isPlaceholderScore = false,
    isPlaceholderImprovement = false,
    className = ''
}: ScoreBreakdownProps) {
    const { t } = useTranslation();
    // Improvement calculation available but currently unused - kept for future features
    // const improvement = afterScore - beforeScore;
    const [expanded, setExpanded] = useState(true);

    // Use new categorical scores if available
    if (categoryScores) {
        const categories = [
            { key: 'hard_skills' as const, label: t('optimize.scoreBreakdown.categories.hardSkills', 'Hard Skills') },
            { key: 'experience' as const, label: t('optimize.scoreBreakdown.categories.experience', 'Experience') },
            { key: 'education' as const, label: t('optimize.scoreBreakdown.categories.education', 'Education') },
            { key: 'soft_skills' as const, label: t('optimize.scoreBreakdown.categories.softSkills', 'Soft Skills') }
        ];

        // Use the authoritative match analysis score as the displayed total.
        // The AI's category scores don't always sum consistently with its overall
        // score (e.g., categories sum to 25% while overall score is 15%).
        // beforeScore comes from the match analysis and is the source of truth.
        const totalScore = isPlaceholderScore ? 0 : beforeScore;

        return (
            <GlassCard className={className}>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                {t('optimize.scoreBreakdown.title', 'Score Breakdown')}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {t('optimize.scoreBreakdown.subtitle', 'Detailed analysis of your resume match score')}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent"
                                >
                                    {totalScore}
                                </motion.div>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('optimize.scoreBreakdown.outOf', 'Out of 100')}
                                </span>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setExpanded(!expanded)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <motion.div
                                    animate={{ rotate: expanded ? 0 : 180 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </motion.div>
                            </motion.button>
                        </div>
                    </div>

                    <AnimatePresence initial={false}>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="overflow-hidden"
                            >
                                {/* Category Bars */}
                                <div className="space-y-3 pt-2">
                                    {categories.map((cat, idx) => {
                                        const catData = categoryScores[cat.key];
                                        if (!catData) return null;

                                        const config = CATEGORY_CONFIG[cat.key];
                                        const Icon = config.icon;
                                        // Ensure percentage doesn't exceed 100 visually
                                        const percentage = Math.min((catData.score / catData.max) * 100, 100);

                                        return (
                                            <motion.div
                                                key={cat.key}
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: idx * 0.1, type: "spring", stiffness: 300, damping: 20 }}
                                                className="group relative p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors duration-300"
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${config.bgClass}`}>
                                                            <Icon className={`w-4 h-4 ${config.colorClass}`} />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                                                {cat.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-base font-bold ${config.colorClass}`}>
                                                            {catData.score}
                                                        </span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">/{catData.max}</span>
                                                    </div>
                                                </div>

                                                <div className="h-2 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden ring-1 ring-gray-300 dark:ring-white/5">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{
                                                            type: "spring",
                                                            stiffness: 60,
                                                            damping: 15,
                                                            delay: 0.2 + (idx * 0.1)
                                                        }}
                                                        className={`h-full rounded-full relative overflow-hidden ${config.barClass}`}
                                                    >
                                                        {/* Auto shimmer on load, hover shimmer for interaction */}
                                                        <motion.div
                                                            animate={{ x: ['-100%', '200%'] }}
                                                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                                                        />
                                                    </motion.div>
                                                </div>

                                                {catData.reasoning && (
                                                    <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-1 border-l-2 border-gray-200 dark:border-white/5">
                                                        {catData.reasoning}
                                                    </p>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Calculation Logic Footer - Grid Layout */}
                                <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/5 pb-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Info className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                                            {t ? t('sections.match.calculation.title', 'Scoring Logic') : 'Scoring Logic'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">
                                                {t('optimize.scoreBreakdown.categories.hardSkills', 'Hard Skills')}
                                            </span>
                                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                                {t('optimize.scoreBreakdown.categoryDescriptions.hardSkills', 'Measures the match of technical keywords and tools mentioned in the job description.')}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block mb-1">
                                                {t('optimize.scoreBreakdown.categories.experience', 'Experience')}
                                            </span>
                                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                                {t('optimize.scoreBreakdown.categoryDescriptions.experience', 'Analyzes past job titles, years of experience, and relevance to the target role.')}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-1">
                                                {t('optimize.scoreBreakdown.categories.education', 'Education')}
                                            </span>
                                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                                {t('optimize.scoreBreakdown.categoryDescriptions.education', 'Checks academic level and field of study to ensure requirements are met.')}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                                                {t('optimize.scoreBreakdown.categories.softSkills', 'Soft Skills')}
                                            </span>
                                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                                {t('optimize.scoreBreakdown.categoryDescriptions.softSkills', 'Detects behavioral, leadership, and communication traits from your resume context.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </GlassCard>
        );
    }

    // Fallback: no categoryScores and no data — return null
    if (!data) {
        return null;
    }

    // Legacy breakdown display
    const breakdownItems = [
        {
            label: t('optimize.scoreBreakdown.experienceMatch', 'Experience Match'),
            value: data.base_score,
            type: 'base' as const
        },
        {
            label: t('optimize.scoreBreakdown.skillCoverage', 'Skill Coverage'),
            value: data.skill_match_bonus,
            type: 'bonus' as const
        },
        {
            label: t('optimize.scoreBreakdown.keywordMatch', 'Keyword Match'),
            value: data.keyword_coverage_bonus,
            type: 'bonus' as const
        },
        {
            label: t('optimize.scoreBreakdown.gapPenalties', 'Gap Penalties'),
            value: -data.gap_penalties,
            type: 'penalty' as const
        },
    ];

    return (
        <GlassCard className={className}>
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">
                    {t('optimize.scoreBreakdown.title', 'Score Breakdown')}
                </h3>

                <div className="space-y-2">
                    {breakdownItems.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                        >
                            <span className="text-sm text-gray-400">{item.label}</span>
                            <span className={`text-sm font-medium ${item.type === 'penalty'
                                ? 'text-red-400'
                                : item.type === 'bonus'
                                    ? 'text-emerald-400'
                                    : 'text-white'
                                }`}>
                                {item.type === 'base' ? '' : item.value >= 0 ? '+' : ''}
                                {item.value}
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between py-2 border-t border-white/20">
                        <span className="text-sm font-semibold text-white">
                            {t('optimize.scoreBreakdown.finalScore', 'Final Score')}
                        </span>
                        <span className="text-lg font-bold text-emerald-400">
                            {data.final_score}%
                        </span>
                    </div>
                </div>

                {data.score_explanation && (
                    <p className="text-sm text-gray-400 italic">
                        {data.score_explanation}
                    </p>
                )}
            </div>
        </GlassCard>
    );
}

