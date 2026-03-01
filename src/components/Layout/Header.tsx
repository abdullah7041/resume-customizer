import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from "react";
import { FileText, Linkedin, LogIn, LogOut, Sparkles, Target, Zap, Star, ArrowRight, Menu, X, TrendingUp, MessageSquare, BarChart3, Mail, Crown, Gift, ShieldCheck, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils/cn";
import { useAuth } from "../../hooks/useAuth";
import { getSkylineUrl } from "../../lib/assets";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { GlassButton } from "../ui/GlassButton";
import { CreditBalance } from "../Credits/CreditBalance";
import { CreditUsageModal } from "../Credits/CreditUsageModal";
import { useTheme } from "../../hooks/useTheme";




const containerClass = "app-shell w-full";

const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Modern premium glass card styles
const glassCardClass =
  "neu-card group";

const glassCardHoverClass =
  "neu-card-hover";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [badgeFlipped, setBadgeFlipped] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalMode, setCreditModalMode] = useState<'full' | 'invite-only'>('full');

  const [theme, toggleTheme] = useTheme();

  // Mouse tracking for interactive gradient
  const handleMouseMove = useCallback((e) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [prefersReducedMotion]);

  // Mobile nav body scroll lock
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.classList.add('mobile-nav-open');
    } else {
      document.body.classList.remove('mobile-nav-open');
    }
    return () => document.body.classList.remove('mobile-nav-open');
  }, [mobileNavOpen]);

  // Close mobile nav on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileNavOpen]);

  // Close mobile nav on outside click
  const handleMobileNavOutsideClick = useCallback((e: MouseEvent) => {
    if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
      setMobileNavOpen(false);
    }
  }, []);

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



  // Feature cards organized by priority and category
  const featureCards = [
    // ===== CORE AI FEATURES (Top Priority - Trust & Intelligence) =====
    {
      icon: Target,
      label: t("header.features.matchScore.label"),
      desc: t("header.features.matchScore.desc"),
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      icon: ShieldCheck,
      label: t("header.features.antiHallucination.label"),
      desc: t("header.features.antiHallucination.desc"),
      gradient: "from-emerald-400 to-green-500",
      highlight: true,
    },
    {
      icon: Sparkles,
      label: t("header.features.aiOptimization.label"),
      desc: t("header.features.aiOptimization.desc"),
      gradient: "from-purple-400 to-pink-500",
    },

    // ===== WORKFLOW FEATURES (Secondary - Core Functionality) =====
    {
      icon: Zap,
      label: t("header.features.smartParsing.label"),
      desc: t("header.features.smartParsing.desc"),
      gradient: "from-yellow-400 to-orange-500",
    },
    {
      icon: TrendingUp,
      label: t("header.features.keywords.label"),
      desc: t("header.features.keywords.desc"),
      gradient: "from-blue-400 to-indigo-500",
    },
    {
      icon: FileText,
      label: t("header.features.templates.label"),
      desc: t("header.features.templates.desc"),
      gradient: "from-cyan-400 to-blue-500",
    },

    // ===== ADVANCED FEATURES (Tertiary - Value-Added Services) =====
    {
      icon: MessageSquare,
      label: t("header.features.interview.label"),
      desc: t("header.features.interview.desc"),
      gradient: "from-rose-400 to-red-500",
    },
    {
      icon: BarChart3,
      label: t("header.features.bulk.label"),
      desc: t("header.features.bulk.desc"),
      gradient: "from-amber-400 to-orange-500",
    },
    {
      icon: Mail,
      label: t("header.features.coverLetter.label"),
      desc: t("header.features.coverLetter.desc"),
      gradient: "from-violet-400 to-purple-500",
    },
    {
      icon: Star,
      label: t("header.features.vision2030.label"),
      desc: t("header.features.vision2030.desc"),
      gradient: "from-[#006C35] to-emerald-500",
      highlight: true,
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
    {
      icon: TrendingUp,
      title: t("header.workflow.step4.title"),
      desc: t("header.workflow.step4.desc"),
    },
    {
      icon: MessageSquare,
      title: t("header.workflow.step5.title"),
      desc: t("header.workflow.step5.desc"),
    },
    {
      icon: Mail,
      title: t("header.workflow.step6.title"),
      desc: t("header.workflow.step6.desc"),
    },
  ];

  return (
    <header
      className="hero-bg-animate relative isolate flex flex-col overflow-hidden text-gray-900 dark:text-white h-auto pb-4"
      onMouseMove={handleMouseMove}
    >
      {/* Animated background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Interactive gradient that follows mouse */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[60px] opacity-15 transition-all duration-1000 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)",
            left: `${mousePosition.x - 20}%`,
            top: `${mousePosition.y - 20}%`,
            transform: "translate(-50%, -50%)",
          }}
        />



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

        {/* Noise texture overlay - reduced opacity for better text contrast */}
        <div className="absolute inset-0 opacity-[0.01] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
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
            opacity: 0.8,
          }}
        />
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top navigation bar */}
        <nav className="border-b border-gray-200 dark:border-white/5">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-4 sm:py-5`}>
            {/* Logo section */}
            <div className="flex items-center gap-4 group">
              {/* Animated logo icon */}
              <div className="relative group-hover:scale-105 transition-transform duration-300">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                <img
                  src="/logo-circle.png"
                  alt="Watheq Logo"
                  className="relative h-14 w-14 object-cover rounded-full drop-shadow-lg"
                />
              </div>

              {/* Brand text */}
              <div className="flex flex-col">
                <p className="text-base sm:text-lg font-extrabold tracking-[0.2em] bg-gradient-to-r from-emerald-600 via-gray-800 to-teal-600 dark:from-emerald-200 dark:via-white dark:to-teal-200 bg-clip-text text-transparent uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.15)] dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  {t("common.appName")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm sm:text-base font-medium text-emerald-700/80 dark:text-emerald-200/80 tracking-wider">
                    {t("common.byAuthor")}
                  </p>
                  <a
                    href="https://www.linkedin.com/in/3binahmed/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-emerald-700/80 dark:text-emerald-200/80 hover:text-[#0A66C2] dark:hover:text-[#0A66C2] transition-all duration-300 hover:scale-110"
                    aria-label="Visit LinkedIn profile"
                  >
                    <Linkedin className="h-6 w-6" />
                  </a>
                </div>
              </div>
            </div>

            {/* Badge - moved from Hero - Now clickable with flip animation */}
            <button
              onClick={() => setBadgeFlipped(!badgeFlipped)}
              className="hidden lg:inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-gray-300/40 dark:border-white/10 shadow-lg ml-4 cursor-pointer hover:border-emerald-400/30 transition-all duration-300 hover:scale-105 group"
              aria-label={badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
              title={badgeFlipped ? t("header.badge") : t("header.badgeAlt")}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span
                key={badgeFlipped ? 'alt' : 'main'}
                className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent uppercase animate-[flipIn_0.5s_ease-in-out]"
              >
                {badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
              </span>
            </button>

            {/* Desktop: Language switcher, Feedback, and Auth button */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="btn-spring relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/40 dark:bg-white/5 border border-gray-300/40 dark:border-white/10 text-gray-700 dark:text-white transition-all duration-300 hover:bg-emerald-500/10 dark:hover:bg-white/10"
                aria-label="Toggle Theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-emerald-400" /> : <Moon className="h-4 w-4 text-emerald-600" />}
              </button>
              <LanguageSwitcher />
              {user && (
                <>
                  <div data-tour="credits" className="inline-block">
                    <CreditBalance
                      onClick={() => {
                        setCreditModalMode('full');
                        setShowCreditModal(true);
                      }}
                    />
                  </div>
                  {/* Invite Friends Button */}
                  <button
                    data-tour="referral"
                    onClick={() => {
                      setCreditModalMode('invite-only');
                      setShowCreditModal(true);
                    }}
                    className="btn-spring relative inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/50 text-emerald-700 dark:text-emerald-300 hover:from-emerald-500/30 hover:to-teal-500/20 hover:border-emerald-400/70 group shadow-md hover:shadow-emerald-500/20"
                    title="Invite friends and earn 5 credits each!"
                  >
                    <Gift className="w-4 h-4" />
                    <span className="text-sm font-bold">Invite</span>
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-emerald-400 to-teal-400 text-gray-900 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                      +5
                    </span>
                  </button>
                </>
              )}

              {user ? (
                <GlassButton
                  onClick={signOut}
                  variant="secondary"
                  size="md"
                  // Use dark background for better readability as requested
                  className="bg-gray-900/80 hover:bg-black border-gray-200 dark:border-white/10 text-gray-200 hover:text-white shadow-md font-bold tracking-wide"
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  {t("common.signOut")}
                </GlassButton>
              ) : (
                <GlassButton
                  onClick={signInWithGoogle}
                  variant="prominent"
                  size="md"
                  className="group relative font-bold"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  <LogIn className="h-4 w-4 mr-2" />
                  {t("common.signIn")}
                </GlassButton>
              )}
            </div>

            {/* Mobile: Hamburger menu button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden relative inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/40 dark:bg-white/5 border border-gray-300/40 dark:border-white/10 text-gray-900 dark:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* Hero section */}
        <div className={`${containerClass} flex-1 grid items-start gap-4 sm:gap-6 py-4 sm:py-6 lg:py-6 grid-cols-1 md:grid-cols-[1.5fr_1fr] lg:gap-8`}>
          {/* Left column - Main content */}
          <div
            className={cn(
              "space-y-4 sm:space-y-6 transform-gpu text-center sm:text-left",
              prefersReducedMotion
                ? "opacity-100"
                : "transition-all duration-700 ease-out",
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}
          >
            {/* Badge - moved to Header */}

            {/* Main heading card - matching Workflow card style */}
            <div className={cn(
              glassCardClass,
              "p-6 sm:p-8 lg:p-10",
              "border-emerald-500/10 hover:border-emerald-500/20 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_-4px_rgba(16,185,129,0.1)]"
            )}>
              {/* Card header with icon */}
              <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-emerald-500/90 to-teal-600/90 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)] ring-1 ring-white/20">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t("header.heroTitle")}</h1>
              </div>

              <p className="text-base sm:text-lg text-gray-600 dark:text-emerald-50/70 leading-relaxed font-light">
                {t("header.heroDescription")}
              </p>
            </div>

            {/* Feature cards - beautiful responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 [&>*:last-child:nth-child(3n+1)]:col-span-1 [&>*:last-child:nth-child(3n+1)]:md:col-span-2 [&>*:last-child:nth-child(3n+1)]:md:max-w-md [&>*:last-child:nth-child(3n+1)]:md:mx-auto">
              {featureCards.map((card, idx) => (
                <div
                  key={card.label}
                  className={cn(
                    glassCardClass,
                    glassCardHoverClass,
                    "p-4 sm:p-5 cursor-default group relative overflow-hidden",
                    prefersReducedMotion
                      ? ""
                      : "transition-all duration-500 ease-out",
                    heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
                    card.highlight ? "bg-[#006C35]/20 border-[#006C35]/40 hover:border-[#4ade80]/50" : ""
                  )}
                  style={{
                    transitionDelay: !prefersReducedMotion ? `${150 + idx * 50}ms` : undefined,
                  }}
                >
                  {/* Vision 2030 badge */}
                  {card.highlight && (
                    <span
                      className="absolute top-3 end-3 inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-pulse"
                      aria-label="Vision 2030 Featured"
                      role="img"
                    >
                      <Crown className="w-3.5 h-3.5 text-black drop-shadow-sm" />
                    </span>
                  )}

                  {/* Hover glow effect */}
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl",
                    `bg-gradient-to-br ${card.gradient}`
                  )} style={{ opacity: 0.15 }} />

                  <div className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4 bg-gradient-to-br shadow-inner border border-gray-200/50 dark:border-white/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                    card.gradient
                  )}>
                    <card.icon className="h-6 w-6 text-white drop-shadow-md" />
                  </div>

                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5",
                    card.highlight ? "text-[#006C35] dark:text-[#4ade80] drop-shadow-[0_0_8px_rgba(74,222,128,0.2)] dark:drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]" : "text-emerald-700/80 dark:text-emerald-400/80"
                  )}>
                    {card.label}
                  </p>
                  <p className="text-sm font-medium text-gray-700 dark:text-white/90 leading-snug">
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
              "p-6 sm:p-6 lg:p-8 self-start w-full",
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("header.workflow.title")}</h2>
            </div>

            <ul className="space-y-4 relative">
              {/* Connector Line */}
              <div className="absolute left-[1.5rem] top-4 bottom-4 w-px bg-gradient-to-b from-emerald-500/50 via-teal-500/20 to-transparent" />

              {workflowSteps.map((step, idx) => (
                <li
                  key={step.title}
                  className="group flex items-start gap-5 relative z-10"
                  style={{
                    animationDelay: `${idx * 100}ms`,
                  }}
                >
                  {/* Animated icon circle */}
                  <div className={cn(
                    iconCircleClass,
                    "h-12 w-12 flex-shrink-0 bg-white/60 dark:bg-black/40 border-emerald-500/20 group-hover:border-emerald-400/50 group-hover:scale-110 group-hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.4)]"
                  )}>
                    <step.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 transition-colors duration-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-300 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  </div>

                  <div className="flex-1 pt-1.5 transition-transform duration-300 group-hover:translate-x-1">
                    <p className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors duration-300 text-base">
                      {step.title}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-emerald-100/50 mt-1 leading-relaxed dark:group-hover:text-emerald-100/70 transition-colors">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Remove old decorative line, logic is now inside ul */}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={handleMobileNavOutsideClick}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

          {/* Nav Panel - slides in from right */}
          <div
            ref={mobileNavRef}
            className="absolute right-0 top-0 h-full w-[85%] max-w-[320px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-l border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.3)] animate-slide-in-right overflow-y-auto"
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-bold text-white">{t("common.appName")}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-300 hover:bg-white/10 active:scale-95"
                  aria-label="Toggle Theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5 text-emerald-400" /> : <Moon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                </button>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-300 hover:bg-white/10 active:scale-95"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Nav content */}
            <div className="flex flex-col p-5 space-y-4">
              {/* Language Switcher */}
              <div className="pb-4 border-b border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">{t("common.language") || "Language"}</p>
                <LanguageSwitcher />
              </div>

              {/* Credit Balance */}
              {user && (
                <div className="pb-4 border-b border-white/10 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">{t("credits.balance")}</p>
                  <div className="min-h-[44px]">
                    <CreditBalance onClick={() => {
                      setCreditModalMode('full');
                      setShowCreditModal(true);
                      setMobileNavOpen(false);
                    }} />
                  </div>

                  {/* Invite Friends Button (Mobile) */}
                  <button
                    onClick={() => {
                      setCreditModalMode('invite-only');
                      setShowCreditModal(true);
                      setMobileNavOpen(false);
                    }}
                    className="btn-spring w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 min-h-[48px] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/50 text-emerald-300 hover:from-emerald-500/30 hover:to-teal-500/20 hover:border-emerald-400/70 shadow-md"
                  >
                    <Gift className="w-5 h-5" />
                    <span className="text-sm font-bold">Invite Friends</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-emerald-400 to-teal-400 text-gray-900 rounded-full">
                      +5 Credits
                    </span>
                  </button>
                </div>
              )}

              {/* Auth Section */}
              <div className="pt-2 space-y-3">
                {user ? (
                  <button
                    onClick={() => {
                      signOut();
                      setMobileNavOpen(false);
                    }}
                    className="btn-spring w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-200 hover:text-white bg-gray-900/80 border border-white/10 hover:bg-black"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t("common.signOut")}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      signInWithGoogle();
                      setMobileNavOpen(false);
                    }}
                    className="btn-metal w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t("common.signIn")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-xs text-white/70">
                <span>{t("common.byAuthor")}</span>
                <a
                  href="https://www.linkedin.com/in/3binahmed/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-[#0A66C2] transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Usage Modal */}
      <CreditUsageModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        viewMode={creditModalMode}
      />
    </header>
  );
}




