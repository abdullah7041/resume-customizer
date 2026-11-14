/** Preserve the source precision before normalizing dates to ISO. */
export function publication(value: unknown) {
  const valid = typeof value === 'string' && Number.isFinite(Date.parse(value));
  const timestamp = valid && /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return {
    postedAt: valid ? new Date(value).toISOString() : null,
    publicationKind: valid ? 'published' as const : 'unknown' as const,
    publicationPrecision: timestamp ? 'timestamp' as const : valid ? 'date' as const : 'unknown' as const,
  };
}
