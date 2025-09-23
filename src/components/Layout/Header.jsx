import { useCallback } from "react";
import { FileText, LogIn, LogOut, Moon, Sparkles, Sun, Target } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import SecondaryButton from "../ui/SecondaryButton";
import { cn } from "../../lib/cn";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";

const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.03"/><path d="M140 0v280" stroke="white" stroke-opacity="0.03"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.024"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.024"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.024"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { theme, isDark, setTheme } = useTheme();

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
    <header className="hero-bg-animate relative isolate flex flex-col justify-between gap-12 text-surface-50 min-h-[100svh] md:min-h-[100dvh] pb-16 sm:pb-24">
      <div aria-hidden="true" className="absolute inset-0 -z-40">
        <div className="absolute inset-0 bg-gradient-to-b from-[#04160d]/92 via-[#063220]/88 to-[#03140d]/94" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(11,107,58,0.4)_0%,rgba(3,20,13,0)_65%)]" />
      </div>
      <div
        className="absolute inset-0 -z-30 opacity-[0.05]"
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
              <div
                role="radiogroup"
                aria-label="Color theme"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-md transition-colors",
                  isDark
                    ? "border-surface-50/25 bg-surface-900/70 text-surface-50/80 shadow-[0_22px_48px_-32px_rgba(2,12,8,0.65)]"
                    : "border-surface-900/10 bg-surface-50/95 text-ink-600 shadow-[0_20px_52px_-28px_rgba(11,107,58,0.45)]"
                )}
              >
                {themeOptions.map(({ value, label, icon: Icon }, index) => {
                  const isActive = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setTheme(value)}
                      onKeyDown={(event) => handleThemeKeyDown(event, index)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/80 focus-visible:ring-offset-2",
                        isActive
                          ? isDark
                            ? "bg-surface-900 text-surface-50 shadow-[0_20px_44px_-28px_rgba(0,0,0,0.7)] focus-visible:ring-offset-surface-900"
                            : "bg-surface-50 text-ink-900 shadow-[0_18px_40px_-28px_rgba(11,107,58,0.45)] focus-visible:ring-offset-sand-50"
                          : isDark
                            ? "text-surface-50/70 hover:text-surface-50 focus-visible:ring-offset-surface-900"
                            : "text-ink-500 hover:text-ink-700 focus-visible:ring-offset-sand-50"
                      )}
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

        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-16 pt-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <span
              tabIndex={0}
              className="badge-gold-shimmer inline-flex items-center gap-2 rounded-full border border-surface-50/35 bg-surface-900/55 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-shadow-hero"
            >
              Designed for Saudi ambition
            </span>
            <div className="relative max-w-2xl rounded-[var(--radius-card)] bg-surface-900/45 p-6 backdrop-blur-lg shadow-[0_32px_90px_-40px_rgba(0,0,0,0.55)]">
              <span
                aria-hidden="true"
                className="absolute -top-8 left-6 text-accent-400 drop-shadow-[0_0_18px_rgba(197,166,106,0.45)]"
              >
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="text-shadow-hero text-4xl font-bold leading-tight tracking-tight drop-shadow-[0_14px_32px_rgba(0,0,0,0.55)] sm:text-5xl">
                AI Resume Optimizer
              </h1>
              <p className="text-shadow-hero mt-4 max-w-xl text-base leading-relaxed text-surface-50/90">
                Transform your experience into a story. Our AI analyzes, matches, and optimizes your resume.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div className="card-glow group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Smart Parsing</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Clean resume text</dd>
              </div>
              <div className="card-glow group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Match Score</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Saudi market fit</dd>
              </div>
              <div className="card-glow group rounded-2xl border border-surface-50/25 bg-surface-50/85 p-4 text-ink-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-md dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-500 dark:text-surface-50/70">Polished Output</dt>
                <dd className="mt-2 text-lg font-semibold text-ink-900 dark:text-surface-50">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div className="card-glow group rounded-[var(--radius-card)] border border-surface-50/25 bg-surface-50/85 p-6 text-ink-700 shadow-md backdrop-blur-sm transition-all duration-200 ease-out hover:bg-surface-50/90 hover:shadow-lg dark:border-surface-50/10 dark:bg-surface-900/70 dark:text-surface-50 dark:hover:bg-surface-900/75">
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
