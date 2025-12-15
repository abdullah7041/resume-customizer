# Claude Code Instruction: Saudi PDPL Compliance, Vision 2030 Skills Tagging & Arabic Resume Parsing

## Context
You are implementing three critical features for a Resume Optimization SaaS targeting Saudi Arabia:
1. **Saudi PDPL Compliance** - Legal compliance with Saudi Personal Data Protection Law
2. **Vision 2030 Skills Tagging** - Highlight skills aligned with national priorities
3. **Arabic Resume Parsing** - Process Arabic-language resumes and job descriptions

## Prerequisites
- Arabic RTL support already implemented (i18next, DirectionProvider)
- Supabase configured for auth/storage
- OpenAI API configured for AI features

---

# PART 1: SAUDI PDPL COMPLIANCE

## Overview
Saudi Arabia's Personal Data Protection Law (PDPL) came into effect September 2023. Key requirements:
- Explicit consent before collecting personal data
- Clear privacy policy in Arabic
- Right to access, correct, and delete personal data
- Data breach notification procedures
- Cross-border transfer restrictions

## Step 1.1: Install Dependencies

```bash
npm install js-cookie zustand
```

## Step 1.2: Create Consent Store

Create file: `src/lib/stores/consentStore.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

export interface ConsentState {
  // Consent flags
  analyticsConsent: boolean;
  marketingConsent: boolean;
  functionalConsent: boolean;
  dataProcessingConsent: boolean;
  
  // Metadata
  consentTimestamp: string | null;
  consentVersion: string;
  
  // Actions
  setConsent: (type: keyof Pick<ConsentState, 'analyticsConsent' | 'marketingConsent' | 'functionalConsent' | 'dataProcessingConsent'>, value: boolean) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  hasConsented: () => boolean;
  getConsentRecord: () => ConsentRecord;
}

export interface ConsentRecord {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  dataProcessing: boolean;
  timestamp: string;
  version: string;
  ipCountry?: string;
}

const CONSENT_VERSION = '1.0.0';

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      analyticsConsent: false,
      marketingConsent: false,
      functionalConsent: true, // Required for app to work
      dataProcessingConsent: false,
      consentTimestamp: null,
      consentVersion: CONSENT_VERSION,

      setConsent: (type, value) => {
        set({ 
          [type]: value,
          consentTimestamp: new Date().toISOString(),
        });
        
        // Sync to cookie for server-side access
        const state = get();
        Cookies.set('pdpl_consent', JSON.stringify(state.getConsentRecord()), {
          expires: 365,
          sameSite: 'strict',
          secure: true,
        });
      },

      acceptAll: () => {
        const timestamp = new Date().toISOString();
        set({
          analyticsConsent: true,
          marketingConsent: true,
          functionalConsent: true,
          dataProcessingConsent: true,
          consentTimestamp: timestamp,
        });
        
        Cookies.set('pdpl_consent', JSON.stringify({
          analytics: true,
          marketing: true,
          functional: true,
          dataProcessing: true,
          timestamp,
          version: CONSENT_VERSION,
        }), {
          expires: 365,
          sameSite: 'strict',
          secure: true,
        });
      },

      rejectAll: () => {
        const timestamp = new Date().toISOString();
        set({
          analyticsConsent: false,
          marketingConsent: false,
          functionalConsent: true, // Keep functional
          dataProcessingConsent: false,
          consentTimestamp: timestamp,
        });
        
        Cookies.set('pdpl_consent', JSON.stringify({
          analytics: false,
          marketing: false,
          functional: true,
          dataProcessing: false,
          timestamp,
          version: CONSENT_VERSION,
        }), {
          expires: 365,
          sameSite: 'strict',
          secure: true,
        });
      },

      hasConsented: () => {
        return get().consentTimestamp !== null;
      },

      getConsentRecord: () => ({
        analytics: get().analyticsConsent,
        marketing: get().marketingConsent,
        functional: get().functionalConsent,
        dataProcessing: get().dataProcessingConsent,
        timestamp: get().consentTimestamp || new Date().toISOString(),
        version: get().consentVersion,
      }),
    }),
    {
      name: 'pdpl-consent-storage',
    }
  )
);
```

## Step 1.3: Create Consent Banner Component

Create file: `src/components/compliance/ConsentBanner.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsentStore } from '../../lib/stores/consentStore';
import { useDirection } from '../providers/DirectionProvider';
import { X, Shield, ChevronDown, ChevronUp } from 'lucide-react';

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
```

## Step 1.4: Create Privacy Policy Page

Create file: `src/pages/PrivacyPolicy.tsx`
```typescript
import { useTranslation } from 'react-i18next';
import { useDirection } from '../components/providers/DirectionProvider';

export function PrivacyPolicy() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useDirection();
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
              <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
                <li>{t('privacy.sections.dataCollected.personal.items.name')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.email')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.phone')}</li>
                <li>{t('privacy.sections.dataCollected.personal.items.resume')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{t('privacy.sections.dataCollected.technical.title')}</h3>
              <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
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
            href="mailto:privacy@yourcompany.com"
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
```

## Step 1.5: Create User Data Management Component

Create file: `src/components/compliance/UserDataRights.tsx`
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface UserDataRightsProps {
  userId: string;
  onExportData: () => Promise<Blob>;
  onDeleteAccount: () => Promise<void>;
}

export function UserDataRights({ userId, onExportData, onDeleteAccount }: UserDataRightsProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await onExportData();
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      // Redirect to home or show success
      window.location.href = '/';
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {t('dataRights.title')}
      </h2>

      {/* Export Data */}
      <div className="border-b border-gray-100 pb-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{t('dataRights.export.title')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dataRights.export.description')}</p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <span className="animate-spin">⏳</span>
            ) : exportSuccess ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? t('dataRights.export.exporting') : t('dataRights.export.button')}
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{t('dataRights.delete.title')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('dataRights.delete.description')}</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('dataRights.delete.button')}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('dataRights.delete.confirm.title')}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t('dataRights.delete.confirm.message')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? t('dataRights.delete.deleting') : t('dataRights.delete.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Step 1.6: Create Netlify Function for Data Export

Create file: `netlify/functions/export-user-data.ts`
```typescript
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User ID required' }) };
    }

    // Fetch all user data
    const [
      { data: profile },
      { data: resumes },
      { data: analyses },
      { data: consents },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('resumes').select('*').eq('user_id', userId),
      supabase.from('analyses').select('*').eq('user_id', userId),
      supabase.from('consent_records').select('*').eq('user_id', userId),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: 'PDPL_DATA_EXPORT',
      userData: {
        profile,
        resumes,
        analyses,
        consentHistory: consents,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user-data-export-${userId}.json"`,
      },
      body: JSON.stringify(exportData, null, 2),
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Export failed' }),
    };
  }
};
```

## Step 1.7: Create Netlify Function for Account Deletion

Create file: `netlify/functions/delete-user-data.ts`
```typescript
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId, confirmDelete } = JSON.parse(event.body || '{}');

    if (!userId || !confirmDelete) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User ID and confirmation required' }) };
    }

    // Delete in order (respecting foreign keys)
    await supabase.from('analyses').delete().eq('user_id', userId);
    await supabase.from('resumes').delete().eq('user_id', userId);
    await supabase.from('consent_records').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
    
    // Delete auth user
    await supabase.auth.admin.deleteUser(userId);

    // Log deletion for compliance
    await supabase.from('deletion_log').insert({
      user_id_hash: await hashUserId(userId), // Store hash, not actual ID
      deletion_date: new Date().toISOString(),
      reason: 'USER_REQUEST_PDPL',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Account deleted' }),
    };
  } catch (error) {
    console.error('Deletion error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Deletion failed' }),
    };
  }
};

