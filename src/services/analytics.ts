import mixpanel from 'mixpanel-browser';
import { useConsentStore } from '../lib/stores/consentStore';
import type {
    FeedbackTrustToApply,
    FeedbackType,
    FeedbackWillingnessToPay,
} from '@/types/feedback';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

/**
 * Safe score bucket for analytics — never send raw resume/JD content.
 */
function getScoreBucket(score: number): '0-39' | '40-59' | '60-79' | '80-100' {
    if (score < 40) return '0-39';
    if (score < 60) return '40-59';
    if (score < 80) return '60-79';
    return '80-100';
}

function getRatingBucket(rating?: number | null): 'none' | '1-2' | '3' | '4-5' {
    if (!rating) return 'none';
    if (rating <= 2) return '1-2';
    if (rating === 3) return '3';
    return '4-5';
}

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
        if (this.initialized || !MIXPANEL_TOKEN) {
            return;
        }

        // Check if user has consented to analytics
        const consent = useConsentStore.getState();

        if (!consent.analyticsConsent) {
            return;
        }

        try {
            mixpanel.init(MIXPANEL_TOKEN, {
                debug: false, // Disable debug mode to prevent mutex lock spam
                track_pageview: true,
                persistence: 'localStorage',
                ignore_dnt: false, // Respect Do Not Track
                opt_out_tracking_by_default: false,
            } as Parameters<typeof mixpanel.init>[1]);

            this.initialized = true;
        } catch (error) {
            console.warn('[Analytics] Mixpanel initialization failed:', this.summarizeError(error));
        }
    }

    /**
     * Track an event with properties.
     * Automatically adds timestamp and language.
     */
    track(event: string, properties?: Record<string, unknown>) {
        if (!this.initialized) {
            return;
        }

        const eventData = {
            ...properties,
            timestamp: new Date().toISOString(),
            language: document.documentElement.lang || 'en',
        };

        try {
            mixpanel.track(event, eventData);
        } catch (error) {
            console.warn('[Analytics] Event tracking failed:', this.summarizeError(error));
        }
    }

    /**
     * Identify a user by their ID.
     */
    identify(userId: string) {
        if (!this.initialized) return;
        try {
            mixpanel.identify(userId);
        } catch (error) {
            console.warn('[Analytics] Identify failed:', this.summarizeError(error));
        }
    }

    /**
     * Set user properties for segmentation and analysis.
     */
    setUserProperties(properties: Record<string, unknown>) {
        if (!this.initialized) return;
        try {
            mixpanel.people.set(properties);
        } catch (error) {
            console.warn('[Analytics] User property update failed:', this.summarizeError(error));
        }
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
    trackMatchAnalysis(score: number) {
        this.track('match_analysis_run', {
            score_bucket: getScoreBucket(score),
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

    /**
     * Track pricing-intent clicks (fake-door / waitlist).
     * Non-charging CTA only — Pro is not launched yet.
     */
    trackPricingIntent({ source, planHint }: { source: string; planHint?: string }) {
        this.track('pricing_intent_clicked', {
            source,
            plan_hint: planHint ?? 'pro',
            pro_launched: false,
        });
    }

    trackFeedbackSubmitted({
        feedbackType,
        rating,
        hasMessage,
        trustToApply,
        willingnessToPay,
        contextFeature,
    }: {
        feedbackType: FeedbackType;
        rating?: number | null;
        hasMessage: boolean;
        trustToApply?: FeedbackTrustToApply | null;
        willingnessToPay?: FeedbackWillingnessToPay | null;
        contextFeature?: string;
    }) {
        this.track('feedback_submitted', {
            feedback_type: feedbackType,
            rating: rating ?? null,
            rating_bucket: getRatingBucket(rating),
            has_message: hasMessage,
            trust_to_apply: trustToApply ?? null,
            willingness_to_pay: willingnessToPay ?? null,
            context_feature: contextFeature ?? 'unknown',
        });
    }

    // ===== Funnel tracking (Phase 4) =====

    trackLandingViewed() {
        this.track('landing_viewed');
    }

    trackGetStartedClicked(source: 'hero' | 'walkthrough' | 'final_cta') {
        this.track('get_started_clicked', { source });
    }

    trackSigninStarted(source?: string) {
        this.track('signin_started', { source });
    }

    trackSignupStarted(source?: string) {
        this.track('signup_started', { source });
    }

    trackJobDescriptionSubmitted() {
        this.track('job_description_submitted');
    }

    trackMatchAnalysisStarted() {
        this.track('match_analysis_started');
    }

    trackMatchAnalysisSuccess(score: number) {
        this.track('match_analysis_success', {
            score_bucket: getScoreBucket(score),
        });
    }

    trackMatchAnalysisFailed(errorCategory: string) {
        this.track('match_analysis_failed', { error_category: errorCategory });
    }

    trackOptimizationFailed(errorCategory: string) {
        this.track('optimization_failed', { error_category: errorCategory });
    }

    trackExportClicked(templateId: string, format: string) {
        this.track('export_clicked', { template_id: templateId, format });
    }

    trackExportSuccess(templateId: string, format: string) {
        this.track('export_success', { template_id: templateId, format });
    }

    trackExportFailed(templateId: string, format: string, errorCategory: string) {
        this.track('export_failed', { template_id: templateId, format, error_category: errorCategory });
    }

    trackWaitlistJoined(source: string) {
        this.track('waitlist_joined', { source });
    }

    trackPricingIntentPack9Sar(source: string) {
        this.track('pricing_intent_pack_9_sar', { source });
    }

    trackPricingIntentMonthly29Sar(source: string) {
        this.track('pricing_intent_monthly_29_sar', { source });
    }


    // ===== Pipeline tracking =====

    trackPipelineSaveClicked() {
        this.track('pipeline_save_clicked');
    }

    trackPipelineJobSaved(data?: { is_duplicate?: boolean }) {
        this.track('pipeline_job_saved', data);
    }

    trackPipelineSaveFailed(errorCategory?: string) {
        this.track('pipeline_save_failed', { error_category: this.normalizeErrorCategory(errorCategory) });
    }

    trackPipelineStatusUpdated(status: string) {
        this.track('pipeline_status_updated', { status });
    }

    trackPipelineExportAttached() {
        this.track('pipeline_export_attached');
    }

    trackJobMetadataExtracted(confidence?: Record<string, number>) {
        this.track('job_metadata_extracted', { confidence });
    }

    trackJobMetadataExtractionFailed(error?: string) {
        this.track('job_metadata_extraction_failed', { error_category: error || 'unknown' });
    }

    private summarizeError(error: unknown) {
        return {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
        };
    }

    private normalizeErrorCategory(value?: string) {
        if (!value) return 'unknown';
        const normalized = value.toLowerCase();
        if (normalized.includes('auth') || normalized.includes('sign in')) return 'auth';
        if (normalized.includes('duplicate')) return 'duplicate';
        if (normalized.includes('rate')) return 'rate_limit';
        if (normalized.includes('network') || normalized.includes('fetch')) return 'network';
        if (normalized.includes('validation') || normalized.includes('invalid')) return 'validation';
        return 'unknown';
    }
}

export const analytics = new Analytics();
