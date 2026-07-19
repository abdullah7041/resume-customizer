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
    trackOptimization(action: 'started' | 'completed' | 'applied' | 'applied_all', data?: Record<string, unknown>) {
        this.track(`optimization_${action}`, data);
    }

    trackClarificationOutcome(data: {
        outcome: 'answered' | 'skipped';
        questionCount: number;
        answeredCount: number;
        hardStopCount: number;
    }) {
        const questionCount = Math.max(0, data.questionCount);
        const hardStopSelectionRate = questionCount > 0
            ? Math.min(1, Math.max(0, data.hardStopCount / questionCount))
            : 0;
        this.track('clarification_outcome', {
            outcome: data.outcome,
            question_count: questionCount,
            answered_count: Math.max(0, data.answeredCount),
            hard_stop_count: Math.max(0, data.hardStopCount),
            hard_stop_selection_rate: hardStopSelectionRate,
        });
    }

    trackClarificationScoreDelta(data: {
        outcome: 'answered' | 'skipped';
        beforeScore: number;
        afterScore: number;
    }) {
        this.track('clarification_score_delta', {
            outcome: data.outcome,
            score_delta: Math.round(data.afterScore - data.beforeScore),
            before_score_bucket: getScoreBucket(data.beforeScore),
            after_score_bucket: getScoreBucket(data.afterScore),
        });
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
    trackPricingIntent({ source, planHint, shownPriceSar }: { source: string; planHint?: string; shownPriceSar?: number }) {
        this.track('pricing_intent_clicked', {
            source,
            plan_hint: planHint ?? 'pro',
            shown_price_sar: shownPriceSar ?? null,
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

    trackGuestPreviewStarted(source: 'landing_preview') {
        this.track('guest_preview_started', { source });
    }

    trackGuestPreviewLimitHit(data: {
        source: 'client_file_size' | 'server_file_size' | 'server_text_length' | 'server_rate_limit' | 'preview_unavailable' | 'protected_action' | 'unknown';
        status?: number | null;
        limit?: number | null;
        used?: number | null;
        remaining?: number | null;
        retryAfter?: number | null;
    }) {
        this.track('guest_preview_limit_hit', {
            source: data.source,
            status: data.status ?? null,
            limit: data.limit ?? null,
            used: data.used ?? null,
            remaining: data.remaining ?? null,
            retry_after_seconds: data.retryAfter ?? null,
        });
    }

    trackGuestPreviewSigninStarted(source: 'guest_banner' | 'guest_protected_action') {
        this.track('guest_preview_signin_started', { source });
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

    trackStrategicRealityCheck(data: {
        riskTier?: string;
        recommendation?: string;
        confidence?: string;
        riskTypes?: string[];
    }) {
        this.track('strategic_reality_check_result', {
            risk_tier: data.riskTier || 'unknown',
            recommendation: data.recommendation || 'unknown',
            confidence: data.confidence || 'unknown',
            risk_types: Array.isArray(data.riskTypes) ? data.riskTypes.slice(0, 6) : [],
        });
    }

    trackResumeTruthCheck(data: {
        overallRisk?: string;
        claimCount?: number;
        highSeverityCount?: number;
    }) {
        this.track('resume_truth_check_result', {
            overall_risk: data.overallRisk || 'unknown',
            claim_count: data.claimCount ?? 0,
            high_severity_count: data.highSeverityCount ?? 0,
        });
    }

    // Metadata only — counts and enums, never keyword strings / snippets /
    // resume / job-description text.
    trackExplainabilityPanelOpened(data: {
        context: 'match' | 'optimize';
        matchedCount: number;
        missingCount: number;
        weakCount: number;
        cautionCount: number;
        riskTier?: string | null;
    }) {
        this.track('explainability_panel_opened', {
            context: data.context,
            matched_count: data.matchedCount,
            missing_count: data.missingCount,
            weak_count: data.weakCount,
            caution_count: data.cautionCount,
            risk_tier: data.riskTier || 'unknown',
        });
    }

    trackScoreDiffExpanded(data: {
        appliedCount: number;
        totalCount: number;
        isVerified: boolean;
        improvementEstimate: number | null;
    }) {
        this.track('score_diff_expanded', {
            applied_count: data.appliedCount,
            total_count: data.totalCount,
            is_verified: data.isVerified,
            improvement_estimate: data.improvementEstimate ?? 0,
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

    trackWaitlistJoined(source: string, shownPriceSar?: number) {
        this.track('waitlist_joined', { source, shown_price_sar: shownPriceSar ?? null });
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

    trackPipelineJobSaved(data?: { is_duplicate?: boolean; auto?: boolean }) {
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
