// src/components/onboarding/OnboardingChat.tsx
// Mobile conversational onboarding. One slot at a time, large tap targets, a Skip on
// every slot, progress dots, plain text input (the OS keyboard mic supplies voice).
// Each answer calls onboard-extract, patches the store through the single writer, and
// advances the pure state machine.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingPath, OnboardingSlot, SearchIntent, SlotConfidence } from '@/types/onboarding';
import type { Basics } from '@/types/resume';
import { advance, initialState, progress, terminalAction } from '@/lib/onboarding/flow';
import { onboardExtract } from '@/services/api';
import { useResumeStore } from '@/lib/stores/resumeStore';

interface OnboardingChatProps {
  /** has_cv when a resume was already parsed; no_cv to build a starter CV from answers. */
  path?: OnboardingPath;
  /**
   * 'fullscreen' (default) = first-run gate screen, starts at cv_basics.
   * 'inline' = compact post-upload panel; cv_basics is already known from parse, so it
   * starts at the role slot and renders nothing once done (parent unmounts it).
   */
  mode?: 'fullscreen' | 'inline';
  /** Called once the machine reaches done. */
  onComplete?: () => void;
  /** Inline only: user dismissed the whole panel ("Not now"). */
  onDismiss?: () => void;
}

interface SlotCopy {
  title: string;
  hint: string;
  placeholder: string;
}

const SLOT_COPY: Record<OnboardingPath, Record<OnboardingSlot, SlotCopy>> = {
  has_cv: {
    cv_basics: { title: 'Is this you?', hint: 'Confirm or fix your name and title.', placeholder: 'Name — Job title' },
    role: { title: 'What role are you targeting?', hint: 'One target is enough.', placeholder: 'e.g. Senior Frontend Engineer' },
  },
  no_cv: {
    cv_basics: { title: "Let's start with you", hint: 'Your name and one or two things you have done.', placeholder: 'e.g. Sara Al-Otaibi — built a payments dashboard, led a 3-person team' },
    role: { title: 'What role are you targeting?', hint: 'One target is enough.', placeholder: 'e.g. Product Designer' },
  },
};

function emptyIntent(confidence: SlotConfidence): SearchIntent {
  return { targetRoles: [], meta: { confidence, completeness: 0, updatedAt: new Date().toISOString() } };
}

