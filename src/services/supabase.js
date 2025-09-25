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

export const uploadResumeFile = async (file, { onProgress } = {}) => {
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
  const bucket = supabase.storage.from("resumes");
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateName = buildVersionedName(baseName, attempt);
    const path = `${user.id}/${candidateName}`;

    const { error } = await bucket.upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (progressEvent) => {
        if (typeof onProgress === "function") {
          onProgress(progressEvent);
        }
      },
    });

    if (!error) {
      return { path, fileName: candidateName, userId: user.id };
    }

    const status = error?.statusCode ?? error?.status;
    if (status === 409) {
      continue;
    }

    throw new AppError({
      code: "upload/storage-failure",
      message: "We couldn't store your resume.",
      hint: "Please try again.",
    });
  }

  throw new AppError({
    code: "upload/name-conflict",
    message: "We couldn't store your resume.",
    hint: "Rename the file and try again.",
  });
};
