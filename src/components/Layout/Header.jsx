import { useEffect, useMemo, useRef, useState } from "react";
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
const heroMinHeightClass = "min-h-[calc(100vh-var(--hero-header-offset,4.5rem))]";

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
  const skylineUrl = useMemo(() => {
    try {
      const url = getSkylineUrl();
      console.log("[skylineUrl]", url);
      return url;
    } catch (error) {
      console.error("Failed to resolve skyline asset", error);
      return "";
    }
  }, []);
  const [skylineLoaded, setSkylineLoaded] = useState(false);
  const [animateSkyline, setAnimateSkyline] = useState(false);
  const initialReducedMotion = useMemo(getPrefersReducedMotion, []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(initialReducedMotion);
  const [heroVisible, setHeroVisible] = useState(initialReducedMotion);
  const [workflowVisible, setWorkflowVisible] = useState(initialReducedMotion);
  const heroAnimatedRef = useRef(initialReducedMotion);
  const workflowAnimatedRef = useRef(initialReducedMotion);

  // Preload skyline image
  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl) {
      return undefined;
    }

    const img = new Image();
    img.onload = () => {
      setSkylineLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load skyline image:", skylineUrl);
      setSkylineLoaded(false);
    };
    img.src = skylineUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [skylineUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl || !skylineLoaded) {
      return undefined;
    }

    setAnimateSkyline(true);
    const timer = window.setTimeout(() => setAnimateSkyline(false), 1800);
    return () => window.clearTimeout(timer);
  }, [skylineUrl, skylineLoaded]);

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
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--panel-stroke)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    isDark
      ? "bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] text-[color:var(--surface)] shadow-[var(--shadow-soft)] hover:text-[color:var(--accent)] focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-[color:var(--surface-strong)]"
      : "bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_6%)] text-[color:var(--ink)] shadow-[var(--shadow-soft)] hover:text-[color:var(--accent)] focus-visible:ring-[color:color-mix(in_oklab,var(--accent),transparent_24%)] focus-visible:ring-offset-[color:var(--surface)]"
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

  return (
    <header
      className={cn(
        "hero-bg-animate relative isolate flex flex-col overflow-hidden text-surface-50",
        heroMinHeightClass,
      )}
      style={{ "--hero-header-offset": HERO_HEADER_OFFSET }}
    >
      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col justify-between gap-8 pb-16 pt-12 sm:gap-12 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24",
          heroMinHeightClass,
        )}
      >
        <div className="border-b border-[color:color-mix(in_oklab,var(--panel-stroke),transparent_38%)]">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-4 sm:py-6`}>
            <div
              className="flex items-center gap-3"
              aria-label={`AI Resume Optimizer${
                enableArabicBrand ? ` — ${arabicBrandName}` : ""
              } — By Abdullah bin Ahmed`}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_18%)] text-[color:var(--accent)] shadow-[var(--shadow-soft)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-accent-400/90">
                  AI Resume Optimizer
                </p>
                {enableArabicBrand ? (
                  <p
                    className="text-[13px] font-semibold leading-snug text-surface-50"
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
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-surface-50/90">
                  By Abdullah bin Ahmed
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={toggleTheme}
                className={themeButtonClass}
                aria-pressed={isDark}
                aria-label={nextThemeLabel}
                title={nextThemeLabel}
              >
                <ThemeIcon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{nextThemeLabel}</span>
              </button>
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
          className={`${containerClass} grid flex-1 items-center gap-10 pb-16 pt-10 sm:gap-12 sm:pt-14 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-16`}
        >
          <div
            className={cn(
              "space-y-6 sm:space-y-7 transform-gpu",
              prefersReducedMotion
                ? "opacity-100"
                : "transition-[opacity,transform] duration-[280ms] ease-[var(--transition-snappy)]",
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <span
              tabIndex={0}
              className="badge-gold-shimmer inline-flex items-center gap-2 self-center rounded-full border border-surface-50/35 bg-surface-900/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-shadow-hero sm:self-start"
            >
              Designed for Saudi ambition
            </span>
            <div className="relative max-w-2xl rounded-[var(--radius-card)] border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_14%)] p-6 text-[color:var(--surface)] shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--transition-snappy)] sm:p-7 lg:p-8">
              <span
                aria-hidden="true"
                className="absolute -top-8 left-6 text-accent-400 drop-shadow-[0_0_12px_rgba(197,166,106,0.35)]"
              >
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="text-balance text-shadow-hero text-4xl font-semibold leading-tight tracking-tight text-[color:var(--surface)] sm:text-5xl lg:text-6xl">
                AI Resume Optimizer
              </h1>
              <p className="text-balance text-pretty text-shadow-hero mt-4 max-w-xl text-base leading-relaxed text-[color:color-mix(in_oklab,var(--surface),transparent_12%)] sm:text-lg">
                Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_22%)] p-4 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_28%)] hover:shadow-[var(--shadow-lift)] dark:text-[color:var(--surface)]",
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
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Clean resume text</dd>
              </div>
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_22%)] p-4 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_28%)] hover:shadow-[var(--shadow-lift)] dark:text-[color:var(--surface)]",
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
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Saudi market fit</dd>
              </div>
              <div
                className={cn(
                  "card-glow group rounded-2xl border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_22%)] p-4 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_28%)] hover:shadow-[var(--shadow-lift)] dark:text-[color:var(--surface)]",
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
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div
            className={cn(
              "card-glow group rounded-[var(--radius-card)] border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_22%)] p-6 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_28%)] hover:shadow-[var(--shadow-lift)] dark:text-[color:var(--surface)]",
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
            <h2 className="text-lg font-semibold tracking-wide text-ink-900 dark:text-surface-50">Your Saudi-ready workflow</h2>
            <ul className="mt-6 space-y-5 text-sm text-ink-500 dark:text-surface-50/85">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_12%)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)]">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Upload or paste your resume</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Glassmorphic card with drag & drop, paste, and progress tracking.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_12%)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)]">
                  <Target className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Match against Saudi job roles</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Get a confidence score, missing keywords, and guidance.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--panel-stroke)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_12%)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)]">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
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
            <div aria-hidden="true" className={skeletonBackgroundClass} />
          )}
          <div
            aria-hidden="true"
            className={cn(
              "bg-hero absolute inset-0 -z-40 pointer-events-none bg-cover bg-center bg-no-repeat transition-[opacity,transform] duration-300 md:bg-fixed md:bg-[position:50%_35%]",
              skylineLoaded && animateSkyline ? "skyline-once" : "skyline-still",
              !skylineLoaded && "opacity-0"
            )}
            style={{ backgroundImage: `url('${skylineUrl}')` }}
          />
        </>
      ) : (
        <div aria-hidden="true" className={skeletonBackgroundClass} />
      )}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-30 pointer-events-none transition-colors duration-300",
          isDark
            ? "bg-[radial-gradient(circle_at_24%_-6%,color-mix(in_oklab,var(--accent),transparent_82%)_0%,transparent_58%),radial-gradient(circle_at_78%_-16%,color-mix(in_oklab,#8b5cf6,transparent_72%)_0%,transparent_68%),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface),transparent_10%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_52%)_100%)]"
            : "bg-[radial-gradient(circle_at_20%_-10%,color-mix(in_oklab,#a855f7,transparent_78%)_0%,transparent_60%),radial-gradient(circle_at_80%_-14%,color-mix(in_oklab,#ec4899,transparent_82%)_0%,transparent_68%),linear-gradient(to_bottom,color-mix(in_oklab,var(--bg),transparent_06%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_50%)_100%)]",
        )}
      />
      <div
        className="absolute inset-0 -z-20 opacity-[0.08] mix-blend-soft-light"
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
      <div className="accent-divider absolute inset-x-0 bottom-0 -z-10 h-px" aria-hidden="true" />
    </header>
  );
}
