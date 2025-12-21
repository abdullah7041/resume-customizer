import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface FeedbackState {
    votedSuggestions: string[];
    markVoted: (key: string) => void;
    hasVoted: (key: string) => boolean;
}

/**
 * Feedback store with sessionStorage persistence
 * Tracks which suggestions have been voted on to prevent duplicate votes
 */
export const useFeedbackStore = create<FeedbackState>()(
    persist(
        (set, get) => ({
            votedSuggestions: [],

            markVoted: (key: string) => {
                const current = get().votedSuggestions;
                if (!current.includes(key)) {
                    set({ votedSuggestions: [...current, key] });
                }
            },

            hasVoted: (key: string) => {
                return get().votedSuggestions.includes(key);
            },
        }),
        {
            name: 'feedback-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);

/**
 * Generate a unique key for a suggestion vote
 */
export function createVoteKey(
    sessionId: string,
    suggestionType: string,
    sectionIndex?: number
): string {
    return `${sessionId}-${suggestionType}-${sectionIndex ?? 'all'}`;
}
