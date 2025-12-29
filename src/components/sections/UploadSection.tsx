import { useState, useCallback } from 'react';
import UploadCard from '../ui/UploadCard';
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
    onParseResume: (resumeInput: { file?: File; plainText?: string }) => Promise<ParsedResumeResult>;
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
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [pastedText, setPastedText] = useState('');
    const [warnings, setWarnings] = useState<ParsingWarning[]>([]);

    // Get store actions
    const { setOriginalResume, setParsedResumeText, clearAll, resetForNewUpload } = useResumeStore();

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
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
            // CRITICAL: Reset previous resume data before processing new upload
            resetForNewUpload();
            setWarnings([]);

            setStatus('uploading');
            setProgress(30);

            const input = file ? { file } : { plainText: pastedText };

            setStatus('parsing');
            setProgress(60);

            const result = await onParseResume(input);

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
                    console.log('[Upload] Resume saved to store:', resumeData.basics?.name);

                    // Generate warnings
                    const newWarnings = getParsingWarnings(resumeData);
                    if (newWarnings.length > 0) {
                        setWarnings(newWarnings);
                        console.log('[Upload] Generated warnings:', newWarnings);
                    }
                }

                if (rawText && typeof rawText === 'string') {
                    setParsedResumeText(rawText);
                    console.log('[Upload] Raw text saved to store, length:', rawText.length);
                } else {
                    console.warn('[Upload] Warning: No valid rawText to save. Value was:', typeof plainTextValue, plainTextValue);
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
            setStatus('error');
            setProgress(0);
            const message = err instanceof Error ? err.message : 'Failed to parse resume';
            setError(message);

            // Track failed upload
            analytics.trackUpload(fileType, false, undefined, message);

            onToast({
                type: 'danger',
                title: 'Parse failed',
                description: message,
            });
        }
    }, [file, pastedText, onParseResume, onToast, setOriginalResume, setParsedResumeText, resetForNewUpload]);

    const fileName = file?.name || resumeDocument?.fileName || '';
    const disabled = !file && !pastedText && !resumeDocument?.plainText;

    return (
        <div className="space-y-6">
            <UploadCard
                fileName={fileName}
                onFileSelect={handleFileSelect}
                onFileClear={handleFileClear}
                onSubmit={handleSubmit}
                status={status}
                progress={progress}
                error={error}
                disabled={disabled}
                onValidationError={handleValidationError}
                onTextChange={handleTextChange}
            />

            {/* Validation Warnings */}
            {warnings.length > 0 && status === 'success' && (
                <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2 w-full">
                                <h4 className="text-sm font-semibold text-amber-200">
                                    Resume Parsing Alerts
                                </h4>
                                <div className="space-y-2">
                                    {warnings.map((warning, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "text-xs p-2 rounded-lg border",
                                                warning.level === 'warning'
                                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-100"
                                                    : "bg-blue-500/10 border-blue-500/20 text-blue-100"
                                            )}
                                        >
                                            <span className="font-semibold mr-1">[{warning.section}]</span>
                                            {warning.message}
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
