import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Star } from "lucide-react";

export function Vision2030Mockup() {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const sectors = t("landing.productWalkthrough.preview.visionSignals", { returnObjects: true }) as string[];

  const float = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -6, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <motion.div
        {...float}
        className="relative overflow-hidden rounded-[1.5rem] bg-[#fbfcfa] p-5 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,108,53,0.04)_0%,rgba(43,137,148,0.06)_100%)] dark:bg-[linear-gradient(135deg,rgba(0,108,53,0.08)_0%,rgba(52,211,153,0.06)_100%)]" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#006C35]/10 dark:bg-emerald-300/10">
                <Star className="h-4 w-4 text-[#006C35] dark:text-emerald-300" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {t("landing.productWalkthrough.preview.visionTitle")}
                </div>
              </div>
            </div>
            <span className="rounded-full bg-[#006C35] px-3 py-1 text-xs font-black text-white shadow-md">
              2030
            </span>
          </div>

          <div className="mt-5 flex items-end gap-3">
            <div className="text-5xl font-black tabular-nums text-[#006C35] dark:text-emerald-300">
              92
            </div>
            <div className="pb-1.5 text-sm font-bold text-slate-500 dark:text-white/50">
              {t("landing.featureHighlights.vision.alignmentScore", "alignment score")}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {sectors.map((sector) => (
              <div
                key={sector}
                className="flex items-center justify-between rounded-xl bg-[#f4f9f7] px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-900/6 dark:bg-white/[0.06] dark:text-white/78 dark:ring-white/10"
              >
                <span>{sector}</span>
                <CheckCircle2 className="h-4 w-4 text-[#006C35] dark:text-emerald-300" />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-[#006C35]/[0.06] px-4 py-3 dark:bg-emerald-300/[0.06]">
            <p className="text-xs font-semibold leading-5 text-[#0c5963] dark:text-emerald-200/80">
              {t("landing.productWalkthrough.preview.visionDescription")}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="absolute -bottom-3 -right-3 h-24 w-24 rounded-full bg-[#006C35]/[0.06] blur-2xl dark:bg-emerald-300/10" />
      <div className="absolute -top-4 -left-4 h-20 w-20 rounded-full bg-[#2b8994]/[0.08] blur-2xl dark:bg-emerald-300/10" />
    </div>
  );
}
