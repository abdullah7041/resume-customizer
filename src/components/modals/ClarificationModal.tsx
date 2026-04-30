/**
 * ClarificationModal
 *
 * Pre-optimization interrogation modal that collects targeted answers
 * from the user to enrich the AI optimization context.
 *
 * Features:
 * - 1–3 question cards (theme, rationale, question, textarea)
 * - Client-side gibberish guard: ≥3 real words required per answer
 * - Skip button with recommendation nudge
 * - Re-generate trigger support (controlled by parent)
 * - Bilingual: renders in whatever language the questions came from
 * - Portal overlay, slide-up animation, keyboard support (Escape = skip)
 */

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClarificationQuestion {
  id: string;
  theme: string;
  rationale: string;
  question: string;
}

interface ClarificationModalProps {
  questions: ClarificationQuestion[];
  isOpen: boolean;
  isRegenerating?: boolean;
  onSubmit: (answers: Record<string, string>) => void;
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
function isValidAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  // Match sequences of ≥2 alphabetic chars across any script
  const words = trimmed.match(/\p{L}{2,}/gu) || [];
  return words.length >= 3;
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const firstRef = useRef<HTMLTextAreaElement>(null);

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
      setAnswers({});
      setTouched({});
      // Focus first textarea after animation settles
      const t = setTimeout(() => firstRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, questions]);

  // Keyboard handler: Escape skips the modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onSkip]);

  const handleChange = useCallback((id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleBlur = useCallback((id: string) => {
    setTouched(prev => ({ ...prev, [id]: true }));
  }, []);

  const handleSubmit = useCallback(() => {
    // Only include valid, non-empty answers
    const validAnswers: Record<string, string> = {};
    for (const q of questions) {
      const ans = answers[q.id]?.trim() || '';
      if (ans && isValidAnswer(ans)) {
        validAnswers[q.id] = ans;
      }
    }
    onSubmit(validAnswers);
  }, [answers, questions, onSubmit]);

  // At least one valid answer required to enable submit
  const hasAnyValidAnswer = questions.some(q => isValidAnswer(answers[q.id] || ''));

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
          {questions.map((q, idx) => {
            const answer = answers[q.id] || '';
            const isTouched = touched[q.id];
            const isInvalid = isTouched && answer.trim().length > 0 && !isValidAnswer(answer);

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

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    ref={idx === 0 ? firstRef : undefined}
                    id={`clarify-answer-${q.id}`}
                    value={answer}
                    onChange={e => handleChange(q.id, e.target.value)}
                    onBlur={() => handleBlur(q.id)}
                    placeholder={t('clarificationModal.placeholder', 'Type your answer here… (or leave blank to skip this question)')}
                    rows={3}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-sm resize-none',
                      'bg-gray-100/50 dark:bg-white/5',
                      'border transition-colors duration-200',
                      'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
                      'focus:outline-none focus:ring-2',
                      isInvalid
                        ? 'border-red-500/40 focus:ring-red-500/30'
                        : 'border-gray-300 dark:border-white/10 focus:ring-emerald-500/40 focus:border-emerald-500/40'
                    )}
                  />
                  {/* Validation hint */}
                  {isInvalid && (
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {t('clarificationModal.validationHint', 'Please provide a meaningful answer (or leave blank to skip this question)')}
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
