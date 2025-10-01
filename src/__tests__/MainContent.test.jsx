import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainContent from "../components/MainContent.jsx";

const {
  parseResumeMock,
  analyzeResumeMock,
  optimizeResumeMock,
} = vi.hoisted(() => ({
  parseResumeMock: vi.fn(),
  analyzeResumeMock: vi.fn(),
  optimizeResumeMock: vi.fn(),
}));

const resumeUploadMockProps = vi.hoisted(() => ({ current: null }));

vi.mock("../hooks/useAuth.jsx", () => ({
  useAuth: () => ({
    user: { id: "user-123", user_metadata: {}, app_metadata: {} },
    loading: false,
    signInWithGoogle: vi.fn(),
  }),
}));

vi.mock("../features/ResumeUpload.jsx", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => {
      resumeUploadMockProps.current = props;
      return React.createElement("div", { "data-testid": "resume-upload-mock" });
    },
  };
});

vi.mock("../components/Features/JobMatch.jsx", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement("div", { "data-testid": "job-match-mock" }),
  };
});

vi.mock("../features/Optimization.jsx", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement("div", { "data-testid": "optimization-mock" }),
  };
});

vi.mock("../components/ui/Tabs.jsx", () => {
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

vi.mock("../components/ui/Toast.jsx", () => {
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

vi.mock("../services/api.js", () => ({
  parseResume: parseResumeMock,
  analyzeResume: analyzeResumeMock,
  optimizeResume: optimizeResumeMock,
  AI_DEFAULT_TEMPERATURE: 0.32,
}));

describe("MainContent resume parsing", () => {
  beforeEach(() => {
    resumeUploadMockProps.current = null;
    parseResumeMock.mockReset();
    parseResumeMock.mockResolvedValue({
      plainText: "Parsed resume",
      bullets: [],
      sections: [],
    });
  });

  it("passes File inputs directly to parseResume", async () => {
    render(<MainContent />);

    expect(resumeUploadMockProps.current).toBeTruthy();
    const file = new File(["%PDF-1.7 data"], "resume.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await resumeUploadMockProps.current.onParseResume(file);
    });

    expect(parseResumeMock).toHaveBeenCalledTimes(1);
    expect(parseResumeMock).toHaveBeenCalledWith(file);
  });
});
