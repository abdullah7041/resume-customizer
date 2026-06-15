import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Filter, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { GlassButton } from '../ui/GlassButton';
import { GlassCard } from '../ui/GlassCard';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '@/lib/utils/cn';
import type { ResumeTruthCheckResult, TruthCheckRiskType, TruthCheckSeverity } from '@/types/truth-check';

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
}

const severityOptions: Array<TruthCheckSeverity | 'all'> = ['all', 'high', 'medium', 'low'];
const riskOptions: Array<TruthCheckRiskType | 'all'> = [
  'all',
  'unsupported',
  'inflated',
  'vague',
  'unverifiable',
  'inconsistent',
];

const riskStyles: Record<TruthCheckSeverity, string> = {
  low: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  high: 'border-rose-500/25 bg-rose-500/10 text-rose-900 dark:text-rose-100',
};

export function TruthCheckSection({
  resumeText,
  result,
  isAnalyzing,
  isGuestMode = false,
  onAnalyze,
  onRequireSignIn,
  protectedActionMessage,
  onToast,
}: TruthCheckSectionProps) {
  const { t } = useTranslation();
  const [severityFilter, setSeverityFilter] = useState<TruthCheckSeverity | 'all'>('all');
  const [riskFilter, setRiskFilter] = useState<TruthCheckRiskType | 'all'>('all');

  const filteredClaims = useMemo(() => {
    const claims = result?.claims ?? [];
    return claims.filter((claim) => {
      const severityMatches = severityFilter === 'all' || claim.severity === severityFilter;
      const riskMatches = riskFilter === 'all' || claim.riskTypes.includes(riskFilter);
      return severityMatches && riskMatches;
    });
  }, [result?.claims, riskFilter, severityFilter]);

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

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm text-gray-700 dark:text-emerald-50/80">
          {t(
            'sections.truthCheck.truthNote',
            'Watheq does not change your resume here. It only points out what may need proof, clarification, or verification.'
          )}
        </div>

        <GlassButton
          type="button"
          variant="prominent"
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

        {result && !isAnalyzing && (
          <>
            <div className={cn('rounded-xl border p-4', riskStyles[result.overallRisk])}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold">
                  {t('sections.truthCheck.results.overallRisk', 'Overall claim risk')}
                </h4>
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-bold uppercase">
                  {t(`sections.truthCheck.severity.${result.overallRisk}`, result.overallRisk)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{result.summary}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-gray-600 dark:text-emerald-100/70">
                <span className="inline-flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  {t('sections.truthCheck.filters.severity', 'Severity')}
                </span>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value as TruthCheckSeverity | 'all')}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                >
                  {severityOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(`sections.truthCheck.severity.${option}`, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-gray-600 dark:text-emerald-100/70">
                <span className="inline-flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  {t('sections.truthCheck.filters.type', 'Risk type')}
                </span>
                <select
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value as TruthCheckRiskType | 'all')}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                >
                  {riskOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(`sections.truthCheck.riskTypes.${option}`, option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredClaims.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
                <CheckCircle2 className="me-2 inline h-4 w-4" />
                {t('sections.truthCheck.results.noClaims', 'No claims match the current filters.')}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClaims.map((claim, index) => (
                  <article key={`${claim.claimText}-${index}`} className="rounded-xl border border-gray-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold uppercase', riskStyles[claim.severity])}>
                        {t(`sections.truthCheck.severity.${claim.severity}`, claim.severity)}
                      </span>
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-emerald-100/70">
                        {claim.section}
                      </span>
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-emerald-100/70">
                        {t(`sections.truthCheck.evidenceStatus.${claim.evidenceStatus}`, claim.evidenceStatus)}
                      </span>
                    </div>
                    <blockquote className="mt-3 rounded-lg border-s-4 border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
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
                            <li key={`${evidence}-${evidenceIndex}`} className="text-sm text-gray-700 dark:text-emerald-100/80">
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
                ))}
              </div>
            )}

            {result.limits.cannotVerify.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('sections.truthCheck.results.limits', 'What Watheq cannot verify')}
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-emerald-100/70">
                  {result.limits.cannotVerify.map((item, index) => (
                    <li key={`${item}-${index}`}>- {item}</li>
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

export default TruthCheckSection;
