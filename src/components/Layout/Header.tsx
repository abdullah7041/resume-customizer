import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense, type CSSProperties, type MouseEvent } from "react";
import { Linkedin, LogIn, LogOut, Sparkles, Menu, X, Gift, Sun, Moon, Settings, UserCircle, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils/cn";
import { useAuth } from "../../hooks/useAuth";
import { getSkylineUrls } from "../../lib/assets";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { GlassButton } from "../ui/GlassButton";
import { CreditBalance } from "../Credits/CreditBalance";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useTheme } from "../../hooks/useTheme";
import { useExitPresence } from "@/hooks/useExitPresence";

// Header modals are state-gated overlays — lazy-load them so they stay out of the entry chunk.
const CreditUsageModal = lazy(() => import("../Credits/CreditUsageModal").then((m) => ({ default: m.CreditUsageModal })));
const PricingWaitlistModal = lazy(() => import("../Credits/PricingWaitlistModal").then((m) => ({ default: m.PricingWaitlistModal })));
const SettingsModal = lazy(() => import("../Settings/SettingsModal").then((m) => ({ default: m.SettingsModal })));
const FeedbackModal = lazy(() => import("../Feedback/FeedbackModal").then((m) => ({ default: m.FeedbackModal })));
import { useUserCredits } from "../../hooks/useUserCredits";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";



const containerClass = "app-shell w-full";
const ACCOUNT_MENU_WIDTH = 288;
const ACCOUNT_MENU_GAP = 12;
const ACCOUNT_MENU_MARGIN = 16;
const ACCOUNT_MENU_MIN_HEIGHT = 240;
const MARKETING_NAV_ITEMS = [
  { section: "mj2-demo", translationKey: "header.nav.howItWorks", fallback: "How it works" },
  { section: "mj2-pricing", translationKey: "header.nav.pricing", fallback: "Pricing" },
  { section: "mj2-faq", translationKey: "header.nav.faq", fallback: "FAQ" },
] as const;

interface HeaderProps {
  showDecorativeSkyline?: boolean;
  showMarketingNav?: boolean;
}

