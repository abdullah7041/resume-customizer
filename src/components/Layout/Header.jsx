import { useCallback } from "react";
import { FileText, LogIn, LogOut, Sparkles, Target } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";
import SecondaryButton from "../ui/SecondaryButton";
import { useAuth } from "../../hooks/useAuth";

const saduPattern = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" fill="none"><path d="M0 140h280" stroke="white" stroke-opacity="0.05"/><path d="M140 0v280" stroke="white" stroke-opacity="0.05"/><path d="M0 0l140 140L0 280" stroke="white" stroke-opacity="0.04"/><path d="M280 0L140 140l140 140" stroke="white" stroke-opacity="0.04"/><rect x="122" y="122" width="36" height="36" fill="white" fill-opacity="0.03"/><path d="M0 70h70L0 0z" fill="white" fill-opacity="0.02"/><path d="M280 70h-70L280 0z" fill="white" fill-opacity="0.02"/><path d="M0 210h70l-70 70z" fill="white" fill-opacity="0.02"/><path d="M280 210h-70l70 70z" fill="white" fill-opacity="0.02"/></svg>'
);

export default function Header() {
  const { user, signInWithGoogle, signOut } = useAuth();

  const scrollToMain = useCallback(() => {
    if (typeof document === "undefined") return;
    const target = document.querySelector('[data-app-main]');
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (

    <header className="relative isolate overflow-hidden text-surface-50">
      <div
        className="absolute inset-0 -z-20"
        style={{ backgroundImage: "var(--gradient-primary)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{ backgroundImage: `url("data:image/svg+xml,${saduPattern}")`, backgroundSize: "260px" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-accent-500/60 to-transparent" />

      <div className="relative z-10">
        <div className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-accent-500 shadow-soft">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-accent-400/90">
                  AI Resume Optimizer
                </p>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-surface-50/90">
                  Saudi Edition
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

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-surface-50/85">
              Designed for Riyadh ambition
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
              Transform your experience into a Riyadh-ready story. Our AI analyzes, matches, and optimizes your resume with a Saudi financial-tech lens—without sacrificing authenticity.
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
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-surface-50/70">Smart Parsing</dt>
                <dd className="mt-2 text-lg font-semibold">Clean resume text</dd>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-surface-50/70">Match Score</dt>
                <dd className="mt-2 text-lg font-semibold">Saudi market fit</dd>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-surface-50/70">Polished Output</dt>
                <dd className="mt-2 text-lg font-semibold">Optimized insights</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[var(--radius-card)] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl">
            <h2 className="text-lg font-semibold tracking-wide text-surface-50">Your Saudi-ready workflow</h2>
            <ul className="mt-6 space-y-5 text-sm text-surface-50/85">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-surface-50">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">Upload or paste your resume</p>
                  <p className="text-xs text-surface-50/70">Glassmorphic card with drag & drop, paste, and progress tracking.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-surface-50">
                  <Target className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">Match against Saudi job roles</p>
                  <p className="text-xs text-surface-50/70">Get a confidence score, missing keywords, and Riyadh-specific guidance.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-surface-50">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">Optimize with precision</p>
                  <p className="text-xs text-surface-50/70">Premium suggestions styled for modern Saudi employers.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
