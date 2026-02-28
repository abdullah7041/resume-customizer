import { useTranslation } from "react-i18next";
import { Check, X, Minus } from "lucide-react";
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
        <div className={cn("flex items-center justify-center gap-2", isWatheq ? "text-emerald-400" : "text-white/80")}>
          <div className={cn("p-1 rounded-full", isWatheq ? "bg-emerald-500/20" : "bg-white/10")}>
            <Check className="w-4 h-4" strokeWidth={3} />
          </div>
          <span className="text-sm font-semibold">{t("landing.comparison.values.yes")}</span>
        </div>
      );
    }
    if (value === "no") {
      return (
        <div className="flex items-center justify-center gap-2 text-white/40">
          <X className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.no")}</span>
        </div>
      );
    }
    if (value === "partial") {
      return (
        <div className="flex items-center justify-center gap-2 text-yellow-400/80">
          <Minus className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.partial")}</span>
        </div>
      );
    }
    // Custom text value
    return (
      <div className={cn("text-center text-sm", isWatheq ? "font-bold text-emerald-300" : "text-white/60")}>
        {value}
      </div>
    );
  };

  return (
    <div className={cn("w-full overflow-hidden neu-card", className)}>
      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="min-w-[640px]">
          {/* Header */}
          <div className="grid grid-cols-4 border-b border-white/10 bg-white/5">
            <div className="p-4 flex items-end">
              {/* Empty features header for cleaner look */}
            </div>

            {/* Watheq Column Header */}
            <div className="p-4 relative bg-emerald-900/10">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                  <span className="text-2xl font-bold bg-gradient-to-br from-emerald-200 to-emerald-500 bg-clip-text text-transparent">
                    {t("landing.comparison.watheq").charAt(0)}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-100">{t("landing.comparison.watheq")}</span>
              </div>
            </div>

            {/* Tool A */}
            <div className="p-4 flex flex-col items-center justify-center gap-2 text-white/40">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="font-semibold">A</span>
              </div>
              <span className="text-sm">{t("landing.comparison.genericToolA")}</span>
            </div>

            {/* Tool B */}
            <div className="p-4 flex flex-col items-center justify-center gap-2 text-white/40">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="font-semibold">B</span>
              </div>
              <span className="text-sm">{t("landing.comparison.genericToolB")}</span>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {comparisonData.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-4 transition-colors hover:bg-white/5",
                  idx % 2 === 0 ? "bg-transparent" : "bg-black/20" // Zebra striping ledger style
                )}
              >
                {/* Feature Name */}
                <div className="p-4 flex items-center">
                  <span className="text-base font-medium text-white/90">{row.feature}</span>
                </div>

                {/* Watheq Data */}
                <div className="p-4 flex items-center justify-center bg-emerald-900/5 relative">
                  {/* Subtle highlight for the column */}
                  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent opacity-50" />
                  <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent opacity-50" />
                  {renderCell(row.watheq, true)}
                </div>

                {/* Tool A Data */}
                <div className="p-4 flex items-center justify-center">
                  {renderCell(row.toolA)}
                </div>

                {/* Tool B Data */}
                <div className="p-4 flex items-center justify-center">
                  {renderCell(row.toolB)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
