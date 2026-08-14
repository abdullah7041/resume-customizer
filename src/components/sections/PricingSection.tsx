import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, ListChecks } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '../../lib/utils/cn';
import { PricingWaitlistModal } from '../Credits/PricingWaitlistModal';

interface PlanConfig {
    key: 'free' | 'pro';
    icon: typeof Sparkles;
    active?: boolean;
    waitlist?: boolean;
}

interface PricingSectionProps {
    onGetStarted?: () => void;
}

const plans: PlanConfig[] = [
    { key: 'free', icon: Sparkles, active: true },
    { key: 'pro', icon: ListChecks, waitlist: true },
];

export function PricingSection({ onGetStarted }: PricingSectionProps = {}) {
    const { t, i18n } = useTranslation();
    const [showWaitlistModal, setShowWaitlistModal] = useState(false);

    const openWaitlist = () => {
        setShowWaitlistModal(true);
    };

    return (
        <section id="pricing" className="py-6 sm:py-10" dir={i18n.dir()}>
            <div className="space-y-6">
                {/* Section Header */}
                <div className="text-center space-y-4">
                    <h2 className="inline-block text-3xl sm:text-4xl lg:text-5xl font-bold text-[#171717] dark:drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                        <span className="dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-300 dark:bg-clip-text dark:text-transparent pb-1">
                            {t('pricing.title')}
                        </span>
                    </h2>
                    <p className="text-lg sm:text-xl font-medium text-slate-600 dark:text-white/80 max-w-2xl mx-auto dark:drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                        {t('pricing.subtitle')}
                    </p>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto items-stretch">
                    {plans.map((plan) => {
                        const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];

                        return (
                            <div key={plan.key} className="relative group flex flex-col h-full">
                                <GlassCard
                                    variant="default"
                                    padding="lg"
                                    className={cn(
                                        'neu-card flex flex-col h-full transition-[translate,border-color,box-shadow] duration-300 relative overflow-hidden p-6 sm:p-8',
                                        'hover:-translate-y-1',
                                        plan.active && 'border-emerald-500/40',
                                        plan.waitlist && 'border-[color:var(--accent-gold)]/30'
                                    )}
                                >
                                    {plan.active && (
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                                    )}

                                    <div className="space-y-7 flex flex-col flex-1">
                                        {/* Plan Icon & Name */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <GlassCircle size="lg" variant={plan.active ? 'success' : 'gold'} className="w-12 h-12 shadow-lg">
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
                                            {plan.waitlist && (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-[color:var(--accent-gold)]/35 bg-[color:var(--accent-gold-soft)] text-[#8a6d2f] dark:text-gold-400">
                                                    {t('pricing.waitlist.badge', 'Pricing Waitlist')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Price / Status line */}
                                        <div className="py-2">
                                            <div className="flex items-baseline gap-1">
                                                {plan.active ? (
                                                    <>
                                                        <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">$0</span>
                                                        <span className="text-gray-500 dark:text-emerald-100/50 font-medium text-lg ml-1">{t('pricing.forever')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">{t('pricing.plans.pro.price')}</span>
                                                        <span className="text-gray-500 dark:text-emerald-100/50 font-medium text-lg ms-1">{t('pricing.plans.pro.period')}</span>
                                                    </>
                                                )}
                                            </div>
                                            {plan.waitlist && (
                                                <p className="mt-1 text-xs font-medium text-[#8a6d2f] dark:text-gold-400/80">
                                                    {t('pricing.plans.pro.priceNote')}
                                                </p>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <ul className="space-y-4 flex-1">
                                            {Array.isArray(features) && features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3.5 group/item">
                                                    <div className={cn(
                                                        'mt-1 shrink-0 rounded-full p-0.5',
                                                        plan.active
                                                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                                            : 'bg-[color:var(--accent-gold-soft)] text-[#8a6d2f] dark:text-gold-400'
                                                    )}>
                                                        <Check className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-sm leading-relaxed text-gray-600 dark:text-emerald-50/80">
                                                        {feature}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA */}
                                        <div className="pt-4">
                                            {plan.active ? (
                                                <GlassButton
                                                    type="button"
                                                    variant="primary"
                                                    size="lg"
                                                    onClick={onGetStarted}
                                                    className="w-full font-bold shadow-lg shadow-emerald-900/20"
                                                >
                                                    {t('pricing.getStarted')}
                                                </GlassButton>
                                            ) : (
                                                <GlassButton
                                                    type="button"
                                                    variant="secondary"
                                                    size="lg"
                                                    onClick={openWaitlist}
                                                    className="w-full font-bold"
                                                >
                                                    <ListChecks className="w-4 h-4 me-2" />
                                                    {t('pricing.waitlist.cta', 'Join pricing waitlist')}
                                                </GlassButton>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-slate-500 dark:text-white/40">
                    {t('pricing.waitlist.notLiveNote', 'Paid plans are not live yet — joining the waitlist helps us shape launch pricing.')}
                </p>
            </div>

            <PricingWaitlistModal
                isOpen={showWaitlistModal}
                onClose={() => setShowWaitlistModal(false)}
                creditsRemaining={0}
                dismissKey="watheq:pricingWaitlist"
                source="pricing"
            />
        </section>
    );
}

export default PricingSection;
