// src/components/LandingPage.jsx
// Modern landing page with real interactions and compelling logic

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  FileText,
  Target,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle2,
  Star,
  Trophy,
  Clock,
  BarChart3,
  Users,
  Briefcase,
  GraduationCap,
  ChevronDown,

} from "lucide-react";
import { GlassButton } from "../components/ui/GlassButton";
import AnimatedCard from "../components/ui/AnimatedCard";
import { cn } from "../lib/utils/cn";
import { VISION_2030_SECTORS } from "../lib/data/vision2030Skills";
import Vision2030Modal from "../components/ui/Vision2030Modal";
import { SectorIcon } from "../lib/utils/vision2030Icons";
import { ComparisonTable } from "../components/ui/ComparisonTable";

// Hook: Type writer effect for dynamic headlines
function useTypewriter(phrases, typingSpeed = 80, deletingSpeed = 40, pauseDuration = 2000) {
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    let timeout;

    if (!isDeleting && displayText === currentPhrase) {
      timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    } else {
      const speed = isDeleting ? deletingSpeed : typingSpeed;
      timeout = setTimeout(() => {
        setDisplayText(
          isDeleting
            ? currentPhrase.slice(0, displayText.length - 1)
            : currentPhrase.slice(0, displayText.length + 1)
        );
      }, speed);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex, phrases, typingSpeed, deletingSpeed, pauseDuration]);

  return displayText;
}

// Hook: Animated counter for statistics
function useAnimatedCounter(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hasStarted, end, duration]);

  return { count, ref };
}



