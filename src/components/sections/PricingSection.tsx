import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Mail, Sparkles, Crown } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
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
            className="py-16 sm:py-24"
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            <div className="space-y-12">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
                    {plans.map((plan) => {
                        const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];

                        return (
                            <div key={plan.key} className="relative group">
                                <GlassCard
                                    variant={plan.active ? 'elevated' : 'default'}
                                    padding="lg"
                                    className={cn(
                                        "h-full transition-all duration-500 relative overflow-hidden",
                                        "hover:border-emerald-400/30 hover:shadow-[0_8px_32px_rgba(16,185,129,0.15)] hover:-translate-y-1",
                                        plan.active && "border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.2)]",
                                        plan.comingSoon && "opacity-90"
                                    )}
                                >
                                    <div className="space-y-6">
                                        {/* Plan Icon & Name */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                                    plan.gradient,
                                                    "shadow-lg"
                                                )}>
                                                    <plan.icon className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white">
                                                        {t(`pricing.plans.${plan.key}.name`)}
                                                    </h3>
                                                    <p className="text-sm text-white/50">
                                                        {t(`pricing.plans.${plan.key}.description`)}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Coming Soon Badge for Pro */}
                                            {plan.comingSoon && (
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                    {t('pricing.comingSoon')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div className="flex items-baseline gap-1">
                                            {plan.key === 'free' ? (
                                                <>
                                                    <span className="text-4xl font-bold text-white">$0</span>
                                                    <span className="text-white/50">{t('pricing.forever')}</span>
                                                </>
                                            ) : (
                                                <span className="text-xl font-medium text-white/60">
                                                    {t('pricing.proPrice')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Features List */}
                                        <ul className="space-y-3">
                                            {Array.isArray(features) && features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                                                        "bg-gradient-to-br", plan.gradient
                                                    )}>
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                    <span className={cn(
                                                        "text-sm",
                                                        plan.comingSoon ? "text-white/60" : "text-white/80"
                                                    )}>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA Button */}
                                        {plan.active ? (
                                            <GlassButton
                                                variant="primary"
                                                size="lg"
                                                className="w-full"
                                            >
                                                {t('pricing.getStarted')}
                                            </GlassButton>
                                        ) : (
                                            <GlassButton
                                                variant="secondary"
                                                size="lg"
                                                className="w-full"
                                                disabled
                                            >
                                                {t('pricing.joinWaitlist')}
                                            </GlassButton>
                                        )}
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
