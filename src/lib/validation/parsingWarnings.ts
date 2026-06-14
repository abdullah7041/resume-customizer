import { ResumeSchema as Resume } from '../../types/resume';

export type WarningLevel = 'warning' | 'info';

export interface ParsingWarning {
    code: string;
    message: string;
    level: WarningLevel;
    section: string;
}

/**
 * Analyzes the parsed resume to identify potential parsing issues or missing sections.
 * Returns a list of friendly warnings to display to the user.
 */
export function getParsingWarnings(resume: Resume): ParsingWarning[] {
    const warnings: ParsingWarning[] = [];
    const { basics, work, education, certificates } = resume;

    // Parse-quality signals from the extraction pipeline. When a section was lost
    // in parsing (incompleteSections) or cut by the guest preview cap
    // (previewTruncated), we MUST NOT emit hard "No X found" warnings — that data
    // likely exists. We surface a softer, accurate message instead.
    const parseQuality = resume.meta?.parseQuality;
    const incomplete = new Set(parseQuality?.incompleteSections ?? []);
    const previewTruncated = parseQuality?.previewTruncated === true;

    // A section's absence is "explained" (parser loss / preview cut), so suppress
    // the hard warning. previewTruncated explains tail sections (education/certs/etc).
    const lossExplained = (section: string) => previewTruncated || incomplete.has(section);

    if (previewTruncated) {
        warnings.push({
            code: 'preview_truncated',
            message: 'Preview may be incomplete. Sign in to process the full resume.',
            level: 'info',
            section: 'Preview',
        });
    }

    // 1. Contact Info Checks
    if (!basics?.email && !basics?.phone) {
        if (lossExplained('email') || lossExplained('phone')) {
            warnings.push({
                code: 'incomplete_contact',
                message: 'We may have missed your contact details. Please review or add them.',
                level: 'info',
                section: 'Contact',
            });
        } else {
            warnings.push({
                code: 'missing_contact',
                message: 'No email or phone number detected. Please check your contact details.',
                level: 'warning',
                section: 'Contact',
            });
        }
    }

    // 2. Summary Check
    if (!basics?.summary || basics.summary.length < 50) {
        warnings.push({
            code: 'short_summary',
            message: 'Professional summary is missing or very short. A strong summary helps ATS matching.',
            level: 'info',
            section: 'Summary',
        });
    }

    // 3. Work Experience Check
    if (!work || work.length === 0) {
        warnings.push({
            code: 'no_experience',
            message: 'No work experience found. If you have experience, please ensure it is clearly listed.',
            level: 'warning',
            section: 'Experience',
        });
    } else {
        // Check for missing location in work
        const missingLocation = work.some(w => !w.location);
        if (missingLocation) {
            warnings.push({
                code: 'missing_work_location',
                message: 'Some job entries are missing location (City, Country). This is often required for local jobs.',
                level: 'info',
                section: 'Experience',
            });
        }
    }

    // 4. Education Check
    if (!education || education.length === 0) {
        if (lossExplained('education')) {
            warnings.push({
                code: 'incomplete_education',
                message: 'We may have missed your education — please review or add it.',
                level: 'info',
                section: 'Education',
            });
        } else {
            warnings.push({
                code: 'no_education',
                message: 'No education details found.',
                level: 'warning',
                section: 'Education',
            });
        }
    }

    // 5. Certificates Check
    // Logic: If user has "certified" keyword in summary but no certs section, warn them
    const summaryLower = (basics?.summary || '').toLowerCase();
    const hasCertKeywords = summaryLower.includes('certified') || summaryLower.includes('certification');

    if (!certificates || certificates.length === 0) {
        if (lossExplained('certificates')) {
            warnings.push({
                code: 'incomplete_certs',
                message: 'We may have missed your certifications — please review or add them.',
                level: 'info',
                section: 'Certifications',
            });
        } else if (hasCertKeywords) {
            warnings.push({
                code: 'possible_missing_certs',
                message: 'Your summary mentions certifications, but none were parsed into the Certificates section.',
                level: 'info',
                section: 'Certifications',
            });
        } else {
            warnings.push({
                code: 'no_certs',
                message: 'No certifications found. Adding relevant certs can boost your match score.',
                level: 'info',
                section: 'Certifications',
            });
        }
    }

    return warnings;
}
