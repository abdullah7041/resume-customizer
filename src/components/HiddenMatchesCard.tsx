import { Lightbulb, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './ui/GlassCard';
import type { HiddenMatch } from '@/types/analysis';

interface HiddenMatchesCardProps {
    matches: HiddenMatch[];
    className?: string;
}

export function HiddenMatchesCard({ matches, className = '' }: HiddenMatchesCardProps) {
    const { t } = useTranslation();

    if (!matches || matches.length === 0) return null;

    return (
        <GlassCard className={className}>
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('optimize.hiddenMatches.title', 'Hidden Advantages')}
                    </h3>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('optimize.hiddenMatches.description', 'Skills you have that match job requirements using different terminology:')}
                </p>

                <div className="space-y-3">
                    {matches.map((match, index) => (
                        <div
                            key={index}
                            className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                        >
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-900 dark:bg-white/10 dark:text-white rounded">
                                    {match.resumeTerm}
                                </span>
                                <ArrowRight className="w-4 h-4 text-yellow-400" />
                                <span className="px-2 py-1 text-xs font-medium bg-emerald-100 rounded text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                                    {match.jdRequirement}
                                </span>
                            </div>
                            <p className="text-sm text-yellow-900 dark:text-yellow-200">{match.insight}</p>
                        </div>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
}
