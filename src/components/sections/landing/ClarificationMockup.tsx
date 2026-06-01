import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareText, Sparkles } from "lucide-react";

export function ClarificationMockup() {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const questions = t("landing.productWalkthrough.preview.clarifyQuestions", { returnObjects: true }) as string[];

  const float = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -5, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.5 } };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <motion.div
        {...float}
        className="relative overflow-hidden rounded-[1.5rem] bg-[#061c16] p-5 shadow-2xl shadow-slate-950/20 ring-1 ring-white/10 dark:bg-[#06231d]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.06)_0%,rgba(52,211,153,0.04)_100%)]" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-200">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white">
                {t("landing.productWalkthrough.preview.clarifyTitle")}
              </div>
              <div className="text-xs font-semibold text-emerald-100/50">
                {t("landing.productWalkthrough.preview.clarifyMeta")}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {questions.map((question, index) => (
              <motion.div
                key={question}
                initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.1, ease: "easeOut" }}
                className="group relative rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4 transition-colors hover:border-emerald-300/20 hover:bg-emerald-300/[0.07]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-[11px] font-black text-emerald-300">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-emerald-50/90">
                    {question}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-300/[0.08] px-4 py-3">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-xs font-bold text-emerald-200/70">
              {t("landing.featureHighlights.clarify.aiPowered", "AI asks before rewriting — no assumptions")}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="absolute -bottom-3 -left-3 h-24 w-24 rounded-full bg-emerald-500/[0.08] blur-2xl" />
      <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-[#2b8994]/[0.1] blur-2xl" />
    </div>
  );
}
