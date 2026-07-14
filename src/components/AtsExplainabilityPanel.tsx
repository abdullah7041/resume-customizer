import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  Info,
} from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { cn } from '../lib/utils/cn';
import { analytics } from '../services/analytics';
import { deriveAtsExplainability } from '../lib/utils/deriveAtsExplainability';
import type {
  AtsExplainabilitySource,
  ExplainabilityKeyword,
} from '../types/explainability';
import type { RealityCheckEvidence } from '../types/analysis';

interface AtsExplainabilityPanelProps {
  source: AtsExplainabilitySource;
  context: 'match' | 'optimize';
  className?: string;
}

function SourceBadge({ source }: { source: RealityCheckEvidence['source'] }) {
  const { t } = useTranslation();
  return (
    <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded bg-white/10 text-gray-300 border border-white/10">
      {t(`sections.explainability.sourceBadge.${source}`)}
    </span>
  );
}

/** A verbatim, source-attributed evidence quote. */
function EvidenceList({ evidence }: { evidence?: RealityCheckEvidence[] }) {
  if (!evidence || evidence.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2">
      {evidence.map((ev) => (
        <li
          key={`${ev.source}-${ev.snippet}`}
          className="ps-3 border-s-2 border-emerald-500/30 text-sm text-gray-300"
        >
          <span className="italic">“{ev.snippet}”</span>
          <div className="mt-1">
            <SourceBadge source={ev.source} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KeywordChips({ keywords }: { keywords: ExplainabilityKeyword[] }) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((kw, i) => (
        <span
          key={`${kw.term}-${i}`}
          className="px-2 py-1 text-xs font-medium rounded bg-white/10 text-gray-200"
        >
          {kw.term}
        </span>
      ))}
    </div>
  );
}

interface BucketProps {
  icon: ReactNode;
  title: string;
  count: number;
  accent: string;
  children: ReactNode;
}

function Bucket({ icon, title, count, accent, children }: BucketProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('rounded-lg border p-4', accent)}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className="ms-auto text-xs text-gray-400">
          {t('sections.explainability.itemCount', { count })}
        </span>
      </div>
      {children}
    </div>
  );
}

