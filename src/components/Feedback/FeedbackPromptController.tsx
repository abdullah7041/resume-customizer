import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useExitPresence } from '@/hooks/useExitPresence';

const FeedbackModal = lazy(() => import('./FeedbackModal').then((module) => ({ default: module.FeedbackModal })));

export const FEEDBACK_PROMPTED_SESSION_KEY = 'watheq:feedbackPromptedThisSession';
const FEEDBACK_VALUE_MOMENT_EVENT = 'watheq:feedbackValueMoment';

export type FeedbackValueMoment =
  | 'match_success'
  | 'optimize_success'
  | 'export_success'
  | 'pipeline_save';

interface FeedbackValueMomentDetail {
  moment: FeedbackValueMoment;
}

export function requestValueMomentFeedbackPrompt(moment: FeedbackValueMoment) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<FeedbackValueMomentDetail>(FEEDBACK_VALUE_MOMENT_EVENT, {
      detail: { moment },
    })
  );
}

function hasSessionPrompted() {
  if (typeof window === 'undefined') return true;

  try {
    return window.sessionStorage.getItem(FEEDBACK_PROMPTED_SESSION_KEY) === 'true';
  } catch (error) {
    console.warn('[FeedbackPromptController] Failed to read session prompt state:', error);
    return false;
  }
}

function markSessionPrompted() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(FEEDBACK_PROMPTED_SESSION_KEY, 'true');
  } catch (error) {
    console.warn('[FeedbackPromptController] Failed to persist session prompt state:', error);
  }
}

export function FeedbackPromptController() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const modalPresence = useExitPresence(isOpen);
  const promptedInMemoryRef = useRef(false);

  const handleValueMoment = useCallback(() => {
    if (!user || promptedInMemoryRef.current || hasSessionPrompted()) return;

    promptedInMemoryRef.current = true;
    markSessionPrompted();
    setIsOpen(true);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.addEventListener(FEEDBACK_VALUE_MOMENT_EVENT, handleValueMoment);
    return () => window.removeEventListener(FEEDBACK_VALUE_MOMENT_EVENT, handleValueMoment);
  }, [handleValueMoment]);

  if (!modalPresence.shouldRender) return null;

  return (
    <Suspense fallback={null}>
      <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </Suspense>
  );
}
