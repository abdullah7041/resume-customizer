import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Mail, Sparkles, Crown } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '../../lib/utils/cn';

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
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const isRTL = i18n.language === 'ar';

    const handleNotifyMe = async (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setIsSubmitting(true);

        // Simulate API call - in production, this would store in Supabase
        await new Promise(resolve => setTimeout(resolve, 1000));

        setSubmitted(true);
        setIsSubmitting(false);
        setEmail('');

        // Reset after 3 seconds
        setTimeout(() => setSubmitted(false), 3000);
    };

    return (
        <section
            id="pricing"
            className="py-6 sm:py-10"
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            <div className="space-y-6">
                {/* Section Header */}
                <div className="text-center space-y-4">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                        {t('pricing.title')}
                    </h2>
                    <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">
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
                                    variant={plan.active ? 'elevated' : 'default'}
                                    padding="lg"
                                    className={cn(
                                        "flex flex-col h-full transition-all duration-500 relative overflow-hidden",
                                        "hover:shadow-[0_8px_32px_rgba(16,185,129,0.1)] hover:-translate-y-1",
                                        plan.active && "border-emerald-500/30 bg-emerald-950/20 shadow-[0_8px_32px_rgba(16,185,129,0.15)]",
                                        plan.comingSoon && "opacity-80 hover:opacity-100 bg-white/5 border-white/5",
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
                                                    <h3 className="text-xl font-bold text-white tracking-tight">
                                                        {t(`pricing.plans.${plan.key}.name`)}
                                                    </h3>
                                                    <p className="text-sm text-emerald-100/60 font-medium">
                                                        {t(`pricing.plans.${plan.key}.description`)}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Coming Soon Badge for Pro */}
                                            {plan.comingSoon && (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/5 text-white/50 border border-white/10">
                                                    {t('pricing.comingSoon')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div className="flex items-baseline gap-1 py-2">
                                            {plan.key === 'free' ? (
                                                <>
                                                    <span className="text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">$0</span>
                                                    <span className="text-emerald-100/50 font-medium text-lg ml-1">{t('pricing.forever')}</span>
                                                </>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-bold text-white/40 blur-[2px] select-none">
                                                        $29.99
                                                    </span>
                                                    <span className="text-sm font-medium text-emerald-400">
                                                        {t('pricing.proPrice')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Features List - Pushed to fill space */}
                                        <ul className="space-y-4 flex-1">
                                            {Array.isArray(features) && features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3.5 group/item">
                                                    <div className={cn(
                                                        "mt-1 shrink-0 rounded-full p-0.5",
                                                        plan.key === 'free' ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/10 text-purple-300/50"
                                                    )}>
                                                        <Check className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm leading-relaxed transition-colors",
                                                        plan.comingSoon ? "text-white/50" : "text-emerald-50/80 group-hover/item:text-white"
                                                    )}>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>

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
                                                    className="w-full border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                                                    disabled
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

                {/* Email Notification Form */}
                <GlassCard variant="subtle" padding="lg" className="max-w-xl mx-auto">
                    <form onSubmit={handleNotifyMe} className="space-y-4">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">{t('pricing.notifyMe')}</h3>
                            <p className="text-sm text-white/60">{t('pricing.notifyDescription')}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <GlassInput
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('pricing.emailPlaceholder')}
                                    leftIcon={<Mail className="w-4 h-4" />}
                                    disabled={isSubmitting || submitted}
                                />
                            </div>
                            <GlassButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                isLoading={isSubmitting}
                                disabled={!email.trim() || submitted}
                                className="sm:w-auto"
                            >
                                {submitted ? t('pricing.subscribed') : t('pricing.notify')}
                            </GlassButton>
                        </div>
                    </form>
                </GlassCard>
            </div>
        </section>
    );
}

export default PricingSection;
