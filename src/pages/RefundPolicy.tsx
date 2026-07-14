import { useTranslation } from 'react-i18next';

const REFUND_POLICY_EFFECTIVE_DATE = new Date('2026-07-12T00:00:00.000Z');
const REFUND_POLICY_DATE_FORMATTERS = {
  ar: new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
};

export function RefundPolicy() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const effectiveDate = REFUND_POLICY_DATE_FORMATTERS[isArabic ? 'ar' : 'en'].format(REFUND_POLICY_EFFECTIVE_DATE);

  return (
    <div className="min-h-screen bg-[color:var(--surface)] py-12 px-4">
      <div className="max-w-4xl mx-auto rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface-glass)] backdrop-blur-md p-8 md:p-12">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] mb-2">
          {t('refund.title', 'Refund Policy')}
        </h1>
        <p className="text-[color:var(--ink-muted)] mb-8">
          {t('refund.lastUpdated', 'Last Updated')}: {effectiveDate}
        </p>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.intro.title', 'Introduction')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('refund.sections.intro.content', "This policy explains when payments for Watheq's paid plans and credit packs are refundable. It follows the Saudi E-Commerce Law and its Implementing Regulations, and nothing in it limits your statutory rights.")}
          </p>
        </section>

        {/* Credit Packs */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.packs.title', 'Credit Packs (One-Time Purchases)')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('refund.sections.packs.content', 'You can get a full refund within 7 days of purchase if you have not used any credits from the pack. Once a credit is used, the pack counts as a delivered digital service and is no longer refundable, except where the service failed or was defective (see below).')}
          </p>
        </section>

        {/* Monthly Subscription */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.subscription.title', 'Monthly Subscription')}
          </h2>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('refund.sections.subscription.cancel', 'Cancel anytime. You keep your access and remaining credits until the end of the paid period, and you will not be charged again.')}</li>
            <li>{t('refund.sections.subscription.statutory', 'If you have not used the service, you can get a full refund within 7 days of starting any new subscription.')}</li>
            <li>{t('refund.sections.subscription.firstTime', 'On your first subscription, we extend this: a full refund within 7 days even if you have used up to 10 credits.')}</li>
          </ul>
        </section>

        {/* Failed or Undelivered Service */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.failures.title', 'Failed or Undelivered Service')}
          </h2>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('refund.sections.failures.auto', 'If credits are deducted but we fail to deliver the result (for example, an optimization that errors out), the credits are restored automatically.')}</li>
            <li>{t('refund.sections.failures.delay', 'If we charge you and cannot deliver the service within 15 days, you may cancel and receive a full refund.')}</li>
          </ul>
        </section>

        {/* Defective Service */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.defects.title', 'Defective Service')}
          </h2>
          <div className="bg-[color:var(--surface-strong)] border border-[color:var(--glass-border)] rounded-lg p-4">
            <p className="text-[color:var(--ink-muted)] leading-relaxed">
              {t('refund.sections.defects.content', 'The limits above apply to change-of-mind refunds. If what we delivered is defective or does not match what we advertised, contact us and we will refund or fix it regardless of usage.')}
            </p>
          </div>
        </section>

        {/* How Refunds Are Paid */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.method.title', 'How Refunds Are Paid')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('refund.sections.method.content', 'Refunds go back to the same payment method you paid with. We process refund requests within 3 business days; your bank may take up to 14 days to post the amount.')}
          </p>
        </section>

        {/* Pricing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.pricing.title', 'Pricing')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('refund.sections.pricing.content', 'All prices are shown in Saudi Riyals (SAR).')}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('refund.sections.contact.title', 'Contact Us')}
          </h2>
          <p className="text-[color:var(--ink-muted)] mb-4">
            {t('refund.sections.contact.content', 'To request a refund or ask about this policy:')}
          </p>
          <a
            href="mailto:support@watheqai.app"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            support@watheqai.app
          </a>
          <p className="text-[color:var(--ink-muted)] mt-4">
            {t('refund.sections.contact.reply', 'We reply within 1 business day.')}
          </p>
        </section>

        <section className="border-t border-[color:var(--hairline-soft)] pt-8">
          <p className="text-sm text-[color:var(--ink-muted)]">
            {t('refund.sections.law.content', 'This policy is governed by the laws of the Kingdom of Saudi Arabia, including the E-Commerce Law and its Implementing Regulations. Your statutory rights are not limited by anything in this policy.')}
          </p>
        </section>
      </div>
    </div>
  );
}