async function hashUserId(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userId + process.env.HASH_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## Step 1.8: Add Privacy Translations

Add to `src/locales/en.json`:
```json
{
  "consent": {
    "title": "We Value Your Privacy",
    "description": "We use cookies and process your data to provide and improve our services. In compliance with Saudi PDPL, we need your consent.",
    "managePreferences": "Manage preferences",
    "acceptAll": "Accept All",
    "rejectOptional": "Reject Optional",
    "privacyPolicy": "Privacy Policy",
    "required": "Required",
    "pdplReference": "Compliant with Saudi Personal Data Protection Law (PDPL) - Royal Decree M/19",
    "functional": {
      "title": "Functional Cookies",
      "description": "Essential for the website to function. Cannot be disabled."
    },
    "dataProcessing": {
      "title": "Resume Data Processing",
      "description": "Allow AI to analyze and optimize your resume content."
    },
    "analytics": {
      "title": "Analytics",
      "description": "Help us understand how you use our service to improve it."
    },
    "marketing": {
      "title": "Marketing",
      "description": "Receive personalized offers and updates."
    }
  },
  "privacy": {
    "title": "Privacy Policy",
    "lastUpdated": "Last Updated",
    "sections": {
      "intro": {
        "title": "Introduction",
        "content": "AI Resume Optimizer (\"we\", \"us\", \"our\") is committed to protecting your personal data in accordance with the Saudi Personal Data Protection Law (PDPL). This policy explains how we collect, use, and protect your information."
      },
      "controller": {
        "title": "Data Controller",
        "name": "AI Resume Optimizer",
        "address": "Riyadh, Kingdom of Saudi Arabia",
        "email": "privacy@resumeoptimizer.sa"
      },
      "dataCollected": {
        "title": "Data We Collect",
        "personal": {
          "title": "Personal Data",
          "items": {
            "name": "Full name",
            "email": "Email address",
            "phone": "Phone number (optional)",
            "resume": "Resume content and work history"
          }
        },
        "technical": {
          "title": "Technical Data",
          "items": {
            "ip": "IP address",
            "browser": "Browser type and version",
            "device": "Device information"
          }
        }
      },
      "purpose": {
        "title": "Purpose of Processing",
        "items": {
          "service": "To provide resume optimization services",
          "improvement": "To improve our AI algorithms and services",
          "communication": "To communicate with you about your account",
          "legal": "To comply with legal obligations"
        }
      },
      "legalBasis": {
        "title": "Legal Basis for Processing",
        "content": "Under Saudi PDPL Article 5, we process your data based on: (1) Your explicit consent, (2) Performance of our contract with you, (3) Our legitimate business interests, (4) Legal obligations."
      },
      "rights": {
        "title": "Your Rights Under PDPL",
        "access": {
          "title": "Right to Access",
          "description": "Request a copy of all personal data we hold about you."
        },
        "rectification": {
          "title": "Right to Rectification",
          "description": "Request correction of inaccurate personal data."
        },
        "deletion": {
          "title": "Right to Deletion",
          "description": "Request deletion of your personal data."
        },
        "portability": {
          "title": "Right to Portability",
          "description": "Receive your data in a structured, machine-readable format."
        },
        "withdraw": {
          "title": "Right to Withdraw Consent",
          "description": "Withdraw your consent at any time without affecting prior processing."
        },
        "complaint": {
          "title": "Right to Complain",
          "description": "Lodge a complaint with SDAIA if you believe your rights have been violated."
        }
      },
      "retention": {
        "title": "Data Retention",
        "content": "We retain your personal data for as long as your account is active or as needed to provide services. Resume data is deleted 30 days after account deletion. Some data may be retained longer for legal compliance."
      },
      "crossBorder": {
        "title": "Cross-Border Data Transfers",
        "content": "Your data is primarily processed within Saudi Arabia. If transferred internationally, we ensure adequate protection measures are in place as required by PDPL Article 29."
      },
      "contact": {
        "title": "Contact Us",
        "content": "For any privacy-related questions or to exercise your rights, contact our Data Protection Officer:",
        "button": "Contact Privacy Team"
      }
    },
    "sdaiaReference": "This policy complies with the Saudi Personal Data Protection Law (PDPL) issued by Royal Decree M/19 dated 9/2/1443H. For more information about your data protection rights, visit the Saudi Data & AI Authority (SDAIA) website."
  },
  "dataRights": {
    "title": "Your Data Rights",
    "export": {
      "title": "Export Your Data",
      "description": "Download all personal data we have stored about you in JSON format.",
      "button": "Export Data",
      "exporting": "Exporting..."
    },
    "delete": {
      "title": "Delete Account",
      "description": "Permanently delete your account and all associated data. This action cannot be undone.",
      "button": "Delete Account",
      "deleting": "Deleting...",
      "confirm": {
        "title": "Delete Account?",
        "message": "This will permanently delete all your data including resumes, analyses, and account information. This action cannot be undone."
      },
      "confirmButton": "Yes, Delete Everything"
    }
  }
}
```

Add to `src/locales/ar.json`:
```json
{
  "consent": {
    "title": "نحن نقدر خصوصيتك",
    "description": "نستخدم ملفات تعريف الارتباط ونعالج بياناتك لتقديم خدماتنا وتحسينها. وفقاً لنظام حماية البيانات الشخصية السعودي، نحتاج موافقتك.",
    "managePreferences": "إدارة التفضيلات",
    "acceptAll": "قبول الكل",
    "rejectOptional": "رفض الاختياري",
    "privacyPolicy": "سياسة الخصوصية",
    "required": "مطلوب",
    "pdplReference": "متوافق مع نظام حماية البيانات الشخصية السعودي - المرسوم الملكي رقم م/19",
    "functional": {
      "title": "ملفات تعريف الارتباط الوظيفية",
      "description": "ضرورية لعمل الموقع. لا يمكن تعطيلها."
    },
    "dataProcessing": {
      "title": "معالجة بيانات السيرة الذاتية",
      "description": "السماح للذكاء الاصطناعي بتحليل وتحسين محتوى سيرتك الذاتية."
    },
    "analytics": {
      "title": "التحليلات",
      "description": "مساعدتنا في فهم كيفية استخدامك لخدمتنا لتحسينها."
    },
    "marketing": {
      "title": "التسويق",
      "description": "تلقي العروض والتحديثات المخصصة."
    }
  },
  "privacy": {
    "title": "سياسة الخصوصية",
    "lastUpdated": "آخر تحديث",
    "sections": {
      "intro": {
        "title": "مقدمة",
        "content": "يلتزم محسّن السيرة الذاتية بالذكاء الاصطناعي (\"نحن\") بحماية بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي. توضح هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها."
      },
      "controller": {
        "title": "المتحكم في البيانات",
        "name": "محسّن السيرة الذاتية بالذكاء الاصطناعي",
        "address": "الرياض، المملكة العربية السعودية",
        "email": "privacy@resumeoptimizer.sa"
      },
      "dataCollected": {
        "title": "البيانات التي نجمعها",
        "personal": {
          "title": "البيانات الشخصية",
          "items": {
            "name": "الاسم الكامل",
            "email": "البريد الإلكتروني",
            "phone": "رقم الهاتف (اختياري)",
            "resume": "محتوى السيرة الذاتية والخبرة العملية"
          }
        },
        "technical": {
          "title": "البيانات التقنية",
          "items": {
            "ip": "عنوان IP",
            "browser": "نوع وإصدار المتصفح",
            "device": "معلومات الجهاز"
          }
        }
      },
      "purpose": {
        "title": "أغراض المعالجة",
        "items": {
          "service": "لتقديم خدمات تحسين السيرة الذاتية",
          "improvement": "لتحسين خوارزميات الذكاء الاصطناعي وخدماتنا",
          "communication": "للتواصل معك بشأن حسابك",
          "legal": "للامتثال للالتزامات القانونية"
        }
      },
      "legalBasis": {
        "title": "الأساس القانوني للمعالجة",
        "content": "بموجب المادة 5 من نظام حماية البيانات الشخصية، نعالج بياناتك بناءً على: (1) موافقتك الصريحة، (2) تنفيذ عقدنا معك، (3) مصالحنا التجارية المشروعة، (4) الالتزامات القانونية."
      },
      "rights": {
        "title": "حقوقك بموجب نظام حماية البيانات الشخصية",
        "access": {
          "title": "حق الوصول",
          "description": "طلب نسخة من جميع البيانات الشخصية التي نحتفظ بها عنك."
        },
        "rectification": {
          "title": "حق التصحيح",
          "description": "طلب تصحيح البيانات الشخصية غير الدقيقة."
        },
        "deletion": {
          "title": "حق الحذف",
          "description": "طلب حذف بياناتك الشخصية."
        },
        "portability": {
          "title": "حق نقل البيانات",
          "description": "استلام بياناتك بتنسيق منظم وقابل للقراءة آلياً."
        },
        "withdraw": {
          "title": "حق سحب الموافقة",
          "description": "سحب موافقتك في أي وقت دون التأثير على المعالجة السابقة."
        },
        "complaint": {
          "title": "حق تقديم شكوى",
          "description": "تقديم شكوى إلى سدايا إذا كنت تعتقد أن حقوقك قد انتُهكت."
        }
      },
      "retention": {
        "title": "الاحتفاظ بالبيانات",
        "content": "نحتفظ ببياناتك الشخصية طالما أن حسابك نشط أو حسب الحاجة لتقديم الخدمات. يتم حذف بيانات السيرة الذاتية بعد 30 يوماً من حذف الحساب. قد يتم الاحتفاظ ببعض البيانات لفترة أطول للامتثال القانوني."
      },
      "crossBorder": {
        "title": "نقل البيانات عبر الحدود",
        "content": "تتم معالجة بياناتك بشكل أساسي داخل المملكة العربية السعودية. في حالة نقلها دولياً، نضمن اتخاذ تدابير الحماية الكافية كما هو مطلوب بموجب المادة 29 من النظام."
      },
      "contact": {
        "title": "اتصل بنا",
        "content": "لأي استفسارات متعلقة بالخصوصية أو لممارسة حقوقك، تواصل مع مسؤول حماية البيانات لدينا:",
        "button": "التواصل مع فريق الخصوصية"
      }
    },
    "sdaiaReference": "تتوافق هذه السياسة مع نظام حماية البيانات الشخصية السعودي الصادر بالمرسوم الملكي رقم م/19 بتاريخ 9/2/1443هـ. لمزيد من المعلومات حول حقوق حماية بياناتك، قم بزيارة موقع الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)."
  },
  "dataRights": {
    "title": "حقوق بياناتك",
    "export": {
      "title": "تصدير بياناتك",
      "description": "تنزيل جميع البيانات الشخصية المخزنة لدينا عنك بتنسيق JSON.",
      "button": "تصدير البيانات",
      "exporting": "جاري التصدير..."
    },
    "delete": {
      "title": "حذف الحساب",
      "description": "حذف حسابك وجميع البيانات المرتبطة به نهائياً. لا يمكن التراجع عن هذا الإجراء.",
      "button": "حذف الحساب",
      "deleting": "جاري الحذف...",
      "confirm": {
        "title": "حذف الحساب؟",
        "message": "سيؤدي هذا إلى حذف جميع بياناتك نهائياً بما في ذلك السير الذاتية والتحليلات ومعلومات الحساب. لا يمكن التراجع عن هذا الإجراء."
      },
      "confirmButton": "نعم، احذف كل شيء"
    }
  }
}
```

---

# PART 2: VISION 2030 SKILLS TAGGING

## Overview
Saudi Vision 2030 prioritizes specific sectors and skills. This feature will:
- Identify skills in resumes that align with Vision 2030 priorities
- Show a "Vision 2030 Alignment Score"
- Suggest relevant skills the user could add

## Step 2.1: Create Vision 2030 Skills Database

Create file: `src/lib/data/vision2030Skills.ts`
```typescript
export interface Vision2030Sector {
  id: string;
  nameEn: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  skills: Vision2030Skill[];
}

export interface Vision2030Skill {
  nameEn: string;
  nameAr: string;
  keywords: string[]; // For matching
  keywordsAr: string[];
  weight: number; // 1-3, higher = more important
}

export const VISION_2030_SECTORS: Vision2030Sector[] = [
  {
    id: 'technology',
    nameEn: 'Technology & Digital Transformation',
    nameAr: 'التقنية والتحول الرقمي',
    description: 'Building a digital economy and smart government',
    descriptionAr: 'بناء اقتصاد رقمي وحكومة ذكية',
    icon: '💻',
    skills: [
      {
        nameEn: 'Artificial Intelligence',
        nameAr: 'الذكاء الاصطناعي',
        keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'nlp', 'computer vision'],
        keywordsAr: ['ذكاء اصطناعي', 'تعلم آلي', 'تعلم عميق', 'شبكات عصبية'],
        weight: 3,
      },
      {
        nameEn: 'Cloud Computing',
        nameAr: 'الحوسبة السحابية',
        keywords: ['cloud', 'aws', 'azure', 'gcp', 'google cloud', 'saas', 'paas', 'iaas', 'kubernetes', 'docker'],
        keywordsAr: ['سحابة', 'حوسبة سحابية', 'أمازون ويب'],
        weight: 3,
      },
      {
        nameEn: 'Cybersecurity',
        nameAr: 'الأمن السيبراني',
        keywords: ['cybersecurity', 'security', 'penetration testing', 'ethical hacking', 'soc', 'siem', 'firewall', 'encryption'],
        keywordsAr: ['أمن سيبراني', 'أمن المعلومات', 'اختبار الاختراق'],
        weight: 3,
      },
      {
        nameEn: 'Data Science & Analytics',
        nameAr: 'علوم البيانات والتحليلات',
        keywords: ['data science', 'data analytics', 'big data', 'hadoop', 'spark', 'tableau', 'power bi', 'sql', 'python', 'r'],
        keywordsAr: ['علوم البيانات', 'تحليل البيانات', 'البيانات الضخمة'],
        weight: 3,
      },
      {
        nameEn: 'Software Development',
        nameAr: 'تطوير البرمجيات',
        keywords: ['software development', 'programming', 'coding', 'javascript', 'python', 'java', 'react', 'node', 'mobile development'],
        keywordsAr: ['تطوير برمجيات', 'برمجة', 'تطبيقات'],
        weight: 2,
      },
      {
        nameEn: 'Blockchain',
        nameAr: 'البلوك تشين',
        keywords: ['blockchain', 'web3', 'smart contracts', 'solidity', 'ethereum', 'crypto'],
        keywordsAr: ['بلوك تشين', 'عقود ذكية', 'العملات الرقمية'],
        weight: 2,
      },
    ],
  },
  {
    id: 'tourism',
    nameEn: 'Tourism & Entertainment',
    nameAr: 'السياحة والترفيه',
    description: 'Developing world-class tourism destinations',
    descriptionAr: 'تطوير وجهات سياحية عالمية المستوى',
    icon: '🏛️',
    skills: [
      {
        nameEn: 'Hospitality Management',
        nameAr: 'إدارة الضيافة',
        keywords: ['hospitality', 'hotel management', 'guest services', 'concierge', 'front desk', 'resort'],
        keywordsAr: ['ضيافة', 'إدارة فنادق', 'خدمات الضيوف'],
        weight: 3,
      },
      {
        nameEn: 'Event Management',
        nameAr: 'إدارة الفعاليات',
        keywords: ['event management', 'event planning', 'conference', 'exhibition', 'festival', 'concert'],
        keywordsAr: ['إدارة فعاليات', 'تنظيم مؤتمرات', 'معارض'],
        weight: 3,
      },
      {
        nameEn: 'Tourism Marketing',
        nameAr: 'التسويق السياحي',
        keywords: ['tourism marketing', 'destination marketing', 'travel agency', 'tour operator'],
        keywordsAr: ['تسويق سياحي', 'وكالة سفر', 'سياحة'],
        weight: 2,
      },
      {
        nameEn: 'Cultural Heritage',
        nameAr: 'التراث الثقافي',
        keywords: ['cultural heritage', 'museum', 'archaeology', 'preservation', 'history', 'unesco'],
        keywordsAr: ['تراث ثقافي', 'متحف', 'آثار', 'تاريخ'],
        weight: 2,
      },
      {
        nameEn: 'Sports & Recreation',
        nameAr: 'الرياضة والترفيه',
        keywords: ['sports management', 'fitness', 'recreation', 'stadium', 'athletics', 'coaching'],
        keywordsAr: ['إدارة رياضية', 'لياقة بدنية', 'ترفيه'],
        weight: 2,
      },
    ],
  },
  {
    id: 'healthcare',
    nameEn: 'Healthcare & Life Sciences',
    nameAr: 'الرعاية الصحية وعلوم الحياة',
    description: 'Building a world-class healthcare system',
    descriptionAr: 'بناء نظام صحي عالمي المستوى',
    icon: '🏥',
    skills: [
      {
        nameEn: 'Healthcare Administration',
        nameAr: 'إدارة الرعاية الصحية',
        keywords: ['healthcare administration', 'hospital management', 'clinic management', 'health informatics'],
        keywordsAr: ['إدارة صحية', 'إدارة مستشفيات', 'معلوماتية صحية'],
        weight: 3,
      },
      {
        nameEn: 'Biotechnology',
        nameAr: 'التقنية الحيوية',
        keywords: ['biotechnology', 'biotech', 'genomics', 'pharmaceutical', 'drug development', 'clinical trials'],
        keywordsAr: ['تقنية حيوية', 'جينوم', 'أدوية'],
        weight: 3,
      },
      {
        nameEn: 'Medical Research',
        nameAr: 'البحث الطبي',
        keywords: ['medical research', 'clinical research', 'epidemiology', 'public health', 'biostatistics'],
        keywordsAr: ['بحث طبي', 'بحث سريري', 'صحة عامة'],
        weight: 3,
      },
      {
        nameEn: 'Digital Health',
        nameAr: 'الصحة الرقمية',
        keywords: ['digital health', 'telemedicine', 'health tech', 'medical devices', 'wearables', 'ehr', 'emr'],
        keywordsAr: ['صحة رقمية', 'طب عن بعد', 'أجهزة طبية'],
        weight: 3,
      },
      {
        nameEn: 'Nursing & Clinical Care',
        nameAr: 'التمريض والرعاية السريرية',
        keywords: ['nursing', 'clinical care', 'patient care', 'icu', 'emergency', 'surgery'],
        keywordsAr: ['تمريض', 'رعاية مرضى', 'عناية مركزة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'renewable-energy',
    nameEn: 'Renewable Energy & Sustainability',
    nameAr: 'الطاقة المتجددة والاستدامة',
    description: 'Leading the global energy transition',
    descriptionAr: 'قيادة التحول العالمي في مجال الطاقة',
    icon: '⚡',
    skills: [
      {
        nameEn: 'Solar Energy',
        nameAr: 'الطاقة الشمسية',
        keywords: ['solar', 'photovoltaic', 'pv', 'solar panel', 'solar farm', 'renewable'],
        keywordsAr: ['طاقة شمسية', 'ألواح شمسية', 'طاقة متجددة'],
        weight: 3,
      },
      {
        nameEn: 'Wind Energy',
        nameAr: 'طاقة الرياح',
        keywords: ['wind energy', 'wind turbine', 'wind farm', 'offshore wind'],
        keywordsAr: ['طاقة الرياح', 'توربينات'],
        weight: 3,
      },
      {
        nameEn: 'Hydrogen & Green Fuels',
        nameAr: 'الهيدروجين والوقود الأخضر',
        keywords: ['hydrogen', 'green hydrogen', 'fuel cell', 'ammonia', 'neom', 'green fuel'],
        keywordsAr: ['هيدروجين', 'هيدروجين أخضر', 'وقود أخضر'],
        weight: 3,
      },
      {
        nameEn: 'Sustainability & ESG',
        nameAr: 'الاستدامة والحوكمة البيئية',
        keywords: ['sustainability', 'esg', 'carbon neutral', 'net zero', 'environmental', 'climate'],
        keywordsAr: ['استدامة', 'حوكمة بيئية', 'صفر كربون'],
        weight: 3,
      },
      {
        nameEn: 'Energy Engineering',
        nameAr: 'هندسة الطاقة',
        keywords: ['energy engineering', 'power systems', 'grid', 'electrical engineering', 'energy storage', 'battery'],
        keywordsAr: ['هندسة طاقة', 'شبكات كهربائية', 'تخزين طاقة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'finance',
    nameEn: 'Financial Services & Fintech',
    nameAr: 'الخدمات المالية والتقنية المالية',
    description: 'Developing a thriving financial sector',
    descriptionAr: 'تطوير قطاع مالي مزدهر',
    icon: '💰',
    skills: [
      {
        nameEn: 'Fintech',
        nameAr: 'التقنية المالية',
        keywords: ['fintech', 'digital payments', 'mobile banking', 'neobank', 'payment gateway', 'stc pay', 'mada'],
        keywordsAr: ['تقنية مالية', 'مدفوعات رقمية', 'بنوك رقمية'],
        weight: 3,
      },
      {
        nameEn: 'Islamic Finance',
        nameAr: 'التمويل الإسلامي',
        keywords: ['islamic finance', 'shariah compliant', 'sukuk', 'takaful', 'murabaha', 'islamic banking'],
        keywordsAr: ['تمويل إسلامي', 'متوافق مع الشريعة', 'صكوك', 'تكافل'],
        weight: 3,
      },
      {
        nameEn: 'Investment Management',
        nameAr: 'إدارة الاستثمار',
        keywords: ['investment', 'portfolio management', 'asset management', 'wealth management', 'private equity', 'venture capital'],
        keywordsAr: ['استثمار', 'إدارة محافظ', 'إدارة أصول', 'إدارة ثروات'],
        weight: 2,
      },
      {
        nameEn: 'Risk & Compliance',
        nameAr: 'المخاطر والامتثال',
        keywords: ['risk management', 'compliance', 'aml', 'kyc', 'regulatory', 'audit', 'sama'],
        keywordsAr: ['إدارة مخاطر', 'امتثال', 'مكافحة غسيل الأموال'],
        weight: 2,
      },
    ],
  },
  {
    id: 'manufacturing',
    nameEn: 'Manufacturing & Industry 4.0',
    nameAr: 'التصنيع والثورة الصناعية الرابعة',
    description: 'Building a competitive industrial base',
    descriptionAr: 'بناء قاعدة صناعية تنافسية',
    icon: '🏭',
    skills: [
      {
        nameEn: 'Industrial Automation',
        nameAr: 'الأتمتة الصناعية',
        keywords: ['automation', 'robotics', 'plc', 'scada', 'industrial robot', 'manufacturing automation'],
        keywordsAr: ['أتمتة', 'روبوتات', 'أتمتة صناعية'],
        weight: 3,
      },
      {
        nameEn: 'Supply Chain Management',
        nameAr: 'إدارة سلسلة الإمداد',
        keywords: ['supply chain', 'logistics', 'procurement', 'inventory', 'warehouse', 'distribution'],
        keywordsAr: ['سلسلة إمداد', 'لوجستيات', 'مشتريات', 'مخازن'],
        weight: 3,
      },
      {
        nameEn: 'Quality Management',
        nameAr: 'إدارة الجودة',
        keywords: ['quality management', 'iso', 'six sigma', 'lean', 'quality assurance', 'quality control'],
        keywordsAr: ['إدارة جودة', 'ضمان جودة', 'آيزو'],
        weight: 2,
      },
      {
        nameEn: 'Advanced Manufacturing',
        nameAr: 'التصنيع المتقدم',
        keywords: ['3d printing', 'additive manufacturing', 'cnc', 'cad', 'cam', 'composite materials'],
        keywordsAr: ['طباعة ثلاثية الأبعاد', 'تصنيع إضافي', 'مواد مركبة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'education',
    nameEn: 'Education & Human Capital',
    nameAr: 'التعليم ورأس المال البشري',
    description: 'Developing future-ready talent',
    descriptionAr: 'تطوير المواهب المستعدة للمستقبل',
    icon: '🎓',
    skills: [
      {
        nameEn: 'Educational Technology',
        nameAr: 'تقنيات التعليم',
        keywords: ['edtech', 'e-learning', 'lms', 'online education', 'educational technology', 'mooc'],
        keywordsAr: ['تقنيات تعليم', 'تعلم إلكتروني', 'تعليم عن بعد'],
        weight: 3,
      },
      {
        nameEn: 'Curriculum Development',
        nameAr: 'تطوير المناهج',
        keywords: ['curriculum', 'instructional design', 'course development', 'pedagogy', 'assessment'],
        keywordsAr: ['مناهج', 'تصميم تعليمي', 'تطوير مقررات'],
        weight: 2,
      },
      {
        nameEn: 'STEM Education',
        nameAr: 'تعليم العلوم والتقنية',
        keywords: ['stem', 'science education', 'math education', 'engineering education', 'coding education'],
        keywordsAr: ['ستيم', 'تعليم علوم', 'تعليم برمجة'],
        weight: 3,
      },
      {
        nameEn: 'Corporate Training',
        nameAr: 'التدريب المؤسسي',
        keywords: ['corporate training', 'l&d', 'learning development', 'talent development', 'leadership training'],
        keywordsAr: ['تدريب مؤسسي', 'تطوير مواهب', 'تدريب قيادة'],
        weight: 2,
      },
    ],
  },
  {
    id: 'mega-projects',
    nameEn: 'Mega Projects & Construction',
    nameAr: 'المشاريع الكبرى والبناء',
    description: 'Building iconic destinations like NEOM, The Line, Red Sea Project',
    descriptionAr: 'بناء وجهات أيقونية مثل نيوم، ذا لاين، مشروع البحر الأحمر',
    icon: '🏗️',
    skills: [
      {
        nameEn: 'Project Management',
        nameAr: 'إدارة المشاريع',
        keywords: ['project management', 'pmp', 'prince2', 'agile', 'scrum', 'construction management'],
        keywordsAr: ['إدارة مشاريع', 'إدارة البناء'],
        weight: 3,
      },
      {
        nameEn: 'Architecture & Urban Planning',
        nameAr: 'العمارة والتخطيط العمراني',
        keywords: ['architecture', 'urban planning', 'urban design', 'master planning', 'sustainable design'],
        keywordsAr: ['عمارة', 'تخطيط عمراني', 'تصميم مستدام'],
        weight: 3,
      },
      {
        nameEn: 'Civil Engineering',
        nameAr: 'الهندسة المدنية',
        keywords: ['civil engineering', 'structural engineering', 'geotechnical', 'infrastructure', 'transportation'],
        keywordsAr: ['هندسة مدنية', 'هندسة إنشائية', 'بنية تحتية'],
        weight: 2,
      },
      {
        nameEn: 'BIM & Digital Construction',
        nameAr: 'نمذجة معلومات البناء والبناء الرقمي',
        keywords: ['bim', 'revit', 'digital twin', 'construction tech', 'smart building'],
        keywordsAr: ['بيم', 'نمذجة معلومات البناء', 'مباني ذكية'],
        weight: 3,
      },
    ],
  },
];

// Flat list of all skills for quick lookup
export const ALL_VISION_2030_SKILLS = VISION_2030_SECTORS.flatMap(sector => 
  sector.skills.map(skill => ({
    ...skill,
    sectorId: sector.id,
    sectorNameEn: sector.nameEn,
    sectorNameAr: sector.nameAr,
  }))
);
```

## Step 2.2: Create Vision 2030 Analyzer Utility

Create file: `src/lib/utils/vision2030Analyzer.ts`
```typescript
import { VISION_2030_SECTORS, ALL_VISION_2030_SKILLS, Vision2030Sector } from '../data/vision2030Skills';

export interface Vision2030Analysis {
  overallScore: number; // 0-100
  matchedSkills: MatchedSkill[];
  missingSuggestions: MissingSuggestion[];
  sectorBreakdown: SectorScore[];
  topSectors: string[];
}

export interface MatchedSkill {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  matchedKeyword: string;
  weight: number;
  context: string; // Where it was found in resume
}

export interface MissingSuggestion {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  relevanceScore: number;
  reason: string;
  reasonAr: string;
}

export interface SectorScore {
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  icon: string;
  score: number;
  matchedCount: number;
  totalSkills: number;
}

export function analyzeVision2030Alignment(
  resumeText: string,
  language: 'en' | 'ar' = 'en'
): Vision2030Analysis {
  const normalizedText = resumeText.toLowerCase();
  const matchedSkills: MatchedSkill[] = [];
  const sectorScores: Map<string, { matches: number; totalWeight: number; maxWeight: number }> = new Map();

  // Initialize sector scores
  VISION_2030_SECTORS.forEach(sector => {
    const maxWeight = sector.skills.reduce((sum, s) => sum + s.weight, 0);
    sectorScores.set(sector.id, { matches: 0, totalWeight: 0, maxWeight });
  });

  // Scan for skill matches
  ALL_VISION_2030_SKILLS.forEach(skill => {
    const keywords = language === 'ar' ? [...skill.keywords, ...skill.keywordsAr] : skill.keywords;
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = normalizedText.indexOf(keywordLower);
      
      if (index !== -1) {
        // Extract context (surrounding text)
        const start = Math.max(0, index - 30);
        const end = Math.min(normalizedText.length, index + keyword.length + 30);
        const context = resumeText.substring(start, end).trim();

        matchedSkills.push({
          skillNameEn: skill.nameEn,
          skillNameAr: skill.nameAr,
          sectorId: skill.sectorId,
          sectorNameEn: skill.sectorNameEn,
          sectorNameAr: skill.sectorNameAr,
          matchedKeyword: keyword,
          weight: skill.weight,
          context: `...${context}...`,
        });

        // Update sector score
        const sectorScore = sectorScores.get(skill.sectorId)!;
        sectorScore.matches++;
        sectorScore.totalWeight += skill.weight;

        break; // Only count each skill once
      }
    }
  });

  // Calculate sector breakdown
  const sectorBreakdown: SectorScore[] = VISION_2030_SECTORS.map(sector => {
    const score = sectorScores.get(sector.id)!;
    return {
      sectorId: sector.id,
      sectorNameEn: sector.nameEn,
      sectorNameAr: sector.nameAr,
      icon: sector.icon,
      score: score.maxWeight > 0 ? Math.round((score.totalWeight / score.maxWeight) * 100) : 0,
      matchedCount: score.matches,
      totalSkills: sector.skills.length,
    };
  }).sort((a, b) => b.score - a.score);

  // Calculate overall score
  const totalPossibleWeight = ALL_VISION_2030_SKILLS.reduce((sum, s) => sum + s.weight, 0);
  const totalMatchedWeight = matchedSkills.reduce((sum, s) => sum + s.weight, 0);
  const overallScore = Math.round((totalMatchedWeight / totalPossibleWeight) * 100);

  // Generate missing suggestions based on top sectors
  const topSectorIds = sectorBreakdown.slice(0, 3).map(s => s.sectorId);
  const matchedSkillNames = new Set(matchedSkills.map(s => s.skillNameEn));
  
  const missingSuggestions: MissingSuggestion[] = ALL_VISION_2030_SKILLS
    .filter(skill => 
      topSectorIds.includes(skill.sectorId) && 
      !matchedSkillNames.has(skill.nameEn) &&
      skill.weight >= 2 // Only suggest important skills
    )
    .slice(0, 5)
    .map(skill => ({
      skillNameEn: skill.nameEn,
      skillNameAr: skill.nameAr,
      sectorId: skill.sectorId,
      sectorNameEn: skill.sectorNameEn,
      sectorNameAr: skill.sectorNameAr,
      relevanceScore: skill.weight,
      reason: `High-demand skill in ${skill.sectorNameEn} sector`,
      reasonAr: `مهارة عالية الطلب في قطاع ${skill.sectorNameAr}`,
    }));

  return {
    overallScore,
    matchedSkills,
    missingSuggestions,
    sectorBreakdown,
    topSectors: topSectorIds,
  };
}
```

## Step 2.3: Create Vision 2030 Score Component

Create file: `src/components/analysis/Vision2030Score.tsx`
```typescript
import { useTranslation } from 'react-i18next';
import { useDirection } from '../providers/DirectionProvider';
import { Vision2030Analysis } from '../../lib/utils/vision2030Analyzer';
import { TrendingUp, Target, Lightbulb, ChevronRight } from 'lucide-react';

interface Vision2030ScoreProps {
  analysis: Vision2030Analysis;
}

export function Vision2030Score({ analysis }: Vision2030ScoreProps) {
  const { t, i18n } = useTranslation();
  const { isRTL } = useDirection();
  const isArabic = i18n.language === 'ar';

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 bg-emerald-100';
    if (score >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return isArabic ? 'ممتاز' : 'Excellent';
    if (score >= 40) return isArabic ? 'جيد' : 'Good';
    return isArabic ? 'يحتاج تحسين' : 'Needs Improvement';
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {isArabic ? 'توافق رؤية 2030' : 'Vision 2030 Alignment'}
          </h3>
          <p className="text-sm text-gray-500">
            {isArabic 
              ? 'مدى توافق مهاراتك مع أولويات المملكة' 
              : 'How your skills align with Saudi national priorities'}
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600">
            {isArabic ? 'النتيجة الإجمالية' : 'Overall Score'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(analysis.overallScore)}`}>
            {getScoreLabel(analysis.overallScore)}
          </span>
        </div>
        <div className="flex items-end gap-4">
          <span className="text-5xl font-bold text-emerald-600">
            {analysis.overallScore}
          </span>
          <span className="text-2xl text-gray-400 mb-1">/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${analysis.overallScore}%` }}
          />
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          {isArabic ? 'توزيع القطاعات' : 'Sector Breakdown'}
        </h4>
        <div className="space-y-3">
          {analysis.sectorBreakdown.slice(0, 5).map(sector => (
            <div key={sector.sectorId} className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{sector.icon}</span>
                  <span className="font-medium text-gray-800">
                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {sector.matchedCount}/{sector.totalSkills} {isArabic ? 'مهارات' : 'skills'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${sector.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matched Skills */}
      {analysis.matchedSkills.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-4">
            {isArabic ? 'المهارات المتوافقة' : 'Matched Vision 2030 Skills'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.matchedSkills.map((skill, index) => (
              <span 
                key={index}
                className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm"
              >
                {isArabic ? skill.skillNameAr : skill.skillNameEn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {analysis.missingSuggestions.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            {isArabic ? 'مهارات مقترحة للإضافة' : 'Suggested Skills to Add'}
          </h4>
          <div className="space-y-2">
            {analysis.missingSuggestions.map((suggestion, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-800">
                    {isArabic ? suggestion.skillNameAr : suggestion.skillNameEn}
                  </span>
                  <p className="text-xs text-gray-500">
                    {isArabic ? suggestion.reasonAr : suggestion.reason}
                  </p>
                </div>
                <ChevronRight className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vision 2030 Badge */}
      <div className="mt-6 pt-6 border-t border-emerald-200">
        <div className="flex items-center gap-3">
          <img 
            src="/vision-2030-logo.svg" 
            alt="Vision 2030"
            className="h-8 w-auto"
          />
          <p className="text-xs text-gray-500">
            {isArabic 
              ? 'التحليل مبني على أولويات القطاعات في رؤية المملكة 2030'
              : 'Analysis based on Saudi Vision 2030 sector priorities'}
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Step 2.4: Add Vision 2030 Translations

Add to `src/locales/en.json`:
```json
{
  "vision2030": {
    "title": "Vision 2030 Alignment",
    "subtitle": "How your skills align with Saudi national priorities",
    "overallScore": "Overall Score",
    "sectorBreakdown": "Sector Breakdown",
    "matchedSkills": "Matched Vision 2030 Skills",
    "suggestions": "Suggested Skills to Add",
    "excellent": "Excellent",
    "good": "Good",
    "needsImprovement": "Needs Improvement",
    "skills": "skills",
    "analysisNote": "Analysis based on Saudi Vision 2030 sector priorities"
  }
}
```

Add to `src/locales/ar.json`:
```json
{
  "vision2030": {
    "title": "توافق رؤية 2030",
    "subtitle": "مدى توافق مهاراتك مع أولويات المملكة",
    "overallScore": "النتيجة الإجمالية",
    "sectorBreakdown": "توزيع القطاعات",
    "matchedSkills": "المهارات المتوافقة مع رؤية 2030",
    "suggestions": "مهارات مقترحة للإضافة",
    "excellent": "ممتاز",
    "good": "جيد",
    "needsImprovement": "يحتاج تحسين",
    "skills": "مهارات",
    "analysisNote": "التحليل مبني على أولويات القطاعات في رؤية المملكة 2030"
  }
}
```

---

# PART 3: ARABIC RESUME PARSING

## Overview
Arabic resume parsing requires:
- RTL text extraction from PDFs
- Arabic section detection
- Bilingual (mixed Arabic/English) support
- Arabic keyword matching

## Step 3.1: Create Arabic Text Utilities

Create file: `src/lib/utils/arabicTextUtils.ts`
```typescript
/**
 * Arabic text processing utilities
 */

