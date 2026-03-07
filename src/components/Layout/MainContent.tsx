import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Sparkles, Target, UserPlus, LogIn, MessageSquare, Mail, LayoutTemplate, Trash2, AlertTriangle } from "lucide-react";
import {
  parseResume,
  analyzeResumeWithAI,
  optimizeResume,
} from "../../services/api.js";
import { useAuth } from "../../hooks/useAuth";
import UploadSection from "../sections/UploadSection";
import TemplateGallery from "../sections/TemplatesSection";
// KeywordsSection removed from MVP navigation - functionality merged into Optimize section

// Lazy-loaded tab sections — each gets its own chunk
const MatchSection = lazy(() => import("../sections/MatchSection").then(m => ({ default: m.MatchSection })));
const OptimizeSection = lazy(() => import("../sections/OptimizeSection").then(m => ({ default: m.OptimizeSection })));
const InterviewSection = lazy(() => import("../sections/InterviewSection").then(m => ({ default: m.InterviewSection })));
const BulkAnalysisSection = lazy(() => import("../sections/BulkAnalysisSection").then(m => ({ default: m.BulkAnalysisSection })));
const CoverLetterSection = lazy(() => import("../sections/CoverLetterSection").then(m => ({ default: m.CoverLetterSection })));
const Vision2030Section = lazy(() => import("../Vision2030/Vision2030Section").then(m => ({ default: m.Vision2030Section })));
const PricingSection = lazy(() => import("../sections/PricingSection").then(m => ({ default: m.PricingSection })));
const LandingPage = lazy(() => import("../../pages/LandingPage"));

import { GlassTabs } from "../ui/GlassTabs";
import { ComparisonTable } from "../ui/ComparisonTable";
import Toast, { ToastContainer } from "../ui/Toast";
import EmptyState from "../ui/EmptyState";
import { GlassButton } from "../ui/GlassButton";
import { ParallaxContainer } from "../ui/ParallaxSection";
import { exportResumeToPdf } from "../../services/exportPdf.js";
import { exportToSupabase, isSupabaseExportAvailable } from "../../services/supabaseExport.js";
import ViewTextModal from "../ui/ViewTextModal";
// Vision2030Summary removed - users should use the dedicated Vision 2030 tab instead
import { useResumeStore } from "../../lib/stores/resumeStore";
import { mergeResumeData } from "../../lib/utils/resumeUtils";

/** Lightweight skeleton shown while lazy sections load */
function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="h-64 w-full rounded-xl bg-gray-100 dark:bg-white/5" />
    </div>
  );
}


