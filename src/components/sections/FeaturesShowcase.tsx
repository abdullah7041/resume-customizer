import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    FileSearch,
    Target,
    Sparkles,
    BarChart3,
    FileText,
    MessageSquare,
    Mail,
    Star,
    Check,
    ChevronDown,
    ChevronUp,
    Crown,
} from "lucide-react";
import SectionTitle from "../ui/SectionTitle";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/utils/cn";
import { glass } from "../../lib/styles/glass";

interface Feature {
    id: string;
    icon: ReactNode;
    titleKey: string;
    descriptionKey: string;
    benefitKeys: string[];
    gradient: string;
    highlight?: boolean;
}

const features: Feature[] = [
    {
        id: "smart-parsing",
        icon: <FileSearch className="w-8 h-8" />,
        titleKey: "showcase.parsing.title",
        descriptionKey: "showcase.parsing.description",
        benefitKeys: [
            "showcase.parsing.benefit1",
            "showcase.parsing.benefit2",
            "showcase.parsing.benefit3",
        ],
        gradient: "from-yellow-400 to-orange-500",
    },
    {
        id: "job-matching",
        icon: <Target className="w-8 h-8" />,
        titleKey: "showcase.matching.title",
        descriptionKey: "showcase.matching.description",
        benefitKeys: [
            "showcase.matching.benefit1",
            "showcase.matching.benefit2",
            "showcase.matching.benefit3",
        ],
        gradient: "from-emerald-400 to-teal-500",
    },
    {
        id: "ai-optimization",
        icon: <Sparkles className="w-8 h-8" />,
        titleKey: "showcase.optimization.title",
        descriptionKey: "showcase.optimization.description",
        benefitKeys: [
            "showcase.optimization.benefit1",
            "showcase.optimization.benefit2",
            "showcase.optimization.benefit3",
        ],
        gradient: "from-purple-400 to-pink-500",
    },
    {
        id: "keyword-analysis",
        icon: <BarChart3 className="w-8 h-8" />,
        titleKey: "showcase.keywords.title",
        descriptionKey: "showcase.keywords.description",
        benefitKeys: [
            "showcase.keywords.benefit1",
            "showcase.keywords.benefit2",
            "showcase.keywords.benefit3",
        ],
        gradient: "from-blue-400 to-indigo-500",
    },
    {
        id: "pro-templates",
        icon: <FileText className="w-8 h-8" />,
        titleKey: "showcase.templates.title",
        descriptionKey: "showcase.templates.description",
        benefitKeys: [
            "showcase.templates.benefit1",
            "showcase.templates.benefit2",
            "showcase.templates.benefit3",
        ],
        gradient: "from-cyan-400 to-blue-500",
    },
    {
        id: "interview-prep",
        icon: <MessageSquare className="w-8 h-8" />,
        titleKey: "showcase.interview.title",
        descriptionKey: "showcase.interview.description",
        benefitKeys: [
            "showcase.interview.benefit1",
            "showcase.interview.benefit2",
            "showcase.interview.benefit3",
        ],
        gradient: "from-rose-400 to-red-500",
    },
    {
        id: "cover-letters",
        icon: <Mail className="w-8 h-8" />,
        titleKey: "showcase.coverLetter.title",
        descriptionKey: "showcase.coverLetter.description",
        benefitKeys: [
            "showcase.coverLetter.benefit1",
            "showcase.coverLetter.benefit2",
            "showcase.coverLetter.benefit3",
        ],
        gradient: "from-violet-400 to-purple-500",
    },
    {
        id: "vision-2030",
        icon: <Star className="w-8 h-8" />,
        titleKey: "showcase.vision2030.title",
        descriptionKey: "showcase.vision2030.description",
        benefitKeys: [
            "showcase.vision2030.benefit1",
            "showcase.vision2030.benefit2",
            "showcase.vision2030.benefit3",
        ],
        gradient: "from-[#006C35] to-emerald-500",
        highlight: true,
    },
];

// Hero feature IDs - always visible (Empty to make all collapsible)
const heroFeatureIds: string[] = []; // Changed from having items to empty to make all features collapsible
const heroFeatures = features.filter((f) => heroFeatureIds.includes(f.id));
const additionalFeatures = features.filter((f) => !heroFeatureIds.includes(f.id));

function FeatureCard({ feature }: { feature: Feature }) {
    const { t } = useTranslation();

    return (
        <GlassCard
            className={cn(
                "p-6 h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                feature.highlight &&
                "border-[#006C35] shadow-[0_0_30px_rgba(0,108,53,0.2)]"
            )}
        >
            <div className="flex items-start gap-4">
                {/* Icon with gradient background */}
                <div
                    className={cn(
                        "flex-shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br shadow-lg",
                        feature.gradient
                    )}
                >
                    <span className="text-white">{feature.icon}</span>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Title with optional highlight badge */}
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">
                            {t(feature.titleKey)}
                        </h3>
                        {feature.highlight && (
                            <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-gray-900 text-xs font-bold shadow-lg"
                                aria-label="Vision 2030 Featured"
                            >
                                <Crown className="w-3 h-3" />
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 mt-2 leading-relaxed">
                        {t(feature.descriptionKey)}
                    </p>

                    {/* Benefits list */}
                    <ul className="mt-4 space-y-2">
                        {feature.benefitKeys.map((benefitKey, index) => (
                            <li
                                key={`${feature.id}-benefit-${index}`}
                                className="flex items-center gap-2 text-sm text-gray-200"
                            >
                                <Check
                                    className={cn(
                                        "w-4 h-4 flex-shrink-0",
                                        feature.highlight
                                            ? "text-[#4ade80]"
                                            : "text-emerald-400"
                                    )}
                                />
                                <span>{t(benefitKey)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </GlassCard>
    );
}

export default function FeaturesShowcase() {
    const { t } = useTranslation();
    const [showAllFeatures, setShowAllFeatures] = useState(false);

    return (
        <section className="pt-0 pb-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <SectionTitle
                    eyebrow={t("showcase.eyebrow")}
                    title={t("showcase.title")}
                    description={t("showcase.subtitle")}
                    className={cn("text-center mb-6 rounded-2xl p-6 shadow-lg [&_p]:text-gray-300 bg-black border border-white/10")}
                />

                {/* Hero Features - Always visible (3-column grid) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    {heroFeatures.map((feature) => (
                        <FeatureCard key={feature.id} feature={feature} />
                    ))}
                </div>

                {/* Expand/Collapse Button */}
                <div className="flex justify-center mt-8 relative z-10">
                    <button
                        onClick={() => setShowAllFeatures(!showAllFeatures)}
                        className={cn("flex items-center gap-2 px-6 py-3 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all font-medium shadow-lg cursor-pointer", glass.card)}
                        aria-expanded={showAllFeatures}
                        aria-controls="additional-features"
                        type="button"
                    >
                        {showAllFeatures ? (
                            <>
                                <span>{t("showcase.showLess")}</span>
                                <ChevronUp className="w-5 h-5" />
                            </>
                        ) : (
                            <>
                                <span>{t("showcase.viewAllFeatures")}</span>
                                <ChevronDown className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>

                {/* Additional Features - Expandable */}
                <div
                    id="additional-features"
                    className={cn(
                        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 overflow-hidden transition-all duration-500 ease-in-out",
                        showAllFeatures
                            ? "max-h-[2000px] opacity-90 pb-4"
                            : "max-h-0 opacity-0"
                    )}
                >
                    {additionalFeatures.map((feature) => (
                        <FeatureCard key={feature.id} feature={feature} />
                    ))}
                </div>
            </div>
        </section>
    );
}
