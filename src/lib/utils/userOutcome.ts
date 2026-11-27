import { captureException } from '@sentry/react';

export type UserOutcome = 'feed_load_failed' | 'feed_verification_failed' | 'job_handoff_missing'
  | 'job_handoff_mismatch' | 'pdf_corrupt' | 'pdf_blank' | 'pdf_raster_only'
  | 'pdf_text_mismatch' | 'pdf_verification_failed' | 'pdf_export_failed';

export function pdfOutcome(reason: import('@/lib/utils/pdfTextCheck').PdfTextCheckReason | undefined): UserOutcome {
  switch (reason) {
    case 'empty_file':
    case 'corrupt': return 'pdf_corrupt';
    case 'empty_text': return 'pdf_blank';
    case 'raster_only': return 'pdf_raster_only';
    case 'text_mismatch':
    case 'invalid_text': return 'pdf_text_mismatch';
    default: return 'pdf_verification_failed';
  }
}

export function reportUserOutcome(code: UserOutcome) {
  captureException(new Error(code), { tags: { 'watheq.outcome': code }, fingerprint: [code] });
}
