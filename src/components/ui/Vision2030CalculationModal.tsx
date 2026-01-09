import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <GlassCard className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {isArabic ? 'كيف يتم حساب النتيجة؟' : 'How is Your Score Calculated?'}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Section 1: Overview */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              {isArabic ? 'نظرة عامة' : 'Overview'}
            </h3>
            <p className="text-white/70">
              {isArabic
                ? 'نقوم بتحليل سيرتك الذاتية لمطابقة مهاراتك مع أولويات رؤية 2030. النتيجة تعكس مدى توافقك مع ١١ قطاعاً اقتصادياً رئيسياً.'
                : 'We analyze your resume to match your skills with Vision 2030 priorities. Your score reflects alignment across 11 key economic sectors.'
              }
            </p>
          </section>

          {/* Section 2: Calculation Steps */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              {isArabic ? 'خطوات الحساب' : 'Calculation Steps'}
            </h3>

            <div className="space-y-4">
              {/* Step 1: Keyword Matching */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg">
                <h4 className="font-semibold text-emerald-400 mb-2">
                  {isArabic ? '١. مطابقة الكلمات المفتاحية' : '1. Keyword Matching'}
                </h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>{isArabic
                    ? 'نبحث في سيرتك الذاتية عن كلمات مفتاحية تطابق القطاعات'
                    : 'We scan your resume for keywords that match Vision 2030 sectors'
                  }</li>
                  <li>{isArabic
                    ? 'كل مهارة لها وزن (١-٣) حسب أهميتها'
                    : 'Each skill has a weight (1-3) based on its importance'
                  }</li>
                  <li>{isArabic
                    ? 'نحسب كل مهارة مرة واحدة فقط'
                    : 'We count each skill only once (deduplication)'
                  }</li>
                </ul>
              </div>

              {/* Step 2: Sector Scoring */}
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-400 mb-2">
                  {isArabic ? '٢. تقييم القطاعات' : '2. Sector Scoring'}
                </h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>{isArabic
                    ? 'لكل قطاع: (الوزن المطابق ÷ إجمالي الوزن) × ١٠٠'
                    : 'For each sector: (Matched Weight ÷ Total Weight) × 100'
                  }</li>
                  <li>{isArabic
                    ? 'نطبق منحنى تشجيعي لجعل النتائج المنخفضة أكثر إيجابية'
                    : 'We apply an encouragement curve to make low scores more positive'
                  }</li>
                </ul>
              </div>

              {/* Step 3: Overall Score */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-400 mb-2">
                  {isArabic ? '٣. النتيجة الإجمالية' : '3. Overall Score'}
                </h4>
                <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                  <li>{isArabic
                    ? '٧٠٪ من النتيجة تأتي من أفضل ٣ قطاعات لديك'
                    : '70% of your score comes from your top 3 sectors'
                  }</li>
                  <li>{isArabic
                    ? '٣٠٪ من المتوسط الإجمالي لجميع القطاعات'
                    : '30% from the average across all sectors'
                  }</li>
                  <li className="font-semibold text-amber-300">{isArabic
                    ? 'الحد الأدنى: ٦٠٪ (حتى مع عدم وجود مطابقات)'
                    : 'Minimum floor: 60% (even with no matches)'
                  }</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3: Why These Design Choices? */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              {isArabic ? 'لماذا هذه الطريقة؟' : 'Why These Design Choices?'}
            </h3>

            <div className="space-y-3 text-sm text-white/70">
              <div className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white">{isArabic ? 'منحنى التشجيع:' : 'Encouragement Curve:'}</strong>
                  {isArabic
                    ? ' يجعل المطابقات الصغيرة تبدو ذات معنى. مثال: ٢٥٪ خام → ٦٠٪ مع المنحنى'
                    : ' Makes small matches feel meaningful. Example: 25% raw → 60% with curve'
                  }
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white">{isArabic ? 'الحد الأدنى ٦٠٪:' : '60% Minimum Floor:'}</strong>
                  {isArabic
                    ? ' يمنع الشعور بالإحباط. حتى السير الذاتية الفارغة تحصل على ٦٠٪ كقاعدة تشجيعية'
                    : ' Prevents discouragement. Even empty resumes get 60% as an encouraging baseline'
                  }
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white">{isArabic ? 'التركيز ٧٠/٣٠:' : '70/30 Focus:'}</strong>
                  {isArabic
                    ? ' التميز في ٣ قطاعات أهم من الانتشار السطحي. نكافئ العمق والتخصص'
                    : ' Excellence in 3 sectors matters more than shallow breadth. We reward depth and specialization'
                  }
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <strong className="text-white">{isArabic ? 'الاقتراحات الذكية:' : 'Smart Suggestions:'}</strong>
                  {isArabic
                    ? ' نكتشف مسارك المهني (٩ أنماط) ونقترح مهارات متجاورة منطقية لتطويرك'
                    : ' We detect your career archetype (9 patterns) and suggest adjacent skills that make sense for your growth'
                  }
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Interpreting Your Score */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              {isArabic ? 'كيف تفسر نتيجتك؟' : 'Interpreting Your Score'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                <div className="font-semibold text-amber-400 mb-1">60-69%</div>
                <div className="text-xs text-white/70">
                  {isArabic
                    ? 'أساس جيد - لديك بعض المهارات الملائمة لرؤية 2030'
                    : 'Good foundation - You have some Vision 2030-aligned skills'
                  }
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg">
                <div className="font-semibold text-emerald-400 mb-1">70-84%</div>
                <div className="text-xs text-white/70">
                  {isArabic
                    ? 'توافق قوي - ملف تعريف منافس للفرص في رؤية 2030'
                    : 'Strong alignment - Competitive profile for Vision 2030 opportunities'
                  }
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
                <div className="font-semibold text-blue-400 mb-1">85-100%</div>
                <div className="text-xs text-white/70">
                  {isArabic
                    ? 'توافق ممتاز - قادر على المساهمة بشكل كبير في الأولويات الوطنية'
                    : 'Excellent alignment - Well-positioned to contribute to national priorities'
                  }
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Data Privacy */}
          <section className="bg-white/5 border border-white/10 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-2">
              {isArabic ? '🔒 الخصوصية والشفافية' : '🔒 Privacy & Transparency'}
            </h3>
            <p className="text-xs text-white/60">
              {isArabic
                ? 'جميع التحليلات تتم على جهازك محلياً. لا نرسل سيرتك الذاتية إلى خوادمنا أو نخزنها. حقك في معرفة كيفية تقييمك أساسي لثقتنا.'
                : 'All analysis happens locally on your device. We never send your resume to our servers or store it. Your right to understand how you\'re being scored is fundamental to our trust.'
              }
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            {isArabic ? 'فهمت' : 'Got it'}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
