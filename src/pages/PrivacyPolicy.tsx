import { useTranslation } from 'react-i18next';

const PRIVACY_POLICY_EFFECTIVE_DATE = new Date('2026-08-15T00:00:00.000Z');
const PRIVACY_POLICY_DATE_FORMATTERS = {
  ar: new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
};

export function PrivacyPolicy() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const effectiveDate = PRIVACY_POLICY_DATE_FORMATTERS[isArabic ? 'ar' : 'en'].format(PRIVACY_POLICY_EFFECTIVE_DATE);

  return (
    <div className="min-h-screen bg-[color:var(--surface)] py-12 px-4">
      <div className="max-w-4xl mx-auto rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface-glass)] backdrop-blur-md p-8 md:p-12">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] mb-2">
          {t('privacy.title')}
        </h1>
        <p className="text-[color:var(--ink-muted)] mb-8">
          {t('privacy.lastUpdated')}: {effectiveDate}
        </p>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.intro.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('privacy.sections.intro.content')}
          </p>
        </section>

        {/* Data Controller */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.controller.title')}
          </h2>
          <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
            <p className="text-[color:var(--ink-muted)]">{t('privacy.sections.controller.name')}</p>
            <p className="text-[color:var(--ink-muted)]">{t('privacy.sections.controller.email')}</p>
          </div>
        </section>

        {/* Data We Collect */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.dataCollected.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-[color:var(--ink)]">{t('privacy.sections.dataCollected.personal.title')}</h3>
              <ul className="list-disc list-inside text-[color:var(--ink-muted)] mt-2 space-y-1">
                <li>{t('privacy.sections.dataCollected.personal.items.name')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.email')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.phone')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.resume')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[color:var(--ink)]">{t('privacy.sections.dataCollected.technical.title')}</h3>
              <ul className="list-disc list-inside text-[color:var(--ink-muted)] mt-2 space-y-1">
                <li>{t('privacy.sections.dataCollected.technical.items.ip')}</li>
                <li>{t('privacy.sections.dataCollected.technical.items.browser')}</li>
                <li>{t('privacy.sections.dataCollected.technical.items.device')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Purpose of Processing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.purpose.title')}
          </h2>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('privacy.sections.purpose.items.service')}</li>
            <li>{t('privacy.sections.purpose.items.improvement')}</li>
            <li>{t('privacy.sections.purpose.items.communication')}</li>
            <li>{t('privacy.sections.purpose.items.legal')}</li>
          </ul>
        </section>

        {/* Legal Basis - PDPL Specific */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.legalBasis.title')}
          </h2>
          <div className="bg-[color:var(--surface-strong)] border border-[color:var(--glass-border)] rounded-lg p-4">
            <p className="text-[color:var(--ink-muted)] leading-relaxed">
              {t('privacy.sections.legalBasis.content')}
            </p>
          </div>
        </section>

        {/* Your Rights - PDPL Article 4 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.rights.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.access.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.access.description')}</p>
            </div>
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.rectification.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.rectification.description')}</p>
            </div>
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.deletion.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.deletion.description')}</p>
            </div>
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.portability.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.portability.description')}</p>
            </div>
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.withdraw.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.withdraw.description')}</p>
            </div>
            <div className="bg-[color:var(--surface-strong)] rounded-lg p-4">
              <h3 className="font-medium text-[color:var(--ink)] mb-2">{t('privacy.sections.rights.complaint.title')}</h3>
              <p className="text-sm text-[color:var(--ink-muted)]">{t('privacy.sections.rights.complaint.description')}</p>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.retention.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('privacy.sections.retention.content')}
          </p>
        </section>

        {/* Cross-Border Transfers */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.crossBorder.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('privacy.sections.crossBorder.content')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.providers.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('privacy.sections.providers.content')}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('privacy.sections.contact.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] mb-4">
            {t('privacy.sections.contact.content')}
          </p>
          <a
            href="mailto:privacy@watheqai.app"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t('privacy.sections.contact.button')}
          </a>
        </section>

        {/* SDAIA Reference */}
        <section className="border-t border-[color:var(--hairline-soft)] pt-8">
          <p className="text-sm text-[color:var(--ink-soft)]">
            {t('privacy.sdaiaReference')}
          </p>
        </section>
      </div>
    </div>
  );
}
