import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, LogIn, LogOut, Sparkles, Target } from "lucide-react";
import { cn } from "../../lib/cn";
import { useAuth } from "../../hooks/useAuth";
import { getSkylineUrl } from "../../lib/assets";

const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.03"/><path d="M140 0v280" stroke="white" stroke-opacity="0.03"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.024"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.024"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.024"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

const containerClass = "app-shell w-full";
const HERO_HEADER_OFFSET = "4.5rem";
const heroBackgroundExtentClass = "absolute inset-x-0 top-0 bottom-[-64rem]";

const heroIconCircleClass =
  "relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--glass-border-strong),transparent_28%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_16%)] text-[color:var(--secondary)] shadow-[0_28px_68px_-32px_rgba(6,110,82,0.9)] backdrop-blur-2xl before:absolute before:inset-0 before:rounded-[inherit] before:bg-[image:var(--glass-reflection)] before:opacity-80 before:mix-blend-screen before:content-[''] after:pointer-events-none after:absolute after:inset-[-28%] after:rounded-full after:bg-[radial-gradient(circle_at_top,rgba(162,255,217,0.16),transparent_70%)] after:opacity-0 after:transition-opacity after:duration-breathe";

const heroTileClass =
  "group relative overflow-hidden rounded-[calc(var(--radius-card)*0.84)] border border-[color:color-mix(in_oklab,var(--glass-border),transparent_15%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_12%)] p-5 text-left text-ink shadow-[var(--shadow-soft)] backdrop-blur-2xl transition-[transform,box-shadow,background-color] duration-breathe ease-snappy before:absolute before:inset-0 before:rounded-[inherit] before:bg-[image:var(--glass-reflection)] before:opacity-60 before:mix-blend-screen before:transition-opacity before:duration-breathe before:content-[''] after:pointer-events-none after:absolute after:inset-[-40%] after:rounded-full after:bg-[radial-gradient(circle_at_top,rgba(32,185,148,0.16),transparent_70%)] after:opacity-0 after:transition-opacity after:duration-breathe hover:-translate-y-[2px] hover:after:opacity-90 hover:shadow-[var(--shadow-lift)]";

