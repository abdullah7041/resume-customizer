import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassTabs } from '../ui/GlassTabs';
import {
  Sparkles,
  Check,
  RotateCcw,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface Optimization {
  id: string;
  section: 'summary' | 'experience' | 'skills';
  title: string;
  original: string;
  optimized: string;
  applied: boolean;
}

interface OptimizeSectionProps {
  optimizations: Optimization[];
  onApply: (id: string) => void;
  onRevert: (id: string) => void;
  onApplyAll: () => void;
  onGenerate: (section: string) => Promise<void>;
  isGenerating: boolean;
}

export function OptimizeSection({
  optimizations,
  onApply,
  onRevert,
  onApplyAll,
  onGenerate,
  isGenerating,
}: OptimizeSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [activeSection, setActiveSection] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<string | null>(null);

  const tabs = [
    { id: 'all', label: 'All Sections', labelAr: 'جميع الأقسام', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', labelAr: 'الملخص', icon: null },
    { id: 'experience', label: 'Experience', labelAr: 'الخبرة', icon: null },
    { id: 'skills', label: 'Skills', labelAr: 'المهارات', icon: null },
  ];

  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.section === activeSection);

  const appliedCount = optimizations.filter(o => o.applied).length;

  return (
    <GlassCard variant="elevated">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.optimize.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.optimize.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {appliedCount}/{optimizations.length} {t('sections.optimize.status.applied')}
          </span>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={onApplyAll}
            disabled={appliedCount === optimizations.length}
          >
            {t('sections.optimize.actions.applyAll')}
          </GlassButton>
        </div>
      </div>

      {/* Section Tabs */}
      <GlassTabs
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={setActiveSection}
        isArabic={isArabic}
      />

      {/* Generate Button */}
      <div className="mt-4 mb-6">
        <GlassButton
          onClick={() => onGenerate(activeSection)}
          isLoading={isGenerating}
          className="w-full"
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {isGenerating
            ? t('sections.optimize.generating')
            : t('sections.optimize.actions.optimize')
          }
        </GlassButton>
      </div>

      {/* Optimizations List */}
      <div className="space-y-4">
        {filteredOptimizations.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('sections.optimize.noChanges')}</p>
          </div>
        ) : (
          filteredOptimizations.map((opt) => (
            <div
              key={opt.id}
              className={cn(
                'p-4 rounded-xl border transition-all',
                opt.applied
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-white/5 border-white/10'
              )}
            >
              {/* Item Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {opt.applied && (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <h4 className="font-medium text-white">{opt.title}</h4>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    opt.applied
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-gray-400'
                  )}>
                    {opt.applied
                      ? t('sections.optimize.status.applied')
                      : t('sections.optimize.status.original')
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCompareMode(compareMode === opt.id ? null : opt.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={t('sections.optimize.actions.compare')}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === opt.id ? null : opt.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {expandedId === opt.id
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </button>
                </div>
              </div>

              {/* Compare Mode */}
              {compareMode === opt.id && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">{t('sections.optimize.status.original')}</p>
                    <p className="text-sm text-gray-300">{opt.original}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <p className="text-xs text-emerald-400 mb-2">{t('sections.optimize.status.optimized')}</p>
                    <p className="text-sm text-white">{opt.optimized}</p>
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {expandedId === opt.id && !compareMode && (
                <div className="mb-4 p-3 bg-white/5 rounded-lg">
                  <p className="text-sm text-gray-300">
                    {opt.applied ? opt.optimized : opt.original}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {opt.applied ? (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevert(opt.id)}
                    leftIcon={<RotateCcw className="w-3 h-3" />}
                  >
                    {t('sections.optimize.actions.revert')}
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => onApply(opt.id)}
                    leftIcon={<Check className="w-3 h-3" />}
                  >
                    {t('sections.optimize.actions.apply')}
                  </GlassButton>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