// Component: Live resume transformation demo
function ResumeTransformDemo() {
  const { t } = useTranslation();
  const [stage, setStage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const stages = [
    {
      label: t("landing.demo.original"),
      text: t("landing.demo.originalText"),
      issues: [t("landing.demo.issues.vagueImpact"), t("landing.demo.issues.noMetrics"), t("landing.demo.issues.genericPhrasing")],
      color: "red",
    },
    {
      label: t("landing.demo.analyzing"),
      text: t("landing.demo.analyzingText"),
      issues: [],
      color: "yellow",
    },
    {
      label: t("landing.demo.optimized"),
      text: "Spearheaded a high-performing sales unit of 15, driving SAR 12M in annual revenue and expanding market share by 18% across the Eastern Province.",
      benefits: [t("landing.demo.benefits.quantifiableImpact"), t("landing.demo.benefits.localContext"), t("landing.demo.benefits.strongActionVerbs")],
      color: "emerald",
    },
  ];

  useEffect(() => {
    if (isHovered) return; // Pause on hover

    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isHovered, stages.length]);

  const current = stages[stage];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stage indicators */}
      <div className="flex justify-center gap-2 mb-6">
        {stages.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setStage(idx)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300",
              stage === idx
                ? s.color === "red"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : s.color === "yellow"
                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "bg-gray-100/50 dark:bg-white/5 text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/30"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div
        className={cn(
          "p-8 rounded-2xl border backdrop-blur-sm transition-all duration-500",
          current.color === "red"
            ? "bg-red-50 dark:bg-white/5 border-red-500/20"
            : current.color === "yellow"
              ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500/30"
              : "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 border-emerald-500/30 shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]"
        )}
      >
        <p
          className={cn(
            "text-lg font-medium leading-relaxed transition-colors duration-300",
            current.color === "red" ? "text-gray-500 dark:text-white/60 line-through decoration-red-500/50" : "",
            current.color === "yellow" ? "text-yellow-600 dark:text-yellow-200/80 animate-pulse" : "",
            current.color === "emerald" ? "text-gray-900 dark:text-white" : ""
          )}
        >
          {current.color === "emerald" ? (
            <>
              «Spearheaded a high-performing sales unit of 15, driving{" "}
              <span className="text-emerald-400 font-bold">SAR 12M</span> in annual revenue and
              expanding market share by <span className="text-emerald-400 font-bold">18%</span>{" "}
              across the Eastern Province.»
            </>
          ) : (
            `«${current.text}»`
          )}
        </p>

        {/* Feedback tags */}
        <div className="mt-6 flex flex-wrap gap-2">
          {current.issues?.map((issue, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20"
            >
              ✗ {issue}
            </span>
          ))}
          {current.benefits?.map((benefit, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20"
            >
              ✓ {benefit}
            </span>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isHovered ? "w-0" : "",
            current.color === "red" && "bg-red-500 animate-progress-bar",
            current.color === "yellow" && "bg-yellow-500 animate-progress-bar",
            current.color === "emerald" && "bg-emerald-500 animate-progress-bar"
          )}
          style={{
            animation: isHovered ? "none" : "progress-bar 3s linear infinite",
          }}
        />
      </div>
    </div>
  );
}

// Component: Interactive feature card with real info
function FeatureCard({ feature }) {
  return (
    <AnimatedCard
      tone="translucent"
      enableTilt={false}
      tiltIntensity={0}
      className={cn(
        "p-8 cursor-pointer group",
        "hover:border-emerald-400/50 hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.15)]"
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300">
          <feature.icon className="w-6 h-6 text-emerald-300" />
        </div>
        {feature.badge && (
          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-medium border border-yellow-500/30">
            {feature.badge}
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
      <p className="text-gray-600 dark:text-white/70 leading-relaxed mb-4">{feature.description}</p>

      {/* Real capability highlights */}
      {feature.capabilities && (
        <ul className="space-y-2">
          {feature.capabilities.map((cap, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400/70" />
              {cap}
            </li>
          ))}
        </ul>
      )}
    </AnimatedCard>
  );
}

// Component: Single stat item with animated counter
function StatItem({ stat }) {
  const { count, ref } = useAnimatedCounter(stat.end, 2000);
  return (
    <div ref={ref} className="text-center space-y-2 sm:space-y-3 group px-2">
      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mx-auto group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300">
        <stat.icon className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300" />
      </div>
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tabular-nums">
        {count}
        {stat.suffix}
      </div>
      <div>
        <div className="text-sm sm:text-base text-gray-800 dark:text-white font-semibold leading-tight">{stat.label}</div>
        <div className="text-gray-500 dark:text-white/50 text-xs sm:text-sm leading-relaxed">{stat.description}</div>
      </div>
    </div>
  );
}

// Component: Statistics with animated counters
function StatsSection() {
  const { t } = useTranslation();
  const stats = [
    {
      icon: BarChart3,
      end: 94,
      suffix: "%",
      label: t("landing.stats.atsPassRate.label"),
      description: t("landing.stats.atsPassRate.description"),
    },
    {
      icon: Clock,
      end: 5,
      suffix: " min",
      label: t("landing.stats.averageTime.label"),
      description: t("landing.stats.averageTime.description"),
    },
    {
      icon: Trophy,
      end: 3,
      suffix: "x",
      label: t("landing.stats.moreInterviews.label"),
      description: t("landing.stats.moreInterviews.description"),
    },
    {
      icon: Users,
      end: 50,
      suffix: "+",
      label: t("landing.stats.industries.label"),
      description: t("landing.stats.industries.description"),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((stat, idx) => (
        <StatItem key={idx} stat={stat} />
      ))}
    </div>
  );
}

// Component: Job categories with real Saudi market focus
// eslint-disable-next-line no-unused-vars
function JobMarketSection() {
  const { t } = useTranslation();
  const industries = [
    { icon: Briefcase, name: t("landing.industries.banking.name"), growth: t("landing.industries.banking.growth") },
    { icon: TrendingUp, name: t("landing.industries.technology.name"), growth: t("landing.industries.technology.growth") },
    { icon: GraduationCap, name: t("landing.industries.education.name"), growth: t("landing.industries.education.growth") },
    { icon: Users, name: t("landing.industries.healthcare.name"), growth: t("landing.industries.healthcare.growth") },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {industries.map((industry, idx) => (
        <div
          key={idx}
          className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-emerald-400/30 transition-all duration-300 group cursor-pointer"
        >
          <industry.icon className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 dark:text-emerald-300/70 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 mb-2 sm:mb-3 transition-colors" />
          <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-tight">{industry.name}</div>
          <div className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">{industry.growth} {t("landing.industries.hiring")}</div>
        </div>
      ))}
    </div>
  );
}

// Features data with real capabilities - now using translation keys
function getFeatures(t) {
  return [
    {
      icon: FileText,
      title: t("landing.features.smartParsing.title"),
      description: t("landing.features.smartParsing.description"),
      badge: t("landing.features.smartParsing.badge"),
      capabilities: t("landing.features.smartParsing.capabilities", { returnObjects: true }),
    },
    {
      icon: Target,
      title: t("landing.features.jobMatch.title"),
      description: t("landing.features.jobMatch.description"),
      capabilities: t("landing.features.jobMatch.capabilities", { returnObjects: true }),
    },
    {
      icon: Sparkles,
      title: t("landing.features.aiOptimization.title"),
      description: t("landing.features.aiOptimization.description"),
      capabilities: t("landing.features.aiOptimization.capabilities", { returnObjects: true }),
    },
    {
      icon: TrendingUp,
      title: t("landing.features.keywordAnalysis.title"),
      description: t("landing.features.keywordAnalysis.description"),
      capabilities: t("landing.features.keywordAnalysis.capabilities", { returnObjects: true }),
    },
    {
      icon: Shield,
      title: t("landing.features.atsExport.title"),
      description: t("landing.features.atsExport.description"),
      capabilities: t("landing.features.atsExport.capabilities", { returnObjects: true }),
    },
    {
      icon: Zap,
      title: t("landing.features.interviewPrep.title"),
      description: t("landing.features.interviewPrep.description"),
      badge: t("landing.features.interviewPrep.badge"),
      capabilities: t("landing.features.interviewPrep.capabilities", { returnObjects: true }),
    },
  ];
}

function getSteps(t) {
  return [
    {
      title: t("landing.howItWorks.step1.title"),
      description: t("landing.howItWorks.step1.description"),
      icon: FileText,
    },
    {
      title: t("landing.howItWorks.step2.title"),
      description: t("landing.howItWorks.step2.description"),
      icon: Target,
    },
    {
      title: t("landing.howItWorks.step3.title"),
      description: t("landing.howItWorks.step3.description"),
      icon: Sparkles,
    },
  ];
}

export default function LandingPage({ onGetStarted }) {
  const { t } = useTranslation();
  const [v2030ModalOpen, setV2030ModalOpen] = useState(false);

  // Get translated dynamic phrases
  const dynamicPhrases = t("landing.hero.dynamicPhrases", { returnObjects: true });

  // Typewriter effect for dynamic headlines
  const dynamicText = useTypewriter(
    dynamicPhrases,
    100,
    50,
    2500
  );

  // Get translated features and steps
  const features = getFeatures(t);
  const steps = getSteps(t);

  return (
    <div className="w-full overflow-x-hidden bg-gray-50 dark:bg-black text-gray-900 dark:text-white selection:bg-emerald-500/30 selection:text-emerald-900 dark:selection:text-emerald-200">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-cyan-500/10 blur-[80px] rounded-full mix-blend-screen" />

      </div>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[75vh] flex flex-col justify-center items-center px-4 py-20 overflow-hidden">

        {/* Hero Content */}
        <div className="relative max-w-5xl mx-auto text-center space-y-8 md:space-y-12">

          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 text-emerald-700 dark:text-emerald-300 text-sm font-medium animate-fade-in hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-default shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/20">
            <Star className="w-4 h-4 fill-emerald-300/20 text-emerald-600 dark:text-emerald-300" />
            <span>{t("landing.trustBadge")}</span>
          </div>

          {/* Main Headline */}
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] text-gray-900 dark:text-white">
              {t("landing.hero.title")}
              <span className="block mt-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-200 dark:to-cyan-400 bg-clip-text text-transparent pb-4 min-h-[1.2em]">
                {dynamicText}
                <span className="animate-blink text-gray-900 dark:text-white opacity-50 font-light">|</span>
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-white/60 leading-relaxed font-light"
              dangerouslySetInnerHTML={{ __html: t("landing.hero.subtitle") }}
            />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <GlassButton
              onClick={onGetStarted}
              className="w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-10 text-lg rounded-full bg-emerald-500 hover:bg-emerald-400 text-white border-0 shadow-[0_0_40px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_-5px_rgba(16,185,129,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 group"
            >
              <span className="flex items-center gap-3 font-bold tracking-wide">
                {t("landing.hero.cta")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </GlassButton>

            <button
              onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto h-14 sm:h-16 px-8 text-lg rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 backdrop-blur-sm transition-all duration-300 hover:scale-105"
            >
              {t("landing.demo.title").split(':')[0]}
            </button>
          </div>

          {/* Social Proof */}
          <div className="pt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-gray-500 dark:text-white/40 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
              {t("landing.hero.worksWithArabicEnglish")}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
              No AI Hallucinations
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
              Vision 2030 Aligned
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="pt-16 flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs text-gray-500 dark:text-white/30 uppercase tracking-wider">Scroll to explore</span>
            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-white/20" />
          </div>
        </div>
      </section>

      {/* Stats Strip - Full Width */}
      <section className="relative z-10 border-y border-gray-200 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <StatsSection />
        </div>
      </section>

      {/* Live Demo Section */}
      <section id="demo-section" className="relative z-10 py-24 md:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/50 bg-clip-text text-transparent">
              {t("landing.demo.title")}
            </h2>
            <p className="text-xl text-gray-600 dark:text-white/60">
              {t("landing.demo.subtitle")}
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent blur-[100px] -z-10" />
            <ResumeTransformDemo />
          </div>
        </div>
      </section>

      {/* Features Grid - More Open */}
      <section className="relative z-10 py-24 md:py-32 px-4 bg-gradient-to-b from-gray-50 to-emerald-50 dark:from-black dark:to-emerald-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Core Capabilities
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white">
              {t("landing.features.title")}
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-white/60">
              {t("landing.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="relative z-10 py-24 md:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
              Competitive Advantage
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white">
              {t("landing.comparison.title")}
            </h2>
            <p className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-white/60">
              {t("landing.comparison.subtitle")}
            </p>
          </div>

          <ComparisonTable />
        </div>
      </section>

      {/* Vision 2030 - Immersive Full Width */}
      <section className="relative z-10 py-24 md:py-32 px-4 overflow-hidden">
        {/* Distinctive Background for Vision 2030 */}
        <div className="absolute inset-0 bg-emerald-950/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_70%)]" />
          <div className="absolute w-full h-full opacity-30"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left Content */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#006C35] text-white text-xs font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(0,108,53,0.5)]">
                Vision 2030
              </div>

              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                <span className="text-gray-900 dark:text-white">{t("vision2030.landing.title").split("Vision")[0]}</span>
                <span className="text-emerald-600 dark:text-[#4ade80] drop-shadow-none dark:drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"> Vision 2030</span>
              </h2>

              <p className="text-xl text-emerald-800 dark:text-emerald-100/70 leading-relaxed">
                {t("vision2030.landing.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <GlassButton
                  onClick={() => setV2030ModalOpen(true)}
                  className="group bg-[#006C35] hover:bg-[#008642] text-white border-0 shadow-lg shadow-[#006C35]/30"
                >
                  {t('vision2030.matchSection.learnMore')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </GlassButton>
              </div>
            </div>

            {/* Right Interactive/Stats Grid */}
            <div className="relative">
              {/* Decorative Ring */}


              <div className="grid grid-cols-2 gap-4 relative">
                {VISION_2030_SECTORS.slice(0, 4).map((sector, idx) => (
                  <div
                    key={sector.id}
                    className="group p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-[#006C35]/10 dark:hover:bg-[#006C35]/20 hover:border-[#006C35]/50 hover:scale-[1.02] transition-all duration-300 backdrop-blur-md"
                  >
                    <div className="w-12 h-12 mb-4 rounded-xl bg-[#006C35]/10 dark:bg-[#006C35]/20 flex items-center justify-center group-hover:bg-[#006C35] transition-colors">
                      <SectorIcon sectorId={sector.id} className="w-6 h-6 text-emerald-600 dark:text-[#4ade80] group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-[#4ade80] transition-colors">
                      {sector.nameEn}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-white/40 group-hover:text-gray-700 dark:group-hover:text-white/60">
                      Top Priority Sector
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How It Works - Step-by-Step Flow */}
      <section className="relative z-10 py-24 md:py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-600 dark:from-emerald-200 dark:via-white dark:to-emerald-200 bg-clip-text text-transparent mb-6">
              {t("landing.howItWorks.title")}
            </h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-12">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {steps.map((step, idx) => (
              <div key={idx} className="relative group text-center space-y-6">
                <div className="relative mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-white/10 dark:to-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-emerald-500/30 transition-all duration-500 shadow-[0_0_30px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-sm flex items-center justify-center shadow-lg">
                    {idx + 1}
                  </div>
                  <step.icon className="w-10 h-10 text-emerald-600 dark:text-emerald-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-white/60 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-24 text-center">
            <GlassButton
              onClick={onGetStarted}
              className="px-12 py-6 text-xl font-bold rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-2xl shadow-emerald-900/40 hover:scale-105 transition-all duration-300"
            >
              <span className="flex items-center gap-3">
                {t("landing.howItWorks.cta")}
                <ArrowRight className="w-6 h-6 animate-pulse" />
              </span>
            </GlassButton>
          </div>
        </div>
      </section>

      {/* Vision 2030 Info Modal */}
      <Vision2030Modal
        isOpen={v2030ModalOpen}
        onClose={() => setV2030ModalOpen(false)}
      />
    </div>
  );
}




