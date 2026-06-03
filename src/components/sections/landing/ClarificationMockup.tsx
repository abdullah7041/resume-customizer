import { useTranslation } from "react-i18next";
import { MessageSquareText, Sparkles } from "lucide-react";

export function ClarificationMockup() {
  const { t } = useTranslation();
  const questions = t("landing.productWalkthrough.preview.clarifyQuestions", { returnObjects: true }) as string[];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-[1.5rem] bg-white p-5 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(43,137,148,0.04)_0%,rgba(16,185,129,0.03)_100%)] dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.06)_0%,rgba(52,211,153,0.04)_100%)]" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#f5f4f0] p-2.5 text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black text-[#171717] dark:text-white">
                {t("landing.productWalkthrough.preview.clarifyTitle")}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-emerald-100/50">
                {t("landing.productWalkthrough.preview.clarifyMeta")}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {questions.map((question, index) => (
              <div
                key={question}
                className="group relative rounded-xl border border-slate-200 bg-[#f5f4f0] p-4 ring-1 ring-slate-900/5 transition-colors hover:border-[#2b8994]/30 hover:bg-white dark:border-emerald-300/10 dark:bg-emerald-300/[0.04] dark:ring-white/10 dark:hover:border-emerald-300/20 dark:hover:bg-emerald-300/[0.07]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2b8994]/10 text-[11px] font-black text-[#2b8994] dark:bg-emerald-300/15 dark:text-emerald-300">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-emerald-50/90">
                    {question}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#f5f4f0] px-4 py-3 dark:bg-emerald-300/[0.08]">
            <Sparkles className="h-3.5 w-3.5 text-[#2b8994] dark:text-emerald-300" />
            <span className="text-xs font-bold text-[#0c5963] dark:text-emerald-200/70">
              {t("landing.featureHighlights.clarify.aiPowered", "AI asks before rewriting — no assumptions")}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 -left-3 h-24 w-24 rounded-full bg-[#2b8994]/[0.08] blur-2xl dark:bg-emerald-500/[0.08]" />
      <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-[#2b8994]/[0.1] blur-2xl" />
    </div>
  );
}
