import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, Crown } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '../../lib/utils/cn';
import { UpgradeModal } from '../Credits/UpgradeModal';

interface PlanConfig {
    key: 'free' | 'pro';
    icon: typeof Sparkles;
    gradient: string;
    active?: boolean;
    comingSoon?: boolean;
}

const plans: PlanConfig[] = [
    {
        key: 'free',
        icon: Sparkles,
        gradient: 'from-emerald-500 to-teal-500',
        active: true,
    },
    {
        key: 'pro',
        icon: Crown,
        gradient: 'from-purple-500 to-pink-500',
        comingSoon: true,
    },
];

export function PricingSection() {
    const { t, i18n } = useTranslation();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    return (
        <section
            id="pricing"
            className="py-6 sm:py-10"
            dir={i18n.dir()}
        >
            <div className="space-y-6">
                {/* Section Header */}
                <div className="text-center space-y-4">
                    <h2 className="inline-block text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                        <span className="text-white dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent pb-1">
                            {t('pricing.title')}
                        </span>
                    </h2>
                    <p className="text-lg sm:text-xl font-medium text-white dark:text-white/80 max-w-2xl mx-auto drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                        {t('pricing.subtitle')}
                    </p>
                </div>

                {/* Pricing Cards Grid - 2 columns for Free and Pro */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto items-stretch">
                    {plans.map((plan) => {
                        const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];

                        return (
                            <div key={plan.key} className="relative group flex flex-col h-full">
                                <GlassCard
                                    variant='default'
                                    padding="lg"
                                    className={cn(
                                        "neu-card flex flex-col h-full transition-all duration-500 relative overflow-hidden group/card",
                                        "hover:-translate-y-1",
                                        plan.active && "border-emerald-500/40",
                                        plan.comingSoon && "opacity-80 hover:opacity-100 bg-gray-100 dark:bg-gray-900/90 border-gray-200 dark:border-white/5",
                                        "p-6 sm:p-8"
                                    )}
                                >
                                    {/* Active Plan Highlight */}
                                    {plan.active && (
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                                    )}

                                    <div className="space-y-7 flex flex-col flex-1">
                                        {/* Plan Icon & Name */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <GlassCircle size="lg" variant={plan.key === 'free' ? 'success' : 'purple'} className="w-12 h-12 shadow-lg">
                                                    <plan.icon className="w-6 h-6 text-white" />
                                                </GlassCircle>
                                                <div>
                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                                                        {t(`pricing.plans.${plan.key}.name`)}
                                                    </h3>
                                                    <p className="text-sm text-emerald-700 dark:text-emerald-100/60 font-medium">
                                                        {t(`pricing.plans.${plan.key}.description`)}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Coming Soon Badge for Pro */}
                                            {plan.comingSoon && (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gold-500/10 text-gold-400 border border-gold-500/20">
                                                    {t('pricing.comingSoon')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div className="flex items-baseline gap-1 py-2">
                                            {plan.key === 'free' ? (
                                                <>
                                                    <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">$0</span>
                                                    <span className="text-gray-500 dark:text-emerald-100/50 font-medium text-lg ml-1">{t('pricing.forever')}</span>
                                                </>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-medium text-gray-500 dark:text-white/50">
                                                        {t('pricing.comingSoon')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Features List - Pushed to fill space */}
                                        {!plan.comingSoon ? (
                                            <ul className="space-y-4 flex-1">
                                                {Array.isArray(features) && features.map((feature, idx) => (
                                                    <li key={idx} className="flex items-start gap-3.5 group/item">
                                                        <div className={cn(
                                                            "mt-1 shrink-0 rounded-full p-0.5",
                                                            "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                        )}>
                                                            <Check className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-sm leading-relaxed transition-colors text-gray-600 dark:text-emerald-50/80 group-hover/item:text-gray-900 dark:group-hover/item:text-white">
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center py-8">
                                                <p className="text-gray-500 dark:text-white/40 text-sm">
                                                    {t('pricing.detailsComingSoon', 'Details will be announced soon')}
                                                </p>
                                            </div>
                                        )}

                                        {/* CTA Button - Anchored at bottom */}
                                        <div className="pt-4">
                                            {plan.active ? (
                                                <GlassButton
                                                    variant="primary"
                                                    size="lg"
                                                    className="w-full font-bold shadow-lg shadow-emerald-900/20"
                                                >
                                                    {t('pricing.getStarted')}
                                                </GlassButton>
                                            ) : (
                                                <GlassButton
                                                    variant="secondary"
                                                    size="lg"
                                                    onClick={() => setShowUpgradeModal(true)}
                                                    className="w-full border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors"
                                                >
                                                    {t('pricing.joinWaitlist')}
                                                </GlassButton>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Waitlist Modal */}
            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                creditsRemaining={20}
                dismissKey="watheq:pricingWaitlist"
                source="pricing"
            />
        </section>
    );
}

export default PricingSection;
