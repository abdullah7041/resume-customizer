import { useRef, useState } from "react";
import { FileText, Shield, UploadCloud, XCircle, Camera, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppError } from "../../services/supabase.js";
import { cn } from "../../lib/utils/cn";
import { GlassButton } from "./GlassButton";
import { GlassCard } from "./GlassCard";


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
  isSaved,
  onCancel,
  isSaudiNational,
  onSaudiNationalChange,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Import CheckCircle dynamically or assume it's available. 
  // Since I can't change the import lines in `replace_file_content` easily if they are at the top,
  // I will use a separate `edit` for imports or just use an existing icon if CheckCircle isn't there?
  // Wait, I can't import inside the function.
  // I will assume I need to do a multi_replace to handle imports as well.

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
    <GlassCard
      padding="lg"
      className="mx-auto w-full max-w-full sm:max-w-5xl transition-all duration-300 relative overflow-hidden"
    >
      <header data-tour="upload-header" className="space-y-1.5 sm:space-y-2 text-center sm:text-left mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.32em] text-gold-500">{t("upload.card.step")}</p>
        </div>
        <h3 className="text-lg sm:text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-tight">{t("upload.card.title")}</h3>
        <p className="text-[11px] sm:text-sm text-emerald-100/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] leading-relaxed">
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
          "group relative flex flex-col items-center justify-center gap-2.5 sm:gap-4 overflow-hidden rounded-lg sm:rounded-xl border-2 border-dashed border-white/20 px-3 pt-12 pb-6 sm:px-6 sm:py-12 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 cursor-pointer",
          "hover:border-emerald-400/40 hover:bg-white/[0.02]",
          isDragging &&
          "border-emerald-400/50 bg-emerald-500/5 scale-[1.01]"
        )}
      >
        <span className={cn("absolute right-2 rtl:right-auto rtl:left-2 sm:right-6 sm:rtl:left-6 sm:rtl:right-auto top-3 sm:top-6 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em]", chipClass)}>
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

      {/* File Type & Best Practices Info */}
      <div className="mt-4 text-center space-y-2">
        <p className="text-xs text-gray-400">
          {t('upload.card.supportedFormats', 'Supported formats: PDF, DOCX, TXT')} • {t('upload.card.maxSizeLabel', 'Max size: 5MB')}
        </p>
        <p className="text-xs text-gray-500">
          {t('upload.card.bestPractice', 'For best results, use a PDF with selectable text (not scanned images)')}
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

      {/* Camera capture input for mobile - scan physical resumes */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        name="resume-camera"
        aria-label="Take photo of resume"
        title="Take photo of resume"
        onChange={handleFileChange}
      />

      {/* Mobile: Prominent upload buttons */}
      <div className="flex flex-col sm:hidden gap-2 w-full mt-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 active:scale-[0.98]"
        >
          <UploadCloud className="h-5 w-5" />
          <span>{t("upload.card.selectFile") || "Select File"}</span>
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-white/5 border border-white/10 text-white font-medium text-sm transition-all duration-300 hover:bg-white/10 active:scale-[0.98]"
        >
          <Camera className="h-5 w-5 text-emerald-400" />
          <span>{t("upload.card.scanResume") || "Scan Resume"}</span>
        </button>
      </div>

      {isSaved && fileName && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-ink shadow-[0_4px_20px_-4px_rgba(16,185,129,0.2)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-emerald-100">Resume Ready & Saved</span>
              <span className="text-xs text-emerald-200/80 font-mono break-all line-clamp-2">{fileName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onFileClear}
            className="group ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-emerald-200/70 transition-all hover:bg-red-500/20 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            aria-label="Remove selected file"
            title="Remove selected file"
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* File Selected Indicator (Not Saved Yet) */}
      {fileName && !isSaved && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-ink shadow-[0_4px_20px_-4px_rgba(59,130,246,0.2)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-blue-100">Ready to Prepare</span>
              <span className="text-xs text-blue-200/80 font-mono break-all line-clamp-2">{fileName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onFileClear}
            className="group ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-blue-200/70 transition-all hover:bg-blue-500/20 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label="Remove selected file"
            title="Remove selected file"
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}


      {showProgress && (
        <div className="mt-6 space-y-2" aria-live="assertive">
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
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-500 text-center">
              {stateMessage}
            </p>
          )}
        </div>
      )
      }

      {
        error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-sm font-medium text-red-200" role="alert">
              {error}
            </p>
          </div>
        )
      }

      {isSaved && (
        <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <label className="relative flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/[0.07] transition-all group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:via-emerald-500/0 group-hover:to-emerald-500/0 transition-all duration-500" />

            <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                <span className="text-lg sm:text-xl drop-shadow-md">🇸🇦</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-white group-hover:text-emerald-100 transition-colors">
                  {t('upload.card.saudi.label')}
                </span>
                <span className="text-[10px] sm:text-xs text-emerald-200/60 font-medium">
                  {t('upload.card.saudi.description')}
                </span>
              </div>
            </div>

            <div className="relative z-10 shrink-0">
              <input
                type="checkbox"
                checked={isSaudiNational}
                onChange={(e) => onSaudiNationalChange?.(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-500/30 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
            </div>
          </label>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-white/5 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 w-full">
        <GlassButton
          variant="ghost"
          onClick={onFileClear}
          disabled={!fileName}
          className="w-full sm:w-auto text-emerald-200/60 hover:text-red-300 hover:bg-red-500/5"
        >
          <XCircle className="w-4 h-4 me-2" />
          {t("upload.card.clearButton")}
        </GlassButton>

        {/* Show Cancel button during processing */}
        {(status === 'uploading' || status === 'parsing') && (
          <GlassButton
            variant="ghost"
            onClick={onCancel}
            className="w-full sm:w-auto text-red-300 hover:text-red-200 hover:bg-red-500/10"
          >
            <XCircle className="w-4 h-4 me-2" />
            Cancel
          </GlassButton>
        )}

        <GlassButton
          onClick={onSubmit}
          disabled={disabled || status === "uploading" || status === "parsing"}
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[200px] shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
        >
          {(status === "uploading" || status === "parsing") ? (
            <><Loader2 className="w-4 h-4 me-2 animate-spin" /> Processing...</>
          ) : (
            <>{t("upload.card.prepareButton")} <span className="ml-2">→</span></>
          )}
        </GlassButton>
      </div>
    </GlassCard>
  );
}




