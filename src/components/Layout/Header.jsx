import { useCallback, useEffect, useMemo, useState } from "react";
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

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const containerClass = "app-shell w-full";

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { theme, isDark, setTheme } = useTheme();
  const skylineUrl = useMemo(() => {
    try {
      return getSkylineUrl();
    } catch (error) {
      console.error("Failed to resolve skyline asset", error);
      return "";
    }
  }, []);
  const [animateSkyline, setAnimateSkyline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !skylineUrl) {
      return undefined;
    }

    setAnimateSkyline(true);
    const timer = window.setTimeout(() => setAnimateSkyline(false), 1800);
    return () => window.clearTimeout(timer);
  }, [skylineUrl]);

  const toggleGroupClass = cn(
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-md transition-colors",
    isDark
      ? "border-surface-50/25 bg-surface-900/70 text-surface-50/80 shadow-[0_22px_48px_-32px_rgba(2,12,8,0.65)]"
      : "border-surface-900/10 bg-surface-50/95 text-ink-600 shadow-[0_20px_52px_-28px_rgba(11,107,58,0.45)]"
  );

  const getOptionClass = (isActive) =>
    cn(
      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/80 focus-visible:ring-offset-2",
      isActive
        ? isDark
          ? "bg-surface-900 text-surface-50 shadow-[0_20px_44px_-28px_rgba(0,0,0,0.7)] focus-visible:ring-offset-surface-900"
          : "bg-surface-50 text-ink-900 shadow-[0_18px_40px_-28px_rgba(11,107,58,0.45)] focus-visible:ring-offset-sand-50"
        : isDark
          ? "text-surface-50/70 hover:text-surface-50 focus-visible:ring-offset-surface-900"
          : "text-ink-500 hover:text-ink-700 focus-visible:ring-offset-sand-50"
    );

  const handleThemeKeyDown = useCallback(
    (event, index) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + themeOptions.length) % themeOptions.length;
      setTheme(themeOptions[nextIndex].value);
    },
    [setTheme]
  );

  return (
    <header
      className="hero-bg-animate relative isolate flex min-h-[calc(100vh-96px)] min-h-[100svh] flex-col justify-between gap-8 overflow-hidden bg-cover bg-center bg-no-repeat text-surface-50 pb-16 pt-12 sm:gap-12 sm:pb-24 sm:pt-20 md:min-h-[100dvh] md:bg-[position:50%_35%] lg:pb-28 lg:pt-24"
    >
      {typeof skylineUrl === "string" && skylineUrl ? (
        <div
          aria-hidden="true"
          className={cn(
            "bg-hero absolute inset-0 -z-40 min-h-[calc(100vh-96px)] pointer-events-none bg-scroll bg-cover bg-center bg-no-repeat transition-[opacity,transform] duration-700 md:bg-fixed md:bg-[position:50%_35%]",
            animateSkyline ? "skyline-once" : "skyline-still"
          )}
          style={{ backgroundImage: `url('${skylineUrl}')` }}
        />
      ) : null}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-30 pointer-events-none transition-colors duration-700",
          isDark
            ? "bg-gradient-to-b from-black/50 via-emerald-900/40 to-emerald-950/60"
            : "bg-gradient-to-b from-emerald-700/40 via-transparent to-emerald-900/35",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(32,201,151,0.3)_0%,rgba(3,20,13,0)_70%)] mix-blend-screen" />
      </div>
      <div
        className="absolute inset-0 -z-20 opacity-[0.08] mix-blend-soft-light"
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
      <div className="accent-divider absolute inset-x-0 bottom-0 -z-10 h-px" aria-hidden="true" />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="border-b border-surface-50/10">
          <div className={`${containerClass} flex items-center justify-between gap-4 py-4 sm:py-6`}>
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
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <div role="radiogroup" aria-label="Color theme" className={toggleGroupClass}>
                {themeOptions.map(({ value, label, icon: Icon }, index) => {
                  const isActive = theme === value;
                  const optionClass = getOptionClass(isActive);

                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setTheme(value)}
                      onKeyDown={(event) => handleThemeKeyDown(event, index)}
                      className={optionClass}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              {user ? (
                <SecondaryButton icon={LogOut} onClick={signOut}>
                  Sign Out
                </SecondaryButton>
              ) : (
                <PrimaryButton
                  icon={LogIn}
                  onClick={signInWithGoogle}
                  className="from-primary-600 via-primary-600 to-primary-700 shadow-lg"
                >
                  Sign In
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${containerClass} grid flex-1 items-center gap-10 pb-16 pt-10 sm:gap-12 sm:pt-14 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-16`}
        >
          <div className="space-y-6 sm:space-y-7">
            <span
              tabIndex={0}
              className="badge-gold-shimmer inline-flex items-center gap-2 self-center rounded-full border border-surface-50/35 bg-surface-900/60 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-shadow-hero sm:self-start"
            >
              Designed for Saudi ambition
            </span>
            <div className="relative max-w-2xl rounded-[var(--radius-card)] bg-surface-900/55 p-6 backdrop-blur-2xl shadow-[0_32px_90px_-40px_rgba(0,0,0,0.6)] sm:p-7 lg:p-8">
              <span
                aria-hidden="true"
                className="absolute -top-8 left-6 text-accent-400 drop-shadow-[0_0_18px_rgba(197,166,106,0.45)]"
              >
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="text-balance text-shadow-hero text-4xl font-bold leading-tight tracking-tight drop-shadow-[0_16px_34px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
                AI Resume Optimizer
              </h1>
              <p className="text-balance text-pretty text-shadow-hero mt-4 max-w-xl text-base leading-relaxed text-surface-50/95 sm:text-lg">
                Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div className="card-glow group rounded-2xl border border-surface-50/20 bg-sand-50/95 p-4 text-ink-700 shadow-sm backdrop-blur-sm sm:backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-sand-50 hover:shadow-md dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50 dark:hover:bg-zinc-900/70">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Smart Parsing</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Clean resume text</dd>
              </div>
              <div className="card-glow group rounded-2xl border border-surface-50/20 bg-sand-50/95 p-4 text-ink-700 shadow-sm backdrop-blur-sm sm:backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-sand-50 hover:shadow-md dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50 dark:hover:bg-zinc-900/70">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Match Score</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Saudi market fit</dd>
              </div>
              <div className="card-glow group rounded-2xl border border-surface-50/20 bg-sand-50/95 p-4 text-ink-700 shadow-sm backdrop-blur-sm sm:backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-sand-50 hover:shadow-md dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50 dark:hover:bg-zinc-900/70">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Polished Output</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div className="card-glow group rounded-[var(--radius-card)] border border-surface-50/20 bg-sand-50/95 p-6 text-ink-700 shadow-md backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-sand-50 hover:shadow-lg sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50 dark:hover:bg-zinc-900/70">
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
                  <p className="text-xs text-ink-500 dark:text-surface-50/70">Get a confidence score, missing keywords, and guidance.</p>
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
