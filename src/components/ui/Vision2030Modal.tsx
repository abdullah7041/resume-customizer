// src/components/ui/Vision2030Modal.tsx
// Educational modal explaining Vision 2030 and how resume optimization aligns with Saudi national priorities

import { useEffect } from 'react';
import { ExternalLink, Target, TrendingUp, X } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { VISION_2030_SECTORS } from "../../lib/data/vision2030Skills";
import { cn } from "../../lib/utils/cn";
import { SectorIcon } from "../../lib/utils/vision2030Icons";

interface Vision2030ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Vision2030Modal({ isOpen, onClose }: Vision2030ModalProps) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';

    // Close on ESC key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={cn(
                    "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto",
                    "bg-white dark:bg-gray-900",
                    "rounded-2xl shadow-2xl",
                    "border border-gray-200 dark:border-gray-700",
                    "animate-in fade-in zoom-in-95 duration-200"
                )}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {t('vision2030.modal.title', '🇸🇦 Understanding Vision 2030')}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
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
                                {VISION_2030_SECTORS.map((sector) => (
                                    <div
                                        key={sector.id}
                                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/50 hover:border-emerald-400 transition-colors"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                            style={{ backgroundColor: '#006C35' }}
                                        >
                                            <SectorIcon sectorId={sector.id} className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-medium text-center text-gray-700 dark:text-gray-300 leading-tight">
                                            {isArabic ? sector.nameAr : sector.nameEn}
                                        </span>
                                    </div>
                                ))}
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
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        {t('common.close', 'Got it!')}
                    </button>
                </div>
            </div>
        </div>
    );
}
