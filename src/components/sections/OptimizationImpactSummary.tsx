import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import {
    CheckCircle2,
    Sparkles,
    TrendingUp,
    ChevronRight
} from 'lucide-react';

interface OptimizationImpactSummaryProps {
    sectionsOptimized: number;
    keywordsToAdd: number;
    isVisible: boolean;
    onDismiss?: () => void;
}

export function OptimizationImpactSummary({
    sectionsOptimized,
    keywordsToAdd,
    isVisible,
    onDismiss,
}: OptimizationImpactSummaryProps) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [animatedSections, setAnimatedSections] = useState(0);
    const [showContent, setShowContent] = useState(false);

    // Animate the counter
    useEffect(() => {
        if (!isVisible) {
            setAnimatedSections(0);
            setShowContent(false);
            return;
        }

        // Track that user saw the impact summary
        analytics.track('optimization_impact_shown', {
            sections_optimized: sectionsOptimized,
            keywords_suggested: keywordsToAdd,
        });

        // Delay content reveal for entrance animation
        const showTimer = setTimeout(() => setShowContent(true), 100);

        // Animate counter
        const duration = 600;
        const steps = sectionsOptimized;
        const stepDuration = steps > 0 ? duration / steps : duration;

        let current = 0;
        const interval = setInterval(() => {
            current++;
            setAnimatedSections(current);
            if (current >= sectionsOptimized) {
                clearInterval(interval);
            }
        }, stepDuration);

        return () => {
            clearInterval(interval);
            clearTimeout(showTimer);
        };
    }, [isVisible, sectionsOptimized, keywordsToAdd]);

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                'transition-all duration-500 ease-out mb-6',
                showContent
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-4'
            )}
        >
            <GlassCard
                variant="default"
                padding="lg"
                className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-purple-500/5"
            >
                {/* Success icon with glow */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl" />

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">
                                {isArabic ? 'تم التحسين بنجاح!' : 'Optimization Complete!'}
                            </h3>
                            <p className="text-sm text-gray-400">
                                {isArabic
                                    ? 'سيرتك الذاتية جاهزة للتميز'
                                    : 'Your resume is ready to stand out'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Sections Optimized */}
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-gray-400 uppercase tracking-wide">
                                    {isArabic ? 'الأقسام المحسنة' : 'Sections Improved'}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white tabular-nums">
                                    {animatedSections}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {isArabic ? 'قسم' : 'sections'}
                                </span>
                            </div>
                        </div>

                        {/* Keywords to Add */}
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-gray-400 uppercase tracking-wide">
                                    {isArabic ? 'كلمات مقترحة' : 'Keywords Suggested'}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white tabular-nums">
                                    +{keywordsToAdd}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {isArabic ? 'كلمة' : 'keywords'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CTA hint */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-gray-400">
                            {isArabic
                                ? 'راجع التحسينات أدناه وطبق ما يناسبك'
                                : 'Review suggestions below and apply what fits'
                            }
                        </span>
                        <button
                            onClick={onDismiss}
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <span>{isArabic ? 'ابدأ' : 'Let\'s go'}</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}

export default OptimizationImpactSummary;
