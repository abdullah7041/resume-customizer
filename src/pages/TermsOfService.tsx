import { useTranslation } from 'react-i18next';

export function TermsOfService() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-[color:var(--surface)] py-12 px-4">
      <div className="max-w-4xl mx-auto rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface-glass)] backdrop-blur-md p-8 md:p-12">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] mb-2">
          {t('terms.title', 'Terms of Service')}
        </h1>
        <p className="text-[color:var(--ink-muted)] mb-8">
          {t('terms.lastUpdated', 'Last Updated')}: {new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}
        </p>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.intro.title', 'Introduction')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.intro.content', 'These Terms of Service ("Terms") govern your access to and use of Watheq\'s AI-powered resume optimization tools and related services (the "Service"). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.')}
          </p>
        </section>

        {/* Eligibility */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.eligibility.title', 'Eligibility')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.eligibility.content', 'You must be at least 18 years old and legally able to enter into contracts to use Watheq. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization.')}
          </p>
        </section>

        {/* Account & Security */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.account.title', 'Account & Security')}
          </h2>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('terms.sections.account.items.accurate', 'Provide accurate and complete registration information.')}</li>
            <li>{t('terms.sections.account.items.security', 'Maintain the confidentiality of your account credentials.')}</li>
            <li>{t('terms.sections.account.items.activity', 'You are responsible for all activity under your account.')}</li>
          </ul>
        </section>

        {/* Acceptable Use */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.use.title', 'Acceptable Use')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed mb-4">
            {t('terms.sections.use.content', 'You agree not to misuse the Service, including but not limited to:')}
          </p>
          <ul className="list-disc list-inside text-[color:var(--ink-muted)] space-y-2">
            <li>{t('terms.sections.use.items.upload', 'Uploading resumes or content that you do not have the right to use.')}</li>
            <li>{t('terms.sections.use.items.abuse', 'Attempting to gain unauthorized access to systems or data.')}</li>
            <li>{t('terms.sections.use.items.automate', 'Using automated means to scrape, mine, or interfere with the Service.')}</li>
            <li>{t('terms.sections.use.items.misrepresent', 'Misrepresenting AI-generated outputs as human-written without disclosure.')}</li>
          </ul>
        </section>

        {/* AI-Generated Content Disclaimer */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.aiDisclaimer.title', 'AI-Generated Content Disclaimer')}
          </h2>
          <div className="bg-[color:var(--surface-strong)] border border-[color:var(--glass-border)] rounded-lg p-4">
            <p className="text-[color:var(--ink-muted)] leading-relaxed">
              {t('terms.sections.aiDisclaimer.content', 'Watheq uses artificial intelligence to analyze resumes and suggest improvements. AI outputs are suggestions only and may contain errors or omissions. You are solely responsible for reviewing, verifying, and deciding whether to use any AI-generated content. Watheq does not guarantee employment outcomes, interview success, or accuracy of AI suggestions.')}
            </p>
          </div>
        </section>

        {/* Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.ip.title', 'Intellectual Property')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.ip.content', 'Watheq retains all rights to its software, branding, and AI models. You retain ownership of your original resume content. AI-generated suggestions are provided for your personal use and may not be resold or repackaged as a competing service.')}
          </p>
        </section>

        {/* Termination */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.termination.title', 'Termination')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.termination.content', 'You may stop using the Service at any time. Watheq may suspend or terminate access if you violate these Terms. Upon termination, your data will be handled in accordance with our Privacy Policy.')}
          </p>
        </section>

        {/* Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.liability.title', 'Limitation of Liability')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.liability.content', 'To the maximum extent permitted by applicable law, Watheq and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including reliance on AI-generated suggestions.')}
          </p>
        </section>

        {/* Governing Law */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.law.title', 'Governing Law')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.law.content', 'These Terms are governed by the laws of the Kingdom of Saudi Arabia. Any disputes shall be subject to the jurisdiction of Saudi courts.')}
          </p>
        </section>

        {/* Changes */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.changes.title', 'Changes to These Terms')}
          </h2>
          <p className="text-[color:var(--ink-muted)] leading-relaxed">
            {t('terms.sections.changes.content', 'We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.')}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[color:var(--ink)] mb-4">
            {t('terms.sections.contact.title', 'Contact Us')}
          </h2>
          <p className="text-[color:var(--ink-muted)] mb-4">
            {t('terms.sections.contact.content', 'For legal or terms-related questions:')}
          </p>
          <a
            href="mailto:legal@watheqai.app"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t('terms.sections.contact.button', 'Contact Legal Team')}
          </a>
          <p className="text-[color:var(--ink-muted)] mt-4">
            {t('terms.sections.contact.support', 'For general product support:')}{' '}
            <a href="mailto:support@watheqai.app" className="text-emerald-600 hover:underline">
              support@watheqai.app
            </a>
          </p>
        </section>

        <section className="border-t border-[color:var(--hairline-soft)] pt-8">
          <p className="text-sm text-[color:var(--ink-muted)]">
            {t('terms.pdplReference', 'These Terms incorporate our obligations under the Saudi Personal Data Protection Law (PDPL) and our Privacy Policy.')}
          </p>
        </section>
      </div>
    </div>
  );
}
