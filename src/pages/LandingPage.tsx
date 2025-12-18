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
} from "lucide-react";
import Button from "../components/ui/Button";
import AnimatedCard from "../components/ui/AnimatedCard";
import { cn } from "../lib/utils/cn";
import { VISION_2030_SECTORS } from "../lib/data/vision2030Skills";

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

// Component: Floating particles background
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-emerald-400/30 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
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
                : "bg-white/5 text-white/40 border border-white/10 hover:border-white/30"
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
            ? "bg-white/5 border-red-500/20"
            : current.color === "yellow"
              ? "bg-yellow-900/10 border-yellow-500/30"
              : "bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-emerald-500/30 shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]"
        )}
      >
        <p
          className={cn(
            "text-lg font-medium leading-relaxed transition-colors duration-300",
            current.color === "red" ? "text-white/60 line-through decoration-red-500/50" : "",
            current.color === "yellow" ? "text-yellow-200/80 animate-pulse" : "",
            current.color === "emerald" ? "text-white" : ""
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
      enableTilt={true}
      tiltIntensity={30}
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
      <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
      <p className="text-white/70 leading-relaxed mb-4">{feature.description}</p>

      {/* Real capability highlights */}
      {feature.capabilities && (
        <ul className="space-y-2">
          {feature.capabilities.map((cap, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-white/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400/70" />
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
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tabular-nums">
        {count}
        {stat.suffix}
      </div>
      <div>
        <div className="text-sm sm:text-base text-white font-semibold leading-tight">{stat.label}</div>
        <div className="text-white/50 text-xs sm:text-sm leading-relaxed">{stat.description}</div>
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
          className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400/30 transition-all duration-300 group cursor-pointer"
        >
          <industry.icon className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-300/70 group-hover:text-emerald-300 mb-2 sm:mb-3 transition-colors" />
          <div className="text-sm sm:text-base font-medium text-white leading-tight">{industry.name}</div>
          <div className="text-[10px] sm:text-xs text-emerald-400 font-semibold mt-1">{industry.growth} {t("landing.industries.hiring")}</div>
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
    <div className="w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-3 sm:px-4 py-16 sm:py-20 md:py-32">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>
        <FloatingParticles />

        <div className="relative max-w-6xl mx-auto text-center space-y-8">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm animate-fade-in">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{t("landing.trustBadge")}</span>
          </div>

          {/* Main Hero Content Box */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 md:p-12 mx-auto max-w-4xl">
            {/* Main Headline with Typewriter */}
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              {t("landing.hero.title")}
              <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent min-h-[1.2em]">
                {dynamicText}
                <span className="animate-blink">|</span>
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed mt-4 sm:mt-6 px-2"
              dangerouslySetInnerHTML={{ __html: t("landing.hero.subtitle") }}
            />

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-6 sm:pt-8 px-2">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="w-full sm:w-auto group relative overflow-hidden bg-white text-emerald-700 hover:bg-emerald-50 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.6)] px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("landing.hero.cta")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </div>
          </div>

          {/* Social Proof Box */}
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-3 sm:py-4 px-4 sm:px-6 mx-auto max-w-xl">
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-white/70 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>{t("landing.hero.worksWithArabicEnglish")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span>{t("landing.hero.exportUnlimitedPDFs")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="px-3 sm:px-4 py-12 sm:py-16 md:py-20 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-4xl mx-auto">
          {/* Glass Box Container */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="text-center px-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 leading-tight">
                {t("landing.demo.title")}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-white/80">
                {t("landing.demo.subtitle")}
              </p>
            </div>
          </div>
          <ResumeTransformDemo />
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-3 sm:px-4 py-12 sm:py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Section Header Glass Box */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 mb-10 sm:mb-12 md:mb-16">
            <div className="text-center px-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight">
                {t("landing.features.title")}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
                {t("landing.features.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative px-3 sm:px-4 py-12 sm:py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/20 pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          {/* Glass Box Container */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 md:p-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center mb-8 sm:mb-10 md:mb-12 px-2 leading-tight">
              {t("landing.howItWorks.title")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {steps.map((step, idx) => (
                <div key={idx} className="text-center space-y-3 sm:space-y-4 group px-2">
                  <div className="relative inline-block">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] transition-all duration-300">
                      <step.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white text-emerald-700 font-bold text-xs sm:text-sm flex items-center justify-center shadow-md">
                      {idx + 1}
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">{step.title}</h3>
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>

            {/* Final CTA */}
            <div className="text-center mt-10 sm:mt-12 md:mt-16 px-2">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="w-full sm:w-auto group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-500 text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.6)] px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("landing.howItWorks.cta")}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s] duration-0 group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-3 sm:px-4 py-10 sm:py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Glass Box Container */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 md:p-12">
            <StatsSection />
          </div>
        </div>
      </section>

      {/* Saudi Job Market Section */}
      <section className="px-3 sm:px-4 py-10 sm:py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Glass Box Container */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-6 sm:p-8 md:p-12">
            <div className="text-center mb-8 sm:mb-10 px-2">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3 leading-tight">
                {t("landing.industries.title")}
              </h2>
              <p className="text-sm sm:text-base text-white/70">
                {t("landing.industries.subtitle")}
              </p>
            </div>
            <JobMarketSection />
          </div>
        </div>
      </section>

      {/* Vision 2030 Section */}
      <section className="px-3 sm:px-4 py-10 sm:py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-[#006C35]/30 bg-gradient-to-br from-[#006C35]/10 to-emerald-900/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,108,53,0.15)] p-6 sm:p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#006C35] text-white text-sm font-bold mb-4">
                <span>🇸🇦</span>
                <span>2030</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3">
                {t("vision2030.landing.title", "Aligned with Saudi Vision 2030")}
              </h2>
              <p className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto">
                {t("vision2030.landing.subtitle", "Position yourself for the jobs of tomorrow in Saudi Arabia's fastest-growing sectors")}
              </p>
            </div>

            {/* Sector Icons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {VISION_2030_SECTORS.map((sector, idx) => (
                <div
                  key={sector.id}
                  className="group relative p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#006C35]/50 hover:bg-[#006C35]/10 transition-all duration-300 text-center"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                    {sector.icon}
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-white/90">
                    {sector.nameEn}
                  </p>
                  <p className="text-[10px] text-white/50 mt-1">
                    {sector.skills.length} {t("vision2030.skills", "skills")}
                  </p>
                </div>
              ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 rounded-lg bg-white/5">
                <div className="text-2xl sm:text-3xl font-bold text-[#4ade80]">500K+</div>
                <div className="text-xs sm:text-sm text-white/60">{t("vision2030.landing.techJobs", "Tech Jobs by 2030")}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5">
                <div className="text-2xl sm:text-3xl font-bold text-[#4ade80]">1M+</div>
                <div className="text-xs sm:text-sm text-white/60">{t("vision2030.landing.tourismJobs", "Tourism Jobs")}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5">
                <div className="text-2xl sm:text-3xl font-bold text-[#4ade80]">64%</div>
                <div className="text-xs sm:text-sm text-white/60">{t("vision2030.landing.healthcareGrowth", "Healthcare Growth")}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-white/5">
                <div className="text-2xl sm:text-3xl font-bold text-[#4ade80]">$50B</div>
                <div className="text-xs sm:text-sm text-white/60">{t("vision2030.landing.renewableEnergy", "Renewable Energy")}</div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Button
                onClick={onGetStarted}
                className="px-8 py-4 font-bold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#006C35' }}
              >
                {t("vision2030.landing.cta", "Analyze Your V2030 Fit")}
                <ArrowRight className="w-5 h-5 ml-2 inline" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}




