import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Info, Loader2, Sparkles, CheckCircle2, Target, Zap, Wrench } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import AnimatedCard from "../components/ui/AnimatedCard.jsx";
import { AnimatedCounter } from "../components/ui/AnimatedCounter.jsx";
import Input from "../components/ui/Input.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";


const resolveVariant = (score) => {
    if (score >= 70) {
        return {
            gradient: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
            glow: "bg-emerald-500/20",
            strokeStart: "#10B981", // Emerald-500
            strokeEnd: "#34D399",   // Emerald-400
            label: "Strong Match",
            icon: Target,
            text: "text-emerald-400"
        };
    }
    if (score >= 40) {
        return {
            gradient: "from-amber-500/20 via-amber-500/10 to-amber-500/5",
            glow: "bg-amber-500/20",
            strokeStart: "#F59E0B", // Amber-500
            strokeEnd: "#FBBF24",   // Amber-400
            label: "Good Start",
            icon: Zap,
            text: "text-amber-400"
        };
    }
    return {
        gradient: "from-rose-500/20 via-rose-500/10 to-rose-500/5",
        glow: "bg-rose-500/20",
        strokeStart: "#F43F5E", // Rose-500
        strokeEnd: "#FB7185",   // Rose-400
        label: "Needs Work",
        icon: Wrench,
        text: "text-rose-400"
    };
};



