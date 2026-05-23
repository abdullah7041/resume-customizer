import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainContent from "../components/Layout/MainContent";

const {
  parseResumeMock,
  analyzeResumeMock,
  optimizeResumeMock,
  optimizeResumeStreamMock,
  generateClarificationsMock,
} = vi.hoisted(() => ({
  parseResumeMock: vi.fn(),
  analyzeResumeMock: vi.fn(),
  optimizeResumeMock: vi.fn(),
  optimizeResumeStreamMock: vi.fn(),
  // Non-fatal: always returns empty clarifications in tests so the optimize flow proceeds directly
  generateClarificationsMock: vi.fn().mockResolvedValue({ clarifications: [] }),
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
        React.createElement("button", { onClick: props.onGetStarted }, "Try free without sign-in"),
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
    MatchSection: () => React.createElement("div", { "data-testid": "job-match-mock" }),
  };
});

vi.mock("../components/sections/OptimizeSection", () => {
  const React = require("react");
  return {
    __esModule: true,
    OptimizeSection: () => React.createElement("div", { "data-testid": "optimization-mock" }),
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
  extractJobMetadata: vi.fn(() => Promise.resolve(null)),
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

  it("opens guest workspace from the signed-out try CTA without starting Google sign-in", async () => {
    authMockState.user = null;

    render(<MainContent />);

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /try free without sign-in/i }));

    expect(authMockState.signInWithGoogle).not.toHaveBeenCalled();
    expect(localStorage.getItem("watheq:guestMode")).toBe("true");
    expect(await screen.findByTestId("resume-upload-mock")).toBeInTheDocument();
  });

  it("shows guest sign-in and exit controls when guest mode is intentionally persisted", async () => {
    authMockState.user = null;
    localStorage.setItem("watheq:guestMode", "true");

    render(<MainContent />);

    expect(await screen.findByText(/Sign in is needed to run AI match\/optimization/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to save progress/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to landing/i }));

    expect(localStorage.getItem("watheq:guestMode")).toBeNull();
    expect(await screen.findByTestId("landing-page-mock")).toBeInTheDocument();
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
});