// Arabic Unicode ranges
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Detect if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/**
 * Detect dominant language of text
 */
export function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = (text.match(ARABIC_RANGE) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const total = arabicChars + latinChars;
  
  if (total === 0) return 'en';
  
  const arabicRatio = arabicChars / total;
  
  if (arabicRatio > 0.7) return 'ar';
  if (arabicRatio < 0.3) return 'en';
  return 'mixed';
}

/**
 * Normalize Arabic text
 * - Remove diacritics (tashkeel)
 * - Normalize alef variants
 * - Normalize yaa and taa marbuta
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove diacritics
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variants to bare alef
    .replace(/[أإآ]/g, 'ا')
    // Normalize alef maksura to yaa
    .replace(/ى/g, 'ي')
    // Normalize taa marbuta to haa
    .replace(/ة/g, 'ه');
}

/**
 * Arabic section headers for resume parsing
 */
export const ARABIC_SECTION_HEADERS = {
  personalInfo: [
    'المعلومات الشخصية',
    'البيانات الشخصية',
    'معلومات التواصل',
    'بيانات الاتصال',
  ],
  experience: [
    'الخبرات العملية',
    'الخبرة العملية',
    'الخبرات',
    'الخبرة المهنية',
    'التجربة العملية',
    'سجل العمل',
  ],
  education: [
    'التعليم',
    'المؤهلات العلمية',
    'المؤهلات الأكاديمية',
    'الشهادات العلمية',
    'التحصيل العلمي',
  ],
  skills: [
    'المهارات',
    'المهارات التقنية',
    'المهارات الفنية',
    'القدرات',
    'الكفاءات',
  ],
  certifications: [
    'الشهادات',
    'الشهادات المهنية',
    'الدورات التدريبية',
    'التدريب',
  ],
  languages: [
    'اللغات',
    'المهارات اللغوية',
  ],
  projects: [
    'المشاريع',
    'مشاريع سابقة',
    'أعمال سابقة',
  ],
  objective: [
    'الهدف الوظيفي',
    'الهدف المهني',
    'نبذة شخصية',
    'ملخص',
  ],
  references: [
    'المراجع',
    'المعرفون',
  ],
};

