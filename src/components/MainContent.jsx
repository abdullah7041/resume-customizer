import { useCallback, useMemo, useState } from "react";
import { FileText, Sparkles, Target, UserPlus, LogIn } from "lucide-react";
import { parseResume, analyzeResume } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ResumeUpload from "../features/ResumeUpload.jsx";
import JobMatch from "./Features/JobMatch.jsx";
import Optimization from "../features/Optimization.jsx";
import Tabs from "./ui/Tabs.jsx";
import Toast, { ToastContainer } from "./ui/Toast.jsx";
import EmptyState from "./ui/EmptyState.jsx";
import PrimaryButton from "./ui/PrimaryButton.jsx";

const tabs = [
  { value: "resume", label: "Resume", icon: FileText },
  { value: "match", label: "Match", icon: Target },
  { value: "optimize", label: "Optimize", icon: Sparkles },
];

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
  const [matchAnalysis, setMatchAnalysis] = useState(null);
  const [optimizations] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast) => {
      const id = getId();
      setToasts((prev) => [...prev, { id, ...toast }]);
      const lifetime = toast?.type === "danger" ? 6000 : 4200;
      scheduleTimeout(() => dismissToast(id), lifetime);
    },
    [dismissToast]
  );

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
    async (jobDescription) => {
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
          description: "Comparing your resume to the Saudi job description…",
        });
        const result = await analyzeResume(resumeData, jobDescription);
        setMatchAnalysis(result);
        pushToast({
          type: "success",
          title: "Match insights ready",
          description: "Review keywords and suggestions tailored for Riyadh.",
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
      <div className="relative min-h-[520px] rounded-[var(--radius-card)] border border-secondary-500/10 bg-surface-50/95 p-6 shadow-card backdrop-blur-xl dark:border-white/5 dark:bg-surface-900/80">
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
          />
        )}
        {activeTab === "optimize" && (
          <Optimization
            isPremium={isPremium}
            optimizations={optimizations}
          />
        )}
      </div>
    </div>
  );

  return (
    <main data-app-main className="relative -mt-16 px-4 pb-24">
      <ToastContainer>{renderedToasts}</ToastContainer>
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[var(--radius-card)] border border-secondary-500/10 bg-surface-50/95 p-8 shadow-card backdrop-blur-xl dark:border-white/5 dark:bg-surface-900/80">
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
                <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
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
                  Sign in with Google
                </PrimaryButton>
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
