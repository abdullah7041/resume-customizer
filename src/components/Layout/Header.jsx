import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FileText, LogIn, LogOut, Moon, Sparkles, Sun, Target } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import SecondaryButton from "../ui/SecondaryButton";
import { cn } from "../../lib/cn";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { getSkylineUrl } from "../../lib/assets";

const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.03"/><path d="M140 0v280" stroke="white" stroke-opacity="0.03"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.024"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.024"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.024"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

const containerClass = "app-shell w-full";
const HERO_HEADER_OFFSET = "4.5rem";
const heroBackgroundExtentClass =
  "absolute inset-x-0 top-0 h-[120dvh] max-h-[1100px] md:h-auto md:bottom-[-64rem]";
const MOBILE_GUTTER_VALUE = "clamp(0.55rem, 2.8vw, 1.35rem)";

const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === "dark";
  const [isShimmerActive, setIsShimmerActive] = useState(false);
  
  // Feature flag for dark mode toggle
  const darkModeEnabled =
    (import.meta.env.VITE_FEATURE_DARK_MODE ?? "true") !== "false";
  const skylineUrl = useMemo(() => {
    const url = getSkylineUrl();
    console.log("[hero] Skyline URL:", url);
    return url;
  }, []);
  const [skylineLoaded, setSkylineLoaded] = useState(false);
  const [animateSkyline, setAnimateSkyline] = useState(false);
  const isFallbackSkyline = useMemo(
    () => {
      const isFallback = typeof skylineUrl === "string" && skylineUrl.startsWith("data:image/");
      console.log("[hero] Is fallback skyline:", isFallback);
      return isFallback;
    },
    [skylineUrl]
  );
  const initialReducedMotion = useMemo(getPrefersReducedMotion, []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(initialReducedMotion);
  const [heroVisible, setHeroVisible] = useState(initialReducedMotion);
  const [workflowVisible, setWorkflowVisible] = useState(initialReducedMotion);
  const heroAnimatedRef = useRef(initialReducedMotion);
  const workflowAnimatedRef = useRef(initialReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(max-width: 560px)");

    const applyGutter = (matches) => {
      if (matches) {
        root.style.setProperty("--app-shell-gutter", MOBILE_GUTTER_VALUE);
      } else {
        root.style.removeProperty("--app-shell-gutter");
      }
    };

    applyGutter(mediaQuery.matches);

    const listener = (event) => applyGutter(event.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(listener);
    }

    return () => {
      root.style.removeProperty("--app-shell-gutter");
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", listener);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  // Debug state changes
  useEffect(() => {
    console.log("[hero] State update:", {
      skylineUrl: skylineUrl ? `${skylineUrl.substring(0, 60)}...` : null,
      skylineLoaded,
      animateSkyline,
      isFallbackSkyline,
    });
  }, [skylineUrl, skylineLoaded, animateSkyline, isFallbackSkyline]);

  // Preload skyline image
  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl) {
      return undefined;
    }

    console.log("[hero] Preloading skyline:", skylineUrl);
    const img = new Image();
    img.onload = () => {
      console.log("[hero] Skyline loaded successfully");
      setSkylineLoaded(true);
    };
    img.onerror = (error) => {
      console.warn("[hero] Failed to load skyline image:", skylineUrl, error);
      setSkylineLoaded(false);
    };
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

    console.log("[hero] Setting animation state:", { skylineLoaded, isFallbackSkyline });
    setAnimateSkyline(true);
    const timer = window.setTimeout(() => setAnimateSkyline(false), 1800);
    return () => window.clearTimeout(timer);
  }, [isFallbackSkyline, skylineLoaded, skylineUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

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

    if (!mediaQuery.matches) {
      if (!heroAnimatedRef.current) {
        heroFrame = window.requestAnimationFrame(() => {
          setHeroVisible(true);
          heroAnimatedRef.current = true;
        });
      }

      if (!workflowAnimatedRef.current) {
        workflowTimer = window.setTimeout(() => {
          setWorkflowVisible(true);
          workflowAnimatedRef.current = true;
        }, 140);
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
      if (typeof heroFrame === "number") {
        window.cancelAnimationFrame(heroFrame);
      }
      if (typeof workflowTimer === "number") {
        window.clearTimeout(workflowTimer);
      }
    };
  }, []);

  const themeButtonClass = cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--hairline-strong)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "bg-[color:var(--panel-bg)] text-[color:var(--ink)] shadow-[var(--shadow-soft)] hover:text-[color:var(--accent)] focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-[color:var(--surface)]"
  );
  const nextThemeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";
  const ThemeIcon = isDark ? Sun : Moon;

  const skeletonBackgroundClass = cn(
    "absolute inset-0 -z-40 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-300",
    isDark
      ? "bg-[radial-gradient(circle_at_20%_10%,color-mix(in_oklab,var(--surface-strong),transparent_50%)_0%,transparent_65%),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface-strong),transparent_35%)_0%,color-mix(in_oklab,var(--surface),transparent_70%)_100%)]"
      : "bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--surface-strong),transparent_28%)_0%,transparent_62%),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface),transparent_20%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_65%)_100%)]"
  );

  const enableArabicBrand =
    (import.meta.env.VITE_FEATURE_ARABIC_BRAND ?? "true") !== "false";
  const arabicBrandName = "مُحَسِّنُ السِّيرَةِ الذَّاتِيَّةِ السُّعُودِيُّ";

  const handleBadgeInteraction = useCallback((event) => {
    event.preventDefault();
    setIsShimmerActive(true);
    const timer = setTimeout(() => setIsShimmerActive(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <header
      className={cn(
        "hero-bg-animate hero-mobile-compact relative isolate flex flex-col overflow-visible text-surface-50 min-h-screen",
      )}
      style={{ "--hero-header-offset": HERO_HEADER_OFFSET }}
    >
      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col justify-between gap-8 sm:gap-10 lg:gap-14 py-12 sm:py-16 lg:py-20",
        )}
      >
        <div className="border-b border-[color:var(--hairline-soft)]">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-3 sm:py-5`}>
            <div
              className="flex items-center gap-3"
              aria-label={`AI Resume Optimizer${
                enableArabicBrand ? ` — ${arabicBrandName}` : ""
              } — By Abdullah bin Ahmed`}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] text-[color:var(--accent)] shadow-[var(--shadow-soft)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1 text-left">
                <p className="text-[15px] font-semibold uppercase tracking-[0.20em] text-accent-400/90" style={{ fontFamily: '"Comic Sans MS"'}}>
                  AI Resume Optimizer
                </p>
                {enableArabicBrand ? (
                  <p
                    className="text-[25px] font-semibold leading-snug text-surface-50/80"
                    lang="ar"
                    dir="rtl"
                    style={{
                      fontFamily:
                        '"Scheherazade New", "Amiri", "Noto Naskh Arabic", "IBM Plex Sans Arabic", "Traditional Arabic", serif',
                    }}
                  >
                    {arabicBrandName}
                  </p>
                ) : null}
                <p className="text-sm font-semibold uppercase tracking-[0.20em] text-surface-50/90" style={{ fontFamily: '"Comic Sans MS"'}}>
                  By Abdullah bin Ahmed
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              {user ? (
                <SecondaryButton icon={LogOut} onClick={signOut}>
                  Sign Out
                </SecondaryButton>
              ) : (
                <PrimaryButton icon={LogIn} onClick={signInWithGoogle}>
                  Sign In
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${containerClass} grid flex-1 items-center gap-8 py-10 sm:gap-10 sm:py-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14 lg:py-14`}
        >
          <div
            className={cn(
              "space-y-5 sm:space-y-6 transform-gpu",
              prefersReducedMotion
                ? "opacity-100"
                : "transition-[opacity,transform] duration-[280ms] ease-[var(--transition-snappy)]",
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <span
              role="button"
              tabIndex={0}
              className={cn(
                "badge-gold-shimmer inline-flex items-center gap-2 self-center rounded-full border border-surface-50/35 bg-surface-900/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-shadow-hero sm:self-start",
                isShimmerActive && "shimmer-active"
              )}
              onClick={handleBadgeInteraction}
              onTouchStart={handleBadgeInteraction}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleBadgeInteraction(e);
                }
              }}
              aria-label="Saudi Arabia ambition badge - tap for shimmer effect"
            >
              Designed for Saudi ambition
            </span>
            <div className="relative max-w-2xl rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-5 shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--transition-snappy)] sm:p-6 lg:p-7">
              <span
                aria-hidden="true"
                className="absolute -top-7 left-5 text-accent-400 drop-shadow-[0_0_12px_rgba(197,166,106,0.35)]"
              >
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              </span>
              <h1 className="text-balance text-shadow-hero text-3xl font-semibold leading-tight tracking-tight text-surface-50 sm:text-4xl lg:text-5xl">
                AI Resume Optimizer
              </h1>
              <p className="text-balance text-pretty text-shadow-hero mt-3 max-w-xl text-sm leading-relaxed text-surface-50/90 sm:text-base lg:text-lg">
                Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3 sm:gap-4">
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-3 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] hover:shadow-[var(--shadow-lift)] sm:p-4",
                  prefersReducedMotion
                    ? ""
                    : "transform-gpu transition-[opacity,transform] duration-[280ms] ease-[var(--transition-snappy)]",
                  heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                )}
                style={
                  !prefersReducedMotion && heroVisible
                    ? {
                        transitionDelay: "120ms",
                      }
                    : undefined
                }
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Smart Parsing</dt>
                <dd className="mt-2 text-base font-semibold text-ink-900 dark:text-surface-50 sm:text-lg">Clean resume text</dd>
              </div>
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-3 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] hover:shadow-[var(--shadow-lift)] sm:p-4",
                  prefersReducedMotion
                    ? ""
                    : "transform-gpu transition-[opacity,transform] duration-[280ms] ease-[var(--transition-snappy)]",
                  heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                )}
                style={
                  !prefersReducedMotion && heroVisible
                    ? {
                        transitionDelay: "180ms",
                      }
                    : undefined
                }
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Match Score</dt>
                <dd className="mt-2 text-base font-semibold text-ink-900 dark:text-surface-50 sm:text-lg">Saudi market fit</dd>
              </div>
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-3 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] hover:shadow-[var(--shadow-lift)] sm:p-4",
                  prefersReducedMotion
                    ? ""
                    : "transform-gpu transition-[opacity,transform] duration-[280ms] ease-[var(--transition-snappy)]",
                  heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                )}
                style={
                  !prefersReducedMotion && heroVisible
                    ? {
                        transitionDelay: "240ms",
                      }
                    : undefined
                }
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Polished Output</dt>
                <dd className="mt-2 text-base font-semibold text-ink-900 dark:text-surface-50 sm:text-lg">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div
            className={cn(
              "card-glow group rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-5 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] hover:shadow-[var(--shadow-lift)] sm:p-6",
              prefersReducedMotion
                ? ""
                : "transform-gpu transition-[opacity,transform] duration-[300ms] ease-[var(--transition-snappy)]",
              workflowVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={
              !prefersReducedMotion && workflowVisible
                ? {
                    transitionDelay: "220ms",
                  }
                : undefined
            }
          >
            <h2 className="text-base font-semibold tracking-wide text-ink-900 dark:text-surface-50 sm:text-lg">Your Saudi-ready workflow</h2>
            <ul className="mt-5 space-y-4 text-sm text-ink-500 dark:text-surface-50/85">
              <li className="flex gap-2.5 sm:gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)] sm:h-9 sm:w-9">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Upload or paste your resume</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Glassmorphic card with drag & drop, paste, and progress tracking.</p>
                </div>
              </li>
              <li className="flex gap-2.5 sm:gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)] sm:h-9 sm:w-9">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Match against Saudi job roles</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Get a confidence score, missing keywords, and guidance.</p>
                </div>
              </li>
              <li className="flex gap-2.5 sm:gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)] sm:h-9 sm:w-9">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Optimize with precision</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Premium suggestions styled for modern Saudi employers.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
      {/* Skyline background image with loading state */}
      {typeof skylineUrl === "string" && skylineUrl ? (
        <>
          {!skylineLoaded && (
            <div aria-hidden="true" className={cn(skeletonBackgroundClass, heroBackgroundExtentClass)} />
          )}
          <div
            role="img"
            aria-label="Decorative skyline background"
            title="Saudi Arabia skyline"
            className={cn(
              "bg-hero pointer-events-none bg-cover bg-center bg-no-repeat transition-[opacity,transform] duration-300 absolute overflow-hidden print:opacity-100",
              heroBackgroundExtentClass,
              skylineLoaded && animateSkyline ? "skyline-once" : "skyline-still",
              skylineLoaded ? "opacity-100" : "opacity-90"
            )}
            style={{
              backgroundImage: `url('${skylineUrl}')`,
              backgroundPosition: "50% 35%",
              zIndex: -40,
            }}
            ref={(el) => {
              if (el && skylineLoaded) {
                console.log("[hero] Skyline div rendered with classes:", el.className);
                console.log("[hero] Background image style:", el.style.backgroundImage);
                console.log("[hero] Computed opacity:", window.getComputedStyle(el).opacity);
              }
            }}
          >
            <img
              src={skylineUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(1.12) brightness(1.08)", opacity: 0.95 }}
            />
          </div>
        </>
      ) : (
        <div aria-hidden="true" className={cn(skeletonBackgroundClass, heroBackgroundExtentClass)} />
      )}
      <div
        aria-hidden="true"
        className={cn(
          "-z-30 pointer-events-none transition-colors duration-300",
          heroBackgroundExtentClass,
          isDark
            ? "bg-[radial-gradient(circle_at_24%_-6%,color-mix(in_oklab,var(--accent),transparent_82%)_0%,transparent_58%),radial-gradient(circle_at_78%_-16%,color-mix(in_oklab,#8b5cf6,transparent_72%)_0%,transparent_68%),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface),transparent_10%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_52%)_100%)]"
            : "bg-[radial-gradient(circle_at_20%_-10%,color-mix(in_oklab,#a855f7,transparent_78%)_0%,transparent_60%),radial-gradient(circle_at_80%_-14%,color-mix(in_oklab,#ec4899,transparent_82%)_0%,transparent_68%),linear-gradient(to_bottom,color-mix(in_oklab,var(--bg),transparent_06%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_50%)_100%)]",
        )}
      />
      <div
        aria-hidden="true"
        className={cn("-z-25 pointer-events-none mix-blend-screen", heroBackgroundExtentClass)}
        style={{ backgroundImage: "var(--hero-overlay-sheen)", opacity: isDark ? 0.5 : 0.68 }}
      />
      <div
        className={cn("-z-20 opacity-[0.08] mix-blend-soft-light", heroBackgroundExtentClass)}
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
    </header>
  );
}
