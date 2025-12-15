// src/components/LandingPage.jsx
// Modern landing page with real interactions and compelling logic

import { useState, useEffect, useRef } from "react";
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
import Button from "./ui/Button.jsx";
import AnimatedCard from "./ui/AnimatedCard.jsx";
import { cn } from "../lib/cn.js";

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
  const [stage, setStage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const stages = [
    {
      label: "Original",
      text: "Managed sales team and increased revenue.",
      issues: ["Vague impact", "No metrics", "Generic phrasing"],
      color: "red",
    },
    {
      label: "AI Analyzing",
      text: "Analyzing: team size, revenue figures, location context...",
      issues: [],
      color: "yellow",
    },
    {
      label: "Optimized",
      text: "Spearheaded a high-performing sales unit of 15, driving SAR 12M in annual revenue and expanding market share by 18% across the Eastern Province.",
      benefits: ["Quantifiable Impact", "Local Context", "Strong Action Verbs"],
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
    <div ref={ref} className="text-center space-y-3 group">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mx-auto group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300">
        <stat.icon className="w-7 h-7 text-emerald-300" />
      </div>
      <div className="text-4xl md:text-5xl font-bold text-white tabular-nums">
        {count}
        {stat.suffix}
      </div>
      <div>
        <div className="text-white font-semibold">{stat.label}</div>
        <div className="text-white/50 text-sm">{stat.description}</div>
      </div>
    </div>
  );
}

// Component: Statistics with animated counters
function StatsSection() {
  const stats = [
    {
      icon: BarChart3,
      end: 94,
      suffix: "%",
      label: "ATS Pass Rate",
      description: "Resumes optimized with our AI",
    },
    {
      icon: Clock,
      end: 5,
      suffix: " min",
      label: "Average Time",
      description: "From upload to optimized PDF",
    },
    {
      icon: Trophy,
      end: 3,
      suffix: "x",
      label: "More Interviews",
      description: "Reported by our users",
    },
    {
      icon: Users,
      end: 50,
      suffix: "+",
      label: "Industries",
      description: "Templates tailored for",
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
  const industries = [
    { icon: Briefcase, name: "Banking & Finance", growth: "+24%" },
    { icon: TrendingUp, name: "Technology", growth: "+47%" },
    { icon: GraduationCap, name: "Education", growth: "+18%" },
    { icon: Users, name: "Healthcare", growth: "+32%" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {industries.map((industry, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400/30 transition-all duration-300 group cursor-pointer"
        >
          <industry.icon className="w-8 h-8 text-emerald-300/70 group-hover:text-emerald-300 mb-3 transition-colors" />
          <div className="font-medium text-white">{industry.name}</div>
          <div className="text-xs text-emerald-400 font-semibold">{industry.growth} hiring</div>
        </div>
      ))}
    </div>
  );
}

// Features data with real capabilities
const features = [
  {
    icon: FileText,
    title: "Smart Resume Parsing",
    description: "Upload PDF, DOCX, or paste text. AI extracts and structures your experience instantly.",
    badge: "OCR Powered",
    capabilities: ["Multi-format support", "Arabic & English", "Structured extraction"],
  },
  {
    icon: Target,
    title: "Job Match Scoring",
    description: "Get instant 0-100 match scores. See exactly which keywords you're missing.",
    capabilities: ["Real-time analysis", "Keyword gap detection", "Industry benchmarks"],
  },
  {
    icon: Sparkles,
    title: "AI Optimization",
    description: "Rewrite sections with stronger language and better keywords—without inventing facts.",
    capabilities: ["Context-aware rewrites", "Metric suggestions", "Tone adjustment"],
  },
  {
    icon: TrendingUp,
    title: "Keyword Analysis",
    description: "Identify high-impact keywords and optimize your resume to beat ATS systems.",
    capabilities: ["Frequency analysis", "Competitor comparison", "Industry trends"],
  },
  {
    icon: Shield,
    title: "ATS-Friendly Export",
    description: "Download professionally formatted PDFs that pass applicant tracking systems.",
    capabilities: ["Multiple templates", "Font embedding", "Section formatting"],
  },
  {
    icon: Zap,
    title: "Interview Prep",
    description: "Generate tailored interview questions based on your resume and job requirements.",
    badge: "New",
    capabilities: ["Role-specific questions", "STAR format tips", "Difficulty levels"],
  },
];

const steps = [
  {
    title: "Upload Resume",
    description: "Drop your PDF/DOCX or paste text. OCR handles scanned documents too.",
    icon: FileText,
  },
  {
    title: "Add Job Description",
    description: "Paste the job posting. AI identifies skills gaps and optimization opportunities.",
    icon: Target,
  },
  {
    title: "Optimize & Download",
    description: "Apply AI suggestions, pick a template, and export your ATS-ready PDF.",
    icon: Sparkles,
  },
];

export default function LandingPage({ onGetStarted }) {
  // Typewriter effect for dynamic headlines
  const dynamicText = useTypewriter(
    ["AI-Powered Resumes", "Higher Match Scores", "More Interviews", "Your Dream Job"],
    100,
    50,
    2500
  );

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32">
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
            <span className="font-medium">Built for Vision 2030 Talent</span>
          </div>

          {/* Main Headline with Typewriter */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            Land Your Dream Job with
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent min-h-[1.2em]">
              {dynamicText}
              <span className="animate-blink">|</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-xl md:text-2xl text-white/90 leading-relaxed">
            Transform your resume in <strong className="text-emerald-300">under 5 minutes</strong>.
            Match job descriptions perfectly. Get past ATS systems.{" "}
            <em className="text-teal-300">Land more interviews.</em>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group relative overflow-hidden bg-white text-emerald-700 hover:bg-emerald-50 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.6)] px-8 py-6 text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-white/70 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>Works with Arabic & English</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              <span>Export unlimited PDFs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="px-4 py-20 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              See the Transformation
            </h2>
            <p className="text-xl text-white/80">
              Watch how AI turns generic bullets into impactful achievements
            </p>
          </div>
          <ResumeTransformDemo />
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Stand Out
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Powerful AI tools designed to give you an unfair advantage in the Saudi job market
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} feature={feature} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative px-4 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/20 pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            Get Results in 3 Simple Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="text-center space-y-4 group">
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] transition-all duration-300">
                    <step.icon className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white text-emerald-700 font-bold text-sm flex items-center justify-center shadow-md">
                    {idx + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                <p className="text-white/70">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="text-center mt-16">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-500 text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.6)] px-12 py-6 text-lg font-bold tracking-wide transition-all duration-300 hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Optimizing Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0,0_0] bg-no-repeat transition-[background-position_0s] duration-0 group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 bg-white/5 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <StatsSection />
        </div>
      </section>

      {/* Saudi Job Market Section */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Optimized for Saudi&apos;s Growing Industries
            </h2>
            <p className="text-white/70">
              Templates and keywords tailored for Vision 2030 job market
            </p>
          </div>
          <JobMarketSection />
        </div>
      </section>
    </div>
  );
}
