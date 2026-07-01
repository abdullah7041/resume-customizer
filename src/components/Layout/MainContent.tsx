import { lazy, Suspense, Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Sparkles, Target, MessageSquare, Mail, LayoutTemplate, Trash2, AlertTriangle, Briefcase, LogIn, MoreHorizontal, ShieldCheck } from "lucide-react";
import {
  parseResume,
  analyzeResumeWithAI,
  analyzeResumeTruthCheck,
  optimizeResume,
  optimizeResumeStream,
  generateClarifications,
  extractJobMetadata,
  isAuthRequiredError,
  AI_DEFAULT_TEMPERATURE,
} from "../../services/api.js";
import { ClarificationModal, type ClarificationQuestion } from "../modals/ClarificationModal";
import {
  formatClarificationAnswers,
  shouldRequestClarifications,
  type ClarificationAnswers,
  type WorkEntry,
} from "@/lib/clarifications";
import { useAuth } from "../../hooks/useAuth";
import UploadSection from "../sections/UploadSection";
import TemplateGallery from "../sections/TemplatesSection";
import OnboardingChat from "../onboarding/OnboardingChat";
import { isIntentPrompted, markIntentPrompted } from "../../lib/onboarding/intentPromptFlag";
// KeywordsSection removed from MVP navigation - functionality merged into Optimize section

// Lazy-loaded tab sections — each gets its own chunk
const MatchSection = lazy(() => import("../sections/MatchSection").then(m => ({ default: m.MatchSection })));
const TruthCheckSection = lazy(() => import("../sections/TruthCheckSection").then(m => ({ default: m.TruthCheckSection })));
const OptimizeSection = lazy(() => import("../sections/OptimizeSection").then(m => ({ default: m.OptimizeSection })));
const InterviewSection = lazy(() => import("../sections/InterviewSection").then(m => ({ default: m.InterviewSection })));
const BulkAnalysisSection = lazy(() => import("../sections/BulkAnalysisSection").then(m => ({ default: m.BulkAnalysisSection })));
const CoverLetterSection = lazy(() => import("../sections/CoverLetterSection").then(m => ({ default: m.CoverLetterSection })));
const Vision2030Section = lazy(() => import("../Vision2030/Vision2030Section").then(m => ({ default: m.Vision2030Section })));
const LandingPage = lazy(() => import("../../pages/LandingPage"));
const PipelineSection = lazy(() => import("../sections/PipelineSection").then(m => ({ default: m.PipelineSection })));

import type { Tab } from "../ui/GlassTabs";
import { MobileWorkflowNav, type MobileWorkflowItem } from "../ui/MobileWorkflowNav";
import { WorkflowStepper, type WorkflowStep, type WorkflowStepStatus } from "../ui/WorkflowStepper";
import Toast, { ToastContainer } from "../ui/Toast";
import { GlassButton } from "../ui/GlassButton";
import { GlassCard } from "../ui/GlassCard";
import { ParallaxContainer } from "../ui/ParallaxSection";
import { exportResumeToPdf } from "../../services/exportPdf.js";
import { exportToSupabase, isSupabaseExportAvailable } from "../../services/supabaseExport.js";
import { attachExportToJobApplication, updateJobApplication } from "../../services/pipeline";
import { analytics } from "../../services/analytics";
import type { ExtractedJobMetadata } from "../../types/pipeline";
import type { ResumeTruthCheckResult } from "../../types/truth-check";
import ViewTextModal from "../ui/ViewTextModal";
import { ParsingWarningsBanner } from "../ui/ParsingWarningsBanner";
// Vision2030Summary removed - users should use the dedicated Vision 2030 tab instead
import { useResumeStore } from "../../lib/stores/resumeStore";
import { mergeResumeData } from "../../lib/utils/resumeUtils";
import { emitHRSuperSaudEvent, useHRSuperSaud } from "../../features/hr-super-saud";
import { useUserCredits } from "../../hooks/useUserCredits";

/** Lightweight skeleton shown while lazy sections load */
function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="h-64 w-full rounded-xl bg-gray-100 dark:bg-white/5" />
    </div>
  );
}

/** Error boundary that catches failed dynamic imports and shows a recovery UI */
class LazyErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Failed to load {this.props.label ?? 'this section'}. This can happen after a hot-reload.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


const getTabsConfig = (t) => [
  { value: "resume", label: t("tabs.resume"), icon: FileText },
  { value: "truth-check", label: t("tabs.truthCheck", "Truth Check"), icon: ShieldCheck },
  { value: "match", label: t("tabs.match"), icon: Target },
  { value: "optimize", label: t("tabs.optimize"), icon: Sparkles },

  { value: "templates", label: t("tabs.templates"), icon: LayoutTemplate },
  { value: "more-tools", label: t("tabs.moreTools", "More tools"), icon: MoreHorizontal },
  { value: "interview", label: t("tabs.interview"), icon: MessageSquare },
  { value: "bulk", label: t("tabs.bulk"), icon: FileText },
  { value: "cover-letter", label: t("tabs.coverLetter"), icon: Mail },
  { value: "vision2030", label: t("tabs.vision2030", "Vision 2030"), icon: Target, isPremium: true },
  { value: "pipeline", label: t("tabs.pipeline", "Pipeline"), icon: Briefcase },
];
const PRIMARY_TAB_VALUES = ["resume", "truth-check", "match", "optimize", "templates", "more-tools"];
const PRE_UPLOAD_TAB_VALUES = new Set(PRIMARY_TAB_VALUES);
const MOBILE_PRIMARY_TAB_VALUES = PRIMARY_TAB_VALUES;
const MOBILE_SECONDARY_TAB_VALUES = ["interview", "bulk", "cover-letter", "vision2030", "pipeline"];
const SECONDARY_TAB_VALUES = new Set(MOBILE_SECONDARY_TAB_VALUES);

const containerClass = "app-shell w-full";

const TOAST_IDS = {
  upload: "toast:upload",
  truthCheck: "toast:truth-check",
  match: "toast:match",
  optimize: "toast:optimize",
};
const TAB_STORAGE_KEY = "watheq:lastActiveTab";
const RESUME_STORAGE_KEY = "watheq:resumeData";
const JOB_STORAGE_KEY = "watheq:lastJobDescription";
const GUEST_MODE_STORAGE_KEY = "watheq:guestMode";
const TRUTH_CHECK_STORAGE_KEY = "watheq:resumeTruthCheck";

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

const getResumeFingerprint = (text: string) => `${text.length}:${text.slice(0, 120)}`;

