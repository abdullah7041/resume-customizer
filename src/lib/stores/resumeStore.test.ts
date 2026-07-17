import { describe, it, expect, beforeEach } from 'vitest';
import { useResumeStore } from './resumeStore';
import type { ResumeSchema } from '../../types/resume';
import type { OptimizationResult } from '../../types/templates';

describe('resumeStore', () => {
    beforeEach(() => {
        useResumeStore.getState().clearAll();
    });

    it('should initialize gapAnalysis as an empty array, not null', () => {
        useResumeStore.getState().resetOptimizationMetrics();
        const updatedState = useResumeStore.getState();
        expect(updatedState.optimizationMetrics.gapAnalysis).toEqual([]);
    });

    it('should update optimization metrics correctly with consolidated updates', () => {
        const metricsPayload = {
            beforeScore: 75,
            afterScore: 85,
            gapAnalysis: [{
                requirement: 'Test Requirement',
                currentState: 'Missing',
                severity: 'critical' as const,
                recommendation: 'Add it'
            }],
            categoryScores: { hard_skills: { score: 10, max: 10, reasoning: 'test' } }
        };

        useResumeStore.getState().setOptimizationMetrics(metricsPayload);

        const state = useResumeStore.getState();
        expect(state.optimizationMetrics.beforeScore).toBe(75);
        expect(state.optimizationMetrics.afterScore).toBe(85);
        expect(state.optimizationMetrics.gapAnalysis).toHaveLength(1);
        expect(state.optimizationMetrics.categoryScores).toEqual({ hard_skills: { score: 10, max: 10, reasoning: 'test' } });
    });

    it('should reset all fields correctly including gapAnalysis and hasDownloaded', () => {
        useResumeStore.getState().setOptimizationMetrics({
            gapAnalysis: [{
                requirement: 'Old Req',
                currentState: 'Old State',
                severity: 'minor' as const,
                recommendation: 'Fix it'
            }],
            beforeScore: 50
        });
        useResumeStore.getState().setHasDownloaded(true);

        useResumeStore.getState().resetForNewUpload();

        const state = useResumeStore.getState();
        expect(state.optimizationMetrics.gapAnalysis).toEqual([]);
        expect(state.optimizationMetrics.beforeScore).toBeNull();
        expect(state.hasDownloaded).toBe(false);
    });

    it('should reset hasDownloaded when resume content changes', () => {
        useResumeStore.getState().setHasDownloaded(true);
        expect(useResumeStore.getState().hasDownloaded).toBe(true);

        // Simulate changing template - should reset
        useResumeStore.getState().setSelectedTemplate('technical-engineer');
        expect(useResumeStore.getState().hasDownloaded).toBe(false);

        // Reset and test another action
        useResumeStore.getState().setHasDownloaded(true);
        useResumeStore.getState().setShowOptimized(true);
        expect(useResumeStore.getState().hasDownloaded).toBe(false);
    });
});

/**
 * Characterization tests for `getActiveResume()` (resumeStore.ts:266).
 *
 * Locks in the CURRENT behavior of the content-based fuzzy-match merge that
 * applies AI optimizations onto the original resume. These tests describe
 * what the code does today, including the "no-match silently drops the
 * change" behavior - they are not a judgment on whether that's ideal.
 */
const EXPERIENCE_HIGHLIGHT =
  'Led migration of legacy payment system to microservices reducing latency by 40 percent across all regions';
const SECOND_WORK_HIGHLIGHT =
  'Built and maintained internal tooling using React and TypeScript for the engineering team daily';
const EDU_HIGHLIGHT =
  'Completed thesis on distributed systems performance optimization techniques for cloud infrastructure deployments';
const PROJECT_DESCRIPTION =
  'AI powered resume tailoring tool built with React, Node and OpenAI APIs for job seekers worldwide';
const CERT_NAME = 'AWS Certified Solutions Architect - Associate';

function buildFixture(): ResumeSchema {
  return {
    basics: {
      name: 'Jane Doe',
      label: 'Software Engineer',
      email: 'jane@example.com',
      phone: '+1-555-0100',
      summary: 'Experienced engineer with a decade of building scalable web applications',
      location: { city: 'Riyadh', region: 'Riyadh Province', countryCode: 'SA' },
      profiles: [],
    },
    work: [
      {
        name: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2020-01-01',
        endDate: 'Present',
        summary: '',
        highlights: [EXPERIENCE_HIGHLIGHT],
      },
      {
        name: 'Beta Inc',
        position: 'Engineer',
        startDate: '2017-01-01',
        endDate: '2019-12-31',
        summary: '',
        highlights: [SECOND_WORK_HIGHLIGHT],
      },
    ],
    education: [
      {
        institution: 'State University',
        area: 'Computer Science',
        studyType: 'Bachelor',
        startDate: '2013-01-01',
        endDate: '2017-01-01',
        highlights: [],
      },
      {
        institution: 'Tech Institute',
        area: 'Software Engineering',
        studyType: 'Master',
        startDate: '2017-01-01',
        endDate: '2019-01-01',
        highlights: [EDU_HIGHLIGHT],
      },
    ],
    skills: [{ name: 'Frontend', keywords: ['JavaScript', 'Python'] }],
    projects: [
      {
        name: 'Internal Dashboard',
        description: PROJECT_DESCRIPTION,
        highlights: [],
      },
    ],
    certificates: [
      {
        name: CERT_NAME,
        date: '2022-01-01',
        issuer: 'Amazon Web Services',
      },
    ],
  };
}

