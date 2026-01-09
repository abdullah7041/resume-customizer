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
            <div className="space-y-5">
                {/* Mirrored Phrases */}
                {mirroredPhrases && mirroredPhrases.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-semibold text-white">
                                {t('optimize.mirroredKeywords.title')}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">
                            {t('optimize.mirroredKeywords.description')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {mirroredPhrases.map((phrase, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleCopy(phrase, index)}
                                    className="group px-3 py-1.5 text-sm bg-purple-500/20 border border-purple-500/30 
                             rounded-full text-purple-300 hover:bg-purple-500/30 transition-colors
                             flex items-center gap-2"
                                >
                                    <span>"{phrase}"</span>
                                    {copiedIndex === index ? (
                                        <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Structural Changes */}
                {structuralChanges && structuralChanges.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-white mb-2">
                            {t('optimize.mirroredKeywords.structuralChanges')}
                        </h4>
                        <ul className="space-y-2">
                            {structuralChanges.map((change, index) => (
                                <li
                                    key={index}
                                    className="flex items-start gap-2 text-sm text-gray-300"
                                >
                                    <span className="text-emerald-400 mt-1">→</span>
                                    <span>{change}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
