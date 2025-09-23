import { useCallback, useEffect, useState } from "react";
import { FileText, LogIn, LogOut, Moon, Sparkles, Sun, Target } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import SecondaryButton from "../ui/SecondaryButton";
import { useAuth } from "../../hooks/useAuth";
import { skyline } from "../../lib/assets";



const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.03"/><path d="M140 0v280" stroke="white" stroke-opacity="0.03"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.024"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.024"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.024"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

const THEME_STORAGE_KEY = "airo:theme";

const resolvePreferredTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const skylineUrl = skyline();
  const hasSkyline = typeof skylineUrl === "string" && skylineUrl.trim().length > 0 && !skylineUrl.includes("undefined");
  const [isDark, setIsDark] = useState(false);

  const applyTheme = useCallback((nextIsDark) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", nextIsDark);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
    }
    setIsDark(nextIsDark);
  }, []);

  useEffect(() => {
    const preferred = resolvePreferredTheme() === "dark";
    applyTheme(preferred);

    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") return;
      applyTheme(event.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme]);

  const scrollToMain = useCallback(() => {
    if (typeof document === "undefined") return;
    const target = document.querySelector('[data-app-main]');
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(!isDark);
  }, [applyTheme, isDark]);

  const backgroundImage = hasSkyline
    ? `linear-gradient(135deg, rgba(11,107,58,0.86) 0%, rgba(20,99,86,0.82) 55%, rgba(12,83,53,0.86) 100%), url('${skylineUrl}')`
    : "linear-gradient(135deg, rgba(11,107,58,0.86) 0%, rgba(20,99,86,0.82) 55%, rgba(12,83,53,0.86) 100%)";

  return (
    <header
      className="hero-bg-animate relative isolate min-h-[100svh] text-surface-50"
      style={{
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="absolute inset-0 -z-20 opacity-[0.05]"
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
      <div className="accent-divider absolute inset-x-0 bottom-0 -z-10 h-px" aria-hidden="true" />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="border-b border-surface-50/10">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
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
              <button
                type="button"
                onClick={toggleTheme}
                aria-pressed={isDark}
                className="inline-flex items-center gap-2 rounded-full border border-surface-50/40 bg-surface-50/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-surface-50 transition-colors hover:bg-surface-50/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-surface-50/15 dark:bg-surface-900/50 dark:text-surface-50 dark:hover:bg-surface-900/60 dark:focus-visible:ring-accent-400/70"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isDark ? "Light" : "Dark"}</span>
                <span className="sr-only">Toggle color theme</span>
              </button>
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

        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-16 pt-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
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
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton
                  onClick={user ? scrollToMain : signInWithGoogle}
                  icon={user ? undefined : LogIn}
                >
                  Continue optimizing
                </PrimaryButton>
              </div>
              <button
                type="button"
                onClick={scrollToMain}
                className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent-400 transition-colors hover:text-accent-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B6B3A] dark:focus-visible:ring-offset-[#0a3f26]"
              >
                <span>See the workflow</span>
              </button>
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