/**
 * Common Arabic job titles
 */
export const ARABIC_JOB_TITLES: Record<string, string> = {
  'مدير': 'Manager',
  'مدير عام': 'General Manager',
  'مدير تنفيذي': 'CEO',
  'مدير مشروع': 'Project Manager',
  'مهندس': 'Engineer',
  'مهندس برمجيات': 'Software Engineer',
  'مطور': 'Developer',
  'محلل': 'Analyst',
  'محلل بيانات': 'Data Analyst',
  'محاسب': 'Accountant',
  'مصمم': 'Designer',
  'مسؤول': 'Officer',
  'مشرف': 'Supervisor',
  'مستشار': 'Consultant',
  'أخصائي': 'Specialist',
  'فني': 'Technician',
  'مساعد': 'Assistant',
  'منسق': 'Coordinator',
  'مدير موارد بشرية': 'HR Manager',
  'مدير مبيعات': 'Sales Manager',
  'مدير تسويق': 'Marketing Manager',
  'مدير مالي': 'Financial Manager',
};

/**
 * Extract Arabic phone numbers (Saudi format)
 */
export function extractSaudiPhone(text: string): string | null {
  // Match +966 5X XXX XXXX or 05X XXX XXXX
  const patterns = [
    /\+966\s*5[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
    /00966\s*5[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
    /05[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s/g, '');
    }
  }
  return null;
}

/**
 * Extract Arabic email (handles Arabic text around email)
 */
export function extractEmail(text: string): string | null {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailPattern);
  return match ? match[0] : null;
}

