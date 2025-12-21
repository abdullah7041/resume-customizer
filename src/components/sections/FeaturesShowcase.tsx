import React from "react";
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
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import SectionTitle from "../ui/SectionTitle";
import { cn } from "../../lib/utils/cn";

interface Feature {
    id: string;
    icon: React.ReactNode;
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

export default function FeaturesShowcase() {
    const { t } = useTranslation();

    return (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <SectionTitle
                    eyebrow={t("showcase.eyebrow")}
                    title={t("showcase.title")}
                    description={t("showcase.subtitle")}
                    className="text-center mb-12"
                />

                <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mt-12">
                    {features.map((feature) => (
                        <GlassCard
                            key={feature.id}
                            variant={feature.highlight ? "elevated" : "default"}
                            className={cn(
                                "p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                                feature.highlight &&
                                "border-[#006C35]/50 shadow-[0_0_30px_rgba(0,108,53,0.2)]"
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
                                            <span className="text-lg" aria-label="Saudi Arabia flag">
                                                🇸🇦
                                            </span>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-gray-400 mt-2 leading-relaxed">
                                        {t(feature.descriptionKey)}
                                    </p>

                                    {/* Benefits list */}
                                    <ul className="mt-4 space-y-2">
                                        {feature.benefitKeys.map((benefitKey, index) => (
                                            <li
                                                key={`${feature.id}-benefit-${index}`}
                                                className="flex items-center gap-2 text-sm text-gray-300"
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
                    ))}
                </div>
            </div>
        </section>
    );
}
