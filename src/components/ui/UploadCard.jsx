import { useRef, useState } from "react";
import { ClipboardPenLine, FileText, UploadCloud, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

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
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect?.(file);
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
    if (file) onFileSelect?.(file);
  };

  const stateMessage = statusCopy[status];
  const showProgress = status === "uploading" || status === "parsing";

  return (
    <section
      className="space-y-6 rounded-[var(--radius-card)] border border-secondary-500/10 bg-sand-50/95 p-8 text-ink-700 shadow-card backdrop-blur-sm sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60 dark:text-surface-50"
      aria-live="polite"
    >
      <div className="space-y-2 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-500">Step 1</p>
        <h3 className="text-xl font-bold text-ink-700 dark:text-surface-50">Upload or Paste Your Resume</h3>
        <p className="text-sm text-ink-500/80 dark:text-surface-50/70">
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
          "relative flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-card)_-_0.5rem)] border-2 border-dashed border-secondary-500/40 bg-secondary-500/5 px-6 py-12 text-center transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-secondary-500/30 dark:bg-secondary-500/10 dark:focus-visible:ring-offset-zinc-900",
          isDragging && "border-secondary-500 bg-secondary-500/15 shadow-soft"
        )}
      >
        <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-secondary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary-500">
          Max 5MB
        </span>
        <div className="flex items-center gap-2 rounded-full bg-sand-50/90 px-4 py-2 text-xs font-semibold text-ink-700 shadow-soft dark:bg-zinc-900/60 dark:text-surface-50">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>PDF</span>
          <span className="mx-1 text-ink-500/60">|</span>
          <span>DOCX</span>
        </div>
        <UploadCloud className="h-10 w-10 text-secondary-500" aria-hidden="true" />
        <p className="text-base font-semibold text-ink-700 dark:text-surface-50">
          Drop your resume here or click to browse
        </p>
        <p className="text-sm text-ink-500/80 dark:text-surface-50/70">
          We keep uploads private and secure.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="sr-only"
        aria-label="Upload resume file"
        title="Upload resume file"
        onChange={handleFileChange}
      />

      {fileName && (
        <div className="flex items-center justify-between rounded-2xl border border-secondary-500/20 bg-secondary-500/5 px-4 py-3 text-sm text-ink-700 dark:border-secondary-500/25 dark:bg-secondary-500/10 dark:text-surface-50">
          <span className="truncate font-medium">{fileName}</span>
          <button
            type="button"
            onClick={onFileClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-secondary-500 transition-colors hover:bg-secondary-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:text-surface-50 dark:hover:bg-secondary-500/25 dark:focus-visible:ring-offset-surface-900"
            aria-label="Remove selected file"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <label className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-surface-50">
          <ClipboardPenLine className="h-4 w-4 text-secondary-500" aria-hidden="true" />
          Paste resume text instead
        </span>
        <textarea
          className="min-h-[160px] w-full resize-y rounded-2xl border border-secondary-500/25 bg-sand-50/95 px-4 py-3 text-sm leading-relaxed text-ink-700 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 dark:border-surface-50/15 dark:bg-zinc-900/60 dark:text-surface-50 dark:focus-visible:ring-offset-zinc-900"
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
