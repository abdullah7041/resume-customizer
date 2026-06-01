import { X, Calculator, Target, TrendingUp, PieChart, CheckCircle2, Lightbulb, ShieldCheck } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Vision2030CalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isArabic?: boolean;
}

export function Vision2030CalculationModal({
  isOpen,
  onClose
}: Vision2030CalculationModalProps) {
  const { t } = useTranslation();

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-300">
      <GlassCard
        className="max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col p-0 border-white/10 shadow-2xl shadow-black/60 bg-[#0a0a0a]/95 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t('vision2030.calculation.title', 'Calculation Methodology')}
              </h2>
              <p className="text-xs text-gray-600 dark:text-white/70">
                {t('vision2030.calculation.subtitle', 'How we score your alignment')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

          {/* Hero / Overview */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/10 to-teal-900/5 border border-white/5 p-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Target className="w-40 h-40" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 relative z-10">
              {t('vision2030.calculation.objectiveTitle', 'Analysis Objective')}
            </h3>
            <p className="text-gray-800 dark:text-white/90 leading-relaxed text-sm relative z-10 max-w-2xl">
              {t('vision2030.calculation.objectiveDesc', 'We analyze your resume to match your skills with Vision 2030 priorities. Your score reflects alignment across 11 key economic sectors, prioritizing depth and specialization over broad, shallow matches.')}
            </p>
          </section>

          {/* The 3-Step Process (Cards) */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-white/60 mb-4 flex items-center gap-2">
              {t('vision2030.calculation.processTitle', 'How It Works')}
              <div className="h-px bg-white/10 flex-1" />
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step1Title', '1. Smart Matching')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step1Desc', 'We scan and weight keywords (1-3) based on importance, removing duplicates for accuracy.')}
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step2Title', '2. Encouragement Curve')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step2Desc', 'We apply a curve to boost lower raw scores, setting a 60% motivational floor for everyone.')}
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <PieChart className="w-4 h-4 text-amber-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step3Title', '3. The 70/30 Rule')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step3Desc', '70% of your score comes from your top 3 sectors. We reward specialized experts over generalists.')}
                </p>
              </div>
            </div>
          </section>

          {/* Design Philosophy Grid */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-white/60 mb-4 flex items-center gap-2">
              {t('vision2030.calculation.philosophyTitle', 'Design Philosophy')}
              <div className="h-px bg-white/10 flex-1" />
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                {
                  icon: CheckCircle2,
                  title: t('vision2030.calculation.floorTitle', '60% Minimum Floor'),
                  desc: t('vision2030.calculation.floorDesc', 'Prevents discouragement, encourages action.')
                },
                {
                  icon: Lightbulb,
                  title: t('vision2030.calculation.suggestionsTitle', 'Smart Suggestions'),
                  desc: t('vision2030.calculation.suggestionsDesc', 'We suggest adjacent skills for growth.')
                },
                {
                  icon: ShieldCheck,
                  title: t('vision2030.calculation.depthTitle', 'Depth over Breadth'),
                  desc: t('vision2030.calculation.depthDesc', 'Mastery in one field beats average in all.')
                },
                {
                  icon: ShieldCheck,
                  title: t('vision2030.calculation.privacyTitle', 'Total Privacy'),
                  desc: t('vision2030.calculation.privacyDesc', 'Analysis happens locally on your device.')
                }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                  <item.icon className="w-4 h-4 text-emerald-500/60 shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-xs">{item.title}</div>
                    <div className="text-[10px] text-gray-500 dark:text-white/60">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Score Interpretation */}
          <section className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10 rtl:divide-x-reverse">
              <div className="px-2">
                <div className="text-amber-400 font-bold text-base">60-69%</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/60 mt-1">{t('vision2030.calculation.rangeGood', 'Good')}</div>
              </div>
              <div className="px-2">
                <div className="text-emerald-400 font-bold text-base">70-84%</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/60 mt-1">{t('vision2030.calculation.rangeStrong', 'Strong')}</div>
              </div>
              <div className="px-2">
                <div className="text-blue-400 font-bold text-base">85%+</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-white/60 mt-1">{t('vision2030.calculation.rangeExpert', 'Expert')}</div>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.04] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:-translate-y-0.5 transition-all text-xs"
          >
            {t('vision2030.calculation.close', 'Got it, thanks')}
          </button>
        </div>
      </GlassCard>
    </div>,
    document.body
  );
}