/** Build a full OptimizationResult, applied by default. */
function buildOpt(
  overrides: Partial<Omit<OptimizationResult, 'timestamp'>> & Pick<OptimizationResult, 'sectionId' | 'sectionType'>
): Omit<OptimizationResult, 'timestamp'> {
  return {
    original: '',
    optimized: '',
    applied: true,
    ...overrides,
  };
}

describe('resumeStore.getActiveResume()', () => {
  beforeEach(() => {
    useResumeStore.getState().resetForNewUpload();
    useResumeStore.getState().setOriginalResume(buildFixture());
    useResumeStore.getState().setShowOptimized(true);
  });

  describe('summary', () => {
    it('exact apply: replaces basics.summary', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({ sectionId: 'summary-1', sectionType: 'summary', optimized: 'New AI-written summary' })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe('New AI-written summary');
    });

    it('applied:false: original summary is unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({ sectionId: 'summary-1', sectionType: 'summary', optimized: 'Unapplied summary', applied: false })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe('Experienced engineer with a decade of building scalable web applications');
    });

    it('refine keeps raw instruction and AI text out of resume metadata while preserving apply behavior', () => {
      const rawInstruction = 'Add that I have a secret AWS certification';
      const rawIssue = 'The resume has no evidence of that certification.';
      const rawRationale = 'Kept the bullet grounded in existing resume evidence.';

      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'summary-refine-1',
          sectionType: 'summary',
          optimized: 'Initial optimized summary',
          applied: false,
        })
      );

      useResumeStore.getState().refineOptimization('summary-refine-1', {
        improved: 'Refined optimized summary',
        instruction: rawInstruction,
        issue: rawIssue,
        rationale: rawRationale,
      });

      const stateAfterRefine = useResumeStore.getState();
      expect(stateAfterRefine.optimizations[0]).toEqual(expect.objectContaining({
        optimized: 'Refined optimized summary',
        applied: false,
        issue: rawIssue,
        rationale: rawRationale,
      }));
      expect(stateAfterRefine.originalResume?.meta?.ai_suggestions?.[0]).toEqual(expect.objectContaining({
        type: 'refine_bullet',
        sectionId: 'summary-refine-1',
      }));
      expect(JSON.stringify(stateAfterRefine.originalResume?.meta)).not.toContain(rawInstruction);
      expect(JSON.stringify(stateAfterRefine.originalResume?.meta)).not.toContain(rawIssue);
      expect(JSON.stringify(stateAfterRefine.originalResume?.meta)).not.toContain(rawRationale);

      expect(useResumeStore.getState().getActiveResume()?.basics?.summary).toBe(
        'Experienced engineer with a decade of building scalable web applications'
      );

      useResumeStore.getState().applyOptimization('summary-refine-1');
      expect(useResumeStore.getState().getActiveResume()?.basics?.summary).toBe('Refined optimized summary');
    });
  });

  describe('headline', () => {
    it('exact apply: replaces basics.label', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({ sectionId: 'headline-1', sectionType: 'headline', optimized: 'Senior Software Engineer' })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.label).toBe('Senior Software Engineer');
    });
  });

  describe('experience', () => {
    it('exact apply: replaces the matching highlight', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-1',
          sectionType: 'experience',
          original: EXPERIENCE_HIGHLIGHT,
          optimized: 'Spearheaded migration to microservices, cutting latency 40% (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.work?.[0].highlights?.[0]).toBe(
        'Spearheaded migration to microservices, cutting latency 40% (verify)'
      );
    });

    it("fuzzy apply (prefix match): replaces the highlight when the optimization's original is a truncated prefix", () => {
      const truncated = SECOND_WORK_HIGHLIGHT.slice(0, 40);
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-2',
          sectionType: 'experience',
          original: truncated,
          optimized: 'Maintained internal React/TypeScript tooling for the engineering team (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.work?.[1].highlights?.[0]).toBe(
        'Maintained internal React/TypeScript tooling for the engineering team (verify)'
      );
    });

    it('fuzzy apply (word-overlap match): replaces the highlight when most significant words overlap', () => {
      // Significant (>3 char) words mostly overlap with EXPERIENCE_HIGHLIGHT, but
      // neither string is a 40-char prefix of the other.
      const wordOverlapOriginal =
        'migration legacy payment microservices latency percent regions extra padding words added here';

      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-3',
          sectionType: 'experience',
          original: wordOverlapOriginal,
          optimized: 'Word-overlap matched replacement (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.work?.[0].highlights?.[0]).toBe('Word-overlap matched replacement (verify)');
    });

    it('no-match: optimization is silently dropped, resume unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-4',
          sectionType: 'experience',
          original: 'this text does not exist anywhere in the fixture resume at all',
          optimized: 'Should never appear',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.work?.[0].highlights?.[0]).toBe(EXPERIENCE_HIGHLIGHT);
      expect(active?.work?.[1].highlights?.[0]).toBe(SECOND_WORK_HIGHLIGHT);
      expect(JSON.stringify(active)).not.toContain('Should never appear');
    });

    it('applied:false: resume unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-5',
          sectionType: 'experience',
          original: EXPERIENCE_HIGHLIGHT,
          optimized: 'Should not be applied',
          applied: false,
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.work?.[0].highlights?.[0]).toBe(EXPERIENCE_HIGHLIGHT);
    });
  });

  describe('education', () => {
    it('exact apply: replaces a matching `area` field', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'edu-1',
          sectionType: 'education',
          original: 'Computer Science',
          optimized: 'Computer Science (Honors)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.education?.[0].area).toBe('Computer Science (Honors)');
    });

    it('fuzzy apply (prefix match): replaces a matching highlight', () => {
      const truncated = EDU_HIGHLIGHT.slice(0, 40);
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'edu-2',
          sectionType: 'education',
          original: truncated,
          optimized: 'Researched distributed systems performance optimization for cloud infra (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.education?.[1].highlights?.[0]).toBe(
        'Researched distributed systems performance optimization for cloud infra (verify)'
      );
    });

    it('no-match: optimization is silently dropped, resume unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'edu-3',
          sectionType: 'education',
          original: 'nothing here matches this string whatsoever in the fixture',
          optimized: 'Should never appear',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.education?.[0].area).toBe('Computer Science');
      expect(active?.education?.[1].highlights?.[0]).toBe(EDU_HIGHLIGHT);
    });
  });

  describe('projects', () => {
    it('exact apply: replaces a matching `description` field', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'proj-1',
          sectionType: 'projects',
          original: PROJECT_DESCRIPTION,
          optimized: 'AI-driven resume tailoring platform serving job seekers worldwide (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.projects?.[0].description).toBe(
        'AI-driven resume tailoring platform serving job seekers worldwide (verify)'
      );
    });

    it('fuzzy apply (prefix match): replaces a matching `name` field', () => {
      const truncated = 'Internal Dashboard'.slice(0, 10); // shorter than 40 chars; still a prefix
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'proj-2',
          sectionType: 'projects',
          original: truncated,
          optimized: 'Internal Dashboard Pro',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.projects?.[0].name).toBe('Internal Dashboard Pro');
    });

    it('no-match: optimization is silently dropped, resume unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'proj-3',
          sectionType: 'projects',
          original: 'absolutely nothing in the fixture resembles this text at all',
          optimized: 'Should never appear',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.projects?.[0].name).toBe('Internal Dashboard');
      expect(active?.projects?.[0].description).toBe(PROJECT_DESCRIPTION);
    });
  });

  describe('certifications (recommendation-only — never merged)', () => {
    it('never rewrites an existing certificate name, even on an exact content match', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'cert-1',
          sectionType: 'certifications',
          original: CERT_NAME,
          optimized: 'AWS Certified Solutions Architect - Professional',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.certificates?.[0].name).toBe(CERT_NAME);
    });

    it('never rewrites an existing certificate name on a fuzzy prefix match', () => {
      const truncated = CERT_NAME.slice(0, 40);
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'cert-2',
          sectionType: 'certifications',
          original: truncated,
          optimized: 'AWS Certified Solutions Architect - Professional (verify)',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.certificates?.[0].name).toBe(CERT_NAME);
    });

    it('no-match recommendations also leave the resume unchanged', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'cert-3',
          sectionType: 'certifications',
          original: 'Some Other Certification That Does Not Exist',
          optimized: 'Should never appear',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.certificates?.[0].name).toBe(CERT_NAME);
    });
  });

  describe('skills', () => {
    it('does NOT modify the resume skills array (suggestions only)', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'skills-1',
          sectionType: 'skills',
          original: 'current: JavaScript, Python',
          optimized: 'add: Go, Rust',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.skills).toEqual([{ name: 'Frontend', keywords: ['JavaScript', 'Python'] }]);
    });
  });

  describe('showOptimized toggle', () => {
    it('showOptimized=false returns the original resume, ignoring applied optimizations', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({ sectionId: 'summary-1', sectionType: 'summary', optimized: 'New AI-written summary' })
      );
      useResumeStore.getState().setShowOptimized(false);

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe('Experienced engineer with a decade of building scalable web applications');
    });

    it('getActiveResume does not mutate the stored originalResume', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-1',
          sectionType: 'experience',
          original: EXPERIENCE_HIGHLIGHT,
          optimized: 'Mutated highlight',
        })
      );

      useResumeStore.getState().getActiveResume();
      expect(useResumeStore.getState().originalResume?.work?.[0].highlights?.[0]).toBe(EXPERIENCE_HIGHLIGHT);
    });

    it('is idempotent: repeated calls return equivalent merged resumes', () => {
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'exp-1',
          sectionType: 'experience',
          original: EXPERIENCE_HIGHLIGHT,
          optimized: 'Stable replacement (verify)',
        })
      );

      const first = useResumeStore.getState().getActiveResume();
      const second = useResumeStore.getState().getActiveResume();
      expect(second).toEqual(first);
    });
  });

  describe('Saudi nationality summary prepend', () => {
    it("showOptimized=false: prepends 'Saudi ' to the cloned original summary", () => {
      useResumeStore.getState().setSaudiNational(true);
      useResumeStore.getState().setShowOptimized(false);

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe(
        'Saudi Experienced engineer with a decade of building scalable web applications'
      );
      // Original in the store is untouched
      expect(useResumeStore.getState().originalResume?.basics?.summary).toBe(
        'Experienced engineer with a decade of building scalable web applications'
      );
    });

    it("showOptimized=true: prepends 'Saudi ' to the merged summary when it doesn't already start with it", () => {
      useResumeStore.getState().setSaudiNational(true);
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'summary-1',
          sectionType: 'summary',
          optimized: 'Results-driven engineer with a decade of experience',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe('Saudi Results-driven engineer with a decade of experience');
    });

    it("showOptimized=true: does NOT double-prepend when the optimized summary already starts with 'saudi'", () => {
      useResumeStore.getState().setSaudiNational(true);
      useResumeStore.getState().addOptimization(
        buildOpt({
          sectionId: 'summary-1',
          sectionType: 'summary',
          optimized: 'Saudi-based engineer with a decade of experience',
        })
      );

      const active = useResumeStore.getState().getActiveResume();
      expect(active?.basics?.summary).toBe('Saudi-based engineer with a decade of experience');
    });
  });

  describe('cached analysis explainability payload', () => {
    const RESUME = 'resume text for cache';
    const JOB = 'job description for cache';

    it('round-trips categoryScores and strategicRealityCheck', () => {
      const realityCheck = {
        riskTier: 'medium' as const,
        recommendation: 'optimize_now' as const,
        confidence: 'medium' as const,
        riskTypes: ['tenure'],
        summary: 'Review before optimizing.',
        strengths: [{ title: 'Led a team', evidence: [{ source: 'resume' as const, snippet: 'Managed 6 people' }] }],
        confirmedRisks: [],
        unclearRisks: [{ type: 'skill', topic: 'K8s', reason: 'no detail', evidenceNeeded: 'a project' }],
        limits: { cannotDetermine: [], assumptions: ['Assumed fluency'] },
      };
      useResumeStore.getState().setCachedAnalysis(RESUME, JOB, {
        score: 72,
        coverage: 0.7,
        similarity: 0.7,
        missingKeywords: ['GraphQL'],
        strongMatches: ['React'],
        recommendations: [],
        overallAssessment: '',
        categoryScores: {
          hard_skills: { score: 8, max: 10, matched: ['React'] },
          experience: { score: 6, max: 10 },
          education: { score: 5, max: 10 },
          soft_skills: { score: 7, max: 10 },
        },
        strategicRealityCheck: realityCheck,
      }, false);

      const cached = useResumeStore.getState().getCachedAnalysis(RESUME, JOB, false);
      expect(cached?.categoryScores?.hard_skills.matched).toEqual(['React']);
      expect(cached?.strategicRealityCheck?.unclearRisks).toHaveLength(1);
      expect(cached?.strategicRealityCheck?.limits.assumptions).toEqual(['Assumed fluency']);
    });

    it('reads a legacy-shape entry without the new fields', () => {
      useResumeStore.getState().setCachedAnalysis(RESUME, JOB, {
        score: 60,
        coverage: 0.6,
        similarity: 0.6,
        missingKeywords: [],
        strongMatches: [],
        recommendations: [],
        overallAssessment: '',
      }, false);

      const cached = useResumeStore.getState().getCachedAnalysis(RESUME, JOB, false);
      expect(cached?.score).toBe(60);
      expect(cached?.categoryScores).toBeUndefined();
      expect(cached?.strategicRealityCheck).toBeUndefined();
    });
  });
});
