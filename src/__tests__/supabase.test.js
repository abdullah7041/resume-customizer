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
    expect(uploadSpy.mock.calls[0][2]).toMatchObject({ contentType: "application/pdf" });
    expect(result).toEqual({
      path: "user-123/resume-v2.pdf",
      fileName: "resume-v2.pdf",
      userId: "user-123",
      bucket: "resumes",
    });
    expect(progressSpy).toHaveBeenCalledWith({ loaded: 5, total: 10 });
  });

  it("uploads successfully when storage accepts the first attempt", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-456" } }, error: null });
    uploadSpy.mockResolvedValueOnce({ error: null });

    const file = { name: "resume.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 };
    const result = await uploadResumeFile(file);

    expect(uploadSpy).toHaveBeenCalledWith(
      "user-456/resume.docx",
      file,
      expect.objectContaining({ contentType: file.type, upsert: false })
    );
    expect(result).toEqual({
      path: "user-456/resume.docx",
      fileName: "resume.docx",
      userId: "user-456",
      bucket: "resumes",
    });
  });

  it("uses the file content type when provided", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({ error: null });

    const file = { name: "resume.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    await uploadResumeFile(file);

    expect(uploadSpy).toHaveBeenCalledWith(
      "user-123/resume.docx",
      file,
      expect.objectContaining({ contentType: file.type })
    );
  });

  it("throws an AppError when the user is not authenticated", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "auth/unauthenticated",
    });
  });

  it("rejects files larger than 5MB", async () => {
    const largeSize = 5 * 1024 * 1024 + 1;
    const file = { name: "resume.pdf", type: "application/pdf", size: largeSize };

    await expect(uploadResumeFile(file)).rejects.toMatchObject({
      code: "file/too-large",
    });
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("wraps storage failures in an AppError", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({ error: { statusCode: 500 } });

    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "upload/storage-failure",
    });
  });

  it("maps bucket configuration errors to a dedicated AppError", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({ error: { statusCode: 400, message: "Bucket not found" } });

    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "upload/bucket-missing",
    });
  });

  it("surfaces invalid payload responses", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({
      error: { statusCode: 400, message: "Invalid request payload" },
    });

    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "upload/invalid-request",
      hint: expect.stringMatching(/invalid request payload/i),
    });
  });

  it("maps storage policy denials to auth errors", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    uploadSpy.mockResolvedValueOnce({
      error: { statusCode: 403, message: "Storage policy denied" },
    });

    await expect(uploadResumeFile({ name: "resume.pdf" })).rejects.toMatchObject({
      code: "auth/unauthorized",
    });
  });

  it("throws when the authenticated user id is missing", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: { id: "   " } }, error: null });

    await expect(uploadResumeFile({ name: "resume.pdf", type: "application/pdf" })).rejects.toMatchObject({
      code: "auth/unauthenticated",
      message: expect.stringMatching(/missing user id/i),
    });
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
