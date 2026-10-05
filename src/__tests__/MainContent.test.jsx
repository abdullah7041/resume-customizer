import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainContent from "../components/Layout/MainContent";
import { useResumeStore } from "../lib/stores/resumeStore";
import { useResumeLibraryStore } from "../lib/resumeLibrary";

const {
  parseResumeMock,
  analyzeResumeMock,
  optimizeResumeMock,
  optimizeResumeStreamMock,
  analyzeResumeTruthCheckMock,
  generateClarificationsMock,
  extractJobMetadataMock,
  createJobApplicationMock,
  onboardExtractMock,
  analyticsMock,
  exportPdfMock,
  exportToSupabaseMock,
  supabaseAvailableMock,
} = vi.hoisted(() => ({
  parseResumeMock: vi.fn(),
  analyzeResumeMock: vi.fn(),
  optimizeResumeMock: vi.fn(),
  optimizeResumeStreamMock: vi.fn(),
  analyzeResumeTruthCheckMock: vi.fn(),
  onboardExtractMock: vi.fn(),
  // Non-fatal: always returns empty clarifications in tests so the optimize flow proceeds directly
  generateClarificationsMock: vi.fn().mockResolvedValue({ clarifications: [] }),
  extractJobMetadataMock: vi.fn(() => Promise.resolve(null)),
  createJobApplicationMock: vi.fn(),
  exportPdfMock: vi.fn(),
  exportToSupabaseMock: vi.fn(),
  supabaseAvailableMock: vi.fn(() => false),
  analyticsMock: {
    trackGuestPreviewStarted: vi.fn(),
    trackGuestPreviewLimitHit: vi.fn(),
    trackGuestPreviewSigninStarted: vi.fn(),
    trackResumeTruthCheck: vi.fn(),
    trackClarificationOutcome: vi.fn(),
    trackClarificationScoreDelta: vi.fn(),
    trackJobMetadataExtracted: vi.fn(),
    trackJobMetadataExtractionFailed: vi.fn(),
    trackPipelineExportAttached: vi.fn(),
    trackOptimizationCompleted: vi.fn(),
    track: vi.fn(),
  },
}));

const resumeUploadMockProps = vi.hoisted(() => ({ current: null }));
const jobFeedMockProps = vi.hoisted(() => ({ current: null }));
const matchSectionMockProps = vi.hoisted(() => ({ current: null }));
const optimizeSectionMockProps = vi.hoisted(() => ({ current: null }));
const auxiliarySectionMockProps = vi.hoisted(() => ({ interview: null, bulk: null, coverLetter: null }));
const pipelineMockProps = vi.hoisted(() => ({ current: null }));
const mobileWorkflowMockProps = vi.hoisted(() => ({ current: null }));
const landingMockProps = vi.hoisted(() => ({ current: null }));
const authMockState = vi.hoisted(() => ({
  user: { id: "user-123", user_metadata: {}, app_metadata: {} },
  loading: false,
  signInWithGoogle: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: authMockState.user,
    loading: authMockState.loading,
    signInWithGoogle: authMockState.signInWithGoogle,
  }),
}));

vi.mock("../pages/LandingPage", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => {
      landingMockProps.current = props;
      return React.createElement(
        "div",
        { "data-testid": "landing-page-mock" },
        React.createElement("button", { onClick: props.onGetStarted }, "Preview the workflow"),
        React.createElement("button", { onClick: props.onSignIn }, "Sign in only when you want to save progress")
      );
    },
  };
});

vi.mock("../components/sections/UploadSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => {
      resumeUploadMockProps.current = props;
      return React.createElement("div", { "data-testid": "resume-upload-mock" });
    },
  };
});

vi.mock("../components/sections/JobFeedSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    JobFeedSection: (props) => {
      jobFeedMockProps.current = props;
      return React.createElement("div", { "data-testid": "job-feed-mock" });
    },
  };
});

vi.mock("../components/ui/MobileWorkflowNav", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => {
      mobileWorkflowMockProps.current = props;
      return React.createElement("div", { "data-testid": "mobile-workflow-mock" });
    },
    MobileWorkflowNav: (props) => {
      mobileWorkflowMockProps.current = props;
      return React.createElement("div", { "data-testid": "mobile-workflow-mock" });
    },
  };
});

vi.mock("../components/sections/PipelineSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => {
      pipelineMockProps.current = props;
      return React.createElement("div", { "data-testid": "pipeline-mock" });
    },
    PipelineSection: (props) => {
      pipelineMockProps.current = props;
      return React.createElement("div", { "data-testid": "pipeline-mock" });
    },
  };
});

vi.mock("../components/sections/MatchSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    MatchSection: (props) => {
      matchSectionMockProps.current = props;
      return React.createElement(
        "div",
        { "data-testid": "job-match-mock" },
        props.matchAnalysis?.strategicRealityCheck
          ? React.createElement("span", null, `Reality tier: ${props.matchAnalysis.strategicRealityCheck.riskTier}`)
          : null,
        React.createElement("button", {
          onClick: () => {
            Promise.resolve(props.onAnalyzeMatchAI?.("Target job description", { freePreview: true })).catch(() => {});
          },
        }, "Run match")
      );
    },
  };
});

vi.mock("../components/sections/OptimizeSection", async () => {
  const React = await vi.importActual("react");
  const { useResumeStore: useMockResumeStore } = await vi.importActual("@/lib/stores/resumeStore");
  return {
    __esModule: true,
    OptimizeSection: (props) => {
      optimizeSectionMockProps.current = props;
      const scoreState = useMockResumeStore((state) => state.optimizationMetrics);
      const [optimizeStatus, setOptimizeStatus] = React.useState("idle");
      return React.createElement(
        "div",
        { "data-testid": "optimization-mock" },
        React.createElement("button", {
          onClick: () => {
            setOptimizeStatus("pending");
            void Promise.resolve(props.onOptimize?.("auto", { freePreview: true }))
              .then((result) => setOptimizeStatus(result ? "completed" : "empty"))
              .catch(() => setOptimizeStatus("failed"));
          },
        }, "Run optimize"),
        React.createElement("span", { "data-testid": "optimization-handler-status" }, optimizeStatus),
        React.createElement(
          "span",
          { "data-testid": "clarification-check-status" },
          props.isCheckingQuestions ? "checking" : "idle",
        ),
        React.createElement("button", { onClick: props.onClear }, "Clear optimize"),
        React.createElement(
          "span",
          { "data-testid": "optimization-companion-score-source" },
          `${scoreState.beforeScore ?? "unavailable"}:${scoreState.afterScore ?? "unavailable"}`,
        ),
      );
    },
  };
});

vi.mock("../components/sections/InterviewSection", () => ({
  InterviewSection: (props) => {
    auxiliarySectionMockProps.interview = props;
    return <div data-testid="interview-wiring-mock" />;
  },
}));
vi.mock("../components/sections/BulkAnalysisSection", () => ({
  BulkAnalysisSection: (props) => {
    auxiliarySectionMockProps.bulk = props;
    return <div data-testid="bulk-wiring-mock" />;
  },
}));
vi.mock("../components/sections/CoverLetterSection", () => ({
  CoverLetterSection: (props) => {
    auxiliarySectionMockProps.coverLetter = props;
    return <div data-testid="coverLetter-wiring-mock" />;
  },
}));

vi.mock("../components/sections/TruthCheckSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    TruthCheckSection: (props) =>
      React.createElement(
        "div",
        { "data-testid": "truth-check-mock" },
        props.result
          ? React.createElement("span", null, `Truth risk: ${props.result.overallRisk}`)
          : null,
        React.createElement("button", { onClick: () => props.onAnalyze?.() }, "Run truth check"),
        props.isGuestMode ? React.createElement("span", null, "guest gated") : null
      ),
  };
});

vi.mock("../components/ui/Tabs.tsx", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ tabs = [], activeValue, onTabChange }) =>
      React.createElement(
        "div",
        {
          "data-testid": "tabs-mock",
          onClick: () => onTabChange?.(activeValue ?? tabs[0]?.value ?? "resume"),
        },
        "Tabs"
      ),
  };
});

vi.mock("../components/ui/Toast.tsx", () => {
  const React = require("react");
  return {
    __esModule: true,
    ToastContainer: ({ children }) => React.createElement("div", null, children),
    default: ({ title, description, type }) =>
      React.createElement(
        "div",
        { "data-testid": "toast-mock", "data-toast-type": type },
        `${title ?? ""} ${description ?? ""}`.trim()
      ),
  };
});

vi.mock("../services/supabase.js", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  },
  AppError: class AppError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("../services/pipeline", () => ({
  createJobApplication: createJobApplicationMock,
  updateJobApplication: vi.fn(),
  attachExportToJobApplication: vi.fn(),
}));

vi.mock("../services/supabaseExport.js", () => ({
  saveResumeToSupabase: vi.fn(),
  saveOptimizationToSupabase: vi.fn(),
  exportToSupabase: exportToSupabaseMock,
  isSupabaseExportAvailable: supabaseAvailableMock,
}));

vi.mock("../services/exportPdf.js", () => ({ exportResumeToPdf: exportPdfMock }));

vi.mock("../services/api.js", () => ({
  parseResume: parseResumeMock,
  analyzeResume: analyzeResumeMock,
  analyzeResumeWithAI: analyzeResumeMock,
  optimizeResume: optimizeResumeMock,
  optimizeResumeStream: optimizeResumeStreamMock,
  analyzeResumeTruthCheck: analyzeResumeTruthCheckMock,
  generateClarifications: generateClarificationsMock,
  extractJobMetadata: extractJobMetadataMock,
  onboardExtract: onboardExtractMock,
  AI_DEFAULT_TEMPERATURE: 0.32,
  isAuthRequiredError: (error) =>
    error?.type === "AUTH_REQUIRED" || error?.code === "auth/required" || error?.status === 401,
}));

vi.mock("../services/analytics", () => ({
  analytics: analyticsMock,
}));

vi.mock("../hooks/useUserCredits", () => ({
  useUserCredits: () => ({
    credits: { remaining: 100, total: 100, feedbackCreditsEarned: 0, referralCreditsEarned: 0, resetDate: new Date().toISOString() },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    showUpgrade: false,
    setShowUpgrade: vi.fn(),
    upgradeDismissedKey: null,
  }),
}));

