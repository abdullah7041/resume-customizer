// src/components/ui/Vision2030Modal.tsx
// Educational modal explaining Vision 2030 and how resume optimization aligns with Saudi national priorities

import { ExternalLink, Target, TrendingUp, Zap, Building2, Heart, Sun, Landmark, GraduationCap, Factory } from "lucide-react";
import { type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import HelpModal from "./HelpModal";
import { VISION_2030_SECTORS } from "../../lib/data/vision2030Skills";

interface Vision2030ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Map sector IDs to icons
const SECTOR_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    technology: Zap,
    tourism: Landmark,
    healthcare: Heart,
    'renewable-energy': Sun,
    finance: TrendingUp,
    manufacturing: Factory,
    education: GraduationCap,
    'mega-projects': Building2,
};

export default function Vision2030Modal({ isOpen, onClose }: Vision2030ModalProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    return (
        <HelpModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('vision2030.modal.title', '🇸🇦 Understanding Vision 2030')}
        >
            <div className="space-y-6">
                {/* What is Vision 2030 */}
                <section>
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {t('vision2030.modal.whatIs', 'What is Vision 2030?')}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {t('vision2030.modal.description',
                            'Saudi Vision 2030 is the Kingdom\'s ambitious plan to diversify its economy and reduce dependence on oil. It focuses on developing key sectors including technology, tourism, entertainment, healthcare, and renewable energy to create millions of new jobs for Saudi citizens and residents.'
                        )}
                    </p>
                </section>

                {/* Key Sectors Grid */}
                <section>
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        {t('vision2030.modal.sectors', 'Key Growth Sectors')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {VISION_2030_SECTORS.map((sector) => {
                            const IconComponent = SECTOR_ICONS[sector.id] || Target;
                            return (
                                <div
                                    key={sector.id}
                                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-400 transition-colors"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                        style={{ backgroundColor: '#006C35' }}
                                    >
                                        <IconComponent className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-medium text-center text-gray-700 dark:text-gray-300 leading-tight">
                                        {isArabic ? sector.nameAr : sector.nameEn}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* How We Help */}
                <section className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-700/50">
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mb-3">
                        {t('vision2030.modal.alignment', 'How We Help You Align')}
                    </h3>
                    <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">✓</span>
                            {t('vision2030.modal.help1', 'Analyze your resume for Vision 2030 sector keywords')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">✓</span>
                            {t('vision2030.modal.help2', 'Identify skills gaps in high-demand areas')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">✓</span>
                            {t('vision2030.modal.help3', 'Suggest relevant keywords to boost your profile')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">✓</span>
                            {t('vision2030.modal.help4', 'Match you with jobs in growing sectors')}
                        </li>
                    </ul>
                </section>

                {/* Learn More Link */}
                <div className="pt-2">
                    <a
                        href="https://www.vision2030.gov.sa/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                        style={{ backgroundColor: '#006C35' }}
                    >
                        <ExternalLink className="w-4 h-4" />
                        {t('vision2030.modal.learnMore', 'Learn More on vision2030.gov.sa')}
                    </a>
                </div>
            </div>
        </HelpModal>
    );
}
