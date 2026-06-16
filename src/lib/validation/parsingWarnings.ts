import { ResumeSchema as Resume } from '../../types/resume';

export type WarningLevel = 'warning' | 'info';

export interface ParsingWarning {
    /** Stable machine code (used by tests + analytics). */
    code: string;
    level: WarningLevel;
    /** Stable section id, resolved to a localized label via `upload.warnings.sections.<id>`. */
    sectionId: string;
    /** i18n key resolved via `t(messageKey)` — message text is NEVER hardcoded here. */
    messageKey: string;
}

const warn = (code: string, sectionId: string, level: WarningLevel): ParsingWarning => ({
    code,
    sectionId,
    level,
    messageKey: `upload.warnings.${code}`,
});

/**
 * Analyzes the parsed resume to identify potential parsing issues or missing sections.
 * Returns localizable warnings (codes + i18n keys) for the UI to render.
 *
 * Distinguishes: genuinely-absent data, data recovered by deterministic fallback,
 * data still incomplete after parser recovery, and guest-preview truncation — so
 * the UI never claims a recovered section is "missing".
 */
export function getParsingWarnings(resume: Resume): ParsingWarning[] {
    const warnings: ParsingWarning[] = [];
    const { basics, work, education, certificates, languages } = resume;

    // Parse-quality signals from the extraction pipeline. When a section was lost
    // in parsing (incompleteSections), recovered from raw text (fallbackSections),
    // or cut by the guest preview cap (previewTruncated), we MUST NOT emit hard
    // "No X found" warnings — that data exists. We surface a softer message.
    const parseQuality = resume.meta?.parseQuality;
    const incomplete = new Set(parseQuality?.incompleteSections ?? []);
    const recovered = new Set(parseQuality?.fallbackSections ?? []);
    const previewTruncated = parseQuality?.previewTruncated === true;

    const lossExplained = (section: string) =>
        previewTruncated || incomplete.has(section) || recovered.has(section);

    if (previewTruncated) {
        warnings.push(warn('preview_truncated', 'preview', 'info'));
    }

    // 1. Contact info — be precise. Absent email+phone is only a hard failure when
    // no other contact channel exists. A present LinkedIn/GitHub/portfolio link
    // downgrades it to a gentle completeness suggestion, not a parser failure.
    const hasContactLink = Boolean(basics?.url) || (Array.isArray(basics?.profiles) && basics!.profiles!.length > 0);
    if (!basics?.email && !basics?.phone) {
        if (lossExplained('email') || lossExplained('phone')) {
            warnings.push(warn('incomplete_contact', 'contact', 'info'));
        } else if (hasContactLink) {
            warnings.push(warn('contact_suggestion', 'contact', 'info'));
        } else {
            warnings.push(warn('missing_contact', 'contact', 'warning'));
        }
    }

    // 2. Summary
    if (!basics?.summary || basics.summary.length < 50) {
        warnings.push(warn('short_summary', 'summary', 'info'));
    }

    // 3. Work experience
    if (!work || work.length === 0) {
        warnings.push(warn('no_experience', 'experience', 'warning'));
    } else if (work.some(w => !w.location)) {
        warnings.push(warn('missing_work_location', 'experience', 'info'));
    }

    // 4. Education
    if (!education || education.length === 0) {
        if (lossExplained('education')) {
            warnings.push(warn('incomplete_education', 'education', 'info'));
        } else {
            warnings.push(warn('no_education', 'education', 'warning'));
        }
    }

    // 5. Certifications
    const summaryLower = (basics?.summary || '').toLowerCase();
    const hasCertKeywords = summaryLower.includes('certified') || summaryLower.includes('certification');
    if (!certificates || certificates.length === 0) {
        if (lossExplained('certificates')) {
            warnings.push(warn('incomplete_certs', 'certifications', 'info'));
        } else if (hasCertKeywords) {
            warnings.push(warn('possible_missing_certs', 'certifications', 'info'));
        } else {
            warnings.push(warn('no_certs', 'certifications', 'info'));
        }
    }

    // 6. Languages — optional section. Only surface when parser loss / recovery is
    // flagged, so we never falsely claim a resume "has no languages".
    if ((!languages || languages.length === 0) && lossExplained('languages')) {
        warnings.push(warn('incomplete_languages', 'languages', 'info'));
    }

    return warnings;
}
