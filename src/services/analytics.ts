import mixpanel from 'mixpanel-browser';
import { useConsentStore } from '../lib/stores/consentStore';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

/**
 * Analytics service using Mixpanel.
 * Respects user consent and Do Not Track settings.
 */
class Analytics {
    private initialized = false;

    /**
     * Initialize Mixpanel with privacy-respecting defaults.
     * Only initializes if the user has consented to analytics.
     */
    init() {
        console.log('[Analytics] Init called. Token present:', !!MIXPANEL_TOKEN, '| Already initialized:', this.initialized);

        if (this.initialized || !MIXPANEL_TOKEN) {
            if (!MIXPANEL_TOKEN) {
                console.warn('[Analytics] ⚠️ VITE_MIXPANEL_TOKEN is not set. Analytics disabled.');
            }
            return;
        }

        // Check if user has consented to analytics
        const consent = useConsentStore.getState();
        console.log('[Analytics] Consent state:', { analytics: consent.analyticsConsent, hasConsented: consent.consentTimestamp !== null });

        if (!consent.analyticsConsent) {
            console.log('[Analytics] ❌ User has not consented to analytics. Skipping init.');
            return;
        }

        mixpanel.init(MIXPANEL_TOKEN, {
            debug: false, // Disable debug mode to prevent mutex lock spam
            track_pageview: true,
            persistence: 'localStorage',
            ignore_dnt: false, // Respect Do Not Track
            opt_out_tracking_by_default: false,
            loaded: () => {
                console.log('[Analytics] Mixpanel loaded successfully.');
            },
        });

        this.initialized = true;
    }

    /**
     * Track an event with properties.
     * Automatically adds timestamp and language.
     */
    track(event: string, properties?: Record<string, unknown>) {
        if (!this.initialized) {
            if (import.meta.env.DEV) {
                console.log(`[Analytics] Skipped (not initialized): ${event}`, properties);
            }
            return;
        }

        const eventData = {
            ...properties,
            timestamp: new Date().toISOString(),
            language: document.documentElement.lang || 'en',
        };

        if (import.meta.env.DEV) {
            console.log(`[Analytics] 📊 Tracking: ${event}`, eventData);
        }

        mixpanel.track(event, eventData);
    }

    /**
     * Identify a user by their ID.
     */
    identify(userId: string) {
        if (!this.initialized) return;
        mixpanel.identify(userId);
    }

    /**
     * Set user properties for segmentation and analysis.
     */
    setUserProperties(properties: Record<string, unknown>) {
        if (!this.initialized) return;
        mixpanel.people.set(properties);
    }

    // ===== Convenience methods for common events =====

    /**
     * Track resume upload events.
     */
    trackUpload(fileType: string, success: boolean, parseTimeMs?: number, errorType?: string) {
        if (success) {
            this.track('resume_upload_completed', {
                file_type: fileType,
                parse_time_ms: parseTimeMs,
            });
        } else {
            this.track('resume_upload_failed', {
                file_type: fileType,
                error_type: errorType,
            });
        }
    }

    /**
     * Track optimization events.
     */
    trackOptimization(action: 'started' | 'completed' | 'applied', data?: Record<string, unknown>) {
        this.track(`optimization_${action}`, data);
    }

    /**
     * Track match analysis run.
     */
    trackMatchAnalysis(score: number, jobTitle?: string) {
        this.track('match_analysis_run', {
            score,
            job_title: jobTitle,
        });
    }

    /**
     * Track cover letter generation.
     */
    trackCoverLetter(wordCount: number) {
        this.track('cover_letter_generated', { word_count: wordCount });
    }

    /**
     * Track template selection.
     */
    trackTemplateSelected(templateId: string) {
        this.track('template_selected', { template_id: templateId });
    }

    /**
     * Track PDF export.
     */
    trackExport(templateId: string, format: string) {
        this.track('pdf_exported', { template_id: templateId, format });
    }

    /**
     * Track language changes.
     */
    trackLanguageChange(from: string, to: string) {
        this.track('language_changed', { from, to });
    }
}

export const analytics = new Analytics();
