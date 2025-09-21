import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, LogIn, LogOut, Sparkles, Target } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import SecondaryButton from "../ui/SecondaryButton";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/cn";
import { skyline } from "../../lib/assets";



const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.03"/><path d="M140 0v280" stroke="white" stroke-opacity="0.03"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.024"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.024"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.024"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

const getIsNightSkyline = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 18 || hour < 6;
};

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const heroParallaxRef = useRef(null);
  const heroImageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isNightSkyline, setIsNightSkyline] = useState(() => getIsNightSkyline());

  useEffect(() => {
    if (heroImageRef.current?.complete) {
      setImageLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsNightSkyline(getIsNightSkyline());
    update();
    const id = window.setInterval(update, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = heroParallaxRef.current;
    if (!element) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    let rafId = null;
    let isActive = false;

    const applyParallax = () => {
      if (!element) return;
      const maxOffset = 14;
      const maxScroll = 520;
      const progress = Math.min(window.scrollY, maxScroll) / maxScroll;
      const offset = progress * maxOffset;
      element.style.transform = `translateY(${offset}px)`;
    };

    const resetParallax = () => {
      element.style.transform = "";
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyParallax();
      });
    };

    const update = () => {
      const shouldEnable = !motionQuery.matches && desktopQuery.matches;
      if (shouldEnable) {
        if (!isActive) {
          isActive = true;
          applyParallax();
          window.addEventListener("scroll", onScroll, { passive: true });
        }
      } else {
        if (isActive) {
          window.removeEventListener("scroll", onScroll);
          isActive = false;
        }
        resetParallax();
      }
    };

    update();

    const handleMotionChange = () => update();
    const handleDesktopChange = () => update();

    const motionAdd =
      typeof motionQuery.addEventListener === "function"
        ? motionQuery.addEventListener.bind(motionQuery)
        : motionQuery.addListener.bind(motionQuery);
    const motionRemove =
      typeof motionQuery.removeEventListener === "function"
        ? motionQuery.removeEventListener.bind(motionQuery)
        : motionQuery.removeListener.bind(motionQuery);
    const desktopAdd =
      typeof desktopQuery.addEventListener === "function"
        ? desktopQuery.addEventListener.bind(desktopQuery)
        : desktopQuery.addListener.bind(desktopQuery);
    const desktopRemove =
      typeof desktopQuery.removeEventListener === "function"
        ? desktopQuery.removeEventListener.bind(desktopQuery)
        : desktopQuery.removeListener.bind(desktopQuery);

    motionAdd("change", handleMotionChange);
    desktopAdd("change", handleDesktopChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      motionRemove("change", handleMotionChange);
      desktopRemove("change", handleDesktopChange);
      resetParallax();
    };
  }, []);

  const scrollToMain = useCallback(() => {
    if (typeof document === "undefined") return;
    const target = document.querySelector('[data-app-main]');
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <header className="relative isolate overflow-hidden text-surface-50 min-h-[100svh]">
      <div
        className="absolute inset-0 -z-40"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-30 overflow-hidden min-h-[100svh]" aria-hidden="true">
        <div
          ref={heroParallaxRef}
          className="relative h-full min-h-[100svh] w-full will-change-transform"
        >
          <img ref={heroImageRef} src={skyline()}
            alt=""
            width="1600"
            height="900"
            loading="eager"
            fetchpriority="high"
            className={cn(
              "h-full w-full object-cover object-center transition-[filter] duration-[var(--duration-breathe)] ease-[var(--transition-snappy)]",
              imageLoaded ? "hero-fade" : "opacity-0"
            )}
            style={{
              filter: isNightSkyline
                ? "brightness(0.82) saturate(0.95)"
                : "brightness(1.05) saturate(1.08)",
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(11,107,58,0.78) 0%, rgba(17,94,89,0.74) 55%, rgba(12,83,53,0.78) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: isNightSkyline
                ? "radial-gradient(circle at top, rgba(197, 166, 106, 0.25), transparent 58%)"
                : "radial-gradient(circle at top, rgba(255, 228, 185, 0.28), transparent 58%)",
            }}
          />
        </div>
      </div>
      <div
        className="absolute inset-0 -z-20 opacity-[0.05]"
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
      <div className="accent-divider absolute inset-x-0 bottom-0 -z-10 h-px" aria-hidden="true" />

      <div className="relative z-10">
        <div className="border-b border-surface-50/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-50/10 text-accent-500 shadow-soft">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-accent-400/90">
                  AI Resume Optimizer
                </p>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-surface-50/90">
                  By Abdullah bin Ahmed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <SecondaryButton icon={LogOut} onClick={signOut}>
                  Sign Out
                </SecondaryButton>
              ) : (
                <SecondaryButton icon={LogIn} onClick={signInWithGoogle}>
                  Sign In
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>

          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-h-[70vh]">
          <div className="space-y-6">
            <span
              tabIndex={0}
              className="badge-gold-shimmer inline-flex items-center gap-2 rounded-full border border-surface-50/30 bg-surface-50/20 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900"
            >
              Designed for Saudi ambition
            </span>
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute -top-7 left-0 text-accent-500 drop-shadow-[0_0_18px_rgba(197,166,106,0.45)]"
              >
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                AI Resume Optimizer
              </h1>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-surface-50/85">
              Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {user ? (
                <PrimaryButton onClick={scrollToMain}>
                  Continue optimizing
                </PrimaryButton>
              ) : (
                <PrimaryButton icon={LogIn} onClick={signInWithGoogle}>
                  Sign in to start
                </PrimaryButton>
              )}
              <SecondaryButton onClick={scrollToMain}>
                See the workflow
              </SecondaryButton>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div className="group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Smart Parsing</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Clean resume text</dd>
              </div>
              <div className="group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Match Score</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Saudi market fit</dd>
              </div>
              <div className="group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Polished Output</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div className="group rounded-[var(--radius-card)] border border-surface-50/25 bg-surface-50/85 p-6 text-ink-700 shadow-md backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-lg dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
            <h2 className="text-lg font-semibold tracking-wide text-ink-900 dark:text-surface-50">Your Saudi-ready workflow</h2>
            <ul className="mt-6 space-y-5 text-sm text-ink-500 dark:text-surface-50/85">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-50/70 text-secondary-600 shadow-sm dark:bg-surface-50/15 dark:text-surface-50">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Upload or paste your resume</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Glassmorphic card with drag & drop, paste, and progress tracking.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-50/70 text-secondary-600 shadow-sm dark:bg-surface-50/15 dark:text-surface-50">
                  <Target className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-ink-900 dark:text-surface-50">Match against Saudi job roles</p>
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Get a confidence score, missing keywords, and Riyadh-specific guidance.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-50/70 text-secondary-600 shadow-sm dark:bg-surface-50/15 dark:text-surface-50">
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
    </header>
  );
}