const loadCachedTruthCheck = (resumeText: string): ResumeTruthCheckResult | null => {
  if (typeof window === "undefined" || !resumeText) return null;
  try {
    const stored = window.localStorage.getItem(TRUTH_CHECK_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as {
      resumeHash?: string;
      result?: ResumeTruthCheckResult;
    };
    return parsed?.resumeHash === getResumeFingerprint(resumeText) && parsed.result
      ? parsed.result
      : null;
  } catch (error) {
    console.warn("[MainContent] Failed to load cached Truth Check:", error);
    window.localStorage.removeItem(TRUTH_CHECK_STORAGE_KEY);
    return null;
  }
};

const getGuestPreviewLimitTelemetry = (error: unknown) => {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof candidate.status === "number" ? candidate.status : null;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (code === "file/guest-too-large") {
    return { source: "client_file_size" as const, status };
  }

  if (code === "guest/file-too-large") {
    return { source: "server_file_size" as const, status };
  }

  if (code === "guest/text-too-large") {
    return { source: "server_text_length" as const, status };
  }

  if (code === "guest/preview-unavailable") {
    return { source: "preview_unavailable" as const, status };
  }

  if (status === 429) {
    return {
      source: "server_rate_limit" as const,
      status,
      retryAfter: typeof candidate.retryAfter === "number" ? candidate.retryAfter : null,
    };
  }

  if (status === 503) {
    return { source: "preview_unavailable" as const, status };
  }

  if (status === 413) {
    return {
      source: message.includes("text") || message.includes("20,000")
        ? "server_text_length" as const
        : "server_file_size" as const,
      status,
    };
  }

  if (candidate.quotaExceeded === true) {
    return {
      source: "unknown" as const,
      status,
      limit: typeof candidate.limit === "number" ? candidate.limit : null,
      used: typeof candidate.used === "number" ? candidate.used : null,
      remaining: typeof candidate.remaining === "number" ? candidate.remaining : null,
    };
  }

  return null;
};

type AiDebugSnapshot = {
  status: "success" | "error";
  requestId?: string | null;
  model?: string | null;
  temperature?: number;
  tokens?: number | null;
  maxOutputTokens?: number | null;
  latencyMs?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  errorDetail?: string | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const buildAiDebugSnapshot = (
  source: unknown,
  status: AiDebugSnapshot["status"]
): AiDebugSnapshot => {
  const record = toRecord(source);
  const debug = toRecord(record.debug);

  return {
    status,
    requestId: toStringValue(debug.requestId) ?? toStringValue(record.requestId),
    model: toStringValue(debug.model) ?? toStringValue(record.model),
    temperature: AI_DEFAULT_TEMPERATURE,
    tokens: toNumber(debug.tokens ?? record.tokens),
    maxOutputTokens: toNumber(debug.maxOutputTokens ?? record.maxOutputTokens),
    latencyMs: toNumber(debug.latencyMs ?? record.latencyMs),
    statusCode: status === "success"
      ? toNumber(record.statusCode) ?? 200
      : toNumber(record.statusCode ?? record.status),
    errorCode: status === "error"
      ? toStringValue(record.errorCode ?? record.code ?? record.type)
      : null,
    errorDetail: status === "error"
      ? toStringValue(record.errorDetail ?? record.message)
      : null,
  };
};

export default function MainContent() {
  const { t, i18n } = useTranslation();
  const { user, loading, signInWithGoogle } = useAuth();
  const { refetch: refetchCredits } = useUserCredits();
  const [guestMode, setGuestMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === "true";
  });
  const isGuestMode = !user && guestMode;
  const isPremium = Boolean(
    user?.user_metadata?.is_premium ||
    user?.user_metadata?.tier === "premium" ||
    user?.app_metadata?.plan === "premium"
  );

  const [activeTab, setActiveTab] = useState("resume");
  const [flowProgress, setFlowProgress] = useState(0);
  // Path-A intent capture: after a successful parse, auto-show the inline role/comp/
  // location prompt. The mount gate must NOT depend on searchIntent being empty —
  // OnboardingChat writes searchIntent at the very first (role) slot, so gating on
  // emptiness would unmount the panel mid-flow before comp/location. Gate on
  // resume-parsed AND !intentPrompted; the child owns slot progression and the parent
  // only unmounts when it fires onComplete/onDismiss (which sets intentPrompted).
  // Seed intentPrompted true when an intent already exists so returning users with a
  // saved intent are not re-prompted — read once at mount, never reactively.
  const hasParsedResume = useResumeStore((state) => Boolean(state.originalResume));
  const [intentPrompted, setIntentPrompted] = useState(
    () => isIntentPrompted() || Boolean(useResumeStore.getState().searchIntent),
  );
  const resolveIntentPrompt = useCallback(() => {
    markIntentPrompted();
    setIntentPrompted(true);
  }, []);
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
  const hasResume = Boolean(resumeData?.plainText);
  const { setWorkflowState: setHRSuperSaudWorkflowState } = useHRSuperSaud();
  const resumeGateReason = t(
    "workspace.resumeGateHint",
    "Upload a resume first to unlock Match, Optimize, Export, and More tools."
  );
  const mobileWorkflowGateReason = t(
    "workspace.mobileWorkflow.lockedHelper",
    "Upload a resume first to unlock the next steps."
  );

  // Memoize tabs to avoid recreating on every render
  const tabs = useMemo<Tab[]>(
    () => {
      const baseTabs = getTabsConfig(t);
      const visibleTabs = hasResume
        ? baseTabs.filter((tab) => PRIMARY_TAB_VALUES.includes(tab.value))
        : baseTabs.filter((tab) => PRE_UPLOAD_TAB_VALUES.has(tab.value));

      return visibleTabs.map((tab) =>
        !hasResume && tab.value !== "resume"
          ? { ...tab, disabledReason: resumeGateReason }
          : tab
      );
    },
    [hasResume, resumeGateReason, t]
  );
  const mobilePrimarySteps = useMemo<MobileWorkflowItem[]>(() => {
    const mobileLabels = {
      resume: t("workspace.mobileWorkflow.steps.resume", "Resume"),
      "truth-check": t("workspace.mobileWorkflow.steps.truthCheck", "Truth Check"),
      match: t("workspace.mobileWorkflow.steps.match", "Match"),
      optimize: t("workspace.mobileWorkflow.steps.optimize", "Optimize"),
      templates: t("workspace.mobileWorkflow.steps.exportPipeline", "Export / Pipeline"),
      "more-tools": t("workspace.mobileWorkflow.moreTools", "More tools"),
    };

    return getTabsConfig(t)
      .filter((tab) => MOBILE_PRIMARY_TAB_VALUES.includes(tab.value))
      .map((tab) => ({
        ...tab,
        label: mobileLabels[tab.value] ?? tab.label,
        disabledReason: !hasResume && tab.value !== "resume" ? mobileWorkflowGateReason : undefined,
      }));
  }, [hasResume, mobileWorkflowGateReason, t]);
  const mobileSecondarySteps = useMemo<MobileWorkflowItem[]>(
    () =>
      hasResume
        ? getTabsConfig(t)
            .filter((tab) => MOBILE_SECONDARY_TAB_VALUES.includes(tab.value))
            .map((tab) => ({ ...tab }))
        : [],
    [hasResume, t]
  );
  const [viewTextModalOpen, setViewTextModalOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(JOB_STORAGE_KEY) || "";
  });
  const [matchAnalysis, setMatchAnalysis] = useState(null);
  const [truthCheckResult, setTruthCheckResult] = useState<ResumeTruthCheckResult | null>(() =>
    loadCachedTruthCheck(typeof resumeData?.plainText === "string" ? resumeData.plainText : "")
  );
  const [optimizations, setOptimizations] = useState([]);
  const [optimizationData, setOptimizationData] = useState(null);
  const [optimizationKeywords, setOptimizationKeywords] = useState({ add: [], remove: [], neutral: [] });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTruthChecking, setIsTruthChecking] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewUsed, setPreviewUsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [aiDebug, setAiDebug] = useState<AiDebugSnapshot | null>(null);
  const [activeJobApplicationId, setActiveJobApplicationId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ filePath: string; fileName: string } | null>(null);
  const [exportedJobApplicationId, setExportedJobApplicationId] = useState<string | null>(null);
  const [extractedMetadata, setExtractedMetadata] = useState<ExtractedJobMetadata | null>(null);
  // Clarification interrogation state
  const [isInterrogating, setIsInterrogating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [pendingOptimizeArgs, setPendingOptimizeArgs] = useState<{ mode: string; workHistory?: { name: string; position: string; startDate: string; endDate: string }[] } | null>(null);
  const toastTimers = useRef(new Map());
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!user || !guestMode || typeof window === "undefined") return;
    window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    setGuestMode(false);
  }, [guestMode, user]);

  const enterGuestMode = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, "true");
      window.localStorage.setItem("watheq:landingSeen", "true");
    }
    analytics.trackGuestPreviewStarted("landing_preview");
    setGuestMode(true);
    setActiveTab("resume");
  }, []);

  const exitGuestMode = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
    setGuestMode(false);
    setActiveTab("resume");
  }, []);

  const resetPipelineContext = useCallback(() => {
    setActiveJobApplicationId(null);
    setPendingAttachment(null);
    setExportedJobApplicationId(null);
    setExtractedMetadata(null);
  }, []);

  const handleJobSavedToPipeline = useCallback((id: string) => {
    setActiveJobApplicationId(id);
    setPendingAttachment(null);
    setExportedJobApplicationId(null);
  }, []);

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
    (toast, options: { id?: string } = {}) => {
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

  const guestProtectedActionTitle = t(
    "workspace.guest.protectedActionTitle",
    "Sign in required"
  );
  const guestProtectedActionDescription = t(
    "workspace.guest.protectedActionDesc",
    "Sign in to run AI analysis and save your progress."
  );
  const requireSignInForGuestAction = useCallback(() => {
    analytics.trackGuestPreviewLimitHit({
      source: "protected_action",
      status: 401,
    });
    pushToast({
      type: "warning",
      title: guestProtectedActionTitle,
      description: guestProtectedActionDescription,
    });
  }, [guestProtectedActionDescription, guestProtectedActionTitle, pushToast]);

  const handleGuestSignIn = useCallback((source: "guest_banner" | "guest_protected_action" = "guest_banner") => {
    if (isGuestMode) {
      analytics.trackGuestPreviewSigninStarted(source);
    }
    void signInWithGoogle({ intent: "signin", source: "landing_get_started" });
  }, [isGuestMode, signInWithGoogle]);

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

  // Listen for referral credit notifications
  useEffect(() => {
    const handleReferralCredits = (event) => {
      const { creditsAdded } = event.detail;
      pushToast({
        title: t('credits.referralEarned', '🎉 Referral Bonus Earned!'),
        description: t('credits.referralEarnedDesc', `You earned ${creditsAdded} credits from a successful referral. Keep sharing!`),
        type: 'success',
      });
    };

    window.addEventListener('referralCreditsEarned', handleReferralCredits);
    return () => {
      window.removeEventListener('referralCreditsEarned', handleReferralCredits);
    };
  }, [pushToast, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (storedTab && tabs.some((tab) => tab.value === storedTab)) {
      setActiveTab(storedTab);
    }

  }, [tabs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPreviewUsed(window.localStorage.getItem("watheq:previewQuotaUsed") === "true");
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

  useEffect(() => {
    setHRSuperSaudWorkflowState(hasResume ? "resumeUploaded" : "noResume");
  }, [hasResume, setHRSuperSaudWorkflowState]);

  // Persist job description to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobDescription) {
      window.localStorage.setItem(JOB_STORAGE_KEY, jobDescription);
    }
  }, [jobDescription]);

  // Warn user before closing tab with unsaved changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are applied optimizations that might not be exported
      const hasUnsavedChanges = optimizations.some((o) => o.applied);

      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = t(
          "workspace.unsavedChanges",
          "You have applied optimizations that may not be saved. Are you sure you want to leave?"
        );
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [optimizations, t]);

  // Show session recovery toast on mount if data was restored
  // Session recovery removed - was showing incorrect dates
  // Data is auto-loaded from Zustand persist, no toast needed
  useEffect(() => {
    // Reserved for future session recovery implementation
  }, []);

  const handleTabChange = useCallback((value) => {
    const targetTab = tabs.find((tab) => tab.value === value);
    if (targetTab?.disabledReason) {
      pushToast({
        type: "warning",
        title: t("workspace.resumeRequiredTitle", "Resume required"),
        description: targetTab.disabledReason,
      });
      return;
    }

    setActiveTab(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, value);
    }
  }, [pushToast, t, tabs]);

  useEffect(() => {
    if (!hasResume && activeTab !== "resume") {
      setActiveTab("resume");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TAB_STORAGE_KEY, "resume");
      }
    }
  }, [activeTab, hasResume]);

  const activeNavValue = SECONDARY_TAB_VALUES.has(activeTab) ? "more-tools" : activeTab;

  const hasNextTab = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.value === activeNavValue);
    return index >= 0 && index < tabs.length - 1;
  }, [activeNavValue, tabs]);

  const handleContinue = useCallback(() => {
    const index = tabs.findIndex((tab) => tab.value === activeNavValue);
    if (index >= 0 && index < tabs.length - 1) {
      handleTabChange(tabs[index + 1].value);
    }
  }, [activeNavValue, handleTabChange, tabs]);

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const hasJobAd = jobDescription.trim().length > 0;
    const hasTruthCheck = Boolean(truthCheckResult);
    const hasMatch = Boolean(matchAnalysis);
    const hasOptimization = Boolean(optimizationData) || optimizations.length > 0;
    const isExportStep = activeTab === "templates" || activeTab === "pipeline";

    const gatedStatus = (status: WorkflowStepStatus): WorkflowStepStatus =>
      hasResume ? status : "locked";

    return [
      {
        id: "resume",
        label: t("workspace.stepper.resume", "Resume"),
        hint: t("workspace.stepper.resumeHint", "Upload or paste"),
        status: activeTab === "resume" ? "active" : hasResume ? "completed" : "active",
        targetTab: "resume",
      },
      {
        id: "truth-check",
        label: t("workspace.stepper.truthCheck", "Truth Check"),
        hint: t("workspace.stepper.truthCheckHint", "Verify claims"),
        status: gatedStatus(activeTab === "truth-check" ? "active" : hasTruthCheck ? "completed" : "upcoming"),
        targetTab: "truth-check",
        lockedReason: resumeGateReason,
      },
      {
        id: "match",
        label: t("workspace.stepper.match", "Match"),
        hint: hasMatch
          ? t("workspace.stepper.matchHintReady", "Match ready")
          : hasJobAd
            ? t("workspace.stepper.matchHint", "Analyze fit")
            : t("workspace.stepper.matchHintNoJobAd", "Add job ad"),
        status: gatedStatus(activeTab === "match" ? "active" : hasMatch ? "completed" : "upcoming"),
        targetTab: "match",
        lockedReason: resumeGateReason,
      },
      {
        id: "optimize",
        label: t("workspace.stepper.optimize", "Optimize"),
        hint: t("workspace.stepper.optimizeHint", "Improve resume"),
        status: gatedStatus(activeTab === "optimize" ? "active" : hasOptimization ? "completed" : "upcoming"),
        targetTab: "optimize",
        lockedReason: resumeGateReason,
      },
      {
        id: "export",
        label: t("workspace.stepper.export", "Export / Pipeline"),
        hint: t("workspace.stepper.exportHint", "Save and track"),
        status: gatedStatus(isExportStep ? "active" : "upcoming"),
        targetTab: "templates",
        lockedReason: resumeGateReason,
      },
    ];
  }, [activeTab, hasResume, jobDescription, matchAnalysis, optimizationData, optimizations.length, resumeGateReason, t, truthCheckResult]);

  const persistPreviewUsage = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("watheq:previewQuotaUsed", "true");
    setPreviewUsed(true);
  }, []);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleClearAllData = useCallback(() => {
    // Show confirmation modal instead of deleting immediately
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteAllData = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clear all stored data
    window.localStorage.removeItem(RESUME_STORAGE_KEY);
    window.localStorage.removeItem(JOB_STORAGE_KEY);
    window.localStorage.removeItem(TRUTH_CHECK_STORAGE_KEY);

    // Reset local state
    setResumeData("");
    setJobDescription("");
    setMatchAnalysis(null);
    setTruthCheckResult(null);
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    setActiveTab("resume");
    resetPipelineContext();

    // Reset persisted Zustand store state
    useResumeStore.getState().clearAll();

    setShowDeleteConfirm(false);

    pushToast({
      type: "success",
      title: t("toasts.dataClearedTitle"),
      description: t("toasts.dataClearedDesc"),
    });
  }, [pushToast, resetPipelineContext, t]);

  const handleClearResume = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RESUME_STORAGE_KEY);
    window.localStorage.removeItem(TRUTH_CHECK_STORAGE_KEY);
    setResumeData("");
    // Also clear dependent data
    setMatchAnalysis(null);
    setTruthCheckResult(null);
    setJobDescription("");
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    resetPipelineContext();
    pushToast({ type: "success", title: t("toasts.resumeClearedTitle"), description: t("toasts.resumeClearedDesc") });
  }, [pushToast, resetPipelineContext, t]);

  const handleClearMatch = useCallback(() => {
    setMatchAnalysis(null);
    setJobDescription("");
    resetPipelineContext();
    pushToast({ type: "success", title: t("toasts.matchClearedTitle"), description: t("toasts.matchClearedDesc") });
  }, [pushToast, resetPipelineContext, t]);

  const handleClearOptimizations = useCallback(() => {
    // Clear local component state
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });

    // Clear persisted Zustand state (survives refresh via localStorage)
    const store = useResumeStore.getState();
    store.resetOptimizationMetrics();
    store.setKeywordSuggestions([]);
    store.setShowOptimized(false);

    pushToast({ type: "success", title: t("toasts.optimizationsClearedTitle"), description: t("toasts.optimizationsClearedDesc") });
  }, [pushToast, t]);

  const normalizeResumePayload = useCallback((input) => {
    if (input && typeof input === "object") {
      // Handle legacy format with kind property
      if (input.kind === "upload") {
        const { file, storage } = input;
        return {
          parseInput: file,
          storage: storage && typeof storage === "object" ? storage : null,
          fileName: file?.name || "Uploaded Resume",
        };
      }

      if (input.kind === "text") {
        return {
          parseInput: input.value,
          storage: null,
          fileName: "Pasted Text",
        };
      }

      // Handle input from UploadSection.tsx which passes { file } or { plainText }
      // This is the CRITICAL FIX for the [object Object] bug
      if (input.file instanceof File) {
        return {
          parseInput: input.file,
          storage: null,
          fileName: input.file.name,
        };
      }

      if (typeof input.plainText === "string") {
        return {
          parseInput: input.plainText,
          storage: null,
          fileName: "Pasted Resume Text",
        };
      }

      // If we get here, log a warning for debugging
      console.warn('[MainContent] ⚠️ normalizeResumePayload received unexpected object shape:', Object.keys(input));
    }

    return { parseInput: input, storage: null, fileName: "Uploaded Resume" };
  }, []);

  const handleParseResume = useCallback(
    async (resumeInput, signal?: AbortSignal) => {
      const { parseInput, storage, fileName } = normalizeResumePayload(resumeInput);

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
        const parsed = await parseResume(parseInput, {
          signal,
          guestPreview: isGuestMode,
          // Notify the user when the browser cannot extract enough selectable text.
          onOcrFallback: () => {
            pushToast(
              {
                type: 'info',
                title: t('toasts.ocrFallbackTitle', 'Checking document text'),
                description: t(
                  'toasts.ocrFallbackDesc',
                  'This file has little selectable text. If it is scanned or image-based, paste the resume text or upload a text-based PDF.'
                ),
              },
              { id: TOAST_IDS.upload }
            );
          },
        });
        setFlowProgress(88);
        const enriched =
          parsed
            ? {
              ...parsed,
              fileName: fileName || parsed.fileName || "Resume", // Ensure fileName is persisted
              storagePath: storage?.path,
              storageBucket: storage?.bucket,
              storageFileName: storage?.fileName,
              storageUserId: storage?.userId,
            }
            : parsed;
        setResumeData(enriched);
        setMatchAnalysis(null);
        setTruthCheckResult(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(TRUTH_CHECK_STORAGE_KEY);
        }
        setJobDescription("");
        setOptimizations([]);
        setOptimizationData(null);
        setOptimizationKeywords({ add: [], remove: [], neutral: [] });
        resetPipelineContext();
        emitHRSuperSaudEvent('resume.uploaded');
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
        if (isGuestMode) {
          const telemetry = getGuestPreviewLimitTelemetry(error);
          if (telemetry) {
            analytics.trackGuestPreviewLimitHit(telemetry);
          }
        }
        if (isAuthRequiredError(error)) {
          pushToast(
            {
              type: "warning",
              title: t("toasts.signInRequired"),
              description: t("toasts.signInRequiredDesc"),
            },
            { id: TOAST_IDS.upload }
          );
          throw error;
        }

        emitHRSuperSaudEvent('error.generic');
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
    [isGuestMode, normalizeResumePayload, pushToast, resetPipelineContext, t]
  );

  const handleAnalyzeMatchAI = useCallback(
    async (jobDescriptionInput) => {
      if (isGuestMode) {
        requireSignInForGuestAction();
        throw new Error(guestProtectedActionDescription);
      }

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
        resetPipelineContext();

        // Non-blocking metadata extraction from pasted job description
        extractJobMetadata(trimmedJob, i18n.language)
          .then((metadata) => {
            setExtractedMetadata(metadata ?? null);
            if (metadata?.companyName || metadata?.jobTitle || metadata?.location) {
              analytics.trackJobMetadataExtracted(metadata.confidence);
            } else {
              analytics.trackJobMetadataExtractionFailed('no_metadata_extracted');
            }
          })
          .catch(() => {
            setExtractedMetadata(null);
            analytics.trackJobMetadataExtractionFailed('request_failed');
          });

        // Fix B1: Always analyze the ORIGINAL resume text for match scoring
        // This prevents the optimized score (e.g. 87) from leaking into match analysis
        // when showOptimized is true after optimization + download
        const { parsedResumeText } = useResumeStore.getState();
        const resumeTextToAnalyze: string = parsedResumeText || resumeData.plainText || '';

        const result = await analyzeResumeWithAI(resumeTextToAnalyze, trimmedJob, i18n.language);
        setAiDebug(buildAiDebugSnapshot(result, "success"));
        setMatchAnalysis(result);
        setJobDescription(trimmedJob);

        // Cache the match analysis score so OptimizeSection can read it
        // This fixes the issue where "BEFORE" score shows 55% instead of the actual match score
        if (result && typeof result.score === 'number') {
          const { setCachedAnalysis, setOptimizationMetrics, setBaselineMatchScore } = useResumeStore.getState();
          // CRITICAL: Cache using the SAME text we used for analysis
          // This ensures cache key matches what we analyzed (original or optimized)
          setCachedAnalysis(resumeTextToAnalyze, trimmedJob, {
            score: result.score,
            matchedKeywords: result.matchedKeywords || result.topHits || [],
            missingKeywords: result.missingKeywords || [],
            suggestions: result.suggestions || [],
            reasoning: result.reasoning || '',
          });

          // Always save match analysis score — line 500 already ensures we analyze
          // the ORIGINAL resume text regardless of showOptimized state.
          // Previous guards (!showOptimized) caused a bug where the match score (15%)
          // was never saved, letting the optimize API overwrite it with its own score (77%).
          setOptimizationMetrics({
            beforeScore: result.score,
            hasJobDescription: true,
            // Store match analysis categoryScores so ScoreBreakdown uses
            // authoritative scores instead of the optimize API's divergent ones.
            ...(result.categoryScores && { categoryScores: result.categoryScores }),
          });

          // Always update baseline score on each match analysis of the original resume.
          // The old guard (baselineMatchScore === null) prevented updates when the user
          // re-analyzed with a different job description.
          setBaselineMatchScore(result.score);
          emitHRSuperSaudEvent(result.score >= 70 ? 'match.high' : 'match.low', {
            score: result.score,
          });
        }

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
        setAiDebug(buildAiDebugSnapshot(error, "error"));
        setFlowProgress(0);
        emitHRSuperSaudEvent('error.generic');
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
    [guestProtectedActionDescription, i18n.language, isGuestMode, pushToast, requireSignInForGuestAction, resetPipelineContext, resumeData, t]
  );

  const handleAnalyzeTruthCheck = useCallback(async () => {
    if (isGuestMode) {
      requireSignInForGuestAction();
      return null;
    }

    const { parsedResumeText } = useResumeStore.getState();
    const resumeTextToAnalyze: string = parsedResumeText || resumeData?.plainText || "";
    if (!resumeTextToAnalyze.trim()) {
      pushToast({
        type: "warning",
        title: t("toasts.resumeRequired"),
        description: t("toasts.resumeRequiredDesc"),
      });
      return null;
    }

    const resumeHash = getResumeFingerprint(resumeTextToAnalyze);
    const cached = loadCachedTruthCheck(resumeTextToAnalyze);
    if (cached) {
      setTruthCheckResult(cached);
      return cached;
    }

    try {
      setIsTruthChecking(true);
      pushToast(
        {
          type: "info",
          title: t("sections.truthCheck.toasts.running", "Running Truth Check"),
          description: t("sections.truthCheck.toasts.runningDesc", "Checking claims against your resume evidence."),
        },
        { id: TOAST_IDS.truthCheck }
      );

      const result = await analyzeResumeTruthCheck({
        resumeText: resumeTextToAnalyze,
        language: i18n.language,
      }) as ResumeTruthCheckResult;

      setAiDebug(buildAiDebugSnapshot(result, "success"));
      setTruthCheckResult(result);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TRUTH_CHECK_STORAGE_KEY, JSON.stringify({
          resumeHash,
          result,
          timestamp: new Date().toISOString(),
        }));
      }
      analytics.trackResumeTruthCheck({
        overallRisk: result.overallRisk,
        claimCount: result.claims.length,
        highSeverityCount: result.claims.filter((claim) => claim.severity === "high").length,
      });
      pushToast(
        {
          type: "success",
          title: t("sections.truthCheck.toasts.complete", "Truth Check ready"),
          description: t("sections.truthCheck.toasts.completeDesc", "Review the claims that may need clearer evidence."),
        },
        { id: TOAST_IDS.truthCheck }
      );
      return result;
    } catch (error) {
      setAiDebug(buildAiDebugSnapshot(error, "error"));
      pushToast(
        {
          type: "danger",
          title: t("sections.truthCheck.toasts.failed", "Truth Check failed"),
          description: error instanceof Error ? error.message : t("sections.truthCheck.toasts.failedDesc", "Please try again in a moment."),
        },
        { id: TOAST_IDS.truthCheck }
      );
      throw error;
    } finally {
      setIsTruthChecking(false);
    }
  }, [i18n.language, isGuestMode, pushToast, requireSignInForGuestAction, resumeData?.plainText, t]);

  // Internal: runs the real SSE optimize call with optional clarifications baked in
  const handleOptimizeActual = useCallback(
    async ({ mode, workHistory, userClarifications, userHardStops }: { mode?: string; workHistory?: WorkEntry[]; userClarifications?: string; userHardStops?: string[] }) => {
      if (isGuestMode) {
        requireSignInForGuestAction();
        return null;
      }

      if (!resumeData?.plainText || !jobDescription) return null;
      try {
        setIsOptimizing(true);
        setFlowProgress(32);
        pushToast(
          {
            type: 'info',
            title: t('toasts.generatingOptimizations'),
            description: t('toasts.generatingOptimizationsDesc'),
          },
          { id: TOAST_IDS.optimize }
        );

        // Phase progress messages for SSE stream
        const phaseMessages: Record<string, string> = {
          validating: t('toasts.optimizeValidating', 'Validating your resume...'),
          detecting_vulnerabilities: t('toasts.optimizeVulnerabilities', 'Scanning career timeline...'),
          ai_processing: t('toasts.optimizeAI', 'AI is analyzing and rewriting bullets...'),
          building_response: t('toasts.optimizeBuildingResponse', 'Building optimization cards...'),
        };

        let result;
        try {
          // Try SSE streaming endpoint first
          result = await optimizeResumeStream(
            {
              resumeText: resumeData.plainText,
              jobDesc: jobDescription,
              mode,
              preview: !isPremium,
              language: i18n.language,
              workHistory,
              userClarifications,
              userHardStops,
              searchIntent: useResumeStore.getState().searchIntent,
            },
            // onStatus callback: update toast with real-time progress
            (phase) => {
              const message = phaseMessages[phase];
              if (message) {
                pushToast(
                  {
                    type: 'info',
                    title: t('toasts.generatingOptimizations'),
                    description: message,
                  },
                  { id: TOAST_IDS.optimize }
                );
              }
            }
          );
        } catch (streamError: any) {
          if (streamError.isBillingStateUnknown) {
            // Stream opened (2xx) then failed — credits may have been consumed on the server.
            // Do NOT fall back to legacy: that would trigger a second paid optimization request.
            // Force-refresh credit balance so the UI reflects what actually happened.
            refetchCredits().catch(() => { /* non-blocking */ });
            throw new Error(t('credits.connectionInterrupted',
              'The connection was interrupted while optimization was running. Your credits may have already been used. Please refresh your balance before trying again.'));
          }
          // Server explicitly rejected before processing (non-2xx, SSE error event) —
          // billing state is known-safe, fall back to legacy endpoint.
          console.warn('[optimize] SSE rejected before processing, falling back to legacy:', streamError.message);
          result = await optimizeResume(
            {
              resumeText: resumeData.plainText,
              jobDesc: jobDescription,
              mode,
              preview: !isPremium,
              language: i18n.language,
              workHistory,
              userClarifications,
              userHardStops,
              searchIntent: useResumeStore.getState().searchIntent,
            }
          );
        }
        setAiDebug(buildAiDebugSnapshot(result, "success"));

        // Build full cards array including projects and certifications
        const allCards = [...(result.cards ?? [])];

        // Add projectImprovements as cards (if any)
        if (result.projectImprovements && Array.isArray(result.projectImprovements)) {
          result.projectImprovements.forEach((proj: { project_name?: string; original?: string; improved?: string; issue?: string; rationale?: string }, index: number) => {
            if (proj.improved || proj.original) {
              allCards.push({
                section: 'Projects',
                issue: proj.issue || 'Project description could be more impactful',
                suggestion: proj.rationale || 'Reframe project to highlight relevant skills',
                exampleBefore: proj.original || '',
                exampleAfter: proj.improved || '',
              });
            }
          });
        }

        // Add certificationRecommendations as display-only cards (if any)
        if (result.certificationRecommendations && Array.isArray(result.certificationRecommendations)) {
          result.certificationRecommendations.forEach((cert: { name?: string; issuer?: string; relevance?: string }, index: number) => {
            if (cert.name) {
              allCards.push({
                section: 'Certifications',
                issue: 'Recommended certification to strengthen your profile',
                suggestion: cert.relevance || 'This certification aligns with job requirements',
                exampleBefore: 'Recommended Certification',
                exampleAfter: `${cert.name || ''} (${cert.issuer || ''})`,
              });
            }
          });
        }

        setOptimizations(allCards);
        setOptimizationData(result.optimization ?? null);
        setOptimizationKeywords(result.keywords ?? { add: [], remove: [], neutral: [] });

        // FIX: Also persist keywords to Zustand store so they survive page refresh
        if (result.keywords) {
          const suggestions: { keyword: string; category: 'add' | 'keep' | 'deemphasize' }[] = [];
          if (result.keywords.add) {
            result.keywords.add.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'add' }));
          }
          if (result.keywords.neutral) {
            result.keywords.neutral.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'keep' }));
          }
          if (result.keywords.remove) {
            result.keywords.remove.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'deemphasize' }));
          }
          useResumeStore.getState().setKeywordSuggestions(suggestions);
        }

        // FIX: Store optimization metrics (gapAnalysis, matchScoring, categoryScores, positionSuggestion) in Zustand
        // These were previously discarded, causing gap analysis and optimized score to not appear
        const { setOptimizationMetrics } = useResumeStore.getState();
        if (result.matchScoring || result.gapAnalysis || result.categoryScores || result.positionSuggestion !== undefined) {
          setOptimizationMetrics({
            ...(result.matchScoring && {
              beforeScore: result.matchScoring.beforeScore,
              afterScore: result.matchScoring.afterScore
                ?? (result.matchScoring.beforeScore != null && (result.matchScoring.estimatedImprovement ?? result.matchScoring.improvement) != null
                  ? result.matchScoring.beforeScore + (result.matchScoring.estimatedImprovement ?? result.matchScoring.improvement)
                  : null),
              improvement: result.matchScoring.improvement
                ?? result.matchScoring.estimatedImprovement
                ?? null,
              jdKeywords: result.matchScoring.jdKeywords || [],
              matchedKeywords: result.matchScoring.matchedKeywords || [],
              reasoning: result.matchScoring.reasoning,
              hasJobDescription: true,
            }),
            ...(result.gapAnalysis && { gapAnalysis: result.gapAnalysis }),
            ...(result.categoryScores && { categoryScores: result.categoryScores }),
            // Position name suggestion: only store when AI says it's necessary, otherwise clear stale ones
            positionSuggestion: result.positionSuggestion?.is_necessary === true
              ? result.positionSuggestion
              : null,
          });
        }
        emitHRSuperSaudEvent('optimize.success', {
          score: result.matchScoring?.afterScore
            ?? (
              result.matchScoring?.beforeScore != null && (result.matchScoring?.estimatedImprovement ?? result.matchScoring?.improvement) != null
                ? result.matchScoring.beforeScore + (result.matchScoring.estimatedImprovement ?? result.matchScoring.improvement)
                : null
            ),
        });
        pushToast(
          {
            type: result.source === "gemini" && result.cards?.length > 0 ? "success" : "warning",
            title: t("toasts.optimizationReady"),
            description:
              result.source === "gemini" && result.cards?.length > 0
                ? "Review AI-crafted rewrites and keywords."
                : "No optimizations were generated. Please try again with more context.",
          },
          { id: TOAST_IDS.optimize }
        );

        if (!isPremium && !previewUsed) {
          persistPreviewUsage();
        }

        setFlowProgress(100);
        scheduleTimeout(() => setFlowProgress(0), 900);
        return result;
      } catch (error: any) {
        setAiDebug(buildAiDebugSnapshot(error, "error"));
        setFlowProgress(0);
        emitHRSuperSaudEvent('error.generic');

        // Error handling logic moved from invalid 2nd argument of optimizeResume
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

        throw error;
      } finally {
        setIsOptimizing(false);
      }
    },
    [i18n.language, isGuestMode, isPremium, jobDescription, persistPreviewUsage, previewUsed, pushToast, refetchCredits, requireSignInForGuestAction, resumeData, t]
  );

  // Gate function: runs clarification step first, then delegates to handleOptimizeActual
  const handleOptimize = useCallback(
    async (mode) => {
      if (isGuestMode) {
        requireSignInForGuestAction();
        return null;
      }

      if (!resumeData?.plainText || !jobDescription) {
        pushToast({
          type: "warning",
          title: "Add job context",
          description: "Run a match analysis before requesting optimizations.",
        });
        return null;
      }

      // Guard against double-clicks or re-entrant calls while already processing
      if (isOptimizing || isInterrogating) return null;

      /** Helper: build typed work-history from Zustand store */
      const buildWorkHistory = (): WorkEntry[] | undefined => {
        const storeWork = useResumeStore.getState().originalResume?.work;
        return storeWork
          ?.map(w => ({
            name: w.name || '',
            position: w.position || '',
            startDate: w.startDate || '',
            endDate: w.endDate || '',
          }))
          .filter(w => w.name && w.position) || undefined;
      };

      try {
        const workHistory = buildWorkHistory();

        // E1: only skip the clarification endpoint when deterministic evidence
        // says this is a known strong match with no career vulnerabilities.
        if (!shouldRequestClarifications(matchAnalysis?.score, workHistory)) {
          return await handleOptimizeActual({ mode, workHistory });
        }

        // ---- Clarification Step (free, non-fatal) ----
        // Show a lightweight toast while we call the gap-analysis endpoint
        pushToast(
          {
            type: 'info',
            title: t('toasts.generatingOptimizations'),
            description: t('toasts.analyzingGaps', 'Analyzing resume gaps…'),
          },
          { id: TOAST_IDS.optimize }
        );

        const clarifyResult = await generateClarifications({
          resumeText: resumeData.plainText,
          jobDesc: jobDescription,
          language: i18n.language,
        });

        if (clarifyResult.clarifications?.length > 0) {
          // Pause the flow — show the modal and wait for user answers
          setClarificationQuestions(clarifyResult.clarifications);
          setPendingOptimizeArgs({ mode, workHistory });
          setIsInterrogating(true);
          setIsOptimizing(false);
          setFlowProgress(0);
          return null; // resume in handleClarificationSubmit / handleClarificationSkip
        }

        // No questions → fall through to the actual optimize call
        return await handleOptimizeActual({ mode, workHistory, userClarifications: undefined });
      } catch (outerError) {
        // If clarification itself throws (shouldn't — it's non-fatal), proceed anyway
        console.warn('[handleOptimize] Clarification error, proceeding without:', outerError);
        return await handleOptimizeActual({ mode, workHistory: buildWorkHistory(), userClarifications: undefined });
      }
    },
    [handleOptimizeActual, i18n.language, isGuestMode, isInterrogating, isOptimizing, jobDescription, matchAnalysis?.score, pushToast, requireSignInForGuestAction, resumeData, t]
  );

  // ---- Clarification modal handlers ----

  const handleClarificationSubmit = useCallback(async (answers: ClarificationAnswers) => {
    setIsInterrogating(false);
    const { userClarifications, userHardStops } = formatClarificationAnswers(
      clarificationQuestions,
      answers,
      t('clarificationModal.hardStopFallback', "I don't have this / I never do this"),
    );
    const { mode, workHistory } = pendingOptimizeArgs || {};
    setPendingOptimizeArgs(null);
    setClarificationQuestions([]);
    await handleOptimizeActual({ mode, workHistory, userClarifications, userHardStops });
  }, [clarificationQuestions, handleOptimizeActual, pendingOptimizeArgs, t]);

  const handleClarificationSkip = useCallback(async () => {
    setIsInterrogating(false);
    const { mode, workHistory } = pendingOptimizeArgs || {};
    setPendingOptimizeArgs(null);
    setClarificationQuestions([]);
    await handleOptimizeActual({ mode, workHistory, userClarifications: undefined });
  }, [handleOptimizeActual, pendingOptimizeArgs]);

  /** Re-generate clarification questions (user pressed refresh icon) */
  const handleRegenerate = useCallback(async () => {
    if (isGuestMode) {
      requireSignInForGuestAction();
      return;
    }
    if (!resumeData?.plainText || !jobDescription) return;
    setIsRegenerating(true);
    try {
      const result = await generateClarifications({
        resumeText: resumeData.plainText,
        jobDesc: jobDescription,
        language: i18n.language,
      });
      if (result.clarifications?.length > 0) {
        setClarificationQuestions(result.clarifications);
      } else {
        // No questions generated — skip straight to optimize
        handleClarificationSkip();
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [i18n.language, isGuestMode, jobDescription, handleClarificationSkip, requireSignInForGuestAction, resumeData]);

  const handleMarkApplied = useCallback(async () => {
    if (isGuestMode) {
      requireSignInForGuestAction();
      return;
    }

    if (!activeJobApplicationId) return;
    try {
      const { data, error } = await updateJobApplication(activeJobApplicationId, { status: 'applied' });
      if (!error && data) {
        pushToast({
          type: 'success',
          title: t('pipeline.markAsApplied', 'Mark as Applied'),
          description: t('pipeline.applied', 'Applied'),
        });
        setActiveJobApplicationId(data.id);
      }
    } catch (e) {
      console.warn('[MainContent] handleMarkApplied error:', e);
    }
  }, [activeJobApplicationId, isGuestMode, pushToast, requireSignInForGuestAction, t]);

  const handleAttachExport = useCallback(async () => {
    if (isGuestMode) {
      requireSignInForGuestAction();
      return;
    }

    if (!activeJobApplicationId || !pendingAttachment) return;
    try {
      const { data, error } = await attachExportToJobApplication(
        activeJobApplicationId,
        pendingAttachment.filePath,
        pendingAttachment.fileName
      );
      if (!error && data) {
        pushToast({
          type: 'success',
          title: t('pipeline.exportAttached', 'Resume attached'),
          description: pendingAttachment.fileName,
        });
        setPendingAttachment(null);
        setExportedJobApplicationId(data.id);
        analytics.trackPipelineExportAttached();
      }
    } catch (e) {
      console.warn('[MainContent] handleAttachExport error:', e);
    }
  }, [activeJobApplicationId, isGuestMode, pendingAttachment, pushToast, requireSignInForGuestAction, t]);

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

  // Memoized callback for InterviewSection to avoid re-renders
  const handleResumeDataUpdate = useCallback((updates) => {
    setResumeData(prev => ({ ...prev, ...updates }));
  }, []);

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
        if (isGuestMode && exportMethod === "supabase") {
          requireSignInForGuestAction();
          return;
        }

        // Merge original resume with AI optimizations (Hard Overrides + Smart Match)
        const mergedResume = mergeResumeData(resumeData, {
          optimization: optimizationData,
          candidateProfile: null, // Add if available
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

        const canSaveToSupabase = exportMethod === "supabase" && isSupabaseExportAvailable() && Boolean(user);

        if (exportMethod === "supabase" && isSupabaseExportAvailable() && !user) {
          pushToast({
            type: "warning",
            title: t("toasts.signInRequired"),
            description: t("toasts.signInRequiredDesc"),
          });
        }

        // Check export method
        if (canSaveToSupabase) {
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
            description: t("toasts.resumeSavedSecurely", 'Your resume "{{fileName}}" has been saved securely.', { fileName: result.fileName }),
          });

          if (activeJobApplicationId && result.filePath && result.fileName) {
            setPendingAttachment({
              filePath: result.filePath,
              fileName: result.fileName,
            });
            setExportedJobApplicationId(activeJobApplicationId);
          }

          if (result.signedUrl) {
            const link = document.createElement('a');
            link.href = result.signedUrl;
            link.download = result.fileName || 'Resume_Optimized.html';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } else {
          // Fallback to print dialog if Supabase is not available or user not signed in
          await exportResumeToPdf({
            resumeDocument: mergedResume || resumeData,
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
        emitHRSuperSaudEvent('error.generic');
        pushToast({
          type: "danger",
          title: t("toasts.exportFailed"),
          description: error?.message || "Unable to export resume. Please try again.",
        });
      }
    },
    [activeJobApplicationId, isGuestMode, jobDescription, matchAnalysis, optimizationData, optimizations, optimizationKeywords, pushToast, requireSignInForGuestAction, resumeData, user, t]
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

  const secondaryToolTabs = useMemo(
    () => getTabsConfig(t).filter((tab) => SECONDARY_TAB_VALUES.has(tab.value)),
    [t]
  );

  const renderClearAllAction = (showText: boolean) =>
    resumeData?.plainText ? (
      <button
        type="button"
        onClick={handleClearAllData}
        className="btn-danger-glass flex-shrink-0 group flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200"
        title={t("workspace.clearAll")}
        aria-label={t("workspace.clearAll")}
      >
        <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
        <span className={showText ? undefined : "hidden sm:inline"}>{t("workspace.clearAll")}</span>
      </button>
    ) : undefined;

  const guestNotice = t(
    "workspace.guest.notice",
    "You're previewing Watheq. Sign in to save progress and use pipeline features."
  );

  const renderGuestProtectedPanel = (title: string) => (
    <GlassCard className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <LogIn className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-gray-600 dark:text-emerald-100/75">
          {guestProtectedActionDescription}
        </p>
      </div>
      <GlassButton variant="primary" onClick={() => handleGuestSignIn("guest_protected_action")}>
        <LogIn className="h-4 w-4 me-2" />
        {t("workspace.guest.signInCta", "Sign in to save progress")}
      </GlassButton>
    </GlassCard>
  );

  const renderMoreToolsPanel = () => (
    <GlassCard className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {t("tabs.moreTools", "More tools")}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-emerald-100/75">
          {t(
            "workspace.moreTools.description",
            "Use these after the core resume workflow when you need deeper preparation or tracking."
          )}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {secondaryToolTabs.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.value}
              type="button"
              onClick={() => handleTabChange(tool.value)}
              className="group flex items-center gap-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-4 text-start transition-colors hover:border-[color:var(--glass-border-strong)] hover:bg-[color:var(--surface-control-hover)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                  {tool.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-emerald-100/70">
                  {t("workspace.moreTools.openTool", "Open tool")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );

  const workspace = (
    <ParallaxContainer enableLayers={false} className="py-1">
      <div className="space-y-3 sm:space-y-3 text-gray-900 dark:text-surface-50">
        {isGuestMode && (
          <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/50 px-4 py-3 dark:border-emerald-200/14 dark:bg-emerald-900/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium leading-5 text-gray-700 dark:text-emerald-100/82">
                {guestNotice}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
                <GlassButton variant="primary" size="sm" onClick={() => handleGuestSignIn("guest_banner")}>
                  <LogIn className="h-4 w-4 me-2" />
                  {t("workspace.guest.signInCta", "Sign in to save progress")}
                </GlassButton>
                <GlassButton variant="secondary" size="sm" onClick={exitGuestMode}>
                  {t("workspace.guest.backToLanding", "Back to landing")}
                </GlassButton>
              </div>
            </div>
          </div>
        )}

        {/* Workflow navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="sm:hidden">
              <MobileWorkflowNav
                primarySteps={mobilePrimarySteps}
                secondarySteps={mobileSecondarySteps}
                activeValue={activeTab}
                onStepChange={handleTabChange}
                gateReason={mobileWorkflowGateReason}
                rightAction={renderClearAllAction(false)}
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-start gap-3">
                <WorkflowStepper
                  steps={workflowSteps}
                  onStepClick={handleTabChange}
                  className="flex-1"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <GlassButton
                    type="button"
                    variant={activeNavValue === "more-tools" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => handleTabChange("more-tools")}
                    disabled={!hasResume}
                    title={!hasResume ? resumeGateReason : undefined}
                    className="whitespace-nowrap"
                  >
                    <MoreHorizontal className="h-4 w-4 me-1.5" />
                    {t("tabs.moreTools", "More tools")}
                  </GlassButton>
                  {renderClearAllAction(false)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-panel relative min-h-[420px] p-4 transition-shadow duration-300 sm:min-h-[480px] sm:p-5 lg:p-6">
          {/* Parse-quality warning — shown on all tabs so the user always sees it */}
          {activeTab !== "resume" && <ParsingWarningsBanner />}
          {activeTab === "resume" && (
            <>
              <UploadSection
                onParseResume={handleParseResume}
                resumeDocument={resumeData}
                onToast={handleUploadToast}
                onClear={handleClearResume}
              />
              {/* Path-A inline intent capture — auto-shows after a successful parse,
                  skippable, never blocks upload. Stays mounted across role -> comp ->
                  location; only unmounts when the child resolves the prompt. */}
              {hasParsedResume && !intentPrompted && (
                <div className="mt-4">
                  <OnboardingChat
                    path="has_cv"
                    mode="inline"
                    onComplete={resolveIntentPrompt}
                    onDismiss={resolveIntentPrompt}
                  />
                </div>
              )}
            </>
          )}
          {activeTab === "match" && (
            <LazyErrorBoundary label="Match section">
              <Suspense fallback={<SectionSkeleton />}>
                <MatchSection
                  onAnalyzeMatchAI={handleAnalyzeMatchAI}
                  matchAnalysis={matchAnalysis}
                  isAnalyzing={isAnalyzing}
                  hasResume={Boolean(resumeData?.plainText)}
                  resumeText={resumeData?.plainText || ''}
                  onToast={pushToast}
                  onClear={handleClearMatch}
                  jobDescription={jobDescription}
                  extractedMetadata={extractedMetadata}
                  onJobSaved={handleJobSavedToPipeline}
                  isGuestMode={isGuestMode}
                  onRequireSignIn={requireSignInForGuestAction}
                  protectedActionMessage={guestProtectedActionDescription}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "truth-check" && (
            <LazyErrorBoundary label="Truth Check section">
              <Suspense fallback={<SectionSkeleton />}>
                <TruthCheckSection
                  resumeText={resumeData?.plainText || ""}
                  result={truthCheckResult}
                  isAnalyzing={isTruthChecking}
                  onAnalyze={handleAnalyzeTruthCheck}
                  onToast={pushToast}
                  isGuestMode={isGuestMode}
                  onRequireSignIn={requireSignInForGuestAction}
                  protectedActionMessage={guestProtectedActionDescription}
                  onContinue={() => handleTabChange("match")}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "vision2030" && (
            <LazyErrorBoundary label="Vision 2030 section">
              <Suspense fallback={<SectionSkeleton />}>
                {isGuestMode
                  ? renderGuestProtectedPanel(t("tabs.vision2030", "Vision 2030"))
                  : (
                    <Vision2030Section
                      resumeText={resumeData?.plainText || ''}
                      onToast={pushToast}
                    />
                  )}
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "optimize" && (
            <LazyErrorBoundary label="Optimize section">
              <Suspense fallback={<SectionSkeleton />}>
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
                  activeJobApplicationId={activeJobApplicationId}
                  pendingAttachment={pendingAttachment}
                  onMarkApplied={handleMarkApplied}
                  onAttachExport={handleAttachExport}
                  hasExportedForActiveJob={exportedJobApplicationId === activeJobApplicationId}
                  isGuestMode={isGuestMode}
                  onRequireSignIn={requireSignInForGuestAction}
                  protectedActionMessage={guestProtectedActionDescription}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {activeTab === "templates" && (
            <TemplateGallery
              resumeData={resumeData}
              optimizationData={optimizationData}
            />
          )}
          {activeTab === "more-tools" && renderMoreToolsPanel()}
          {activeTab === "interview" && (
            <LazyErrorBoundary label="Interview section">
              <Suspense fallback={<SectionSkeleton />}>
                {isGuestMode
                  ? renderGuestProtectedPanel(t("tabs.interview", "Interview"))
                  : (
                    <InterviewSection
                      jobDescription={jobDescription}
                      resumeText={resumeData?.plainText || ""}
                      matchAnalysis={matchAnalysis}
                      resumeData={resumeData}
                      onUpdate={handleResumeDataUpdate}
                    />
                  )}
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "bulk" && (
            <LazyErrorBoundary label="Bulk Analysis section">
              <Suspense fallback={<SectionSkeleton />}>
                {isGuestMode
                  ? renderGuestProtectedPanel(t("tabs.bulk", "Bulk"))
                  : (
                    <BulkAnalysisSection
                      jobDescription={jobDescription}
                    />
                  )}
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "cover-letter" && (
            <LazyErrorBoundary label="Cover Letter section">
              <Suspense fallback={<SectionSkeleton />}>
                {isGuestMode
                  ? renderGuestProtectedPanel(t("tabs.coverLetter", "Cover Letter"))
                  : (
                    <CoverLetterSection
                      resumeText={resumeData?.plainText || ""}
                      jobDescription={jobDescription}
                      resumeData={resumeData}
                    />
                  )}
              </Suspense>
            </LazyErrorBoundary>
          )}
          {activeTab === "pipeline" && (
            <LazyErrorBoundary label="Pipeline section">
              <Suspense fallback={<SectionSkeleton />}>
                {isGuestMode
                  ? renderGuestProtectedPanel(t("tabs.pipeline", "Pipeline"))
                  : <PipelineSection />}
              </Suspense>
            </LazyErrorBoundary>
          )}
        </div>

        {hasNextTab && (
          <div className="flex justify-center sm:justify-end mt-4">
            <GlassButton
              variant="secondary"
              onClick={handleContinue}
              disabled={!hasResume}
              title={!hasResume ? resumeGateReason : undefined}
              className="justify-center"
            >
              <ArrowRight className="w-4 h-4 me-2" />
              {t("workspace.continue")}
            </GlassButton>
          </div>
        )}

      </div>
    </ParallaxContainer>
  );

  if (!user && !isGuestMode) {
    if (loading) {
      return (
        <div className="relative isolate z-20 flex-1 flex flex-col w-full h-full">
          <ToastContainer>{renderedToasts}</ToastContainer>
          <div className="flex-1 flex items-center justify-center p-8">
            <SectionSkeleton />
          </div>
        </div>
      );
    }
    return (
      <div className="relative isolate z-20 flex-1 flex flex-col w-full h-full">
        <ToastContainer>{renderedToasts}</ToastContainer>
        <Suspense fallback={<SectionSkeleton />}>
          <LandingPage
            onGetStarted={enterGuestMode}
            onSignIn={() => handleGuestSignIn()}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <main
      data-app-main
      className="relative isolate z-20 min-h-screen pb-16 sm:pb-24 lg:pb-32"
    >
      <ToastContainer>{renderedToasts}</ToastContainer>
      <ViewTextModal
        isOpen={viewTextModalOpen}
        onClose={() => setViewTextModalOpen(false)}
        text={resumeData?.plainText || ""}
      />

      {/* Clarification Modal — pre-optimization gap interrogation */}
      <ClarificationModal
        questions={clarificationQuestions}
        isOpen={isInterrogating}
        isRegenerating={isRegenerating}
        onSubmit={handleClarificationSubmit}
        onSkip={handleClarificationSkip}
        onRegenerate={handleRegenerate}
      />

      {/* Delete All Data Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setShowDeleteConfirm(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md neu-card shadow-2xl rounded-2xl animate-scale-in overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-white/10">
              <div className="p-2 neu-inset rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("workspace.deleteAllConfirm.title", "Delete All Data?")}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                {t(
                  "workspace.deleteAllConfirm.description",
                  "This will permanently delete your uploaded resume, optimizations, and all saved progress. This action cannot be undone."
                )}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 sm:flex-none px-4 py-2 font-medium rounded-xl transition-all duration-300 bg-gray-100 dark:bg-gray-900/80 hover:bg-gray-200 dark:hover:bg-black border border-gray-300/50 dark:border-white/10 text-gray-900 dark:text-white shadow-md active:scale-95"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  onClick={confirmDeleteAllData}
                  className="flex-1 sm:flex-none px-4 py-2 font-medium rounded-xl transition-all duration-300 bg-red-500 hover:bg-red-600 text-white shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_8px_30px_rgba(239,68,68,0.4)] border border-red-400/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("workspace.deleteAllConfirm.confirm", "Delete All")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`${containerClass} space-y-4 sm:space-y-10 lg:space-y-12 text-gray-900 dark:text-surface-50 p-4 sm:p-6 lg:p-8`}>
        <div>
          {flowProgress > 0 && (
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/10 dark:bg-black/45">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 transition-all duration-300"
                style={{ width: `${flowProgress}%` }}
                aria-hidden="true"
              />
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="h-8 w-40 rounded-full bg-emerald-900/10 dark:bg-white/10" />
              <div className="h-96 w-full overflow-hidden rounded-[var(--radius-card)] bg-white/80 dark:bg-black/35">
                <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-surface-50/40 to-transparent" />
              </div>
            </div>
          ) : (
            workspace
          )}
        </div>
        {isDev && aiDebug && (
          <section className="text-xs text-ink-500 dark:text-surface-50/70">
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 backdrop-blur-md shadow-xl p-4 sm:p-5">
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
              {aiDebug.errorDetail && (
                <p className="mt-3 break-words text-[10px] text-ink-500/80 dark:text-surface-50/60">
                  Error: {aiDebug.errorDetail}
                </p>
              )}
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





