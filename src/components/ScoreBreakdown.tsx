import { TrendingUp, Code2, Briefcase, GraduationCap, Users, Info } from 'lucide-react';
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
            <GlassCard className={className} variant="elevated">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                {t('optimize.scoreBreakdown.title', 'Score Breakdown')}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {isArabic ? 'تحليل مفصل لدرجة مطابقة سيرتك الذاتية' : 'Detailed analysis of your resume match score'}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                {totalScore}
                            </div>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('optimize.scoreBreakdown.outOf', 'Out of 100')}
                            </span>
                        </div>
                    </div>

                    {/* Category Bars */}
                    <div className="space-y-3">
                        {categories.map((cat) => {
                            const catData = categoryScores[cat.key];
                            if (!catData) return null;

                            const config = CATEGORY_CONFIG[cat.key];
                            const Icon = config.icon;
                            // Ensure percentage doesn't exceed 100 visually
                            const percentage = Math.min((catData.score / catData.max) * 100, 100);

                            return (
                                <div key={cat.key} className="group relative p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${config.bgClass}`}>
                                                <Icon className={`w-4 h-4 ${config.colorClass}`} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-white block">
                                                    {cat.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-base font-bold ${config.colorClass}`}>
                                                {catData.score}
                                            </span>
                                            <span className="text-xs text-gray-500">/{catData.max}</span>
                                        </div>
                                    </div>

                                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden ring-1 ring-white/5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${config.barClass}`}
                                            style={{ width: `${percentage}%` }}
                                        >
                                            {/* Auto shimmer on load, hover shimmer for interaction */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-[shimmer_2s_infinite]" />
                                        </div>
                                    </div>

                                    {catData.reasoning && (
                                        <p className="mt-3 text-xs text-gray-400 leading-relaxed pl-1 border-l-2 border-white/5">
                                            {catData.reasoning}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Calculation Logic Footer - Grid Layout */}
                    <div className="mt-6 pt-5 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                                {t ? t('sections.match.calculation.title', 'Scoring Logic') : 'Scoring Logic'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-xs font-bold text-blue-400 block mb-1">
                                    {isArabic ? 'المهارات التقنية' : 'Hard Skills'}
                                </span>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    {isArabic
                                        ? 'يقيس تطابق الكلمات المفتاحية التقنية والأدوات المذكورة في الوصف الوظيفي.'
                                        : 'Measures the match of technical keywords and tools mentioned in the job description.'}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-xs font-bold text-purple-400 block mb-1">
                                    {isArabic ? 'الخبرة' : 'Experience'}
                                </span>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    {isArabic
                                        ? 'يحلل المسميات الوظيفية السابقة وسنوات الخبرة ومدى صلتها بالدور المطلوب.'
                                        : 'Analyzes past job titles, years of experience, and relevance to the target role.'}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-xs font-bold text-amber-400 block mb-1">
                                    {isArabic ? 'التعليم' : 'Education'}
                                </span>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    {isArabic
                                        ? 'يتحقق من المستوى الأكاديمي ومجال الدراسة للتأكد من استيفاء المتطلبات.'
                                        : 'Checks academic level and field of study to ensure requirements are met.'}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-xs font-bold text-emerald-400 block mb-1">
                                    {isArabic ? 'المهارات الشخصية' : 'Soft Skills'}
                                </span>
                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                    {isArabic
                                        ? 'يكتشف السمات الشخصية والقيادية والتواصل من خلال سياق سيرتك الذاتية.'
                                        : 'Detects behavioral, leadership, and communication traits from your resume context.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Overall Impact / Before & After */}
                    {beforeScore > 0 && (
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                                        {t('optimize.scoreBreakdown.before', 'Current')}
                                    </p>
                                    <p className={`text-2xl font-bold ${isPlaceholderScore ? 'text-gray-600 italic' : 'text-gray-400'}`}>
                                        {isPlaceholderScore ? '—' : `${beforeScore}%`}
                                    </p>
                                </div>

                                {!isPlaceholderImprovement && (
                                    <div className="flex flex-col items-center justify-center px-4">
                                        <div className="w-px h-8 bg-gradient-to-b from-transparent via-emerald-500/50 to-transparent mb-1" />
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-sm font-bold text-emerald-400">+{improvement}%</span>
                                        </div>
                                    </div>
                                )}

                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                                        {t('optimize.scoreBreakdown.after', 'Potential')}
                                    </p>
                                    <p className={`text-2xl font-bold ${isPlaceholderScore || isPlaceholderImprovement ? 'text-gray-600 italic' : 'text-emerald-400'}`}>
                                        {isPlaceholderScore || isPlaceholderImprovement ? '—' : `${afterScore}%`}
                                    </p>
                                </div>
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
                    <div className="text-center relative">
                        {/* Circular Progress for Score */}
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-gray-800"
                                />
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={251.2}
                                    strokeDashoffset={251.2 - (251.2 * beforeScore) / 100}
                                    className={isPlaceholderScore ? 'text-gray-600' : 'text-emerald-500'}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-2xl font-bold ${isPlaceholderScore ? 'text-gray-500' : 'text-white'}`}>
                                    {isPlaceholderScore ? '—' : `${beforeScore}%`}
                                </span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Score</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 px-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-400">{t('optimize.scoreBreakdown.before', 'Current Score')}</span>
                            <span className="text-lg font-bold text-white">{beforeScore}%</span>
                        </div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm font-medium text-emerald-400">{t('optimize.scoreBreakdown.potential', 'Potential Score')}</span>
                            <span className="text-lg font-bold text-emerald-400">{afterScore}%</span>
                        </div>

                        {!isPlaceholderImprovement && (
                            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm font-medium text-emerald-300">
                                    Improve by <span className="font-bold text-emerald-400">+{improvement}%</span> with AI suggestions
                                </span>
                            </div>
                        )}
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
                        <p className={`text-3xl font-bold ${isPlaceholderScore ? 'text-gray-600 italic' : 'text-gray-400'}`}>
                            {isPlaceholderScore ? '—' : `${beforeScore}%`}
                        </p>
                    </div>
                    {!isPlaceholderImprovement && (
                        <div className="flex flex-col items-center">
                            <TrendingUp className="w-8 h-8 text-emerald-400" />
                            <span className="text-xl font-bold text-emerald-400">+{improvement}%</span>
                        </div>
                    )}
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                            {t('optimize.scoreBreakdown.after', 'Optimized')}
                        </p>
                        <p className={`text-3xl font-bold ${isPlaceholderScore || isPlaceholderImprovement ? 'text-gray-600 italic' : 'text-emerald-400'}`}>
                            {isPlaceholderScore || isPlaceholderImprovement ? '—' : `${afterScore}%`}
                        </p>
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
