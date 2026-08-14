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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/40 backdrop-blur-sm">
      <GlassCard
        className="max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col p-0 border-[color:var(--glass-border)] dark:border-white/10 shadow-2xl shadow-emerald-900/10 dark:shadow-black/60 bg-[color:var(--surface-glass)] dark:bg-[#0a0a0a]/95 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-5 border-b border-[color:var(--glass-border)] dark:border-white/10 bg-[color:var(--surface-control)] dark:bg-[#0a0a0a]/95 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t('vision2030.calculation.title', 'Calculation Methodology')}
              </h2>
              <p className="text-xs text-gray-600 dark:text-white/70">
                {t('vision2030.calculation.subtitle', 'How the estimate is produced')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

          {/* Hero / Overview */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/5 border border-[color:var(--glass-border)] dark:border-white/5 p-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Target className="w-40 h-40" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 relative z-10">
              {t('vision2030.calculation.objectiveTitle', 'Analysis Objective')}
            </h3>
            <p className="text-gray-800 dark:text-white/90 leading-relaxed text-sm relative z-10 max-w-2xl">
              {t('vision2030.calculation.objectiveDesc', 'This is an AI-generated estimate based on resume evidence compared with strategic-sector references. It is not an official Vision 2030 certification, employment assessment, or government endorsement.')}
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
              <div className="bg-[color:var(--surface-glass)] dark:bg-white/[0.04] border border-[color:var(--glass-border)] dark:border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-4 h-4 text-emerald-500" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step1Title', '1. Evidence Review')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step1Desc', 'The AI reviews visible resume evidence such as work examples, projects, skills, and certifications.')}
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-[color:var(--surface-glass)] dark:bg-white/[0.04] border border-[color:var(--glass-border)] dark:border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step2Title', '2. Sector Comparison')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step2Desc', 'That evidence is compared with reference descriptions for strategic Saudi sectors and their relevant capabilities.')}
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-[color:var(--surface-glass)] dark:bg-white/[0.04] border border-[color:var(--glass-border)] dark:border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <PieChart className="w-4 h-4 text-amber-400" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-sm">
                  {t('vision2030.calculation.step3Title', '3. Estimate and Guidance')}
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-white/70 leading-relaxed">
                  {t('vision2030.calculation.step3Desc', 'The AI returns a 0–100 estimate, sector evidence, and recommendations. Results may vary after relevant resume changes or model updates.')}
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
                  title: t('vision2030.calculation.floorTitle', 'Evidence-based estimate'),
                  desc: t('vision2030.calculation.floorDesc', 'Claims without visible resume support should not be treated as proven alignment.')
                },
                {
                  icon: Lightbulb,
                  title: t('vision2030.calculation.suggestionsTitle', 'Smart Suggestions'),
                  desc: t('vision2030.calculation.suggestionsDesc', 'We suggest adjacent skills for growth.')
                },
                {
                  icon: ShieldCheck,
                  title: t('vision2030.calculation.depthTitle', 'Not a certification'),
                  desc: t('vision2030.calculation.depthDesc', 'The result is guidance, not an official or hiring decision.')
                },
                {
                  icon: ShieldCheck,
                  title: t('vision2030.calculation.privacyTitle', 'Server-side AI processing'),
                  desc: t('vision2030.calculation.privacyDesc', 'The needed resume text is sent through Watheq servers to contracted AI providers; see the Privacy Policy.')
                }
              ].map((item) => (
                <div key={item.title} className="flex gap-3 p-3 rounded-lg bg-[color:var(--surface-glass)] dark:bg-white/[0.04] border border-[color:var(--glass-border)] dark:border-white/5">
                  <item.icon className="w-4 h-4 text-emerald-500/60 shrink-0" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-xs">{item.title}</div>
                    <div className="text-[10px] text-gray-500 dark:text-white/60">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Score interpretation */}
          <section className="bg-[color:var(--surface-control)] dark:bg-black/20 rounded-xl p-4 border border-[color:var(--glass-border)] dark:border-white/5">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-white/75">
              {t('vision2030.calculation.scoreNote', 'Use the score as a directional summary. The supporting sector evidence and recommendations are more useful than the number alone, and every suggested claim still needs your verification.')}
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[color:var(--glass-border)] dark:border-white/10 bg-[color:var(--surface-control)] dark:bg-white/[0.04] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:-translate-y-0.5 transition-[background-color,box-shadow,translate] text-xs"
          >
            {t('vision2030.calculation.close', 'Got it, thanks')}
          </button>
        </div>
      </GlassCard>
    </div>,
    document.body
  );
}
