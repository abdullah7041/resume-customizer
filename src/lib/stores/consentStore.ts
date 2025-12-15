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
