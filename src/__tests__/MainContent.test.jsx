import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainContent from "../components/Layout/MainContent";

const {
  parseResumeMock,
  analyzeResumeMock,
  optimizeResumeMock,
  optimizeResumeStreamMock,
  generateClarificationsMock,
  extractJobMetadataMock,
} = vi.hoisted(() => ({
  parseResumeMock: vi.fn(),
  analyzeResumeMock: vi.fn(),
  optimizeResumeMock: vi.fn(),
  optimizeResumeStreamMock: vi.fn(),
  // Non-fatal: always returns empty clarifications in tests so the optimize flow proceeds directly
  generateClarificationsMock: vi.fn().mockResolvedValue({ clarifications: [] }),
  extractJobMetadataMock: vi.fn(() => Promise.resolve(null)),
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
            Promise.resolve(props.onAnalyzeMatchAI?.("Target job description")).catch(() => {});
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
        React.createElement("button", { onClick: () => props.onOptimize?.("auto") }, "Run optimize")
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
  generateClarifications: generateClarificationsMock,
  extractJobMetadata: extractJobMetadataMock,
  AI_DEFAULT_TEMPERATURE: 0.32,
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
    extractJobMetadataMock.mockReset();
    extractJobMetadataMock.mockResolvedValue(null);
    generateClarificationsMock.mockReset();
    generateClarificationsMock.mockResolvedValue({ clarifications: [] });
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
    expect(await screen.findByTestId("resume-upload-mock")).toBeInTheDocument();
  });

  it("shows guest sign-in and exit controls when guest mode is intentionally persisted", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    expect(await screen.findByText(/Preview the workflow here\. Sign in to process resumes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to save progress/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to landing/i }));

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    expect(await screen.findByTestId("landing-page-mock")).toBeInTheDocument();
  });

  it("passes sign-in-required upload props in guest workspace", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    expect(await screen.findByTestId("resume-upload-mock")).toBeInTheDocument();
    expect(resumeUploadMockProps.current).toMatchObject({
      requiresSignIn: true,
      authRequiredTitle: "Sign in required",
      authRequiredMessage: "Please sign in to securely process your resume.",
      authActionLabel: "Create or sign in with Google",
    });

    act(() => {
      resumeUploadMockProps.current.onAuthRequired();
    });

    expect(await screen.findByText(/Sign in required Please sign in to securely process your resume/i)).toBeInTheDocument();

    act(() => {
      resumeUploadMockProps.current.onAuthAction();
    });

    expect(authMockState.signInWithGoogle).toHaveBeenCalledWith({
      intent: "signup",
      source: "upload_auth_required",
    });
  });

  it("gates guest match analysis before backend calls", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    localStorage.setItem("watheq:lastActiveTab", "match");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run match/i }));

    expect(analyzeResumeMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Sign in required Sign in to run AI analysis and save your progress/i)).toBeInTheDocument();
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
    expect(analyzeResumeMock).toHaveBeenCalledWith("Parsed resume", "Target job description", undefined);
    expect(extractJobMetadataMock).toHaveBeenCalledWith("Target job description", undefined);
  });

  it("gates guest optimization and clarifications before backend calls", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");
    localStorage.setItem("watheq:lastActiveTab", "optimize");
    localStorage.setItem("watheq:resumeData", JSON.stringify({ plainText: "Parsed resume", sections: [] }));

    render(<MainContent />);

    fireEvent.click(await screen.findByRole("button", { name: /run optimize/i }));

    expect(generateClarificationsMock).not.toHaveBeenCalled();
    expect(optimizeResumeMock).not.toHaveBeenCalled();
    expect(optimizeResumeStreamMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Sign in required Sign in to run AI analysis and save your progress/i)).toBeInTheDocument();
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
    expect(within(workflow).getByRole("button", { name: /job ad add description/i })).toBeInTheDocument();
    expect(within(workflow).getByRole("button", { name: /match analyze fit/i })).toBeInTheDocument();
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
});




