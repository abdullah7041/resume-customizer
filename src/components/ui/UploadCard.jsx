import { useRef, useState } from "react";
import { FileText, Shield, UploadCloud, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppError } from "../../services/supabase.js";
import { cn } from "../../lib/cn";
import Button from "./Button.jsx";
import Card from "./Card.jsx";


const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx"]);

const TEXT_MIME_TYPES = new Set(["text/plain"]);
const TEXT_EXTENSIONS = new Set(["txt"]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const getExtension = (fileName) => {
  if (typeof fileName !== "string") return "";
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

const isDocumentFile = (file) => {
  if (!file) return false;
  const normalizedType = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (normalizedType) {
    return DOCUMENT_MIME_TYPES.has(normalizedType);
  }
  const extension = getExtension(file.name);
  return DOCUMENT_EXTENSIONS.has(extension);
};

const isPlainTextFile = (file) => {
  if (!file) return false;
  const normalizedType = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (normalizedType) {
    return TEXT_MIME_TYPES.has(normalizedType);
  }
  if (normalizedType === "") {
    const extension = getExtension(file.name);
    return TEXT_EXTENSIONS.has(extension);
  }
  return false;
};

// Sanitize text input to preserve UTF-8 and remove only truly problematic characters
const sanitizeTextInput = (text) => {
  if (typeof text !== "string") return "";

  // Only remove NULL bytes and other control characters that break parsing
  // Preserve all valid UTF-8 characters including international text
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/\x00/g, ""); // Remove NULL bytes
  // Remove control chars except \n, \r, \t
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // Normalize line endings to \n
  sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return sanitized;
};


const chipClass =
  "inline-flex items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_22%)] text-emerald-400 shadow-soft backdrop-blur-soft";


export default function UploadCard({
  fileName,
  onFileSelect,
  onFileClear,
  onSubmit,
  status = "idle",
  progress = 0,
  error,
  disabled = false,
  onValidationError,
  onTextChange,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const statusCopy = {
    uploading: t("upload.card.status.uploading"),
    parsing: t("upload.card.status.parsing"),
    success: t("upload.card.status.success"),
    error: t("upload.card.status.error"),
  };

  const handleFile = async (file) => {
    if (!file) return;

    const size = typeof file.size === "number" ? file.size : 0;
    const documentFile = isDocumentFile(file);
    const plainTextFile = isPlainTextFile(file);

    if (!documentFile && !plainTextFile) {
      onValidationError?.(
        new AppError({
          code: "file/unsupported-type",
          message: "Only PDF, DOCX, or TXT resumes are supported.",
          hint: "Upload a PDF or DOCX, or paste plain text.",
        })
      );
      return;
    }

    if (size > MAX_SIZE_BYTES) {
      onValidationError?.(
        new AppError({
          code: "file/too-large",
          message: "File must be 5MB or smaller.",
          hint: "Compress the resume and try again.",
        })
      );
      return;
    }

    if (plainTextFile) {
      try {
        const text = await file.text();
        onTextChange?.(sanitizeTextInput(text));
      } catch {
        onValidationError?.(
          new AppError({
            code: "file/read-failed",
            message: "We couldn't read that text file.",
            hint: "Paste the contents manually instead.",
          })
        );
      }
      return;
    }

    onFileSelect?.(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const stateMessage = statusCopy[status];
  const showProgress = status === "uploading" || status === "parsing";

  return (
    <Card
      as="section"
      tone="glass"
      glow
      className="mx-auto w-full max-w-full sm:max-w-5xl px-2 sm:px-0 space-y-5 sm:space-y-6 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-500"
      contentClassName="space-y-5 sm:space-y-6"
      aria-live="polite"
    >
      <header className="space-y-2 text-center sm:text-left px-2 sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.32em] text-gold-500">{t("upload.card.step")}</p>

        </div>
        <h3 className="text-xl sm:text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-tight">{t("upload.card.title")}</h3>
        <p className="text-xs sm:text-sm text-emerald-100/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] leading-relaxed">
          {t("upload.card.subtitle")}
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
        title="Upload resume file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-3 sm:gap-4 overflow-hidden rounded-xl border-2 border-dashed border-white/20 px-4 sm:px-6 py-8 sm:py-12 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 cursor-pointer",
          "hover:border-emerald-400/40 hover:bg-white/[0.02]",
          isDragging &&
          "border-emerald-400/50 bg-emerald-500/5 scale-[1.01]"
        )}
      >
        <span className={cn("absolute right-2 sm:right-6 top-2 sm:top-6 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em]", chipClass)}>
          {t("upload.card.maxSize")}
        </span>
        <div className="flex items-center gap-2 rounded-pill border border-[color:color-mix(in_oklab,var(--glass-border),transparent_30%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_18%)] px-4 py-2 text-xs font-semibold text-emerald-100 shadow-soft backdrop-blur-xl">
          <FileText className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>{t("upload.card.pdf")}</span>
          <span className="text-emerald-200/70">{t("upload.card.and")}</span>
          <span>{t("upload.card.docx")}</span>
        </div>
        <span className="relative inline-flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 blur-2xl sm:blur-3xl" aria-hidden="true" />
          <span className="relative inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 shadow-[0_12px_40px_-12px_rgba(16,185,129,0.35)] backdrop-blur-2xl transition-all duration-300 hover:border-emerald-400/40 hover:from-emerald-500/20 hover:to-emerald-600/10 hover:shadow-[0_16px_48px_-8px_rgba(16,185,129,0.45)] hover:scale-105">
            <UploadCloud className="h-7 w-7 sm:h-9 sm:w-9 text-emerald-300/90 drop-shadow-[0_4px_12px_rgba(16,185,129,0.5)] transition-all duration-300 group-hover:scale-110 group-hover:text-emerald-300 group-hover:drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" aria-hidden="true" />
          </span>
        </span>
        <p className="text-sm sm:text-base font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] px-2">
          {t("upload.card.dropText")}
        </p>
        <p className="text-xs sm:text-sm text-emerald-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] px-2">
          <span className="inline-flex items-center gap-1.5"><Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-300" /> {t("upload.card.securityText")}</span>
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="sr-only"
        name="resume-file"
        aria-label="Upload resume file"
        title="Upload resume file"
        onChange={handleFileChange}
      />

      {fileName && (
        <div className="flex items-center justify-between rounded-lg border border-[color:color-mix(in_oklab,var(--glass-border),transparent_32%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_16%)] px-4 py-3 text-sm text-ink shadow-soft backdrop-blur-xl">
          <span className="truncate font-medium">{fileName}</span>
          <button
            type="button"
            onClick={onFileClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)] text-emerald-400 transition-all duration-snappy ease-snappy hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
            aria-label="Remove selected file"
            title="Remove selected file"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}





      {showProgress && (
        <div className="space-y-2" aria-live="assertive">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_50%)]">
            <div
              className="h-full w-full origin-left bg-[image:var(--gradient-primary-value)] transition-all duration-breathe ease-snappy"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-glass-reflect bg-[image:var(--glass-reflection)] opacity-40"
            />
          </div>
          {stateMessage && (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-500">
              {stateMessage}
            </p>
          )}
        </div>
      )}

      {!showProgress && stateMessage && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
          {stateMessage}
        </p>
      )}

      {error && (
        <p className="text-sm font-medium text-[color:var(--color-danger-500)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
        <Button
          onClick={onSubmit}
          disabled={disabled}
          loading={status === "uploading" || status === "parsing"}
          className="w-full sm:w-auto"
        >
          {t("upload.card.prepareButton")}
        </Button>
        <Button
          variant="secondary"
          onClick={onFileClear}
          disabled={!fileName}
          icon={XCircle}
          className="w-full sm:w-auto"
        >
          {t("upload.card.clearButton")}
        </Button>
      </div>
    </Card>
  );
}
