import { expect, it } from 'vitest';
import { labelOptimizeSources } from '../optimize-source-labels.js';
import { buildRequestEvidenceSources, validateEditEvidence } from '../optimization-evidence.js';

it('round-trips short model citations and rejects guesses and citations borrowed from another role', async () => {
  const sources = buildRequestEvidenceSources('Built finance reports.\nRan engineering reviews.');
  const { sources: prompt, restore } = labelOptimizeSources(sources);
  expect(prompt.map(s => [s.id, s.targetId])).toEqual([['S1', 'T1'], ['S2', 'T2']]);
  const check = async (target: string, id: string, quote: string) => {
    const result = restore({ bullet_improvements: [{ target_id: target, evidence_references: [{ sourceId: id, quote }] }] });
    const bullet = result.bullet_improvements[0];
    return validateEditEvidence({ original: sources[0].text, proposed: 'Built reports for finance.',
      targetId: bullet.target_id, references: bullet.evidence_references }, sources);
  };
  expect(await check('T1', 'S1', sources[0].text)).toMatchObject({ targetId: sources[0].targetId, status: 'needs_review' });
  expect((await check('T2', 'S2', sources[1].text)).status).toBe('rejected');
  expect((await check('T1', 'unknown', sources[0].text)).status).toBe('rejected');
});
