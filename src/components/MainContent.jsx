import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, Sparkles, Target, UserPlus, LogIn } from "lucide-react";
import {
  parseResume,
  analyzeResume,
  optimizeResume,
  AI_DEFAULT_TEMPERATURE,
} from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ResumeUpload from "../features/ResumeUpload.jsx";
import JobMatch from "./Features/JobMatch.jsx";
import Optimization from "../features/Optimization.jsx";
import Tabs from "./ui/Tabs.jsx";
import Toast, { ToastContainer } from "./ui/Toast.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import Button from "./ui/Button.jsx";
import { exportResumeToPdf } from "../services/exportPdf.js";

const tabs = [
  { value: "resume", label: "Resume", icon: FileText },
  { value: "match", label: "Match", icon: Target },
  { value: "optimize", label: "Optimize", icon: Sparkles },
];

const containerClass = "app-shell w-full";

const TOAST_IDS = {
  upload: "toast:upload",
  match: "toast:match",
  optimize: "toast:optimize",
};
const TAB_STORAGE_KEY = "airo:lastActiveTab";
const withTemperature = (message) => `${message} • Temp ${AI_DEFAULT_TEMPERATURE}`;

const getId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const scheduleTimeout = (callback, delay) => {
  const host = typeof window !== "undefined" ? window : globalThis;
  return host.setTimeout(callback, delay);
};

