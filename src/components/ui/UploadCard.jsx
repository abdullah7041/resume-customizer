import { useRef, useState } from "react";
import { ClipboardPenLine, FileText, UploadCloud, XCircle } from "lucide-react";
import { AppError } from "../../services/supabase.js";
import { cn } from "../../lib/cn";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

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

const statusCopy = {
  uploading: "Uploading resume…",
  parsing: "Parsing resume with AI…",
  success: "Resume ready!",
  error: "We couldn't process that file.",
};

export default function UploadCard({
  fileName,
  onFileSelect,
  onFileClear,
  onTextChange,
  textValue,
  onSubmit,
  status = "idle",
  progress = 0,
  error,
  disabled = false,
  textHelper = "",
  onValidationError,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

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
        onTextChange?.(text);
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
    <section
      className="space-y-6 rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] p-8 text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--transition-snappy)] dark:text-[color:var(--surface)]"
      aria-live="polite"
    >
      <div className="space-y-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--accent)]">Step 1</p>
        <h3 className="text-xl font-bold text-[color:var(--ink)] dark:text-[color:var(--surface)]">Upload or Paste Your Resume</h3>
        <p className="text-sm text-[color:var(--ink-muted)] dark:text-[color:color-mix(in_oklab,var(--surface),transparent_35%)]">
          Drag a PDF or DOCX, or paste the text to let our AI optimize every line.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
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
          "relative flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-card)_-_0.5rem)] border border-dashed border-[color:color-mix(in_oklab,var(--accent),transparent_36%)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_6%)] px-6 py-12 text-center shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,transform,background-color] duration-300 ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent),transparent_26%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] dark:focus-visible:ring-offset-[color:var(--surface-strong)]",
          isDragging && "border-[color:color-mix(in_oklab,var(--accent),transparent_20%)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_18%)] shadow-[var(--shadow-lift)]"
        )}
      >
        <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_10%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
          Max 5MB
        </span>
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_14%)] px-4 py-2 text-xs font-semibold text-[color:var(--ink)] shadow-[var(--shadow-soft)] dark:text-[color:var(--surface)]">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>PDF</span>
          <span className="mx-1 text-[color:color-mix(in_oklab,var(--ink-500),transparent_40%)]">|</span>
          <span>DOCX</span>
        </div>
        <UploadCloud className="h-10 w-10 text-[color:color-mix(in_oklab,var(--emerald-700),transparent_10%)]" aria-hidden="true" />
        <p className="text-base font-semibold text-[color:var(--ink)] dark:text-[color:var(--surface)]">
          Drop your resume here or click to browse
        </p>
        <p className="text-sm text-[color:var(--ink-muted)] dark:text-[color:color-mix(in_oklab,var(--surface),transparent_35%)]">
          We keep uploads private and secure.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="sr-only"
        aria-label="Upload resume file"
        title="Upload resume file"
        onChange={handleFileChange}
      />

      {fileName && (
        <div className="flex items-center justify-between rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_14%)] px-4 py-3 text-sm text-[color:var(--ink)] shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--transition-snappy)] dark:text-[color:var(--surface)]">
          <span className="truncate font-medium">{fileName}</span>
          <button
            type="button"
            onClick={onFileClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--hairline-soft)] text-[color:var(--accent)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_16%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent),transparent_24%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] dark:focus-visible:ring-offset-[color:var(--surface-strong)]"
            aria-label="Remove selected file"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <label className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)] dark:text-[color:var(--surface)]">
          <ClipboardPenLine className="h-4 w-4 text-[color:var(--accent)]" aria-hidden="true" />
          Paste resume text instead
        </span>
        <textarea
          className="min-h-[160px] w-full resize-y rounded-2xl border border-[color:var(--hairline-strong)] bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_18%)] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--panel-highlight),transparent_22%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent),transparent_28%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] dark:text-[color:var(--surface)] dark:focus-visible:ring-offset-[color:var(--surface-strong)]"
          placeholder="Paste resume text…"
          value={textValue}
          onChange={(event) => onTextChange?.(event.target.value)}
        />
      </label>

      {textHelper && (
        <p className="text-sm font-semibold text-warning-600 dark:text-warning-400" role="status">
          {textHelper}
        </p>
      )}

      {showProgress && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-smoke-50/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {stateMessage && (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-secondary-500">
              {stateMessage}
            </p>
          )}
        </div>
      )}

      {!showProgress && stateMessage && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-500">
          {stateMessage}
        </p>
      )}

      {error && (
        <p className="text-sm font-medium text-danger-500" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onSubmit} disabled={disabled} loading={status === "uploading" || status === "parsing"}>
          Prepare Resume
        </PrimaryButton>
        <SecondaryButton onClick={onFileClear} disabled={!fileName && !textValue} icon={XCircle}>
          Clear inputs
        </SecondaryButton>
      </div>
    </section>
  );
}