const LAST_JOB_KEY = "airo:lastJobDescription";
const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function JobMatch({
    onAnalyzeMatchAI,
    matchAnalysis,
    isAnalyzing = false,
    hasResume = false,
    onToast,
    onClear,
}) {
    const [jobText, setJobText] = useState(() => {
        if (typeof window === "undefined") {
            return "";
        }
        return window.localStorage.getItem(LAST_JOB_KEY) ?? "";
    });
    const [error, setError] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (jobText && jobText.trim().length > 0) {
            window.localStorage.setItem(LAST_JOB_KEY, jobText);
        } else {
            window.localStorage.removeItem(LAST_JOB_KEY);
        }
    }, [jobText]);

    const notify = onToast ?? null;

    const handleAnalyze = async () => {
        const trimmedJob = jobText.trim();
        if (!trimmedJob) {
            const message = "Paste the job description before analyzing.";
            setError(message);
            notify?.({
                type: "warning",
                title: "Job description needed",
                description: "Paste the job description before analyzing the match.",
            });
            return;
        }
        setError("");
        try {
            await onAnalyzeMatchAI(trimmedJob);
        } catch (err) {
            setError(err?.message || "We could not analyze this match.");
        }
    };

    const hasResults = Boolean(matchAnalysis);
    const rawScore = Number.isFinite(matchAnalysis?.score) ? matchAnalysis.score : null;
    const score = rawScore != null ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
    const variant = resolveVariant(score ?? 0);
    const progress = score == null ? 0 : Math.max(0, Math.min(100, score));
    const ringOffset = useMemo(
        () => RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE,
        [progress],
    );
    const missing = matchAnalysis?.missingKeywords?.slice(0, 6) ?? [];
    const hits = matchAnalysis?.topHits?.slice(0, 6) ?? [];
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);
    const [whyOpen, setWhyOpen] = useState(false);

    const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
    const disabledHint = !hasResume
        ? "Upload or paste your resume first."
        : !jobText.trim()
            ? "Paste a job description to continue."
            : "";

    useEffect(() => {
        if (!whyOpen) return undefined;
        const handleClick = (event) => {
            if (
                !popoverRef.current?.contains(event.target) &&
                !buttonRef.current?.contains(event.target)
            ) {
                setWhyOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [whyOpen]);

    return (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-6">
                <SectionTitle
                    eyebrow="Step 2"
                    title="Match a role"
                    description="Paste the job description to uncover keyword gaps and alignment opportunities."
                    action={
                        jobText ? (
                            <button
                                onClick={() => {
                                    setJobText("");
                                    onClear?.();
                                }}
                                className="text-xs font-medium text-ink-500 hover:text-danger-500 transition-colors"
                            >
                                Clear
                            </button>
                        ) : null
                    }
                />
                <Input
                    multiline
                    label="Job description"
                    placeholder="Paste the job description here"
                    value={jobText}
                    onChange={(event) => setJobText(event.target.value)}
                    inputClassName="min-h-[220px]"
                    error={Boolean(error)}
                />
                {error && (
                    <p className="flex items-center gap-2 text-sm font-medium text-danger-500" role="alert">
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        {error}
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <Button
                        onClick={handleAnalyze}
                        loading={isAnalyzing}
                        disabled={buttonDisabled}
                        icon={Sparkles}
                        className="justify-center sm:justify-start"
                    >
                        Analyze Match with AI
                    </Button>
                    {disabledHint && (
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">
                            {disabledHint}
                        </p>
                    )}
                    {!disabledHint && (
                        <p className="text-xs text-ink-500/70 dark:text-surface-50/60">
                            AI provides intelligent insights with deeper analysis of your resume match
                        </p>
                    )}
                </div>
            </div>

            <AnimatedCard
                as="aside"
                tone="translucent"
                className="space-y-5"
                contentClassName="space-y-5 text-ink"
                enableTilt={false}
                tiltIntensity={15}
            >
                {isAnalyzing ? (
                    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-ink-500/80 dark:text-surface-50/70">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" aria-hidden="true" />
                        <p>Analyzing text similarities…</p>
                    </div>
                ) : hasResults ? (
                    <div className="space-y-5">
                        <div className="relative rounded-[var(--radius-card)] shadow-soft group">
                            {/* Background Layer with Clipping */}
                            <div className={`absolute inset-0 overflow-hidden rounded-[inherit] bg-gradient-to-br ${variant.gradient}`}>
                                <div className={`absolute inset-0 opacity-40 blur-3xl ${variant.glow}`} aria-hidden="true" />
                            </div>

                            {/* Content Layer */}
                            <div className="relative z-10 p-6 text-surface-50">
                                <div className="flex flex-col items-center gap-6">
                                    <div className="grid place-items-center">
                                        <div className="relative h-32 w-32">
                                            {/* Outer Glow */}
                                            <div className={`absolute inset-0 rounded-full blur-2xl opacity-40 ${variant.glow}`} aria-hidden="true" />

                                            {/* Background Ring */}
                                            <svg
                                                className="absolute inset-0 h-full w-full rotate-[-90deg]"
                                                viewBox="0 0 120 120"
                                                aria-hidden="true"
                                            >
                                                <defs>
                                                    <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor={variant.strokeStart} />
                                                        <stop offset="100%" stopColor={variant.strokeEnd} />
                                                    </linearGradient>
                                                    <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                                        <feMerge>
                                                            <feMergeNode in="coloredBlur" />
                                                            <feMergeNode in="SourceGraphic" />
                                                        </feMerge>
                                                    </filter>
                                                </defs>
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r={RING_RADIUS}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    className="text-white/10"
                                                />
                                                {/* Progress Ring */}
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r={RING_RADIUS}
                                                    fill="none"
                                                    stroke="url(#score-gradient)"
                                                    strokeWidth="12"
                                                    strokeLinecap="round"
                                                    strokeDasharray={RING_CIRCUMFERENCE}
                                                    strokeDashoffset={ringOffset}
                                                    filter="url(#glow-shadow)"
                                                    className="transition-[stroke-dashoffset] duration-1000 ease-out drop-shadow-[0_0_4px_rgba(0,0,0,0.3)]"
                                                />
                                            </svg>

                                            {/* Inner Content */}
                                            <div
                                                className="absolute inset-4 grid place-items-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-inner"
                                            >
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <variant.icon className="w-6 h-6 mb-1 text-white/90 drop-shadow-md animate-in zoom-in duration-500" />
                                                    <Tooltip
                                                        content={`${score != null ? score : 0}/100 - ${variant.label} match with job requirements`}
                                                        position="bottom"
                                                    >
                                                        <div className="flex items-baseline justify-center gap-0.5 cursor-help">
                                                            {score != null ? (
                                                                <AnimatedCounter
                                                                    to={score}
                                                                    duration={1500}
                                                                    className="text-5xl font-black tracking-tight leading-none text-white drop-shadow-lg"
                                                                />
                                                            ) : (
                                                                <span className="text-5xl font-black tracking-tight leading-none text-white/50">—</span>
                                                            )}
                                                            {score != null && (
                                                                <span className="text-[10px] font-bold text-white/70 leading-none">/100</span>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                                                        Score
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-center">
                                        <div>
                                            <p className={`text-sm font-bold uppercase tracking-[0.32em] ${variant.text}`}>
                                                {variant.label}
                                            </p>
                                            <p className="mt-1 text-sm leading-relaxed text-surface-50/80">
                                                {matchAnalysis?.reasoning
                                                    ? matchAnalysis.reasoning
                                                    : score >= 80
                                                        ? "Your profile is highly aligned with this role. Focus on highlighting your specific achievements."
                                                        : score >= 60
                                                            ? "You have a solid foundation. Addressing a few key gaps could significantly boost your chances."
                                                            : "There are significant gaps between your resume and the job requirements. Consider tailoring your experience."
                                                }
                                            </p>
                                        </div>

                                        <div>
                                            <button
                                                ref={buttonRef}
                                                type="button"
                                                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-white/20 hover:border-white/40 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                                onClick={() => setWhyOpen((prev) => !prev)}
                                                aria-expanded={whyOpen}
                                                aria-controls="match-why-popover"
                                            >
                                                <Info className="h-3.5 w-3.5" aria-hidden="true" /> Score Breakdown
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Popover - Card Level */}
                            {whyOpen && (
                                <div
                                    ref={popoverRef}
                                    id="match-why-popover"
                                    role="dialog"
                                    className="absolute left-0 right-0 top-full z-50 mt-2 mx-4 rounded-2xl border border-white/20 bg-slate-900/95 p-5 text-left text-sm text-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200"
                                >
                                    <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70 mb-2">How It Works</p>
                                        <p className="text-sm leading-relaxed text-white/90">
                                            <strong>Coverage</strong> measures what percentage of key job requirements appear in your resume.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {missing.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
                                    <AlertCircle className="h-4 w-4" />
                                    Missing Keywords
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {missing.map((keyword) => (
                                        <span
                                            key={keyword}
                                            className="group relative inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-300 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-300 hover:shadow-md hover:-translate-y-0.5 cursor-help"
                                            title="Add this keyword to your resume"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hits.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Recognized Strengths
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {hits.map((keyword) => (
                                        <span
                                            key={keyword}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300 shadow-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:shadow-md hover:-translate-y-0.5"
                                        >
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {matchAnalysis?.suggestions?.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">
                                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                                    Suggestions
                                </h3>
                                <ul className="space-y-2 text-sm leading-relaxed text-ink">
                                    {matchAnalysis.suggestions.map((suggestion, index) => (
                                        <li
                                            key={index}
                                            className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_15%)] px-4 py-3 shadow-soft backdrop-blur-soft"
                                        >
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-ink-500/80 dark:text-surface-50/70">
                        <Sparkles className="h-6 w-6 text-emerald-500" aria-hidden="true" />
                        <p>Paste a job description to see match insights here.</p>
                    </div>
                )}
            </AnimatedCard>
        </div >
    );
}