const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export default function Header() {
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

    setAnimateSkyline(true);
    const timer = setTimeout(() => setAnimateSkyline(false), 1800);
    return () => clearTimeout(timer);
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
        cancelFrame(heroFrame);
      } else if (heroFrame) {
        cancelFrame(heroFrame);
      }
      if (typeof workflowTimer === "number") {
        clearTimeout(workflowTimer);
      } else if (workflowTimer) {
        clearTimeout(workflowTimer);
      }
    };
  }, []);

  const skeletonBackgroundClass = cn(
    "absolute inset-0 -z-40 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-300",
    "bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--surface-strong),transparent_32%)_0%,transparent_64%),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface),transparent_24%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_58%)_100%)]"
  );

  const enableArabicBrand =
    (import.meta.env.VITE_FEATURE_ARABIC_BRAND ?? "true") !== "false";
  const arabicBrandName = "مُحَسِّنُ السِّيرَةِ الذَّاتِيَّةِ السُّعُودِيُّ";

  return (
    <header
      className={cn(
        "hero-bg-animate relative isolate flex flex-col overflow-visible text-surface-50 min-h-screen",
      )}
      style={{ "--hero-header-offset": HERO_HEADER_OFFSET }}
    >
      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col justify-between gap-8 sm:gap-10 lg:gap-12 py-12 sm:py-16 lg:py-20",
        )}
      >
        <div className="border-b border-[color:var(--hairline-soft)]">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-4 sm:py-6`}>
            <div
              className="flex items-center gap-3"
              aria-label={`AI Resume Optimizer${
                enableArabicBrand ? ` — ${arabicBrandName}` : ""
              } — By Abdullah bin Ahmed`}
            >
              <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[color:color-mix(in_oklab,var(--glass-border-strong),transparent_30%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_14%)] text-[color:var(--secondary)] shadow-[0_26px_58px_-30px_rgba(8,118,90,0.92)] backdrop-blur-xl">
                <span className="absolute inset-0 bg-[image:var(--glass-reflection)] opacity-80 mix-blend-screen" aria-hidden="true" />
                <Sparkles className="relative h-5 w-5 drop-shadow-[0_8px_18px_rgba(9,120,96,0.7)]" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1 text-left">
                <p className="text-[15px] font-semibold uppercase tracking-[0.20em] text-accent-400/90">
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
                <p className="text-sm font-semibold uppercase tracking-[0.20em] text-surface-50/90">
                  By Abdullah bin Ahmed
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              {user ? (
                <button
                  onClick={signOut}
                  className="group inline-flex items-center gap-2.5 rounded-2xl border border-surface-50/20 bg-gradient-to-br from-surface-50/15 to-surface-50/5 px-6 py-3 min-h-[44px] text-[15px] font-semibold text-surface-50 shadow-[0_4px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-surface-50/30 hover:from-surface-50/20 hover:to-surface-50/10 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="group inline-flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 px-6 py-3 min-h-[44px] text-[15px] font-semibold text-surface-50 shadow-[0_4px_24px_rgba(16,185,129,0.20)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/40 hover:from-emerald-500/30 hover:to-emerald-600/15 hover:shadow-[0_8px_32px_rgba(16,185,129,0.28)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogIn className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${containerClass} grid flex-1 items-center gap-8 py-12 sm:gap-10 sm:py-16 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12 lg:py-20`}
        >
          <div
            className={cn(
              "space-y-6 sm:space-y-7 transform-gpu text-center sm:text-left",
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
            <div className="relative max-w-2xl overflow-hidden rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--glass-border),transparent_20%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_12%)] p-6 text-center shadow-[var(--shadow-soft)] backdrop-blur-2xl transition-[box-shadow,transform] duration-300 ease-[var(--transition-snappy)] sm:p-7 lg:p-8 sm:text-left">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[image:var(--glass-reflection)] opacity-70 mix-blend-screen" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-12%,rgba(160,255,217,0.14),transparent_68%)]" />
              <span
                aria-hidden="true"
                className="absolute -top-8 left-6 text-accent-400 drop-shadow-[0_0_12px_rgba(197,166,106,0.35)]"
              >
                <Sparkles className="h-7 w-7" aria-hidden="true" />
              </span>
              <h1 className="relative text-balance text-shadow-hero text-4xl font-semibold leading-tight tracking-tight text-surface-50 sm:text-5xl lg:text-6xl">
                AI Resume Optimizer
              </h1>
              <p className="relative text-balance text-pretty text-shadow-hero mt-4 max-w-xl text-base leading-relaxed text-surface-50/90 sm:text-lg sm:max-w-none">
                Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div
                className={cn(
                  heroTileClass,
                  "text-center sm:text-left",
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
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/80">Smart Parsing</dt>
                <dd className="mt-2 text-lg font-semibold text-surface-50">Clean resume text</dd>
              </div>
              <div
                className={cn(
                  heroTileClass,
                  "text-center sm:text-left",
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
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/80">Match Score</dt>
                <dd className="mt-2 text-lg font-semibold text-surface-50">Saudi market fit</dd>
              </div>
              <div
                className={cn(
                  heroTileClass,
                  "text-center sm:text-left",
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
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/80">Polished Output</dt>
                <dd className="mt-2 text-lg font-semibold text-surface-50">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div
            className={cn(
              "card-glow group rounded-[var(--radius-card)] border border-transparent bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_14%)] p-6 text-[color:var(--ink)] shadow-[var(--shadow-soft)] backdrop-blur-glass transition-[box-shadow,background-color] duration-280 ease-[var(--transition-snappy)] hover:bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_4%)] hover:shadow-[var(--shadow-lift)]",
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
            <h2 className="text-lg font-semibold tracking-wide text-ink-900 dark:text-surface-50 sm:text-left text-center">Your Saudi-ready workflow</h2>
            <ul className="mt-6 space-y-5 text-sm text-ink-500 dark:text-surface-50/85">
              <li className="group flex items-start gap-3">
                <span className={cn(heroIconCircleClass, "mt-1 h-11 w-11 flex-shrink-0 sm:mt-0 sm:h-12 sm:w-12 after:opacity-70 group-hover:after:opacity-100")}>
                  <FileText className="h-4 w-4 drop-shadow-[0_6px_14px_rgba(10,120,96,0.6)]" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Upload or paste your resume</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Glassmorphic card with drag & drop, paste, and progress tracking.</p>
                </div>
              </li>
              <li className="group flex items-start gap-3">
                <span className={cn(heroIconCircleClass, "mt-1 h-11 w-11 flex-shrink-0 sm:mt-0 sm:h-12 sm:w-12 after:opacity-70 group-hover:after:opacity-100")}>
                  <Target className="h-4 w-4 drop-shadow-[0_6px_14px_rgba(10,120,96,0.6)]" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Match against Saudi job roles</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Get a confidence score, missing keywords, and guidance.</p>
                </div>
              </li>
              <li className="group flex items-start gap-3">
                <span className={cn(heroIconCircleClass, "mt-1 h-11 w-11 flex-shrink-0 sm:mt-0 sm:h-12 sm:w-12 after:opacity-70 group-hover:after:opacity-100")}>
                  <Sparkles className="h-4 w-4 drop-shadow-[0_6px_14px_rgba(10,120,96,0.6)]" aria-hidden="true" />
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
              "bg-hero -z-40 pointer-events-none bg-cover bg-center bg-no-repeat transition-[opacity,transform] duration-300 absolute",
              heroBackgroundExtentClass,
              skylineLoaded && animateSkyline ? "skyline-once" : "skyline-still",
              skylineLoaded ? "opacity-100" : "opacity-0"
            )}
            style={{
              backgroundImage: `url('${skylineUrl}')`,
              backgroundPosition: '50% 35%'
            }}
          />
        </>
      ) : (
        <div aria-hidden="true" className={cn(skeletonBackgroundClass, heroBackgroundExtentClass)} />
      )}
      <div
        aria-hidden="true"
        className={cn(
          "-z-30 pointer-events-none transition-colors duration-300",
          heroBackgroundExtentClass,
          "bg-[radial-gradient(circle_at_18%_-12%,color-mix(in_oklab,var(--accent),transparent_78%)_0%,transparent_64%),radial-gradient(circle_at_82%_-16%,color-mix(in_oklab,var(--accent-royal),transparent_76%)_0%,transparent_68%),linear-gradient(to_bottom,color-mix(in_oklab,var(--bg),transparent_08%)_0%,color-mix(in_oklab,var(--surface-strong),transparent_52%)_100%)]",
        )}
      />
      <div
        aria-hidden="true"
        className={cn("-z-25 pointer-events-none opacity-80 mix-blend-screen", heroBackgroundExtentClass)}
        style={{ backgroundImage: "var(--hero-overlay-sheen)" }}
      />
      <div
        className={cn("-z-20 opacity-[0.08] mix-blend-soft-light", heroBackgroundExtentClass)}
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
    </header>
  );
}
