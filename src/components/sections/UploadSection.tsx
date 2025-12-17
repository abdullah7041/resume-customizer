import { useState, useCallback } from 'react';
import UploadCard from '../ui/UploadCard';
import { AppError } from '../../services/supabase.js';
import { useResumeStore } from '../../lib/stores/resumeStore';
import type { ResumeSchema } from '../../types/resume';

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

    // Get store actions
    const { setOriginalResume, setParsedResumeText, clearAll } = useResumeStore();

    const handleFileSelect = useCallback((selectedFile: File) => {
        setFile(selectedFile);
        setError(null);
        setStatus('idle');
    }, []);

    const handleFileClear = useCallback(() => {
        setFile(null);
        setPastedText('');
        setError(null);
        setStatus('idle');
        setProgress(0);
        // Clear store data as well
        clearAll();
        onClear();
    }, [onClear, clearAll]);

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

    const handleSubmit = useCallback(async () => {
        if (!file && !pastedText) {
            onToast({
                type: 'warning',
                title: 'No resume provided',
                description: 'Please upload a file or paste text',
            });
            return;
        }

        try {
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
                const plainTextValue = result.plainText ?? parsedResume?.plainText;
                const rawText = typeof plainTextValue === 'string' && plainTextValue.length > 0
                    ? plainTextValue
                    : (pastedText || '');

                // Save to store
                if (parsedResume && typeof parsedResume === 'object' && 'basics' in parsedResume) {
                    setOriginalResume(parsedResume as ResumeSchema);
                    console.log('[Upload] Resume saved to store:', (parsedResume as ResumeSchema).basics?.name);
                }

                if (rawText && typeof rawText === 'string') {
                    setParsedResumeText(rawText);
                    console.log('[Upload] Raw text saved to store, length:', rawText.length);
                } else {
                    console.warn('[Upload] Warning: No valid rawText to save. Value was:', typeof plainTextValue, plainTextValue);
                }
            }

            onToast({
                type: 'success',
                title: 'Resume parsed successfully',
            });
        } catch (err) {
            setStatus('error');
            setProgress(0);
            const message = err instanceof Error ? err.message : 'Failed to parse resume';
            setError(message);
            onToast({
                type: 'danger',
                title: 'Parse failed',
                description: message,
            });
        }
    }, [file, pastedText, onParseResume, onToast, setOriginalResume, setParsedResumeText]);

    const fileName = file?.name || resumeDocument?.fileName || '';
    const disabled = !file && !pastedText && !resumeDocument?.plainText;

    return (
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
    );
}
