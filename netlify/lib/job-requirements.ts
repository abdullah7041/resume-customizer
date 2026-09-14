/** Candidate-independent excerpts; changing a JD produces a different requirements cache key. */
export function extractRequirements(description: string) {
  const clean = description.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const lines = [...new Set(clean.split(/\n+|[.!?؛]\s+/).map((line) => line.trim()).filter((line) => line.length >= 8))];
  const heading = lines.findIndex((line) => /^(requirements|qualifications|what you bring|what we.re looking for|المتطلبات|المؤهلات)\b/i.test(line));
  const relevant = heading >= 0 ? lines.slice(heading + 1) : lines;
  const end = relevant.findIndex((line) => /^(benefits|what we offer|about us|المزايا|عن الشركة)\b/i.test(line));
  return { lines: (end >= 0 ? relevant.slice(0, end) : relevant).slice(0, 40).map((line) => line.slice(0, 500)), available: clean.trim().length >= 8 };
}