describe("MainContent resume parsing", () => {
  beforeEach(() => {
    resumeUploadMockProps.current = null;
    jobFeedMockProps.current = null;
    landingMockProps.current = null;
    authMockState.user = { id: "user-123", user_metadata: {}, app_metadata: {} };
    authMockState.loading = false;
    authMockState.signInWithGoogle.mockReset();
    parseResumeMock.mockReset();
    analyzeResumeMock.mockReset();
    optimizeResumeMock.mockReset();
    optimizeResumeStreamMock.mockReset();
    analyzeResumeTruthCheckMock.mockReset();
    extractJobMetadataMock.mockReset();
    extractJobMetadataMock.mockResolvedValue(null);
    createJobApplicationMock.mockReset();
    generateClarificationsMock.mockReset();
    generateClarificationsMock.mockResolvedValue({ clarifications: [] });
    onboardExtractMock.mockReset();
    onboardExtractMock.mockResolvedValue({ value: {}, confidence: "low" });
    // Path-A inline panel gates on the store — reset so it only appears where a test
    // opts in by setting originalResume.
    useResumeStore.setState({ originalResume: null, searchIntent: null, parsedResumeText: null,
      analysisCache: {}, baselineMatchScore: null, optimizeRun: null, optimizations: [],
      optimizationOrigin: null, variantRestoreNonce: 0 });
    Object.values(analyticsMock).forEach((mock) => mock.mockClear());
    parseResumeMock.mockResolvedValue({
      plainText: "Parsed resume",
      bullets: [],
      sections: [],
    });

    // Mock localStorage with beta code while preserving normal localStorage behavior
    const storage = {};
    const localStorageMock = {
      getItem: vi.fn((key) => {
        if (key === 'watheq:beta_access') return 'WATHEQ01';
        return storage[key] || null;
      }),
      setItem: vi.fn((key, value) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach(key => delete storage[key]);
      }),
    };
    global.localStorage = localStorageMock;
  });

  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const openMatch = async (job = '') => {
    useResumeStore.setState({ parsedResumeText: '', analysisCache: {}, baselineMatchScore: null });
    localStorage.setItem('watheq:lastActiveTab', 'match');
    localStorage.setItem('watheq:resumeData', JSON.stringify({ plainText: 'Original resume', sections: [] }));
    if (job) localStorage.setItem('watheq:lastJobDescription', job);
    render(<MainContent />);
    await screen.findByTestId('job-match-mock');
  };

  const openOptimize = async (job = 'Role A') => {
    localStorage.setItem('watheq:lastActiveTab', 'optimize');
    localStorage.setItem('watheq:resumeData', JSON.stringify({ plainText: 'Original resume', sections: [] }));
    localStorage.setItem('watheq:lastJobDescription', job);
    render(<MainContent />);
    await screen.findByTestId('optimization-mock');
  };

  const restoreJob = async (job) => {
    localStorage.setItem('watheq:lastJobDescription', job);
    await act(async () => {
      useResumeStore.setState({ variantRestoreNonce: useResumeStore.getState().variantRestoreNonce + 1 });
    });
  };

  it('Optimize ownership: ignores a late generation result after the job changes', async () => {
    await openOptimize();
    const pending = deferred();
    optimizeResumeStreamMock.mockReturnValueOnce(pending.promise);
    let run;
    await act(async () => { run = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
    await restoreJob('Role B');
    await act(async () => { pending.resolve({ cards: [{ section: 'Experience', exampleAfter: 'Old role card' }],
      keywords: { add: [], remove: [], neutral: [] }, source: 'gemini' }); await run; });
    expect(useResumeStore.getState().optimizeRun?.status).not.toBe('succeeded');
    expect(useResumeStore.getState().optimizationOrigin).toBeNull();
    expect(optimizeSectionMockProps.current.optimizations).toEqual([]);
  });

  it('Optimize ownership: does not present a saved result for another job as current', async () => {
    const { createAssessmentContext } = await import('../lib/match/assessmentContext');
    const oldContext = await createAssessmentContext({ resumeText: 'Original resume', jobDescription: 'Role A',
      language: 'en', kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
    useResumeStore.setState({ optimizeRun: { status: 'succeeded', startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(), phase: 'done', error: null,
      cards: [{ section: 'Experience', exampleAfter: 'Role A card' }], data: { source: 'gemini' },
      keywords: { add: [], remove: [], neutral: [] },
      assessment: { context: oldContext, jobSnapshot: 'Role A', requestId: 'old-run',
        createdAt: new Date().toISOString(), result: { source: 'gemini' } } } });
    await openOptimize('Role B');
    expect(optimizeSectionMockProps.current.optimizations).toEqual([]);
  });

  it('Optimize ownership: an older A cannot replace the newer A after visiting B', async () => {
    await openOptimize('Role A');
    const old = deferred(), newer = deferred();
    optimizeResumeStreamMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    let first, second;
    await act(async () => { first = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
    await restoreJob('Role B');
    await restoreJob('Role A');
    await act(async () => { second = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(2));
    await act(async () => { old.resolve({ cards: [{ section: 'Experience', exampleAfter: 'Old A' }],
      keywords: { add: [], remove: [], neutral: [] }, source: 'gemini' }); await first; });
    expect(useResumeStore.getState().optimizeRun?.status).toBe('running');
    expect(optimizeSectionMockProps.current.isOptimizing).toBe(true);
    await act(async () => { newer.resolve({ cards: [{ section: 'Experience', exampleAfter: 'New A' }],
      keywords: { add: [], remove: [], neutral: [] }, source: 'gemini' }); await second; });
    expect(useResumeStore.getState().optimizeRun?.status).toBe('succeeded');
    expect(optimizeSectionMockProps.current.optimizations[0].exampleAfter).toBe('New A');
  });

  it('Optimize ownership: ignores clarification questions returned after a job switch', async () => {
    await openOptimize('Role A');
    const pending = deferred();
    generateClarificationsMock.mockReturnValueOnce(pending.promise);
    let run;
    await act(async () => { run = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    await waitFor(() => expect(generateClarificationsMock).toHaveBeenCalledTimes(1));
    await restoreJob('Role B');
    await act(async () => { pending.resolve({ clarifications: [{ id: 'old', question: 'Old role question?',
      type: 'text', theme: 'skills', rationale: 'Old role', allowOther: true }] }); await run; });
    expect(screen.queryByText('Old role question?')).not.toBeInTheDocument();
    expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
    expect(optimizeSectionMockProps.current.isCheckingQuestions).toBe(false);
  });

  it('Optimize ownership: ignores a late generation result after a resume upload', async () => {
    await openOptimize('Role A');
    const pending = deferred();
    optimizeResumeStreamMock.mockReturnValueOnce(pending.promise);
    let run;
    await act(async () => { run = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
    parseResumeMock.mockResolvedValueOnce({ plainText: 'New resume', sections: [], bullets: [] });
    await act(async () => { await resumeUploadMockProps.current.onParseResume({ kind: 'text', value: 'New resume' }); });
    await act(async () => { pending.resolve({ cards: [{ section: 'Summary', exampleAfter: 'Old resume card' }],
      keywords: { add: [], remove: [], neutral: [] }, source: 'gemini' }); await run; });
    expect(useResumeStore.getState().optimizeRun?.status).not.toBe('succeeded');
    expect(useResumeStore.getState().optimizationOrigin).toBeNull();
  });

  it('Optimize ownership: ignores a late generation result after a language switch', async () => {
    const { default: i18n } = await import('../lib/i18n');
    await i18n.changeLanguage('en');
    try {
      await openOptimize('Role A');
      const pending = deferred();
      optimizeResumeStreamMock.mockReturnValueOnce(pending.promise);
      let run;
      await act(async () => { run = optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
      await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
      await act(async () => { await i18n.changeLanguage('ar'); });
      await act(async () => { pending.resolve({ cards: [{ section: 'Summary', exampleAfter: 'English card' }],
        keywords: { add: [], remove: [], neutral: [] }, source: 'gemini' }); await run; });
      expect(useResumeStore.getState().optimizeRun?.status).not.toBe('succeeded');
      expect(useResumeStore.getState().optimizationOrigin).toBeNull();
    } finally {
      await act(async () => { await i18n.changeLanguage('en'); });
      i18n.removeResourceBundle('en', 'translation');
      i18n.removeResourceBundle('ar', 'translation');
    }
  });

  it.each(['success', 'failure'])('Match ownership: late A %s cannot replace newer A or finalize its loading', async (outcome) => {
    await openMatch();
    const old = deferred(), newer = deferred();
    analyzeResumeMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
    let first, second;
    await act(async () => { first = matchSectionMockProps.current.onAnalyzeMatchAI('Job A').catch(() => null); });
    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalledTimes(1));
    act(() => matchSectionMockProps.current.onJobDescriptionChange('Job B'));
    act(() => matchSectionMockProps.current.onJobDescriptionChange('Job A'));
    await act(async () => { second = matchSectionMockProps.current.onAnalyzeMatchAI('Job A'); });
    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      if (outcome === 'success') old.resolve({ score: 11 });
      else old.reject(new Error('old failure'));
      await first;
    });
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
    expect(matchSectionMockProps.current.isAnalyzing).toBe(true);
    expect(useResumeStore.getState().baselineMatchScore).toBeNull();
    expect(screen.queryByText('old failure')).not.toBeInTheDocument();
    await act(async () => { newer.resolve({ score: 83 }); await second; });
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(83);
    expect(useResumeStore.getState().baselineMatchScore).toBe(83);
    expect(matchSectionMockProps.current.isAnalyzing).toBe(false);
    const saved = JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis'));
    expect(saved.assessment.jobSnapshot).toBe('Job A');
  });

  it('Match ownership: a same-context rerun restores without a second paid call', async () => {
    await openMatch();
    analyzeResumeMock.mockResolvedValue({ score: 75 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Full job'); });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Full job'); });
    expect(analyzeResumeMock).toHaveBeenCalledTimes(1);
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(75);
  });

  it('Match ownership: stores the full submitted job instead of a truncated display variant', async () => {
    await openMatch();
    const fullJob = `${'Requirement '.repeat(810)}final requirement`;
    analyzeResumeMock.mockResolvedValue({ score: 68 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI(fullJob); });
    expect(analyzeResumeMock).toHaveBeenCalledWith('Original resume', fullJob, 'en', undefined);
    expect(JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis')).assessment.jobSnapshot).toBe(fullJob);
  });

  it('Match ownership: a mismatched saved job snapshot cannot satisfy the current context', async () => {
    await openMatch();
    analyzeResumeMock.mockResolvedValueOnce({ score: 68 }).mockResolvedValueOnce({ score: 79 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Role A'); });
    const stored = JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis'));
    stored.assessment.jobSnapshot = 'Different job';
    localStorage.setItem('watheq:lastMatchAnalysis', JSON.stringify(stored));
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Role A'); });
    expect(analyzeResumeMock).toHaveBeenCalledTimes(2);
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(79);
  });

  it('invalidates Match and sends only candidate-edited baseline facts', async () => {
    const baseline = { basics: { name: 'Sara', label: '', email: '', phone: '', summary: '',
      location: { city: '', countryCode: '', region: '' }, profiles: [] },
      work: [{ name: 'Old Employer', position: 'Analyst', startDate: '2021', endDate: '2023',
        summary: '', highlights: ['Removed achievement'] }], education: [], skills: [] };
    localStorage.setItem('watheq:lastActiveTab', 'match');
    localStorage.setItem('watheq:resumeData', JSON.stringify({ plainText: 'Old Employer Removed achievement', sections: [] }));
    localStorage.setItem('watheq:lastJobDescription', 'Target job description');
    useResumeStore.getState().setOriginalResume(baseline);
    useResumeStore.getState().setParsedResumeText('Old Employer Removed achievement');
    render(<MainContent />);
    await screen.findByTestId('job-match-mock');
    analyzeResumeMock.mockResolvedValue({ score: 72 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Target job description'); });
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(72);

    await act(async () => { useResumeStore.getState().setOriginalResume({ ...baseline,
      work: [{ ...baseline.work[0], name: 'New Employer', highlights: ['Current achievement'] }] }); });
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Target job description'); });
    const matchText = analyzeResumeMock.mock.calls.at(-1)[0];
    expect(matchText).toContain('New Employer');
    expect(matchText).toContain('Current achievement');
    expect(matchText).not.toContain('Old Employer');
    expect(matchText).not.toContain('Removed achievement');

  });

  it('sends edited baseline facts to Optimize instead of its stored upload text', async () => {
    const baseline = { basics: { name: 'Sara', label: '', email: '', phone: '', summary: '',
      location: { city: '', countryCode: '', region: '' }, profiles: [] },
      work: [{ name: 'Old Employer', position: 'Analyst', startDate: '2021', endDate: '2023',
        summary: '', highlights: ['Removed achievement'] }], education: [], skills: [] };
    useResumeStore.getState().setOriginalResume(baseline);
    useResumeStore.getState().setParsedResumeText('Old Employer Removed achievement');
    await openOptimize();
    await act(async () => { useResumeStore.getState().setOriginalResume({ ...baseline,
      work: [{ ...baseline.work[0], name: 'New Employer', highlights: ['Current achievement'] }] }); });
    optimizeResumeStreamMock.mockResolvedValue({ cards: [], keywords: { add: [], remove: [], neutral: [] } });
    await act(async () => { await optimizeSectionMockProps.current.onOptimize('auto', { freePreview: true }); });
    const request = optimizeResumeStreamMock.mock.calls.at(-1)[0];
    expect(JSON.stringify(request)).toContain('New Employer');
    expect(JSON.stringify(request)).not.toContain('Old Employer');
    expect(JSON.stringify(request)).not.toContain('Removed achievement');
  });

  it('does not revive upload text after the candidate empties a structured baseline', async () => {
    const baseline = { basics: { name: 'Sara', label: '', email: '', phone: '', summary: '',
      location: { city: '', countryCode: '', region: '' }, profiles: [] },
      work: [], education: [], skills: [] };
    useResumeStore.getState().setOriginalResume(baseline);
    useResumeStore.getState().setParsedResumeText('Old raw resume fact');
    await openOptimize();
    await act(async () => { useResumeStore.getState().setOriginalResume({ ...baseline,
      basics: { ...baseline.basics, name: '' } }); });
    expect(useResumeStore.getState().parsedResumeText).toBe('');
    expect(screen.queryByTestId('optimization-mock')).not.toBeInTheDocument();
    expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
  });

  it('rejects a Match response started before a candidate baseline edit', async () => {
    const baseline = { basics: { name: 'Sara', label: '', email: '', phone: '', summary: 'Old fact',
      location: { city: '', countryCode: '', region: '' }, profiles: [] },
      work: [], education: [], skills: [] };
    useResumeStore.getState().setOriginalResume(baseline);
    useResumeStore.getState().setParsedResumeText('Sara Old fact');
    localStorage.setItem('watheq:lastActiveTab', 'match');
    localStorage.setItem('watheq:resumeData', JSON.stringify({ plainText: 'Sara Old fact', sections: [] }));
    render(<MainContent />);
    await screen.findByTestId('job-match-mock');
    const pending = deferred();
    analyzeResumeMock.mockReturnValueOnce(pending.promise);
    let run;
    await act(async () => { run = matchSectionMockProps.current.onAnalyzeMatchAI('Role A'); });
    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalledTimes(1));
    await act(async () => { useResumeStore.getState().setOriginalResume({ ...baseline,
      basics: { ...baseline.basics, summary: 'New fact' } }); });
    await act(async () => { pending.resolve({ score: 83 }); await run; });
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
  });

  it('Match ownership: metadata completing after a job edit cannot populate the new job', async () => {
    await openMatch();
    const metadata = deferred();
    extractJobMetadataMock.mockReturnValueOnce(metadata.promise);
    analyzeResumeMock.mockResolvedValue({ score: 75 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Old job'); });
    act(() => matchSectionMockProps.current.onJobDescriptionChange('New job'));
    await act(async () => { metadata.resolve({ companyName: 'Old company', jobTitle: 'Old title' }); });
    expect(matchSectionMockProps.current.extractedMetadata).toBeNull();
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
    await waitFor(() => expect(matchSectionMockProps.current.historicalMatch?.status).toBe('outdated'));
    expect(createJobApplicationMock).not.toHaveBeenCalled();
  });

  it('Match ownership: a late pipeline response cannot attach the old job to the current view', async () => {
    await openMatch();
    const pendingSave = deferred();
    extractJobMetadataMock.mockResolvedValueOnce({ companyName: 'Old company', jobTitle: 'Old title' });
    createJobApplicationMock.mockReturnValueOnce(pendingSave.promise);
    analyzeResumeMock.mockResolvedValueOnce({ score: 75 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Old job'); });
    await waitFor(() => expect(createJobApplicationMock).toHaveBeenCalledTimes(1));
    act(() => matchSectionMockProps.current.onJobDescriptionChange('New job'));
    await act(async () => { pendingSave.resolve({ data: { id: 'old-job-id' }, error: null }); });
    expect(matchSectionMockProps.current.savedApplicationId).toBeNull();
  });

  it('Match ownership: metadata arriving after a failed analysis cannot update or save the job', async () => {
    await openMatch();
    const metadata = deferred();
    extractJobMetadataMock.mockReturnValueOnce(metadata.promise);
    analyzeResumeMock.mockRejectedValueOnce(new Error('analysis failed'));
    await act(async () => {
      await expect(matchSectionMockProps.current.onAnalyzeMatchAI('Failed job')).rejects.toThrow('analysis failed');
    });
    await act(async () => { metadata.resolve({ companyName: 'Failed company', jobTitle: 'Failed title' }); });
    expect(matchSectionMockProps.current.extractedMetadata).toBeNull();
    expect(createJobApplicationMock).not.toHaveBeenCalled();
  });

  it('Match ownership: editing during context hashing prevents a stale paid request', async () => {
    await openMatch();
    const pendingDigest = deferred();
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    const digestSpy = vi.spyOn(crypto.subtle, 'digest')
      .mockImplementationOnce(() => pendingDigest.promise)
      .mockImplementationOnce(() => pendingDigest.promise);
    try {
      let first;
      await act(async () => { first = matchSectionMockProps.current.onAnalyzeMatchAI('Old job'); });
      act(() => matchSectionMockProps.current.onJobDescriptionChange('New job'));
      const digest = await originalDigest('SHA-256', new TextEncoder().encode('test'));
      await act(async () => { pendingDigest.resolve(digest); await first; });
      expect(analyzeResumeMock).not.toHaveBeenCalled();
      expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
      expect(matchSectionMockProps.current.isAnalyzing).toBe(false);
    } finally {
      digestSpy.mockRestore();
    }
  });

  it('Match ownership: a legacy saved result stays inspectable but cannot satisfy a new analysis', async () => {
    localStorage.setItem('watheq:lastMatchAnalysis', JSON.stringify({
      analysis: { score: 29, reasoning: 'Old explanation' }, jobText: 'Old job', savedAt: Date.now(),
    }));
    await openMatch('Old job');
    await waitFor(() => expect(matchSectionMockProps.current.historicalMatch?.status).toBe('legacy'));
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
    expect(analyzeResumeMock).not.toHaveBeenCalled();
    analyzeResumeMock.mockResolvedValue({ score: 74 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Old job'); });
    expect(analyzeResumeMock).toHaveBeenCalledTimes(1);
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(74);
  });

  it('Match ownership: language change invalidates a pending result', async () => {
    const { default: i18n } = await import('../lib/i18n');
    await i18n.changeLanguage('en');
    await openMatch();
    const pending = deferred();
    analyzeResumeMock.mockReturnValueOnce(pending.promise);
    let oldRun;
    await act(async () => { oldRun = matchSectionMockProps.current.onAnalyzeMatchAI('Role A'); });
    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalledTimes(1));
    try {
      await act(async () => { await i18n.changeLanguage('ar'); });
      await act(async () => { pending.resolve({ score: 12 }); await oldRun; });
      expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
      expect(useResumeStore.getState().baselineMatchScore).toBeNull();
    } finally {
      await act(async () => { await i18n.changeLanguage('en'); });
      i18n.removeResourceBundle('en', 'translation');
      i18n.removeResourceBundle('ar', 'translation');
    }
  });

  it('Match ownership: a guest preview cannot satisfy a later confirmed paid run', async () => {
    await openMatch();
    analyzeResumeMock.mockResolvedValueOnce({ score: 51 }).mockResolvedValueOnce({ score: 77 });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Same role', { freePreview: true }); });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Same role'); });
    expect(analyzeResumeMock).toHaveBeenCalledTimes(2);
    expect(matchSectionMockProps.current.matchAnalysis.score).toBe(77);
    expect(JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis')).assessment.result.origin).toBe('paid');
  });

  it('Match ownership: a cached guest preview is marked reused without another request', async () => {
    await openMatch();
    analyzeResumeMock.mockResolvedValueOnce({ score: 51 });
    let first;
    let second;
    await act(async () => { first = await matchSectionMockProps.current.onAnalyzeMatchAI('Same role', { freePreview: true }); });
    await act(async () => { second = await matchSectionMockProps.current.onAnalyzeMatchAI('Same role', { freePreview: true }); });
    expect(first.reusedFromCache).toBeUndefined();
    expect(second.reusedFromCache).toBe(true);
    expect(analyzeResumeMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis')).assessment.result.reusedFromCache).toBeUndefined();
  });

  it("passes upload payloads through parseResume with storage metadata", async () => {
    render(<MainContent />);

    expect(resumeUploadMockProps.current).toBeTruthy();
    const file = new File(["%PDF-1.7 data"], "resume.pdf", {
      type: "application/pdf",
    });
    const uploadPayload = {
      kind: "upload",
      file,
      storage: {
        bucket: "resumes",
        path: "user-123/resume.pdf",
        fileName: "resume.pdf",
        userId: "user-123",
      },
    };

    let parsed;
    await act(async () => {
      parsed = await resumeUploadMockProps.current.onParseResume(uploadPayload);
    });

    expect(parseResumeMock).toHaveBeenCalledTimes(1);
    expect(parseResumeMock).toHaveBeenCalledWith(file, expect.any(Object));
    expect(parsed).toMatchObject({
      storagePath: "user-123/resume.pdf",
      storageBucket: "resumes",
      storageFileName: "resume.pdf",
      storageUserId: "user-123",
    });
  });

  it("supports text payloads", async () => {
    render(<MainContent />);

    expect(resumeUploadMockProps.current).toBeTruthy();

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", value: "My resume" });
    });

    expect(parseResumeMock).toHaveBeenCalledWith("My resume", expect.any(Object));
  });

  it("persists resume data with minor control characters (relaxed validation)", () => {
    const resumeData = {
      plainText: "Resume with \x09 tab and \x0A newline and maybe one \x00 null byte",
      sections: [],
    };
    localStorage.setItem("watheq:resumeData", JSON.stringify(resumeData));
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

    render(<MainContent />);

    expect(removeItemSpy).not.toHaveBeenCalledWith("watheq:resumeData");
    // Verify that the data was loaded into the component (by checking if ResumeUpload received it)
    expect(resumeUploadMockProps.current.resumeDocument).toEqual(resumeData);

    removeItemSpy.mockRestore();
  });

  it("routes a NEW signed-out visitor into first-run onboarding from the preview CTA (not straight into the guest workspace)", async () => {
    authMockState.user = null;
    const enterOnboarding = vi.fn();
    window.addEventListener("watheq:enter-onboarding", enterOnboarding);

    render(<MainContent />);

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /preview the workflow/i }));

    // Onboarding is owned by App: MainContent signals it via the event + landingSeen,
    // and must NOT enter the guest workspace or trigger Google sign-in itself.
    expect(authMockState.signInWithGoogle).not.toHaveBeenCalled();
    expect(enterOnboarding).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("watheq:landingSeen")).toBe("true");
    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    expect(analyticsMock.trackGuestPreviewStarted).toHaveBeenCalledWith("landing_preview");

    window.removeEventListener("watheq:enter-onboarding", enterOnboarding);
  });

  it("opens the guest workspace directly for an already-onboarded signed-out visitor", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:onboarded", "true");

    render(<MainContent />);

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /preview the workflow/i }));

    expect(authMockState.signInWithGoogle).not.toHaveBeenCalled();
    expect(localStorage.getItem("watheq:guestMode")).toBe("true");
    expect(analyticsMock.trackGuestPreviewStarted).toHaveBeenCalledWith("landing_preview");
    expect(await screen.findByTestId("resume-upload-mock")).toBeInTheDocument();
  });

  it("shows guest sign-in and exit controls when guest mode is intentionally persisted", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    expect(await screen.findByText(/You're previewing Watheq\. Sign in to save progress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to save progress/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to landing/i }));

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    expect(await screen.findByTestId("landing-page-mock")).toBeInTheDocument();
  });

  it("allows guest upload without any sign-in props or prompts", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    expect(await screen.findByTestId("resume-upload-mock")).toBeInTheDocument();
    expect(resumeUploadMockProps.current).not.toHaveProperty("requiresSignIn");
    expect(resumeUploadMockProps.current).not.toHaveProperty("onAuthRequired");
    expect(resumeUploadMockProps.current).not.toHaveProperty("authActionLabel");
    expect(resumeUploadMockProps.current).not.toHaveProperty("onAuthAction");
    expect(typeof resumeUploadMockProps.current.onParseResume).toBe("function");

    expect(authMockState.signInWithGoogle).not.toHaveBeenCalled();
  });

  it("tracks guest sign-in conversion from the preview workspace", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /sign in to save progress/i }));

    expect(analyticsMock.trackGuestPreviewSigninStarted).toHaveBeenCalledWith("guest_banner");
    expect(authMockState.signInWithGoogle).toHaveBeenCalledWith({
      intent: "signin",
      source: "landing_get_started",
    });
  });

  it("tracks guest preview parse limits without resume metadata", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    const error = new Error("Preview files are limited to 2MB. Please sign in to process larger files.");
    error.status = 413;
    error.code = "file/guest-too-large";
    parseResumeMock.mockRejectedValueOnce(error);

    render(<MainContent />);
    await screen.findByTestId("resume-upload-mock");

    await expect(resumeUploadMockProps.current.onParseResume("My resume")).rejects.toThrow(
      "Preview files are limited"
    );

    expect(analyticsMock.trackGuestPreviewLimitHit).toHaveBeenCalledWith({
      source: "client_file_size",
      status: 413,
    });
  });

  it("allows guest match analysis for current onboarding plan testing", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    localStorage.setItem("watheq:lastActiveTab", "match");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    analyzeResumeMock.mockResolvedValueOnce({
      score: 82,
      missingKeywords: [],
      topHits: [],
      suggestions: [],
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run match/i }));

    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalledWith("Parsed resume", "Target job description", "en", { freePreview: true, importedCriteria: null }));
    expect(analyticsMock.trackGuestPreviewLimitHit).not.toHaveBeenCalledWith({
      source: "protected_action",
      status: 401,
    });
    expect(screen.queryByText(/Sign in required Sign in to run AI analysis and save your progress/i)).not.toBeInTheDocument();
  });

  it("stores Reality Check results from match analysis without blocking job metadata extraction", async () => {
    localStorage.setItem("watheq:lastActiveTab", "match");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    extractJobMetadataMock.mockRejectedValueOnce(new Error("metadata failed"));
    analyzeResumeMock.mockResolvedValueOnce({
      score: 44,
      missingKeywords: ["machine learning"],
      topHits: ["SQL"],
      suggestions: [],
      strategicRealityCheck: {
        riskTier: "critical",
        recommendation: "add_evidence_first",
        confidence: "medium",
        riskTypes: ["missing_required_skill"],
        summary: "Critical evidence gap.",
        strengths: [],
        confirmedRisks: [],
        unclearRisks: [{
          type: "missing_required_skill",
          topic: "Machine learning",
          reason: "Evidence is unclear.",
          evidenceNeeded: "Add verified evidence only if it exists.",
        }],
        limits: { cannotDetermine: ["Employer decisions"], assumptions: [] },
      },
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run match/i }));

    expect(await screen.findByText(/Reality tier: critical/i)).toBeInTheDocument();
    expect(analyzeResumeMock).toHaveBeenCalledWith("Parsed resume", "Target job description", "en", { freePreview: true, importedCriteria: null });
    expect(extractJobMetadataMock).toHaveBeenCalledWith("Target job description", "en");
  });

  it("shows Truth Check as a primary workflow step after resume upload and before match", async () => {
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));

    render(<MainContent />);

    const workflow = screen.getByRole("navigation", { name: /resume workflow/i });
    const truthCheckStep = within(workflow).getByRole("button", { name: /truth check verify claims/i });
    // Match hint shows "Add job ad" when no job ad is present (collapsed Job Ad + Match step)
    const matchStep = within(workflow).getByRole("button", { name: /match add job ad/i });

    expect(truthCheckStep).toBeInTheDocument();
    expect(matchStep).toBeInTheDocument();
    expect(Array.from(workflow.querySelectorAll("button")).indexOf(truthCheckStep))
      .toBeLessThan(Array.from(workflow.querySelectorAll("button")).indexOf(matchStep));
  });

  it("runs free authenticated Truth Check and caches the result without credit copy", async () => {
    localStorage.setItem("watheq:lastActiveTab", "truth-check");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:hardStops", JSON.stringify(["Excel"]));
    analyzeResumeTruthCheckMock.mockResolvedValueOnce({
      overallRisk: "medium",
      summary: "Some claims need evidence.",
      claims: [{
        claimText: "Owned transformation",
        section: "summary",
        severity: "medium",
        riskTypes: ["unsupported"],
        evidenceStatus: "needs_evidence",
        visibleEvidence: ["Owned transformation"],
        whyItMatters: "Broad scope needs proof.",
        userAction: "Add proof only if true.",
      }],
      limits: { cannotVerify: [] },
      debug: { requestId: "truth-debug-1", model: "google/gemini-2.5-flash", latencyMs: 555 },
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run truth check/i }));

    expect(await screen.findByText(/Truth risk: medium/i)).toBeInTheDocument();
    expect(analyzeResumeTruthCheckMock).toHaveBeenCalledWith({
      resumeText: "Parsed resume",
      language: "en",
      userHardStops: ["Excel"],
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "watheq:resumeTruthCheck",
      expect.stringContaining("Owned transformation")
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "watheq:resumeTruthCheck",
      expect.stringContaining('"contractVersion":1')
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "watheq:resumeTruthCheck",
      expect.stringContaining('"language":"en"')
    );
    expect(screen.queryByText(/credits/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Request ID: truth-debug-1/i)).toBeInTheDocument();
  });

  it("reuses the cached Truth Check when the same resume is checked again", async () => {
    localStorage.setItem("watheq:lastActiveTab", "truth-check");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    analyzeResumeTruthCheckMock.mockResolvedValueOnce({
      overallRisk: "medium",
      summary: "Some claims need evidence.",
      claims: [{
        claimText: "Owned transformation",
        section: "summary",
        severity: "medium",
        riskTypes: ["unsupported"],
        evidenceStatus: "needs_evidence",
        visibleEvidence: [],
        whyItMatters: "Broad scope needs proof.",
        userAction: "Add proof only if true.",
      }],
      limits: { cannotVerify: [] },
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run truth check/i }));
    expect(await screen.findByText(/Truth risk: medium/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run truth check/i }));

    await waitFor(() => expect(analyzeResumeTruthCheckMock).toHaveBeenCalledTimes(1));
  });

  it("gates guest Truth Check before backend calls", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    localStorage.setItem("watheq:lastActiveTab", "truth-check");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run truth check/i }));

    expect(analyzeResumeTruthCheckMock).not.toHaveBeenCalled();
    expect(analyticsMock.trackGuestPreviewLimitHit).toHaveBeenCalledWith({
      source: "protected_action",
      status: 401,
    });
    expect(await screen.findByText(/Sign in required Sign in to run AI analysis and save your progress/i)).toBeInTheDocument();
  });

  it("clears cached Truth Check when a new resume is uploaded", async () => {
    localStorage.setItem("watheq:resumeTruthCheck", JSON.stringify({
      resumeHash: "old",
      result: { overallRisk: "high", summary: "Old", claims: [], limits: { cannotVerify: [] } },
    }));

    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", value: "New resume" });
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith("watheq:resumeTruthCheck");
  });

  it("populates the dev AI debug panel from match metadata", async () => {
    localStorage.setItem("watheq:lastActiveTab", "match");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    analyzeResumeMock.mockResolvedValueOnce({
      score: 72,
      missingKeywords: [],
      topHits: [],
      suggestions: [],
      debug: {
        requestId: "match-debug-1",
        model: "google/gemini-2.5-flash",
        latencyMs: 1234,
      },
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run match/i }));

    expect(await screen.findByText("AI Debug")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("google/gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText("1234 ms")).toBeInTheDocument();
    expect(screen.getByText(/Request ID: match-debug-1/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis')).assessment.model).toBe('google/gemini-2.5-flash');
  });

  it("populates the dev AI debug panel from optimize metadata", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      debug: {
        requestId: "optimize-debug-1",
        model: "google/gemini-2.5-flash",
        latencyMs: 2222,
      },
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    expect(await screen.findByText("AI Debug")).toBeInTheDocument();
    expect(screen.getByText("google/gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText("2222 ms")).toBeInTheDocument();
    expect(screen.getByText(/Request ID: optimize-debug-1/i)).toBeInTheDocument();
  });

  it("warns when a cached optimization omits supplied input", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [{ section: 'Summary', exampleBefore: 'Before', exampleAfter: 'After' }],
      keywords: { add: [], neutral: [], remove: [] },
      source: 'cache',
      evidenceInputOmissions: { resumeCharacters: 17, clarificationCharacters: 4 },
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => expect(screen.getByTestId("toast-mock")).toHaveAttribute("data-toast-type", "warning"));
    expect(screen.getByTestId("toast-mock")).toHaveTextContent(/did not evaluate that omitted text/);
    expect(useResumeStore.getState().optimizeRun.data.evidenceInputOmissions).toEqual({ resumeCharacters: 17, clarificationCharacters: 4 });
  });

  it("restores a refined card and its replacement evidence after remount", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [{ section: 'Summary', exampleBefore: 'Original', exampleAfter: 'First rewrite' }],
      evidenceSources: [], keywords: { add: [], neutral: [], remove: [] }, source: 'gemini',
    });
    const firstPage = render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    await waitFor(() => expect(useResumeStore.getState().optimizeRun?.status).toBe('succeeded'));
    const key = useResumeStore.getState().optimizeRun.assessment.context.key;
    useResumeStore.getState().setOptimizations([{
      sectionId: 'summary -0 ', assessmentKey: key, sectionType: 'summary', original: 'Original',
      optimized: 'First rewrite', applied: false,
    }]);
    const evidence = { version: 1, targetId: 'resume:1', originalFingerprint: 'a', proposedFingerprint: 'b',
      references: [{ sourceId: 'resume:1', quote: 'Original' }], sourceFingerprints: { 'resume:1': 'a' },
      status: 'needs_review', reasons: ['semantic_review'] };
    const source = { id: 'resume:1', kind: 'resume', targetId: 'resume:1', text: 'Original', fingerprint: 'a' };
    act(() => useResumeStore.getState().refineOptimization('summary -0 ', {
      improved: 'Revised rewrite', rationale: 'Clearer', instruction: 'shorten', evidence,
      evidenceSources: [source], evidenceInputOmissions: { resumeCharacters: 0, clarificationCharacters: 0 },
    }));
    firstPage.unmount();
    const persistedRun = JSON.parse(JSON.stringify(useResumeStore.getState().optimizeRun));
    useResumeStore.setState({ optimizations: [], optimizeRun: persistedRun });
    render(<MainContent />);
    await waitFor(() => expect(optimizeSectionMockProps.current.optimizations[0]).toMatchObject({
      optimized: 'Revised rewrite', evidence,
    }));
    expect(useResumeStore.getState().optimizeRun.data.evidenceSources).toContainEqual(source);
  });

  it("does not turn unvalidated raw project rewrites into actionable cards", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [], keywords: { add: [], neutral: [], remove: [] }, source: 'gemini',
      projectImprovements: [{ original: 'Built dashboard', improved: 'Built dashboard for 10,000 users', evidence: { status: 'source_matched' } }],
    });
    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    await waitFor(() => expect(screen.getByTestId('optimization-handler-status')).toHaveTextContent('completed'));
    expect(useResumeStore.getState().optimizeRun.cards).toEqual([]);
  });

  it("passes structured hard-stop answers to optimization without positive clarification text", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");
    generateClarificationsMock.mockResolvedValueOnce({
      clarifications: [{
        id: "excelExperience",
        theme: "Excel",
        rationale: "The role requires Excel evidence.",
        question: "Which Excel work can you verify?",
        type: "single",
        options: [
          { value: "dashboards", label: "Built Excel dashboards" },
          { value: "no_excel", label: "I don't have Excel experience", isHardStop: true },
        ],
        allowOther: true,
      }],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 40, afterScore: 68 },
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    fireEvent.click(await screen.findByRole("button", { name: "I don't have Excel experience" }));
    fireEvent.click(screen.getByRole("button", { name: /submit answers/i }));

    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userClarifications: undefined,
        userHardStops: expect.arrayContaining(["Excel"]),
      }),
      expect.any(Function),
    ));
    expect(JSON.parse(localStorage.getItem("watheq:hardStops"))).toEqual(["Excel"]);
    expect(analyticsMock.trackClarificationOutcome).toHaveBeenCalledWith({
      outcome: "answered",
      questionCount: 1,
      answeredCount: 1,
      hardStopCount: 1,
    });
    await waitFor(() => {
      expect(analyticsMock.trackClarificationScoreDelta).toHaveBeenCalledWith({
        outcome: "answered",
        beforeScore: 40,
        afterScore: 68,
      });
    });
  });

  it("keeps optimization pending through clarification and resolves after submission", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");
    generateClarificationsMock.mockResolvedValueOnce({
      clarifications: [{
        id: "excelExperience",
        theme: "Excel",
        rationale: "The role requires Excel evidence.",
        question: "Which Excel work can you verify?",
        type: "single",
        options: [{ value: "dashboards", label: "Built Excel dashboards" }],
        allowOther: false,
      }],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    expect(await screen.findByRole("button", { name: "Built Excel dashboards" })).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("optimization-handler-status")).toHaveTextContent("pending");

    fireEvent.click(screen.getByRole("button", { name: "Built Excel dashboards" }));
    fireEvent.click(screen.getByRole("button", { name: /submit answers/i }));
    await waitFor(() => {
      expect(screen.getByTestId("optimization-handler-status")).toHaveTextContent("completed");
    });
  });

  it("carries compatible selections through three adaptive rounds into one optimization", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Analytics role");
    const question = (id) => ({ id, theme: id, question: `Verify ${id}`, rationale: "Add evidence", type: "multi", allowOther: false,
      options: [{ value: "a", label: `${id} dashboards` }, { value: "b", label: `${id} reporting` }] });
    generateClarificationsMock.mockResolvedValueOnce({ clarifications: [question("Excel")] })
      .mockResolvedValueOnce({ clarifications: [question("SQL")] })
      .mockResolvedValueOnce({ clarifications: [question("Python")] });
    optimizeResumeStreamMock.mockResolvedValueOnce({ cards: [], keywords: { add: [], neutral: [], remove: [] }, source: "gemini" });
    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    for (const topic of ["Excel", "SQL", "Python"]) {
      fireEvent.click(await screen.findByRole("button", { name: `${topic} dashboards` }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: `${topic} dashboards` })).toHaveAttribute("aria-pressed", "true");
      });
      expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: /submit answers/i }));
    }
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
    const payload = optimizeResumeStreamMock.mock.calls[0][0];
    for (const topic of ["Excel", "SQL", "Python"]) {
      expect(payload.userClarifications).toContain(`${topic} dashboards`);
    }
    expect(generateClarificationsMock.mock.calls[2][0].history).toHaveLength(2);
  });

  it("respects a complete clarification response and optimizes without reopening questions", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Analytics role");
    generateClarificationsMock.mockResolvedValueOnce({
      complete: true,
      clarifications: [{
        id: "stale",
        theme: "Stale",
        rationale: "Should be ignored",
        question: "Should this appear?",
        type: "single",
        options: [{ value: "yes", label: "Stale option" }],
        allowOther: false,
      }],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({ cards: [], keywords: { add: [], neutral: [], remove: [] }, source: "gemini" });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Stale option" })).not.toBeInTheDocument();
  });

  it("shows the clarification check state and prevents a second request while questions are being checked", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");

    let resolveClarifications;
    generateClarificationsMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveClarifications = resolve;
    }));
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);
    const optimizeButton = await screen.findByRole("button", { name: /run optimize/i });
    fireEvent.click(optimizeButton);

    await waitFor(() => {
      expect(screen.getByTestId("clarification-check-status")).toHaveTextContent("checking");
    });

    fireEvent.click(optimizeButton);
    expect(generateClarificationsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClarifications({ clarifications: [] });
    });

    await waitFor(() => {
      expect(screen.getByTestId("clarification-check-status")).toHaveTextContent("idle");
    });
  });

  it("clears the persisted optimization cards and their origin with the parent clear action", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    useResumeStore.setState({
      optimizations: [{
        sectionId: "summary-1",
        sectionType: "summary",
        original: "Before",
        optimized: "After",
        applied: false,
      }],
      optimizationOrigin: "paid",
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: "Clear optimize" }));

    await waitFor(() => {
      expect(useResumeStore.getState().optimizations).toEqual([]);
      expect(useResumeStore.getState().optimizationOrigin).toBeNull();
    });
  });

  it("tracks skipped clarification outcomes and their optimization score delta", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");
    generateClarificationsMock.mockResolvedValueOnce({
      clarifications: [{
        id: "excelExperience",
        theme: "Excel",
        rationale: "The role requires Excel evidence.",
        question: "Which Excel work can you verify?",
        type: "single",
        options: [
          { value: "dashboards", label: "Built Excel dashboards" },
          { value: "no_excel", label: "I don't have Excel experience", isHardStop: true },
        ],
        allowOther: true,
      }],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 40, estimatedImprovement: 12 },
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    fireEvent.click(await screen.findByRole("button", { name: /optimize now/i }));

    await waitFor(() => {
      expect(analyticsMock.trackClarificationOutcome).toHaveBeenCalledWith({
        outcome: "skipped",
        questionCount: 1,
        answeredCount: 0,
        hardStopCount: 0,
      });
      expect(analyticsMock.trackClarificationScoreDelta).toHaveBeenCalledWith({
        outcome: "skipped",
        beforeScore: 40,
        afterScore: 52,
      });
    });
  });

  it("reuses persistent hard stops and hides matching clarification questions", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");
    localStorage.setItem("watheq:hardStops", JSON.stringify(["Excel"]));
    generateClarificationsMock.mockResolvedValueOnce({
      clarifications: [{
        id: "excelExperience",
        theme: "excel",
        rationale: "The role requires Excel evidence.",
        question: "Which Excel work can you verify?",
        type: "single",
        options: [
          { value: "dashboards", label: "Built Excel dashboards" },
          { value: "no_excel", label: "I don't have Excel experience", isHardStop: true },
        ],
        allowOther: true,
      }],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    expect(screen.queryByRole("button", { name: "I don't have Excel experience" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(optimizeResumeStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({ userHardStops: ["Excel"] }),
        expect.any(Function),
      );
    });
  });

  it("regenerates fresh questions, filters persistent hard stops, and clears the loading state", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel and SQL are required");
    localStorage.setItem("watheq:hardStops", JSON.stringify(["Excel"]));

    let resolveRegeneration;
    const regeneration = new Promise((resolve) => {
      resolveRegeneration = resolve;
    });
    generateClarificationsMock
      .mockResolvedValueOnce({
        clarifications: [{
          id: "leadershipExperience",
          theme: "Leadership",
          rationale: "The role requires leadership evidence.",
          question: "Which leadership work can you verify?",
          type: "single",
          options: [{ value: "teams", label: "Led cross-functional teams" }],
          allowOther: false,
        }],
      })
      .mockReturnValueOnce(regeneration);

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    expect(await screen.findByRole(
      "button",
      { name: "Led cross-functional teams" },
      { timeout: 5000 },
    )).toBeInTheDocument();

    const regenerateButton = screen.getByRole("button", { name: "Generate different questions" });
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(generateClarificationsMock).toHaveBeenLastCalledWith(expect.objectContaining({
        resumeText: "Parsed resume",
        jobDesc: "Excel and SQL are required",
        regenerate: true,
      }));
    });
    expect(regenerateButton).toBeDisabled();

    await act(async () => {
      resolveRegeneration({
        clarifications: [
          {
            id: "excelExperience",
            theme: "Excel",
            rationale: "Excel is required.",
            question: "Which Excel work can you verify?",
            type: "single",
            options: [{ value: "excel", label: "Built Excel dashboards" }],
            allowOther: false,
          },
          {
            id: "sqlExperience",
            theme: "SQL",
            rationale: "SQL is required.",
            question: "Which SQL work can you verify?",
            type: "single",
            options: [{ value: "sql", label: "Built SQL dashboards" }],
            allowOther: false,
          },
        ],
      });
    });

    expect(await screen.findByRole("button", { name: "Built SQL dashboards" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Built Excel dashboards" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate different questions" })).not.toBeDisabled();
    });
  });

  it("keeps the current modal open and shows a localized danger toast when filtering removes every regenerated question", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Excel is required");
    localStorage.setItem("watheq:hardStops", JSON.stringify(["Excel"]));
    generateClarificationsMock
      .mockResolvedValueOnce({
        clarifications: [{
          id: "leadershipExperience",
          theme: "Leadership",
          rationale: "The role requires leadership evidence.",
          question: "Which leadership work can you verify?",
          type: "single",
          options: [{ value: "teams", label: "Led cross-functional teams" }],
          allowOther: false,
        }],
      })
      .mockResolvedValueOnce({
        clarifications: [{
          id: "excelExperience",
          theme: "Excel",
          rationale: "Excel is required.",
          question: "Which Excel work can you verify?",
          type: "single",
          options: [{ value: "excel", label: "Built Excel dashboards" }],
          allowOther: false,
        }],
      });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    expect(await screen.findByRole(
      "button",
      { name: "Led cross-functional teams" },
      { timeout: 5000 },
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate different questions" }));

    expect(await screen.findByText(
      "Could not generate new questions. Your current questions are still available.",
    )).toBeInTheDocument();
    // Toasts are a queue now, not a single slot — a feature's result no longer
    // wipes whatever else was on screen. Assert the danger toast is PRESENT
    // rather than that it is the only one.
    expect(
      screen.getAllByTestId("toast-mock").some(
        (node) => node.getAttribute("data-toast-type") === "danger",
      ),
    ).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Led cross-functional teams" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate different questions" })).not.toBeDisabled();
    expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
  });

  it("keeps the current modal open and clears regeneration state when the API rejects", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Leadership is required");
    generateClarificationsMock
      .mockResolvedValueOnce({
        clarifications: [{
          id: "leadershipExperience",
          theme: "Leadership",
          rationale: "The role requires leadership evidence.",
          question: "Which leadership work can you verify?",
          type: "single",
          options: [{ value: "teams", label: "Led cross-functional teams" }],
          allowOther: false,
        }],
      })
      .mockRejectedValueOnce(new Error("network unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    expect(await screen.findByRole(
      "button",
      { name: "Led cross-functional teams" },
      { timeout: 5000 },
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate different questions" }));

    expect(await screen.findByText(
      "Could not generate new questions. Your current questions are still available.",
    )).toBeInTheDocument();
    // Toasts are a queue now, not a single slot — a feature's result no longer
    // wipes whatever else was on screen. Assert the danger toast is PRESENT
    // rather than that it is the only one.
    expect(
      screen.getAllByTestId("toast-mock").some(
        (node) => node.getAttribute("data-toast-type") === "danger",
      ),
    ).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Led cross-functional teams" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate different questions" })).not.toBeDisabled();
    expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
    warning.mockRestore();
  });

  it("skips clarification generation for a strong match with no deterministic vulnerabilities", async () => {
    localStorage.setItem("watheq:lastActiveTab", "match");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    analyzeResumeMock.mockResolvedValueOnce({
      score: 85,
      missingKeywords: [],
      topHits: [],
      suggestions: [],
    });
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run match/i }));
    await waitFor(() => expect(analyzeResumeMock).toHaveBeenCalled());

    const workflow = screen.getByRole("navigation", { name: /resume workflow/i });
    fireEvent.click(within(workflow).getByRole("button", { name: /optimize improve resume/i }));
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    expect(generateClarificationsMock).not.toHaveBeenCalled();
    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalled());
  });

  it("allows guest optimization and clarifications for current onboarding plan testing", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => expect(optimizeResumeStreamMock).toHaveBeenCalled());
    expect(optimizeResumeStreamMock.mock.calls[0][0]).toMatchObject({ freePreview: true });
    await waitFor(() => expect(useResumeStore.getState().optimizationOrigin).toBe('guest_preview'));
    expect(optimizeResumeMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sign in required Sign in to run AI analysis and save your progress/i)).not.toBeInTheDocument();
  });

  it("uses the restored job description after a variant restore nonce bump", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Initial job description");
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
    });

    render(<MainContent />);

    localStorage.setItem("watheq:lastJobDescription", "Restored job description");
    await act(async () => {
      useResumeStore.setState((state) => ({
        variantRestoreNonce: state.variantRestoreNonce + 1,
      }));
    });

    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => {
      expect(optimizeResumeStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({ jobDesc: "Restored job description" }),
        expect.any(Function),
      );
    });
  });

  it("does not render landing pricing or comparison blocks in the authenticated workspace", () => {
    render(<MainContent />);

    expect(screen.queryByText(/Why Choose Watheq/i)).not.toBeInTheDocument();
    expect(screen.queryByText(RegExp(['Generic', 'Tool', 'A'].join(' '), 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(/Generic Resume Builder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Keyword Scanner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manual Editing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pricing/i)).not.toBeInTheDocument();
  });

  it("stores the API score pair from an SSE optimization for the results companion", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    useResumeStore.getState().resetOptimizationMetrics();
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 59, afterScore: 80, estimatedImprovement: 21 },
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => {
      expect(useResumeStore.getState().optimizationMetrics).toMatchObject({
        beforeScore: 59,
        afterScore: 80,
        improvement: 21,
      });
    });
    expect(screen.getByTestId("optimization-companion-score-source")).toHaveTextContent("59:80");
    expect(optimizeResumeMock).not.toHaveBeenCalled();
  });

  it("stores the same API score pair after a known-safe legacy fallback", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    useResumeStore.getState().resetOptimizationMetrics();
    optimizeResumeStreamMock.mockRejectedValueOnce(Object.assign(new Error("stream unavailable"), {
      isBillingStateUnknown: false,
      status: 404,
      code: "STREAM_UNAVAILABLE",
    }));
    optimizeResumeMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 59, afterScore: 80, estimatedImprovement: 21 },
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => {
      expect(useResumeStore.getState().optimizationMetrics).toMatchObject({
        beforeScore: 59,
        afterScore: 80,
        improvement: 21,
      });
    });
    expect(screen.getByTestId("optimization-companion-score-source")).toHaveTextContent("59:80");
    expect(optimizeResumeMock).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });

  it("fires the optimize-completion analytics event exactly once on the SSE success path", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    useResumeStore.getState().resetOptimizationMetrics();
    optimizeResumeStreamMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 59, afterScore: 80, estimatedImprovement: 21 },
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => {
      expect(analyticsMock.trackOptimizationCompleted).toHaveBeenCalledTimes(1);
    });
    expect(optimizeResumeMock).not.toHaveBeenCalled();
  });

  it("fires the optimize-completion analytics event exactly once — not twice — when SSE fails and the legacy fallback succeeds", async () => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:lastJobDescription", "Target job description");
    useResumeStore.getState().resetOptimizationMetrics();
    optimizeResumeStreamMock.mockRejectedValueOnce(Object.assign(new Error("stream unavailable"), {
      isBillingStateUnknown: false,
      status: 404,
      code: "STREAM_UNAVAILABLE",
    }));
    optimizeResumeMock.mockResolvedValueOnce({
      cards: [],
      keywords: { add: [], neutral: [], remove: [] },
      source: "gemini",
      matchScoring: { beforeScore: 59, afterScore: 80, estimatedImprovement: 21 },
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    await waitFor(() => {
      expect(optimizeResumeMock).toHaveBeenCalledTimes(1);
    });
    // Both the SSE attempt AND the legacy fallback ran for this single user
    // action, but the completion event must count the run once, not per attempt —
    // double-counting here would deflate the ADR's variant save-rate gate.
    expect(analyticsMock.trackOptimizationCompleted).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });

  it("shows the simplified primary workflow and keeps secondary tools behind More tools", async () => {
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));

    render(<MainContent />);

    const workflow = screen.getByRole("navigation", { name: /resume workflow/i });
    expect(workflow).toBeInTheDocument();
    expect(within(workflow).getByRole("button", { name: /resume upload or paste/i })).toBeInTheDocument();
    // Job Ad is removed from stepper; Match now shows "Add job ad" hint when no job description
    expect(within(workflow).getByRole("button", { name: /match add job ad/i })).toBeInTheDocument();
    expect(within(workflow).getByRole("button", { name: /optimize improve resume/i })).toBeInTheDocument();
    expect(within(workflow).getByRole("button", { name: /export \/ pipeline save and track/i })).toBeInTheDocument();
    expect(within(workflow).queryByRole("button", { name: /tabs\.interview/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /more tools/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /more tools/i })[0]);

    expect((await screen.findAllByText("Open tool")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tabs\.interview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tabs\.coverLetter/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vision 2030/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tabs\.bulk/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pipeline/i).length).toBeGreaterThan(0);
  });

  it("keeps the Path-A intent panel mounted through the role answer, then unmounts on complete", async () => {
    // Signed-in user, freshly parsed resume in the store, no intent yet, prompt unseen.
    localStorage.setItem("watheq:lastActiveTab", "resume");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", basics: { name: "Sara Al-Otaibi" }, sections: [] }));
    useResumeStore.setState({
      originalResume: {
        basics: { name: "Sara Al-Otaibi", label: "", email: "", phone: "", summary: "", location: { city: "", countryCode: "", region: "" }, profiles: [] },
        work: [],
        education: [],
        skills: [],
      },
      searchIntent: null,
    });
    onboardExtractMock.mockResolvedValue({ value: { targetRoles: ["Frontend Engineer"] }, confidence: "high" });

    render(<MainContent />);

    // role slot is shown (cv_basics skipped inline)
    expect(await screen.findByText("What role are you targeting?")).toBeInTheDocument();

    // Answer role — this writes searchIntent. The intent write must not unmount the
    // panel mid-flow (the original bug); role is the terminal slot, so the panel
    // completes and unmounts, and no location question is ever asked.
    fireEvent.change(screen.getByPlaceholderText(/senior frontend engineer/i), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(screen.queryByText("What role are you targeting?")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Where do you want to work?")).not.toBeInTheDocument();
    expect(localStorage.getItem("watheq:intentPrompted")).toBe("true");
    const intent = useResumeStore.getState().searchIntent;
    expect(intent?.targetRoles).toEqual(["Frontend Engineer"]);
  });
});


