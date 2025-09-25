import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const { MockAppError } = vi.hoisted(() => ({
  MockAppError: class extends Error {
    constructor({ code, message, hint }) {
      super(message);
      this.code = code;
      this.hint = hint;
    }
  },
}));

vi.mock("../services/supabase.js", () => ({
  AppError: MockAppError,
  uploadResumeFile: vi.fn(),
}));

import ResumeUpload from "../features/ResumeUpload.jsx";

describe("ResumeUpload", () => {
  it("renders the Saudi-inspired upload card", () => {
    render(<ResumeUpload onParseResume={vi.fn()} onToast={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /upload or paste your resume/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /prepare resume/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/drop your resume here/i)
    ).toBeInTheDocument();
  });

  it("prevents pasting PDF headers into the textarea", async () => {
    const onToast = vi.fn();
    render(<ResumeUpload onParseResume={vi.fn()} onToast={onToast} />);

    const textarea = screen.getByPlaceholderText(/paste resume text/i);
    fireEvent.change(textarea, { target: { value: "%PDF-1.5" } });

    expect(textarea).toHaveValue("");
    expect(screen.getByText(/this looks like a pdf — use upload\./i)).toBeInTheDocument();
    expect(onToast).toHaveBeenCalled();
  });
});
