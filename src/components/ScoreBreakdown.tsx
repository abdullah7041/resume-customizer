import { TrendingUp, Code2, Briefcase, GraduationCap, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    className?: string;
}

const CATEGORY_CONFIG = {
    hard_skills: {
        icon: Code2,
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/20',
        barClass: 'bg-blue-500'
    },
    experience: {
        icon: Briefcase,
        colorClass: 'text-purple-400',
        bgClass: 'bg-purple-500/20',
        barClass: 'bg-purple-500'
    },
    education: {
        icon: GraduationCap,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/20',
        barClass: 'bg-amber-500'
    },
    soft_skills: {
        icon: Users,
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/20',
        barClass: 'bg-emerald-500'
    }
} as const;

export function ScoreBreakdown({
    data,
    categoryScores,
    beforeScore,
    afterScore,
    className = ''
}: ScoreBreakdownProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const improvement = afterScore - beforeScore;

    // Use new categorical scores if available
    if (categoryScores) {
        const categories = [
            { key: 'hard_skills' as const, label: isArabic ? 'المهارات التقنية' : 'Hard Skills' },
            { key: 'experience' as const, label: isArabic ? 'الخبرة' : 'Experience' },
            { key: 'education' as const, label: isArabic ? 'التعليم' : 'Education' },
            { key: 'soft_skills' as const, label: isArabic ? 'المهارات الشخصية' : 'Soft Skills' }
        ];

        const totalScore = categories.reduce((sum, cat) => sum + (categoryScores[cat.key]?.score || 0), 0);

        return (
            <GlassCard className={className}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                            {t('optimize.scoreBreakdown.title', 'Score Breakdown')}
                        </h3>
                        <div className="text-2xl font-bold text-emerald-400">
                            {totalScore}<span className="text-sm text-gray-500">/100</span>
                        </div>
                    </div>

                    {/* Category Bars */}
                    <div className="space-y-3">
                        {categories.map((cat) => {
                            const catData = categoryScores[cat.key];
                            if (!catData) return null;

                            const config = CATEGORY_CONFIG[cat.key];
                            const Icon = config.icon;
                            const percentage = (catData.score / catData.max) * 100;

                            return (
                                <div key={cat.key} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${config.bgClass}`}>
                                                <Icon className={`w-3.5 h-3.5 ${config.colorClass}`} />
                                            </div>
                                            <span className="text-sm text-gray-300">{cat.label}</span>
                                        </div>
                                        <span className={`text-sm font-semibold ${config.colorClass}`}>
                                            {catData.score}/{catData.max}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${config.barClass}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    {catData.reasoning && (
                                        <p className="text-xs text-gray-500 mt-1">{catData.reasoning}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Before/After comparison */}
                    {beforeScore > 0 && (
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">
                                    {t('optimize.scoreBreakdown.before', 'Before')}
                                </p>
                                <p className="text-xl font-bold text-gray-400">{beforeScore}%</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                <span className="text-lg font-semibold text-emerald-400">
                                    +{improvement}%
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase">
                                    {t('optimize.scoreBreakdown.after', 'After')}
                                </p>
                                <p className="text-xl font-bold text-emerald-400">{afterScore}%</p>
                            </div>
                        </div>
                    )}
                </div>
            </GlassCard>
        );
    }

    // Fallback to legacy display if no categoryScores
    if (!data) {
        return (
            <GlassCard className={className}>
                <div className="flex items-center justify-between">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                            {t('optimize.scoreBreakdown.before', 'Before')}
                        </p>
                        <p className="text-2xl font-bold text-gray-400">{beforeScore}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                        <span className="text-lg font-semibold text-emerald-400">
                            +{improvement}%
                        </span>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                            {t('optimize.scoreBreakdown.after', 'After')}
                        </p>
                        <p className="text-2xl font-bold text-emerald-400">{afterScore}%</p>
                    </div>
                </div>
            </GlassCard>
        );
    }

    // Legacy breakdown display
    const breakdownItems = [
        {
            label: isArabic ? 'مطابقة الخبرة' : 'Experience Match',
            value: data.base_score,
            type: 'base' as const
        },
        {
            label: isArabic ? 'تغطية المهارات' : 'Skill Coverage',
            value: data.skill_match_bonus,
            type: 'bonus' as const
        },
        {
            label: isArabic ? 'مطابقة الكلمات المفتاحية' : 'Keyword Match',
            value: data.keyword_coverage_bonus,
            type: 'bonus' as const
        },
        {
            label: isArabic ? 'خصومات الفجوات' : 'Gap Penalties',
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

                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-gray-800/50 to-emerald-900/30">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                            {t('optimize.scoreBreakdown.before', 'Current')}
                        </p>
                        <p className="text-3xl font-bold text-gray-400">{beforeScore}%</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <TrendingUp className="w-8 h-8 text-emerald-400" />
                        <span className="text-xl font-bold text-emerald-400">+{improvement}%</span>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                            {t('optimize.scoreBreakdown.after', 'Optimized')}
                        </p>
                        <p className="text-3xl font-bold text-emerald-400">{afterScore}%</p>
                    </div>
                </div>

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
