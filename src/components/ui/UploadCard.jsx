import { useRef, useState } from "react";
import { ClipboardPenLine, FileText, UploadCloud, XCircle } from "lucide-react";
import { AppError } from "../../services/supabase.js";
import { cn } from "../../lib/cn";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import Input from "./Input.jsx";

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
    <Card
      as="section"
      tone="glass"
      glow
      className="mx-auto max-w-2xl space-y-5 sm:space-y-6"
      contentClassName="space-y-5 sm:space-y-6"
      aria-live="polite"
    >
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-500">Step 1</p>
        <h3 className="text-2xl font-semibold text-ink">Upload or Paste Your Resume</h3>
        <p className="text-sm text-ink-soft/85">
          Drag a PDF or DOCX, or paste the text to let our AI optimize every line.
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
          "relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[calc(var(--radius-card)*0.8)] border border-dashed border-[color:color-mix(in_oklab,var(--glass-border),transparent_20%)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_14%)] px-6 py-8 text-center shadow-soft backdrop-blur-glass transition-all duration-breathe ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] sm:py-10",
          "before:absolute before:inset-0 before:rounded-[inherit] before:bg-[image:var(--glass-reflection)] before:opacity-0 before:transition-opacity before:duration-breathe before:content-['']",
          "after:pointer-events-none after:absolute after:-left-1/4 after:-top-1/2 after:h-[240%] after:w-[150%] after:rotate-[16deg] after:bg-[image:var(--gradient-card-value)] after:opacity-0 after:transition-opacity after:duration-breathe",
          isDragging &&
            "border-[color:var(--glass-border-strong)] shadow-glass before:opacity-80 after:opacity-60"
        )}
      >
        <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-pill bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_30%)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400 shadow-soft backdrop-blur-glass">
          Max 5MB
        </span>
        <div className="flex items-center gap-2 rounded-pill bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_26%)] px-4 py-2 text-xs font-semibold text-ink shadow-soft backdrop-blur-soft">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>PDF</span>
          <span className="mx-1 text-ink-soft/60">|</span>
          <span>DOCX</span>
        </div>
        <UploadCloud className="h-11 w-11 text-emerald-400" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">
          Drop your resume here or click to browse
        </p>
        <p className="text-sm text-ink-soft/80">
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
        <div className="flex items-center justify-between rounded-lg bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_22%)] px-4 py-3 text-sm text-ink shadow-soft backdrop-blur-soft">
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

      <div className="space-y-3 text-center sm:text-left">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink sm:justify-start justify-center">
          <ClipboardPenLine className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span>Paste resume text instead</span>
        </div>
        <Input
          multiline
          placeholder="Paste resume text…"
          value={textValue}
          onChange={(event) => onTextChange?.(event.target.value)}
          inputClassName="min-h-[160px]"
          aria-label="Paste resume text instead"
        />
        {textHelper && (
          <p className="text-sm font-semibold text-gold-500" role="status">
            {textHelper}
          </p>
        )}
      </div>

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

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit} disabled={disabled} loading={status === "uploading" || status === "parsing"}>
          Prepare Resume
        </Button>
        <Button
          variant="secondary"
          onClick={onFileClear}
          disabled={!fileName && !textValue}
          icon={XCircle}
        >
          Clear inputs
        </Button>
      </div>
    </Card>
  );
}
