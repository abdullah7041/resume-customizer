import { describe, it, expect } from 'vitest';
import { deriveAtsExplainability } from './deriveAtsExplainability';
import type { AtsExplainabilitySource } from '../../types/explainability';
import type { StrategicRealityCheck } from '../../types/analysis';

const realityCheck: StrategicRealityCheck = {
  riskTier: 'medium',
  recommendation: 'optimize_now',
  confidence: 'medium',
  riskTypes: ['tenure'],
  summary: 'Some risks to review.',
  strengths: [
    {
      title: 'Led a data team',
      whyItMatters: 'Directly matches the leadership requirement.',
      evidence: [{ source: 'resume', snippet: 'Managed a team of 6 analysts' }],
    },
  ],
  confirmedRisks: [
    {
      type: 'short_tenure',
      severity: 'high',
      title: 'Short tenure at last role',
      explanation: 'Only 8 months at ACME.',
      mitigation: 'Explain the contract nature in interviews.',
      evidence: [{ source: 'resume', snippet: 'ACME Corp, Jan 2023 - Sep 2023' }],
    },
  ],
  unclearRisks: [
    {
      type: 'skill',
      topic: 'Kubernetes depth',
      reason: 'Listed but no project detail.',
      evidenceNeeded: 'A project using Kubernetes in production.',
    },
  ],
  limits: {
    cannotDetermine: ['Salary expectations'],
    assumptions: ['Assumed English fluency from resume language.'],
  },
};

describe('deriveAtsExplainability', () => {
  it('dedupes matched keywords across sources case-insensitively', () => {
    const source: AtsExplainabilitySource = {
      matchedKeywords: ['React', 'react', 'TypeScript'],
      categoryScores: {
        hard_skills: { score: 8, max: 10, matched: ['react', 'Node.js'] },
        experience: { score: 5, max: 10 },
        education: { score: 5, max: 10 },
        soft_skills: { score: 5, max: 10 },
      },
    };
    const result = deriveAtsExplainability(source);
    const terms = result.matched.keywords.map((k) => k.term.toLowerCase());
    expect(terms).toContain('react');
    expect(terms).toContain('typescript');
    expect(terms).toContain('node.js');
    // "React"/"react" collapse to a single entry
    expect(terms.filter((t) => t === 'react')).toHaveLength(1);
  });

  it('excludes matched keywords from the missing bucket', () => {
    const source: AtsExplainabilitySource = {
      matchedKeywords: ['React'],
      missingKeywords: ['React', 'GraphQL'],
    };
    const result = deriveAtsExplainability(source);
    const missingTerms = result.missing.keywords.map((k) => k.term.toLowerCase());
    expect(missingTerms).toContain('graphql');
    expect(missingTerms).not.toContain('react');
  });

  it('passes reality-check arrays through verbatim', () => {
    const result = deriveAtsExplainability({ realityCheck });
    expect(result.matched.strengths).toEqual(realityCheck.strengths);
    expect(result.weakEvidence.unclear).toEqual(realityCheck.unclearRisks);
    expect(result.caution.risks).toEqual(realityCheck.confirmedRisks);
    expect(result.caution.assumptions).toEqual(realityCheck.limits.assumptions);
    expect(result.caution.cannotDetermine).toEqual(realityCheck.limits.cannotDetermine);
  });

  it('never synthesizes: every output keyword string exists in some input field', () => {
    const source: AtsExplainabilitySource = {
      matchedKeywords: ['React'],
      missingKeywords: ['GraphQL'],
      categoryScores: {
        hard_skills: { score: 8, max: 10, matched: ['Node.js'], missing: ['Kafka'] },
        experience: { score: 5, max: 10, gaps: ['Team leadership'] },
        education: { score: 5, max: 10 },
        soft_skills: { score: 5, max: 10 },
      },
    };
    const inputs = new Set(
      [
        ...(source.matchedKeywords ?? []),
        ...(source.missingKeywords ?? []),
        'Node.js',
        'Kafka',
        'Team leadership',
      ].map((s) => s.toLowerCase())
    );
    const result = deriveAtsExplainability(source);
    for (const k of [...result.matched.keywords, ...result.missing.keywords]) {
      expect(inputs.has(k.term.toLowerCase())).toBe(true);
    }
  });

  it('tags keywords with the category they were sourced from', () => {
    const source: AtsExplainabilitySource = {
      categoryScores: {
        hard_skills: { score: 8, max: 10, matched: ['Docker'] },
        experience: { score: 5, max: 10, gaps: ['Mentoring'] },
        education: { score: 5, max: 10 },
        soft_skills: { score: 5, max: 10 },
      },
    };
    const result = deriveAtsExplainability(source);
    const docker = result.matched.keywords.find((k) => k.term === 'Docker');
    expect(docker?.category).toBe('hard_skills');
    const mentoring = result.missing.keywords.find((k) => k.term === 'Mentoring');
    expect(mentoring?.category).toBe('experience');
  });

  it('returns isEmpty for null realityCheck, null categoryScores and empty arrays', () => {
    const result = deriveAtsExplainability({
      realityCheck: null,
      categoryScores: null,
      matchedKeywords: [],
      missingKeywords: [],
      gapAnalysis: [],
    });
    expect(result.isEmpty).toBe(true);
  });

  it('includes gapAnalysis items in the missing bucket (optimize context)', () => {
    const result = deriveAtsExplainability({
      gapAnalysis: [
        {
          requirement: '5 years of Python',
          currentState: 'Resume shows 3 years.',
          severity: 'moderate',
          recommendation: 'Highlight Python-heavy projects.',
        },
      ],
    });
    expect(result.missing.gaps).toHaveLength(1);
    expect(result.isEmpty).toBe(false);
  });

  it('handles a completely empty source without throwing', () => {
    const result = deriveAtsExplainability({});
    expect(result.isEmpty).toBe(true);
    expect(result.matched.keywords).toEqual([]);
    expect(result.missing.gaps).toEqual([]);
  });
});
