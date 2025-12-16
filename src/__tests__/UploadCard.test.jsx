import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

// Mock i18n to return translation keys as-is for testing
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        "upload.card.prepareButton": "Prepare Resume",
        "upload.card.clearButton": "Clear",
        "upload.card.step": "Step 1",
        "upload.card.title": "Upload your resume",
        "upload.card.subtitle": "Get started with your resume",
        "upload.card.maxSize": "Max 5MB",
        "upload.card.pdf": "PDF",
        "upload.card.and": "and",
        "upload.card.docx": "DOCX",
        "upload.card.dropText": "Drop your file here",
        "upload.card.securityText": "Your data is secure",
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
}));

import UploadCard from "../components/ui/UploadCard.jsx";

describe("UploadCard", () => {
  it("matches snapshot and exposes accessible controls", () => {
    render(
      <UploadCard
        fileName="resume.pdf"
        onFileSelect={() => { }}
        onFileClear={() => { }}
        onSubmit={() => { }}
        status="idle"
        progress={0}
        error=""
        disabled={false}
      />
    );

    const dropzone = screen.getByRole("button", { name: /upload resume file/i });
    expect(dropzone).toBeInTheDocument();
    expect(dropzone).toHaveAttribute("title", "Upload resume file");

    const removeButton = screen.getByRole("button", { name: /remove selected file/i });
    expect(removeButton).toHaveAttribute("title", "Remove selected file");

    expect(
      screen.getByRole('button', { name: /prepare resume/i })
    ).toBeEnabled();
  });
});



