import { useTranslation } from 'react-i18next';

const TERMS_EFFECTIVE_DATE = new Date('2026-08-15T00:00:00.000Z');
const TERMS_DATE_FORMATTERS = {
  ar: new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
};

export function TermsOfService() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const effectiveDate = TERMS_DATE_FORMATTERS[isArabic ? 'ar' : 'en'].format(TERMS_EFFECTIVE_DATE);

  return (
    <div className="min-h-screen bg-[color:var(--surface)] py-12 px-4">
      <div className="max-w-4xl mx-auto rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface-glass)] backdrop-blur-md p-8 md:p-12">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] mb-2">
          {t('terms.title', 'Terms of Service')}
        </h1>
        <p className="text-[color:var(--ink-muted)] mb-8">
          {t('terms.lastUpdated')}: {effectiveDate}
        </p>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.intro.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.intro.content')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.beta.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.beta.content')}
          </p>
        </section>

        {/* Eligibility */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.eligibility.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.eligibility.content')}
          </p>
        </section>

        {/* Account & Security */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.account.title')}
          </h2>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('terms.sections.account.items.accurate')}</li>
            <li>{t('terms.sections.account.items.security')}</li>
            <li>{t('terms.sections.account.items.activity')}</li>
          </ul>
        </section>

        {/* Acceptable Use */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.use.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed mb-4">
            {t('terms.sections.use.content')}
          </p>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('terms.sections.use.items.upload')}</li>
            <li>{t('terms.sections.use.items.abuse')}</li>
            <li>{t('terms.sections.use.items.automate')}</li>
            <li>{t('terms.sections.use.items.misrepresent')}</li>
          </ul>
        </section>

        {/* AI-Generated Content Disclaimer */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.aiDisclaimer.title')}
          </h2>
          <div className="bg-[color:var(--surface-strong)] border border-[color:var(--glass-border)] rounded-lg p-4">
            <p className="text-[color:var(--ink-muted)] leading-relaxed">
              {t('terms.sections.aiDisclaimer.content')}
            </p>
          </div>
        </section>

        {/* Payments */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.payments.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.payments.content')}
          </p>
        </section>

        {/* Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.ip.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.ip.content')}
          </p>
        </section>

        {/* Termination */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.termination.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.termination.content')}
          </p>
        </section>

        {/* Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.liability.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.liability.content')}
          </p>
        </section>

        {/* Governing Law */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.law.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.law.content')}
          </p>
        </section>

        {/* Changes */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.changes.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.changes.content')}
          </p>
        </section>

        {/* Language */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.language.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.language.content')}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.contact.title')}
          </h2>
          <p className="text-[color:var(--ink-muted)] mb-4">
            {t('terms.sections.contact.content')}
          </p>
          <a
            href="mailto:legal@watheqai.app"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t('terms.sections.contact.button')}
          </a>
          <p className="text-[color:var(--ink-muted)] mt-4">
            {t('terms.sections.contact.support')}{' '}
            <a href="mailto:support@watheqai.app" className="text-emerald-600 hover:underline">
              support@watheqai.app
            </a>
          </p>
        </section>

        <section className="border-t border-[color:var(--hairline-soft)] pt-8">
          <p className="text-sm text-[color:var(--ink-muted)]">
            {t('terms.pdplReference')}
          </p>
        </section>
      </div>
    </div>
  );
}
