import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsentStore } from '../../lib/stores/consentStore';
import { useDirection } from '../providers/DirectionProvider';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

export function ConsentBanner() {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [showDetails, setShowDetails] = useState(false);

  const {
    hasConsented,
    acceptAll,
    rejectAll,
    setConsent,
    analyticsConsent,
    marketingConsent,
    dataProcessingConsent,
  } = useConsentStore();

  if (hasConsented()) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-2xl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <Shield className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('consent.title')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('consent.description')}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 mb-4"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {t('consent.managePreferences')}
        </button>

        {showDetails && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
            {/* Functional - Always on */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('consent.functional.title')}</p>
                <p className="text-sm text-gray-500">{t('consent.functional.description')}</p>
              </div>
              <div className="text-sm text-gray-400">{t('consent.required')}</div>
            </div>

            {/* Data Processing */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('consent.dataProcessing.title')}</p>
                <p className="text-sm text-gray-500">{t('consent.dataProcessing.description')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataProcessingConsent}
                  onChange={(e) => setConsent('dataProcessingConsent', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Analytics */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('consent.analytics.title')}</p>
                <p className="text-sm text-gray-500">{t('consent.analytics.description')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setConsent('analyticsConsent', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Marketing */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('consent.marketing.title')}</p>
                <p className="text-sm text-gray-500">{t('consent.marketing.description')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setConsent('marketingConsent', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={acceptAll}
            className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('consent.acceptAll')}
          </button>
          <button
            onClick={rejectAll}
            className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            {t('consent.rejectOptional')}
          </button>
          <a
            href="/privacy"
            className="flex-1 px-6 py-3 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors text-center"
          >
            {t('consent.privacyPolicy')}
          </a>
        </div>

        {/* PDPL Reference */}
        <p className="text-xs text-gray-400 mt-4 text-center">
          {t('consent.pdplReference')}
        </p>
      </div>
    </div>
  );
}
