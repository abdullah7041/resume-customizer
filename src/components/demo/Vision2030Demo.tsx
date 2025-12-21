// src/components/demo/Vision2030Demo.tsx
// Customer-facing demo showcasing the value of Vision 2030 alignment feature

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, TrendingUp, Sparkles, Award, ChevronRight, CheckCircle2, Star } from 'lucide-react';
import { SectorIcon } from '../../lib/utils/vision2030Icons';
import { VISION_2030_SECTORS } from '../../lib/data/vision2030Skills';
import Vision2030Modal from '../ui/Vision2030Modal';
import Button from '../ui/Button';

interface Vision2030DemoProps {
    onGetStarted?: () => void;
}

export function Vision2030Demo({ onGetStarted }: Vision2030DemoProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [modalOpen, setModalOpen] = useState(false);

    // Demo stats
    const stats = [
        { value: '500K+', label: isArabic ? 'وظائف تقنية جديدة' : 'New Tech Jobs', icon: TrendingUp },
        { value: '8', label: isArabic ? 'قطاعات رئيسية' : 'Key Sectors', icon: Target },
        { value: '+30%', label: isArabic ? 'فرص مقابلات أكثر' : 'More Interview Chances', icon: Award },
    ];

    // Value propositions
    const benefits = [
        {
            titleEn: 'Align with National Priorities',
            titleAr: 'تتوافق مع الأولويات الوطنية',
            descEn: 'Your resume keywords match Vision 2030 growth sectors',
            descAr: 'كلمات سيرتك الذاتية تتوافق مع قطاعات نمو رؤية 2030',
        },
        {
            titleEn: 'Stand Out to Employers',
            titleAr: 'تميز أمام أصحاب العمل',
            descEn: 'Saudi companies actively seek Vision 2030-aligned talent',
            descAr: 'الشركات السعودية تبحث عن الكفاءات المتوافقة مع رؤية 2030',
        },
        {
            titleEn: 'Future-Proof Your Career',
            titleAr: 'حصّن مستقبلك المهني',
            descEn: 'Build skills in high-demand sectors through 2030',
            descAr: 'طوّر مهاراتك في القطاعات عالية الطلب حتى 2030',
        },
    ];

    return (
        <section className="relative overflow-hidden py-16 px-4">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#006C35]/10 via-emerald-900/20 to-transparent pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header Badge */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#006C35] text-white text-sm font-bold mb-4">
                        <span>🇸🇦</span>
                        <span>{isArabic ? 'ميزة حصرية' : 'Exclusive Feature'}</span>
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        {isArabic ? 'توافق سيرتك الذاتية مع رؤية 2030' : 'Vision 2030 Resume Alignment'}
                    </h2>
                    <p className="text-lg text-white/70 max-w-2xl mx-auto">
                        {isArabic
                            ? 'تحليل ذكي يقيّم توافق مهاراتك مع قطاعات النمو في المملكة العربية السعودية'
                            : 'Smart analysis that evaluates how your skills align with Saudi Arabia\'s growth sectors'}
                    </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-12 max-w-lg mx-auto">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                            <stat.icon className="w-6 h-6 text-[#4ade80] mx-auto mb-2" />
                            <div className="text-2xl font-bold text-[#4ade80]">{stat.value}</div>
                            <div className="text-xs text-white/60">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Main Demo Card */}
                <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
                    {/* Sample Score Display */}
                    <div className="relative">
                        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/20 p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-[#006C35] flex items-center justify-center">
                                    <Target className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{t('vision2030.title', 'Vision 2030 Alignment')}</h3>
                                    <p className="text-xs text-white/60">{isArabic ? 'تحليل سيرتك الذاتية' : 'Your Resume Analysis'}</p>
                                </div>
                            </div>

                            {/* Score Circle */}
                            <div className="flex items-center justify-center mb-6">
                                <div className="relative w-32 h-32">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="64" cy="64" r="56"
                                            fill="none"
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth="12"
                                        />
                                        <circle
                                            cx="64" cy="64" r="56"
                                            fill="none"
                                            stroke="url(#scoreGradient)"
                                            strokeWidth="12"
                                            strokeLinecap="round"
                                            strokeDasharray={`${87 * 3.51} 351`}
                                        />
                                        <defs>
                                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#006C35" />
                                                <stop offset="100%" stopColor="#4ade80" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-white">87%</span>
                                        <span className="text-xs text-[#4ade80]">{isArabic ? 'متوافق' : 'Aligned'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sample Sectors */}
                            <div className="space-y-2">
                                <p className="text-xs text-white/60 mb-2">{isArabic ? 'أفضل القطاعات المطابقة' : 'Top Matched Sectors'}</p>
                                <div className="flex flex-wrap gap-2">
                                    {VISION_2030_SECTORS.slice(0, 4).map((sector) => (
                                        <div
                                            key={sector.id}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#006C35]/20 border border-[#006C35]/30"
                                        >
                                            <SectorIcon sectorId={sector.id} className="w-4 h-4 text-[#4ade80]" />
                                            <span className="text-xs text-white">
                                                {isArabic ? sector.nameAr : sector.nameEn}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Glow effect */}
                        <div className="absolute -inset-4 bg-[#006C35]/20 blur-3xl rounded-full -z-10" />
                    </div>

                    {/* Benefits List */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white mb-6">
                            {isArabic ? 'لماذا هذا مهم لمستقبلك المهني؟' : 'Why This Matters for Your Career'}
                        </h3>
                        {benefits.map((benefit, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#006C35]/50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[#006C35]/20 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-white">
                                        {isArabic ? benefit.titleAr : benefit.titleEn}
                                    </h4>
                                    <p className="text-sm text-white/60">
                                        {isArabic ? benefit.descAr : benefit.descEn}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sector Icons Row */}
                <div className="mb-12">
                    <p className="text-center text-sm text-white/60 mb-4">
                        {isArabic ? 'نحلل سيرتك الذاتية ضمن 8 قطاعات حيوية' : 'We analyze your resume across 8 vital sectors'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {VISION_2030_SECTORS.map((sector) => (
                            <div
                                key={sector.id}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#006C35]/50 hover:bg-[#006C35]/10 transition-all min-w-[100px]"
                            >
                                <div className="w-10 h-10 rounded-lg bg-[#006C35]/20 flex items-center justify-center">
                                    <SectorIcon sectorId={sector.id} className="w-5 h-5 text-[#4ade80]" />
                                </div>
                                <span className="text-[10px] text-white/80 text-center">
                                    {isArabic ? sector.nameAr : sector.nameEn}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                        onClick={onGetStarted}
                        className="px-8 py-4 text-lg font-bold"
                        style={{ backgroundColor: '#006C35' }}
                    >
                        {isArabic ? 'حلل سيرتك الذاتية الآن' : 'Analyze Your Resume Now'}
                        <ChevronRight className={`w-5 h-5 ${isArabic ? 'rotate-180' : ''}`} />
                    </Button>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 text-[#4ade80] hover:text-white transition-colors font-medium"
                    >
                        <Sparkles className="w-4 h-4" />
                        {isArabic ? 'اعرف المزيد عن رؤية 2030' : 'Learn More About Vision 2030'}
                    </button>
                </div>
            </div>

            <Vision2030Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </section>
    );
}

export default Vision2030Demo;
