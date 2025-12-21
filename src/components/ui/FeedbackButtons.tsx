import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useFeedbackStore, createVoteKey } from '../../lib/stores/feedbackStore';
import { submitFeedback, type SuggestionType } from '../../services/feedback';

export interface FeedbackButtonsProps {
    suggestionType: SuggestionType;
    sectionIndex?: number;
    sessionId: string;
}

export function FeedbackButtons({
    suggestionType,
    sectionIndex,
    sessionId,
}: FeedbackButtonsProps) {
    const { t, i18n } = useTranslation();
    const { markVoted, hasVoted } = useFeedbackStore();
    const [justVoted, setJustVoted] = useState(false);

    const voteKey = createVoteKey(sessionId, suggestionType, sectionIndex);
    const alreadyVoted = hasVoted(voteKey);
    const showThankYou = alreadyVoted || justVoted;

    const handleVote = (isPositive: boolean) => {
        if (alreadyVoted) return;

        // Mark as voted in store (persisted to sessionStorage)
        markVoted(voteKey);
        setJustVoted(true);

        // Submit feedback to Supabase (fire-and-forget)
        submitFeedback(
            sessionId,
            suggestionType,
            sectionIndex,
            isPositive,
            i18n.language
        );
    };

    if (showThankYou) {
        return (
            <div className="flex items-center gap-2 text-xs text-emerald-400/80">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{t('feedback.thankYou', 'Thanks for your feedback!')}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
                {t('feedback.helpful', 'Was this helpful?')}
            </span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => handleVote(true)}
                    disabled={alreadyVoted}
                    aria-label={t('feedback.thumbsUp', 'Yes, helpful')}
                    className={cn(
                        'p-1.5 rounded-lg transition-all duration-200',
                        'hover:bg-emerald-500/20 hover:scale-110',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                        'text-gray-400 hover:text-emerald-400'
                    )}
                >
                    <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => handleVote(false)}
                    disabled={alreadyVoted}
                    aria-label={t('feedback.thumbsDown', 'Not helpful')}
                    className={cn(
                        'p-1.5 rounded-lg transition-all duration-200',
                        'hover:bg-gray-500/20 hover:scale-110',
                        'focus:outline-none focus:ring-2 focus:ring-gray-500/50',
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                        'text-gray-400 hover:text-gray-300'
                    )}
                >
                    <ThumbsDown className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
