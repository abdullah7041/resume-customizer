import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Sparkles, Target, UserPlus, LogIn, TrendingUp, MessageSquare, Mail, LayoutTemplate, HelpCircle, Trash2 } from "lucide-react";
import {
  parseResume,
  analyzeResumeWithAI,
  optimizeResume,
} from "../../services/api.js";
import { useAuth } from "../../hooks/useAuth";
import UploadSection from "../sections/UploadSection";
import { MatchSection } from "../sections/MatchSection";
import { OptimizeSection } from "../sections/OptimizeSection";
import { KeywordsSection } from "../sections/KeywordsSection";
import TemplateGallery from "../sections/TemplatesSection";
import { InterviewSection } from "../sections/InterviewSection";
import { BulkAnalysisSection } from "../sections/BulkAnalysisSection";
import { CoverLetterSection } from "../sections/CoverLetterSection";
import Tabs from "../ui/Tabs";
import Toast, { ToastContainer } from "../ui/Toast";
import EmptyState from "../ui/EmptyState";
import Button from "../ui/Button";
import HelpModal from "../ui/HelpModal";
import LandingPage from "../../pages/LandingPage";
import WelcomeModal from "../ui/WelcomeModal";
import { ParallaxContainer } from "../ui/ParallaxSection";
import { helpContent } from "../../lib/data/helpContent";
import { exportResumeToPdf } from "../../services/exportPdf.js";
import { exportToSupabase, isSupabaseExportAvailable } from "../../services/supabaseExport.js";
import ViewTextModal from "../ui/ViewTextModal";

const getTabsConfig = (t) => [
  { value: "resume", label: t("tabs.resume"), icon: FileText },
  { value: "match", label: t("tabs.match"), icon: Target },
  { value: "optimize", label: t("tabs.optimize"), icon: Sparkles },
  { value: "keywords", label: t("tabs.keywords"), icon: TrendingUp },
  { value: "templates", label: t("tabs.templates"), icon: LayoutTemplate },
  { value: "interview", label: t("tabs.interview"), icon: MessageSquare },
  { value: "bulk", label: t("tabs.bulk"), icon: FileText },
  { value: "cover-letter", label: t("tabs.coverLetter"), icon: Mail },
];

const containerClass = "app-shell w-full";

