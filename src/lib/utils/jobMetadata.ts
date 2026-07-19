export const UNKNOWN_COMPANY_VALUE = 'unknown company';

export const sanitizeJobMetadataField = (value?: string | null): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return '';
  return trimmed;
};

export const sanitizeCompanyName = (value?: string | null): string => {
  const sanitized = sanitizeJobMetadataField(value);
  return sanitized.toLowerCase() === UNKNOWN_COMPANY_VALUE ? '' : sanitized;
};
