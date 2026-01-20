import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

interface QuotaData {
  upload: QuotaStatus;
  extract: QuotaStatus;
  match: QuotaStatus;
  optimize: QuotaStatus;
  predict: QuotaStatus;
  coverLetter: QuotaStatus;
  batch: QuotaStatus;
}

const getBetaCode = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('watheq:beta_access');
};

const fetchQuotaStatus = async (): Promise<QuotaData | null> => {
  const betaCode = getBetaCode();
  if (!betaCode) return null;

  try {
    const response = await fetch('/.netlify/functions/beta-quota-status', {
      headers: { 'X-Beta-Code': betaCode },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export function BetaQuotaNotification() {
  const { t } = useTranslation();
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadQuota = async () => {
      const data = await fetchQuotaStatus();
      setQuotaData(data);
    };

    loadQuota();
    const interval = setInterval(loadQuota, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (!quotaData) return null;

  const features = [
    { key: 'upload' as const, label: t('quota.features.upload'), icon: '📤' },
    { key: 'extract' as const, label: t('quota.features.extract'), icon: '📄' },
    { key: 'match' as const, label: t('quota.features.match'), icon: '🎯' },
    { key: 'optimize' as const, label: t('quota.features.optimize'), icon: '✨' },
    { key: 'predict' as const, label: t('quota.features.predict'), icon: '💼' },
    { key: 'coverLetter' as const, label: t('quota.features.coverLetter'), icon: '✉️' },
    { key: 'batch' as const, label: t('quota.features.batch'), icon: '📦' },
  ];

  const hasExhaustedQuota = features.some(f => quotaData[f.key].remaining === 0);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`
        rounded-xl border backdrop-blur-xl transition-all
        ${hasExhaustedQuota ? 'bg-red-500/10 border-red-400/30' : 'bg-black/40 border-white/10'}
      `}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {hasExhaustedQuota ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Info className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-sm font-medium text-white">{t('quota.title')}</span>
          </div>
          <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-4 pb-3 space-y-2 border-t border-white/10">
            {features.map(({ key, label, icon }) => {
              const status = quotaData[key];
              const isExhausted = status.remaining === 0;

              return (
                <div
                  key={key}
                  className={`
                    flex items-center justify-between py-1.5 px-2 rounded-lg
                    ${isExhausted ? 'bg-red-500/5' : 'hover:bg-white/5'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`
                      text-xs font-mono
                      ${isExhausted ? 'text-red-400' : 'text-emerald-400'}
                    `}>
                      {status.used}/{status.limit}
                    </span>
                    {isExhausted ? (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-white/5">
              {t('quota.refreshNote')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