describe("job feed hand-off", () => {
  beforeEach(() => {
    authMockState.user = { id: "user-123", user_metadata: {}, app_metadata: {} };
    authMockState.loading = false;
    parseResumeMock.mockReset();
    analyzeResumeMock.mockClear();
    parseResumeMock.mockResolvedValue({ plainText: "Parsed resume", bullets: [], sections: [] });
    useResumeStore.setState({ originalResume: null, searchIntent: null });
    useResumeLibraryStore.setState({ entries: [], activeResumeId: null, initialized: false });
    Object.values(analyticsMock).forEach((mock) => mock.mockClear());
    const storage = {};
    global.localStorage = {
      getItem: vi.fn((key) => (key === "watheq:beta_access" ? "WATHEQ01" : storage[key] ?? null)),
      setItem: vi.fn((key, value) => { storage[key] = value; }),
      removeItem: vi.fn((key) => { delete storage[key]; }),
      clear: vi.fn(() => { Object.keys(storage).forEach((key) => delete storage[key]); }),
    };
  });

  it("passes the active job description to every auxiliary tool", async () => {
    localStorage.setItem('watheq:resumeData', JSON.stringify({ plainText: 'Candidate resume experience', sections: [] }));
    localStorage.setItem('watheq:lastJobDescription', 'Current target job');
    render(<MainContent />);
    for (const [tab, key] of [['interview', 'interview'], ['bulk', 'bulk'], ['cover-letter', 'coverLetter']]) {
      await act(async () => { window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab } })); });
      await screen.findByTestId(`${key}-wiring-mock`);
      expect(auxiliarySectionMockProps[key].jobDescription).toBe('Current target job');
    }
  });

  it("passes live Optimize job inputs across A to empty B and back to A", async () => {
    const parsedResume = { basics: { name: 'Candidate' }, work: [], education: [], skills: [] };
    useResumeLibraryStore.setState({ initialized: true, activeResumeId: 'a', entries: [
      { id: 'a', name: 'A.pdf', parsedResume, plainText: 'First resume experience', fingerprint: 'a1', createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B.pdf', parsedResume, plainText: 'Second resume experience', fingerprint: 'b1', createdAt: 2, updatedAt: 2 },
    ] });
    render(<MainContent />);
    await act(async () => { window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'match' } })); });
    await screen.findByTestId('job-match-mock');
    await act(async () => { matchSectionMockProps.current.onJobDescriptionChange('Resume A target job'); });
    await act(async () => { window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'optimize' } })); });
    await screen.findByTestId('optimization-mock');
    expect(optimizeSectionMockProps.current.jobDescription).toBe('Resume A target job');
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'b' }));
    await waitFor(() => expect(optimizeSectionMockProps.current.jobDescription).toBe(''));
    expect(localStorage.getItem('watheq:lastJobDescription')).toBe('Resume A target job');
    expect(optimizeSectionMockProps.current.hasMatchAnalysis).toBe(false);
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'a' }));
    await waitFor(() => expect(optimizeSectionMockProps.current.jobDescription).toBe('Resume A target job'));
  });

  it("never renders a legacy Truth Check before resume provenance is known", async () => {
    localStorage.setItem("watheq:lastActiveTab", "truth-check");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));
    localStorage.setItem("watheq:resumeTruthCheck", JSON.stringify({
      contractVersion: 1,
      resumeHash: "13:b2znuz:n3scy7",
      hardStopsHash: "",
      language: "en",
      result: { overallRisk: "high", summary: "Old result", claims: [], limits: { cannotVerify: [] } },
    }));
    useResumeLibraryStore.setState({ entries: [], activeResumeId: null, initialized: false });
    render(<MainContent />);
    await screen.findByRole('button', { name: /run truth check/i });
    expect(screen.queryByText(/Truth risk: high/i)).not.toBeInTheDocument();
  });

  it("restores match results only for the resume that produced them", async () => {
    const parsedResume = { basics: { name: 'Same Candidate', label: '', email: '', phone: '', summary: '', location: { city: '', countryCode: '', region: '' }, profiles: [] }, work: [], education: [], skills: [], projects: [] };
    useResumeLibraryStore.setState({ initialized: true, activeResumeId: 'a', entries: [
      { id: 'a', name: 'A.pdf', parsedResume, plainText: 'First resume experience', fingerprint: 'a1', createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B.pdf', parsedResume, plainText: 'Second resume experience', fingerprint: 'b1', createdAt: 2, updatedAt: 2 },
    ] });
    analyzeResumeMock.mockResolvedValue({ score: 77, missingKeywords: [], topHits: [], suggestions: [] });
    render(<MainContent />);
    await act(async () => { window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'match' } })); });
    await act(async () => { await matchSectionMockProps.current.onAnalyzeMatchAI('Target job description'); });
    await waitFor(() => expect(matchSectionMockProps.current.matchAnalysis?.score).toBe(77));
    const saved = JSON.parse(localStorage.getItem('watheq:lastMatchAnalysis'));
    expect(saved.assessment.result.origin).toBe('paid');
    expect(saved.assessment.context).toMatchObject({ language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
    expect(saved.assessment.context.resumeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.assessment.jobSnapshot).toBe('Target job description');
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'b' }));
    await waitFor(() => expect(matchSectionMockProps.current.matchAnalysis).toBeNull());
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'a' }));
    await waitFor(() => expect(matchSectionMockProps.current.matchAnalysis?.score).toBe(77));
    expect(matchSectionMockProps.current.matchAnalysis.origin).toBe('paid');
    expect(useResumeStore.getState().optimizationMetrics.beforeScore).toBe(77);
    expect(useResumeStore.getState().baselineMatchScore).toBe(77);
    expect(analyzeResumeMock).toHaveBeenCalledTimes(1);
  });

  it("preserves export provenance without restoring an unscoped score after upload", async () => {
    const parsedResume = { basics: { name: 'Candidate', label: '', email: '', phone: '', summary: '', location: { city: '', countryCode: '', region: '' }, profiles: [] }, work: [], education: [], skills: [], projects: [] };
    useResumeLibraryStore.setState({ initialized: true, activeResumeId: 'a', entries: [
      { id: 'a', name: 'A.pdf', parsedResume, plainText: 'First resume experience', fingerprint: 'a1', createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B.pdf', parsedResume, plainText: 'Second resume experience', fingerprint: 'b1', createdAt: 2, updatedAt: 2 },
    ] });
    render(<MainContent />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Select resume: A.pdf/ })).toBeInTheDocument());
    act(() => useResumeStore.setState({
      optimizationMetrics: { ...useResumeStore.getState().optimizationMetrics, beforeScore: 71 },
      optimizationOrigin: 'paid',
    }));
    act(() => {
      resumeUploadMockProps.current.onBeforeParseResume?.();
      useResumeStore.getState().resetForNewUpload();
      useResumeLibraryStore.setState({ activeResumeId: 'b' });
    });
    await waitFor(() => expect(useResumeLibraryStore.getState().activeResumeId).toBe('b'));
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'a' }));
    await waitFor(() => expect(useResumeStore.getState().optimizationMetrics.beforeScore).toBeNull());
    expect(useResumeStore.getState().optimizationOrigin).toBe('paid');
  });

  it("announces updating before confirming a resume switch", async () => {
    const parsedResume = { basics: { name: 'Candidate', label: '', email: '', phone: '', summary: '', location: { city: '', countryCode: '', region: '' }, profiles: [] }, work: [], education: [], skills: [], projects: [] };
    useResumeLibraryStore.setState({ initialized: true, activeResumeId: 'a', entries: [
      { id: 'a', name: 'A.pdf', parsedResume, plainText: 'First resume experience', fingerprint: 'a1', createdAt: 1, updatedAt: 1 },
      { id: 'b', name: 'B.pdf', parsedResume, plainText: 'Second resume experience', fingerprint: 'b1', createdAt: 2, updatedAt: 2 },
    ] });
    render(<MainContent />);
    act(() => useResumeLibraryStore.setState({ activeResumeId: 'b' }));
    expect(screen.getByText(/Updating results for/)).toBeInTheDocument();
    expect(await screen.findByText(/Using/)).toBeInTheDocument();
  });

  it("gives the feed somewhere to send a posting", async () => {
    // The feed's "Check the match" button is rendered only when this prop exists.
    // Mounted without it, the button silently never appears — which is how it
    // shipped: <JobFeedSection /> with no props at all.
    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", plainText: "CV text" });
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });

    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());
    expect(typeof jobFeedMockProps.current.onMatchPosting).toBe("function");
  });

  it("opens the match tab on the posting the user picked", async () => {
    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", plainText: "CV text" });
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });
    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());

    await act(async () => {
      jobFeedMockProps.current.onMatchPosting({
        jobDescription: "Senior AI Engineer at Salla. Build agents.",
        companyName: "Salla",
        jobTitle: "Senior AI Engineer",
      });
    });

    // The Match tab reads the stored job description when it mounts, so the
    // hand-off is: store it, then go there. No analysis is started on the user's
    // behalf — that spends a credit they did not ask to spend.
    expect(await screen.findByTestId("job-match-mock")).toBeInTheDocument();
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "watheq:lastJobDescription",
      "Senior AI Engineer at Salla. Build agents.",
    );
    expect(analyzeResumeMock).not.toHaveBeenCalled();
  });

  it("drops the previous job's analysis so the new description is visible", async () => {
    // MatchSection hides its job-description editor entirely whenever results exist
    // (its `hasResults` gate). Arriving with a stale analysis therefore showed the
    // OLD posting's score and no visible JD box, so the hand-off looked like it had
    // only navigated — the reported "Check match only moves me to the match section".
    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", plainText: "CV text" });
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });
    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());

    // Establish a PRIOR analysis. Without this the test proves nothing: matchAnalysis
    // is null on a fresh render anyway, so the assertion below would pass even with
    // the fix deleted. Verified by removing setMatchAnalysis(null) and watching this
    // test go red.
    analyzeResumeMock.mockResolvedValueOnce({
      score: 61,
      missingKeywords: [],
      topHits: [],
      suggestions: [],
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "match" } }));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Run match"));
    });
    await waitFor(() => expect(matchSectionMockProps.current.matchAnalysis).not.toBeNull());

    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });
    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());

    await act(async () => {
      jobFeedMockProps.current.onMatchPosting({
        jobDescription: "Senior AI Engineer at Salla. Build agents.",
        companyName: "Salla",
        jobTitle: "Senior AI Engineer",
      });
    });

    expect(await screen.findByTestId("job-match-mock")).toBeInTheDocument();

    // The assertion that guards the fix: MatchSection must receive a null analysis,
    // because its `hasResults` gate is what hides the job-description editor.
    // Asserting only the localStorage removal stays green without the fix, and
    // loadCachedMatchAnalysis already refuses to restore an analysis keyed to a
    // different jobText — so that half is nearly inert on its own.
    expect(matchSectionMockProps.current.matchAnalysis).toBeNull();
    expect(matchSectionMockProps.current.jobDescription).toBe(
      "Senior AI Engineer at Salla. Build agents.",
    );
  });

  it("records where a matched posting came from", async () => {
    // Every comparable hand-off in the app is instrumented. Without this one
    // there is no way to tell a match the feed sent from one the user pasted,
    // which is the only measure of whether the feed is worth its crawl.
    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", plainText: "CV text" });
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });
    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());

    await act(async () => {
      jobFeedMockProps.current.onMatchPosting({
        jobDescription: "Senior AI Engineer at Salla. Build agents.",
        companyName: "Salla",
        jobTitle: "Senior AI Engineer",
      });
    });

    expect(analyticsMock.track).toHaveBeenCalledWith("job_feed_match_handoff", {
      company: "Salla",
      title: "Senior AI Engineer",
    });
  });

  it("does not record a hand-off that never happened", async () => {
    render(<MainContent />);

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume({ kind: "text", plainText: "CV text" });
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab: "job-feed" } }));
    });
    await waitFor(() => expect(jobFeedMockProps.current).toBeTruthy());

    await act(async () => {
      jobFeedMockProps.current.onMatchPosting({
        jobDescription: "   ",
        companyName: "Salla",
        jobTitle: "Senior AI Engineer",
      });
    });

    expect(analyticsMock.track).not.toHaveBeenCalled();
    expect(screen.queryByTestId("job-match-mock")).not.toBeInTheDocument();
  });
});


