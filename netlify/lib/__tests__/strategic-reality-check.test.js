import { describe, expect, it } from 'vitest';
import {
  buildFallbackStrategicRealityCheck,
  postProcessStrategicRealityCheck,
  verifyEvidenceSnippet,
} from '../strategic-reality-check.js';

describe('strategic reality check post-processing', () => {
  it('returns a safe fallback object for malformed input', () => {
    const result = postProcessStrategicRealityCheck(null);

    expect(result).toEqual(buildFallbackStrategicRealityCheck());
    expect(result.riskTier).toBe('medium');
    expect(result.confidence).toBe('low');
    expect(result.unclearRisks).toHaveLength(1);
  });

  it('sanitizes banned employer-decision claims', () => {
    const result = postProcessStrategicRealityCheck({
      riskTier: 'critical',
      recommendation: 'review_role_fit',
      confidence: 'high',
      riskTypes: ['experience_gap'],
      summary: 'The candidate will be rejected by recruiters.',
      strengths: [],
      confirmedRisks: [],
      unclearRisks: [],
      limits: { cannotDetermine: [], assumptions: [] },
    });

    expect(result.summary).toContain('employer decisions cannot be predicted');
    expect(result.summary).not.toMatch(/will be rejected/i);
  });

  it('clamps arrays and downgrades unsupported confirmed evidence', () => {
    const resumeText = 'Senior analyst with SQL, dashboards, and stakeholder reporting.';
    const jobText = 'Role requires Python, SQL, and machine learning production experience.';
    const result = postProcessStrategicRealityCheck({
      riskTier: 'critical',
      recommendation: 'add_evidence_first',
      confidence: 'medium',
      riskTypes: ['missing_required_skill', 'experience_gap', 'domain_gap', 'other', 'evidence_quality', 'seniority_mismatch', 'role_scope_mismatch'],
      summary: 'Critical evidence gap.',
      strengths: [],
      confirmedRisks: [
        {
          type: 'missing_required_skill',
          severity: 'critical',
          title: 'Machine learning evidence is missing',
          explanation: 'The job requires production ML.',
          mitigation: 'Add verifiable ML work if it exists.',
          evidence: [{ source: 'job_description', snippet: 'machine learning production experience' }],
        },
        {
          type: 'domain_gap',
          severity: 'high',
          title: 'Unsupported claim',
          explanation: 'No matching evidence.',
          mitigation: 'Clarify this first.',
          evidence: [{ source: 'resume', snippet: 'Kubernetes platform ownership' }],
        },
      ],
      unclearRisks: [],
      limits: { cannotDetermine: [], assumptions: [] },
    }, { resumeText, jobText });

    expect(result.riskTypes).toHaveLength(6);
    expect(result.confirmedRisks).toHaveLength(1);
    expect(result.confirmedRisks[0].title).toBe('Machine learning evidence is missing');
    expect(result.unclearRisks).toHaveLength(1);
    expect(result.unclearRisks[0].topic).toBe('Unsupported claim');
  });

  it('matches evidence with tolerant English and Arabic normalization', () => {
    expect(verifyEvidenceSnippet(
      '  stakeholder-reporting ',
      'resume',
      'Led stakeholder reporting across finance teams.',
      '',
    )).toBe(true);

    expect(verifyEvidenceSnippet(
      'اداره المشاريع',
      'resume',
      'خبرة في إدارة المشاريع وتحسين العمليات',
      '',
    )).toBe(true);
  });
});
