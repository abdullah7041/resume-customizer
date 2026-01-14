// src/components/ui/Vision2030Modal.tsx
// Educational modal explaining Vision 2030 with modern Glass UI

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Target, TrendingUp, X, Sparkles, MapPin, ArrowRight } from "lucide-react";
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
    const [activeTab, setActiveTab] = useState<'overview' | 'sectors'>('overview');

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

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Darker Blur Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Container - Glassmorphism */}
            <div
                className={cn(
                    "relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col",
                    "bg-black/40 backdrop-blur-2xl",
                    "rounded-2xl shadow-2xl shadow-emerald-900/40",
                    "border border-white/10 ring-1 ring-white/5",
                    "animate-in fade-in zoom-in-95 duration-300 ease-out z-[101]"
                )}
            >
                {/* Decorative Background Gradients */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-[80px] -z-10 pointer-events-none" />

                {/* Header */}
                <div className="flex-none px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-xl sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center justify-center shadow-lg shadow-emerald-500/20">
                            {/* Fallback Icon - Better Aligned */}
                            <div className="flex flex-col items-center justify-center leading-none text-white font-bold text-[10px] tracking-tight">
                                <span>20</span>
                                <span>30</span>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                {t('vision2030.modal.title', 'Understanding Vision 2030').replace(/SA|🇸🇦/g, '').trim()}
                            </h2>
                            <p className="text-xs text-emerald-300 font-medium tracking-wide uppercase">
                                National Transformation Program
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all duration-200"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 md:p-8 space-y-8">

                        {/* Hero / Description */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 group hover:bg-white/[0.07] transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <MapPin className="w-32 h-32 text-emerald-500" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-3">
                                <Target className="w-5 h-5 text-emerald-400" />
                                <span className="bg-gradient-to-r from-emerald-200 to-white bg-clip-text text-transparent">
                                    {t('vision2030.modal.whatIs', 'What is Vision 2030?')}
                                </span>
                            </h3>
                            <p className="text-white/70 leading-relaxed text-base md:text-lg max-w-2xl">
                                {t('vision2030.modal.description',
                                    'Saudi Vision 2030 is the Kingdom\'s ambitious plan to diversify its economy and reduce dependence on oil. It focuses on developing key sectors including technology, tourism, entertainment, healthcare, and renewable energy to create millions of new jobs for Saudi citizens and residents.'
                                )}
                            </p>
                        </div>

                        {/* Sectors Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                                    {t('vision2030.modal.sectors', 'Key Growth Sectors')}
                                </h3>
                                <span className="text-xs font-medium px-2 py-1 rounded bg-white/5 border border-white/10 text-white/40">
                                    High Demand
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {VISION_2030_SECTORS.map((sector) => (
                                    <div
                                        key={sector.id}
                                        className="group relative flex flex-col items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-emerald-900/20 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 cursor-default"
                                    >
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/5 group-hover:border-emerald-500/20 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all"
                                        >
                                            <SectorIcon sectorId={sector.id} className="w-6 h-6 text-white/60 group-hover:text-emerald-400 transition-colors" />
                                        </div>
                                        <span className="text-sm font-medium text-center text-white/70 group-hover:text-white leading-tight">
                                            {isArabic ? sector.nameAr : sector.nameEn}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Alignment Section */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-900/20 to-teal-900/10 backdrop-blur-sm">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-yellow-400" />
                                    {t('vision2030.modal.alignment', 'How We Help You Align')}
                                </h3>
                                <ul className="space-y-4">
                                    {[1, 2, 3, 4].map((num) => (
                                        <li key={num} className="flex items-start gap-3 text-sm text-white/80">
                                            <div className="mt-0.5 min-w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            </div>
                                            <span>{t(`vision2030.modal.help${num}` as any)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA / Learn More */}
                            <div className="flex flex-col justify-center items-center text-center p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
                                <div className="w-16 h-16 rounded-full bg-[#006C35]/20 flex items-center justify-center border border-[#006C35]/30 mb-2">
                                    {/* Removed Emoji as requested */}
                                    <Sparkles className="w-8 h-8 text-[#006C35]" />
                                </div>
                                <h4 className="text-white font-bold text-lg">
                                    Ready to join the transformation?
                                </h4>
                                <p className="text-white/50 text-sm max-w-xs">
                                    Explore the official Vision 2030 portal for detailed roadmap and opportunities.
                                </p>
                                <a
                                    href="https://www.vision2030.gov.sa/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#006C35] hover:bg-[#007A3D] text-white font-bold text-sm shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:scale-105 transition-all duration-300"
                                >
                                    {t('vision2030.modal.learnMore', 'Visit vision2030.gov.sa')}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Add strict type checking for help translation keys to avoid TS errors
// or simply use 'as any' cast above which is safer for quick iteration here.
