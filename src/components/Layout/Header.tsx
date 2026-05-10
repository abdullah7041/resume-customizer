import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from "react";
import { Linkedin, LogIn, LogOut, Sparkles, Menu, X, Gift, Sun, Moon, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils/cn";
import { useAuth } from "../../hooks/useAuth";
import { getSkylineUrls } from "../../lib/assets";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { GlassButton } from "../ui/GlassButton";
import { CreditBalance } from "../Credits/CreditBalance";
import { CreditUsageModal } from "../Credits/CreditUsageModal";
import { SettingsModal } from "../Settings/SettingsModal";
import { useTheme } from "../../hooks/useTheme";
import { createPortal } from "react-dom";



const containerClass = "app-shell w-full";

const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export default function Header() {
  const { t } = useTranslation();
  const { user, signInWithGoogle, signOut } = useAuth();
  const skylineUrls = useMemo(() => getSkylineUrls(), []);
  const [skylineLoaded, setSkylineLoaded] = useState(false);
  const [animateSkyline, setAnimateSkyline] = useState(false);
  const isFallbackSkyline = useMemo(
    () => skylineUrls.desktop.startsWith("data:image/"),
    [skylineUrls.desktop]
  );
  const initialReducedMotion = useMemo(getPrefersReducedMotion, []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(initialReducedMotion);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [badgeFlipped, setBadgeFlipped] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalMode, setCreditModalMode] = useState<'full' | 'invite-only'>('full');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const showFixedSkyline = Boolean(user);
  const isSignedOutHeader = !user;

  const [theme, toggleTheme] = useTheme();

  // Mouse tracking for interactive gradient
  const handleMouseMove = useCallback((e: MouseEvent<HTMLElement>) => {
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
    if (typeof window === "undefined") return undefined;

    const img = new Image();
    img.onload = () => setSkylineLoaded(true);
    img.onerror = () => setSkylineLoaded(false);
    img.src = window.matchMedia("(max-width: 767px)").matches
      ? skylineUrls.mobile
      : skylineUrls.desktop;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [skylineUrls.desktop, skylineUrls.mobile]);

  useEffect(() => {
    if (typeof window === "undefined" || !skylineLoaded || isFallbackSkyline) {
      return undefined;
    }

    setAnimateSkyline(true);
    const timer = setTimeout(() => setAnimateSkyline(false), 1800);
    return () => clearTimeout(timer);
  }, [isFallbackSkyline, skylineLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateFromMediaQuery = (event: MediaQueryList | MediaQueryListEvent) => {
      const shouldReduce = event.matches;
      setPrefersReducedMotion(shouldReduce);
    };

    updateFromMediaQuery(mediaQuery);



    if (!mediaQuery.matches) {
      // Intentionally empty since animations were removed
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
    };
  }, []);



  return (
    <header
      className={cn(
        "hero-bg-animate relative isolate flex flex-col overflow-hidden h-auto",
        isSignedOutHeader
          ? "bg-[#fbfcfa] text-slate-950 dark:bg-[#06130f] dark:text-white pb-0"
          : "text-gray-900 dark:text-white pb-4"
      )}
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

      {showFixedSkyline && (
        <div
          role="img"
          aria-label="Decorative Riyadh skyline background"
          className={cn(
            "fixed inset-0 -z-50 overflow-hidden transition-opacity duration-700",
            skylineLoaded && animateSkyline ? "skyline-once" : "skyline-still",
            skylineLoaded ? "opacity-100" : "opacity-0"
          )}
        >
          <picture className="absolute inset-0 block">
            <source
              media="(max-width: 767px)"
              srcSet={skylineUrls.mobile}
              type={isFallbackSkyline ? undefined : "image/avif"}
            />
            <img
              src={skylineUrls.desktop}
              alt=""
              className="skyline-image"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setSkylineLoaded(true)}
              onError={() => setSkylineLoaded(false)}
            />
          </picture>
          <div className="skyline-readability-overlay" aria-hidden="true" />
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top navigation bar */}
        <nav className={cn(
          "border-b",
          isSignedOutHeader
            ? "border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#031713]/90"
            : showFixedSkyline
              ? "border-gray-200 dark:border-white/5"
              : "border-slate-200/70 bg-white/85 backdrop-blur-xl"
        )}>
          <div className={`${containerClass} flex items-center justify-between gap-4 py-3.5 sm:py-4`}>
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
                <p className={cn(
                  "text-base sm:text-lg font-extrabold tracking-[0.2em] uppercase",
                  isSignedOutHeader
                    ? "text-slate-950 dark:text-white"
                    : showFixedSkyline
                    ? "text-white dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-emerald-200 dark:via-white dark:to-teal-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    : "text-slate-950"
                )}>
                  {t("common.appName")}
                </p>
                <div className={cn("items-center gap-2 mt-0.5", isSignedOutHeader ? "hidden sm:flex" : "flex")}>
                  <p className={cn(
                    "text-sm sm:text-base font-bold tracking-wider",
                    isSignedOutHeader
                      ? "text-slate-500 dark:text-white/55"
                      : showFixedSkyline
                      ? "text-white dark:text-emerald-200/80 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-none"
                      : "text-slate-500"
                  )}>
                    {t("common.byAuthor")}
                  </p>
                  <a
                    href="https://www.linkedin.com/in/3binahmed/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center justify-center transition-all duration-300 hover:scale-110 hover:text-[#0A66C2] dark:hover:text-[#0A66C2]",
                      isSignedOutHeader
                        ? "text-slate-500 dark:text-white/55"
                        : showFixedSkyline
                        ? "text-white dark:text-emerald-200/80 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-none"
                        : "text-slate-500"
                    )}
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
              className={cn(
                "hidden lg:inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide backdrop-blur-xl shadow-sm ml-4 cursor-pointer transition-all duration-300 hover:scale-105 group",
                isSignedOutHeader
                  ? "border border-slate-200 bg-white text-emerald-700 hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-200"
                  : "bg-white/90 dark:bg-black/40 border border-gray-300 dark:border-white/10 hover:border-emerald-400/50"
              )}
              aria-label={badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
              title={badgeFlipped ? t("header.badge") : t("header.badgeAlt")}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-emerald-400" />
              </span>
              <span
                key={badgeFlipped ? 'alt' : 'main'}
                className={cn(
                  "uppercase animate-[flipIn_0.5s_ease-in-out]",
                  isSignedOutHeader
                    ? "text-emerald-700 dark:text-emerald-200"
                    : "bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-300 dark:to-teal-300 bg-clip-text text-transparent"
                )}
              >
                {badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
              </span>
            </button>

            {/* Desktop: Language switcher, Feedback, and Auth button */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className={cn(
                  "btn-spring relative inline-flex items-center justify-center w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-300 shadow-sm",
                  isSignedOutHeader
                    ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 dark:bg-white/[0.06] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    : "bg-white/80 dark:bg-black/40 border-gray-300 dark:border-white/10 text-gray-800 dark:text-white hover:bg-white hover:text-emerald-600 dark:hover:bg-white/10"
                )}
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
                    className="btn-spring relative inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/90 dark:bg-black/40 backdrop-blur-md border-2 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 dark:hover:bg-emerald-900/60 transition-all shadow-sm"
                    title={t('referrals.inviteEarn')}
                  >
                    <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-bold">{t('referrals.inviteShort', 'Invite')}</span>
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg group-hover:scale-110 transition-transform">
                      +5
                    </span>
                  </button>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="btn-spring relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-black/40 backdrop-blur-md border border-gray-300 dark:border-white/10 text-gray-800 dark:text-gray-300 transition-all duration-300 hover:bg-white hover:text-emerald-600 dark:hover:bg-white/10 shadow-sm"
                    aria-label={t('common.settings', 'Settings')}
                    title={t('common.settings', 'Settings')}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )}

              {user ? (
                <GlassButton
                  onClick={signOut}
                  variant="secondary"
                  size="md"
                  className="bg-white/90 dark:bg-black/40 backdrop-blur-md hover:bg-gray-100 dark:hover:bg-white/10 border-gray-300 dark:border-white/10 text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white shadow-sm font-bold tracking-wide"
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  {t("common.signOut")}
                </GlassButton>
              ) : (
                <GlassButton
                  onClick={signInWithGoogle}
                  variant="prominent"
                  size="md"
                  className={cn(
                    "group relative font-bold",
                    isSignedOutHeader && "bg-[#0b1026] text-white hover:bg-[#2b8994] dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200"
                  )}
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
              className={cn(
                "md:hidden relative inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border transition-all duration-300 active:scale-95",
                isSignedOutHeader
                  ? "bg-white border-slate-200 text-slate-950 hover:bg-slate-50 dark:bg-white/[0.06] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                  : "bg-white/40 dark:bg-white/5 border-gray-300/40 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10"
              )}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* Main content area intentionally removed, LandingPage now takes over */}
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileNavOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] md:hidden"
          onClick={handleMobileNavOutsideClick}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm animate-fade-in" />

          {/* Nav Panel - slides in from right */}
          <div
            ref={mobileNavRef}
            className="absolute right-0 top-0 h-full w-[85%] max-w-[320px] bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 border-l border-gray-200 dark:border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_40px_rgba(0,0,0,0.3)] animate-slide-in-right overflow-y-auto"
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{t("common.appName")}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95"
                  aria-label="Toggle Theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5 text-emerald-400" /> : <Moon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                </button>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Nav content */}
            <div className="flex flex-col p-5 space-y-4">
              {/* Language Switcher */}
              <div className="pb-4 border-b border-gray-200 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/50 mb-3">{t("common.language")}</p>
                <LanguageSwitcher />
              </div>

              {/* Credit Balance */}
              {user && (
                <div className="pb-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/50 mb-3">{t("credits.balance")}</p>
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
                    className="btn-spring w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 min-h-[48px] bg-gradient-to-br from-emerald-50 dark:from-emerald-500/20 to-teal-50 dark:to-teal-500/10 border-2 border-emerald-200 dark:border-emerald-400/50 text-emerald-700 dark:text-emerald-300 hover:from-emerald-100 dark:hover:from-emerald-500/30 hover:to-teal-100 dark:hover:to-teal-500/20 hover:border-emerald-300 dark:hover:border-emerald-400/70 shadow-md"
                  >
                    <Gift className="w-5 h-5" />
                    <span className="text-sm font-bold">{t('referrals.inviteFriends', 'Invite Friends')}</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-emerald-400 to-teal-400 text-white dark:text-gray-900 rounded-full">
                      {t('referrals.creditsBonus', '+5 Credits')}
                    </span>
                  </button>
                </div>
              )}

              {/* Auth Section */}
              <div className="pt-2 space-y-3">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        signOut();
                        setMobileNavOpen(false);
                      }}
                      className="btn-spring w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-900/80 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-black"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t("common.signOut")}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsModal(true);
                        setMobileNavOpen(false);
                      }}
                      className="btn-spring w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t('common.settings', 'Settings')}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      signInWithGoogle();
                      setMobileNavOpen(false);
                    }}
                    className="btn-metal w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-transparent"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t("common.signIn")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-white/70">
                <span>{t("common.byAuthor")}</span>
                <a
                  href="https://www.linkedin.com/in/3binahmed/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 dark:text-white/80 hover:text-[#0A66C2] dark:hover:text-[#0A66C2] transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Credit Usage Modal */}
      <CreditUsageModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        viewMode={creditModalMode}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
}




