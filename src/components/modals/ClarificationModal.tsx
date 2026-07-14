/**
 * ClarificationModal
 *
 * Pre-optimization interrogation modal that collects targeted answers
 * from the user to enrich the AI optimization context.
 *
 * Features:
 * - 1–3 question cards with single- or multi-select options
 * - Exclusive hard-stop choices plus an optional Other free-text field
 * - Client-side gibberish guard for Other text only
 * - Skip button with recommendation nudge
 * - Re-generate trigger support (controlled by parent)
 * - Bilingual: renders in whatever language the questions came from
 * - Portal overlay, slide-up animation, keyboard support (Escape = skip)
 */

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import {
  OTHER_OPTION_VALUE,
  isValidOtherAnswer,
  normalizeClarificationQuestion,
  type ClarificationAnswers,
  type ClarificationOption,
  type ClarificationQuestion,
} from '@/lib/clarifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ClarificationQuestion } from '@/lib/clarifications';

interface ClarificationModalProps {
  questions: ClarificationQuestion[];
  isOpen: boolean;
  isRegenerating?: boolean;
  onSubmit: (answers: ClarificationAnswers) => void;
  onSkip: () => void;
  onRegenerate?: () => void;
}

// ---------------------------------------------------------------------------
// Gibberish guard — client-side validation
// ---------------------------------------------------------------------------

/**
 * Returns true only if the answer contains ≥3 real words (2+ letters each).
 * Accepts answers in any language/script via the Unicode property escape.
 */
