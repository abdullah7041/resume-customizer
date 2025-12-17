import { useState, useCallback } from 'react';
import UploadCard from '../ui/UploadCard';
import { AppError } from '../../services/supabase.js';

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

interface UploadSectionProps {
    onParseResume: (resumeInput: { file?: File; plainText?: string }) => Promise<any>;
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
        onClear();
    }, [onClear]);

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

            await onParseResume(input);

            setProgress(100);
            setStatus('success');
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
    }, [file, pastedText, onParseResume, onToast]);

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
