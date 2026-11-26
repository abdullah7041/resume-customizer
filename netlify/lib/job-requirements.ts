/** Candidate-independent excerpts; changing a JD produces a different requirements cache key. */
export function extractRequirements(description: string) {
  const clean = description.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const lines = [...new Set(clean.split(/\n+|[.!?؛]\s+/).map(line => line.trim()).filter(Boolean))];
  const heading = lines.findIndex(line => /^(?:requirements|qualifications|what you bring|what we.re looking for|المتطلبات|المؤهلات)(?:\s*[:：])?$/i.test(line));
  const relevant = heading >= 0 ? lines.slice(heading + 1) : lines;
  const end = relevant.findIndex((line, index) => (index > 0 || heading >= 0) && /^(?:benefits|what we offer|about us|المزايا|عن الشركة)(?:\s*[:：])?$/i.test(line));
  return { lines: (end >= 0 ? relevant.slice(0, end) : relevant).filter(line => line.length >= 8).slice(0, 40).map(line => line.slice(0, 500)), available: clean.trim().length >= 8 };
}
