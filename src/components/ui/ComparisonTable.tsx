import { useTranslation } from "react-i18next";
import { Check, FileText, Minus, PencilLine, Search, X } from "lucide-react";
import { cn } from "../../lib/utils/cn";

interface ComparisonTableProps {
  className?: string;
}

export function ComparisonTable({ className }: ComparisonTableProps) {
  const { t } = useTranslation();

  const categoryColumns = [
    {
      key: "resumeBuilder" as const,
      label: t("landing.comparison.genericResumeBuilder"),
      icon: FileText,
    },
    {
      key: "keywordScanner" as const,
      label: t("landing.comparison.keywordScanner"),
      icon: Search,
    },
    {
      key: "manualEditing" as const,
      label: t("landing.comparison.manualEditing"),
      icon: PencilLine,
    },
  ];

  const comparisonData = [
    {
      feature: t("landing.comparison.features.vision2030"),
      watheq: "yes",
      resumeBuilder: "no",
      keywordScanner: "no",
      manualEditing: "partial",
    },
    {
      feature: t("landing.comparison.features.antiHallucination"),
      watheq: "yes",
      resumeBuilder: "partial",
      keywordScanner: "partial",
      manualEditing: "partial",
    },
    {
      feature: t("landing.comparison.features.clarification"),
      watheq: t("landing.comparison.values.watheqClarification"),
      resumeBuilder: t("landing.comparison.values.resumeBuilderClarification"),
      keywordScanner: t("landing.comparison.values.keywordScannerClarification"),
      manualEditing: t("landing.comparison.values.manualEditingClarification"),
    },
    {
      feature: t("landing.comparison.features.fitScoring"),
      watheq: t("landing.comparison.values.watheqFitScoring"),
      resumeBuilder: t("landing.comparison.values.resumeBuilderFitScoring"),
      keywordScanner: t("landing.comparison.values.keywordScannerFitScoring"),
      manualEditing: t("landing.comparison.values.manualEditingFitScoring"),
    },
    {
      feature: t("landing.comparison.features.jobMatch"),
      watheq: "yes",
      resumeBuilder: "partial",
      keywordScanner: "yes",
      manualEditing: "partial",
    },
    {
      feature: t("landing.comparison.features.atsPassRate"),
      watheq: t("landing.comparison.values.watheqAts"),
      resumeBuilder: t("landing.comparison.values.resumeBuilderAts"),
      keywordScanner: t("landing.comparison.values.keywordScannerAts"),
      manualEditing: t("landing.comparison.values.manualEditingAts"),
    },
    {
      feature: t("landing.comparison.features.interviewPrep"),
      watheq: "yes",
      resumeBuilder: "no",
      keywordScanner: "no",
      manualEditing: "partial",
    },
  ];

  const renderCell = (value: string, isWatheq = false) => {
    if (value === "yes") {
      return (
        <div className={cn("flex items-center justify-center gap-2", isWatheq ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-white/80")}>
          <div className={cn("p-1 rounded-full", isWatheq ? "bg-emerald-500/10 dark:bg-emerald-500/20" : "bg-gray-200 dark:bg-white/10")}>
            <Check className="w-4 h-4" strokeWidth={3} />
          </div>
          <span className="text-sm font-semibold">{t("landing.comparison.values.yes")}</span>
        </div>
      );
    }
    if (value === "no") {
      return (
        <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-white/40">
          <X className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.no")}</span>
        </div>
      );
    }
    if (value === "partial") {
      return (
        <div className="flex items-center justify-center gap-2 text-yellow-600 dark:text-yellow-400/80">
          <Minus className="w-5 h-5" />
          <span className="text-sm">{t("landing.comparison.values.partial")}</span>
        </div>
      );
    }
    // Custom text value
    return (
      <div className={cn("text-center text-sm", isWatheq ? "font-bold text-emerald-600 dark:text-emerald-300" : "text-gray-500 dark:text-white/60")}>
        {value}
      </div>
    );
  };

  return (
    <div className={cn("w-full overflow-hidden neu-card", className)}>
      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="min-w-[820px]">
          {/* Header */}
          <div className="grid grid-cols-5 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <div className="p-4 flex items-end">
              {/* Empty features header for cleaner look */}
            </div>

            {/* Watheq Column Header */}
            <div className="p-4 relative bg-emerald-500/5 dark:bg-emerald-900/10">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                  <span className="text-2xl font-bold bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-200 dark:to-emerald-500 bg-clip-text text-transparent">
                    {t("landing.comparison.watheq").charAt(0)}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-100">{t("landing.comparison.watheq")}</span>
              </div>
            </div>

            {categoryColumns.map(({ key, label, icon: Icon }) => (
              <div key={key} className="p-4 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-white/40">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-center text-sm font-semibold leading-5">{label}</span>
              </div>
            ))}
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200 dark:divide-white/5">
            {comparisonData.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-5 transition-colors hover:bg-gray-100 dark:hover:bg-white/5",
                  idx % 2 === 0 ? "bg-transparent" : "bg-gray-50/50 dark:bg-black/20" // Zebra striping ledger style
                )}
              >
                {/* Feature Name */}
                <div className="p-4 flex items-center">
                  <span className="text-base font-medium text-gray-800 dark:text-white/90">{row.feature}</span>
                </div>

                {/* Watheq Data */}
                <div className="p-4 flex items-center justify-center bg-emerald-900/5 relative">
                  {/* Subtle highlight for the column */}
                  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent opacity-50" />
                  <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent opacity-50" />
                  {renderCell(row.watheq, true)}
                </div>

                {categoryColumns.map(({ key }) => (
                  <div key={key} className="p-4 flex items-center justify-center">
                    {renderCell(row[key])}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