describe("reaching tools before a resume exists", () => {
  const renderWorkspace = async () => {
    render(<MainContent />);
    // The workspace only settles after the first effects flush; asserting before
    // that would pass against the redirect this suite exists to pin down.
    await waitFor(() => expect(resumeUploadMockProps.current).toBeTruthy());
  };

  const goTo = async (tab) => {
    await act(async () => {
      window.dispatchEvent(new CustomEvent("watheq:navigate-tab", { detail: { tab } }));
    });
  };

  beforeEach(() => {
    authMockState.user = { id: "user-123", user_metadata: {}, app_metadata: {} };
    authMockState.loading = false;
    jobFeedMockProps.current = null;
    pipelineMockProps.current = null;
    mobileWorkflowMockProps.current = null;
    useResumeStore.setState({ originalResume: null, searchIntent: null });
    Object.values(analyticsMock).forEach((mock) => mock.mockClear());
    const storage = {};
    global.localStorage = {
      getItem: vi.fn((key) => (key === "watheq:beta_access" ? "WATHEQ01" : storage[key] ?? null)),
      setItem: vi.fn((key, value) => { storage[key] = value; }),
      removeItem: vi.fn((key) => { delete storage[key]; }),
      clear: vi.fn(() => { Object.keys(storage).forEach((key) => delete storage[key]); }),
    };
  });

  it("opens the Job Feed with no resume, and keeps it open", async () => {
    // The feed reads no CV — it ranks from a target role. It was unreachable only
    // because a blanket effect sent every non-resume tab back to Upload, and that
    // effect runs on a LATER commit, so this has to survive a flush to mean anything.
    await renderWorkspace();
    await goTo("job-feed");

    expect(await screen.findByTestId("job-feed-mock")).toBeInTheDocument();

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("job-feed-mock")).toBeInTheDocument();
  });

  it("opens the Pipeline with no resume", async () => {
    // Saved jobs exist before a CV does. The comment on the mobile nav already
    // said Pipeline should be reachable; the redirect silently disagreed.
    await renderWorkspace();
    await goTo("pipeline");

    expect(await screen.findByTestId("pipeline-mock")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("pipeline-mock")).toBeInTheDocument();
  });

  it("still sends a resume-dependent tab back to Upload", async () => {
    // The guard rail. Match cannot do anything without a CV, so the gate stays.
    await renderWorkspace();
    await goTo("match");

    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("job-match-mock")).not.toBeInTheDocument();
    expect(screen.getByTestId("resume-upload-mock")).toBeInTheDocument();
    expect(screen.getByTestId("toast-mock")).toHaveAttribute("data-toast-type", "warning");
  });

  it("opens the More tools panel with no resume", async () => {
    // The button used to look live and do nothing but shout.
    await renderWorkspace();
    await goTo("more-tools");

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("more-tools-job-feed")).toBeInTheDocument();
  });

  it("marks the tools inside the panel that a resume does unlock", async () => {
    await renderWorkspace();
    await goTo("more-tools");

    expect(screen.getByTestId("more-tools-job-feed")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByTestId("more-tools-interview")).toHaveAttribute("aria-disabled", "true");
  });

  it("explains a locked tool rather than ignoring the click", async () => {
    await renderWorkspace();
    await goTo("more-tools");

    await act(async () => {
      screen.getByTestId("more-tools-interview").click();
    });

    expect(screen.getByTestId("toast-mock")).toHaveAttribute("data-toast-type", "warning");
    // And it did not navigate.
    expect(screen.getByTestId("more-tools-job-feed")).toBeInTheDocument();
  });

  it("does not offer the match hand-off it would only refuse", async () => {
    // The feed fetches the posting's description before calling this, so a button
    // that ends in "Resume required" costs a network round trip and an analytics
    // event first — on the very path this change opens up.
    await renderWorkspace();
    await goTo("job-feed");
    await screen.findByTestId("job-feed-mock");

    expect(jobFeedMockProps.current.onMatchPosting).toBeUndefined();
  });

  it("keeps the mobile More tools step in step with the desktop one", async () => {
    // The desktop button opens the panel with no resume; the mobile step had its
    // own copy of the gate and stayed hard-locked. One predicate, both surfaces.
    await renderWorkspace();

    const mobileNav = mobileWorkflowMockProps.current;
    expect(mobileNav).toBeTruthy();
    const moreTools = mobileNav.primarySteps.find((step) => step.value === "more-tools");
    expect(moreTools?.disabledReason).toBeUndefined();
    expect(mobileNav.primarySteps.find((step) => step.value === "match")?.disabledReason).toBeTruthy();
  });

  it("clears the resume out of the store, not just out of this component", async () => {
    // Two records of the same fact: MainContent's `resumeData.plainText` gates the
    // tabs, the store's `originalResume` feeds everything that reads the CV.
    // Clearing one left the other, so a cleared CV still produced CV-derived role
    // chips in the Job Feed and a button offering to swap a file that was gone.
    useResumeStore.setState({
      originalResume: { basics: { name: 'Abdullah', label: 'Senior AI Engineer' }, work: [] },
      parsedResumeText: 'CV text',
      searchIntent: { targetRoles: ['Senior AI Engineer'], meta: { confidence: 'high', completeness: 50, updatedAt: '' } },
    });

    await renderWorkspace();
    await act(async () => {
      resumeUploadMockProps.current.onClear();
    });

    expect(useResumeStore.getState().originalResume).toBeNull();
    expect(useResumeStore.getState().parsedResumeText).toBeNull();
    // The target role is job-search intent, not resume data — and the feed runs on
    // it alone, so clearing a CV must not empty the feed too.
    expect(useResumeStore.getState().searchIntent?.targetRoles).toEqual(['Senior AI Engineer']);
  });

  it("restores a stored Job Feed tab with no resume", async () => {
    const storage = { "watheq:lastActiveTab": "job-feed", "watheq:beta_access": "WATHEQ01" };
    global.localStorage = {
      getItem: vi.fn((key) => storage[key] ?? null),
      setItem: vi.fn((key, value) => { storage[key] = value; }),
      removeItem: vi.fn((key) => { delete storage[key]; }),
      clear: vi.fn(),
    };

    await renderWorkspace();

    expect(await screen.findByTestId("job-feed-mock")).toBeInTheDocument();
  });
});

