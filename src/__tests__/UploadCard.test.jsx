import { render, screen } from "@testing-library/react";
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
}));

import UploadCard from "../components/ui/UploadCard.jsx";

describe("UploadCard", () => {
  it("matches snapshot and exposes accessible controls", () => {
    render(
      <UploadCard
        fileName="resume.pdf"
        onFileSelect={() => {}}
        onFileClear={() => {}}
        onTextChange={() => {}}
        textValue=""
        onSubmit={() => {}}
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
