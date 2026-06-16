import { useEffect, useId, useMemo, useState, type SyntheticEvent } from "react";
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

import { PricingSection } from "../components/sections/PricingSection";
import { ComparisonTable } from "../components/ui/ComparisonTable";
import { FeatureHighlightSection } from "../components/sections/FeatureHighlightSection";
import { Vision2030Mockup } from "../components/sections/landing/Vision2030Mockup";
import { ClarificationMockup } from "../components/sections/landing/ClarificationMockup";
import { InterviewPrepMockup } from "../components/sections/landing/InterviewPrepMockup";
import { getSkylineUrls, SKYLINE_FALLBACK_URL } from "../lib/assets";

import { analytics } from "../services/analytics";

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn?: () => void;
}

function translatedList(t: ReturnType<typeof useTranslation>["t"], key: string) {
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as string[]) : [];
}

// Safety net only: if the bundled hero asset genuinely fails to load, swap to the
// inline SVG fallback. We strip the <picture> <source> elements so the fallback
// src actually wins, and log in dev so a broken asset is never silently masked.
function handleSkylineError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.closest("picture")?.querySelectorAll("source").forEach((source) => source.remove());
  img.src = SKYLINE_FALLBACK_URL;
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    console.warn("[LandingPage] Hero skyline asset failed to load; applied SVG fallback.");
  }
}

function ProofMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/86 p-4 text-start shadow-sm ring-1 ring-slate-900/6 backdrop-blur dark:bg-white/[0.08] dark:ring-white/10">
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
      <div className="landing-proof-panel relative overflow-hidden rounded-[1.5rem] bg-[#f5f4f0] px-4 py-5 shadow-2xl shadow-slate-950/8 ring-1 ring-slate-900/6 dark:bg-[#082b23] dark:shadow-black/30 dark:ring-white/10 sm:px-8 sm:py-8 lg:px-12">
        <picture className="pointer-events-none absolute inset-x-4 top-0 h-48 opacity-40 sm:inset-x-8 sm:h-64">
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
            onError={handleSkylineError}
          />
        </picture>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(245,244,240,0.84)_46%,rgba(240,239,235,0.58)_100%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(16,185,129,0.08)_52%,rgba(236,72,153,0.05)_100%)]" />

        <div className="relative grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="space-y-5 pt-1 sm:pt-4">
            <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm ring-1 ring-slate-900/6 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/10">
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
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/82 p-3 text-sm font-bold leading-6 text-[#0c3541] shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.07] dark:text-white/78 dark:ring-white/10">
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
              className="absolute left-0 top-10 hidden w-56 rounded-[1.5rem] bg-white p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 lg:block dark:bg-[#06231d] dark:ring-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {t("landing.productWalkthrough.preview.before")}
                </span>
                <span className="rounded-full bg-[#f5f4f0] px-2 py-1 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-white/60">52</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-4/5 rounded-full bg-[#f5f4f0] dark:bg-white/10" />
                <div className="h-2 w-full rounded-full bg-[#f5f4f0] dark:bg-white/10" />
                <div className="h-2 w-3/5 rounded-full bg-[#f5f4f0] dark:bg-white/10" />
              </div>
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
              className="mx-auto w-full max-w-sm rounded-[1.5rem] bg-white p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10 sm:p-5"
            >
              <div className="rounded-[1.25rem] bg-white p-4 text-[#171717] shadow-sm ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:text-white dark:ring-white/10">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-white/70">
                  <span>{t("landing.productWalkthrough.heroCardTitle")}</span>
                  <span>{t("landing.productWalkthrough.preview.exampleLabel")}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <ProofMetric value="62%" label={t("landing.productWalkthrough.preview.matchScore")} />
                  <ProofMetric value="86" label={t("landing.productWalkthrough.preview.after")} />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-600 dark:text-white/72">
                  {t("landing.productWalkthrough.preview.keywordLift")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordTags.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-[#f5f4f0] px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-white/78 dark:ring-white/10">
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
                  <div key={item} className="flex items-center justify-between rounded-2xl bg-[#f5f4f0] px-4 py-3 text-sm font-bold text-slate-600 dark:bg-white/[0.06] dark:text-white/72">
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
              className="absolute bottom-0 right-0 w-[88%] rounded-[1.35rem] bg-white p-4 shadow-2xl shadow-slate-950/12 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:ring-white/10 sm:w-72 lg:bottom-8"
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

function SeeItInActionDemo() {
  const { t } = useTranslation();
  const resultRegionId = useId();
  const shouldReduceMotion = useReducedMotion();
  const [showOptimized, setShowOptimized] = useState(false);
  const changeItems = translatedList(t, "landing.productWalkthrough.actionDemo.changes");
  const activeBulletKey = showOptimized ? "optimizedBullet" : "weakBullet";
  const activeLabelKey = showOptimized ? "optimizedLabel" : "weakLabel";

  return (
    <section
      id="see-it-in-action"
      className="bg-white px-5 py-14 text-[#171717] dark:bg-[#031713] dark:text-white sm:px-8 lg:py-20"
      aria-labelledby="see-action-title"
    >
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.48, ease: "easeOut" }}
          className="max-w-xl"
        >
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#2b8994] dark:text-emerald-300">
            {t("landing.productWalkthrough.actionDemo.eyebrow")}
          </p>
          <h2 id="see-action-title" className="mt-4 text-4xl font-black leading-[0.98] sm:text-5xl">
            {t("landing.productWalkthrough.actionDemo.title")}
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-white/62">
            {t("landing.productWalkthrough.actionDemo.subtitle")}
          </p>

          <div className="mt-7 rounded-[1.25rem] bg-[#f5f4f0] p-4 ring-1 ring-slate-900/6 dark:bg-white/[0.055] dark:ring-white/10">
            <div className="flex items-start gap-3">
              <MessageSquareText className="mt-1 h-5 w-5 shrink-0 text-[#2b8994] dark:text-emerald-300" />
              <div>
                <p className="text-sm font-black text-[#0c5963] dark:text-emerald-100">
                  {t("landing.productWalkthrough.actionDemo.questionLabel")}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-white/70">
                  {t("landing.productWalkthrough.actionDemo.question")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
          className="landing-proof-panel overflow-hidden rounded-[1.5rem] bg-[#f5f4f0] p-4 shadow-2xl shadow-slate-950/8 ring-1 ring-slate-900/6 dark:bg-[#06231d] dark:shadow-none dark:ring-white/10 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/45">
                {t("landing.productWalkthrough.actionDemo.sampleLabel")}
              </p>
              <h3 className="mt-1 text-xl font-black text-[#171717] dark:text-white">
                {t("landing.productWalkthrough.actionDemo.sampleTitle")}
              </h3>
            </div>
            <button
              type="button"
              aria-pressed={showOptimized}
              aria-controls={resultRegionId}
              onClick={() => setShowOptimized((value) => !value)}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#0b1026] px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#2b8994] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0] motion-reduce:transform-none dark:bg-emerald-300 dark:text-[#052e2b] dark:hover:bg-emerald-200 dark:focus-visible:ring-offset-[#06231d] sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              {t(showOptimized ? "landing.productWalkthrough.actionDemo.showWeak" : "landing.productWalkthrough.actionDemo.showOptimized")}
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.82fr]">
            <div
              id={resultRegionId}
              aria-live="polite"
              className="rounded-[1.25rem] bg-white p-4 ring-1 ring-slate-900/6 dark:bg-white/[0.06] dark:ring-white/10 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f5f4f0] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-white/10 dark:text-white/55">
                  {t(`landing.productWalkthrough.actionDemo.${activeLabelKey}`)}
                </span>
                <span className="rounded-full bg-[#2b8994]/10 px-3 py-1 text-xs font-black text-[#0c5963] dark:bg-emerald-300/10 dark:text-emerald-200">
                  {showOptimized ? "86%" : "52%"} {t("landing.productWalkthrough.preview.matchScore")}
                </span>
              </div>
              <p className="mt-4 text-base font-black leading-7 text-[#171717] dark:text-white">
                {t(`landing.productWalkthrough.actionDemo.${activeBulletKey}`)}
              </p>
              <div className="mt-5 rounded-xl bg-[#f5f4f0] p-4 dark:bg-[#031713]">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/45">
                  {t("landing.productWalkthrough.actionDemo.jobContextLabel")}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-white/70">
                  {t("landing.productWalkthrough.actionDemo.jobContext")}
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] bg-[#0b1026] p-4 text-white dark:bg-[#031713] dark:ring-1 dark:ring-white/10 sm:p-5">
              <p className="text-sm font-black text-emerald-200">
                {t("landing.productWalkthrough.actionDemo.changedTitle")}
              </p>
              <ul className="mt-4 space-y-3">
                {changeItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-semibold leading-6 text-white/78">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl bg-white/10 p-3 text-xs font-bold leading-5 text-emerald-100">
                {t("landing.productWalkthrough.actionDemo.verifyNote")}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProofWorkflowStep({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <article className="group grid gap-4 rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-900/6 transition hover:-translate-y-0.5 hover:ring-[#2b8994]/20 dark:bg-white/[0.055] dark:ring-white/10 dark:hover:ring-emerald-300/20 sm:grid-cols-[auto_1fr] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b1026] text-xs font-black tabular-nums text-white dark:bg-emerald-300 dark:text-[#052e2b]">
          {index + 1}
        </span>
      </div>
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5f4f0] text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
        <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-xl font-black text-[#171717] dark:text-white">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/62">{description}</p>
      </div>
    </article>
  );
}

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const skylineUrls = useMemo(() => getSkylineUrls(), []);
  const isFallbackSkyline = skylineUrls.desktop.startsWith("data:image/");


  useEffect(() => {
    analytics.trackLandingViewed();
  }, []);

  const handleHeroCta = () => {
    analytics.trackGetStartedClicked('hero');
    onGetStarted();
  };

  const handleSignInCta = () => {
    onSignIn?.();
  };

  const handleFinalCta = () => {
    analytics.trackGetStartedClicked('final_cta');
    onGetStarted();
  };

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
    <main className="landing-page landing-walkthrough-performance relative isolate flex min-h-screen flex-col bg-white text-slate-950 dark:bg-[#031713] dark:text-white">
      <section className="relative overflow-hidden px-5 pb-12 pt-16 sm:px-8 lg:pb-16 lg:pt-24">
        <picture className="pointer-events-none absolute inset-0 z-0 block opacity-[0.65] dark:opacity-[0.5]">
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
            onError={handleSkylineError}
          />
        </picture>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(245,244,240,0.18)_0%,rgba(245,244,240,0.35)_42%,rgba(245,244,240,0.55)_75%,rgba(230,225,210,0.78)_100%)] dark:bg-[linear-gradient(180deg,rgba(6,19,15,0.55)_0%,rgba(6,19,15,0.68)_45%,rgba(6,19,15,0.82)_78%,rgba(6,19,15,0.95)_100%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_28%,rgba(11,16,38,0.32)_0%,rgba(11,16,38,0)_55%)] dark:bg-[radial-gradient(circle_at_50%_28%,rgba(0,8,7,0.4)_0%,rgba(0,8,7,0)_55%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-emerald-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.trustBadge")}
            </motion.div>

            <motion.h1
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
              className="text-balance text-4xl font-black leading-[0.96] sm:text-6xl lg:text-7xl"
            >
              <span className="bg-gradient-to-br from-[#0b1026] via-[#0f766e] to-[#2b8994] bg-clip-text text-transparent dark:from-white dark:via-emerald-200 dark:to-emerald-400">
                {t("landing.productWalkthrough.heroTitle")}
              </span>
            </motion.h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-white/64 sm:text-xl"
            >
              {t("landing.productWalkthrough.heroSubtitle")}
            </motion.p>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <button
                type="button"
                onClick={handleHeroCta}
                className="group relative inline-flex min-h-[52px] items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#0b1026] to-[#2b8994] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:from-emerald-600 dark:to-emerald-400 dark:text-slate-950 dark:shadow-emerald-500/10 dark:hover:shadow-emerald-400/20"
              >
                <span className="relative z-10">{t("landing.hero.cta")}</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#2b8994] to-[#0b1026] opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-emerald-400 dark:to-emerald-600" />
              </button>
              <a
                href="#see-it-in-action"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-[#2b8994]/25 bg-white/82 px-5 py-2.5 text-sm font-black text-[#0c5963] shadow-sm ring-1 ring-white/50 transition hover:-translate-y-0.5 hover:border-[#2b8994]/45 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:border-white/10 dark:bg-white/[0.07] dark:text-emerald-100 dark:ring-white/10 dark:hover:bg-white/[0.11]"
              >
                <MessageSquareText className="h-4 w-4" />
                {t("landing.productWalkthrough.actionDemo.heroLink")}
              </a>
              <span className="text-sm font-semibold text-slate-500 dark:text-white/52">
                {t("landing.productWalkthrough.heroNote")}
              </span>
              {onSignIn && (
                <button
                  type="button"
                  onClick={handleSignInCta}
                  className="text-sm font-black text-[#0c5963] underline decoration-[#2b8994]/40 underline-offset-4 transition hover:text-[#2b8994] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:text-emerald-200 dark:hover:text-emerald-100"
                >
                  {t("landing.hero.signInCta", "Sign in only when you want to save progress")}
                </button>
              )}
            </motion.div>
          </div>

          <div className="mx-auto mt-9 max-w-5xl">
            <HeroProductStage />
          </div>

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
                  className="flex cursor-default items-center justify-center gap-3 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-900/6 dark:bg-white/[0.06] dark:text-white/72 dark:ring-white/10"
                >
                <signal.icon className="h-5 w-5 shrink-0 text-[#2b8994] dark:text-emerald-300" />
                <span>{signal.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <SeeItInActionDemo />

      <section className="bg-[#f5f4f0] px-5 py-14 dark:bg-[#041c17] sm:px-8 lg:py-20" aria-labelledby="tailoring-title">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#2b8994] dark:text-emerald-300">
              {t("landing.productStory.why.eyebrow")}
            </p>
            <h2 id="tailoring-title" className="mt-4 max-w-xl text-4xl font-black leading-[0.98] text-[#171717] dark:text-white sm:text-5xl">
              {t("landing.productStory.why.title")}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600 dark:text-white/62">
              {t("landing.productStory.why.subtitle")}
            </p>
            <p className="mt-6 max-w-xl rounded-[1.25rem] bg-white/80 p-4 text-sm font-black leading-7 text-[#0c5963] shadow-sm ring-1 ring-[#cfe8e5] dark:bg-white/[0.06] dark:text-emerald-100 dark:ring-white/10">
              {t("landing.productStory.why.bridge")}
            </p>
          </div>
          <div className="grid gap-4">
            {tailoringCards.map((card, index) => (
              <ProofWorkflowStep key={card.title} {...card} index={index} />
            ))}
          </div>
        </div>
      </section>

      <FeatureHighlightSection
        eyebrow={t("landing.featureHighlights.vision.eyebrow")}
        title={t("landing.featureHighlights.vision.title")}
        subtitle={t("landing.featureHighlights.vision.subtitle")}
        benefits={translatedList(t, "landing.featureHighlights.vision.benefits")}
        visual={<Vision2030Mockup />}
        bgClassName="bg-white dark:bg-[#031713]"
        accentColor="text-[#006C35] dark:text-emerald-300"
      />

      <FeatureHighlightSection
        eyebrow={t("landing.featureHighlights.clarify.eyebrow")}
        title={t("landing.featureHighlights.clarify.title")}
        subtitle={t("landing.featureHighlights.clarify.subtitle")}
        benefits={translatedList(t, "landing.featureHighlights.clarify.benefits")}
        visual={<ClarificationMockup />}
        reverse
        bgClassName="bg-[#f5f4f0] dark:bg-[#041c17]"
      />

      <FeatureHighlightSection
        eyebrow={t("landing.featureHighlights.interview.eyebrow")}
        title={t("landing.featureHighlights.interview.title")}
        subtitle={t("landing.featureHighlights.interview.subtitle")}
        benefits={translatedList(t, "landing.featureHighlights.interview.benefits")}
        visual={<InterviewPrepMockup />}
        bgClassName="bg-white dark:bg-[#031713]"
      />

      <section className="bg-white px-5 py-16 text-[#171717] dark:bg-[#031713] dark:text-white sm:px-8 lg:py-20" aria-labelledby="landing-comparison-title">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="inline-flex rounded-full border border-[#2b8994]/25 bg-[#2b8994]/10 px-4 py-1.5 text-sm font-black uppercase tracking-[0.16em] text-[#2b8994] dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-200">
              {t("landing.comparison.eyebrow")}
            </p>
            <h2 id="landing-comparison-title" className="mt-4 text-3xl font-black leading-tight text-[#171717] dark:text-white sm:text-4xl">
              {t("landing.comparison.title")}
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-white/72">
              {t("landing.comparison.subtitle")}
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      <div className="bg-white px-5 pb-16 text-[#171717] dark:bg-[#031713] dark:text-white sm:px-8 lg:pb-20">
        <div className="mx-auto max-w-7xl">
          <PricingSection onGetStarted={handleFinalCta} />
        </div>
      </div>

      <section className="bg-[#f5f4f0] px-5 py-16 text-[#171717] dark:bg-[#041c17] dark:text-white sm:px-8 lg:py-20" aria-labelledby="landing-final-title">
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
                <span key={benefit} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-white/10 dark:text-white/78 dark:ring-white/10">
                  <CheckCircle2 className="h-4 w-4 text-[#2b8994] dark:text-[#5eead4]" />
                  {benefit}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinalCta}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#5eead4] px-8 py-3.5 text-sm font-black text-[#052e2b] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0] dark:focus-visible:ring-offset-[#092018]"
          >
            {t("landing.productWalkthrough.cta")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </section>
    </main>
  );
}
