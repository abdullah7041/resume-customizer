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
        <GlassCard className={className} variant="elevated">
            <div className="space-y-6">
                {/* Mirrored Phrases */}
                {mirroredPhrases && mirroredPhrases.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-purple-500/10 ring-1 ring-purple-500/20">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">
                                    {t('optimize.mirroredKeywords.title', 'Mirrored Keywords')}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {t('optimize.mirroredKeywords.description', 'These phrases align perfectly with the job description')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {mirroredPhrases.map((phrase, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleCopy(phrase, index)}
                                    className={`
                                        group relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300
                                        flex items-center gap-2.5 overflow-hidden
                                        ${copiedIndex === index
                                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50'
                                            : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/20'
                                        }
                                    `}
                                >
                                    <span className="relative z-10">{phrase}</span>
                                    {copiedIndex === index ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400 relative z-10" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity relative z-10" />
                                    )}
                                    {/* Subtle gradient background effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Structural Changes */}
                {structuralChanges && structuralChanges.length > 0 && (
                    <div className="pt-4 border-t border-white/5">
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
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
                                    <span className="text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
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
