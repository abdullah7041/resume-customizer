import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const i18nMock = vi.hoisted(() => ({
  language: "en",
}));

// Mock i18n to return translation keys as-is for testing
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const baseTranslations = {
        "upload.title": "Upload or paste your resume",
        "upload.card.prepareButton": "Prepare Resume",
        "upload.card.clearButton": "Clear",
        "upload.card.step": "Step 1",
        "upload.card.title": "Upload your resume",
        "upload.card.subtitle": "Get started with your resume",
        "upload.card.maxSize": "Max 5MB",
        "upload.card.pdf": "PDF",
        "upload.card.and": "and",
        "upload.card.docx": "DOCX",
        "upload.card.txt": "TXT",
        "upload.card.dropText": "Drop your resume here",
        "upload.card.securityText": "Your data is secure",
        "upload.card.supportedFormats": "Supported formats: PDF, DOCX, TXT",
        "upload.card.bestPractice": "For best results, use selectable text. Scanned images are not supported.",
        "upload.card.selectFile": "Select File",
        "upload.card.uploadFileLabel": "Upload resume file",
        "upload.card.removeFileLabel": "Remove selected file",
        "upload.card.readyTitle": "Ready to prepare",
        "upload.card.savedTitle": "Resume ready and saved",
        "upload.card.processingButton": "Processing...",
        "upload.card.pasteLabel": "Or paste your resume text",
        "upload.card.pastePlaceholder": "Paste selectable resume text here...",
        "upload.card.pasteHelp": "Use either a file or pasted text. The latest input will be used.",
        "upload.card.prepareFileButton": "Prepare Selected File",
        "upload.card.preparePastedButton": "Prepare Pasted Text",
        "upload.errors.unsupportedType": "Only PDF, DOCX, or TXT resumes are supported.",
        "upload.errors.unsupportedTypeHint": "Upload a PDF or DOCX, or paste plain text.",
        "upload.errors.tooLarge": "File must be 5MB or smaller.",
        "upload.errors.tooLargeHint": "Compress the resume and try again.",
        "upload.errors.readFailed": "We couldn't read that text file.",
        "upload.errors.readFailedHint": "Paste the contents manually instead.",
        "trust.noInvention": "Watheq does not invent employers, degrees, certifications, or metrics.",
        "toasts.signInRequired": "Sign in required",
        "toasts.signInRequiredDesc": "Please sign in to securely process your resume.",
      };
      const translations = {
        ...baseTranslations,
        ...(i18nMock.language === "ar"
          ? {
            "toasts.signInRequired": "تسجيل الدخول مطلوب",
            "toasts.signInRequiredDesc": "سجّل دخولك لمعالجة سيرتك الذاتية بأمان.",
          }
          : {}),
      };
      return translations[key] || key;
    },
    i18n: { changeLanguage: () => { } },
  }),
}));

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

import ResumeUpload from "../components/sections/UploadSection";
import { uploadResumeFile } from "../services/supabase.js";