function emptyAnswer() {
  return { selectedValues: [], otherText: '' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClarificationModal({
  questions,
  isOpen,
  isRegenerating = false,
  onSubmit,
  onSkip,
  onRegenerate,
}: ClarificationModalProps) {
  const { t } = useTranslation();
  const normalizedQuestions = useMemo(
    () => questions.map(question => normalizeClarificationQuestion(
      question,
      t('clarificationModal.hardStopFallback', "I don't have this / I never do this"),
    )),
    [questions, t],
  );
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const firstRef = useRef<HTMLButtonElement>(null);

  // Inject slideUp keyframe once on mount (avoids global CSS dependency)
  useEffect(() => {
    const STYLE_ID = 'clarification-modal-keyframes';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`;
      document.head.appendChild(style);
    }
  }, []);

  // Reset state when questions change
  useEffect(() => {
    if (isOpen) {
      setAnswers(Object.fromEntries(normalizedQuestions.map(question => [
        question.id,
        question.defaultValue && question.options.some(option => option.value === question.defaultValue)
          ? { selectedValues: [question.defaultValue], otherText: '' }
          : emptyAnswer(),
      ])));
      setTouched({});
      // Focus first textarea after animation settles
      const t = setTimeout(() => firstRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, normalizedQuestions]);

  // Keyboard handler: Escape skips the modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onSkip]);

  const handleOptionToggle = useCallback((question: ClarificationQuestion, option: ClarificationOption) => {
    setAnswers(previous => {
      const current = previous[question.id] ?? emptyAnswer();
      const isSelected = current.selectedValues.includes(option.value);
      const hardStopValues = question.options.reduce((acc, item) => {
        if (item.isHardStop) acc.add(item.value);
        return acc;
      }, new Set<string>());
      let selectedValues: string[];

      if (option.isHardStop) {
        selectedValues = isSelected ? [] : [option.value];
      } else if (question.type === 'single') {
        selectedValues = isSelected ? [] : [option.value];
      } else {
        const withoutHardStops = current.selectedValues.filter(value => !hardStopValues.has(value));
        selectedValues = isSelected
          ? withoutHardStops.filter(value => value !== option.value)
          : [...withoutHardStops, option.value];
      }

      return {
        ...previous,
        [question.id]: {
          selectedValues,
          otherText: selectedValues.includes(OTHER_OPTION_VALUE) ? current.otherText : '',
        },
      };
    });
  }, []);

  const handleOtherChange = useCallback((id: string, value: string) => {
    setAnswers(previous => ({
      ...previous,
      [id]: { ...(previous[id] ?? emptyAnswer()), otherText: value },
    }));
  }, []);

  const handleBlur = useCallback((id: string) => {
    setTouched(prev => ({ ...prev, [id]: true }));
  }, []);

  const handleSubmit = useCallback(() => {
    const validAnswers = Object.fromEntries(normalizedQuestions.flatMap(question => {
      const answer = answers[question.id] ?? emptyAnswer();
      const selectedValues = answer.selectedValues.filter(value => (
        value !== OTHER_OPTION_VALUE || isValidOtherAnswer(answer.otherText)
      ));
      if (selectedValues.length === 0) return [];
      return [[question.id, {
        selectedValues,
        otherText: selectedValues.includes(OTHER_OPTION_VALUE) ? answer.otherText.trim() : '',
      }]];
    }));
    onSubmit(validAnswers);
  }, [answers, normalizedQuestions, onSubmit]);

  // At least one valid answer required to enable submit
  const hasAnyValidAnswer = normalizedQuestions.some(question => {
    const answer = answers[question.id] ?? emptyAnswer();
    return answer.selectedValues.some(value => (
      value !== OTHER_OPTION_VALUE || isValidOtherAnswer(answer.otherText)
    ));
  });

  if (!isOpen || questions.length === 0) return null;

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md"
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Modal panel — slide up animation */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarify-modal-title"
        className={cn(
          glass.elevated,
          'relative rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto',
          'animate-[slideUp_0.22s_ease-out]'
        )}
        style={{ animationFillMode: 'both' }}
      >
        {/* ---- Header ---- */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2
                id="clarify-modal-title"
                className="text-base font-semibold text-gray-900 dark:text-white leading-tight"
              >
                {t('clarificationModal.title', 'Quick questions to sharpen your results')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {questions.length} {questions.length !== 1 ? t('clarificationModal.questions', 'questions') : t('clarificationModal.question', 'question')} · {t('clarificationModal.duration', '~1 min')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                title="Re-generate questions"
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                  'hover:bg-white/10',
                  isRegenerating && 'opacity-50 cursor-not-allowed'
                )}
                aria-label="Re-generate clarification questions"
              >
                <RefreshCw className={cn('w-4 h-4', isRegenerating && 'animate-spin')} />
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/10 transition-colors"
              aria-label="Skip and proceed without answers"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ---- Question cards ---- */}
        <div className="p-6 space-y-5">
          {normalizedQuestions.map((q, idx) => {
            const answer = answers[q.id] ?? emptyAnswer();
            const selectedValueSet = new Set(answer.selectedValues);
            const otherSelected = selectedValueSet.has(OTHER_OPTION_VALUE);
            const isInvalid = touched[q.id] && otherSelected && answer.otherText.trim().length > 0 && !isValidOtherAnswer(answer.otherText);

            return (
              <div
                key={q.id}
                className={cn(
                  glass.card,
                  'p-4 rounded-xl space-y-3 transition-colors duration-200',
                  'border border-white/5 hover:border-emerald-500/20'
                )}
              >
                {/* Theme badge + rationale */}
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                      {q.theme}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {q.rationale}
                    </p>
                  </div>
                </div>

                {/* Question */}
                <p className="text-sm text-gray-700 dark:text-gray-200 font-medium pl-4 border-l-2 border-emerald-500/40">
                  {q.question}
                </p>

                <div className="space-y-2" role="group" aria-label={q.question}>
                  {[...q.options.filter(option => !option.isHardStop), ...(q.allowOther ? [{ value: OTHER_OPTION_VALUE, label: t('clarificationModal.otherOption', 'Other') }] : []), ...q.options.filter(option => option.isHardStop)].map((option, optionIndex) => {
                    const selected = selectedValueSet.has(option.value);
                    return (
                      <button
                        key={option.value}
                        ref={idx === 0 && optionIndex === 0 ? firstRef : undefined}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleOptionToggle(q, option)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2.5 text-start text-sm transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
                          selected
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                            : 'border-gray-300 bg-gray-100/40 text-gray-800 hover:border-emerald-500/30 dark:border-white/10 dark:bg-white/5 dark:text-gray-200',
                          option.isHardStop && 'mt-3 border-amber-500/30 text-amber-800 dark:text-amber-200',
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}

                  {otherSelected && (
                    <input
                      id={`clarify-other-${q.id}`}
                      value={answer.otherText}
                      onChange={event => handleOtherChange(q.id, event.target.value)}
                      onBlur={() => handleBlur(q.id)}
                      aria-label={t('clarificationModal.otherInputLabel', 'Other answer')}
                      placeholder={t('clarificationModal.otherPlaceholder', 'Add a short, verifiable answer…')}
                      className={cn(
                        'w-full rounded-lg border bg-gray-100/50 px-3 py-2.5 text-sm text-gray-900 dark:bg-white/5 dark:text-white',
                        'focus:outline-none focus:ring-2',
                        isInvalid ? 'border-red-500/40 focus:ring-red-500/30' : 'border-gray-300 dark:border-white/10 focus:ring-emerald-500/40',
                      )}
                    />
                  )}
                  {/* Validation hint */}
                  {isInvalid && (
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {t('clarificationModal.validationHint', 'Please provide a meaningful answer or choose another option')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Footer ---- */}
        <div className="px-6 pb-6 space-y-3">
          {/* Recommendation nudge (shown always) */}
          <p className="text-center text-xs text-amber-400/80 dark:text-amber-300/70">
            💡 {t('clarificationModal.nudge', 'Answering these questions helps the AI generate more targeted improvements')}
          </p>

          <div className="flex gap-3">
            <GlassButton
              variant="secondary"
              onClick={onSkip}
              className="flex-1"
              id="clarify-skip-btn"
            >
              {t('clarificationModal.skipBtn', 'Skip for now')}
            </GlassButton>

            <GlassButton
              variant="primary"
              onClick={handleSubmit}
              disabled={!hasAnyValidAnswer}
              className="flex-1 gap-1.5"
              id="clarify-submit-btn"
            >
              {t('clarificationModal.submitBtn', 'Submit Answers')}
              <ChevronRight className="w-4 h-4" />
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ---------------------------------------------------------------------------
// Keyframe animation (inject once via <style> on first render)
// ---------------------------------------------------------------------------
// Uses inline @keyframes to avoid global CSS dependency.
// The animation class is `animate-[slideUp_0.22s_ease-out]` (Tailwind arbitrary).