/**
 * Detect resume section from text
 */
export function detectArabicSection(text: string): string | null {
  const normalizedText = normalizeArabic(text.trim());
  
  for (const [section, headers] of Object.entries(ARABIC_SECTION_HEADERS)) {
    for (const header of headers) {
      if (normalizedText.includes(normalizeArabic(header))) {
        return section;
      }
    }
  }
  return null;
}

/**
 * Split mixed Arabic/English text into segments
 */
export function splitMixedText(text: string): Array<{ text: string; lang: 'ar' | 'en' }> {
  const segments: Array<{ text: string; lang: 'ar' | 'en' }> = [];
  let currentSegment = '';
  let currentLang: 'ar' | 'en' | null = null;
  
  for (const char of text) {
    const isArabic = ARABIC_RANGE.test(char);
    const isLatin = /[a-zA-Z]/.test(char);
    
    if (isArabic && currentLang !== 'ar') {
      if (currentSegment && currentLang) {
        segments.push({ text: currentSegment, lang: currentLang });
      }
      currentSegment = char;
      currentLang = 'ar';
    } else if (isLatin && currentLang !== 'en') {
      if (currentSegment && currentLang) {
        segments.push({ text: currentSegment, lang: currentLang });
      }
      currentSegment = char;
      currentLang = 'en';
    } else {
      currentSegment += char;
    }
  }
  
  if (currentSegment && currentLang) {
    segments.push({ text: currentSegment, lang: currentLang });
  }
  
  return segments;
}
```

## Step 3.2: Create Arabic Resume Parser

Create file: `src/lib/utils/arabicResumeParser.ts`
```typescript
import {
  containsArabic,
  detectLanguage,
  normalizeArabic,
  detectArabicSection,
  extractSaudiPhone,
  extractEmail,
  ARABIC_SECTION_HEADERS,
  ARABIC_JOB_TITLES,
} from './arabicTextUtils';