const getTabsConfig = (t) => [
  { value: "resume", label: t("tabs.resume"), icon: FileText },
  { value: "match", label: t("tabs.match"), icon: Target },
  { value: "vision2030", label: t("tabs.vision2030", "Vision 2030"), icon: Target },
  { value: "optimize", label: t("tabs.optimize"), icon: Sparkles },

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
const TAB_STORAGE_KEY = "watheq:lastActiveTab";
const RESUME_STORAGE_KEY = "watheq:resumeData";
const JOB_STORAGE_KEY = "watheq:lastJobDescription";
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
  const { t, i18n } = useTranslation();
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
  const [aiDebug, _setAiDebug] = useState(null);
  const [showLanding, _setShowLanding] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.localStorage.getItem("watheq:landingSeen");
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

    // Reset state
    setResumeData("");
    setJobDescription("");
    setMatchAnalysis(null);
    setOptimizations([]);
    setOptimizationData(null);
    setOptimizationKeywords({ add: [], remove: [], neutral: [] });
    setActiveTab("resume");

    setShowDeleteConfirm(false);

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
        const parsed = await parseResume(parseInput, { signal });
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

        // Fix B1: Always analyze the ORIGINAL resume text for match scoring
        // This prevents the optimized score (e.g. 87) from leaking into match analysis
        // when showOptimized is true after optimization + download
        const { parsedResumeText, showOptimized } = useResumeStore.getState();
        const resumeTextToAnalyze: string = parsedResumeText || resumeData.plainText || '';

        const result = await analyzeResumeWithAI(resumeTextToAnalyze, trimmedJob, i18n.language);
        setMatchAnalysis(result);
        setJobDescription(trimmedJob);

        // Cache the match analysis score so OptimizeSection can read it
        // This fixes the issue where "BEFORE" score shows 55% instead of the actual match score
        if (result && typeof result.score === 'number') {
          const { setCachedAnalysis, setOptimizationMetrics, baselineMatchScore, setBaselineMatchScore } = useResumeStore.getState();
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
    [i18n.language, pushToast, resumeData, t]
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
            language: i18n.language,
          }
        );

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

        // FIX: Store optimization metrics (gapAnalysis, matchScoring, categoryScores) in Zustand
        // These were previously discarded, causing gap analysis and optimized score to not appear
        const { setOptimizationMetrics } = useResumeStore.getState();
        if (result.matchScoring || result.gapAnalysis || result.categoryScores) {
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
          });
        }
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
        setFlowProgress(0);

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
    [i18n.language, isPremium, jobDescription, persistPreviewUsage, previewUsed, pushToast, resumeData, t]
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
        // Merge original resume with AI optimizations (Hard Overrides + Smart Match)
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
      <div className="space-y-3 sm:space-y-3 text-ink-700 dark:text-surface-50">
        {/* Tab navigation - full width on mobile */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <GlassTabs
              data-tour="features"
              tabs={tabs}
              activeValue={activeTab}
              onTabChange={handleTabChange}
              rightAction={resumeData?.plainText ? (
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="flex-shrink-0 group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-ink-500/70 hover:bg-danger-500/10 hover:text-danger-500 transition-all duration-200 dark:text-surface-50/60 dark:hover:bg-danger-400/10 dark:hover:text-danger-400"
                  title="Clear all saved data"
                >
                  <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span className="hidden sm:inline">{t("workspace.clearAll")}</span>
                </button>
              ) : undefined}
            />
          </div>
        </div>

        <div className="neu-card relative min-h-[420px] sm:min-h-[480px] p-4 sm:p-5 lg:p-6 transition-shadow duration-300 group">
          {activeTab === "resume" && (
            <UploadSection
              onParseResume={handleParseResume}
              resumeDocument={resumeData}
              onToast={handleUploadToast}
              onClear={handleClearResume}
            />
          )}
          {activeTab === "match" && (
            <Suspense fallback={<SectionSkeleton />}>
              <MatchSection
                onAnalyzeMatchAI={handleAnalyzeMatchAI}
                matchAnalysis={matchAnalysis}
                isAnalyzing={isAnalyzing}
                hasResume={Boolean(resumeData?.plainText)}
                resumeText={resumeData?.plainText || ''}
                onToast={pushToast}
                onClear={handleClearMatch}
              />
            </Suspense>
          )}
          {activeTab === "vision2030" && (
            <Suspense fallback={<SectionSkeleton />}>
              <Vision2030Section
                resumeText={resumeData?.plainText || ''}
                onToast={pushToast}
              />
            </Suspense>
          )}
          {activeTab === "optimize" && (
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
              />
            </Suspense>
          )}

          {activeTab === "templates" && (
            <TemplateGallery
              resumeData={resumeData}
              optimizationData={optimizationData}
            />
          )}
          {activeTab === "interview" && (
            <Suspense fallback={<SectionSkeleton />}>
              <InterviewSection
                jobDescription={jobDescription}
                resumeText={resumeData?.plainText || ""}
                matchAnalysis={matchAnalysis}
                resumeData={resumeData}
                onUpdate={handleResumeDataUpdate}
              />
            </Suspense>
          )}
          {activeTab === "bulk" && (
            <Suspense fallback={<SectionSkeleton />}>
              <BulkAnalysisSection
                jobDescription={jobDescription}
              />
            </Suspense>
          )}
          {activeTab === "cover-letter" && (
            <Suspense fallback={<SectionSkeleton />}>
              <CoverLetterSection
                resumeText={resumeData?.plainText || ""}
                jobDescription={jobDescription}
                resumeData={resumeData}
              />
            </Suspense>
          )}
        </div>

        {hasNextTab && (
          <div className="flex justify-center sm:justify-end mt-4">
            <GlassButton variant="secondary" onClick={handleContinue} className="justify-center">
              <ArrowRight className="w-4 h-4 me-2" />
              {t("workspace.continue")}
            </GlassButton>
          </div>
        )}

      </div>
    </ParallaxContainer>
  );

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

      {/* Delete All Data Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              {t("workspace.deleteAllConfirm.title", "Delete All Data?")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t(
                "workspace.deleteAllConfirm.description",
                "This will permanently delete your uploaded resume, optimizations, and all saved progress. This action cannot be undone."
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors text-gray-900 dark:text-white font-medium"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                onClick={confirmDeleteAllData}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                {t("workspace.deleteAllConfirm.confirm", "Delete All")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`${containerClass} space-y-4 sm:space-y-10 lg:space-y-12 text-ink-700 dark:text-surface-50`}>
        <div className="neu-card p-4 sm:p-7 lg:p-8 transition-shadow duration-300 group">
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
            <Suspense fallback={<SectionSkeleton />}>
              <LandingPage
                onGetStarted={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("watheq:landingSeen", "true");
                  }
                  // Directly trigger sign-in instead of showing sign-in empty state
                  signInWithGoogle();
                }}
              />
            </Suspense>
          ) : (
            <EmptyState
              icon={UserPlus}
              title={t("workspace.signInToUnlock")}
              description={t("workspace.signInDescription")}
              actions={
                <GlassButton
                  variant="secondary"
                  onClick={signInWithGoogle}
                  className="justify-center text-[15px] font-semibold"
                >
                  <LogIn className="w-4 h-4 me-2" />
                  {t("workspace.signInViaGoogle")}
                </GlassButton>
              }
            />
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
              {aiDebug.requestId && (
                <p className="mt-3 break-words text-[10px] text-ink-400/80 dark:text-surface-50/50">
                  Request ID: {aiDebug.requestId}
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Comparison Table - shown for all users */}
      <div className={`${containerClass} mt-16 mb-12`}>
        <div className="text-center mb-12 space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-sm font-bold tracking-wider uppercase shadow-sm">
            {t("landing.comparison.title", "Competitive Advantage")}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
            {t("landing.comparison.title", "Why Choose Watheq?")}
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-white dark:text-white/80 font-medium drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] dark:drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
            {t("landing.comparison.subtitle", "See how we stack up against generic resume tools")}
          </p>
        </div>
        <ComparisonTable />
      </div>

      {/* Pricing Section - shown for all users */}
      <div className={`${containerClass} mt-2`}>
        <Suspense fallback={<SectionSkeleton />}>
          <PricingSection />
        </Suspense>
      </div>
    </main>
  );
}