export function AtsExplainabilityPanel({
  source,
  context,
  className = '',
}: AtsExplainabilityPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const model = useMemo(() => deriveAtsExplainability(source), [source]);

  if (model.isEmpty) return null;

  const matchedCount = model.matched.keywords.length + model.matched.strengths.length;
  const missingCount = model.missing.keywords.length + model.missing.gaps.length;
  const weakCount = model.weakEvidence.unclear.length + model.weakEvidence.hiddenMatches.length;
  const cautionCount =
    model.caution.risks.length +
    model.caution.assumptions.length +
    model.caution.cannotDetermine.length;

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      analytics.trackExplainabilityPanelOpened({
        context,
        matchedCount,
        missingCount,
        weakCount,
        cautionCount,
        riskTier: source.realityCheck?.riskTier ?? null,
      });
    }
  };

  return (
    <GlassCard className={className}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 text-start"
      >
        <Info className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.explainability.title')}
          </h3>
          <p className="text-sm text-gray-400">
            {t('sections.explainability.subtitle')}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform flex-shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Matched */}
          <Bucket
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            title={t('sections.explainability.buckets.matched.title')}
            count={matchedCount}
            accent="border-emerald-500/20 bg-emerald-500/5"
          >
            {matchedCount === 0 ? (
              <p className="text-sm text-gray-400">
                {t('sections.explainability.buckets.matched.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {model.matched.keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">
                      {t('sections.explainability.buckets.matched.keywords')}
                    </p>
                    <KeywordChips keywords={model.matched.keywords} />
                  </div>
                )}
                {model.matched.strengths.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">
                      {t('sections.explainability.buckets.matched.strengths')}
                    </p>
                    {model.matched.strengths.map((s, i) => (
                      <div key={i} className="text-sm">
                        <p className="font-medium text-gray-100">{s.title}</p>
                        {s.whyItMatters && (
                          <p className="text-gray-400 mt-0.5">
                            <span className="text-gray-500">
                              {t('sections.explainability.buckets.matched.whyItMatters')}:{' '}
                            </span>
                            {s.whyItMatters}
                          </p>
                        )}
                        <EvidenceList evidence={s.evidence} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Bucket>

          {/* Missing */}
          <Bucket
            icon={<XCircle className="w-5 h-5 text-rose-400" />}
            title={t('sections.explainability.buckets.missing.title')}
            count={missingCount}
            accent="border-rose-500/20 bg-rose-500/5"
          >
            {missingCount === 0 ? (
              <p className="text-sm text-gray-400">
                {t('sections.explainability.buckets.missing.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {model.missing.keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">
                      {t('sections.explainability.buckets.missing.keywords')}
                    </p>
                    <KeywordChips keywords={model.missing.keywords} />
                  </div>
                )}
                {model.missing.gaps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">
                      {t('sections.explainability.buckets.missing.gaps')}
                    </p>
                    {model.missing.gaps.map((g, i) => (
                      <div key={i} className="text-sm">
                        <p className="font-medium text-gray-100">{g.requirement}</p>
                        <p className="text-gray-400 mt-0.5">
                          <span className="text-gray-500">
                            {t('sections.explainability.buckets.missing.currentState')}:{' '}
                          </span>
                          {g.currentState}
                        </p>
                        <p className="text-gray-400 mt-0.5">
                          <span className="text-gray-500">
                            {t('sections.explainability.buckets.missing.recommendation')}:{' '}
                          </span>
                          {g.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-emerald-300/80 pt-1">
                  {t('sections.explainability.buckets.missing.note')}
                </p>
              </div>
            )}
          </Bucket>

          {/* Weak / unclear evidence */}
          <Bucket
            icon={<HelpCircle className="w-5 h-5 text-amber-400" />}
            title={t('sections.explainability.buckets.weak.title')}
            count={weakCount}
            accent="border-amber-500/20 bg-amber-500/5"
          >
            {weakCount === 0 ? (
              <p className="text-sm text-gray-400">
                {t('sections.explainability.buckets.weak.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {model.weakEvidence.unclear.map((u, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-gray-100">{u.topic}</p>
                    <p className="text-gray-400 mt-0.5">
                      <span className="text-gray-500">
                        {t('sections.explainability.buckets.weak.reason')}:{' '}
                      </span>
                      {u.reason}
                    </p>
                    <p className="text-gray-400 mt-0.5">
                      <span className="text-gray-500">
                        {t('sections.explainability.buckets.weak.evidenceNeeded')}:{' '}
                      </span>
                      {u.evidenceNeeded}
                    </p>
                  </div>
                ))}
                {model.weakEvidence.hiddenMatches.map((h, i) => (
                  <div key={`h-${i}`} className="text-sm">
                    <p className="text-gray-500 text-xs mb-0.5">
                      {t('sections.explainability.buckets.weak.hiddenMatch')}
                    </p>
                    <p className="text-gray-200">
                      {h.resumeTerm} → {h.jdRequirement}
                    </p>
                    <p className="text-gray-400">{h.insight}</p>
                  </div>
                ))}
              </div>
            )}
          </Bucket>

          {/* Caution */}
          <Bucket
            icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
            title={t('sections.explainability.buckets.caution.title')}
            count={cautionCount}
            accent="border-red-500/20 bg-red-500/5"
          >
            {cautionCount === 0 ? (
              <p className="text-sm text-gray-400">
                {t('sections.explainability.buckets.caution.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {model.caution.risks.map((r, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-100">{r.title}</p>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                        {t(`sections.explainability.severity.${r.severity}`)}
                      </span>
                    </div>
                    <p className="text-gray-400 mt-0.5">{r.explanation}</p>
                    <p className="text-gray-400 mt-0.5">
                      <span className="text-gray-500">
                        {t('sections.explainability.buckets.caution.mitigation')}:{' '}
                      </span>
                      {r.mitigation}
                    </p>
                    <EvidenceList evidence={r.evidence} />
                  </div>
                ))}
                {model.caution.assumptions.length > 0 && (
                  <div className="text-sm">
                    <p className="text-xs text-gray-500 mb-1">
                      {t('sections.explainability.buckets.caution.assumptions')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      {model.caution.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {model.caution.cannotDetermine.length > 0 && (
                  <div className="text-sm">
                    <p className="text-xs text-gray-500 mb-1">
                      {t('sections.explainability.buckets.caution.cannotDetermine')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      {model.caution.cannotDetermine.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Bucket>

          <p className="text-xs text-gray-500 pt-1">
            {t('sections.explainability.disclaimer')}
          </p>
        </div>
      )}
    </GlassCard>
  );
}
