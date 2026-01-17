import { X, Calculator, Target, TrendingUp, PieChart, CheckCircle2, Lightbulb, ShieldCheck } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

interface Vision2030CalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isArabic?: boolean;
}

export function Vision2030CalculationModal({
  isOpen,
  onClose,
  isArabic = false
}: Vision2030CalculationModalProps) {

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
        variant="elevated"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isArabic ? 'منهجية الحساب' : 'Calculation Methodology'}
              </h2>
              <p className="text-xs text-white/70">
                {isArabic ? 'كيف نقيم توافقك مع الرؤية' : 'How we score your alignment'}
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
            <h3 className="text-lg font-semibold text-white mb-2 relative z-10">
              {isArabic ? 'الهدف من التحليل' : 'Analysis Objective'}
            </h3>
            <p className="text-white/90 leading-relaxed text-sm relative z-10 max-w-2xl">
              {isArabic
                ? 'نقوم بتحليل سيرتك الذاتية لمطابقة مهاراتك مع أولويات رؤية 2030. النتيجة تعكس مدى توافقك مع ١١ قطاعاً اقتصادياً رئيسياً، مع التركيز على الجودة والعمق بدلاً من الكمية.'
                : 'We analyze your resume to match your skills with Vision 2030 priorities. Your score reflects alignment across 11 key economic sectors, prioritizing depth and specialization over broad, shallow matches.'
              }
            </p>
          </section>

          {/* The 3-Step Process (Cards) */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4 flex items-center gap-2">
              {isArabic ? 'كيف نعمل' : 'How It Works'}
              <div className="h-px bg-white/10 flex-1" />
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="font-semibold text-white mb-1.5 text-sm">
                  {isArabic ? '١. المطابقة الذكية' : '1. Smart Matching'}
                </h4>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {isArabic
                    ? 'نبحث عن الكلمات المفتاحية ونقوم بوزنها (١-٣) حسب الأهمية، مع إزالة التكرار لضمان الدقة.'
                    : 'We scan and weight keywords (1-3) based on importance, removing duplicates for accuracy.'
                  }
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-semibold text-white mb-1.5 text-sm">
                  {isArabic ? '٢. منحنى التشجيع' : '2. Encouragement Curve'}
                </h4>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {isArabic
                    ? 'نطبق معادلة رياضية ترفع الدرجات المنخفضة، بحيث تبدأ النتائج من ٦٠٪ كحد أدنى تحفيزي.'
                    : 'We apply a curve to boost lower raw scores, setting a 60% motivational floor for everyone.'
                  }
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white/[0.04] border border-white/5 p-4 rounded-xl hover:border-emerald-500/20 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <PieChart className="w-4 h-4 text-amber-400" />
                </div>
                <h4 className="font-semibold text-white mb-1.5 text-sm">
                  {isArabic ? '٣. قاعدة ٧٠/٣٠' : '3. The 70/30 Rule'}
                </h4>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {isArabic
                    ? '٧٠٪ من نتيجتك تعتمد على أفضل ٣ قطاعات لديك، و٣٠٪ على التنوع العام. التخصص هو المفتاح.'
                    : '70% of your score comes from your top 3 sectors. We reward specialized experts over generalists.'
                  }
                </p>
              </div>
            </div>
          </section>

          {/* Design Philosophy Grid */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4 flex items-center gap-2">
              {isArabic ? 'فلسفة التصميم' : 'Design Philosophy'}
              <div className="h-px bg-white/10 flex-1" />
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                {
                  icon: CheckCircle2,
                  title: isArabic ? 'الحد الأدنى ٦٠٪' : '60% Minimum Floor',
                  desc: isArabic ? 'يمنع الإحباط ويشجع على التحسين.' : 'Prevents discouragement, encourages action.'
                },
                {
                  icon: Lightbulb,
                  title: isArabic ? 'اقتراحات ذكية' : 'Smart Suggestions',
                  desc: isArabic ? 'نقترح مهارات "مجاورة" لمسارك الحالي.' : 'We suggest "adjacent" skills for growth.'
                },
                {
                  icon: ShieldCheck,
                  title: isArabic ? 'التركيز على العمق' : 'Depth over Breadth',
                  desc: isArabic ? 'التميز في مجال واحد أفضل من التشتت.' : 'Mastery in one field beats average in all.'
                },
                {
                  icon: ShieldCheck,
                  title: isArabic ? 'خصوصية تامة' : 'Total Privacy',
                  desc: isArabic ? 'التحليل يتم على جهازك ١٠٠٪.' : 'Analysis happens 100% locally on your device.'
                }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                  <item.icon className="w-4 h-4 text-emerald-500/60 shrink-0" />
                  <div>
                    <div className="font-medium text-white text-xs">{item.title}</div>
                    <div className="text-[10px] text-white/60">{item.desc}</div>
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
                <div className="text-[10px] uppercase tracking-wide text-white/60 mt-1">{isArabic ? 'جيد' : 'Good'}</div>
              </div>
              <div className="px-2">
                <div className="text-emerald-400 font-bold text-base">70-84%</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60 mt-1">{isArabic ? 'قوي' : 'Strong'}</div>
              </div>
              <div className="px-2">
                <div className="text-blue-400 font-bold text-base">85%+</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60 mt-1">{isArabic ? 'خبير' : 'Expert'}</div>
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
            {isArabic ? 'فهمت' : 'Got it, thanks'}
          </button>
        </div>
      </GlassCard>
    </div>,
    document.body
  );
}