export interface ParsedResume {
  language: 'ar' | 'en' | 'mixed';
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  objective?: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  languages: Language[];
  rawText: string;
}

export interface WorkExperience {
  title: string;
  titleEn?: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description: string[];
}

export interface Education {
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
}

export interface Language {
  name: string;
  level: string;
}

/**
 * Parse Arabic/bilingual resume text
 */
export function parseArabicResume(text: string): ParsedResume {
  const language = detectLanguage(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const resume: ParsedResume = {
    language,
    personalInfo: {},
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    rawText: text,
  };

  // Extract contact info
  resume.personalInfo.email = extractEmail(text);
  resume.personalInfo.phone = extractSaudiPhone(text);
  
  // Extract LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
  if (linkedinMatch) {
    resume.personalInfo.linkedin = linkedinMatch[0];
  }

  // Parse sections
  let currentSection: string | null = null;
  let sectionContent: string[] = [];

  for (const line of lines) {
    const detectedSection = detectArabicSection(line) || detectEnglishSection(line);
    
    if (detectedSection) {
      // Process previous section
      if (currentSection && sectionContent.length > 0) {
        processSection(resume, currentSection, sectionContent);
      }
      currentSection = detectedSection;
      sectionContent = [];
    } else if (currentSection) {
      sectionContent.push(line);
    } else {
      // Before any section - likely personal info or name
      if (!resume.personalInfo.name && line.length < 50 && !line.includes('@')) {
        resume.personalInfo.name = line;
      }
    }
  }

  // Process last section
  if (currentSection && sectionContent.length > 0) {
    processSection(resume, currentSection, sectionContent);
  }

  return resume;
}

function detectEnglishSection(text: string): string | null {
  const normalizedText = text.toLowerCase().trim();
  
  const sectionMap: Record<string, string[]> = {
    personalInfo: ['personal information', 'contact', 'contact info'],
    experience: ['experience', 'work experience', 'employment', 'work history', 'professional experience'],
    education: ['education', 'academic', 'qualifications'],
    skills: ['skills', 'technical skills', 'competencies', 'abilities'],
    certifications: ['certifications', 'certificates', 'training', 'courses'],
    languages: ['languages', 'language skills'],
    projects: ['projects', 'portfolio'],
    objective: ['objective', 'summary', 'profile', 'about me'],
    references: ['references'],
  };

  for (const [section, headers] of Object.entries(sectionMap)) {
    for (const header of headers) {
      if (normalizedText.includes(header)) {
        return section;
      }
    }
  }
  return null;
}

function processSection(resume: ParsedResume, section: string, content: string[]): void {
  switch (section) {
    case 'objective':
      resume.objective = content.join(' ');
      break;
      
    case 'experience':
      resume.experience = parseExperience(content);
      break;
      
    case 'education':
      resume.education = parseEducation(content);
      break;
      
    case 'skills':
      resume.skills = parseSkills(content);
      break;
      
    case 'certifications':
      resume.certifications = content.filter(c => c.length > 3);
      break;
      
    case 'languages':
      resume.languages = parseLanguages(content);
      break;
  }
}

function parseExperience(content: string[]): WorkExperience[] {
  const experiences: WorkExperience[] = [];
  let currentExp: Partial<WorkExperience> | null = null;
  
  for (const line of content) {
    // Check if this is a job title (Arabic or English)
    const isJobTitle = isLikelyJobTitle(line);
    
    if (isJobTitle && currentExp?.title) {
      // Save previous experience
      if (currentExp.title) {
        experiences.push(currentExp as WorkExperience);
      }
      currentExp = { title: line, description: [] };
    } else if (isJobTitle) {
      currentExp = { title: line, description: [] };
    } else if (currentExp) {
      // Check for company name, dates, or description
      if (isLikelyCompany(line)) {
        currentExp.company = line;
      } else if (isLikelyDate(line)) {
        // Parse dates
        const dates = extractDates(line);
        if (dates) {
          currentExp.startDate = dates.start;
          currentExp.endDate = dates.end;
          currentExp.current = dates.current;
        }
      } else {
        currentExp.description = currentExp.description || [];
        currentExp.description.push(line);
      }
    }
  }
  
  // Add last experience
  if (currentExp?.title) {
    experiences.push(currentExp as WorkExperience);
  }
  
  return experiences;
}

function isLikelyJobTitle(text: string): boolean {
  // Check Arabic job titles
  for (const arabicTitle of Object.keys(ARABIC_JOB_TITLES)) {
    if (text.includes(arabicTitle)) {
      return true;
    }
  }
  
  // Check English job titles
  const englishTitlePatterns = [
    /manager/i, /engineer/i, /developer/i, /analyst/i, /director/i,
    /specialist/i, /coordinator/i, /consultant/i, /supervisor/i,
    /officer/i, /executive/i, /lead/i, /head/i, /chief/i,
  ];
  
  return englishTitlePatterns.some(pattern => pattern.test(text));
}

function isLikelyCompany(text: string): boolean {
  const companyIndicators = [
    'شركة', 'مؤسسة', 'مجموعة', 'بنك', 'جامعة', 'مستشفى', 'وزارة',
    'company', 'inc', 'llc', 'ltd', 'corp', 'group', 'bank', 'university',
  ];
  
  return companyIndicators.some(ind => text.toLowerCase().includes(ind));
}

function isLikelyDate(text: string): boolean {
  // Check for date patterns
  const datePatterns = [
    /\d{4}/, // Year
    /\d{1,2}\/\d{4}/, // MM/YYYY
    /\d{1,2}-\d{4}/, // MM-YYYY
    /حتى الآن/, // "Until now" in Arabic
    /present/i,
    /current/i,
    /الحالي/,
  ];
  
  return datePatterns.some(pattern => pattern.test(text));
}

function extractDates(text: string): { start?: string; end?: string; current: boolean } | null {
  const current = /حتى الآن|present|current|الحالي/i.test(text);
  const years = text.match(/\d{4}/g);
  
  if (years && years.length >= 1) {
    return {
      start: years[0],
      end: years[1] || (current ? undefined : years[0]),
      current,
    };
  }
  
  return { current };
}

function parseEducation(content: string[]): Education[] {
  const education: Education[] = [];
  let current: Partial<Education> = {};
  
  const degreePatterns = [
    /بكالوريوس|bachelor/i,
    /ماجستير|master/i,
    /دكتوراه|phd|doctorate/i,
    /دبلوم|diploma/i,
    /ثانوية|high school/i,
  ];
  
  for (const line of content) {
    const isDegree = degreePatterns.some(p => p.test(line));
    
    if (isDegree) {
      if (current.degree) {
        education.push(current as Education);
      }
      current = { degree: line };
    } else if (current.degree) {
      if (isLikelyCompany(line) || line.includes('جامعة') || line.includes('كلية')) {
        current.institution = line;
      } else if (isLikelyDate(line)) {
        const dates = extractDates(line);
        current.graduationDate = dates?.end || dates?.start;
      }
    }
  }
  
  if (current.degree) {
    education.push(current as Education);
  }
  
  return education;
}

function parseSkills(content: string[]): string[] {
  const skills: string[] = [];
  
  for (const line of content) {
    // Skills often separated by commas, bullets, or listed one per line
    const lineSkills = line
      .split(/[,،•\-|]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50);
    
    skills.push(...lineSkills);
  }
  
  return [...new Set(skills)]; // Remove duplicates
}

function parseLanguages(content: string[]): Language[] {
  const languages: Language[] = [];
  
  const levelMap: Record<string, string> = {
    'اللغة الأم': 'Native',
    'ممتاز': 'Fluent',
    'جيد جداً': 'Advanced',
    'جيد': 'Intermediate',
    'متوسط': 'Intermediate',
    'مبتدئ': 'Beginner',
    'native': 'Native',
    'fluent': 'Fluent',
    'advanced': 'Advanced',
    'intermediate': 'Intermediate',
    'beginner': 'Beginner',
  };
  
  for (const line of content) {
    for (const [levelKey, levelValue] of Object.entries(levelMap)) {
      if (line.toLowerCase().includes(levelKey)) {
        const langName = line.replace(new RegExp(levelKey, 'i'), '').trim();
        if (langName) {
          languages.push({ name: langName, level: levelValue });
        }
        break;
      }
    }
  }
  
  return languages;
}
```

## Step 3.3: Create Arabic PDF Extractor Enhancement

Create file: `src/lib/utils/arabicPdfExtractor.ts`
```typescript
import * as pdfjsLib from 'pdfjs-dist';
import { containsArabic, detectLanguage } from './arabicTextUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface ExtractedPdfContent {
  text: string;
  language: 'ar' | 'en' | 'mixed';
  pageCount: number;
  hasRtl: boolean;
}

