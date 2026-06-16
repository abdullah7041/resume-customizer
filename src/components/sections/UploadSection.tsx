import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import UploadCard from '../ui/UploadCard';
import { isAuthRequiredError } from '../../services/api.js';
import { AppError } from '../../services/supabase.js';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import type { ResumeSchema } from '../../types/resume';
import { getParsingWarnings, ParsingWarning } from '../../lib/validation/parsingWarnings';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

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
    resumeDocument: ResumeDocument | null;
    onToast: (toast: Toast) => void;
    onClear: () => void;
}

export default function UploadSection({
    onParseResume,
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
    const [warnings, setWarnings] = useState<ParsingWarning[]>([]);

    // Ref for tracking active parse request to support cancellation
    const parseRequestActive = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Get store actions
    const { setOriginalResume, setParsedResumeText, clearAll, resetForNewUpload, isSaudiNational, setSaudiNational } = useResumeStore();

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        setPastedText('');
        setError(null);
        setStatus('idle');
        setWarnings([]);
    }, []);

    const handleFileClear = useCallback(() => {
        setFile(null);
        setPastedText('');
        setError(null);
        setStatus('idle');
        setProgress(0);
        setWarnings([]);
        // Clear store data as well
        clearAll();
        onClear();
    }, [onClear, clearAll]);

    const handleTextChange = useCallback((text: string) => {
        setPastedText(text);
        setFile(null);
        setError(null);
        setStatus('idle');
        setWarnings([]);
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

        const startTime = performance.now();
        const fileType = file?.type || 'text/plain';

        // Track upload started
        analytics.track('resume_upload_started', { file_type: fileType });

        try {
            parseRequestActive.current = true;

            // Create new AbortController for this upload
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            // CRITICAL: Reset previous resume data before processing new upload
            resetForNewUpload();
            setWarnings([]);

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

                    // Generate warnings
                    const newWarnings = getParsingWarnings(resumeData);
                    if (newWarnings.length > 0) {
                        setWarnings(newWarnings);
                    }
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
    }, [file, onParseResume, onToast, pastedText, resetForNewUpload, setOriginalResume, setParsedResumeText, t]);

    const fileName = file?.name || resumeDocument?.fileName || '';
    const disabled = !file && !pastedText && !resumeDocument?.plainText;

    // Resume is saved only if we have a successful new upload OR we have an existing document and haven't selected a new file
    const isSaved = status === 'success' || (!file && !!resumeDocument?.fileName);

    return (
        <div data-tour="upload" className="space-y-6">
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



            {/* Validation Warnings */}
            {warnings.length > 0 && status === 'success' && (
                <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2 w-full">
                                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                    {t('upload.warnings.title')}
                                </h4>
                                <div className="space-y-2">
                                    {warnings.map((warning, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "text-xs p-2 rounded-lg border",
                                                warning.level === 'warning'
                                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100"
                                                    : "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100"
                                            )}
                                        >
                                            <span className="font-semibold mr-1">[{t(`upload.warnings.sections.${warning.sectionId}`)}]</span>
                                            {t(warning.messageKey)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
