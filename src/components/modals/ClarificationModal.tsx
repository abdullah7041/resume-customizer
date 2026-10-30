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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, ChevronRight, RefreshCw, AlertCircle, Check } from 'lucide-react';
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
  error?: string | null;
  onSubmit: (answers: ClarificationAnswers) => void;
  onSkip: () => void;
  onRegenerate?: () => void;
  onOptimizeNow?: (answers: ClarificationAnswers) => void;
  initialAnswers?: ClarificationAnswers;
  round?: number;
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
  error,
  onSubmit,
  onSkip,
  onRegenerate,
  onOptimizeNow,
  initialAnswers,
  round = 1,
}: ClarificationModalProps) {
  const { t } = useTranslation();
  const hardStopFallback = t('clarificationModal.hardStopFallback', "I don't have this / I never do this");
  const normalizedQuestions = useMemo(
    () => questions.map(question => normalizeClarificationQuestion(
      question,
      hardStopFallback,
    )),
    [questions, hardStopFallback],
  );
  const [answers, setAnswers] = useState<ClarificationAnswers>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [confirmExit, setConfirmExit] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  const keepAnsweringRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastQuestionFocusRef = useRef<HTMLElement | null>(null);
  const savedScrollTopRef = useRef(0);
  const restoreQuestionFocusRef = useRef(false);
  const optimizeInvokedRef = useRef(false);
  const initialFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Initialize each round before it becomes interactive, so reset cannot erase an early answer.
  useLayoutEffect(() => {
    if (isOpen) {
      setAnswers(Object.fromEntries(normalizedQuestions.map(question => [
        question.id,
        initialAnswers?.[question.id] ?? emptyAnswer(),
      ])));
      setTouched({});
      setConfirmExit(false);
      optimizeInvokedRef.current = false;
      lastQuestionFocusRef.current = null;
      // Focus first textarea after animation settles
      initialFocusTimerRef.current = setTimeout(() => firstRef.current?.focus(), 80);
      return () => {
        if (initialFocusTimerRef.current) clearTimeout(initialFocusTimerRef.current);
      };
    }
  }, [isOpen, normalizedQuestions, initialAnswers]);

  const requestExit = useCallback(() => {
    if (isRegenerating || confirmExit) return;
    if (initialFocusTimerRef.current) clearTimeout(initialFocusTimerRef.current);
    savedScrollTopRef.current = panelRef.current?.scrollTop ?? 0;
    restoreQuestionFocusRef.current = true;
    setConfirmExit(true);
  }, [confirmExit, isRegenerating]);

  useLayoutEffect(() => {
    if (confirmExit) {
      keepAnsweringRef.current?.focus();
      return;
    }

    if (restoreQuestionFocusRef.current) {
      restoreQuestionFocusRef.current = false;
      if (panelRef.current) panelRef.current.scrollTop = savedScrollTopRef.current;
      const focusTarget = lastQuestionFocusRef.current;
      if (focusTarget?.isConnected) focusTarget.focus();
      else firstRef.current?.focus();
    }
  }, [confirmExit]);

  // Escape opens the same explicit exit choice as the close button.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRegenerating) requestExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, requestExit, isRegenerating]);

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

  const collectAnswers = useCallback(() => {
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
    return validAnswers;
  }, [answers, normalizedQuestions]);

  const handleOptimizeNow = useCallback(() => {
    if (isRegenerating || optimizeInvokedRef.current) return;
    optimizeInvokedRef.current = true;
    if (onOptimizeNow) onOptimizeNow(collectAnswers());
    else onSkip();
  }, [collectAnswers, isRegenerating, onOptimizeNow, onSkip]);

  const keepAnswering = useCallback(() => {
    if (isRegenerating) return;
    setConfirmExit(false);
  }, [isRegenerating]);

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
        onClick={isRegenerating ? undefined : requestExit}
        aria-hidden="true"
      />

      {/* Modal panel — slide up animation */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarify-modal-title"
        ref={panelRef}
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
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2
                id="clarify-modal-title"
                className="text-base font-semibold text-gray-900 dark:text-white leading-tight"
              >
                {t('clarificationModal.title', 'Quick questions to sharpen your results')}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex min-h-7 items-center rounded-full border border-emerald-600/30 bg-emerald-500/15 px-2.5 text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {t('clarificationModal.round', 'Round')} {round} / 3
                </span>
                <span aria-hidden="true">·</span>
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
                title={t('clarificationModal.regenerate', 'Generate different questions')}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                  'hover:bg-white/10',
                  isRegenerating && 'opacity-50 cursor-not-allowed'
                )}
                aria-label={t('clarificationModal.regenerate', 'Generate different questions')}
              >
                <RefreshCw className={cn('w-4 h-4', isRegenerating && 'animate-spin')} />
              </button>
            )}
            <button
              type="button"
              onClick={requestExit}
              disabled={isRegenerating}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/10 transition-colors"
              aria-label={t('clarificationModal.close', 'Skip and proceed without answers')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-50/80 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        {/* ---- Question cards ---- */}
        <div
          onFocusCapture={event => {
            if (event.target instanceof HTMLElement) lastQuestionFocusRef.current = event.target;
          }}
          hidden={confirmExit}
          className="p-6 space-y-5"
        >
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
                  <span
                    role="img"
                    aria-label={`${t('clarificationModal.question', 'Question')} ${idx + 1}`}
                    className="mt-0.5 inline-flex size-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-600/30 bg-emerald-500/15 text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200"
                  >
                    {idx + 1}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {q.type === 'multi' ? t('clarificationModal.selectMany', 'Select all that apply') : t('clarificationModal.selectOne', 'Select one')}
                  </p>
                  {[...q.options.filter(option => !option.isHardStop), ...(q.allowOther ? [{ value: OTHER_OPTION_VALUE, label: t('clarificationModal.otherOption', 'Other') }] : []), ...q.options.filter(option => option.isHardStop)].map((option, optionIndex) => {
                    const selected = selectedValueSet.has(option.value);
                    return (
                      <button
                        key={option.value}
                        ref={idx === 0 && optionIndex === 0 ? firstRef : undefined}
                        type="button"
                        disabled={isRegenerating}
                        aria-pressed={selected}
                        onClick={() => handleOptionToggle(q, option)}
                        className={cn(
                          'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-start text-sm transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
                          option.isHardStop
                            ? selected
                              ? 'mt-3 border-amber-600 bg-amber-400/25 font-semibold text-amber-950 ring-1 ring-amber-500/40 dark:text-amber-100'
                              : 'mt-3 border-amber-500/40 bg-amber-50/50 text-amber-900 hover:border-amber-600/60 dark:bg-amber-500/5 dark:text-amber-200'
                            : selected
                              ? 'border-emerald-600 bg-emerald-500/20 font-semibold text-emerald-950 ring-1 ring-emerald-600/40 dark:text-emerald-100'
                              : 'border-gray-300 bg-gray-100/40 text-gray-800 hover:border-emerald-500/50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200',
                        )}
                      >
                        <span>{option.label}</span>
                        {selected && <Check aria-hidden="true" className="size-4 flex-shrink-0" />}
                      </button>
                    );
                  })}

                  {otherSelected && (
                    <input
                      id={`clarify-other-${q.id}`}
                      value={answer.otherText}
                      maxLength={1000}
                      disabled={isRegenerating}
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
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-600 dark:text-red-400">
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
          {confirmExit ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/80 p-4 dark:bg-amber-500/10">
              <h3 className="mb-2 text-center text-sm font-semibold text-amber-950 dark:text-amber-100">
                {t('clarificationModal.exitTitle', 'Would you like to keep answering?')}
              </h3>
              <p className="mb-3 text-center text-xs text-amber-900 dark:text-amber-100">
                {t('clarificationModal.exitWarning', 'Your valid answers will be kept. Keep answering, or optimize now with what you have.')}
              </p>
              <div className="flex gap-3">
                <GlassButton
                  ref={keepAnsweringRef}
                  variant="secondary"
                  onClick={keepAnswering}
                  disabled={isRegenerating}
                  className="min-h-11 flex-1"
                >
                  {t('clarificationModal.keepAnswering', 'Keep answering')}
                </GlassButton>
                <GlassButton
                  variant="primary"
                  onClick={handleOptimizeNow}
                  disabled={isRegenerating}
                  className="min-h-11 flex-1"
                >
                  {t('clarificationModal.optimizeNow', 'Optimize now')}
                </GlassButton>
              </div>
            </div>
          ) : (
            <>
              <p className="text-center text-xs text-amber-700/90 dark:text-amber-300/70">
                💡 {t('clarificationModal.nudge', 'Answering these questions helps the AI generate more targeted improvements')}
              </p>

              <div className="flex gap-3">
                <GlassButton
                  variant="secondary"
                  onClick={handleOptimizeNow}
                  disabled={isRegenerating}
                  className="flex-1"
                  id="clarify-skip-btn"
                >
                  {onOptimizeNow ? t('clarificationModal.optimizeNow', 'Optimize now') : t('clarificationModal.skipBtn', 'Skip for now')}
                </GlassButton>

                <GlassButton
                  variant="primary"
                  onClick={() => onSubmit(collectAnswers())}
                  disabled={!hasAnyValidAnswer || isRegenerating}
                  className="flex-1 gap-1.5"
                  id="clarify-submit-btn"
                >
                  {t('clarificationModal.submitBtn', 'Submit Answers')}
                  <ChevronRight className="w-4 h-4" />
                </GlassButton>
              </div>
            </>
          )}
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
