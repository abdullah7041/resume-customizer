import { TooltipRenderProps } from 'react-joyride';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { cn } from '../../lib/utils/cn';
import { X, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function TourTooltip({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    isLastStep,
    size,
}: TooltipRenderProps & { size?: number }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    return (
        <div
            {...tooltipProps}
            className={cn(
                "max-w-md w-full outline-none",
                isArabic ? "rtl" : "ltr"
            )}
        >
            <GlassCard
                variant="elevated"
                padding="none"
            >
                <div className="p-6 relative">
                    {/* Close Button */}
                    {!step.hideCloseButton && (
                        <button
                            {...closeProps}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {/* Header */}
                    {step.title && (
                        <div className="mb-3 pr-8">
                            <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                {step.title}
                            </h3>
                        </div>
                    )}

                    {/* Content */}
                    <div className="text-white/80 leading-relaxed mb-6 font-medium">
                        {step.content}
                    </div>

                    {/* Footer / Controls */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        {/* Steps indicator */}
                        <div className="text-xs font-semibold text-emerald-500/80 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            {index + 1} / {size}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Back Button */}
                            {index > 0 && (
                                <button
                                    {...backProps}
                                    className="px-3 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                                >
                                    {t('common.back', 'Back')}
                                </button>
                            )}

                            {/* Next/Finish Button */}
                            <GlassButton
                                {...primaryProps}
                                variant="primary"
                                size="sm"
                                className="group shadow-lg shadow-emerald-900/40"
                                rightIcon={!isLastStep && <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                            >
                                {isLastStep ? t('common.finish', 'Finish') : t('common.next', 'Next')}
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
