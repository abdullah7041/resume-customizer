import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FileText, Linkedin, LogIn, LogOut, Sparkles, Target, Zap, Star, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils/cn.ts";
import { useAuth } from "../../hooks/useAuth";
import { getSkylineUrl } from "../../lib/assets";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";

// Floating particle component for ambient animation
const FloatingParticle = ({ delay, duration, size, left, top }) => (
  <div
    className="absolute rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/10 blur-sm animate-float pointer-events-none"
    style={{
      width: size,
      height: size,
      left: `${left}%`,
      top: `${top}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

// Glowing orb for background ambiance
const GlowingOrb = ({ className, color = "emerald" }) => (
  <div
    className={cn(
      "absolute rounded-full blur-3xl opacity-30 animate-pulse-slow pointer-events-none",
      color === "emerald" && "bg-emerald-500",
      color === "teal" && "bg-teal-500",
      color === "cyan" && "bg-cyan-500",
      className
    )}
  />
);

const containerClass = "app-shell w-full";

const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Modern glass card styles
const glassCardClass =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-500";

const glassCardHoverClass =
  "hover:border-emerald-400/30 hover:shadow-[0_8px_32px_rgba(16,185,129,0.15)] hover:translate-y-[-2px]";

// Icon circle with glow effect
const iconCircleClass =
  "relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-xl transition-all duration-300";

export default function Header() {
  const { t } = useTranslation();
  const { user, signInWithGoogle, signOut } = useAuth();
  const skylineUrl = useMemo(() => getSkylineUrl(), []);
  const [skylineLoaded, setSkylineLoaded] = useState(false);
  const [animateSkyline, setAnimateSkyline] = useState(false);
  const isFallbackSkyline = useMemo(
    () => typeof skylineUrl === "string" && skylineUrl.startsWith("data:image/"),
    [skylineUrl]
  );
  const initialReducedMotion = useMemo(getPrefersReducedMotion, []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(initialReducedMotion);
  const [heroVisible, setHeroVisible] = useState(initialReducedMotion);
  const [workflowVisible, setWorkflowVisible] = useState(initialReducedMotion);
  const heroAnimatedRef = useRef(initialReducedMotion);
  const workflowAnimatedRef = useRef(initialReducedMotion);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Mouse tracking for interactive gradient
  const handleMouseMove = useCallback((e) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [prefersReducedMotion]);

  // Preload skyline image
  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl) return undefined;

    const img = new Image();
    img.onload = () => setSkylineLoaded(true);
    img.onerror = () => setSkylineLoaded(false);
    img.src = skylineUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [skylineUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl || !skylineLoaded || isFallbackSkyline) {
      return undefined;
    }

    setAnimateSkyline(true);
    const timer = setTimeout(() => setAnimateSkyline(false), 1800);
    return () => clearTimeout(timer);
  }, [isFallbackSkyline, skylineLoaded, skylineUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateFromMediaQuery = (event) => {
      const shouldReduce = event.matches;
      setPrefersReducedMotion(shouldReduce);

      if (shouldReduce) {
        heroAnimatedRef.current = true;
        workflowAnimatedRef.current = true;
        setHeroVisible(true);
        setWorkflowVisible(true);
      }
    };

    updateFromMediaQuery(mediaQuery);

    let heroFrame;
    let workflowTimer;

    const requestFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 16);

    const cancelFrame =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : clearTimeout;

    if (!mediaQuery.matches) {
      if (!heroAnimatedRef.current) {
        heroFrame = requestFrame(() => {
          setHeroVisible(true);
          heroAnimatedRef.current = true;
        });
      }

      if (!workflowAnimatedRef.current) {
        workflowTimer = setTimeout(() => {
          setWorkflowVisible(true);
          workflowAnimatedRef.current = true;
        }, 200);
      }
    }

    const removeMotionListener =
      typeof mediaQuery.addEventListener === "function"
        ? (() => {
          mediaQuery.addEventListener("change", updateFromMediaQuery);
          return () => mediaQuery.removeEventListener("change", updateFromMediaQuery);
        })()
        : (() => {
          mediaQuery.addListener(updateFromMediaQuery);
          return () => mediaQuery.removeListener(updateFromMediaQuery);
        })();

    return () => {
      removeMotionListener();
      if (heroFrame) cancelFrame(heroFrame);
      if (workflowTimer) clearTimeout(workflowTimer);
    };
  }, []);

  const enableArabicBrand = (import.meta.env.VITE_FEATURE_ARABIC_BRAND ?? "true") !== "false";
  const arabicBrandName = "مُحَسِّنُ السِّيرَةِ الذَّاتِيَّةِ السُّعُودِيُّ";

  // Generate floating particles
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 10,
      size: 4 + Math.random() * 12,
      left: Math.random() * 100,
      top: Math.random() * 100,
    })),
    []);

  const featureCards = [
    {
      icon: Zap,
      label: t("header.features.smartParsing.label"),
      desc: t("header.features.smartParsing.desc"),
      gradient: "from-yellow-400 to-orange-500",
    },
    {
      icon: Target,
      label: t("header.features.matchScore.label"),
      desc: t("header.features.matchScore.desc"),
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      icon: Star,
      label: t("header.features.proOutput.label"),
      desc: t("header.features.proOutput.desc"),
      gradient: "from-purple-400 to-pink-500",
    },
  ];

  const workflowSteps = [
    {
      icon: FileText,
      title: t("header.workflow.step1.title"),
      desc: t("header.workflow.step1.desc"),
    },
    {
      icon: Target,
      title: t("header.workflow.step2.title"),
      desc: t("header.workflow.step2.desc"),
    },
    {
      icon: Sparkles,
      title: t("header.workflow.step3.title"),
      desc: t("header.workflow.step3.desc"),
    },
  ];

  return (
    <header
      className="hero-bg-animate relative isolate flex flex-col overflow-hidden text-white min-h-[100dvh]"
      onMouseMove={handleMouseMove}
    >
      {/* Animated background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Interactive gradient that follows mouse */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-20 transition-all duration-1000 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)",
            left: `${mousePosition.x - 20}%`,
            top: `${mousePosition.y - 20}%`,
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Static glowing orbs */}
        <GlowingOrb className="w-96 h-96 -top-20 -left-20" color="emerald" />
        <GlowingOrb className="w-80 h-80 top-1/3 right-0" color="teal" />
        <GlowingOrb className="w-64 h-64 bottom-20 left-1/4" color="cyan" />

        {/* Floating particles */}
        {!prefersReducedMotion && particles.map((p) => (
          <FloatingParticle key={p.id} {...p} />
        ))}

        {/* Animated grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
      </div>

      {/* Skyline background - fixed to cover entire page */}
      {typeof skylineUrl === "string" && skylineUrl && (
        <div
          role="img"
          aria-label="Decorative skyline background"
          className={cn(
            "fixed inset-0 -z-50 bg-no-repeat transition-opacity duration-700",
            skylineLoaded && animateSkyline ? "skyline-once" : "skyline-still",
            skylineLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{
            backgroundImage: `url('${skylineUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: '50% 35%',
          }}
        />
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top navigation bar */}
        <nav className="border-b border-white/5">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-4 sm:py-5`}>
            {/* Logo section */}
            <div className="flex items-center gap-4 group">
              {/* Animated logo icon */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300">
                  <Sparkles className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              </div>

              {/* Brand text */}
              <div className="flex flex-col">
                <p className="text-[10px] sm:text-sm font-bold tracking-[0.12em] sm:tracking-[0.15em] bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent uppercase">
                  {t("common.appName")}
                </p>
                {enableArabicBrand && (
                  <p
                    className="text-base sm:text-xl font-semibold text-white/80 leading-tight"
                    lang="ar"
                    dir="rtl"
                    style={{
                      fontFamily: '"Scheherazade New", "Amiri", serif',
                    }}
                  >
                    {arabicBrandName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-medium text-white/60 tracking-wide">
                    {t("common.byAuthor")}
                  </p>
                  <a
                    href="https://www.linkedin.com/in/3binahmed/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-white/50 hover:text-[#0A66C2] transition-all duration-300 hover:scale-110"
                    aria-label="Visit LinkedIn profile"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Language switcher and Auth button with modern styling */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {user ? (
                <button
                  onClick={signOut}
                  className="group relative inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-xl" />
                  <span className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-500/0 group-hover:from-red-500/20 group-hover:to-red-400/10 transition-all duration-300 rounded-xl" />
                  <LogOut className="relative h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
                  <span className="relative">{t("common.signOut")}</span>
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="group relative inline-flex items-center gap-2.5 rounded-xl px-6 py-2.5 min-h-[44px] text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl" />
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                  <span className="absolute inset-0 shadow-[0_0_30px_rgba(16,185,129,0.4)] group-hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transition-shadow duration-300 rounded-xl" />
                  <LogIn className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  <span className="relative">{t("common.signIn")}</span>
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Hero section */}
        <div className={`${containerClass} flex-1 grid items-center gap-6 sm:gap-10 py-8 sm:py-16 lg:py-20 md:grid-cols-[1.5fr_1fr] lg:gap-16`}>
          {/* Left column - Main content */}
          <div
            className={cn(
              "space-y-5 sm:space-y-8 transform-gpu text-center sm:text-left",
              prefersReducedMotion
                ? "opacity-100"
                : "transition-all duration-700 ease-out",
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent uppercase">
                {t("header.badge")}
              </span>
            </div>

            {/* Main heading card - matching Workflow card style */}
            <div className={cn(glassCardClass, "p-4 sm:p-6 lg:p-8")}>
              {/* Card header with icon */}
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <h1 className="text-base sm:text-xl font-bold text-white">{t("header.heroTitle")}</h1>
              </div>

              <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                {t("header.heroDescription")}
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {featureCards.map((card, idx) => (
                <div
                  key={card.label}
                  className={cn(
                    glassCardClass,
                    glassCardHoverClass,
                    "p-3 sm:p-5 cursor-default group",
                    prefersReducedMotion
                      ? ""
                      : "transition-all duration-500 ease-out",
                    heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  )}
                  style={{
                    transitionDelay: !prefersReducedMotion ? `${150 + idx * 100}ms` : undefined,
                  }}
                >
                  {/* Hover glow effect */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl",
                    `bg-gradient-to-r ${card.gradient}`
                  )} style={{ opacity: 0.1 }} />

                  <div className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-lg mb-3 bg-gradient-to-br transition-transform duration-300 group-hover:scale-110",
                    card.gradient
                  )}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/80">
                    {card.label}
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right column - Workflow card */}
          <div
            className={cn(
              glassCardClass,
              "p-4 sm:p-6 lg:p-8 self-start hidden md:block",
              prefersReducedMotion
                ? ""
                : "transition-all duration-700 ease-out",
              workflowVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
            )}
            style={{
              transitionDelay: !prefersReducedMotion ? "300ms" : undefined,
            }}
          >
            {/* Card header with animated gradient */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">{t("header.workflow.title")}</h2>
            </div>

            <ul className="space-y-6">
              {workflowSteps.map((step, idx) => (
                <li
                  key={step.title}
                  className="group flex items-start gap-4"
                  style={{
                    animationDelay: `${idx * 100}ms`,
                  }}
                >
                  {/* Animated icon circle */}
                  <div className={cn(
                    iconCircleClass,
                    "h-12 w-12 flex-shrink-0 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] group-hover:scale-105"
                  )}>
                    <step.icon className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  </div>

                  <div className="flex-1 pt-1">
                    <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors duration-300">
                      {step.title}
                    </p>
                    <p className="text-sm text-white/60 mt-1">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Decorative line connector */}
            <div className="absolute left-[2.25rem] top-[7.5rem] bottom-[4rem] w-[2px] bg-gradient-to-b from-emerald-400/30 via-teal-400/20 to-transparent hidden lg:block" />
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          25% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
            opacity: 0.3;
          }
          75% {
            transform: translateY(-30px) translateX(5px);
            opacity: 0.4;
          }
        }
        
        @keyframes gradient-shift {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.05);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-gradient-shift {
          animation: gradient-shift 3s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
}




