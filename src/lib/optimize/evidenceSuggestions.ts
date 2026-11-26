import { extractRequirements } from '@/lib/jobs/evidence';
import { normalizeText } from '@/lib/jobs/normalize';
import { isEvidenceSource } from '@/lib/optimize/evidenceReport';
import type { RequirementSelection } from '@/types/evidence-report';
import type { EvidenceSource } from '@/types/optimization-evidence';

const common = new Set(normalizeText('the and with for you our from years experience working required have skills strong excellent ability knowledge must will work role related proven expertise build built في على الى من مع ان او عن كما خلال خبرة مهارات معرفة القدرة العمل سنوات لديه').split(' '));
function terms(value: string): Set<string> {
  const words: string[] = normalizeText(value).match(/[\p{L}\p{N}+#]+/gu) ?? [];
  return new Set(words.filter(word => word.length >= 2 && !common.has(word)));
}

export function suggestRequirementRows(job: string, resumeText: string, sources: EvidenceSource[]): RequirementSelection[] {
  const passages = sources.filter(source => isEvidenceSource(source) && source.kind === 'resume' && resumeText.includes(source.text))
    .map(source => ({ source, words: terms(source.text) }));
  const lines = extractRequirements(job).lines.filter(line => job.includes(line));
  return lines.filter(line => !/^(?:about\b|we are\b|we're\b|we offer\b|عن الشركة|نحن )/i.test(line)).slice(0, 8).map(requirement => {
    const words = terms(requirement);
    let best: EvidenceSource | undefined;
    let bestScore = 0;
    for (const passage of passages) {
      const score = [...words].filter(word => passage.words.has(word)).length;
      if (score > bestScore) { best = passage.source; bestScore = score; }
    }
    return { requirement, ...(best ? { evidence: { sourceId: best.id, targetId: best.targetId, fingerprint: best.fingerprint, quote: best.text } } : {}) };
  });
}
