import { useTranslation } from "react-i18next";
import { CheckCircle2, X, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils/cn";

interface ComparisonTableProps {
  className?: string;
}

export function ComparisonTable({ className }: ComparisonTableProps) {
  const { t } = useTranslation();

  const comparisonData = [
    {
      feature: t("landing.comparison.features.vision2030"),
      watheq: "yes",
      toolA: "no",
      toolB: "no",
    },
    {
      feature: t("landing.comparison.features.antiHallucination"),
      watheq: "yes",
      toolA: "no",
      toolB: "partial",
    },
    {
      feature: t("landing.comparison.features.arabicSupport"),
      watheq: "yes",
      toolA: "no",
      toolB: "partial",
    },
    {
      feature: t("landing.comparison.features.jobMatch"),
      watheq: "yes",
      toolA: "yes",
      toolB: "yes",
    },
    {
      feature: t("landing.comparison.features.atsPassRate"),
      watheq: t("landing.comparison.values.watheqAts"),
      toolA: t("landing.comparison.values.toolAAts"),
      toolB: t("landing.comparison.values.toolBAts"),
    },
    {
      feature: t("landing.comparison.features.templates"),
      watheq: t("landing.comparison.values.watheqTemplates"),
      toolA: t("landing.comparison.values.toolATemplates"),
      toolB: t("landing.comparison.values.toolBTemplates"),
    },
    {
      feature: t("landing.comparison.features.interviewPrep"),
      watheq: "yes",
      toolA: "no",
      toolB: "yes",
    },
  ];

  const renderCell = (value: string, isWatheq = false) => {
    if (value === "yes") {
      return (
        <div className={cn("flex items-center justify-center gap-2", isWatheq && "text-emerald-400")}>
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">{t("landing.comparison.values.yes")}</span>
        </div>
      );
    }
    if (value === "no") {
      return (
        <div className="flex items-center justify-center gap-2 text-red-400/70">
          <X className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.no")}</span>
        </div>
      );
    }
    if (value === "partial") {
      return (
        <div className="flex items-center justify-center gap-2 text-yellow-400/70">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.partial")}</span>
        </div>
      );
    }
    // Custom text value
    return (
      <div className={cn("text-center text-sm", isWatheq ? "font-bold text-white" : "text-white/60")}>
        {value}
      </div>
    );
  };

  return (
    <div className={cn("w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent", className)}>
      {/* Mobile: Add scroll hint */}
      <div className="md:hidden text-xs text-white/50 text-center mb-2 flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{t("common.swipeToScroll") || "Swipe to see more"}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </div>
      <div className="min-w-[640px]">
        {/* Header */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-sm font-semibold text-white/60 flex items-end pb-2">
            {/* Empty cell for features column */}
          </div>
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/50 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-base font-bold text-emerald-300">{t("landing.comparison.watheq")}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="text-lg">A</span>
              </div>
              <span className="text-sm text-white/60">{t("landing.comparison.genericToolA")}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <span className="text-lg">B</span>
              </div>
              <span className="text-sm text-white/60">{t("landing.comparison.genericToolB")}</span>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {comparisonData.map((row, idx) => (
            <div
              key={idx}
              className={cn(
                "grid grid-cols-4 gap-4 p-4 rounded-xl border backdrop-blur-sm transition-all duration-300",
                idx === 0 || idx === 1
                  ? "bg-emerald-900/10 border-emerald-500/20 hover:border-emerald-500/30"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              )}
            >
              <div className="flex items-center">
                <span className="text-sm font-medium text-white">{row.feature}</span>
              </div>
              <div className="flex items-center justify-center">
                {renderCell(row.watheq, true)}
              </div>
              <div className="flex items-center justify-center">
                {renderCell(row.toolA)}
              </div>
              <div className="flex items-center justify-center">
                {renderCell(row.toolB)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