describe("ResumeUpload", () => {
  beforeEach(() => {
    uploadResumeFile.mockReset();
    i18nMock.language = "en";
  });

  const setViewportWidth = (width) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  };

  it("renders the Saudi-inspired upload card", () => {
    render(<ResumeUpload onParseResume={vi.fn()} onToast={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /upload your resume/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /prepare resume/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/drop your resume here/i)
    ).toBeInTheDocument();
    expect(screen.getByText("TXT")).toBeInTheDocument();
    expect(
      screen.getByText(/supported formats: pdf, docx, txt/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/paste your resume text/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/use either a file or pasted text\. the latest input will be used\./i)
    ).toBeInTheDocument();
  });

  it("uploads PDFs and shows a success toast", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({});

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} onClear={vi.fn()} />);

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

    const submitButton = screen.getByRole("button", { name: /prepare selected file/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // UploadSection passes { file } and AbortSignal to onParseResume
    expect(onParseResume).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
      }),
      expect.any(AbortSignal)
    );
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Resume parsed successfully" })
    );
  });

  it("guest can select a file and prepare it without a sign-in wall", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({});

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} onClear={vi.fn()} />);

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

    const submitButton = screen.getByRole("button", { name: /prepare selected file/i });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onParseResume).toHaveBeenCalledWith(
      expect.objectContaining({ file }),
      expect.any(AbortSignal)
    );
    expect(onToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sign in required" })
    );
    expect(screen.queryByRole("button", { name: /create or sign in with google/i })).not.toBeInTheDocument();
  });

  it("guest can paste text and prepare it without a sign-in wall", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({});

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} onClear={vi.fn()} />);

    const pasteInput = screen.getByLabelText(/paste your resume text/i);
    await act(async () => {
      fireEvent.change(pasteInput, { target: { value: "Experienced analyst" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /prepare pasted text/i }));
    });

    expect(onParseResume).toHaveBeenCalledWith(
      expect.objectContaining({ plainText: "Experienced analyst" }),
      expect.any(AbortSignal)
    );
    expect(onToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sign in required" })
    );
  });

  it("shows auth-required UX instead of parse-failed copy for auth errors", async () => {
    const onToast = vi.fn();
    const authError = new Error("Please sign in to securely process your resume.");
    authError.status = 401;
    authError.type = "AUTH_REQUIRED";
    const onParseResume = vi.fn().mockRejectedValue(authError);

    render(
      <ResumeUpload
        onParseResume={onParseResume}
        onToast={onToast}
        onClear={vi.fn()}
      />
    );

    const pasteInput = screen.getByLabelText(/paste your resume text/i);
    await act(async () => {
      fireEvent.change(pasteInput, { target: { value: "Experienced analyst" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /prepare pasted text/i }));
    });

    expect(onParseResume).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Sign in required",
      description: "Please sign in to securely process your resume.",
    });
    expect(onToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Parse failed" })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please sign in to securely process your resume.");
  });

  it("uses localized Arabic copy for auth-required parse errors", async () => {
    i18nMock.language = "ar";
    const onToast = vi.fn();
    const authError = new Error("Please sign in to securely process your resume.");
    authError.status = 401;
    authError.type = "AUTH_REQUIRED";
    const onParseResume = vi.fn().mockRejectedValue(authError);

    render(
      <ResumeUpload
        onParseResume={onParseResume}
        onToast={onToast}
        onClear={vi.fn()}
      />
    );

    const pasteInput = screen.getByLabelText(/paste your resume text/i);
    await act(async () => {
      fireEvent.change(pasteInput, { target: { value: "Experienced analyst" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /prepare pasted text/i }));
    });

    expect(onToast).toHaveBeenCalledWith({
      type: "warning",
      title: "تسجيل الدخول مطلوب",
      description: "سجّل دخولك لمعالجة سيرتك الذاتية بأمان.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("سجّل دخولك لمعالجة سيرتك الذاتية بأمان.");
    expect(screen.queryByText("Please sign in to securely process your resume.")).not.toBeInTheDocument();
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
        title: "File must be 5MB or smaller.",
      })
    );
  });

  it("parses pasted resume text", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn().mockResolvedValue({ plainText: "Experienced analyst" });

    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} onClear={vi.fn()} />);

    const pasteInput = screen.getByLabelText(/paste your resume text/i);
    await act(async () => {
      fireEvent.change(pasteInput, { target: { value: "Experienced analyst" } });
    });

    const submitButton = screen.getByRole("button", { name: /prepare pasted text/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onParseResume).toHaveBeenCalledWith(
      expect.objectContaining({
        plainText: "Experienced analyst",
      }),
      expect.any(AbortSignal)
    );
  });

  it("does not show a mobile scan button for image-only resumes", () => {
    render(<ResumeUpload onParseResume={vi.fn()} onToast={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /scan resume/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the mobile file picker limited to supported text document types", () => {
    render(<ResumeUpload onParseResume={vi.fn()} onToast={vi.fn()} />);

    const fileInput = screen
      .getAllByLabelText(/upload resume file/i)
      .find((element) => element.tagName === "INPUT");

    expect(fileInput).toHaveAttribute("accept", ".pdf,.docx,.txt");
    expect(fileInput).not.toHaveAttribute("capture");
  });

  it.each([360, 390, 768])("keeps upload controls mobile-safe at %ipx", (width) => {
    setViewportWidth(width);
    render(<ResumeUpload onParseResume={vi.fn()} onToast={vi.fn()} />);

    const dropzone = screen.getByRole("button", { name: /upload resume file/i });
    expect(dropzone).toBeInTheDocument();

    const prepareButton = screen.getByRole("button", { name: /prepare resume/i });
    const actionBar = prepareButton.closest("div");
    expect(actionBar).toHaveClass("flex-col-reverse", "sm:flex-row");
    expect(prepareButton).toHaveClass("w-full", "sm:w-auto", "min-h-[48px]");

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toHaveClass("w-full", "sm:w-auto", "min-h-[48px]");
  });

  it("rejects image uploads instead of sending them to parsing", async () => {
    const onToast = vi.fn();
    const onParseResume = vi.fn();
    render(<ResumeUpload onParseResume={onParseResume} onToast={onToast} />);

    const fileInput = screen
      .getAllByLabelText(/upload resume file/i)
      .find((element) => element.tagName === "INPUT");
    if (!(fileInput instanceof HTMLInputElement)) {
      throw new Error("Hidden file input not found");
    }

    const file = new File(["image"], "resume.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(onParseResume).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Only PDF, DOCX, or TXT resumes are supported.",
      })
    );
  });
});




