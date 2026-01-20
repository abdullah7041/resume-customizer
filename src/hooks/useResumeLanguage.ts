// src/hooks/useResumeLanguage.ts
// Hook for detecting and managing resume content language

import { useEffect } from 'react';
import { useResumeStore } from '../lib/stores/resumeStore';
import { detectLanguage } from '../lib/utils/arabicTextUtils';
import type { ContentLanguage } from '../types/templates';

/**
 * Hook that detects the language of resume content and updates the store
 * @returns Current detected language ('en' | 'ar' | 'mixed' | null)
 */
export function useResumeLanguage(): ContentLanguage {
    const parsedResumeText = useResumeStore((state) => state.parsedResumeText);
    const contentLanguage = useResumeStore((state) => state.contentLanguage);
    const setContentLanguage = useResumeStore((state) => state.setContentLanguage);

    useEffect(() => {
        // Only detect language if we have a valid string
        if (!parsedResumeText || typeof parsedResumeText !== 'string') {
            setContentLanguage(null);
            return;
        }

        // Detect language from resume text
        const detected = detectLanguage(parsedResumeText);
        setContentLanguage(detected);
    }, [parsedResumeText, setContentLanguage]);

    return contentLanguage;
}