describe("MainContent final export review", () => {
  const resume = () => ({ basics: { name: "Sara", label: "", email: "", phone: "", summary: "Original summary",
    location: { city: "", countryCode: "", region: "" }, profiles: [] }, work: [], education: [], skills: [] });
  const edit = () => ({ sectionId: "summary-1", sectionType: "summary", original: "Original summary",
    optimized: "Proposed summary", applied: true,
    evidence: { version: 1, targetId: "basics:summary", originalFingerprint: "old", proposedFingerprint: "new",
      references: [], sourceFingerprints: {}, status: "needs_review", reasons: ["semantic_review"] } });
  const openExport = async (state) => {
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Original resume", sections: [] }));
    useResumeStore.setState({ originalResume: resume(), optimizations: [], showOptimized: true,
      isSaudiNational: false, optimizationOrigin: null, ...state });
    render(<MainContent />);
    await screen.findByTestId("optimization-mock");
  };

  beforeEach(() => {
    const storage = { "watheq:beta_access": "WATHEQ01" };
    global.localStorage = { getItem: vi.fn((key) => storage[key] ?? null),
      setItem: vi.fn((key, value) => { storage[key] = value; }), removeItem: vi.fn(), clear: vi.fn() };
    authMockState.user = { id: "user-123", user_metadata: {}, app_metadata: {} };
    exportPdfMock.mockReset().mockResolvedValue("<html>reviewed</html>");
    exportToSupabaseMock.mockReset().mockResolvedValue({ fileName: "resume.html" });
    supabaseAvailableMock.mockReset().mockReturnValue(false);
  });

  it("blocks print and cloud when an included claim still needs review", async () => {
    await openExport({ optimizations: [edit()] });
    await act(async () => { await optimizeSectionMockProps.current.onExport("styled", "print"); });
    await act(async () => { await optimizeSectionMockProps.current.onExport("styled", "supabase"); });
    expect(exportPdfMock).not.toHaveBeenCalled();
    expect(exportToSupabaseMock).not.toHaveBeenCalled();
    expect(optimizeSectionMockProps.current.reviewSectionIds).toEqual(["summary-1"]);
  });

  it("exports the captured composition when the store changes during review hashing", async () => {
    const confirmed = { ...edit(), confirmation: { targetId: "basics:summary", proposedFingerprint: "new",
      statement: "Proposed summary", confirmedAt: "2026-09-24" } };
    await openExport({ optimizations: [confirmed] });
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    let resumeDigest;
    const pendingDigest = new Promise((resolve) => { resumeDigest = resolve; });
    const digestSpy = vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => pendingDigest);
    try {
      let run;
      await act(async () => { run = optimizeSectionMockProps.current.onExport("styled", "print"); });
      useResumeStore.setState({ originalResume: { ...resume(), basics: { ...resume().basics, summary: "Changed later" } } });
      resumeDigest(await originalDigest("SHA-256", new TextEncoder().encode("captured")));
      await act(async () => { await run; });
      expect(exportPdfMock).toHaveBeenCalledWith(expect.objectContaining({
        resumeDocument: expect.objectContaining({ basics: expect.objectContaining({ summary: "Proposed summary" }) }),
      }));
      expect(exportPdfMock.mock.calls[0][0]).not.toHaveProperty("optimizations");
    } finally { digestSpy.mockRestore(); }
  });

  it("uploads only rendered HTML from the reviewed snapshot", async () => {
    supabaseAvailableMock.mockReturnValue(true);
    const confirmed = { ...edit(), confirmation: { targetId: "basics:summary", proposedFingerprint: "new",
      statement: "Proposed summary", confirmedAt: "2026-09-24" } };
    await openExport({ optimizations: [confirmed] });
    await act(async () => { await optimizeSectionMockProps.current.onExport("ats-plain", "supabase"); });
    expect(exportPdfMock).toHaveBeenCalledWith(expect.objectContaining({
      resumeDocument: expect.objectContaining({ basics: expect.objectContaining({ summary: "Proposed summary" }) }),
      variant: "ats-plain", skipPrint: true,
    }));
    expect(exportToSupabaseMock).toHaveBeenCalledWith(expect.objectContaining({ htmlContent: "<html>reviewed</html>" }));
    expect(exportToSupabaseMock.mock.calls[0][0].metadata).not.toHaveProperty("evidence");
  });

  it("falls back to reviewed print when cloud storage is unavailable", async () => {
    await openExport({ optimizations: [] });
    await act(async () => { await optimizeSectionMockProps.current.onExport("styled", "supabase"); });
    expect(exportToSupabaseMock).not.toHaveBeenCalled();
    expect(exportPdfMock).toHaveBeenCalledWith(expect.objectContaining({
      resumeDocument: expect.objectContaining({ basics: expect.objectContaining({ summary: "Original summary" }) }),
      variant: "styled",
    }));
    expect(exportPdfMock.mock.calls.at(-1)[0].skipPrint).toBeUndefined();
  });

  it("requires fingerprint-bound review when the original baseline is absent", async () => {
    await openExport({ originalResume: null, optimizations: [edit()] });
    await act(async () => { await optimizeSectionMockProps.current.onExport("styled", "print"); });
    expect(exportPdfMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Review current document" })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText("I reviewed this document")); });
    expect(exportPdfMock).toHaveBeenCalled();
  });

});
