import { describe, expect, it } from 'vitest';
import { suppressHardStopClaims } from '../hard-stop-suppression.js';

describe('hard-stop suppression', () => {
  it('removes Excel from missing keywords and every generated claim', () => {
    const result = suppressHardStopClaims({
      missing_keywords: ['Excel', 'SQL'],
      keywords_to_keep: ['Excel', 'SQL'],
      original_headline: 'Business Analyst',
      suggested_headline: 'Excel Business Analyst',
      original_summary: 'Analyzed operational data.',
      summary_rewrite: 'Excel expert who analyzed operational data.',
      bullet_improvements: [{
        original: 'Analyzed monthly reports.',
        improved: 'Built Excel dashboards for monthly reports.',
        issue: 'Missing tool detail',
        rationale: 'Matches the job description',
      }],
      project_improvements: [],
      certification_recommendations: [{
        name: 'Excel certification',
        issuer: 'Microsoft',
        relevance: 'Requested by the role',
      }],
      position_name_suggestion: {
        original: 'Business Analyst',
        suggested: 'Excel Analyst',
        reason: 'Matches the role',
        is_necessary: true,
        position_changes: [],
      },
    }, ['Excel']);

    expect(result.missing_keywords).toEqual(['SQL']);
    expect(result.keywords_to_keep).toEqual(['SQL']);
    expect(result.suggested_headline).toBe('Business Analyst');
    expect(result.summary_rewrite).toBe('Analyzed operational data.');
    expect(result.bullet_improvements).toEqual([]);
    expect(result.certification_recommendations).toEqual([]);
    expect(result.position_name_suggestion).toMatchObject({
      suggested: 'Business Analyst',
      is_necessary: false,
    });
  });

  it('filters gap analysis rows that mention a hard-stopped term', () => {
    const result = suppressHardStopClaims({
      gap_analysis: [
        {
          category: 'tools',
          gap: 'Excel',
          current_state: 'No evidence of Excel.',
          recommendation: 'Add Excel dashboards.',
          priority: 'high',
        },
        {
          category: 'tools',
          gap: 'SQL',
          current_state: 'SQL evidence is present.',
          recommendation: 'Keep SQL examples.',
          priority: 'medium',
        },
      ],
    }, ["Excel: I don't have Excel experience"]);

    expect(result.gap_analysis).toEqual([{
      category: 'tools',
      gap: 'SQL',
      current_state: 'SQL evidence is present.',
      recommendation: 'Keep SQL examples.',
      priority: 'medium',
    }]);
  });

  it('extracts the denied keyword from a natural-language hard-stop answer', () => {
    const result = suppressHardStopClaims({
      missing_keywords: ['Salesforce', 'SQL'],
      bullet_improvements: [{
        original: 'Managed sales reports.',
        improved: 'Built Salesforce reports for pipeline reviews.',
        issue: 'Missing tool detail',
        rationale: 'Salesforce appears in the job description',
      }],
    }, ["I don't have Salesforce experience"]);

    expect(result.missing_keywords).toEqual(['SQL']);
    expect(result.bullet_improvements).toEqual([]);
  });

  it('does not suppress unrelated tokens that merely contain the hard-stop text', () => {
    const result = suppressHardStopClaims({
      missing_keywords: ['SQL', 'NoSQL', 'PostgreSQL'],
      keywords_to_keep: ['SQL', 'NoSQL', 'PostgreSQL'],
    }, ['SQL']);

    expect(result.missing_keywords).toEqual(['NoSQL', 'PostgreSQL']);
    expect(result.keywords_to_keep).toEqual(['NoSQL', 'PostgreSQL']);
  });

  it('removes hard-stopped terms from gap analysis recommendations', () => {
    const result = suppressHardStopClaims({
      gap_analysis: [{
        requirement: 'Excel',
        current_state: 'No evidence of Excel.',
        gap_severity: 'moderate',
        recommendation: 'Add Excel only if you can verify it.',
      }, {
        requirement: 'SQL',
        current_state: 'Evidence is present.',
        gap_severity: 'minor',
        recommendation: 'Keep SQL evidence visible.',
      }],
      missing_keywords: ['Excel', 'SQL'],
      keywords_to_keep: ['SQL'],
    }, ['Excel']);

    expect(result.gap_analysis).toEqual([{
      requirement: 'SQL',
      current_state: 'Evidence is present.',
      gap_severity: 'minor',
      recommendation: 'Keep SQL evidence visible.',
    }]);
  });

  it('does not suppress unrelated keywords that merely contain a hard-stop term', () => {
    const result = suppressHardStopClaims({
      missing_keywords: ['SQL', 'NoSQL', 'PostgreSQL'],
      keywords_to_keep: ['NoSQL analytics'],
      original_headline: 'Data Analyst',
      suggested_headline: 'NoSQL Data Analyst',
      original_summary: 'Analyzed data.',
      summary_rewrite: 'Built NoSQL analytics dashboards.',
      bullet_improvements: [{
        original: 'Analyzed data.',
        improved: 'Built NoSQL analytics dashboards.',
        issue: 'Could mention storage tooling.',
        rationale: 'NoSQL is relevant to the role.',
      }],
    }, ['SQL']);

    expect(result.missing_keywords).toEqual(['NoSQL', 'PostgreSQL']);
    expect(result.keywords_to_keep).toEqual(['NoSQL analytics']);
    expect(result.suggested_headline).toBe('NoSQL Data Analyst');
    expect(result.summary_rewrite).toBe('Built NoSQL analytics dashboards.');
    expect(result.bullet_improvements).toHaveLength(1);
  });
});
