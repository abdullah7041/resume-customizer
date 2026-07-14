import { Copy, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './ui/GlassCard';

interface MirroredKeywordsCardProps {
    mirroredPhrases: string[];
    structuralChanges: string[];
    className?: string;
}

export function MirroredKeywordsCard({
    mirroredPhrases,
    structuralChanges,
    className = ''
}: MirroredKeywordsCardProps) {
    const { t } = useTranslation();
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    if ((!mirroredPhrases || mirroredPhrases.length === 0) &&
        (!structuralChanges || structuralChanges.length === 0)) {
        return null;
    }

    const handleCopy = async (text: string, index: number) => {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <GlassCard className={className}>
            <div className="space-y-6">
                {/* Mirrored Phrases */}
                {mirroredPhrases && mirroredPhrases.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-purple-500/10 ring-1 ring-purple-500/20">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {t('optimize.mirroredKeywords.title', 'Mirrored Keywords')}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    {t('optimize.mirroredKeywords.description', 'These phrases align perfectly with the job description')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {mirroredPhrases.map((phrase, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    onClick={() => handleCopy(phrase, index)}
                                    className={`
                                        group relative px-4 py-2 text-sm font-medium rounded-xl transition-[color,background-color,box-shadow] duration-300
                                        flex items-center gap-2.5 overflow-hidden
                                        ${copiedIndex === index
                                            ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/50'
                                            : 'bg-white/80 text-gray-700 hover:text-gray-950 hover:bg-white ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 dark:ring-white/10 dark:hover:ring-white/20'
                                        }
                                    `}
                                >
                                    <span className="relative z-10">{phrase}</span>
                                    {copiedIndex === index ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400 relative z-10" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity relative z-10" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Structural Changes */}
                {structuralChanges && structuralChanges.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-white/5">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {t('optimize.mirroredKeywords.structuralChanges', 'Structural Improvements')}
                        </h4>
                        <ul className="space-y-2.5">
                            {structuralChanges.map((change, index) => (
                                <li
                                    key={index}
                                    className="flex items-start gap-3 text-sm group"
                                >
                                    <span className="flex-shrink-0 mt-1.5 w-4 h-[1px] bg-blue-500/50 group-hover:bg-blue-400/80 transition-colors" />
                                    <span className="text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-300 transition-colors leading-relaxed">
                                        {change}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
