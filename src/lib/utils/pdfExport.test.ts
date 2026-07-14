import { describe, expect, it, vi } from "vitest";
import { exportToPdf } from "@/lib/utils/pdfExport";
import type { ResumeSchema } from "@/types/resume";

describe("exportToPdf", () => {
  it("escapes language labels exactly once in ATS HTML", async () => {
    const write = vi.fn();
    const printWindow = {
      document: { write, close: vi.fn() },
      print: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(printWindow as unknown as Window);

    const resume = {
      basics: { name: "Test Candidate" },
      work: [],
      education: [],
      skills: [],
      languages: [{ language: "R&D", fluency: "Read & write" }],
    } as ResumeSchema;

    await exportToPdf(resume, { format: "ats" });

    const html = write.mock.calls[0][0] as string;
    expect(html).toContain("R&amp;D (Read &amp; write)");
    expect(html).not.toContain("R&amp;amp;D");
    expect(html).not.toContain("Read &amp;amp; write");
  });
});
