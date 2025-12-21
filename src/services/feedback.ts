import { supabase } from './supabase.js';

export type SuggestionType = 'summary' | 'experience' | 'skills' | 'keywords';

/**
 * Submit anonymous feedback for an AI suggestion.
 * Fire-and-forget — does not block UI and fails silently.
 */
export function submitFeedback(
    sessionId: string,
    suggestionType: SuggestionType,
    sectionIndex: number | undefined,
    isPositive: boolean,
    locale: string
): void {
    // Fire and forget - use async IIFE to handle both .then and .catch
    (async () => {
        try {
            const { error } = await supabase
                .from('ai_feedback')
                .insert({
                    session_id: sessionId,
                    suggestion_type: suggestionType,
                    section_index: sectionIndex ?? null,
                    is_positive: isPositive,
                    locale: locale,
                    created_at: new Date().toISOString(),
                });

            if (error && import.meta.env.DEV) {
                console.warn('[Feedback] Failed to submit:', error.message);
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.warn('[Feedback] Error:', err);
            }
        }
    })();
}
