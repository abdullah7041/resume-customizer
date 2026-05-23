import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  MessageSquareText,
  SearchCheck,
  UploadCloud,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils/cn";
import { useTheme } from "@/hooks/useTheme";

type WalkthroughStepId = "upload" | "match" | "clarify" | "vision" | "optimize" | "interview";
const stepOrder: WalkthroughStepId[] = ["upload", "match", "clarify", "vision", "optimize", "interview"];

interface WalkthroughStep {
  id: WalkthroughStepId;
  icon: LucideIcon;
  title: string;
  description: string;
  metric: string;
}

interface ProductWalkthroughProps {
  onGetStarted: () => void;
}

function getWalkthroughSteps(t: ReturnType<typeof useTranslation>["t"]): WalkthroughStep[] {
  return [
    {
      id: "upload",
      icon: UploadCloud,
      title: t("landing.productWalkthrough.steps.upload.title"),
      description: t("landing.productWalkthrough.steps.upload.description"),
      metric: t("landing.productWalkthrough.steps.upload.metric"),
    },
    {
      id: "match",
      icon: SearchCheck,
      title: t("landing.productWalkthrough.steps.match.title"),
      description: t("landing.productWalkthrough.steps.match.description"),
      metric: t("landing.productWalkthrough.steps.match.metric"),
    },
    {
      id: "clarify",
      icon: MessageSquareText,
      title: t("landing.productWalkthrough.steps.clarify.title"),
      description: t("landing.productWalkthrough.steps.clarify.description"),
      metric: t("landing.productWalkthrough.steps.clarify.metric"),
    },
    {
      id: "vision",
      icon: FileText,
      title: t("landing.productWalkthrough.steps.vision.title"),
      description: t("landing.productWalkthrough.steps.vision.description"),
      metric: t("landing.productWalkthrough.steps.vision.metric"),
    },
    {
      id: "optimize",
      icon: BarChart3,
      title: t("landing.productWalkthrough.steps.optimize.title"),
      description: t("landing.productWalkthrough.steps.optimize.description"),
      metric: t("landing.productWalkthrough.steps.optimize.metric"),
    },
    {
      id: "interview",
      icon: MessageSquareText,
      title: t("landing.productWalkthrough.steps.interview.title"),
      description: t("landing.productWalkthrough.steps.interview.description"),
      metric: t("landing.productWalkthrough.steps.interview.metric"),
    },
  ];
}

