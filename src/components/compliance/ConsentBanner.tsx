import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Check, Cookie } from 'lucide-react';
import { GlassCircle } from '../ui/GlassCircle';
import { cn } from '../../lib/utils/cn';
import { useConsentStore } from '../../lib/stores/consentStore';
import { analytics } from '../../services/analytics';

export function ConsentBanner() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const [isVisible, setIsVisible] = useState(false);
  const { hasConsented, acceptAll, rejectAll } = useConsentStore();

  // Show banner after a short delay for smooth entrance
  useEffect(() => {
    if (!hasConsented()) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasConsented]);

  // Don't render if already opted in/out
  if (hasConsented() && !isVisible) return null;

  return (
    <div
      className={cn(
        'fixed z-50 transition-all duration-500 ease-out transform',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none',
        'bottom-4 sm:bottom-6',
        isRTL ? 'left-4 sm:left-6' : 'right-4 sm:right-6',
        'w-[calc(100vw-32px)] sm:w-[380px]'
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/10',
          'bg-[#0f172a]/80 supports-[backdrop-filter]:bg-[#0f172a]/60', // Deep dark blue/slate tinted background
          'backdrop-blur-xl shadow-2xl shadow-black/50',
          'flex flex-col gap-4 p-5'
        )}
      >
        {/* Subtle Gradient Background */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-60" />
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header & Content */}
        <div className="flex gap-4 relative z-10">
          <div className="shrink-0 pt-1">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur animate-pulse" />
              <GlassCircle size="md" variant="success" className="relative z-10 border-emerald-500/30 bg-emerald-500/10">
                <Cookie className="w-5 h-5 text-emerald-400" />
              </GlassCircle>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-base text-white tracking-tight flex items-center justify-between">
              {t('consent.title', 'Cookie Preferences')}
              {/* Optional: Subtle close button if user REALLY wants to ignore it (optional behavior) */}
              {/* <button onClick={() => setIsVisible(false)} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button> */}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed font-light">
              {t('consent.description', 'We use cookies to analyze traffic and improve your experience. Identifying data is never sold.')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 relative z-10 pt-1">
          <button
            onClick={() => {
              rejectAll();
              setIsVisible(false);
            }}
            className={cn(
              'order-2 sm:order-1 px-4 py-2.5 rounded-xl text-sm font-medium',
              'text-white/50 hover:text-white transition-colors duration-200',
              'hover:bg-white/5 text-center'
            )}
          >
            {t('consent.reject', 'Decline')}
          </button>

          <button
            onClick={() => {
              acceptAll();
              analytics.init();
              setIsVisible(false);
            }}
            className={cn(
              'order-1 sm:order-2 flex-1 flex items-center justify-center gap-2',
              'px-6 py-2.5 rounded-xl text-sm font-semibold',
              'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white',
              'shadow-lg shadow-emerald-500/25',
              'hover:shadow-emerald-500/40 hover:scale-[1.02]',
              'active:scale-[0.98]',
              'transition-all duration-200 group relative overflow-hidden'
            )}
          >
            <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rotate-12" />
            <Check className="w-4 h-4" />
            <span>{t('consent.acceptAll', 'Accept & Continue')}</span>
          </button>
        </div>

        {/* Footer / Compliance Check */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10">
          <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity duration-300">
            <Shield className="w-3 h-3" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {t('consent.compliance', 'Secure & Private')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsentBanner;
