import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Languages,
  ListChecks,
  MessageSquareText,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { ProductWalkthrough } from "@/components/sections/ProductWalkthrough";
import { getSkylineUrls } from "@/lib/assets";

interface LandingPageProps {
  onGetStarted: () => void;
}

function translatedList(t: ReturnType<typeof useTranslation>["t"], key: string) {
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as string[]) : [];
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-[#fbfcfa]/86 p-4 text-start shadow-sm ring-1 ring-slate-900/6 backdrop-blur dark:bg-white/[0.08] dark:ring-white/10">
      <div className="text-3xl font-black tabular-nums text-[#0b1026] dark:text-white">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#2b8994] dark:text-emerald-300">{label}</div>
    </div>
  );
}

function HeroProductStage() {
  const { t } = useTranslation();
  const skylineUrls = useMemo(() => getSkylineUrls(), []);
  const isFallbackSkyline = skylineUrls.desktop.startsWith("data:image/");
  const shouldReduceMotion = useReducedMotion();
  const clarifyQuestions = translatedList(t, "landing.productWalkthrough.preview.clarifyQuestions");
  const proofItems = translatedList(t, "landing.productWalkthrough.heroProof.items");
  const keywordTags = translatedList(t, "landing.productWalkthrough.preview.keywordTags");

  const floatSlow = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -8, 0] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const } };

  const floatSlower = shouldReduceMotion
    ? {}
    : { animate: { y: [0, -7, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay: 1 } };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="landing-proof-panel relative overflow-hidden rounded-[1.5rem] bg-[#f4f9f7] px-4 py-5 shadow-2xl shadow-slate-950/8 ring-1 ring-slate-900/6 dark:bg-[#082b23] dark:shadow-black/30 dark:ring-white/10 sm:px-8 sm:py-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,252,250,0.94)_0%,rgba(239,248,245,0.84)_46%,rgba(232,238,248,0.58)_100%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(16,185,129,0.08)_52%,rgba(236,72,153,0.05)_100%)]" />
        <picture className="absolute inset-x-4 top-0 h-48 opacity-20 sm:inset-x-8 sm:h-64">
          <source
            media="(max-width: 767px)"
            srcSet={skylineUrls.mobile}
            type={isFallbackSkyline ? undefined : "image/avif"}
          />
          <img
            src={skylineUrls.desktop}
            alt=""
            className="h-full w-full rounded-b-[1.5rem] object-cover object-[54%_42%]"
            decoding="async"
            fetchPriority="high"
          />
        </picture>

        <div className="relative grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="space-y-5 pt-1 sm:pt-4">
            <div className="inline-flex items-center rounded-full bg-[#f4f9f7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm ring-1 ring-slate-900/6 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10">
              {t("landing.productWalkthrough.heroProof.eyebrow")}
            </div>
            <h2 className="max-w-md text-2xl font-black leading-tight text-[#171717] dark:text-white sm:text-3xl">
              {t("landing.productWalkthrough.heroProof.title")}
            </h2>
            <p className="max-w-md text-sm leading-7 text-slate-600 dark:text-white/62">
              {t("landing.productWalkthrough.stageSubtitle")}
            </p>
            <div className="grid max-w-md gap-2">
              {proofItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#fbfcfa]/82 p-3 text-sm font-bold leading-6 text-[#0c3541] shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.07] dark:text-white/78 dark:ring-white/10">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2b8994] dark:text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[430px] sm:min-h-[390px]">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: -4 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              {...floatSlow}
              className="absolute left-0 top-10 hidden w-56 rounded-[1.5rem] bg-[#fbfcfa] p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 lg:block dark:bg-[#06231d] dark:ring-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {t("landing.productWalkthrough.preview.before")}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-white/60">52</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-4/5 rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="h-2 w-3/5 rounded-full bg-slate-200 dark:bg-white/10" />
              </div>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
              className="mx-auto w-full max-w-sm rounded-[1.5rem] bg-[#fbfcfa] p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10 sm:p-5"
            >
              <div className="rounded-[1.25rem] bg-[#0b1026] p-4 text-white dark:bg-[#06231d]">
                <div className="flex items-center justify-between text-xs font-bold text-white/70">
                  <span>{t("landing.productWalkthrough.heroCardTitle")}</span>
                  <span>{t("landing.productWalkthrough.preview.exampleLabel")}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <ProofMetric value="62%" label={t("landing.productWalkthrough.preview.matchScore")} />
                  <ProofMetric value="86" label={t("landing.productWalkthrough.preview.after")} />
                </div>
                <div className="mt-4 text-sm font-semibold text-white/72">
                  {t("landing.productWalkthrough.preview.keywordLift")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordTags.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/78 ring-1 ring-white/10">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  t("landing.productWalkthrough.heroProof.clarify"),
                  t("landing.productWalkthrough.heroProof.vision"),
                  t("landing.productWalkthrough.heroProof.interview"),
                ].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 dark:bg-white/[0.06] dark:text-white/72">
                    <span>{item}</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, rotate: 2 }}
              animate={{ opacity: 1, y: 0, rotate: 3 }}
              transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
              {...floatSlower}
              className="absolute bottom-0 right-0 w-[88%] rounded-[1.35rem] bg-[#fbfcfa] p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10 sm:w-72 lg:bottom-8"
            >
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                <MessageSquareText className="h-4 w-4" />
                {t("landing.productWalkthrough.preview.clarifyEyebrow")}
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-white/72">
                {clarifyQuestions[0]}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.25rem] bg-[#f4f9f7] p-5 shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.055] dark:ring-white/10">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff8f7] text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-xl font-black text-[#171717] dark:text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/62">{description}</p>
    </article>
  );
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const skylineUrls = useMemo(() => getSkylineUrls(), []);
  const isFallbackSkyline = skylineUrls.desktop.startsWith("data:image/");

  const trustSignals = [
    { icon: ListChecks, label: t("landing.productWalkthrough.heroProof.clarify") },
    { icon: ShieldCheck, label: t("landing.productWalkthrough.identity.verified") },
    { icon: Languages, label: t("landing.productWalkthrough.identity.bilingual") },
    { icon: FileCheck2, label: t("landing.productWalkthrough.identity.vision") },
  ];

  const tailoringCards = [
    { icon: Target, title: t("landing.productStory.why.cards.role.title"), description: t("landing.productStory.why.cards.role.description") },
    { icon: SearchCheck, title: t("landing.productStory.why.cards.ats.title"), description: t("landing.productStory.why.cards.ats.description") },
    { icon: ShieldCheck, title: t("landing.productStory.why.cards.proof.title"), description: t("landing.productStory.why.cards.proof.description") },
  ];

  const finalBenefits = translatedList(t, "landing.finalCta.benefits");

  return (
    <main className="landing-page relative isolate flex min-h-screen flex-col bg-[#fbfcfa] text-slate-950 dark:bg-[#031713] dark:text-white">
      <section className="relative overflow-hidden px-5 pb-12 pt-16 sm:px-8 lg:pb-16 lg:pt-24">
        <picture className="pointer-events-none absolute inset-0 z-0 block opacity-[0.28] dark:opacity-[0.34]">
          <source
            media="(max-width: 767px)"
            srcSet={skylineUrls.mobile}
            type={isFallbackSkyline ? undefined : "image/avif"}
          />
          <img
            src={skylineUrls.desktop}
            alt=""
            className="h-full w-full object-cover object-[54%_42%]"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(251,252,250,0.88)_0%,rgba(251,252,250,0.78)_52%,rgba(251,252,250,0.98)_100%)] dark:bg-[linear-gradient(180deg,rgba(6,19,15,0.76)_0%,rgba(6,19,15,0.84)_55%,rgba(6,19,15,1)_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f4f9f7] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-emerald-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.trustBadge")}
            </motion.div>

            <motion.h1
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
              className="text-balance text-4xl font-black leading-[0.96] sm:text-6xl lg:text-7xl"
            >
              <span className="bg-gradient-to-br from-[#0b1026] via-[#0f766e] to-[#2b8994] bg-clip-text text-transparent dark:from-white dark:via-emerald-200 dark:to-emerald-400">
                {t("landing.productWalkthrough.heroTitle")}
              </span>
            </motion.h1>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-white/64 sm:text-xl"
            >
              {t("landing.productWalkthrough.heroSubtitle")}
            </motion.p>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <button
                type="button"
                onClick={onGetStarted}
                className="group relative inline-flex min-h-[52px] items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#0b1026] to-[#2b8994] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:from-emerald-600 dark:to-emerald-400 dark:text-slate-950 dark:shadow-emerald-500/10 dark:hover:shadow-emerald-400/20"
              >
                <span className="relative z-10">{t("landing.hero.cta")}</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#2b8994] to-[#0b1026] opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-emerald-400 dark:to-emerald-600" />
              </button>
              <span className="text-sm font-semibold text-slate-500 dark:text-white/52">
                {t("landing.productWalkthrough.heroNote")}
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mx-auto mt-9 max-w-5xl"
          >
            <HeroProductStage />
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
            className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="flex cursor-default items-center justify-center gap-3 rounded-2xl bg-[#f4f9f7] p-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.06] dark:text-white/72 dark:ring-white/10"
              >
                <signal.icon className="h-5 w-5 shrink-0 text-[#2b8994] dark:text-emerald-300" />
                <span>{signal.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-[#eef8f4] px-5 py-14 dark:bg-[#041c17] sm:px-8 lg:py-20" aria-labelledby="tailoring-title">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#2b8994] dark:text-emerald-300">
              {t("landing.productStory.why.eyebrow")}
            </p>
            <h2 id="tailoring-title" className="mt-4 max-w-xl text-4xl font-black leading-[0.98] text-[#171717] dark:text-white sm:text-5xl">
              {t("landing.productStory.why.title")}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600 dark:text-white/62">
              {t("landing.productStory.why.subtitle")}
            </p>
            <p className="mt-6 max-w-xl rounded-[1.25rem] bg-[#f4f9f7]/70 p-4 text-sm font-black leading-7 text-[#0c5963] shadow-sm ring-1 ring-[#cfe8e5] dark:bg-white/[0.06] dark:text-emerald-100 dark:ring-white/10">
              {t("landing.productStory.why.bridge")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {tailoringCards.map((card) => (
              <StoryCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <ProductWalkthrough onGetStarted={onGetStarted} />

      <section className="bg-[#eef8f4] px-5 py-16 text-[#171717] dark:bg-[#041c17] dark:text-white sm:px-8 lg:py-20" aria-labelledby="landing-final-title">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#2b8994] dark:text-emerald-300">
              {t("landing.productWalkthrough.finalEyebrow")}
            </p>
            <h2 id="landing-final-title" className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] text-[#171717] dark:text-white sm:text-5xl">
              {t("landing.productWalkthrough.finalTitle")}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {finalBenefits.map((benefit) => (
                <span key={benefit} className="inline-flex items-center gap-2 rounded-full bg-[#f4f9f7] px-4 py-2 text-sm font-bold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-white/10 dark:text-white/78 dark:ring-white/10">
                  <CheckCircle2 className="h-4 w-4 text-[#2b8994] dark:text-[#5eead4]" />
                  {benefit}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#5eead4] px-8 py-3.5 text-sm font-black text-[#052e2b] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef8f4] dark:focus-visible:ring-offset-[#092018]"
          >
            {t("landing.productWalkthrough.cta")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </section>
    </main>
  );
}