const TOAST_IDS = {
  upload: "toast:upload",
  match: "toast:match",
  optimize: "toast:optimize",
};
const TAB_STORAGE_KEY = "airo:lastActiveTab";
const RESUME_STORAGE_KEY = "airo:resumeData";
const JOB_STORAGE_KEY = "airo:jobDescription";
const withTemperature = (message) => message;

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
  const { t } = useTranslation();
  const { user, loading, signInWithGoogle } = useAuth();
  const isPremium = Boolean(
    user?.user_metadata?.is_premium ||
    user?.user_metadata?.tier === "premium" ||
    user?.app_metadata?.plan === "premium"
  );

  // Memoize tabs to avoid recreating on every render
  const tabs = useMemo(() => getTabsConfig(t), [t]);

  const [activeTab, setActiveTab] = useState("resume");
  const [flowProgress, setFlowProgress] = useState(0);
  const [resumeData, setResumeData] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const stored = window.localStorage.getItem(RESUME_STORAGE_KEY);
      if (!stored) return "";

      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return "";

      // Validate plainText is actual text, not binary/corrupted data
      const plainText = parsed.plainText;
      if (typeof plainText === "string" && plainText.length > 0) {
        // Relaxed binary data detection to prevent false positives
        // Only check for a high density of non-printable control characters (excluding whitespace)
        // eslint-disable-next-line no-control-regex
        const controlCharCount = (plainText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
        const isBinary = controlCharCount > plainText.length * 0.3; // Threshold: 30% control chars

        if (isBinary) {
          console.warn("Detected corrupted resume data in localStorage, clearing it");
          window.localStorage.removeItem(RESUME_STORAGE_KEY);
          return "";
        }
      }

      return parsed;
    } catch (error) {
      console.warn("Failed to parse resume data from localStorage:", error);
      window.localStorage.removeItem(RESUME_STORAGE_KEY);
      return "";
    }
  });
  const [viewTextModalOpen, setViewTextModalOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(JOB_STORAGE_KEY) || "";
  });
  const [matchAnalysis, setMatchAnalysis] = useState(null);
  const [optimizations, setOptimizations] = useState([]);
  const [optimizationData, setOptimizationData] = useState(null);
  const [optimizationKeywords, setOptimizationKeywords] = useState({ add: [], remove: [], neutral: [] });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewUsed, setPreviewUsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [aiDebug, setAiDebug] = useState(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [currentHelpTopic, setCurrentHelpTopic] = useState(null);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.localStorage.getItem("airo:landingSeen");
  });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPreviewUsed(window.localStorage.getItem("airo:previewQuotaUsed") === "true");
  }, []);

  // Persist resume data to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resumeData && resumeData.plainText) {
      try {
        window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumeData));
      } catch (error) {
        console.warn("Failed to save resume to localStorage:", error);
      }
    }
  }, [resumeData]);

  // Persist job description to localStorage  
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobDescription) {
      window.localStorage.setItem(JOB_STORAGE_KEY, jobDescription);
    }
  }, [jobDescription]);

  const handleTabChange = useCallback((value) => {
    setActiveTab(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, value);
    }
  }, []);

  const hasNextTab = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    return index >= 0 && index < tabs.length - 1;
  }, [activeTab, tabs]);

  const handleContinue = useCallback(() => {
    const index = tabs.findIndex((tab) => tab.value === activeTab);
    if (index >= 0 && index < tabs.length - 1) {
      handleTabChange(tabs[index + 1].value);
    }
  }, [activeTab, handleTabChange, tabs]);

  const persistPreviewUsage = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("airo:previewQuotaUsed", "true");
    setPreviewUsed(true);
  }, []);

  const handleClearAllData = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clear all stored data
    window.localStorage.removeItem(RESUME_STORAGE_KEY);
    window.localStorage.removeItem(JOB_STORAGE_KEY);
    window.localStorage.removeItem("airo:lastJobDescription");

    // Reset state
    setResumeData("");
    setJobDescription("");
    setMatchAnalysis(null);
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    setActiveTab("resume");

    pushToast({
      type: "success",
      title: t("toasts.dataClearedTitle"),
      description: t("toasts.dataClearedDesc"),
    });
  }, [pushToast, t]);

  const handleClearResume = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RESUME_STORAGE_KEY);
    setResumeData("");
    // Also clear dependent data
    setMatchAnalysis(null);
    setJobDescription("");
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    pushToast({ type: "success", title: t("toasts.resumeClearedTitle"), description: t("toasts.resumeClearedDesc") });
  }, [pushToast, t]);

  const handleClearMatch = useCallback(() => {
    setMatchAnalysis(null);
    setJobDescription("");
    pushToast({ type: "success", title: t("toasts.matchClearedTitle"), description: t("toasts.matchClearedDesc") });
  }, [pushToast, t]);

  const handleClearOptimizations = useCallback(() => {
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    pushToast({ type: "success", title: t("toasts.optimizationsClearedTitle"), description: t("toasts.optimizationsClearedDesc") });
  }, [pushToast, t]);

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

      // Clear old localStorage data to prevent corruption issues
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RESUME_STORAGE_KEY);
      }

      try {
        setFlowProgress(18);
        pushToast(
          {
            type: "info",
            title: t("toasts.parsingResume"),
            description: t("toasts.parsingResumeDesc"),
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
        setOptimizationData(null);
        setOptimizationKeywords({ add: [], remove: [], neutral: [] });
        pushToast(
          {
            type: "success",
            title: t("toasts.resumeParsed"),
            description: t("toasts.resumeParsedDesc"),
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
            title: t("toasts.parsingFailed"),
            description: (error?.message || "Please try again with a different file.") +
              " • Save your text before retrying.",
          },
          { id: TOAST_IDS.upload }
        );
        throw error;
      }
    },
    [normalizeResumePayload, pushToast, t]
  );

  const handleAnalyzeMatchAI = useCallback(
    async (jobDescriptionInput) => {
      if (!resumeData?.plainText) {
        const error = new Error("Please upload or paste a resume first.");
        pushToast({
          type: "warning",
          title: t("toasts.resumeRequired"),
          description: t("toasts.resumeRequiredDesc"),
        });
        throw error;
      }

      try {
        setIsAnalyzing(true);
        setFlowProgress(22);
        pushToast(
          {
            type: "info",
            title: t("toasts.aiAnalyzing"),
            description: t("toasts.aiAnalyzingDesc"),
          },
          { id: TOAST_IDS.match }
        );
        const trimmedJob = jobDescriptionInput.trim();
        const result = await analyzeResumeWithAI(resumeData.plainText, trimmedJob);
        setMatchAnalysis(result);
        setJobDescription(trimmedJob);
        pushToast(
          {
            type: "success",
            title: t("toasts.aiMatchComplete"),
            description: t("toasts.aiMatchCompleteDesc"),
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
            title: t("toasts.aiMatchFailed"),
            description: error?.message || "Please try again in a moment.",
          },
          { id: TOAST_IDS.match }
        );
        throw error;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [pushToast, resumeData, t]
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
            title: t("toasts.generatingOptimizations"),
            description: withTemperature(t("toasts.generatingOptimizationsDesc")),
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
                  title: t("toasts.optimizationFailed"),
                  description: descriptionParts.filter(Boolean).join(" • "),
                },
                { id: TOAST_IDS.optimize }
              );
            },
          }
        );

        setOptimizations(result.cards ?? []);
        setOptimizationData(result.optimization ?? null);
        setOptimizationKeywords(result.keywords ?? { add: [], remove: [], neutral: [] });
        pushToast(
          {
            type: "success",
            title: t("toasts.optimizationReady"),
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
    [isPremium, jobDescription, persistPreviewUsage, previewUsed, pushToast, resumeData, t]
  );

  const handleCopy = useCallback(
    async (value) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        }
        pushToast({
          type: "success",
          title: t("toasts.copiedToClipboard"),
          description: t("toasts.copiedToClipboardDesc"),
        });
      } catch (error) {
        pushToast({
          type: "danger",
          title: t("toasts.copyFailed"),
          description: error?.message || "Select the text manually to copy.",
        });
      }
    },
    [pushToast, t]
  );

  const handleUpgrade = useCallback(() => {
    pushToast({
      type: "info",
      title: t("toasts.unlockPremium"),
      description: t("toasts.unlockPremiumDesc"),
    });
  }, [pushToast, t]);

  const handleExportPdf = useCallback(
    async (variant, exportMethod = "supabase") => {
      if (!resumeData?.plainText) {
        pushToast({
          type: "warning",
          title: t("toasts.addResume"),
          description: t("toasts.addResumeDesc"),
        });
        return;
      }

      const normalizedVariant = variant === "ats-plain" ? "ats-plain" : "styled";

      try {
        // Merge original resume with AI optimizations (Hard Overrides + Smart Match)
        const { mergeResumeData } = await import("../../lib/utils/resumeUtils");
        const mergedResume = mergeResumeData(resumeData, {
          optimization: optimizationData,
          candidateProfile: null // Add if available
        });

        // Get the HTML content from exportPdf (without triggering print)
        const htmlContent = await exportResumeToPdf({
          resumeDocument: mergedResume || resumeData, // Fallback to original if merge fails
          jobDescription,
          matchAnalysis,
          optimizations,
          keywords: optimizationKeywords,
          variant: normalizedVariant,
          skipPrint: true, // Don't trigger print, just return HTML
        });

        // Check export method
        if (exportMethod === "supabase" && isSupabaseExportAvailable()) {
          // Check if user is authenticated
          if (!user) {
            pushToast({
              type: "warning",
              title: t("toasts.signInRequired"),
              description: t("toasts.signInRequiredDesc"),
            });
            return;
          }

          // Export to Supabase Storage
          const result = await exportToSupabase({
            htmlContent,
            fileName: "Resume_Optimized",
            metadata: {
              variant: normalizedVariant,
              hasJobDescription: Boolean(jobDescription),
              hasOptimizations: optimizations.length > 0,
              matchScore: matchAnalysis?.score,
            },
          });

          pushToast({
            type: "success",
            title: t("toasts.savedToAccount"),
            description: `Your resume "${result.fileName}" has been saved securely.`,
          });

          // Optionally open the file in a new tab
          if (result.signedUrl) {
            window.open(result.signedUrl, "_blank");
          }
        } else {
          // Fallback to print dialog if Supabase is not available or user not signed in
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
            title: t("toasts.printDialogOpened"),
            description: t("toasts.printDialogOpenedDesc"),
          });
        }
      } catch (error) {
        console.error("Export error:", error);
        pushToast({
          type: "danger",
          title: t("toasts.exportFailed"),
          description: error?.message || "Unable to export resume. Please try again.",
        });
      }
    },
    [jobDescription, matchAnalysis, optimizationData, optimizations, optimizationKeywords, pushToast, resumeData, user, t]
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
    <ParallaxContainer enableLayers={true} className="py-1">
      <div className="space-y-3 sm:space-y-5 text-ink-700 dark:text-surface-50">
        {/* Tab navigation - full width on mobile */}
        <div className="w-full">
          <Tabs tabs={tabs} activeValue={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Action buttons row */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Help button for current tab */}
            {helpContent[getHelpKey(activeTab)] && (
              <button
                onClick={() => {
                  setCurrentHelpTopic(getHelpKey(activeTab));
                  setHelpModalOpen(true);
                }}
                className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-white/50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-full backdrop-blur-sm hover:bg-white/80 dark:hover:bg-emerald-900/40 transition-all shadow-sm hover:shadow-md"
                title="How this feature works"
              >
                <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">{t("workspace.howItWorks")}</span>
              </button>
            )}
            {/* Welcome Modal trigger */}
            <button
              onClick={() => setWelcomeModalOpen(true)}
              className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300 bg-white/50 dark:bg-teal-900/20 border border-teal-200/50 dark:border-teal-800/30 rounded-full backdrop-blur-sm hover:bg-white/80 dark:hover:bg-teal-900/40 transition-all shadow-sm hover:shadow-md"
              title="View getting started guide"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">{t("workspace.gettingStarted")}</span>
            </button>
          </div>
          {resumeData?.plainText && (
            <button
              type="button"
              onClick={handleClearAllData}
              className="group flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-ink-500/70 hover:bg-danger-500/10 hover:text-danger-600 transition-all duration-200 dark:text-surface-50/60 dark:hover:bg-danger-400/10 dark:hover:text-danger-400"
              title="Clear all saved data"
            >
              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">{t("workspace.clearAll")}</span>
              <span className="sm:hidden">Clear</span>
            </button>
          )}
        </div>
        <div className="relative min-h-[420px] sm:min-h-[480px] rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_90%)] p-4 sm:p-5 lg:p-6 shadow-card backdrop-blur-glass transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_22px_65px_-40px_rgba(15,15,18,0.55)]">
          {activeTab === "resume" && (
            <UploadSection
              onParseResume={handleParseResume}
              resumeDocument={resumeData}
              onToast={handleUploadToast}
              onClear={handleClearResume}
            />
          )}
          {activeTab === "match" && (
            <MatchSection
              onAnalyzeMatchAI={handleAnalyzeMatchAI}
              matchAnalysis={matchAnalysis}
              isAnalyzing={isAnalyzing}
              hasResume={Boolean(resumeData?.plainText)}
              onToast={pushToast}
              onClear={handleClearMatch}
            />
          )}
          {activeTab === "optimize" && (
            <OptimizeSection
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
              hasMatchAnalysis={Boolean(matchAnalysis && jobDescription)}
              onClear={handleClearOptimizations}
            />
          )}
          {activeTab === "keywords" && (
            <KeywordsSection
              resumeText={resumeData?.plainText || ""}
              jobDescription={jobDescription}
            />
          )}
          {activeTab === "templates" && (
            <TemplateGallery
              resumeData={resumeData}
              matchAnalysis={matchAnalysis}
              optimizationData={optimizationData}
              onSelectTemplate={(template) => {
                pushToast({
                  type: "success",
                  title: t("toasts.templateSelected"),
                  description: `Using ${template.name} template. You can now apply it to your resume.`
                });
              }}
            />
          )}
          {activeTab === "interview" && (
            <InterviewSection
              jobDescription={jobDescription}
              resumeText={resumeData?.plainText || ""}
              matchAnalysis={matchAnalysis}
              resumeData={resumeData}
              onUpdate={(updates) => setResumeData(prev => ({ ...prev, ...updates }))}
            />
          )}
          {activeTab === "bulk" && (
            <BulkAnalysisSection
              jobDescription={jobDescription}
            />
          )}
          {activeTab === "cover-letter" && (
            <CoverLetterSection
              resumeText={resumeData?.plainText || ""}
              jobDescription={jobDescription}
            />
          )}
        </div>
        {hasNextTab && (
          <div className="flex justify-center sm:justify-end">
            <Button variant="secondary" icon={ArrowRight} onClick={handleContinue} className="justify-center">
              {t("workspace.continue")}
            </Button>
          </div>
        )}
      </div>
    </ParallaxContainer>
  );

  return (
    <main
      data-app-main
      className="relative isolate z-20 min-h-screen pb-16 sm:pb-24 lg:pb-32 -mt-16 sm:-mt-30 lg:-mt-30"
    >
      <ToastContainer>{renderedToasts}</ToastContainer>
      <ViewTextModal
        isOpen={viewTextModalOpen}
        onClose={() => setViewTextModalOpen(false)}
        text={resumeData?.plainText || ""}
      />
      <div className={`${containerClass} space-y-4 sm:space-y-10 lg:space-y-12 text-ink-700 dark:text-surface-50`}>
        <div className="card-glow rounded-xl sm:rounded-card border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_90%)] p-3 sm:p-7 lg:p-8 shadow-card backdrop-blur-glass transition-shadow duration-[var(--duration-breathe)] ease-[var(--transition-snappy)] hover:shadow-[0_24px_70px_-42px_rgba(15,15,18,0.58)]">
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
          ) : showLanding ? (
            <LandingPage
              onGetStarted={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("airo:landingSeen", "true");
                }
                setShowLanding(false);
              }}
            />
          ) : (
            <EmptyState
              icon={UserPlus}
              title={t("workspace.signInToUnlock")}
              description={t("workspace.signInDescription")}
              actions={
                <Button
                  variant="frosted"
                  icon={LogIn}
                  onClick={signInWithGoogle}
                  className="justify-center text-[15px] font-semibold"
                >
                  {t("workspace.signInViaGoogle")}
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

      {/* Welcome Modal - shown on button click */}
      <WelcomeModal
        isOpen={welcomeModalOpen}
        onClose={() => setWelcomeModalOpen(false)}
      />

      {/* Help Modal */}
      {currentHelpTopic && (
        <HelpModal
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
          title={helpContent[currentHelpTopic]?.title || "Help"}
        >
          {helpContent[currentHelpTopic]?.content}
        </HelpModal>
      )}
    </main>
  );
}

// Helper function to map tab values to help content keys
function getHelpKey(tabValue) {
  const mapping = {
    "resume": "upload",
    "match": "match",
    "optimize": "optimize",
    "keywords": "keywords",
    "templates": "templates",
    "interview": "interview",
    "bulk": "bulk",
    "cover-letter": "cover",
  };
  return mapping[tabValue] || tabValue;
}




