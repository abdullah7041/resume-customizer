import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import UploadCard from '../ui/UploadCard';
import { isAuthRequiredError } from '../../services/api.js';
import { AppError } from '../../services/supabase.js';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import type { ResumeSchema } from '../../types/resume';
import { ParsingWarningsBanner } from '../ui/ParsingWarningsBanner';
import { MAX_RESUME_LIBRARY_SIZE, useResumeLibraryStore } from '@/lib/resumeLibrary';

interface Toast {
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    description?: string;
}

interface ResumeDocument {
    file?: File | null;
    fileName?: string;
    plainText?: string;
}

interface ParsedResumeResult {
    data?: ResumeSchema;
    plainText?: string;
    [key: string]: unknown;
}

interface UploadSectionProps {
    onParseResume: (resumeInput: { file?: File; plainText?: string }, signal?: AbortSignal) => Promise<ParsedResumeResult>;
    onBeforeParseResume?: () => void;
    resumeDocument: ResumeDocument | null;
    onToast: (toast: Toast) => void;
    onClear: () => void;
}

export default function UploadSection({
    onParseResume,
    onBeforeParseResume,
    resumeDocument,
    onToast,
    onClear,
}: UploadSectionProps) {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [pastedText, setPastedText] = useState('');
    // Ref for tracking active parse request to support cancellation
    const parseRequestActive = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Get store actions
    const { setOriginalResume, setParsedResumeText, clearAll, resetForNewUpload, isSaudiNational, setSaudiNational } = useResumeStore();
    const libraryEntries = useResumeLibraryStore((state) => state.entries);
    const activeResumeId = useResumeLibraryStore((state) => state.activeResumeId);
    const renameResume = useResumeLibraryStore((state) => state.renameResume);
    const removeResume = useResumeLibraryStore((state) => state.removeResume);

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        setPastedText('');
        setError(null);
        setStatus('idle');
    }, []);

    const handleFileClear = useCallback(() => {
        setFile(null);
        setPastedText('');
        setError(null);
        setStatus('idle');
        setProgress(0);
        if (activeResumeId && resumeDocument?.plainText) {
            void removeResume(activeResumeId);
            return;
        }
        // Clear unsaved input and legacy state.
        clearAll();
        onClear();
    }, [activeResumeId, clearAll, onClear, removeResume, resumeDocument?.plainText]);

    const handleTextChange = useCallback((text: string) => {
        setPastedText(text);
        setFile(null);
        setError(null);
        setStatus('idle');
    }, []);

    const handleValidationError = useCallback((err: AppError) => {
        setError(err.message);
        onToast({
            type: 'warning',
            title: err.message,
            description: err.hint,
        });
    }, [onToast]);

    const handleCancel = useCallback(() => {
        if (status === 'uploading' || status === 'parsing') {
            // Abort the fetch request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            parseRequestActive.current = false;
            setStatus('idle');
            setProgress(0);
            onToast({
                type: 'info',
                title: 'Upload cancelled',
            });
        }
    }, [status, onToast]);

    const handleSubmit = useCallback(async () => {
        if (!file && !pastedText) {
            onToast({
                type: 'warning',
                title: 'No resume provided',
                description: 'Please upload a file or paste text',
            });
            return;
        }
        if (libraryEntries.length >= MAX_RESUME_LIBRARY_SIZE) {
            onToast({
                type: 'warning',
                title: t('upload.library.limitTitle', 'Resume library is full'),
                description: t('upload.library.limitDescription', 'Remove one of your five saved resumes before adding another.'),
            });
            return;
        }

        const startTime = performance.now();
        const fileType = file?.type || 'text/plain';

        // Track upload started
        analytics.track('resume_upload_started', { file_type: fileType });

        try {
            parseRequestActive.current = true;

            // Create new AbortController for this upload
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            // Preserve the active resume's export context before clearing its store state.
            onBeforeParseResume?.();
            resetForNewUpload();

            setStatus('uploading');
            setProgress(30);

            const input = file ? { file } : { plainText: pastedText };

            setStatus('parsing');
            setProgress(60);

            const result = await onParseResume(input, signal);

            // Check if request was cancelled
            if (!parseRequestActive.current) {
                return;
            }

            setProgress(100);
            setStatus('success');

            // Save to store if we got parsed data
            if (result) {
                // Handle different response structures
                const parsedResume = result.data || result;

                // CRITICAL FIX: Ensure rawText is always a string, never an object
                // This prevents [object Object] being passed to setParsedResumeText
                const plainTextValue = result.plainText;
                const rawText = typeof plainTextValue === 'string' && plainTextValue.length > 0
                    ? plainTextValue
                    : (pastedText || '');

                // Save to store
                if (parsedResume && typeof parsedResume === 'object' && 'basics' in parsedResume) {
                    const resumeData = parsedResume as ResumeSchema;
                    setOriginalResume(resumeData);
                }

                if (rawText && typeof rawText === 'string') {
                    setParsedResumeText(rawText);
                } else {
                    console.warn('[Upload] Warning: No valid rawText to save.', {
                        valueType: typeof plainTextValue,
                        hasValue: plainTextValue !== null && plainTextValue !== undefined,
                        keys: plainTextValue && typeof plainTextValue === 'object'
                            ? Object.keys(plainTextValue as Record<string, unknown>).slice(0, 10)
                            : [],
                    });
                }
            }

            // Track successful upload
            const parseTime = performance.now() - startTime;
            analytics.trackUpload(fileType, true, parseTime);

            onToast({
                type: 'success',
                title: 'Resume parsed successfully',
            });
        } catch (err) {
            // Handle user-initiated cancellation silently
            if (err && (err as Error & { cancelled?: boolean }).cancelled) {
                return;
            }

            if (!parseRequestActive.current) return;

            if (isAuthRequiredError(err)) {
                const authRequiredTitle = t('toasts.signInRequired', 'Sign in required');
                const authRequiredMessage = t(
                    'toasts.signInRequiredDesc',
                    'Please sign in to securely process your resume.'
                );
                setStatus('error');
                setProgress(0);
                setError(authRequiredMessage);
                onToast({
                    type: 'warning',
                    title: authRequiredTitle,
                    description: authRequiredMessage,
                });
                return;
            }

            setStatus('error');
            setProgress(0);

            // 422 = no selectable text (scanned/image-only or unsupported font encoding).
            // Surface a clear, localized instruction instead of the raw server string —
            // we do NOT support OCR, so the user must paste text or use a text-based file.
            const errStatus = (err as Error & { status?: number })?.status;
            const isUnreadable = errStatus === 422;
            const message = isUnreadable
                ? t('upload.errors.unreadable', "We couldn't read selectable text from that file.")
                : (err instanceof Error ? err.message : 'Failed to parse resume');
            const description = isUnreadable
                ? t('upload.errors.unreadableHint', "Upload a text-based PDF/DOCX or paste your resume text. Scanned or image-only files aren't supported yet.")
                : message;
            setError(message);

            // Track failed upload
            analytics.trackUpload(fileType, false, undefined, message);

            onToast({
                type: 'danger',
                title: isUnreadable
                    ? t('upload.errors.unreadable', "We couldn't read selectable text from that file.")
                    : 'Parse failed',
                description,
            });
        }
    }, [file, libraryEntries.length, onBeforeParseResume, onParseResume, onToast, pastedText, resetForNewUpload, setOriginalResume, setParsedResumeText, t]);

    const fileName = file?.name || resumeDocument?.fileName || '';
    const disabled = !file && !pastedText && !resumeDocument?.plainText;

    // Resume is saved only if we have a successful new upload OR we have an existing document and haven't selected a new file
    const isSaved = status === 'success' || (!file && !!resumeDocument?.fileName);

    return (
        <div data-tour="upload" className="space-y-6">
            {/* Validation Warnings — rendered from store via shared banner component */}
            <ParsingWarningsBanner className="mb-4" />

            {libraryEntries.length > 0 && (
                <section className="rounded-2xl border border-emerald-900/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]" aria-labelledby="resume-library-title">
                    <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 [&::-webkit-details-marker]:hidden">
                            <span>
                                <span id="resume-library-title" className="block font-semibold text-gray-900 dark:text-white">
                                    {t('upload.library.manage', 'Manage saved resumes')}
                                </span>
                                <span className="block text-xs text-gray-600 dark:text-emerald-100/70">
                                    {t('upload.library.count', '{{count}} of {{max}} saved on this device', { count: libraryEntries.length, max: MAX_RESUME_LIBRARY_SIZE })}
                                </span>
                            </span>
                            <ChevronDown className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="mt-3 grid gap-2">
                            {libraryEntries.map((entry) => {
                                const active = entry.id === activeResumeId;
                                return (
                                    <div key={entry.id} className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${active ? 'border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-500/10' : 'border-gray-200 bg-white/70 dark:border-white/10 dark:bg-black/20'}`}>
                                        <div className="min-w-0 flex-1">
                                            <input
                                                key={`${entry.id}:${entry.name}`}
                                                defaultValue={entry.name}
                                                maxLength={80}
                                                aria-label={t('upload.library.nameLabel', 'Resume name')}
                                                onBlur={(event) => void renameResume(entry.id, event.target.value)}
                                                className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base font-medium text-ink outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
                                            />
                                            <p className="mt-1 break-words text-sm text-ink-muted">{entry.parsedResume.basics?.name}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {active && (
                                                <span className="inline-flex min-h-11 items-center rounded-lg bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                                                    {t('upload.library.active', 'Active')}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => void removeResume(entry.id)}
                                                aria-label={t('upload.library.remove', 'Remove {{name}}', { name: entry.name })}
                                                className="min-h-11 rounded-lg px-3 text-sm font-medium text-red-700 transition-[background-color,scale] hover:bg-red-50 active:scale-[0.96] dark:text-red-300 dark:hover:bg-red-500/10"
                                            >
                                                {t('common.remove', 'Remove')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </details>
                </section>
            )}

            <UploadCard
                fileName={fileName}
                pastedText={pastedText}
                onFileSelect={handleFileSelect}
                onFileClear={handleFileClear}
                onSubmit={handleSubmit}
                status={status}
                progress={progress}
                error={error}
                disabled={disabled}
                onValidationError={handleValidationError}
                onTextChange={handleTextChange}
                isSaved={isSaved}
                onCancel={handleCancel}
                isSaudiNational={isSaudiNational}
                onSaudiNationalChange={setSaudiNational}
            />
        </div>
    );
}