export default function MainContent() {
  const { user, loading, signInWithGoogle } = useAuth();
  const isPremium = Boolean(
    user?.user_metadata?.is_premium ||
      user?.user_metadata?.tier === "premium" ||
      user?.app_metadata?.plan === "premium"
  );

  const [activeTab, setActiveTab] = useState("resume");
  const [flowProgress, setFlowProgress] = useState(0);
  const [resumeData, setResumeData] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [matchAnalysis, setMatchAnalysis] = useState(null);
  const [optimizations, setOptimizations] = useState([]);
  const [optimizationKeywords, setOptimizationKeywords] = useState({ add: [], remove: [], neutral: [] });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewUsed, setPreviewUsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [aiDebug, setAiDebug] = useState(null);
  const toastTimers = useRef(new Map());
  const isDev = import.meta.env.MODE === "development";

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) {
      const host = typeof window !== "undefined" ? window : globalThis;
      host.clearTimeout?.(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (toast, options = {}) => {
      const { toastId, ...toastPayload } = toast ?? {};
      const id = options.id ?? toastId ?? getId();
      setToasts([{ id, ...toastPayload }]);
      const lifetime = toast?.type === "danger" ? 6000 : 4200;
      const host = typeof window !== "undefined" ? window : globalThis;
      const existing = toastTimers.current.get(id);
      if (existing) {
        host.clearTimeout?.(existing);
      }
      const timer = scheduleTimeout(() => dismissToast(id), lifetime);
      toastTimers.current.set(id, timer);
      return id;
    },
    [dismissToast]
  );

  const handleUploadToast = useCallback(
    (toast) => pushToast(toast, { id: TOAST_IDS.upload }),
    [pushToast]
  );

  useEffect(() => {
    const host = typeof window !== "undefined" ? window : globalThis;
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => {
        host.clearTimeout?.(timer);
      });
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (storedTab && tabs.some((tab) => tab.value === storedTab)) {
      setActiveTab(storedTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPreviewUsed(window.localStorage.getItem("airo:previewQuotaUsed") === "true");
  }, []);

  const handleTabChange = useCallback((value) => {
    setActiveTab(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, value);
    }
  }, []);

  const hasNextTab = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    return index >= 0 && index < tabs.length - 1;
  }, [activeTab]);

  const handleContinue = useCallback(() => {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    if (index >= 0 && index < tabs.length - 1) {
      handleTabChange(tabs[index + 1].value);
    }
  }, [activeTab, handleTabChange]);

  const persistPreviewUsage = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("airo:previewQuotaUsed", "true");
    setPreviewUsed(true);
  }, []);

  const normalizeResumePayload = useCallback((input) => {
    if (input && typeof input === "object") {
      if (input.kind === "upload") {
        const { file, storage } = input;
        return {
          parseInput: file,
          storage: storage && typeof storage === "object" ? storage : null,
        };
      }

      if (input.kind === "text") {
        return {
          parseInput: input.value,
          storage: null,
        };
      }
    }

    return { parseInput: input, storage: null };
  }, []);

  const handleParseResume = useCallback(
    async (resumeInput) => {
      const { parseInput, storage } = normalizeResumePayload(resumeInput);
      try {
        setFlowProgress(18);
        pushToast(
          {
            type: "info",
            title: "Parsing resume",
            description: "AI is structuring your experience for analysis.",
          },
          { id: TOAST_IDS.upload }
        );

        setFlowProgress(48);
        const parsed = await parseResume(parseInput);
        setFlowProgress(88);
        const enriched =
          parsed && storage
            ? {
                ...parsed,
                storagePath: storage.path,
                storageBucket: storage.bucket,
                storageFileName: storage.fileName,
                storageUserId: storage.userId,
              }
            : parsed;
        setResumeData(enriched);
        setMatchAnalysis(null);
        setJobDescription("");
        setOptimizations([]);
        setOptimizationKeywords({ add: [], remove: [], neutral: [] });
        pushToast(
          {
            type: "success",
            title: "Resume parsed",
            description: "Use Continue to compare with a job description.",
          },
          { id: TOAST_IDS.upload }
        );
        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 800);
        return enriched;
      } catch (error) {
        setFlowProgress(0);
        pushToast(
          {
            type: "danger",
            title: "Parsing failed",
            description: (error?.message || "Please try again with a different file.") +
              " • Save your text before retrying.",
          },
          { id: TOAST_IDS.upload }
        );
        throw error;
      }
    },
    [normalizeResumePayload, pushToast]
  );

  const handleAnalyzeMatch = useCallback(
    async (jobDescriptionInput) => {
      if (!resumeData?.plainText) {
        const error = new Error("Please upload or paste a resume first.");
        pushToast({
          type: "warning",
          title: "Resume required",
          description: "Upload your resume before running a job match.",
        });
        throw error;
      }

      try {
        setIsAnalyzing(true);
        setFlowProgress(22);
        pushToast(
          {
            type: "info",
            title: "Analyzing match",
            description: withTemperature("Comparing your resume to the description…"),
          },
          { id: TOAST_IDS.match }
        );
        const trimmedJob = jobDescriptionInput.trim();
        const result = await analyzeResume(resumeData, trimmedJob);
        setMatchAnalysis(result);
        setJobDescription(trimmedJob);
        pushToast(
          {
            type: "success",
            title: "Match insights ready",
            description: withTemperature("Use Continue to generate optimization guidance."),
          },
          { id: TOAST_IDS.match }
        );
        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 800);
        return result;
      } catch (error) {
        setFlowProgress(0);
        pushToast(
          {
            type: "danger",
            title: "Match analysis failed",
            description: withTemperature(
              (error?.message || "Please try again in a moment.") +
                " • Copy your inputs before retrying."
            ),
          },
          { id: TOAST_IDS.match }
        );
        throw error;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [pushToast, resumeData]
  );

  const handleOptimize = useCallback(
    async (mode) => {
      if (!resumeData?.plainText || !jobDescription) {
        pushToast({
          type: "warning",
          title: "Add job context",
          description: "Run a match analysis before requesting optimizations.",
        });
        return null;
      }

      try {
        setIsOptimizing(true);
        setFlowProgress(32);
        pushToast(
          {
            type: "info",
            title: "Generating optimizations",
            description: withTemperature("Drafting tailored rewrite suggestions…"),
          },
          { id: TOAST_IDS.optimize }
        );

        const result = await optimizeResume(
          {
            resumeText: resumeData.plainText,
            jobDesc: jobDescription,
            mode,
            preview: !isPremium,
          },
          {
            onDebug: setAiDebug,
            onError: (error) => {
              const status = typeof error?.status === "number" ? error.status : null;
              const code = typeof error?.code === "string" && error.code.trim().length > 0 ? error.code : null;
              const details = [
                status ? `Status ${status}` : null,
                code ? `Code ${code}` : null,
              ].filter(Boolean);
              const descriptionParts = [
                error?.message || "Please try again shortly.",
                ...details,
                "Save your best bullets before retrying.",
              ];
              pushToast(
                {
                  type: "danger",
                  title: "Optimization failed",
                  description: descriptionParts.filter(Boolean).join(" • "),
                },
                { id: TOAST_IDS.optimize }
              );
            },
          }
        );

        setOptimizations(result.cards ?? []);
        setOptimizationKeywords(result.keywords ?? { add: [], remove: [], neutral: [] });
        pushToast(
          {
            type: "success",
            title: "Optimization ready",
            description:
              result.source === "openai"
                ? "Review AI-crafted rewrites and keywords."
                : "Preview mode generated realistic guidance.",
          },
          { id: TOAST_IDS.optimize }
        );

        if (!isPremium && !previewUsed) {
          persistPreviewUsage();
        }

        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 900);
        return result;
      } catch (error) {
        setFlowProgress(0);
        throw error;
      } finally {
        setIsOptimizing(false);
      }
    },
    [isPremium, jobDescription, persistPreviewUsage, previewUsed, pushToast, resumeData]
  );

  const handleCopy = useCallback(
    async (value) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        }
        pushToast({
          type: "success",
          title: "Copied to clipboard",
          description: "Optimized bullet ready to paste into your resume.",
        });
      } catch (error) {
        pushToast({
          type: "danger",
          title: "Copy failed",
          description: error?.message || "Select the text manually to copy.",
        });
      }
    },
    [pushToast]
  );

  const handleUpgrade = useCallback(() => {
    pushToast({
      type: "info",
      title: "Unlock premium insights",
      description: "Upgrade from your dashboard to save and export optimized results.",
    });
  }, [pushToast]);

  const handleExportPdf = useCallback(
    async (variant) => {
      if (!resumeData?.plainText) {
        pushToast({
          type: "warning",
          title: "Add your resume",
          description: "Upload or paste your resume before exporting.",
        });
        return;
      }

      const normalizedVariant = variant === "ats-plain" ? "ats-plain" : "styled";

      try {
        await exportResumeToPdf({
          resumeDocument: resumeData,
          jobDescription,
          matchAnalysis,
          optimizations,
          keywords: optimizationKeywords,
          variant: normalizedVariant,
        });
        pushToast({
          type: "success",
          title: "Export successful",
          description: "Your resume PDF has been downloaded.",
        });
      } catch (error) {
        pushToast({
          type: "danger",
          title: "Export failed",
          description: error?.message || "Unable to generate PDF. Please try again.",
        });
      }
    },
    [jobDescription, matchAnalysis, optimizations, optimizationKeywords, pushToast, resumeData]
  );

  const renderedToasts = useMemo(
    () =>
      toasts.map((toast) => (
        <Toast
          key={toast.id}
          title={toast.title}
          description={toast.description}
          type={toast.type}
          onDismiss={() => dismissToast(toast.id)}
        />
      )),
    [dismissToast, toasts]
  );

  const workspace = (
    <div className="space-y-5 sm:space-y-7 text-ink-700 dark:text-surface-50">
      <Tabs tabs={tabs} activeValue={activeTab} onTabChange={handleTabChange} />
      <div className="accent-divider mx-auto my-2 h-px w-full opacity-80" aria-hidden="true" />
      <div className="relative min-h-[420px] sm:min-h-[480px] rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_12%)] p-5 sm:p-6 lg:p-7 shadow-card backdrop-blur-glass transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_22px_65px_-40px_rgba(15,15,18,0.55)]">
        {activeTab === "resume" && (
          <ResumeUpload
            onParseResume={handleParseResume}
            resumeDocument={resumeData}
            onToast={handleUploadToast}
          />
        )}
        {activeTab === "match" && (
          <JobMatch
            onAnalyzeMatch={handleAnalyzeMatch}
            matchAnalysis={matchAnalysis}
            isAnalyzing={isAnalyzing}
            hasResume={Boolean(resumeData?.plainText)}
            onToast={pushToast}
          />
        )}
        {activeTab === "optimize" && (
          <Optimization
            isPremium={isPremium}
            optimizations={optimizations}
            keywords={optimizationKeywords}
            isOptimizing={isOptimizing}
            onOptimize={handleOptimize}
            onCopy={handleCopy}
            previewUsed={previewUsed}
            onUpgrade={handleUpgrade}
            onExport={handleExportPdf}
            canExport={Boolean(resumeData?.plainText)}
          />
        )}
      </div>
      {hasNextTab && (
        <div className="flex justify-center sm:justify-end">
          <Button variant="secondary" icon={ArrowRight} onClick={handleContinue} className="justify-center">
            Continue
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <main
      data-app-main
      className="relative isolate z-20 min-h-screen pb-16 sm:pb-24 lg:pb-32 -mt-32 sm:-mt-30 lg:-mt-30"
    >
      <ToastContainer>{renderedToasts}</ToastContainer>
      <div className={`${containerClass} space-y-6 sm:space-y-10 lg:space-y-12 text-ink-700 dark:text-surface-50`}>
        <div className="card-glow rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_12%)] p-5 sm:p-7 lg:p-8 shadow-card backdrop-blur-glass transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_24px_70px_-42px_rgba(15,15,18,0.58)]">
          {flowProgress > 0 && (
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-smoke-50/70 dark:bg-zinc-900/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 transition-all duration-300"
                style={{ width: `${flowProgress}%` }}
                aria-hidden="true"
              />
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="h-8 w-40 rounded-full bg-smoke-50/70" />
              <div className="h-96 w-full overflow-hidden rounded-[var(--radius-card)] bg-smoke-50/60">
                <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-surface-50/40 to-transparent" />
              </div>
            </div>
          ) : user ? (
            workspace
          ) : (
              <EmptyState
                icon={UserPlus}
                title="Sign in to unlock Saudi-ready insights"
                description="Connect your account to securely upload resumes, run match analysis, and save optimization drafts."
                actions={
                <Button
                  variant="frosted"
                  icon={LogIn}
                  onClick={signInWithGoogle}
                  className="justify-center text-[15px] font-semibold"
                >
                  Sign in via Google
                </Button>
                }
              />
            )}
        </div>
        {isDev && aiDebug && (
          <section className="text-xs text-ink-500 dark:text-surface-50/70">
            <div className="rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_12%)] p-4 shadow-soft backdrop-blur-glass sm:p-5">
              <p className="font-semibold uppercase tracking-[0.24em] text-emerald-500">AI Debug</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-7">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Status</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">{aiDebug.status}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Model</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">{aiDebug.model ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">
                    Temperature
                  </dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">
                    {typeof aiDebug.temperature === "number"
                      ? Number.isInteger(aiDebug.temperature)
                        ? aiDebug.temperature
                        : aiDebug.temperature.toFixed(2)
                      : aiDebug.temperature ?? "–"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Tokens</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">
                    {aiDebug.tokens ?? "–"}
                    {aiDebug.maxOutputTokens ? ` / ${aiDebug.maxOutputTokens}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Latency</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">
                    {aiDebug.latencyMs ? `${Math.round(aiDebug.latencyMs)} ms` : "–"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Status Code</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">{aiDebug.statusCode ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-ink-500/70 dark:text-surface-50/60">Error Code</dt>
                  <dd className="mt-1 font-medium text-ink-700 dark:text-surface-50">{aiDebug.errorCode ?? "–"}</dd>
                </div>
              </dl>
              {aiDebug.requestId && (
                <p className="mt-3 break-words text-[10px] text-ink-400/80 dark:text-surface-50/50">
                  Request ID: {aiDebug.requestId}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
