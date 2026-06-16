import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { GlassButton } from '../ui/GlassButton';
import { GlassCard } from '../ui/GlassCard';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '@/lib/utils/cn';
import {
  buildTruthCheckView,
  evidenceStatusLabelKey,
  type TruthCheckGroupKey,
} from '@/lib/utils/truthCheckSummary';
import type { ResumeTruthCheckResult, TruthCheckClaim, TruthCheckSeverity } from '@/types/truth-check';

interface Toast {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
}

interface TruthCheckSectionProps {
  resumeText: string;
  result: ResumeTruthCheckResult | null;
  isAnalyzing: boolean;
  isGuestMode?: boolean;
  onAnalyze: () => Promise<ResumeTruthCheckResult | null> | ResumeTruthCheckResult | null | void;
  onRequireSignIn?: () => void;
  protectedActionMessage?: string;
  onToast?: (toast: Toast) => void;
  onContinue?: () => void;
}

const riskStyles: Record<TruthCheckSeverity, string> = {
  low: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  high: 'border-rose-500/25 bg-rose-500/10 text-rose-900 dark:text-rose-100',
};

function claimKey(claim: TruthCheckClaim, index: number): string {
  return `${claim.section}-${claim.claimText}-${index}`;
}

function ClaimCard({ claim, index }: { claim: TruthCheckClaim; index: number }) {
  const { t } = useTranslation();
  return (
    <article
      key={claimKey(claim, index)}
      className="rounded-xl border border-gray-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold uppercase', riskStyles[claim.severity])}>
          {t(`sections.truthCheck.severity.${claim.severity}`, claim.severity)}
        </span>
        <span dir="auto" className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-emerald-100/70">
          {claim.section}
        </span>
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-emerald-100/70">
          {t(`sections.truthCheck.evidenceStatus.${evidenceStatusLabelKey(claim.evidenceStatus)}`, claim.evidenceStatus)}
        </span>
      </div>
      <blockquote
        dir="auto"
        className="mt-3 rounded-lg border-s-4 border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white"
      >
        {claim.claimText}
      </blockquote>
      <div className="mt-3 flex flex-wrap gap-2">
        {claim.riskTypes.map((risk) => (
          <span key={risk} className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-emerald-100/80">
            {t(`sections.truthCheck.riskTypes.${risk}`, risk)}
          </span>
        ))}
      </div>
      {claim.visibleEvidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase text-gray-500 dark:text-emerald-100/55">
            {t('sections.truthCheck.results.visibleEvidence', 'Visible evidence')}
          </p>
          <ul className="mt-2 space-y-1">
            {claim.visibleEvidence.map((evidence, evidenceIndex) => (
              <li key={`${evidence}-${evidenceIndex}`} dir="auto" className="text-sm text-gray-700 dark:text-emerald-100/80">
                - {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-gray-600 dark:text-emerald-100/75">
          <AlertTriangle className="me-1 inline h-4 w-4 text-amber-500" />
          {claim.whyItMatters}
        </p>
        <p className="text-sm font-semibold text-gray-800 dark:text-white">
          {claim.userAction}
        </p>
      </div>
    </article>
  );
}

export function TruthCheckSection({
  resumeText,
  result,
  isAnalyzing,
  isGuestMode = false,
  onAnalyze,
  onRequireSignIn,
  protectedActionMessage,
  onToast,
  onContinue,
}: TruthCheckSectionProps) {
  const { t } = useTranslation();
  const [openGroups, setOpenGroups] = useState<Set<TruthCheckGroupKey>>(new Set());
  const groupRefs = useRef<Partial<Record<TruthCheckGroupKey, HTMLDetailsElement | null>>>({});

  const view = useMemo(() => (result ? buildTruthCheckView(result) : null), [result]);

  const handleAnalyze = async () => {
    if (isGuestMode) {
      onRequireSignIn?.();
      onToast?.({
        type: 'warning',
        title: t('workspace.guest.protectedActionTitle', 'Sign in required'),
        description: protectedActionMessage,
      });
      return;
    }

    await onAnalyze();
  };

  const handleShowAll = () => {
    if (!view) return;
    setOpenGroups(new Set(view.groups.map((group) => group.key)));
  };

  const openGroup = (key: TruthCheckGroupKey) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    requestAnimationFrame(() => {
      groupRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (!resumeText) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <ShieldQuestion className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('sections.truthCheck.empty.title', 'Upload a resume first')}
          </h3>
          <p className="mx-auto max-w-md text-sm text-gray-600 dark:text-emerald-100/75">
            {t('sections.truthCheck.empty.description', 'Truth Check reviews claims only after resume text is available.')}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <GlassCard className="space-y-5">
        <div className="flex items-start gap-3">
          <GlassCircle size="md" variant="success">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          </GlassCircle>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('sections.truthCheck.title', 'Resume Truth Check')}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-emerald-100/75">
              {t('sections.truthCheck.subtitle', 'Find claims that need clearer evidence before you rely on them.')}
            </p>
          </div>
        </div>

        {result && !isAnalyzing && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-800 dark:text-emerald-100">
            <CheckCircle2 className="me-2 inline h-4 w-4" />
            {t('sections.truthCheck.statusComplete', 'Scan complete')}
          </div>
        )}

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm text-gray-700 dark:text-emerald-50/80">
          {t(
            'sections.truthCheck.truthNote',
            'Watheq does not change your resume here. It only points out what may need proof, clarification, or verification.'
          )}
        </div>

        {result && !isAnalyzing && (
          <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/60">
            {t('sections.truthCheck.noChangesNote', 'Your resume has not been changed.')}
          </p>
        )}

        {result && !isAnalyzing && view && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              {t('sections.truthCheck.summary.title', 'Scan summary')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{view.counts.claimsToReview}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 dark:text-emerald-100/60">
                  {t('sections.truthCheck.summary.claimsToReview', 'Claims to review')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{view.counts.needsEvidence}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 dark:text-emerald-100/60">
                  {t('sections.truthCheck.summary.needsEvidence', 'Points needing clearer evidence')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{view.counts.needsVerification}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 dark:text-emerald-100/60">
                  {t('sections.truthCheck.summary.needsVerification', 'Dates or details to verify')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{view.counts.sectionsScanned}</p>
                <p className="mt-1 text-xs font-medium text-gray-500 dark:text-emerald-100/60">
                  {t('sections.truthCheck.summary.sectionsScanned', 'Sections scanned')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {result && !isAnalyzing && (
            <GlassButton
              type="button"
              variant="prominent"
              onClick={onContinue}
              className="w-full"
            >
              {t('sections.truthCheck.cta.continue', 'Continue to the next step')}
            </GlassButton>
          )}

          {result && !isAnalyzing && view && view.groups.length > 0 && (
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleShowAll}
              className="w-full"
            >
              {t('sections.truthCheck.cta.showAll', 'View all details')}
            </GlassButton>
          )}

          <GlassButton
            type="button"
            variant={result ? 'ghost' : 'prominent'}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            isLoading={isAnalyzing}
            className="w-full"
          >
            <ShieldCheck className={cn('h-4 w-4 me-2', isAnalyzing && 'animate-pulse')} />
            {isAnalyzing
              ? t('sections.truthCheck.running', 'Checking claims...')
              : t('sections.truthCheck.run', 'Run Truth Check')}
          </GlassButton>
        </div>

        <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/60">
          {t('sections.truthCheck.freeNote', 'Free for now.')}
        </p>
      </GlassCard>

      <GlassCard className="space-y-5">
        {!result && !isAnalyzing && (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <ShieldQuestion className="h-12 w-12 text-gray-400 dark:text-emerald-100/45" />
            <h4 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
              {t('sections.truthCheck.results.emptyTitle', 'Ready to review claims')}
            </h4>
            <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-emerald-100/65">
              {t('sections.truthCheck.results.emptyDescription', 'Run Truth Check to see unsupported, inflated, vague, unverifiable, or inconsistent claims.')}
            </p>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <ShieldCheck className="h-12 w-12 animate-pulse text-emerald-600 dark:text-emerald-300" />
            <h4 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
              {t('sections.truthCheck.results.loadingTitle', 'Reviewing visible evidence')}
            </h4>
            <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-emerald-100/65">
              {t('sections.truthCheck.results.loadingDescription', 'The AI is checking claims against your resume text only.')}
            </p>
          </div>
        )}

        {result && !isAnalyzing && view && (
          <>
            {view.isEmpty ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                <CheckCircle2 className="me-2 inline h-4 w-4" />
                {t('sections.truthCheck.results.emptyResult', 'No clear claims need review right now.')}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t('sections.truthCheck.priorities.title', 'Top items to review')}
                  </h4>
                  <div className="space-y-3">
                    {view.priorities.map((claim, index) => (
                      <div
                        key={claimKey(claim, index)}
                        className={cn('rounded-xl border p-4', riskStyles[claim.severity])}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-bold uppercase">
                            {t(`sections.truthCheck.severity.${claim.severity}`, claim.severity)}
                          </span>
                          <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">
                            {t(`sections.truthCheck.evidenceStatus.${evidenceStatusLabelKey(claim.evidenceStatus)}`, claim.evidenceStatus)}
                          </span>
                        </div>
                        <p dir="auto" className="mt-2 text-sm font-semibold leading-relaxed">
                          {claim.claimText}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed">
                          <AlertTriangle className="me-1 inline h-4 w-4" />
                          {claim.whyItMatters}
                        </p>
                        {claim.visibleEvidence.length > 0 && (
                          <p dir="auto" className="mt-2 text-sm leading-relaxed opacity-90">
                            - {claim.visibleEvidence[0]}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => openGroup(resolveClaimGroup(view.groups, claim))}
                          className="mt-3 text-sm font-bold underline underline-offset-2"
                        >
                          {t('sections.truthCheck.priorities.reviewCta', 'Review details')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {t('sections.truthCheck.details.title', 'Scan details')}
                  </h4>
                  <div className="space-y-2">
                    {view.groups.map((group) => (
                      <details
                        key={group.key}
                        ref={(node) => {
                          groupRefs.current[group.key] = node;
                        }}
                        open={openGroups.has(group.key)}
                        onToggle={(event) => {
                          const isOpen = event.currentTarget.open;
                          setOpenGroups((prev) => {
                            const next = new Set(prev);
                            if (isOpen) {
                              next.add(group.key);
                            } else {
                              next.delete(group.key);
                            }
                            return next;
                          });
                        }}
                        className="rounded-xl border border-gray-200 bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
                      >
                        <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-white">
                          {t(`sections.truthCheck.groups.${group.key}`, group.key)} ({group.claims.length})
                        </summary>
                        <div className="mt-3 space-y-3">
                          {group.claims.map((claim, index) => (
                            <ClaimCard key={claimKey(claim, index)} claim={claim} index={index} />
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </>
            )}

            {result.limits.cannotVerify.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('sections.truthCheck.results.limits', 'What Watheq cannot verify')}
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-emerald-100/70">
                  {result.limits.cannotVerify.map((item, index) => (
                    <li key={`${item}-${index}`} dir="auto">- {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}

function resolveClaimGroup(
  groups: ReturnType<typeof buildTruthCheckView>['groups'],
  claim: TruthCheckClaim
): TruthCheckGroupKey {
  const match = groups.find((group) => group.claims.includes(claim));
  return match?.key ?? 'other';
}

export default TruthCheckSection;
