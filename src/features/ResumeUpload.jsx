import { useCallback, useEffect, useState } from "react";
import UploadCard from "../components/ui/UploadCard.jsx";
import { AppError, uploadResumeFile } from "../services/supabase.js";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx"]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const PDF_HELPER_MESSAGE = "This looks like a PDF — use Upload.";
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
  "upload/name-conflict": {
    type: "danger",
    title: "Rename and retry",
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

export default function ResumeUpload({ onParseResume, resumeDocument, onToast }) {
  const [file, setFile] = useState(null);
  const [textValue, setTextValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [textWarning, setTextWarning] = useState("");

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
    if (resumeDocument?.plainText && !textValue) {
      setTextValue(resumeDocument.plainText);
      setTextWarning("");
    }
  }, [resumeDocument, textValue]);

  const resetState = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError("");
    setTextWarning("");
  }, []);

  const handleTextValueChange = useCallback(
    (value) => {
      const trimmedStart = typeof value === "string" ? value.trimStart() : "";
      if (trimmedStart.startsWith("%PDF")) {
        if (textWarning !== PDF_HELPER_MESSAGE) {
          setTextWarning(PDF_HELPER_MESSAGE);
          onToast?.({
            type: "warning",
            title: "Paste blocked",
            description: PDF_HELPER_MESSAGE,
          });
        }
        return;
      }
      if (textWarning) {
        setTextWarning("");
      }
      if (file) {
        setFile(null);
      }
      setTextValue(value);
    },
    [file, onToast, textWarning]
  );

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

  const handleFileSelect = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;
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
      setTextWarning("");
      setError("");
      setFile(selectedFile);
    },
    [handleValidationError]
  );

  const handleSubmit = useCallback(async () => {
    const trimmedText = textValue.trim();

    if (!file && !trimmedText) {
      const message = "Add a file or paste your resume text.";
      setError(message);
      onToast?.({
        type: "warning",
        title: "Resume missing",
        description: message,
      });
      return;
    }

    if (!file && trimmedText.startsWith("%PDF")) {
      setTextWarning(PDF_HELPER_MESSAGE);
      onToast?.({
        type: "warning",
        title: "Paste blocked",
        description: PDF_HELPER_MESSAGE,
      });
      return;
    }

    try {
      setError("");
      setProgress(0);

      let storageMetadata = null;

      if (file) {
        setStatus("uploading");
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
          title: "File uploaded",
          description: storageMetadata
            ? `Stored securely as ${storageMetadata.fileName}. Parsing next…`
            : "Resume stored securely. Parsing next…",
        });
      }

      setStatus("parsing");
      setProgress((prev) => Math.max(prev, 80));
      const payload = file
        ? {
            kind: "upload",
            file,
            storage: storageMetadata,
          }
        : {
            kind: "text",
            value: trimmedText,
          };
      const parsed = await onParseResume?.(payload);
      setProgress(100);
      setStatus("success");
      if (!file && parsed?.plainText) {
        setTextValue(parsed.plainText);
      }
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
  }, [file, onParseResume, onToast, showErrorToast, textValue]);

  return (
    <div className="space-y-6">
      <UploadCard
        fileName={file?.name || ""}
        onFileSelect={handleFileSelect}
        onFileClear={() => {
          resetState();
          setTextValue("");
        }}
        onTextChange={handleTextValueChange}
        textValue={textValue}
        onSubmit={handleSubmit}
        status={status}
        progress={progress}
        error={error}
        disabled={status === "uploading" || status === "parsing"}
        textHelper={textWarning}
        onValidationError={handleValidationError}
      />
    </div>
  );
}
