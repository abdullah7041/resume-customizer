import { act, fireEvent, render, screen } from "@testing-library/react";
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
import { uploadResumeFile } from "../services/supabase.js";

describe("ResumeUpload", () => {
  beforeEach(() => {
    uploadResumeFile.mockReset();
  });

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

  it("uploads PDFs and shows a success toast", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({});
    uploadResumeFile.mockResolvedValueOnce({
      path: "user-123/resume.pdf",
      fileName: "resume.pdf",
      userId: "user-123",
      bucket: "resumes",
    });

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} />);

    const fileInput = screen
      .getAllByLabelText(/upload resume file/i)
      .find((element) => element.tagName === "INPUT");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Hidden file input not found");
    }
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const submitButton = screen.getByRole("button", { name: /prepare resume/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(uploadResumeFile).toHaveBeenCalledWith(file, expect.any(Object));
    expect(onParseResume).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "upload",
        file,
        storage: expect.objectContaining({
          bucket: "resumes",
          path: "user-123/resume.pdf",
          fileName: "resume.pdf",
        }),
      })
    );
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: expect.stringMatching(/file uploaded/i),
      })
    );
  });

  it("passes pasted text to onParseResume with context", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({ plainText: "Resume text" });

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} />);

    const textarea = screen.getByPlaceholderText(/paste resume text/i);
    fireEvent.change(textarea, { target: { value: "  My resume text  " } });

    const submitButton = screen.getByRole("button", { name: /prepare resume/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onParseResume).toHaveBeenCalledWith({ kind: "text", value: "My resume text" });
    expect(textarea).toHaveValue("Resume text");
  });

  it("rejects files over 5MB with a warning toast", async () => {
    const onToast = vi.fn();
    render(<ResumeUpload onParseResume={vi.fn()} onToast={onToast} />);

    const fileInput = screen
      .getAllByLabelText(/upload resume file/i)
      .find((element) => element.tagName === "INPUT");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Hidden file input not found");
    }
    const file = new File(["a"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 + 1, configurable: true });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(uploadResumeFile).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: expect.stringMatching(/file too large/i),
      })
    );
    expect(screen.getByText(/file must be 5mb or smaller\./i)).toBeInTheDocument();
  });
});
