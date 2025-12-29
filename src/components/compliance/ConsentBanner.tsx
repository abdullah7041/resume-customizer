import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '../../lib/utils/cn';
import { useConsentStore } from '../../lib/stores/consentStore';
import { analytics } from '../../services/analytics';

export function ConsentBanner() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [isExpanded, setIsExpanded] = useState(false);
  const { hasConsented, acceptAll, rejectAll } = useConsentStore();

  // Don't show if already consented
  if (hasConsented()) return null;

  return (
    <>
      {/* Floating Pill - Always Visible */}
      <div
        className={cn(
          'fixed bottom-6 z-50 transition-all duration-300',
          isRTL ? 'left-6' : 'right-6'
        )}
      >
        {/* Collapsed State: Floating Glass Pill */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-3',
              'rounded-full border border-white/10',
              'bg-gradient-to-br from-emerald-900/90 to-gray-900/90',
              'backdrop-blur-xl shadow-2xl',
              'hover:scale-105 transition-transform',
              'text-sm font-medium text-white'
            )}
          >
            <GlassCircle size="sm" variant="success">
              <Shield className="w-4 h-4 text-emerald-400" />
            </GlassCircle>
            <span>{t('consent.pill', 'نقدّر خصوصيتك')}</span>
            <ChevronUp className="w-4 h-4 text-white/60" />
          </button>
        )}

        {/* Expanded State: Compact Card */}
        {isExpanded && (
          <div
            className={cn(
              'w-80 rounded-2xl border border-white/10',
              'bg-gradient-to-br from-gray-900/95 to-emerald-900/95',
              'backdrop-blur-xl shadow-2xl overflow-hidden',
              'animate-in slide-in-from-bottom-4 duration-300'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <GlassCircle size="md" variant="success">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </GlassCircle>
                <span className="font-semibold text-white">
                  {t('consent.title', 'نقدّر خصوصيتك')}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronDown className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                {t('consent.description', 'نستخدم ملفات تعريف الارتباط ونعالج بياناتك لتقديم وتحسين خدماتنا. وفقاً لنظام حماية البيانات الشخصية في المملكة، نحتاج موافقتك.')}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    acceptAll();
                    // Initialize analytics after user consents
                    analytics.init();
                    setIsExpanded(false);
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2',
                    'px-4 py-2.5 rounded-xl',
                    'bg-gradient-to-r from-emerald-500 to-teal-500',
                    'text-white font-medium text-sm',
                    'hover:from-emerald-400 hover:to-teal-400',
                    'transition-colors'
                  )}
                >
                  <Check className="w-4 h-4" />
                  {t('consent.acceptAll', 'قبول الكل')}
                </button>
                <button
                  onClick={() => {
                    rejectAll();
                    setIsExpanded(false);
                  }}
                  className={cn(
                    'px-4 py-2.5 rounded-xl',
                    'border border-white/20 text-white/80',
                    'text-sm hover:bg-white/5 transition-colors'
                  )}
                >
                  {t('consent.rejectOptional', 'رفض')}
                </button>
              </div>

              {/* Compliance Badge */}
              <p className="text-xs text-white/40 text-center mt-3">
                {t('consent.compliance', 'متوافق مع نظام حماية البيانات الشخصية السعودي - المرسوم الملكي رقم م/19')}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ConsentBanner;
