/** Compose fields without duplicating a degree already present in its area. */
export function formatEducationLabel(education: { studyType?: string; area?: string }, separator = ' — '): string {
  const degree = education.studyType?.trim() ?? '';
  const area = education.area?.trim() ?? '';
  if (!degree) return area;
  if (!area) return degree;
  const normalize = (value: string) => value.replace(/\./g, '').replace(/\s+/g, ' ').toLocaleLowerCase();
  const prefix = normalize(degree);
  return normalize(area) === prefix || normalize(area).startsWith(`${prefix} `) ? area : `${degree}${separator}${area}`;
}

/** A single supplied date is a date, never evidence of an ongoing course/project. */
export function formatSourceDateRange(startDate?: string, endDate?: string, separator = ' — '): string {
  const start = startDate?.trim() ?? '';
  const end = endDate?.trim() ?? '';
  return start && end && start !== end ? `${start}${separator}${end}` : end || start;
}
