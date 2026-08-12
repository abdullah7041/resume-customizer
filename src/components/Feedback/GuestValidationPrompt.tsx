import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '@/services/analytics';

const storageKeyFor = (jobDescription: string) => {
  let hash = 2166136261;
  for (let index = 0; index < jobDescription.length; index += 1) {
    hash ^= jobDescription.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `watheq:guestValidationShown:${(hash >>> 0).toString(36)}`;
};

interface GuestValidationPromptProps {
  jobDescription: string;
  attempt: number;
  onClose: () => void;
}

export function GuestValidationPrompt({ jobDescription, attempt, onClose }: GuestValidationPromptProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const storageKey = useMemo(() => storageKeyFor(jobDescription.trim()), [jobDescription]);

  useEffect(() => {
    if (!jobDescription.trim() || typeof window === 'undefined') return;
    if (window.localStorage.getItem(storageKey) === 'true') {
      onClose();
      return;
    }

    window.localStorage.setItem(storageKey, 'true');
    analytics.trackGuestValidationPromptShown({ attempt });
    setVisible(true);
  }, [attempt, jobDescription, onClose, storageKey]);

  const answer = (trust: 'yes' | 'somewhat' | 'no') => {
    analytics.trackGuestValidationAnswered({ attempt, trust });
    setVisible(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <aside className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-start" aria-label={t('trust.guestValidation.label', 'Guest validation question')}>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {t('trust.guestValidation.question', 'Did this suggestion feel safe to apply to your real experience?')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => answer('yes')} className="min-h-10 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500">
          {t('trust.guestValidation.yes', 'Yes')}
        </button>
        <button type="button" onClick={() => answer('somewhat')} className="min-h-10 rounded-lg border border-emerald-500/25 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200">
          {t('trust.guestValidation.somewhat', 'Somewhat')}
        </button>
        <button type="button" onClick={() => answer('no')} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10">
          {t('trust.guestValidation.no', 'No')}
        </button>
      </div>
    </aside>
  );
}
