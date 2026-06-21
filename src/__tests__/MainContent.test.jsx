import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainContent from "../components/Layout/MainContent";
import { useResumeStore } from "../lib/stores/resumeStore";

const {
  parseResumeMock,
  analyzeResumeMock,
  optimizeResumeMock,
  optimizeResumeStreamMock,
  analyzeResumeTruthCheckMock,
  generateClarificationsMock,
  extractJobMetadataMock,
  onboardExtractMock,
  analyticsMock,
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
  analyticsMock: {
    trackGuestPreviewStarted: vi.fn(),
    trackGuestPreviewLimitHit: vi.fn(),
    trackGuestPreviewSigninStarted: vi.fn(),
    trackResumeTruthCheck: vi.fn(),
    trackJobMetadataExtracted: vi.fn(),
    trackJobMetadataExtractionFailed: vi.fn(),
    trackPipelineExportAttached: vi.fn(),
  },
}));

const resumeUploadMockProps = vi.hoisted(() => ({ current: null }));
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

vi.mock("../components/sections/MatchSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    MatchSection: (props) =>
      React.createElement(
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
      ),
  };
});

vi.mock("../components/sections/OptimizeSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    OptimizeSection: (props) =>
      React.createElement(
        "div",
        { "data-testid": "optimization-mock" },
        React.createElement("button", { onClick: () => props.onOptimize?.("auto", { freePreview: true }) }, "Run optimize")
      ),
  };
});

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
    default: ({ title, description }) =>
      React.createElement(
        "div",
        { "data-testid": "toast-mock" },
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

vi.mock("../services/supabaseExport.js", () => ({
  saveResumeToSupabase: vi.fn(),
  saveOptimizationToSupabase: vi.fn(),
  exportToSupabase: vi.fn(),
  isSupabaseExportAvailable: vi.fn(() => false),
}));

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
    generateClarificationsMock.mockReset();
    generateClarificationsMock.mockResolvedValue({ clarifications: [] });
    onboardExtractMock.mockReset();
    onboardExtractMock.mockResolvedValue({ value: {}, confidence: "low" });
    // Path-A inline panel gates on the store — reset so it only appears where a test
    // opts in by setting originalResume.
    useResumeStore.setState({ originalResume: null, searchIntent: null });
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

  it("opens guest workspace from the signed-out preview CTA without starting Google sign-in", async () => {
    authMockState.user = null;

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

    expect(analyzeResumeMock).toHaveBeenCalledWith("Parsed resume", "Target job description", undefined, { freePreview: true });
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
    expect(analyzeResumeMock).toHaveBeenCalledWith("Parsed resume", "Target job description", undefined, { freePreview: true });
    expect(extractJobMetadataMock).toHaveBeenCalledWith("Target job description", undefined);
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
      language: undefined,
      userHardStops: ["Excel"],
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "watheq:resumeTruthCheck",
      expect.stringContaining("Owned transformation")
    );
    expect(screen.queryByText(/credits/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Request ID: truth-debug-1/i)).toBeInTheDocument();
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
    });

    render(<MainContent />);
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));
    fireEvent.click(await screen.findByRole("button", { name: "I don't have Excel experience" }));
    fireEvent.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(optimizeResumeStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userClarifications: undefined,
        userHardStops: ["Excel"],
      }),
      expect.any(Function),
    );
    expect(JSON.parse(localStorage.getItem("watheq:hardStops"))).toEqual(["Excel"]);
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
    expect(analyzeResumeMock).toHaveBeenCalled();

    const workflow = screen.getByRole("navigation", { name: /resume workflow/i });
    fireEvent.click(within(workflow).getByRole("button", { name: /optimize improve resume/i }));
    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    expect(generateClarificationsMock).not.toHaveBeenCalled();
    expect(optimizeResumeStreamMock).toHaveBeenCalled();
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
    expect(optimizeResumeMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sign in required Sign in to run AI analysis and save your progress/i)).not.toBeInTheDocument();
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

  it("keeps the Path-A intent panel mounted across role -> location, then unmounts on complete", async () => {
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

    // Answer role — this writes searchIntent. The panel must NOT unmount (the bug).
    fireEvent.change(screen.getByPlaceholderText(/senior frontend engineer/i), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    // location slot appears -> panel stayed mounted even though intent is now non-empty.
    expect(await screen.findByText("Where do you want to work?")).toBeInTheDocument();
    expect(useResumeStore.getState().searchIntent?.targetRoles).toEqual(["Frontend Engineer"]);

    // location via chip -> final slot resolved -> onComplete -> panel unmounts
    fireEvent.click(screen.getByRole("button", { name: /^remote$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Where do you want to work?")).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("watheq:intentPrompted")).toBe("true");
    const intent = useResumeStore.getState().searchIntent;
    expect(intent?.location?.workMode).toBe("remote");
  });
});