export default function OnboardingChat({ path: pathProp, mode = 'fullscreen', onComplete, onDismiss }: OnboardingChatProps) {
  const inline = mode === 'inline';
  const originalResume = useResumeStore((s) => s.originalResume);
  const storedIntent = useResumeStore((s) => s.searchIntent);
  const setSearchIntent = useResumeStore((s) => s.setSearchIntent);
  const patchProfile = useResumeStore((s) => s.patchProfile);
  const getProfileCompleteness = useResumeStore((s) => s.getProfileCompleteness);

  // Infer path from existing resume data when not given explicitly.
  const path: OnboardingPath = pathProp ?? (originalResume?.basics?.name ? 'has_cv' : 'no_cv');
  const baseConfidence: SlotConfidence = path === 'no_cv' ? 'low' : 'medium';

  // Inline (Path A) skips cv_basics — name/title already came from parse-resume — so
  // pre-mark it answered and start at role.
  const [machine, setMachine] = useState(() =>
    inline ? advance(initialState(path), 'cv_basics') : initialState(path),
  );
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Working copy of the intent, held in a ref (not state) so committing it writes to
  // the store synchronously in the event handler. Doing the store write inside a
  // setState updater silently dropped the final slot: on the last answer the panel
  // unmounts in the same tick, so the updater's side effect never flushed.
  const intentRef = useRef<SearchIntent>(storedIntent ?? emptyIntent(baseConfidence));

  const current = machine.current;
  const copy = current !== 'done' ? SLOT_COPY[path][current] : null;
  const { answered, total } = progress(machine);

  // Prefill the cv_basics field on Path A so the user only edits.
  const prefill = useMemo(() => {
    if (current === 'cv_basics' && path === 'has_cv' && originalResume?.basics) {
      const { name, label } = originalResume.basics;
      return [name, label].filter(Boolean).join(' — ');
    }
    return '';
  }, [current, path, originalResume]);

  // Seed the input with the prefill when the slot changes (empty for non-prefilled
  // slots, which also clears leftover text between questions).
  useEffect(() => {
    setText(prefill);
  }, [current, prefill]);

  const commitIntent = useCallback(
    (partial: Partial<SearchIntent>) => {
      const prev = intentRef.current;
      const next: SearchIntent = { ...prev, ...partial, meta: { ...prev.meta, confidence: baseConfidence } };
      intentRef.current = next;
      setSearchIntent(next);
    },
    [baseConfidence, setSearchIntent],
  );

  const goNext = useCallback(
    (slot: OnboardingSlot) => {
      setText('');
      setError(null);
      const nextMachine = advance(machine, slot);
      setMachine(nextMachine);
      if (nextMachine.current === 'done') {
        // Path B: the starter CV is already assembled in the store via patchProfile.
        // Nothing more to fabricate — just finish. terminalAction documents the branch.
        void terminalAction(path);
        onComplete?.();
      }
    },
    [machine, onComplete, path],
  );

  // Apply a normalized slot value (from onboard-extract or a chip) to the right target.
  const applySlotValue = useCallback(
    (slot: OnboardingSlot, value: Record<string, unknown>) => {
      if (slot === 'cv_basics') {
        const name = typeof value.name === 'string' ? value.name : '';
        const label = typeof value.label === 'string' ? value.label : '';
        const achievements = Array.isArray(value.achievements) ? (value.achievements as string[]) : [];
        const basics: Partial<Basics> = {};
        if (name) basics.name = name;
        if (label) basics.label = label;
        // Starter-CV: seed the summary from the 1-2 achievements so Path B reaches a
        // minimum viable profile (name + role + 1 achievement) without a work entry.
        if (achievements.length) basics.summary = achievements.join('. ');
        // mergeProfilePatch only reads the fields present here; cast past the
        // PartialResumeSchema intersection that types basics as fully-required.
        if (Object.keys(basics).length) patchProfile({ basics: basics as Basics });
        return;
      }
      if (slot === 'role') {
        const roles = Array.isArray(value.targetRoles) ? (value.targetRoles as string[]) : [];
        const seniority = value.seniority as SearchIntent['seniority'] | undefined;
        commitIntent({ targetRoles: roles, ...(seniority ? { seniority } : {}) });
      }
    },
    [commitIntent, patchProfile],
  );

  const submitText = useCallback(async () => {
    if (current === 'done') return;
    const userText = (text || prefill).trim();
    if (!userText) return;

    setBusy(true);
    setError(null);
    try {
      const { value } = await onboardExtract({ slot: current, userText, currentIntent: intentRef.current });
      applySlotValue(current, value);
      goNext(current);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read that. Try rephrasing.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [applySlotValue, current, goNext, prefill, text]);

  const skip = useCallback(() => {
    if (current === 'done') return;
    goNext(current);
  }, [current, goNext]);

  if (current === 'done') {
    // Inline: nothing to show — the parent unmounts the panel on complete.
    if (inline) return null;
    const completeness = getProfileCompleteness();
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">You&apos;re set</div>
        <div className="w-full">
          <div className="mb-1 flex justify-between text-sm text-gray-600 dark:text-emerald-100/70">
            <span>Profile completeness</span>
            <span>{completeness}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-emerald-300/25">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${completeness}%` }} />
          </div>
        </div>
        {path === 'no_cv' && (
          <p className="text-sm text-gray-600 dark:text-emerald-100/70">
            This is a starter profile. Add one more thing — a project or a metric — to make it stronger.
          </p>
        )}
        <button
          type="button"
          onClick={() => onComplete?.()}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.96] dark:bg-emerald-500 dark:text-emerald-950"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        inline
          ? 'flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-white/90 p-4 text-gray-900 dark:bg-emerald-950/45 dark:text-emerald-50'
          : 'mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border border-emerald-500/25 bg-white/95 p-6 text-gray-900 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl sm:p-7 dark:border-emerald-400/25 dark:bg-[#061713]/95 dark:text-emerald-50 dark:shadow-black/45'
      }
    >
      {/* Inline header: what this is, what happens to the answer, + a dismiss affordance. */}
      {inline && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Set your target role
            </p>
            <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
              This sharpens your match score and optimized rewrites. Saved to your profile — you can change it anytime. Skipping is fine.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss?.()}
            disabled={busy}
            className="shrink-0 text-sm text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline disabled:opacity-50 dark:text-emerald-100/70 dark:hover:text-emerald-50"
          >
            Not now
          </button>
        </div>
      )}
      {!inline && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-50">
          This sets your target. Next you will upload or paste your resume, then paste a job ad to optimize.
        </p>
      )}

      {/* Progress dots — a one-of-one indicator inline is noise, since Path A skips cv_basics. */}
      {!inline && (
        <div className="flex items-center justify-center gap-2" aria-label={`Step ${answered + 1} of ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-[width,background-color] ${i < answered ? 'w-6 bg-emerald-500' : i === answered ? 'w-6 bg-emerald-400 dark:bg-emerald-300' : 'w-2 bg-gray-300 dark:bg-emerald-300/25'}`}
            />
          ))}
        </div>
      )}

      <div className={inline ? 'text-start' : 'text-center'}>
        <h2 className={inline ? 'text-lg font-bold text-gray-900 dark:text-emerald-50' : 'text-xl font-bold text-gray-900 dark:text-white'}>{copy?.title}</h2>
        <p className={inline ? 'mt-1 text-sm text-gray-600 dark:text-emerald-100/70' : 'mt-1 text-sm font-medium text-emerald-800/80 dark:text-emerald-100/80'}>{copy?.hint}</p>
      </div>

      {/* Plain text input — keyboard mic supplies voice */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={copy?.placeholder}
        rows={3}
        disabled={busy}
        className="w-full resize-none rounded-xl border border-gray-300 bg-white p-4 text-base text-gray-900 placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-emerald-400/30 dark:bg-emerald-950/55 dark:text-emerald-50 dark:placeholder:text-emerald-100/45"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submitText();
          }
        }}
      />

      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={skip}
          disabled={busy}
          className="rounded-xl px-4 py-3 text-base font-medium text-gray-500 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50 dark:text-emerald-100/70"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => void submitText()}
          disabled={busy}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950"
        >
          {busy ? 'Reading…' : 'Next'}
        </button>
      </div>
    </div>
  );
}
