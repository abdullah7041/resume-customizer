import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Sparkles, Target, UserPlus, LogIn } from "lucide-react";
import { parseResume, analyzeResume, optimizeResume } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ResumeUpload from "../features/ResumeUpload.jsx";
import JobMatch from "./Features/JobMatch.jsx";
import Optimization from "../features/Optimization.jsx";
import Tabs from "./ui/Tabs.jsx";
import Toast, { ToastContainer } from "./ui/Toast.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import PrimaryButton from "./ui/PrimaryButton.jsx";
import { skyline } from "../lib/assets";
import { exportResumeToPdf } from "../services/exportPdf.js";

const tabs = [
  { value: "resume", label: "Resume", icon: FileText },
  { value: "match", label: "Match", icon: Target },
  { value: "optimize", label: "Optimize", icon: Sparkles },
];

const SKYLINE_SESSION_KEY = "airo:skyline:first";

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
  const skylineUrl = useMemo(() => skyline(), []);
  const [animateSkyline, setAnimateSkyline] = useState(false);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast) => {
      const id = getId();
      setToasts([{ id, ...toast }]);
      const lifetime = toast?.type === "danger" ? 6000 : 4200;
      scheduleTimeout(() => dismissToast(id), lifetime);
    },
    [dismissToast]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPreviewUsed(window.localStorage.getItem("airo:previewQuotaUsed") === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAnimateSkyline(true);
    const timer = window.setTimeout(() => setAnimateSkyline(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const persistPreviewUsage = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("airo:previewQuotaUsed", "true");
    setPreviewUsed(true);
  }, []);

  const handleParseResume = useCallback(
    async (resumeInput) => {
      try {
        setFlowProgress(18);
        pushToast({
          type: "info",
          title: "Parsing resume",
          description: "AI is structuring your experience for analysis.",
        });

        const content =
          typeof resumeInput === "string"
            ? resumeInput
            : await resumeInput.text();

        setFlowProgress(48);
        const parsed = await parseResume(content);
        setFlowProgress(88);
        setResumeData(parsed);
        setMatchAnalysis(null);
        setJobDescription("");
        setOptimizations([]);
        setOptimizationKeywords({ add: [], remove: [], neutral: [] });
        pushToast({
          type: "success",
          title: "Resume parsed",
          description: "Move to Match to compare with a job description.",
        });
        setActiveTab("match");
        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 800);
        return parsed;
      } catch (error) {
        setFlowProgress(0);
        pushToast({
          type: "danger",
          title: "Parsing failed",
          description: error?.message || "Please try again with a different file.",
        });
        throw error;
      }
    },
    [pushToast]
  );

  const handleAnalyzeMatch = useCallback(
    async (jobDescriptionInput) => {
      if (!resumeData) {
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
        pushToast({
          type: "info",
          title: "Analyzing match",
          description: "Comparing your resume to the description…",
        });
        const trimmedJob = jobDescriptionInput.trim();
        const result = await analyzeResume(resumeData, trimmedJob);
        setMatchAnalysis(result);
        setJobDescription(trimmedJob);
        pushToast({
          type: "success",
          title: "Match insights ready",
          description: "Review keywords and suggestions.",
        });
        setActiveTab("optimize");
        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 800);
        return result;
      } catch (error) {
        setFlowProgress(0);
        pushToast({
          type: "danger",
          title: "Match analysis failed",
          description: error?.message || "Please try again in a moment.",
        });
        throw error;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [pushToast, resumeData]
  );

  const handleOptimize = useCallback(
    async (mode) => {
      if (!resumeData || !jobDescription) {
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
        pushToast({
          type: "info",
          title: "Generating optimizations",
          description: "Drafting tailored rewrite suggestions…",
        });

        const result = await optimizeResume({
          resumeText: resumeData,
          jobDesc: jobDescription,
          mode,
          preview: !isPremium,
        });

        setOptimizations(result.cards ?? []);
        setOptimizationKeywords(result.keywords ?? { add: [], remove: [], neutral: [] });
        pushToast({
          type: "success",
          title: "Optimization cards ready",
          description:
            result.source === "openai"
              ? "Review AI-crafted rewrites and keywords."
              : "Preview mode generated realistic guidance.",
        });

        if (!isPremium && !previewUsed) {
          persistPreviewUsage();
        }

        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 900);
        return result;
      } catch (error) {
        setFlowProgress(0);
        pushToast({
          type: "danger",
          title: "Optimization failed",
          description: error?.message || "Please try again shortly.",
        });
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

  const handleExportPdf = useCallback(() => {
    if (!resumeData) {
      pushToast({
        type: "warning",
        title: "Add your resume",
        description: "Upload or paste your resume before exporting.",
      });
      return;
    }

    try {
      exportResumeToPdf({
        resumeText: resumeData,
        jobDescription,
        matchAnalysis,
        optimizations,
        keywords: optimizationKeywords,
      });
      pushToast({
        type: "success",
        title: "Export ready",
        description: "Use your browser dialog to save the PDF preview.",
      });
    } catch (error) {
      pushToast({
        type: "danger",
        title: "Export blocked",
        description: error?.message || "Enable pop-ups and try again.",
      });
    }
  }, [jobDescription, matchAnalysis, optimizations, optimizationKeywords, pushToast, resumeData]);

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
    <div className="space-y-8">
      <Tabs tabs={tabs} activeValue={activeTab} onTabChange={setActiveTab} />
      <div className="accent-divider mx-auto my-2 h-px w-full opacity-80" aria-hidden="true" />
      <div className="relative min-h-[520px] rounded-[var(--radius-card)] border border-secondary-500/12 bg-surface-50/94 p-6 shadow-card backdrop-blur-xl transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_22px_65px_-40px_rgba(15,15,18,0.55)] dark:border-surface-50/12 dark:bg-surface-900/82">
        {activeTab === "resume" && (
          <ResumeUpload
            onParseResume={handleParseResume}
            resumeData={resumeData}
            onToast={pushToast}
          />
        )}
        {activeTab === "match" && (
          <JobMatch
            onAnalyzeMatch={handleAnalyzeMatch}
            matchAnalysis={matchAnalysis}
            isAnalyzing={isAnalyzing}
            hasResume={Boolean(resumeData)}
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
            canExport={Boolean(resumeData)}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-50">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b6b3a]/88 via-[#0b3d2b]/86 to-[#04160d]/94" />
        {typeof skylineUrl === "string" && skylineUrl ? (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={skylineUrl}
                alt=""
                loading="eager"
                decoding="async"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-auto min-h-full w-full object-cover"
                style={{ objectPosition: "center calc(100% - 140px)" }}
              />
            </div>
            <div
              className={`absolute inset-x-0 bottom-0 h-full bg-cover bg-bottom bg-no-repeat opacity-[0.85] ${
                animateSkyline ? "skyline-once" : "skyline-still"
              }`}
              style={{
                backgroundImage: `url('${skylineUrl}')`,
                backgroundPosition: "center calc(100% - 140px)",
              }}
            />
          </>
        ) : null}
      </div>
      <main
        data-app-main
        className="relative z-10 -mt-20 min-h-screen px-4 pb-32 pt-24 sm:px-6 lg:pb-40"
      >
        <ToastContainer>{renderedToasts}</ToastContainer>
        <div className="mx-auto max-w-6xl">
          <div className="card-glow rounded-[var(--radius-card)] border border-secondary-500/12 bg-surface-50/94 p-8 shadow-card backdrop-blur-xl transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_24px_70px_-42px_rgba(15,15,18,0.58)] dark:border-surface-50/12 dark:bg-surface-900/82">
            {flowProgress > 0 && (
              <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-smoke-50/70 dark:bg-surface-900/70">
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
                  <PrimaryButton icon={LogIn} onClick={signInWithGoogle}>
                    Sign in via Google
                  </PrimaryButton>
                }
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