/**
 * Extract text from PDF with Arabic support
 */
export async function extractPdfWithArabicSupport(
  file: File | ArrayBuffer
): Promise<ExtractedPdfContent> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    // Enable proper Arabic text extraction
    cMapUrl: '/cmaps/',
    cMapPacked: true,
  }).promise;

  const textParts: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Process text items with RTL awareness
    const pageText = processTextItems(textContent.items as TextItem[]);
    textParts.push(pageText);
  }
  
  const fullText = textParts.join('\n\n');
  const language = detectLanguage(fullText);
  const hasRtl = containsArabic(fullText);
  
  return {
    text: fullText,
    language,
    pageCount: pdf.numPages,
    hasRtl,
  };
}

interface TextItem {
  str: string;
  dir: 'ltr' | 'rtl';
  transform: number[];
  width: number;
  height: number;
}

/**
 * Process text items with proper RTL handling
 */
function processTextItems(items: TextItem[]): string {
  // Group items by line (based on y-position)
  const lines: Map<number, TextItem[]> = new Map();
  
  for (const item of items) {
    // Round y-position to group items on same line
    const y = Math.round(item.transform[5]);
    
    if (!lines.has(y)) {
      lines.set(y, []);
    }
    lines.get(y)!.push(item);
  }
  
  // Sort lines by y-position (top to bottom)
  const sortedLines = [...lines.entries()]
    .sort(([y1], [y2]) => y2 - y1)
    .map(([, items]) => items);
  
  // Process each line
  const processedLines: string[] = [];
  
  for (const lineItems of sortedLines) {
    // Sort items within line by x-position
    // For RTL text, we need to consider text direction
    const hasArabicInLine = lineItems.some(item => containsArabic(item.str));
    
    if (hasArabicInLine) {
      // For Arabic text, sort right-to-left
      lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
    } else {
      // For English text, sort left-to-right
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
    }
    
    // Combine items into line text
    const lineText = lineItems.map(item => item.str).join(' ');
    
    if (lineText.trim()) {
      processedLines.push(lineText.trim());
    }
  }
  
  return processedLines.join('\n');
}

