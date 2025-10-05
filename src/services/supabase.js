// src/services/supabase.js
import { createClient } from "@supabase/supabase-js";

const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey } =
  import.meta.env ?? {};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class AppError extends Error {
  constructor({ code, message, hint }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.hint = hint;
  }
}

export const cleanBaseName = (fileName) => {
  if (!fileName) {
    return "resume.pdf";
  }
  const trimmed = fileName.trim();
  const extensionMatch = trimmed.match(/\.([^.\s]{1,10})$/i);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  const base = trimmed.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safeBase = slug || "resume";
  return `${safeBase}${extension || ".pdf"}`;
};

const buildVersionedName = (baseName, attempt) => {
  if (attempt === 0) return baseName;
  const version = attempt + 1;
  const extensionIndex = baseName.lastIndexOf(".");
  if (extensionIndex === -1) {
    return `${baseName}-v${version}`;
  }
  const namePart = baseName.slice(0, extensionIndex);
  const extension = baseName.slice(extensionIndex);
  return `${namePart}-v${version}${extension}`;
};

const RESUME_BUCKET = "resumes";

const buildStorageObjectKey = (userId, fileName) => {
  const trimmedUserId = typeof userId === "string" ? userId.trim() : "";
  if (!trimmedUserId) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Missing user id for storage upload.",
      hint: "Refresh and sign in again.",
    });
  }

  return `${trimmedUserId}/${fileName}`;
};

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Map([
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const getExtension = (fileName) => {
  if (typeof fileName !== "string") {
    return "";
  }
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

const resolveContentType = (file) => {
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  if (DOCUMENT_MIME_TYPES.has(type)) {
    return type;
  }
  const extension = getExtension(file?.name);
  return DOCUMENT_EXTENSIONS.get(extension) ?? "application/octet-stream";
};

const ensureSupportedDocument = (file) => {
  if (!file || typeof file.name !== "string") {
    throw new AppError({
      code: "file/unsupported-type",
      message: "Only PDF or DOCX files are supported.",
      hint: "Upload a PDF or DOCX resume.",
    });
  }

  const extension = getExtension(file.name);
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (!DOCUMENT_MIME_TYPES.has(type) && !DOCUMENT_EXTENSIONS.has(extension)) {
    throw new AppError({
      code: "file/unsupported-type",
      message: "Only PDF or DOCX files are supported.",
      hint: "Upload a PDF or DOCX resume.",
    });
  }

  const size = Number.isFinite(file.size) ? file.size : 0;
  if (size > MAX_UPLOAD_BYTES) {
    throw new AppError({
      code: "file/too-large",
      message: "File must be 5MB or smaller.",
      hint: "Compress the resume and try again.",
    });
  }
};

export const uploadResumeFile = async (file, { onProgress } = {}) => {
  ensureSupportedDocument(file);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new AppError({
      code: "auth/user-fetch-failed",
      message: "We couldn't verify your session.",
      hint: "Refresh and sign in again.",
    });
  }

  if (!user) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Sign in to upload.",
      hint: "Log in to store your resume securely.",
    });
  }

  const baseName = cleanBaseName(file?.name || "");
  const bucket = supabase.storage.from(RESUME_BUCKET);
  const maxAttempts = 5;
  const contentType = resolveContentType(file);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateName = buildVersionedName(baseName, attempt);
    const path = buildStorageObjectKey(user.id, candidateName);

    const { error } = await bucket.upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType,
      onUploadProgress: (progressEvent) => {
        if (typeof onProgress === "function") {
          onProgress(progressEvent);
        }
      },
    });

    if (!error) {
      return { path, fileName: candidateName, userId: user.id, bucket: RESUME_BUCKET };
    }

    const status = error?.statusCode ?? error?.status;
    if (status === 409) {
      continue;
    }

    const message = typeof error?.message === "string" ? error.message : "";
    const normalized = message.toLowerCase();

    if (status === 400) {
      if (normalized.includes("bucket") && normalized.includes("not")) {
        throw new AppError({
          code: "upload/bucket-missing",
          message: "Resume storage bucket is missing or misconfigured.",
          hint: "Create a 'resumes' bucket in Supabase Storage and allow authenticated uploads.",
        });
      }

      if (normalized.includes("invalid") || normalized.includes("payload")) {
        throw new AppError({
          code: "upload/invalid-request",
          message: "Supabase rejected the upload request.",
          hint: message || "Review your Supabase storage rules and request payload.",
        });
      }
    }

    if (status === 403) {
      throw new AppError({
        code: "auth/unauthorized",
        message: "You're not allowed to upload to this storage bucket.",
        hint: "Ask the workspace owner to update Supabase storage policies for authenticated users.",
      });
    }

    throw new AppError({
      code: "upload/storage-failure",
      message: "We couldn't store your resume.",
      hint: message || "Please try again.",
    });
  }

  throw new AppError({
    code: "upload/name-conflict",
    message: "We couldn't store your resume.",
    hint: "Rename the file and try again.",
  });
};
