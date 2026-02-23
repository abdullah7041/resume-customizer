import { useTranslation } from 'react-i18next';

export function PrivacyPolicy() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('privacy.title')}
        </h1>
        <p className="text-gray-500 mb-8">
          {t('privacy.lastUpdated')}: {new Date().toLocaleDateString(isArabic ? 'ar-SA' : 'en-US')}
        </p>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.intro.title')}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {t('privacy.sections.intro.content')}
          </p>
        </section>

        {/* Data Controller */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.controller.title')}
          </h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-600">{t('privacy.sections.controller.name')}</p>
            <p className="text-gray-600">{t('privacy.sections.controller.address')}</p>
            <p className="text-gray-600">{t('privacy.sections.controller.email')}</p>
          </div>
        </section>

        {/* Data We Collect */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.dataCollected.title')}
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-800">{t('privacy.sections.dataCollected.personal.title')}</h3>
              <ul className={"list-disc list-inside text-gray-600 mt-2 space-y-1"}>
                <li>{t('privacy.sections.dataCollected.personal.items.name')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.email')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.phone')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.resume')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{t('privacy.sections.dataCollected.technical.title')}</h3>
              <ul className={"list-disc list-inside text-gray-600 mt-2 space-y-1"}>
                <li>{t('privacy.sections.dataCollected.technical.items.ip')}</li>
                <li>{t('privacy.sections.dataCollected.technical.items.browser')}</li>
                <li>{t('privacy.sections.dataCollected.technical.items.device')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Purpose of Processing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.purpose.title')}
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>{t('privacy.sections.purpose.items.service')}</li>
            <li>{t('privacy.sections.purpose.items.improvement')}</li>
            <li>{t('privacy.sections.purpose.items.communication')}</li>
            <li>{t('privacy.sections.purpose.items.legal')}</li>
          </ul>
        </section>

        {/* Legal Basis - PDPL Specific */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.legalBasis.title')}
          </h2>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-gray-700 leading-relaxed">
              {t('privacy.sections.legalBasis.content')}
            </p>
          </div>
        </section>

        {/* Your Rights - PDPL Article 4 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.rights.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.access.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.access.description')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.rectification.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.rectification.description')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.deletion.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.deletion.description')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.portability.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.portability.description')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.withdraw.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.withdraw.description')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">{t('privacy.sections.rights.complaint.title')}</h3>
              <p className="text-sm text-gray-600">{t('privacy.sections.rights.complaint.description')}</p>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.retention.title')}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {t('privacy.sections.retention.content')}
          </p>
        </section>

        {/* Cross-Border Transfers */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.crossBorder.title')}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {t('privacy.sections.crossBorder.content')}
          </p>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('privacy.sections.contact.title')}
          </h2>
          <p className="text-gray-600 mb-4">
            {t('privacy.sections.contact.content')}
          </p>
          <a
            href="mailto:privacy@resumeoptimizer.sa"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t('privacy.sections.contact.button')}
          </a>
        </section>

        {/* SDAIA Reference */}
        <section className="border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-500">
            {t('privacy.sdaiaReference')}
          </p>
        </section>
      </div>
    </div>
  );
}




