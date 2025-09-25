import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadSpy, authMock, storageMock } = vi.hoisted(() => {
  const uploadFn = vi.fn();
  const auth = { getUser: vi.fn() };
  const storage = { from: vi.fn(() => ({ upload: uploadFn })) };
  return { uploadSpy: uploadFn, authMock: auth, storageMock: storage };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: authMock,
    storage: storageMock,
  })),
}));

import { cleanBaseName, uploadResumeFile } from "../services/supabase.js";

describe("supabase upload service", () => {
  beforeEach(() => {
    uploadSpy.mockReset();
    authMock.getUser.mockReset();
    storageMock.from.mockClear();
  });

  it("sanitizes file names while preserving extensions", () => {
    expect(cleanBaseName(" Senior Resume .PDF ")).toBe("senior-resume.pdf");
    expect(cleanBaseName("résumé final.docx")).toBe("r-sum-final.docx");
    expect(cleanBaseName("resume")).toBe("resume.pdf");
  });

  it("appends version suffix when storage reports a conflict", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy
      .mockImplementationOnce(async () => ({ error: { statusCode: 409 } }))
      .mockImplementationOnce(async (_path, _file, options) => {
        options?.onUploadProgress?.({ loaded: 5, total: 10 });
        return { error: null };
      });

    const progressSpy = vi.fn();
    const result = await uploadResumeFile({ name: "Resume.PDF" }, { onProgress: progressSpy });

    expect(storageMock.from).toHaveBeenCalledWith("resumes");
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(uploadSpy.mock.calls[0][0]).toBe("user-123/resume.pdf");
    expect(uploadSpy.mock.calls[1][0]).toBe("user-123/resume-v2.pdf");
    expect(result).toEqual({ path: "user-123/resume-v2.pdf", fileName: "resume-v2.pdf", userId: "user-123" });
    expect(progressSpy).toHaveBeenCalledWith({ loaded: 5, total: 10 });
  });

  it("throws an AppError when the user is not authenticated", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "auth/unauthenticated",
    });
  });

  it("wraps storage failures in an AppError", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({ error: { statusCode: 500 } });

    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "upload/storage-failure",
    });
  });
});
