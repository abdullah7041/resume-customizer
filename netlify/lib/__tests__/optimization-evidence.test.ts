import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildEvidenceSources,
  validateEditEvidence,
} from '../optimization-evidence.js';
import type { EvidenceSource } from '../../../src/types/optimization-evidence.js';

const source = (id: string, targetId: string, text: string, kind: EvidenceSource['kind'] = 'resume'): EvidenceSource => ({
  id, targetId, text, kind,
  fingerprint: createHash('sha256').update(text).digest('hex'),
});

describe('optimization evidence', () => {
  it('rejects a quote attached to another employer', async () => {
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'Improved service', proposed: 'Cut cost 40%', references: [{ sourceId: 'b', quote: 'Cut cost 40%' }] }, [source('b', 'work-b', 'Cut cost 40%')]);
    expect(result.status).toBe('rejected');
    expect(result.reasons).toContain('wrong_target');
  });

  it('rejects a missing quote and a forged source fingerprint', async () => {
    const evidence = await validateEditEvidence({ targetId: 'work-a', original: 'Built reports', proposed: 'Built dashboards', references: [{ sourceId: 'a', quote: 'Built dashboards' }] }, [source('a', 'work-a', 'Built reports')]);
    expect(evidence).toMatchObject({ status: 'rejected', reasons: ['missing_source'] });
    const forged = { ...source('a', 'work-a', 'Built reports'), fingerprint: '0'.repeat(64) };
    expect((await validateEditEvidence({ targetId: 'work-a', original: 'Built reports', proposed: 'Built reports', references: [{ sourceId: 'a', quote: 'Built reports' }] }, [forged])).status).toBe('rejected');
  });

  it('does not borrow a repeated quote from a different target', async () => {
    const repeated = [source('a', 'work-a', 'Built reports'), source('b', 'work-b', 'Built reports')];
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'Built reports', proposed: 'Built reports', references: [{ sourceId: 'b', quote: 'Built reports' }] }, repeated);
    expect(result.reasons).toContain('wrong_target');
  });

  it('marks duplicate source identities ambiguous instead of selecting the first', async () => {
    const repeated = [source('a', 'work-a', 'Built reports'), source('a', 'work-a', 'Built reports')];
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'Built reports', proposed: 'Built reports', references: [{ sourceId: 'a', quote: 'Built reports' }] }, repeated);
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('semantic_review');
  });

  it('accepts unchanged sourced text but reviews a paraphrase', async () => {
    const sources = [source('a', 'work-a', 'Built 12 reports')];
    const refs = [{ sourceId: 'a', quote: 'Built 12 reports' }];
    expect((await validateEditEvidence({ targetId: 'work-a', original: 'Built 12 reports', proposed: 'Built 12 reports', references: refs }, sources)).status).toBe('source_matched');
    expect((await validateEditEvidence({ targetId: 'work-a', original: 'Built 12 reports', proposed: 'Created 12 reports', references: refs }, sources)).reasons).toContain('semantic_review');
  });

  it('does not let an unsourced original supply a fabricated number', async () => {
    const result = await validateEditEvidence({
      targetId: 'work-a', original: 'Cut cost 40%', proposed: 'Cut cost 40%',
      references: [{ sourceId: 'a', quote: 'Managed team' }],
    }, [source('a', 'work-a', 'Managed team')]);
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('new_number');
    expect(result.reasons).toContain('semantic_review');
  });

  it('treats Arabic-Indic and Western digits as the same number', async () => {
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'خفضت التكلفة ٢٠٪', proposed: 'خفضت التكلفة 20%', references: [{ sourceId: 'a', quote: 'خفضت التكلفة ٢٠٪' }] }, [source('a', 'work-a', 'خفضت التكلفة ٢٠٪')]);
    expect(result.reasons).not.toContain('new_number');
    expect(result.reasons).toContain('semantic_review');
  });

  it('reviews a fabricated metric even when marked verify', async () => {
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'Improved service', proposed: 'Improved service by 40% (verify)', references: [{ sourceId: 'a', quote: 'Improved service' }] }, [source('a', 'work-a', 'Improved service')]);
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('new_number');
  });

  it('links a candidate clarification to its target without granting independent verification', async () => {
    const clarification = source('c', 'work-a', 'I reduced latency by 25%', 'clarification');
    const result = await validateEditEvidence({ targetId: 'work-a', original: 'Improved latency', proposed: 'Reduced latency by 25%', references: [{ sourceId: 'c', quote: 'reduced latency by 25%' }] }, [clarification]);
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('semantic_review');
    expect(result.reasons).not.toContain('new_number');
  });

  it('builds target-bound sources from structured resume and clarification text', async () => {
    const sources = await buildEvidenceSources({
      resume: { basics: { summary: 'Analyst' }, work: [{ name: 'A', position: 'Analyst', highlights: ['Built reports'] }, { name: 'B', position: 'Analyst', highlights: ['Built reports'] }] },
      clarifications: [{ id: 'c', targetId: 'work-a', text: 'I used SQL', createdAt: '2026-09-24T12:00:00Z' }],
    });
    expect(sources.filter(item => item.kind === 'resume' && item.text === 'Built reports')).toHaveLength(2);
    expect(sources.filter(item => item.kind === 'resume' && item.text === 'Built reports').map(item => item.targetId)[0]).not.toBe(sources.filter(item => item.kind === 'resume' && item.text === 'Built reports').map(item => item.targetId)[1]);
    expect(sources).toContainEqual(expect.objectContaining({ id: 'c', kind: 'clarification', targetId: 'work-a', text: 'I used SQL', createdAt: '2026-09-24T12:00:00Z' }));
  });

  it('includes nested education, skill, certificate, and other supplied resume facts', async () => {
    const sources = await buildEvidenceSources({ resume: {
      basics: { location: { city: 'Riyadh' } },
      education: [{ institution: 'University A', courses: ['Statistics 101'] }],
      skills: [{ name: 'Data analysis', keywords: ['SQL'] }],
      certificates: [{ name: 'Certificate A', issuer: 'Institute A' }],
      languages: [{ language: 'Arabic', fluency: 'Native' }],
      customSections: [{ title: 'Community', details: { outcome: 'Mentored analysts' } }],
      meta: { ai_suggestions: ['Invented result'] },
    } });
    for (const fact of ['Riyadh', 'Statistics 101', 'SQL', 'Institute A', 'Native', 'Mentored analysts']) {
      expect(sources.find(item => item.text === fact)).toBeDefined();
    }
    expect(sources.some(item => item.text === 'Invented result')).toBe(false);
    expect(sources.find(item => item.text === 'SQL')?.targetId).toMatch(/^skills:/);
  });
});
