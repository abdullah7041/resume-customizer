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

  return `${trimmedUserId}/resumes/${fileName}`;
};

const DOCUMENT_TYPES = [
  { extension: "pdf", mime: "application/pdf" },
  {
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
];

const DOCUMENT_MIME_TYPES = new Set(DOCUMENT_TYPES.map(({ mime }) => mime));
const DOCUMENT_EXTENSION_TO_MIME = new Map(
  DOCUMENT_TYPES.map(({ extension, mime }) => [extension, mime])
);
const DOCUMENT_MIME_TO_EXTENSION = new Map(
  DOCUMENT_TYPES.map(({ extension, mime }) => [mime, extension])
);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const getExtension = (fileName) => {
  if (typeof fileName !== "string") {
    return "";
  }
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

const FALLBACK_BINARY_MIME = new Set(["application/octet-stream", "binary/octet-stream"]);

const normalizeMime = (file) => {
  const rawType = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  if (rawType && DOCUMENT_MIME_TYPES.has(rawType)) {
    return rawType;
  }
  if (rawType && !FALLBACK_BINARY_MIME.has(rawType)) {
    return "";
  }
  const extension = getExtension(file?.name);
  return DOCUMENT_EXTENSION_TO_MIME.get(extension) ?? "";
};

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatUtcTimestamp = (date) => {
  const pad = (input) => String(input).padStart(2, "0");
  return [
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`,
  ].join("-");
};

const ensureSupportedDocument = (file) => {
  if (!file || typeof file.name !== "string") {
    throw new AppError({
      code: "file/unsupported-type",
      message: "Only PDF or DOCX files are supported.",
      hint: "Upload a PDF or DOCX resume.",
    });
  }

  const mime = normalizeMime(file);

  if (!mime || !DOCUMENT_MIME_TYPES.has(mime)) {
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
  const extension = DOCUMENT_MIME_TO_EXTENSION.get(mime) ?? "pdf";

  const baseName = typeof file.name === "string" ? file.name : "resume";
  const withoutExtension = baseName.replace(/\.[^.]+$/, "");
  const slugBase = slugify(withoutExtension) || "resume";
  const timestamp = formatUtcTimestamp(new Date());

  return {
    mime,
    extension,
    baseKey: `${timestamp}-${slugBase}`,
  };
};

export const uploadResumeFile = async (file, { onProgress } = {}) => {
  const { mime, extension, baseKey } = ensureSupportedDocument(file);

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

  const bucket = supabase.storage.from(RESUME_BUCKET);
  const maxAttempts = 3;
  let lastConflictError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-v${attempt + 1}`;
    const candidateName = `${baseKey}${suffix}.${extension}`;
    const path = buildStorageObjectKey(user.id, candidateName);

    const { error } = await bucket.upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime,
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
      lastConflictError = error;
      continue;
    }

    const message = typeof error?.message === "string" ? error.message : "";
    const normalized = message.toLowerCase();

    if (normalized.includes("resource exists") || normalized.includes("already exists")) {
      lastConflictError = error;
      continue;
    }

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
    message: "We couldn't store your resume after multiple attempts.",
    hint:
      lastConflictError?.message ||
      "Rename the file and try again, or delete older copies from storage.",
  });
};