export default function Header({ showDecorativeSkyline = true, showMarketingNav = true }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, signInWithGoogle, signOut } = useAuth();
  const skylineUrls = useMemo(() => getSkylineUrls(), []);
  const [skylineLoaded, setSkylineLoaded] = useState(false);
  const [animateSkyline, setAnimateSkyline] = useState(false);
  const isFallbackSkyline = useMemo(
    () => skylineUrls.desktop.startsWith("data:image/"),
    [skylineUrls.desktop]
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [badgeFlipped, setBadgeFlipped] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const accountMenuButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuPanelRef = useRef<HTMLDivElement>(null);
  const [accountMenuStyle, setAccountMenuStyle] = useState<CSSProperties | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditModalMode, setCreditModalMode] = useState<'full' | 'invite-only'>('full');
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const creditModalPresence = useExitPresence(showCreditModal);
  const settingsModalPresence = useExitPresence(showSettingsModal);
  const feedbackModalPresence = useExitPresence(showFeedbackModal);
  const feedbackEnabled = useFeatureFlag("feedback");
  const { credits } = useUserCredits();
  const isSignedOutHeader = !user;
  const showFixedSkyline = showDecorativeSkyline;

  const [theme, toggleTheme] = useTheme();
  const textDirection = i18n.dir();

  const updateAccountMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const trigger = accountMenuButtonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = accountMenuPanelRef.current?.offsetHeight ?? 408;
    const preferredLeft = textDirection === "rtl" ? rect.left : rect.right - ACCOUNT_MENU_WIDTH;
    const maxLeft = viewportWidth - ACCOUNT_MENU_WIDTH - ACCOUNT_MENU_MARGIN;
    const left = Math.min(
      Math.max(ACCOUNT_MENU_MARGIN, preferredLeft),
      Math.max(ACCOUNT_MENU_MARGIN, maxLeft)
    );

    const availableBelow = viewportHeight - rect.bottom - ACCOUNT_MENU_GAP - ACCOUNT_MENU_MARGIN;
    const availableAbove = rect.top - ACCOUNT_MENU_GAP - ACCOUNT_MENU_MARGIN;
    const shouldOpenAbove =
      availableBelow < ACCOUNT_MENU_MIN_HEIGHT && availableAbove > availableBelow;
    const maxHeight = Math.max(
      ACCOUNT_MENU_MIN_HEIGHT,
      Math.min(480, shouldOpenAbove ? availableAbove : availableBelow)
    );
    const top = shouldOpenAbove
      ? Math.max(ACCOUNT_MENU_MARGIN, rect.top - ACCOUNT_MENU_GAP - Math.min(menuHeight, maxHeight))
      : Math.min(rect.bottom + ACCOUNT_MENU_GAP, viewportHeight - ACCOUNT_MENU_MARGIN - ACCOUNT_MENU_MIN_HEIGHT);

    setAccountMenuStyle({
      position: "fixed",
      top,
      left,
      width: ACCOUNT_MENU_WIDTH,
      maxHeight,
      zIndex: 120,
    });
  }, [textDirection]);

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
      if (e.key === 'Escape' && accountMenuOpen) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [accountMenuOpen, mobileNavOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (accountMenuButtonRef.current?.contains(target)) return;
      if (accountMenuPanelRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) {
      setAccountMenuStyle(null);
      return undefined;
    }

    updateAccountMenuPosition();
    window.addEventListener("resize", updateAccountMenuPosition);
    window.addEventListener("scroll", updateAccountMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateAccountMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateAccountMenuPosition);

    return () => {
      window.removeEventListener("resize", updateAccountMenuPosition);
      window.removeEventListener("scroll", updateAccountMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateAccountMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateAccountMenuPosition);
    };
  }, [accountMenuOpen, updateAccountMenuPosition]);

  // Close mobile nav on outside click
  const handleMobileNavOutsideClick = useCallback((e: MouseEvent) => {
    if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
      setMobileNavOpen(false);
    }
  }, []);

  const handleOpenPlans = useCallback(() => {
    setShowPlansModal(true);
    setAccountMenuOpen(false);
    setMobileNavOpen(false);
  }, []);

  // Marketing nav: open the landing page as an in-app overlay scrolled to the
  // matching section. App.tsx listens for this event (see showLandingOverride).
  const goToLanding = useCallback((section: string) => {
    window.dispatchEvent(new CustomEvent("watheq:view-landing", { detail: { section } }));
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
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



  return (
    <header
      className={cn(
        "relative isolate flex flex-col overflow-hidden h-auto",
        !isSignedOutHeader && "hero-bg-animate",
        isSignedOutHeader
          ? "bg-[color:var(--bg)] text-slate-950 dark:bg-[#06130f] dark:text-white pb-0"
          : "text-gray-900 dark:text-white pb-4"
      )}
    >
      {/* Animated background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">

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
        <nav className="border-b border-[color:var(--glass-border)] bg-[color:var(--surface-glass-strong)] shadow-sm shadow-black/5 [backdrop-filter:blur(24px)] [-webkit-backdrop-filter:blur(24px)] dark:border-white/[0.12] dark:bg-[#041c17]/[0.94]">
          <div className={`${containerClass} relative flex items-center justify-between gap-2 py-3.5 sm:gap-4 sm:py-4`}>
            {/* Logo section */}
            <div className="group flex min-w-0 items-center gap-2 sm:gap-4">
              {/* Animated logo icon */}
              <div className="relative group-hover:scale-105 transition-transform duration-300">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 blur-md opacity-25 group-hover:opacity-35 transition-opacity duration-500" />
                <img
                  src="/logo-circle.png"
                  alt="Watheq Logo"
                  className={cn(
                    "relative object-cover rounded-full drop-shadow-lg",
                    isSignedOutHeader ? "h-14 w-14" : "h-11 w-11 sm:h-12 sm:w-12"
                  )}
                />
              </div>

              {/* Brand text — bilingual, bidi-safe, shown in both states */}
              <div className={cn('min-w-0 flex-col', user ? 'hidden sm:flex' : 'flex')}>
                <p className="truncate text-base font-extrabold uppercase tracking-[0.2em] text-[#1a3a2a] dark:text-white dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)] sm:text-lg">
                  <span dir="ltr">{t("common.appNameEnglish", "WATHEQ")}</span>
                  <span aria-hidden="true"> | </span>
                  <span dir="rtl">{t("common.appNameArabic", "واثق")}</span>
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-emerald-800/80 dark:text-emerald-200/70">
                  {t("common.appSubtitle", "Resume tools for the Saudi job market")}
                </p>
              </div>
            </div>

            {/* Badge - signed-out trust signal only */}
            {isSignedOutHeader && (
              <button
                type="button"
                onClick={() => setBadgeFlipped(!badgeFlipped)}
                className="hidden lg:inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-700 backdrop-blur-xl shadow-sm ml-4 cursor-pointer transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out hover:scale-105 hover:border-emerald-300 group dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-200"
                aria-label={badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
                title={badgeFlipped ? t("header.badge") : t("header.badgeAlt")}
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <span
                  key={badgeFlipped ? 'alt' : 'main'}
                  className="uppercase animate-[flipIn_0.5s_ease-in-out]"
                >
                  {badgeFlipped ? t("header.badgeAlt") : t("header.badge")}
                </span>
              </button>
            )}

            {/* Marketing nav — jumps to the matching landing section as an in-app
                overlay. Shown to signed-in and guest users (signed-out users see
                the landing's own nav). */}
            {showMarketingNav && (
              <nav className="hidden md:flex items-center gap-6" aria-label={t("header.nav.label", "Main navigation")}>
                {MARKETING_NAV_ITEMS.map((item) => (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => goToLanding(item.section)}
                    className="text-sm font-semibold text-gray-700 transition-colors hover:text-emerald-700 dark:text-gray-200 dark:hover:text-emerald-300"
                  >
                    {t(item.translationKey, item.fallback)}
                  </button>
                ))}
              </nav>
            )}

            {/* Desktop: keep authenticated header quiet; secondary actions live in account menu */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="btn-spring relative inline-flex items-center justify-center w-10 h-10 rounded-xl backdrop-blur-md border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out shadow-sm bg-[color:var(--surface-control)] border-[color:var(--glass-border)] text-slate-700 hover:bg-[color:var(--surface-control-hover)] hover:text-emerald-700 dark:bg-white/[0.06] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    aria-label={t('common.toggleTheme', 'Toggle theme')}
                  >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-emerald-400" /> : <Moon className="h-4 w-4 text-[#2b8994]" />}
                  </button>
                  <LanguageSwitcher />
                  <div data-tour="credits" className="inline-block">
                    <CreditBalance
                      variant="compact"
                      onClick={() => {
                        setCreditModalMode('full');
                        setShowCreditModal(true);
                      }}
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      ref={accountMenuButtonRef}
                      onClick={() => setAccountMenuOpen((open) => !open)}
                      className="btn-spring inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 text-gray-800 shadow-sm backdrop-blur-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-[color:var(--surface-control-hover)] hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] dark:border-white/15 dark:bg-black/55 dark:text-gray-100 dark:hover:bg-black/70 dark:hover:text-white"
                      aria-label={t('common.accountMenu', 'Account menu')}
                      aria-expanded={accountMenuOpen}
                      aria-haspopup="menu"
                    >
                      <UserCircle className="h-5 w-5" />
                      <Menu className="h-4 w-4" />
                    </button>

                    {accountMenuOpen && accountMenuStyle && createPortal(
                      <div
                        ref={accountMenuPanelRef}
                        role="menu"
                        style={accountMenuStyle}
                        className="origin-top-right rtl:origin-top-left animate-in fade-in zoom-in-95 duration-150 ease-out overflow-y-auto rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass-elevated)] p-3 text-gray-800 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#071f1a]/95 dark:text-gray-100"
                      >
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={handleOpenPlans}
                            className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/15 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/15"
                            role="menuitem"
                          >
                            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            <span>{t('pricing.workspaceCta', 'Need more credits? View plans')}</span>
                          </button>
                          <button
                            type="button"
                            data-tour="referral"
                            onClick={() => {
                              setCreditModalMode('invite-only');
                              setShowCreditModal(true);
                              setAccountMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-gray-200 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
                            role="menuitem"
                          >
                            <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span>{t('referrals.inviteFriends', 'Invite Friends')}</span>
                            <span className="ms-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                              {t('referrals.creditsBonus', '+5 Credits')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSettingsModal(true);
                              setAccountMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-[color:var(--surface-control-hover)] hover:text-gray-950 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                            role="menuitem"
                          >
                            <Settings className="h-4 w-4" />
                            <span>{t('common.settings', 'Settings')}</span>
                          </button>
                          {feedbackEnabled && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowFeedbackModal(true);
                              setAccountMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-[color:var(--surface-control-hover)] hover:text-gray-950 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                            role="menuitem"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>{t('feedback.cta', 'Feedback')}</span>
                          </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              signOut();
                              setAccountMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-[color:var(--surface-control-hover)] hover:text-gray-950 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white"
                            role="menuitem"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>{t("common.signOut")}</span>
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="btn-spring relative inline-flex items-center justify-center w-10 h-10 rounded-xl backdrop-blur-md border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out shadow-sm bg-[color:var(--surface-control)] border-[color:var(--glass-border)] text-slate-700 hover:bg-[color:var(--surface-control-hover)] hover:text-emerald-700 dark:bg-white/[0.06] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    aria-label={t('common.toggleTheme', 'Toggle theme')}
                  >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-emerald-400" /> : <Moon className="h-4 w-4 text-[#2b8994]" />}
                  </button>
                  <LanguageSwitcher />
                  <GlassButton
                    onClick={() => {
                      void signInWithGoogle({ intent: "signin", source: "header_desktop" });
                    }}
                    variant="prominent"
                    size="md"
                    className="group relative font-bold bg-[#0b1026] text-white hover:bg-[#2b8994] dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {t("common.signIn")}
                  </GlassButton>
                </>
              )}
            </div>

            {/* Mobile: compact direct controls plus menu button */}
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 md:hidden">
              {user && (
                <div
                  data-tour="credits"
                  className="fixed end-[calc(var(--app-shell-gutter)+52px)] top-[max(18px,env(safe-area-inset-top))] z-40 sm:top-[max(22px,env(safe-area-inset-top))]"
                >
                  <CreditBalance
                    variant="compact"
                    onClick={() => {
                      setCreditModalMode('full');
                      setShowCreditModal(true);
                    }}
                  />
                </div>
              )}
              <div
                data-mobile-header-preferences
                className={cn(
                  'flex items-center gap-1.5',
                  user && 'absolute end-[calc(var(--app-shell-gutter)+152px)] top-[max(18px,env(safe-area-inset-top))] z-30 sm:top-[max(22px,env(safe-area-inset-top))]'
                )}
              >
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-slate-700 transition-[color,background-color,border-color,box-shadow,scale,opacity] duration-150 ease-out hover:bg-[color:var(--surface-control-hover)] active:scale-[0.96] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  aria-label={t('common.toggleTheme', 'Toggle theme')}
                >
                  {theme === "dark" ? <Sun className="h-5 w-5 text-emerald-400" /> : <Moon className="h-5 w-5 text-[#2b8994]" />}
                </button>
                <LanguageSwitcher compact />
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className={cn(
                  "relative inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border transition-[color,background-color,border-color,box-shadow,scale,opacity] duration-150 ease-out active:scale-[0.96]",
                  isSignedOutHeader
                    ? "bg-[color:var(--surface-control)] border-[color:var(--glass-border)] text-slate-950 hover:bg-[color:var(--surface-control-hover)] dark:bg-white/[0.06] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    : "bg-[color:var(--surface-control)] dark:bg-black/55 border-[color:var(--glass-border)] dark:border-white/15 text-gray-900 dark:text-white hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-black/70"
                )}
                aria-label={t('common.openNavigation', 'Open navigation menu')}
                aria-expanded={mobileNavOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </nav>

        {/* Main content area intentionally removed, LandingPage now takes over */}
      </div>

      {/* Mobile Navigation Overlay */}
      {createPortal(
        <AnimatePresence>
          {mobileNavOpen && (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          onClick={handleMobileNavOutsideClick}
          aria-modal="true"
          role="dialog"
          aria-label={t('common.openNavigation', 'Open navigation menu')}
        >
          {/* Backdrop */}
          <m.div
            className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />

          {/* Nav Panel - slides in from the inline-end edge (RTL-aware) */}
          <m.div
            ref={mobileNavRef}
            className="absolute end-0 top-0 h-full w-[85%] max-w-[320px] bg-[color:var(--surface-glass-elevated)] dark:bg-[#031713] border-s border-[color:var(--glass-border)] dark:border-white/10 shadow-[-10px_0_40px_rgba(39,31,18,0.12)] dark:shadow-[-10px_0_40px_rgba(0,0,0,0.3)] overflow-y-auto"
            initial={{ x: textDirection === "rtl" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: textDirection === "rtl" ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
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
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-[color:var(--surface-control)] dark:bg-white/5 border border-[color:var(--glass-border)] dark:border-white/10 text-gray-900 dark:text-white transition-[color,background-color,border-color,box-shadow,scale,opacity] duration-150 ease-out hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/10 active:scale-[0.96]"
                  aria-label={t('common.closeNavigation', 'Close navigation menu')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Nav content */}
            <div className="flex flex-col p-5 space-y-4">
              {/* Marketing nav — opens the landing page scrolled to the section */}
              {showMarketingNav && (
                <nav className="pb-4 border-b border-gray-200 dark:border-white/10 flex flex-col" aria-label={t("header.nav.label", "Main navigation")}>
                  {MARKETING_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      onClick={() => goToLanding(item.section)}
                      className="w-full text-start rounded-xl px-3 py-3 min-h-[44px] text-sm font-semibold text-gray-700 transition-colors hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-gray-200 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
                    >
                      {t(item.translationKey, item.fallback)}
                    </button>
                  ))}
                </nav>
              )}

              {/* Credit Balance */}
              {user && (
                <div className="pb-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                  <p className="text-xs font-semibold tracking-wider text-gray-500 dark:text-white/50 mb-3">
                    {t("credits.balance", "Credits")}
                  </p>
                  <div className="min-h-[44px]">
                    <CreditBalance onClick={() => {
                      setCreditModalMode('full');
                      setShowCreditModal(true);
                      setMobileNavOpen(false);
                    }} />
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenPlans}
                    className="btn-spring w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-400/15"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{t('pricing.workspaceCta', 'Need more credits? View plans')}</span>
                  </button>

                  {/* Invite Friends Button (Mobile) */}
                  <button
                    type="button"
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
                      type="button"
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
                      type="button"
                      onClick={() => {
                        setShowSettingsModal(true);
                        setMobileNavOpen(false);
                      }}
                      className="btn-spring w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t('common.settings', 'Settings')}</span>
                    </button>
                    {feedbackEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeedbackModal(true);
                        setMobileNavOpen(false);
                      }}
                      className="btn-spring w-full flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 min-h-[48px] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{t('feedback.cta', 'Feedback')}</span>
                    </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void signInWithGoogle({ intent: "signin", source: "header_mobile" });
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
          </m.div>
        </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <Suspense fallback={null}>
        {/* Credit Usage Modal */}
        {creditModalPresence.shouldRender && (
          <CreditUsageModal
            isOpen={showCreditModal}
            onClose={() => setShowCreditModal(false)}
            viewMode={creditModalMode}
          />
        )}

        {/* Quiet authenticated pricing-waitlist CTA */}
        {showPlansModal && (
          <PricingWaitlistModal
            isOpen={showPlansModal}
            onClose={() => setShowPlansModal(false)}
            creditsRemaining={credits?.remaining ?? 0}
            dismissKey="watheq:headerPricingWaitlist"
            source="pricing"
          />
        )}

        {/* Settings Modal */}
        {settingsModalPresence.shouldRender && (
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
          />
        )}

        {feedbackEnabled && feedbackModalPresence.shouldRender && (
          <FeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
          />
        )}
      </Suspense>
    </header>
  );
}




