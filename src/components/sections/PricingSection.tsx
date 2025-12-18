import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Mail, Sparkles, Building2, Crown } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { cn } from '../../lib/utils/cn';

interface PlanConfig {
    key: 'free' | 'pro' | 'enterprise';
    icon: typeof Sparkles;
    gradient: string;
    popular?: boolean;
    comingSoon?: boolean;
}

const plans: PlanConfig[] = [
    {
        key: 'free',
        icon: Sparkles,
        gradient: 'from-emerald-500 to-teal-500',
    },
    {
        key: 'pro',
        icon: Crown,
        gradient: 'from-purple-500 to-pink-500',
        popular: true,
        comingSoon: true,
    },
    {
        key: 'enterprise',
        icon: Building2,
        gradient: 'from-blue-500 to-cyan-500',
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

                {/* Coming Soon Banner */}
                <GlassCard variant="subtle" padding="md" className="text-center max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                        </span>
                        <span className="text-sm font-semibold text-amber-400">{t('pricing.comingSoon')}</span>
                    </div>
                    <p className="text-white/60">
                        {t('pricing.comingSoonDescription')}
                    </p>
                </GlassCard>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {plans.map((plan) => {
                        const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];

                        return (
                            <div key={plan.key} className="relative group">
                                {/* Popular Badge */}
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                        <span className={cn(
                                            "px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
                                            "bg-gradient-to-r", plan.gradient, "text-white shadow-lg"
                                        )}>
                                            Popular
                                        </span>
                                    </div>
                                )}

                                <GlassCard
                                    variant={plan.popular ? 'elevated' : 'default'}
                                    padding="lg"
                                    className={cn(
                                        "h-full transition-all duration-500 relative overflow-hidden",
                                        "hover:border-emerald-400/30 hover:shadow-[0_8px_32px_rgba(16,185,129,0.15)] hover:-translate-y-1",
                                        plan.popular && "border-purple-500/30 shadow-[0_8px_32px_rgba(168,85,247,0.15)]"
                                    )}
                                >
                                    {/* Coming Soon Overlay */}
                                    {plan.comingSoon && (
                                        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl">
                                            <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40">
                                                <span className="text-lg font-bold text-amber-400">{t('pricing.comingSoon')}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {/* Plan Icon & Name */}
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

                                        {/* Price */}
                                        <div className="flex items-baseline gap-1">
                                            {plan.key === 'free' ? (
                                                <>
                                                    <span className="text-4xl font-bold text-white">$0</span>
                                                    <span className="text-white/50">/forever</span>
                                                </>
                                            ) : (
                                                <span className="text-2xl font-bold text-white/50">
                                                    {t(`pricing.plans.${plan.key}.price`)}
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
                                                    <span className="text-white/80 text-sm">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA Button */}
                                        <GlassButton
                                            variant={plan.key === 'free' ? 'primary' : 'secondary'}
                                            size="lg"
                                            className="w-full"
                                            disabled={plan.comingSoon}
                                        >
                                            {plan.comingSoon ? t('pricing.comingSoon') : 'Get Started'}
                                        </GlassButton>
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
                            <p className="text-sm text-white/60">{t('pricing.comingSoonDescription')}</p>
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
                                {submitted ? '✓ Subscribed!' : t('pricing.notifyMe')}
                            </GlassButton>
                        </div>
                    </form>
                </GlassCard>
            </div>
        </section>
    );
}

export default PricingSection;
