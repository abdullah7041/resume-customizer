import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareText, CheckCircle2 } from "lucide-react";

export function InterviewPrepMockup() {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const questions = t("landing.productWalkthrough.preview.interviewQuestions", { returnObjects: true }) as string[];

  const float = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -6, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.3 } };

  return (
    <div className="relative mx-auto w-full max-w-md">
      <motion.div
        {...float}
        className="relative overflow-hidden rounded-[1.5rem] bg-[#f5f4f0] p-5 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(43,137,148,0.04)_0%,rgba(14,165,233,0.03)_100%)] dark:bg-[linear-gradient(135deg,rgba(52,211,153,0.06)_0%,rgba(14,165,233,0.04)_100%)]" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-black text-[#171717] dark:text-white">
                {t("landing.productWalkthrough.preview.interviewTitle")}
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {t("landing.productWalkthrough.preview.interviewMeta")}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {questions.map((question, index) => (
              <motion.div
                key={question}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.1, ease: "easeOut" }}
                className="rounded-xl bg-white p-4 ring-1 ring-slate-900/5 dark:bg-white/[0.05] dark:ring-white/10"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2b8994]/10 text-[11px] font-black text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-300">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-white/78">
                    {question}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#0b1026] px-4 py-3.5 dark:bg-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 dark:text-[#052e2b]" />
            <span className="text-xs font-bold text-white dark:text-[#052e2b]">
              {t("landing.productWalkthrough.preview.interviewReady")}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="absolute -bottom-3 -right-3 h-24 w-24 rounded-full bg-[#2b8994]/[0.08] blur-2xl dark:bg-emerald-300/10" />
      <div className="absolute -top-4 -left-4 h-20 w-20 rounded-full bg-sky-500/[0.06] blur-2xl dark:bg-sky-300/10" />
    </div>
  );
}
