import { useCallback, useEffect, useState } from "react";
import UploadCard from "../components/ui/UploadCard.jsx";
import { FadeInWhenVisible } from "../components/ui/ParallaxSection.jsx";
import { AppError, uploadResumeFile } from "../services/supabase.js";
import { CheckCircle } from "lucide-react";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx"]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const RESUME_BUCKET = "resumes";
const ERROR_MESSAGES = {
  "file/unsupported-type": {
    type: "warning",
    title: "Unsupported file",
  },
  "file/too-large": {
    type: "warning",
    title: "File too large",
  },
  "file/read-failed": {
    type: "danger",
    title: "Paste failed",
  },
  "auth/unauthenticated": {
    type: "warning",
    title: "Sign in to upload",
  },
  "auth/user-fetch-failed": {
    type: "danger",
    title: "Session check failed",
  },
  "upload/storage-failure": {
    type: "danger",
    title: "Upload failed",
  },
  "upload/bucket-missing": {
    type: "danger",
    title: "Storage not configured",
  },
  "upload/invalid-request": {
    type: "danger",
    title: "Upload blocked",
  },
  "auth/unauthorized": {
    type: "danger",
    title: "Upload not allowed",
  },
  "upload/name-conflict": {
    type: "warning",
    title: "File already stored",
  },
  "upload/duplicate": {
    type: "warning",
    title: "Already uploaded",
  },
};

const getExtension = (fileName) => {
  if (typeof fileName !== "string") {
    return "";
  }
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};
const isDocumentFile = (file) => {
  if (!file) return false;
  const normalizedType = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (DOCUMENT_MIME_TYPES.has(normalizedType)) {
    return true;
  }
  const extension = getExtension(file.name);
  return DOCUMENT_EXTENSIONS.has(extension);
};

export default function ResumeUpload({ onParseResume, resumeDocument, onToast, onClear }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const showErrorToast = useCallback(
    (appError, fallbackType = "danger") => {
      if (!appError) return;
      const copy = ERROR_MESSAGES[appError.code] || {
        type: fallbackType,
        title: "Something went wrong",
      };
      setError(appError.message);
      onToast?.({
        type: copy.type,
        title: copy.title,
        description: appError.hint ? `${appError.message} ${appError.hint}` : appError.message,
      });
    },
    [onToast]
  );

  useEffect(() => {
    if (!resumeDocument?.plainText) {
      return;
    }
    if (file) {
      return;
    }
  }, [file, resumeDocument]);

  const resetState = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError("");
  }, []);

  const handleValidationError = useCallback(
    (validationError) => {
      const appError =
        validationError instanceof AppError
          ? validationError
          : new AppError(validationError);
      showErrorToast(appError, "warning");
    },
    [showErrorToast]
  );

  const [lastUploadedFile, setLastUploadedFile] = useState(null);

  const handleFileSelect = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;

      // Duplicate check
      if (
        lastUploadedFile &&
        selectedFile.name === lastUploadedFile.name &&
        selectedFile.size === lastUploadedFile.size &&
        selectedFile.lastModified === lastUploadedFile.lastModified
      ) {
        handleValidationError(
          new AppError({
            code: "upload/duplicate",
            message: "You just uploaded this file.",
            hint: "Upload a different file or wait a moment.",
          })
        );
        return;
      }

      if (!isDocumentFile(selectedFile)) {
        handleValidationError(
          new AppError({
            code: "file/unsupported-type",
            message: "Only PDF or DOCX files are supported.",
            hint: "Upload a PDF or DOCX resume.",
          })
        );
        return;
      }
      const size = typeof selectedFile.size === "number" ? selectedFile.size : 0;
      if (size > MAX_BYTES) {
        handleValidationError(
          new AppError({
            code: "file/too-large",
            message: "File must be 5MB or smaller.",
            hint: "Compress the resume and try again.",
          })
        );
        return;
      }
      setError("");
      setFile(selectedFile);
    },
    [handleValidationError, lastUploadedFile]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) {
      const message = "Please upload a resume file.";
      setError(message);
      onToast?.({
        type: "warning",
        title: "Resume missing",
        description: message,
      });
      return;
    }

    try {
      setError("");
      setProgress(0);

      let storageMetadata = null;

      setStatus("uploading");
      onToast?.({
        type: "info",
        title: "Uploading resume",
        description: "Sending your resume to secure storage…",
      });
      const uploadResult = await uploadResumeFile(file, {
        onProgress: ({ loaded, total }) => {
          if (!total) return;
          const percent = Math.round((loaded / total) * 60);
          setProgress(Math.max(5, percent));
        },
      });

      setProgress((prev) => Math.max(prev, 70));
      if (uploadResult) {
        storageMetadata = {
          bucket: uploadResult.bucket || RESUME_BUCKET,
          path: uploadResult.path,
          fileName: uploadResult.fileName,
          userId: uploadResult.userId,
        };
      }
      onToast?.({
        type: "success",
        title: "Upload complete",
        description: storageMetadata
          ? `Saved as ${storageMetadata.fileName}. Parsing next…`
          : "Resume stored securely. Parsing next…",
      });

      setStatus("parsing");
      setProgress((prev) => Math.max(prev, 80));
      const payload = {
        kind: "upload",
        file,
        storage: storageMetadata,
      };
      await onParseResume?.(payload);
      setProgress(100);
      setStatus("success");

      // Toast removed to prevent duplicate notifications (handled by MainContent)

      setLastUploadedFile({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified
      });

      setTimeout(() => {
        setStatus("idle");
        setProgress(0);
      }, 900);
    } catch (submissionError) {
      setStatus("error");
      const appError =
        submissionError instanceof AppError
          ? submissionError
          : new AppError({
            code: "upload/storage-failure",
            message: submissionError?.message || "We could not prepare your resume.",
            hint: "Try again shortly.",
          });
      showErrorToast(appError);
    }
  }, [file, onParseResume, onToast, showErrorToast]);

  return (
    <FadeInWhenVisible>
      <div className="space-y-6">
        <UploadCard
          fileName={file?.name || ""}
          onFileSelect={handleFileSelect}
          onFileClear={() => {
            resetState();
          }}
          onSubmit={handleSubmit}
          status={status}
          progress={progress}
          error={error}
          disabled={status === "uploading" || status === "parsing"}
          onValidationError={handleValidationError}
          onClear={onClear}
        />
        {lastUploadedFile && status === "idle" && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-4 py-3 text-sm font-medium text-emerald-300">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            <span>Resume saved! No need to upload again unless you have a new version.</span>
          </div>
        )}
      </div>
    </FadeInWhenVisible>
  );
}
