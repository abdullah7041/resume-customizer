import { useTranslation } from 'react-i18next';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';

/** The same purchase terms at every pricing entry point. */
export function CreditPack({ showCheckoutLink = true }: { showCheckoutLink?: boolean }) {
  const { t } = useTranslation();
  const paymentConfig = usePaymentConfig(showCheckoutLink);
  return (
    <div className="space-y-4 text-ink">
      <h3 className="text-xl font-semibold">{t('pricing.pack.title', 'Application Credits')}</h3>
      <p className="text-3xl font-bold">{t('pricing.pack.price', '29 SAR · one-time payment')}</p>
      <p className="text-sm text-ink-muted">{t('pricing.pack.description', '100 purchased credits that never expire, in addition to your free balance. No subscription or automatic renewal.')}</p>
      <p className="text-sm text-ink-muted">{t('pricing.pack.free', '20 free credits each month. Purchased credits stay available when your free balance resets.')}</p>
      <p className="text-sm text-ink-muted">{t('pricing.pack.costs', 'Match analysis: 2 · Optimization: 5 · Interview prep: 3 · Cover letter: 4 · Vision 2030: 2 credits. Uploads and PDF exports are included.')}</p>
      {showCheckoutLink && paymentConfig?.enabled && (
        <a href="/checkout" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
          {t('pricing.pack.cta', 'Buy 100 credits')}
        </a>
      )}
      {showCheckoutLink && paymentConfig?.enabled === false && (
        <p role="status" className="text-sm text-ink-muted">{t('pricing.checkout.disabled', 'Checkout is currently unavailable.')}</p>
      )}
    </div>
  );
}
