import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
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

type WalkthroughStepId = "upload" | "match" | "clarify" | "vision" | "optimize" | "interview";

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

/* ─── Sidebar Card ─── */
function StepCard({
  step,
  index,
  isActive,
  onActivate,
}: {
  step: WalkthroughStep;
  index: number;
  isActive: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200",
        "bg-white dark:bg-white/[0.04]",
        "border-slate-200 dark:border-white/10",
        isActive
          ? "ring-2 ring-[#2b8994] dark:ring-emerald-400 bg-[#f8faf9] dark:bg-white/[0.07] shadow-md"
          : "hover:border-[#2b8994]/30 dark:hover:border-emerald-400/30 hover:shadow-sm"
      )}
      aria-pressed={isActive}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors",
          isActive ? "bg-[#2b8994]" : "bg-[#0b1026] dark:bg-white/10"
        )}
      >
        <step.icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#171717] dark:text-white truncate">
            {step.title}
          </h3>
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
              isActive
                ? "bg-[#2b8994] text-white dark:bg-emerald-400 dark:text-[#052e2b]"
                : "bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/40"
            )}
          >
            {index + 1}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-white/55 line-clamp-2">
          {step.description}
        </p>
      </div>
    </button>
  );
}

/* ─── Browser Mockup ─── */
function BrowserMockup({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#06231d] shadow-lg">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex-1 rounded-md bg-slate-100 dark:bg-white/5 px-3 py-1 text-center text-xs text-slate-400 dark:text-white/40">
          watheq.app
        </div>
      </div>
      {/* Content */}
      <div className="relative p-4 sm:p-5 h-[320px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/* ─── Step Previews (trimmed to fit 320px) ─── */
function UploadPreview() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-2xl border-2 border-dashed border-[#9ac9cf] bg-[#eff8f7] dark:border-emerald-300/20 dark:bg-emerald-300/8 px-10 py-8">
        <UploadCloud className="mx-auto h-10 w-10 text-[#2b8994] dark:text-emerald-300" />
        <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">
          {t("landing.productWalkthrough.preview.uploadTitle")}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
          {t("landing.productWalkthrough.preview.uploadMeta")}
        </p>
      </div>
    </div>
  );
}

function MatchPreview() {
  const { t } = useTranslation();
  const bars = [
    [t("landing.productWalkthrough.preview.skills"), "72%"],
    [t("landing.productWalkthrough.preview.keywords"), "48%"],
    [t("landing.productWalkthrough.preview.experienceFit"), "66%"],
  ];
  return (
    <div className="mx-auto w-full max-w-sm pt-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/50">
            {t("landing.productWalkthrough.preview.matchScore")}
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-[#0b1026] dark:text-white">62%</div>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-300/12 dark:text-amber-100">
          {t("landing.productWalkthrough.preview.goodStart")}
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {bars.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500 dark:text-white/45">
              <span>{label}</span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/8">
              <div
                className="h-full rounded-full bg-[#2b8994] dark:bg-emerald-300 transition-all duration-700 ease-out"
                style={{ width: value }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClarifyPreview() {
  const { t } = useTranslation();
  const questions = t("landing.productWalkthrough.preview.clarifyQuestions", { returnObjects: true }) as string[];
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl bg-[#061c16] p-4 text-white dark:bg-[#06231d]">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-emerald-300/10 p-1.5 text-emerald-200">
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
        {questions.slice(0, 1).map((question, index) => (
          <div key={question} className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-3">
            <div className="text-[11px] font-semibold text-emerald-300">{index + 1}.</div>
            <p className="mt-1 text-sm font-medium leading-6 text-emerald-50/90">{question}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisionPreview() {
  const { t } = useTranslation();
  const sectors = t("landing.productWalkthrough.preview.visionSignals", { returnObjects: true }) as string[];
  return (
    <div className="mx-auto w-full max-w-lg pt-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/50">
            {t("landing.productWalkthrough.preview.visionTitle")}
          </div>
          <p className="mt-1.5 text-sm font-medium leading-6 text-slate-600 dark:text-white/[0.68]">
            {t("landing.productWalkthrough.preview.visionDescription")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#eff8f7] px-2.5 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/10 dark:text-emerald-200 dark:ring-emerald-300/20">
          2030
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {sectors.slice(0, 3).map((sector) => (
          <div key={sector} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-white/[0.70]">
            <span>{sector}</span>
            <CheckCircle2 className="h-4 w-4 text-[#2b8994] dark:text-emerald-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizePreview() {
  const { t } = useTranslation();
  const keywords = t("landing.productWalkthrough.preview.keywordTags", { returnObjects: true }) as string[];
  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("landing.productWalkthrough.preview.before")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-400">52</div>
        </div>
        <div className="rounded-xl bg-[#2b8994] p-3 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{t("landing.productWalkthrough.preview.after")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">86</div>
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
        <div className="mb-2 flex justify-between text-sm font-bold text-slate-950 dark:text-white">
          <span>{t("landing.productWalkthrough.preview.keywordLift")}</span>
          <span className="text-[#2b8994] dark:text-emerald-300">+34</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keywords.slice(0, 4).map((keyword) => (
            <span key={keyword} className="rounded-lg bg-[#eff8f7] px-2 py-1 text-[11px] font-semibold text-[#0c5963] ring-1 ring-[#cfe8e5] dark:bg-emerald-300/8 dark:text-emerald-200 dark:ring-emerald-300/15">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterviewPreview() {
  const { t } = useTranslation();
  const questions = t("landing.productWalkthrough.preview.interviewQuestions", { returnObjects: true }) as string[];
  return (
    <div className="mx-auto w-full max-w-lg pt-1">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-[#eff8f7] p-1.5 text-[#2b8994] dark:bg-emerald-300/10 dark:text-emerald-200">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-950 dark:text-white">{t("landing.productWalkthrough.preview.interviewTitle")}</div>
          <div className="text-[11px] font-medium text-slate-400">{t("landing.productWalkthrough.preview.interviewMeta")}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {questions.slice(0, 2).map((question, index) => (
          <div key={question} className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.05]">
            <div className="text-[11px] font-semibold text-[#2b8994] dark:text-emerald-300">{index + 1}.</div>
            <p className="mt-0.5 text-sm font-medium leading-6 text-slate-600 dark:text-white/[0.70]">{question}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#0b1026] p-3 text-sm font-semibold text-white dark:bg-emerald-300 dark:text-[#052e2b]">
        {t("landing.productWalkthrough.preview.interviewReady")}
      </div>
    </div>
  );
}

function StepPreview({ stepId }: { stepId: WalkthroughStepId }) {
  switch (stepId) {
    case "upload":
      return <UploadPreview />;
    case "match":
      return <MatchPreview />;
    case "clarify":
      return <ClarifyPreview />;
    case "vision":
      return <VisionPreview />;
    case "optimize":
      return <OptimizePreview />;
    case "interview":
      return <InterviewPreview />;
    default:
      return null;
  }
}

/* ─── Main Component ─── */
export function ProductWalkthrough({ onGetStarted }: ProductWalkthroughProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const steps = useMemo(() => getWalkthroughSteps(t), [t]);
  const [activeStepId, setActiveStepId] = useState<WalkthroughStepId>("upload");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitioningRef = useRef(false);
  const autoplayEnabledRef = useRef(true);
  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleActivate = useCallback(
    (id: WalkthroughStepId) => {
      if (id === activeStepId || transitioningRef.current) return;
      transitioningRef.current = true;
      setIsTransitioning(true);
      requestAnimationFrame(() => {
        setTimeout(() => {
          setActiveStepId(id);
          setIsTransitioning(false);
          transitioningRef.current = false;
        }, 150);
      });
    },
    [activeStepId]
  );

  // Auto-advance every 5 seconds; stops permanently once user clicks.
  useEffect(() => {
    if (shouldReduceMotion || !autoplayEnabledRef.current) return undefined;

    intervalRef.current = setInterval(() => {
      const nextIndex = (activeIndex + 1) % steps.length;
      handleActivate(steps[nextIndex].id);
    }, 5000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeIndex, handleActivate, shouldReduceMotion, steps]);

  const stopAutoPlay = useCallback(() => {
    autoplayEnabledRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return (
    <section className="relative bg-white px-5 py-16 dark:bg-[#031713] sm:px-8 lg:py-24" aria-labelledby="product-walkthrough-title">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2b8994] dark:text-emerald-300">
            {t("landing.productWalkthrough.eyebrow")}
          </div>
          <h2 id="product-walkthrough-title" className="mt-3 text-4xl font-bold leading-[0.98] text-[#171717] dark:text-white sm:text-5xl lg:text-6xl">
            {t("landing.productWalkthrough.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-white/[0.62]">
            {t("landing.productWalkthrough.subtitle")}
          </p>
        </div>

        {/* Desktop: sticky sidebar left + sticky mockup right */}
        <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:mt-14 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-8">
          {/* Left: sticky sidebar cards */}
          <div className="space-y-2.5 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            {steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isActive={step.id === activeStepId}
                onActivate={() => {
                  stopAutoPlay();
                  handleActivate(step.id);
                }}
              />
            ))}
          </div>

          {/* Right: sticky mockup */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <BrowserMockup>
              <div
                className={cn(
                  "transition-all duration-150 ease-out h-full",
                  isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                <StepPreview stepId={activeStepId} />
              </div>
            </BrowserMockup>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-12 flex justify-center lg:mt-16">
          <button
            type="button"
            onClick={onGetStarted}
            className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0b1026] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-950/10 transition duration-300 hover:-translate-y-0.5 hover:bg-[#2b8994] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200"
          >
            {t("landing.productWalkthrough.cta")}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