function DemoStage({ activeStep }: { activeStep: WalkthroughStep }) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [theme] = useTheme();
  const shouldUseStaticMotion = shouldReduceMotion || theme === "dark";
  const activeStepNumber = stepOrder.indexOf(activeStep.id) + 1;

  const layerTransition = shouldUseStaticMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 280, damping: 26 } as const);

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="landing-proof-panel relative overflow-hidden rounded-2xl bg-[#f3f8f6] shadow-sm ring-1 ring-slate-900/5 dark:bg-[#082b23] dark:shadow-none dark:ring-white/8 sm:rounded-[20px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,252,250,0.94),rgba(235,246,242,0.72),rgba(229,240,237,0.32))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(16,185,129,0.04),rgba(255,255,255,0.01))]" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-900/5 px-5 py-3.5 dark:border-white/8 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 items-center justify-center rounded-md bg-[#2b8994] px-2 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-emerald-400 dark:text-[#052e2b]">
              {t("landing.productWalkthrough.currentStep", {
                current: activeStepNumber,
                total: stepOrder.length,
              })}
            </span>
            <span className="text-sm font-semibold text-[#171717] dark:text-white">
              {activeStep.title}
            </span>
          </div>
          <span className="rounded-full bg-[#eff8f7] px-2.5 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/10 dark:text-emerald-200 dark:ring-emerald-300/20">
            {activeStep.metric}
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 grid min-h-[380px] gap-6 p-5 sm:min-h-[420px] sm:p-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2b8994] dark:text-emerald-300">
              {activeStep.metric}
            </div>
            <h3 className="max-w-md text-2xl font-bold leading-tight text-[#171717] dark:text-white sm:text-[28px]">
              {activeStep.title}
            </h3>
            <p className="max-w-md text-sm font-medium leading-7 text-slate-600 dark:text-white/[0.62]">
              {activeStep.description}
            </p>
          </div>

          <div className="relative min-h-[300px] sm:min-h-[340px]">
            <BaseResumeCard />
            <motion.div
              initial={shouldUseStaticMotion ? false : { opacity: 0, y: 10 }}
              animate={shouldUseStaticMotion ? undefined : { opacity: 1, y: 0 }}
              transition={layerTransition}
              className="landing-motion-static absolute inset-0"
            >
              {activeStep.id === "upload" && <UploadLayer />}
              {activeStep.id === "match" && <MatchLayer />}
              {activeStep.id === "clarify" && <ClarifyLayer />}
              {activeStep.id === "vision" && <VisionLayer />}
              {activeStep.id === "optimize" && <OptimizeLayer />}
              {activeStep.id === "interview" && <InterviewLayer />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BaseResumeCard() {
  const { t } = useTranslation();

  return (
    <div className="landing-demo-card absolute left-0 top-4 w-[82%] rounded-xl bg-[#fbfcfa] p-4 shadow-lg shadow-slate-950/6 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8 sm:top-6 sm:w-[68%] sm:rounded-2xl sm:p-5 rtl:left-auto rtl:right-0">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#2b8994] dark:text-emerald-300" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">
          {t("landing.productWalkthrough.preview.resumeTitle")}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-2/3 rounded-full bg-slate-200 dark:bg-white/20" />
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/10" />
        <div className="h-2 w-5/6 rounded-full bg-slate-100 dark:bg-white/10" />
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-sm font-medium leading-7 text-slate-600 ring-1 ring-slate-900/4 dark:bg-white/[0.05] dark:text-white/[0.68] dark:ring-white/8">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {t("landing.productWalkthrough.preview.experience")}
        </div>
        {t("landing.productWalkthrough.preview.originalBullet")}
      </div>
    </div>
  );
}

function UploadLayer() {
  const { t } = useTranslation();

  return (
    <div className="landing-demo-card absolute right-0 top-20 w-[76%] rounded-xl bg-[#fbfcfa] p-4 shadow-lg shadow-slate-950/8 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8 sm:top-16 sm:w-[64%] sm:rounded-2xl sm:p-5 rtl:left-0 rtl:right-auto">
      <div className="rounded-xl border border-dashed border-[#9ac9cf] bg-[#eff8f7] p-5 text-center dark:border-emerald-300/20 dark:bg-emerald-300/8 sm:p-7">
        <UploadCloud className="mx-auto h-8 w-8 text-[#2b8994] dark:text-emerald-300" />
        <div className="mt-3 text-base font-bold text-slate-950 dark:text-white">
          {t("landing.productWalkthrough.preview.uploadTitle")}
        </div>
        <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-white/[0.55]">
          {t("landing.productWalkthrough.preview.uploadMeta")}
        </p>
      </div>
    </div>
  );
}

function MatchLayer() {
  const { t } = useTranslation();
  const bars = [
    [t("landing.productWalkthrough.preview.skills"), "72%"],
    [t("landing.productWalkthrough.preview.keywords"), "48%"],
    [t("landing.productWalkthrough.preview.experienceFit"), "66%"],
  ];

  return (
    <div className="landing-demo-card absolute right-0 top-6 w-[84%] rounded-xl bg-[#fbfcfa] p-4 shadow-lg shadow-slate-950/8 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8 sm:w-[68%] sm:rounded-2xl sm:p-5 rtl:left-0 rtl:right-auto">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t("landing.productWalkthrough.preview.matchScore")}
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-[#0b1026] dark:text-white sm:text-5xl">62%</div>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-300/12 dark:text-amber-100">
          {t("landing.productWalkthrough.preview.goodStart")}
        </span>
      </div>
      <div className="mt-6 space-y-3.5">
        {bars.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-slate-500 dark:text-white/45">
              <span>{label}</span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/8">
              <motion.div
                className="h-full rounded-full bg-[#2b8994] dark:bg-emerald-300"
                initial={{ width: 0 }}
                animate={{ width: value }}
                transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.15 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClarifyLayer() {
  const { t } = useTranslation();
  const questions = t("landing.productWalkthrough.preview.clarifyQuestions", { returnObjects: true }) as string[];

  return (
    <div className="landing-demo-card absolute inset-x-0 top-0 w-full rounded-xl bg-[#061c16] p-4 text-white shadow-lg shadow-slate-950/15 ring-1 ring-emerald-300/15 dark:bg-[#06231d] dark:shadow-none sm:inset-x-auto sm:right-0 sm:w-[76%] sm:rounded-2xl rtl:sm:left-0 rtl:sm:right-auto">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-emerald-300/10 p-1.5 text-emerald-200">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold">{t("landing.productWalkthrough.preview.clarifyTitle")}</div>
          <div className="text-[11px] font-medium text-emerald-100/50">
            {t("landing.productWalkthrough.preview.clarifyMeta")}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {questions.map((question, index) => (
          <div key={question} className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-2.5">
            <div className="text-[11px] font-semibold text-emerald-300">{index + 1}.</div>
            <p className="mt-1 text-sm font-medium leading-6 text-emerald-50/90">{question}</p>
            {index === 0 && (
              <div className="mt-2 rounded-lg border border-white/8 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/40">
                {t("landing.productWalkthrough.answerPlaceholder")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizeLayer() {
  const { t } = useTranslation();
  const keywords = t("landing.productWalkthrough.preview.keywordTags", { returnObjects: true }) as string[];

  return (
    <div className="absolute right-0 top-2 w-[86%] space-y-3 sm:w-[74%] rtl:left-0 rtl:right-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="landing-demo-card rounded-xl bg-[#fbfcfa] p-4 shadow-md shadow-slate-950/6 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("landing.productWalkthrough.preview.before")}</div>
          <div className="mt-1.5 text-3xl font-bold tabular-nums text-slate-400 sm:text-4xl">52</div>
        </div>
        <div className="landing-demo-card rounded-xl bg-[#2b8994] p-4 text-white shadow-md shadow-slate-950/6 dark:shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{t("landing.productWalkthrough.preview.after")}</div>
          <div className="mt-1.5 text-3xl font-bold tabular-nums sm:text-4xl">86</div>
        </div>
      </div>
      <div className="landing-demo-card rounded-xl bg-[#fbfcfa] p-4 shadow-md shadow-slate-950/6 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8">
        <div className="mb-2.5 flex justify-between text-sm font-bold text-slate-950 dark:text-white">
          <span>{t("landing.productWalkthrough.preview.keywordLift")}</span>
          <span className="text-[#2b8994] dark:text-emerald-300">+34</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <span key={keyword} className="rounded-lg bg-[#eff8f7] px-2.5 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/8 dark:text-emerald-200 dark:ring-emerald-300/15">
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="landing-demo-card rounded-xl bg-[#fbfcfa] p-4 text-sm font-medium leading-7 text-slate-600 shadow-md shadow-slate-950/6 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:text-white/70 dark:shadow-none dark:ring-white/8">
        {t("landing.productWalkthrough.preview.optimizedBullet")}
      </div>
    </div>
  );
}

function VisionLayer() {
  const { t } = useTranslation();
  const sectors = t("landing.productWalkthrough.preview.visionSignals", { returnObjects: true }) as string[];

  return (
    <div className="landing-demo-card absolute right-0 top-6 w-[86%] rounded-xl bg-[#fbfcfa] p-4 shadow-lg shadow-slate-950/8 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8 sm:w-[72%] sm:rounded-2xl sm:p-5 rtl:left-0 rtl:right-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t("landing.productWalkthrough.preview.visionTitle")}
          </div>
          <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-white/[0.68]">
            {t("landing.productWalkthrough.preview.visionDescription")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#eff8f7] px-2.5 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/10 dark:text-emerald-200 dark:ring-emerald-300/20">
          2030
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {sectors.map((sector) => (
          <div key={sector} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-white/[0.70]">
            <span>{sector}</span>
            <CheckCircle2 className="h-4 w-4 text-[#2b8994] dark:text-emerald-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewLayer() {
  const { t } = useTranslation();
  const questions = t("landing.productWalkthrough.preview.interviewQuestions", { returnObjects: true }) as string[];

  return (
    <div className="landing-demo-card absolute right-0 top-6 w-[86%] rounded-xl bg-[#fbfcfa] p-4 shadow-lg shadow-slate-950/8 ring-1 ring-slate-900/5 dark:bg-[#06231d] dark:shadow-none dark:ring-white/8 sm:w-[72%] sm:rounded-2xl sm:p-5 rtl:left-0 rtl:right-auto">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-[#eff8f7] p-1.5 text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-950 dark:text-white">
            {t("landing.productWalkthrough.preview.interviewTitle")}
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            {t("landing.productWalkthrough.preview.interviewMeta")}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {questions.map((question, index) => (
          <div key={question} className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/[0.05]">
            <div className="text-[11px] font-semibold text-[#2b8994] dark:text-emerald-300">{index + 1}.</div>
            <p className="mt-1.5 text-sm font-medium leading-6 text-slate-600 dark:text-white/[0.70]">{question}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[#0b1026] p-3.5 text-sm font-semibold text-white dark:bg-emerald-300 dark:text-[#052e2b]">
        {t("landing.productWalkthrough.preview.interviewReady")}
      </div>
    </div>
  );
}

export function ProductWalkthrough({ onGetStarted }: ProductWalkthroughProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [theme] = useTheme();
  const shouldUseStaticMotion = shouldReduceMotion || theme === "dark";
  const steps = useMemo(() => getWalkthroughSteps(t), [t]);
  const [activeStepId, setActiveStepId] = useState<WalkthroughStepId>("upload");
  const stepRefs = useRef<Record<WalkthroughStepId, HTMLElement | null>>({
    upload: null,
    match: null,
    clarify: null,
    vision: null,
    optimize: null,
    interview: null,
  });

  const updateActiveStep = useCallback(() => {
    if (typeof window === "undefined") return;

    const anchorY = window.innerHeight * 0.34;
    const candidates = stepOrder
      .map((id) => {
        const node = stepRefs.current[id];
        if (!node) return null;

        const rect = node.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight;
        if (!visible) return null;

        return {
          id,
          distance: Math.abs(rect.top - anchorY),
        };
      })
      .filter(Boolean) as Array<{ id: WalkthroughStepId; distance: number }>;

    const closest = candidates.sort((a, b) => a.distance - b.distance)[0];
    if (closest) {
      setActiveStepId(closest.id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    updateActiveStep();

    if (!("IntersectionObserver" in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const stepId = visibleEntry?.target.getAttribute("data-step-id") as WalkthroughStepId | null;
        if (stepId && stepOrder.includes(stepId)) {
          setActiveStepId(stepId);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -45% 0px",
        threshold: [0, 0.25, 0.5, 0.75],
      },
    );

    stepOrder.forEach((id) => {
      const node = stepRefs.current[id];
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [updateActiveStep]);

  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStepId));

  const springTransition = shouldUseStaticMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 260, damping: 24 } as const);

  return (
    <section className="landing-walkthrough-performance relative bg-[#fbfcfa] px-5 py-16 text-slate-950 dark:bg-[#031713] dark:text-white sm:px-8 lg:py-24" aria-labelledby="product-walkthrough-title">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={shouldUseStaticMotion ? false : { opacity: 0, y: 20 }}
          whileInView={shouldUseStaticMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={springTransition}
          className="landing-motion-static mx-auto max-w-3xl text-center"
        >
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2b8994] dark:text-emerald-300">
            {t("landing.productWalkthrough.eyebrow")}
          </div>
          <h2 id="product-walkthrough-title" className="mt-3 text-4xl font-bold leading-[0.98] text-[#171717] dark:text-white sm:text-5xl lg:text-6xl">
            {t("landing.productWalkthrough.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-white/[0.62]">
            {t("landing.productWalkthrough.subtitle")}
          </p>
        </motion.div>

        {/* Desktop Step Indicator */}
        <div className="landing-scroll-progress mx-auto mt-10 hidden max-w-3xl lg:block">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < activeIndex;
              const isActive = index === activeIndex;
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 dark:transition-none",
                        isActive
                          ? "bg-[#2b8994] text-white dark:bg-emerald-400 dark:text-[#052e2b]"
                          : isCompleted
                            ? "bg-[#2b8994]/15 text-[#2b8994] dark:bg-emerald-400/15 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/40"
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold transition-colors duration-300 dark:transition-none",
                        isActive ? "text-[#171717] dark:text-white" : "text-slate-400 dark:text-white/40"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="mx-3 h-px flex-1 bg-slate-200 dark:bg-white/10">
                      <motion.div
                        className="landing-motion-static h-full bg-[#2b8994] dark:bg-emerald-400"
                        animate={{ width: isCompleted ? "100%" : "0%" }}
                        transition={shouldUseStaticMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-5xl space-y-4 lg:mt-12">
          {steps.map((step, index) => {
            const isActive = step.id === activeStepId;

            return (
              <motion.article
                key={step.id}
                ref={(node) => {
                  stepRefs.current[step.id] = node;
                }}
                data-step-id={step.id}
                initial={shouldUseStaticMotion ? false : { opacity: 0, y: 16 }}
                whileInView={shouldUseStaticMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ ...springTransition, delay: index * 0.04 }}
                className={cn(
                  "landing-motion-static landing-scroll-step relative overflow-hidden rounded-2xl bg-[#f4f9f7] p-5 shadow-sm ring-1 ring-slate-900/5 transition-colors duration-300 dark:bg-white/[0.04] dark:shadow-none dark:transition-none dark:ring-white/8 sm:p-6",
                  isActive && "bg-[#eef8f4] dark:bg-white/[0.07]"
                )}
              >
                {isActive && (
                  <div className="absolute inset-y-5 left-0 w-[3px] rounded-full bg-[#2b8994] dark:bg-emerald-400 rtl:left-auto rtl:right-0" />
                )}
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors duration-300 dark:transition-none",
                      isActive ? "bg-[#2b8994]" : "bg-[#0b1026] dark:bg-white/10"
                    )}
                  >
                    <step.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2b8994] dark:text-emerald-300">
                      {t("landing.productWalkthrough.stepLabel", { number: index + 1 })}
                    </div>
                    <h3 className="mt-1.5 text-xl font-bold text-[#171717] dark:text-white sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-white/[0.62]">
                      {step.description}
                    </p>
                    <div className="mt-3 inline-flex rounded-lg bg-[#eff8f7] px-2.5 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/8 dark:text-emerald-200 dark:ring-emerald-300/15">
                      {step.metric}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <DemoStage activeStep={step} />
                </div>

                {step.id === "interview" && (
                  <div className="mt-5 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={onGetStarted}
                      className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0b1026] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-950/10 transition duration-300 hover:-translate-y-0.5 hover:bg-[#2b8994] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200"
                    >
                      {t("landing.productWalkthrough.cta")}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </button>
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