/**
 * Handle mixed RTL/LTR content
 */
export function normalizeMixedDirectionText(text: string): string {
  const lines = text.split('\n');
  const normalizedLines: string[] = [];
  
  for (const line of lines) {
    if (containsArabic(line)) {
      // Add RTL mark at the beginning for proper display
      normalizedLines.push('\u200F' + line);
    } else {
      // Add LTR mark for English lines
      normalizedLines.push('\u200E' + line);
    }
  }
  
  return normalizedLines.join('\n');
}
```

## Step 3.4: Create Netlify Function for Arabic Resume Processing

Create file: `netlify/functions/parse-arabic-resume.ts`
```typescript
import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { resumeText, targetLanguage = 'ar' } = JSON.parse(event.body || '{}');

    if (!resumeText) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Resume text required' }) };
    }

    const systemPrompt = targetLanguage === 'ar' 
      ? `أنت محلل سير ذاتية متخصص. قم بتحليل السيرة الذاتية واستخراج المعلومات بتنسيق JSON.
         يجب أن يكون الرد بالعربية للمحتوى العربي وبالإنجليزية للمحتوى الإنجليزي.
         حافظ على الدقة ولا تضف معلومات غير موجودة في النص الأصلي.`
      : `You are a professional resume analyst. Parse the resume and extract information in JSON format.
         Preserve the original language of the content. Do not add information not present in the original text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Parse this resume into structured JSON:

${resumeText}

Return JSON with this structure:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "objective": "",
  "experience": [
    {
      "title": "",
      "titleEn": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "description": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "graduationDate": "",
      "gpa": ""
    }
  ],
  "skills": [],
  "certifications": [],
  "languages": [
    { "name": "", "level": "" }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent parsing
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse resume' }),
    };
  }
};
```

## Step 3.5: Create Arabic Keyword Matcher

Create file: `src/lib/utils/arabicKeywordMatcher.ts`
```typescript
import { normalizeArabic } from './arabicTextUtils';

export interface KeywordMatch {
  keyword: string;
  found: boolean;
  context?: string;
  variations: string[];
}

/**
 * Common Arabic keyword variations for job matching
 */
const ARABIC_KEYWORD_VARIATIONS: Record<string, string[]> = {
  // Programming
  'برمجة': ['برمجة', 'مبرمج', 'تطوير برمجيات', 'كود', 'كودينج'],
  'تطوير': ['تطوير', 'مطور', 'تطوير برمجيات', 'تطوير تطبيقات'],
  
  // Management
  'إدارة': ['إدارة', 'مدير', 'قيادة', 'إشراف'],
  'مشاريع': ['مشاريع', 'مشروع', 'إدارة مشاريع', 'تخطيط'],
  
  // Skills
  'تواصل': ['تواصل', 'اتصال', 'مهارات تواصل', 'التواصل الفعال'],
  'تحليل': ['تحليل', 'محلل', 'تحليل بيانات', 'تحليلات'],
  
  // Technical
  'قواعد بيانات': ['قواعد بيانات', 'بيانات', 'داتابيس', 'SQL'],
  'شبكات': ['شبكات', 'شبكة', 'نتوورك', 'network'],
  
  // Soft skills
  'العمل الجماعي': ['العمل الجماعي', 'فريق', 'عمل جماعي', 'تعاون'],
  'حل المشكلات': ['حل المشكلات', 'حل مشاكل', 'تحليل مشاكل'],
};

/**
 * Match keywords in resume against job description
 */
export function matchArabicKeywords(
  resumeText: string,
  jobDescription: string
): {
  matched: KeywordMatch[];
  missing: KeywordMatch[];
  score: number;
} {
  const normalizedResume = normalizeArabic(resumeText.toLowerCase());
  const normalizedJob = normalizeArabic(jobDescription.toLowerCase());
  
  // Extract keywords from job description
  const jobKeywords = extractKeywords(normalizedJob);
  
  const matched: KeywordMatch[] = [];
  const missing: KeywordMatch[] = [];
  
  for (const keyword of jobKeywords) {
    const variations = getKeywordVariations(keyword);
    const foundVariation = variations.find(v => 
      normalizedResume.includes(normalizeArabic(v.toLowerCase()))
    );
    
    if (foundVariation) {
      // Find context
      const index = normalizedResume.indexOf(normalizeArabic(foundVariation.toLowerCase()));
      const start = Math.max(0, index - 30);
      const end = Math.min(normalizedResume.length, index + foundVariation.length + 30);
      
      matched.push({
        keyword,
        found: true,
        context: resumeText.substring(start, end).trim(),
        variations,
      });
    } else {
      missing.push({
        keyword,
        found: false,
        variations,
      });
    }
  }
  
  const score = matched.length / (matched.length + missing.length) * 100;
  
  return { matched, missing, score: Math.round(score) };
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const words = text.split(/[\s،,.\-:()]/);
  const keywords: string[] = [];
  
  // Filter out common Arabic stop words
  const stopWords = new Set([
    'و', 'في', 'من', 'على', 'إلى', 'أن', 'عن', 'مع', 'هذا', 'هذه',
    'التي', 'الذي', 'أو', 'ذلك', 'كان', 'لم', 'لا', 'ما', 'هو', 'هي',
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with',
  ]);
  
  for (const word of words) {
    const trimmed = word.trim();
    if (
      trimmed.length > 2 &&
      !stopWords.has(trimmed) &&
      !/^\d+$/.test(trimmed)
    ) {
      keywords.push(trimmed);
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Get variations of a keyword including synonyms
 */
function getKeywordVariations(keyword: string): string[] {
  const normalized = normalizeArabic(keyword);
  
  // Check predefined variations
  for (const [base, variations] of Object.entries(ARABIC_KEYWORD_VARIATIONS)) {
    if (normalizeArabic(base) === normalized || 
        variations.some(v => normalizeArabic(v) === normalized)) {
      return variations;
    }
  }
  
  // Return keyword as-is if no variations found
  return [keyword];
}
```

---

# SUMMARY: File Creation Order

## Part 1: PDPL Compliance
1. `src/lib/stores/consentStore.ts`
2. `src/components/compliance/ConsentBanner.tsx`
3. `src/pages/PrivacyPolicy.tsx`
4. `src/components/compliance/UserDataRights.tsx`
5. `netlify/functions/export-user-data.ts`
6. `netlify/functions/delete-user-data.ts`
7. Update translation files

## Part 2: Vision 2030 Skills
1. `src/lib/data/vision2030Skills.ts`
2. `src/lib/utils/vision2030Analyzer.ts`
3. `src/components/analysis/Vision2030Score.tsx`
4. Update translation files

## Part 3: Arabic Resume Parsing
1. `src/lib/utils/arabicTextUtils.ts`
2. `src/lib/utils/arabicResumeParser.ts`
3. `src/lib/utils/arabicPdfExtractor.ts`
4. `netlify/functions/parse-arabic-resume.ts`
5. `src/lib/utils/arabicKeywordMatcher.ts`

## Dependencies to Install
```bash
npm install js-cookie zustand
npm install -D @types/js-cookie
```

## Integration Checklist
After creating all files:

1. [ ] Add `<ConsentBanner />` to App.tsx
2. [ ] Add Privacy Policy route to router
3. [ ] Integrate Vision2030Score into analysis results page
4. [ ] Update resume upload to use Arabic PDF extractor
5. [ ] Add user data rights to settings/account page
6. [ ] Test RTL layout for all new components
7. [ ] Verify translations display correctly in both languages
