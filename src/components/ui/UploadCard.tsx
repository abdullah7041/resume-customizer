import { useRef, useState } from "react";
import { FileText, Shield, UploadCloud, XCircle, Loader2 } from "lucide-react";
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
  "inline-flex items-center justify-center rounded-full border border-emerald-900/12 bg-white text-emerald-700 shadow-soft dark:border-emerald-200/16 dark:bg-black/36 dark:text-emerald-200";


export default function UploadCard({
  fileName,
  pastedText = "",
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
  requiresSignIn = false,
  onAuthRequired,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
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

  const gateAuthRequired = () => {
    if (!requiresSignIn) return false;
    onAuthRequired?.();
    return true;
  };

  const handleFile = async (file) => {
    if (gateAuthRequired()) return;
    if (!file) return;

    const size = typeof file.size === "number" ? file.size : 0;
    const documentFile = isDocumentFile(file);
    const plainTextFile = isPlainTextFile(file);

    if (!documentFile && !plainTextFile) {
      onValidationError?.(
        new AppError({
          code: "file/unsupported-type",
          message: t('upload.errors.unsupportedType', 'Only PDF, DOCX, or TXT resumes are supported.'),
          hint: t('upload.errors.unsupportedTypeHint', 'Upload a PDF or DOCX, or paste plain text.'),
        })
      );
      return;
    }

    if (size > MAX_SIZE_BYTES) {
      onValidationError?.(
        new AppError({
          code: "file/too-large",
          message: t('upload.errors.tooLarge', 'File must be 5MB or smaller.'),
          hint: t('upload.errors.tooLargeHint', 'Compress the resume and try again.'),
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
            message: t('upload.errors.readFailed', "We couldn't read that text file."),
            hint: t('upload.errors.readFailedHint', 'Paste the contents manually instead.'),
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
    if (gateAuthRequired()) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (requiresSignIn) return;
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (event) => {
    if (gateAuthRequired()) {
      if (event.target) {
        event.target.value = "";
      }
      return;
    }
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
  const uploadFileLabel = t('upload.card.uploadFileLabel', 'Upload resume file');
  const removeFileLabel = t('upload.card.removeFileLabel', 'Remove selected file');

  return (
    <GlassCard
      padding="lg"
      className="mx-auto w-full max-w-full sm:max-w-5xl transition-all duration-300 relative overflow-hidden bg-white dark:bg-[#082b23]/95"
    >
      <header data-tour="upload-header" className="space-y-1.5 sm:space-y-2 text-center sm:text-left mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] sm:tracking-[0.32em] text-gold-500">{t("upload.card.step")}</p>
        </div>
        <h3 className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white leading-tight">{t("upload.card.title")}</h3>
        <p className="text-[11px] sm:text-sm text-gray-600 dark:text-emerald-100/90 leading-relaxed">
          {t("upload.card.subtitle")}
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        aria-label={uploadFileLabel}
        title={uploadFileLabel}
        onClick={() => {
          if (gateAuthRequired()) return;
          inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (gateAuthRequired()) return;
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-2.5 sm:gap-4 overflow-hidden rounded-lg sm:rounded-xl border-2 border-dashed border-emerald-700/30 bg-emerald-50/80 px-3 pt-12 pb-6 sm:px-6 sm:py-12 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--workspace-surface)] dark:border-emerald-200/24 dark:bg-black/24 dark:focus-visible:ring-offset-[#082b23] cursor-pointer",
          "hover:border-emerald-600/50 hover:bg-emerald-50 dark:hover:border-emerald-200/35 dark:hover:bg-black/32",
          isDragging &&
          "border-emerald-500/70 bg-emerald-100/90 dark:border-emerald-300/50 dark:bg-emerald-500/12 scale-[1.01]"
        )}
      >
        <span className={cn("absolute right-2 rtl:right-auto rtl:left-2 sm:right-6 sm:rtl:left-6 sm:rtl:right-auto top-3 sm:top-6 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em]", chipClass)}>
          {t("upload.card.maxSize")}
        </span>
        <div className="flex items-center gap-2 rounded-pill border border-emerald-900/14 bg-white/92 px-4 py-2 text-xs font-semibold text-gray-800 shadow-soft dark:border-emerald-200/16 dark:bg-black/36 dark:text-emerald-50">
          <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span>{t("upload.card.pdf")}</span>
          <span className="text-gray-600 dark:text-emerald-100/75">{t("upload.card.and")}</span>
          <span>{t("upload.card.docx")}</span>
          <span className="text-gray-600 dark:text-emerald-100/75">{t("upload.card.and")}</span>
          <span>{t("upload.card.txt", "TXT")}</span>
        </div>
        <span className="relative inline-flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400/12 blur-xl" aria-hidden="true" />
          <span className="relative inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-100/80 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.45)] transition-all duration-300 hover:border-emerald-600/42 hover:bg-emerald-100 dark:border-emerald-300/25 dark:bg-emerald-400/12 dark:hover:border-emerald-300/40">
            <UploadCloud className="h-7 w-7 sm:h-9 sm:w-9 text-emerald-700 transition-all duration-300 group-hover:scale-105 dark:text-emerald-200" aria-hidden="true" />
          </span>
        </span>
        <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white px-2">
          {t("upload.card.dropText")}
        </p>
        <p className="text-xs sm:text-sm text-gray-700 dark:text-emerald-100/88 px-2">
          <span className="inline-flex items-center gap-1.5"><Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 dark:text-emerald-300" /> {t("upload.card.securityText")}</span>
        </p>
      </div>

      {/* File Type & Best Practices Info */}
      <div className="mt-4 text-center space-y-2">
        <p className="text-xs font-medium text-gray-600 dark:text-emerald-100/76">
          {t('upload.card.supportedFormats', 'Supported formats: PDF, DOCX, TXT')} • {t('upload.card.maxSizeLabel', 'Max size: 5MB')}
        </p>
        <p className="text-xs text-gray-600 dark:text-emerald-100/70">
          {t('upload.card.bestPractice', 'For best results, use selectable text. Scanned images are not supported.')}
        </p>
        <p className="text-xs text-gray-600 dark:text-emerald-100/70">
          {t('trust.noInvention', 'Watheq does not invent employers, degrees, certifications, or metrics.')}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <label
          htmlFor="resume-paste-text"
          className="block text-sm font-semibold text-gray-800 dark:text-emerald-100"
        >
          {t('upload.card.pasteLabel', 'Or paste your resume text')}
        </label>
        <textarea
          id="resume-paste-text"
          value={pastedText}
          onChange={(event) => {
            if (gateAuthRequired()) return;
            onTextChange?.(sanitizeTextInput(event.target.value));
          }}
          disabled={status === "uploading" || status === "parsing"}
          rows={4}
          className="w-full resize-y rounded-xl border border-gray-300/80 bg-white/95 px-4 py-3 text-sm text-gray-900 shadow-inner outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500 dark:border-white/15 dark:bg-black/32 dark:text-white dark:placeholder:text-emerald-100/45 dark:focus:border-emerald-300/70 dark:focus:ring-emerald-300/18 dark:disabled:bg-white/5 dark:disabled:text-gray-400"
          placeholder={t('upload.card.pastePlaceholder', 'Paste selectable resume text here...')}
        />
        <p className="text-xs text-gray-600 dark:text-emerald-100/70">
          {t('upload.card.pasteHelp', 'Use either a file or pasted text. The latest input will be used.')}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="sr-only"
        name="resume-file"
        aria-label={uploadFileLabel}
        title={uploadFileLabel}
        onChange={handleFileChange}
      />

      {/* Mobile: Prominent upload buttons */}
      <div className="flex flex-col sm:hidden gap-2 w-full mt-4">
        <button
          type="button"
          onClick={() => {
            if (gateAuthRequired()) return;
            inputRef.current?.click();
          }}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm shadow-[0_10px_22px_-16px_rgba(16,185,129,0.55)] transition-all duration-300 active:scale-[0.98]"
        >
          <UploadCloud className="h-5 w-5" />
          <span>{t("upload.card.selectFile") || "Select File"}</span>
        </button>
      </div>

      {isSaved && fileName && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-600/28 bg-emerald-50/92 px-5 py-4 text-sm text-gray-900 shadow-[0_8px_22px_-18px_rgba(16,185,129,0.4)] animate-in fade-in slide-in-from-bottom-2 duration-500 dark:border-emerald-300/24 dark:bg-emerald-400/12 dark:text-emerald-50">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-emerald-700 dark:text-emerald-100">{t('upload.card.savedTitle', 'Resume ready and saved')}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-200/80 font-mono break-all line-clamp-2">{fileName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onFileClear}
            className="group ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-emerald-200/70 transition-all hover:bg-red-500/20 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            aria-label={removeFileLabel}
            title={removeFileLabel}
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* File Selected Indicator (Not Saved Yet) */}
      {fileName && !isSaved && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-blue-600/25 bg-blue-50/92 px-5 py-4 text-sm text-gray-900 shadow-[0_8px_22px_-18px_rgba(59,130,246,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-500 dark:border-blue-300/22 dark:bg-blue-400/12 dark:text-blue-50">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-blue-700 dark:text-blue-100">{t('upload.card.readyTitle', 'Ready to prepare')}</span>
              <span className="text-xs text-blue-600 dark:text-blue-200/80 font-mono break-all line-clamp-2">{fileName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onFileClear}
            className="group ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-blue-200/70 transition-all hover:bg-blue-500/20 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label={removeFileLabel}
            title={removeFileLabel}
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
            <p className="text-sm font-medium text-red-700 dark:text-red-200" role="alert">
              {error}
            </p>
          </div>
        )
      }

      {isSaved && (
        <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <label className="relative flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-emerald-900/12 bg-emerald-50/70 cursor-pointer hover:bg-emerald-50 transition-all group overflow-hidden dark:border-emerald-200/14 dark:bg-white/[0.06] dark:hover:bg-white/[0.08]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:via-emerald-500/0 group-hover:to-emerald-500/0 transition-all duration-500" />

            <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                <span className="text-lg sm:text-xl drop-shadow-md">🇸🇦</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-100 transition-colors">
                  {t('upload.card.saudi.label')}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-600 dark:text-emerald-100/72 font-medium">
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

      <div className="mt-6 pt-6 border-t border-emerald-900/10 dark:border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 w-full">
        <GlassButton
          variant="ghost"
          onClick={onFileClear}
          disabled={!fileName && !pastedText}
          className="w-full sm:w-auto text-gray-700 hover:text-red-700 hover:bg-red-500/8 dark:text-emerald-100/78 dark:hover:text-red-200 dark:hover:bg-red-500/10"
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
            {t('common.cancel', 'Cancel')}
          </GlassButton>
        )}

        <GlassButton
          onClick={onSubmit}
          disabled={disabled || status === "uploading" || status === "parsing"}
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[200px] shadow-[0_10px_22px_-16px_rgba(16,185,129,0.5)] hover:shadow-[0_12px_28px_-18px_rgba(16,185,129,0.55)]"
        >
          {(status === "uploading" || status === "parsing") ? (
            <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('upload.card.processingButton', 'Processing...')}</>
          ) : (
            <>
              {pastedText && !fileName
                ? t('upload.card.preparePastedButton', 'Prepare Pasted Text')
                : fileName && !pastedText
                ? t('upload.card.prepareFileButton', 'Prepare Selected File')
                : t("upload.card.prepareButton")}
              <span className="ml-2">→</span>
            </>
          )}
        </GlassButton>
      </div>
    </GlassCard>
  );
}




