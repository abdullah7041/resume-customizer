import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useResumeStore } from './resumeStore';
import type { ResumeSchema } from '../../types/resume';
import type { OptimizationResult } from '../../types/templates';
import { buildScorePresentation, verificationSignature } from '@/lib/optimize/scoreModel';
import { createAssessmentContext } from '@/lib/match/assessmentContext';
import type { AssessmentInput } from '@/types/assessment';
import { fingerprintText } from '@/lib/match/assessmentContext';

describe('resumeStore', () => {
    afterEach(() => vi.useRealTimers());
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

    it('should default optimizationOrigin to null and set it via setOptimizationOrigin', () => {
        expect(useResumeStore.getState().optimizationOrigin).toBeNull();

        useResumeStore.getState().setOptimizationOrigin('guest_preview');
        expect(useResumeStore.getState().optimizationOrigin).toBe('guest_preview');

        useResumeStore.getState().setOptimizationOrigin('paid');
        expect(useResumeStore.getState().optimizationOrigin).toBe('paid');
    });

    it('should clear optimizationOrigin on clearAll and resetForNewUpload', () => {
        useResumeStore.getState().setOptimizationOrigin('guest_preview');
        useResumeStore.getState().clearAll();
        expect(useResumeStore.getState().optimizationOrigin).toBeNull();

        useResumeStore.getState().setOptimizationOrigin('guest_preview');
        useResumeStore.getState().resetForNewUpload();
        expect(useResumeStore.getState().optimizationOrigin).toBeNull();
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

    it('keeps applied counts and verified projection inputs aligned after persist round-trip', () => {
        const resumeText = 'Persisted resume text with enough detail to preserve the score verification signature across hydration.';
        const jobDescription = 'Senior frontend engineer role requiring React and TypeScript delivery experience.';
        const optimizations: OptimizationResult[] = [
            {
                sectionId: 'summary-0',
                sectionType: 'summary',
                original: 'Built applications.',
                optimized: 'Built React applications.',
                applied: true,
                mergeStatus: 'mergeable',
            },
            {
                sectionId: 'experience-0',
                sectionType: 'experience',
                original: 'Delivered features.',
                optimized: 'Delivered TypeScript features.',
                applied: false,
                mergeStatus: 'mergeable',
            },
            {
                sectionId: 'headline-0',
                sectionType: 'headline',
                original: 'Engineer',
                optimized: 'Senior Frontend Engineer',
                applied: false,
                mergeStatus: 'failed',
            },
        ];
        const verifiedPotential = {
            score: 78,
            baselineAtVerify: 60,
            signature: verificationSignature(optimizations, resumeText, jobDescription),
            verifiedAt: Date.now(),
            outcome: 'improved' as const,
        };

        useResumeStore.getState().setParsedResumeText(resumeText);
        useResumeStore.getState().setOptimizations(optimizations);
        useResumeStore.getState().setBaselineMatchScore(60);
        useResumeStore.getState().setOptimizationMetrics({
            improvement: null,
            verifiedPotential,
            hasJobDescription: true,
        });

        const { partialize, merge } = useResumeStore.persist.getOptions();
        if (!partialize || !merge) throw new Error('Persist round-trip options are unavailable');
        const persisted = partialize(useResumeStore.getState());
        const roundTripped = JSON.parse(JSON.stringify(persisted)) as typeof persisted;

        useResumeStore.getState().clearAll();
        const rehydrated = merge(
            roundTripped,
            useResumeStore.getState(),
        ) as ReturnType<typeof useResumeStore.getState>;
        const presentation = buildScorePresentation({
            optimizations: rehydrated.optimizations,
            baselineScore: rehydrated.baselineMatchScore,
            improvement: rehydrated.optimizationMetrics.improvement ?? null,
            verifiedPotential: rehydrated.optimizationMetrics.verifiedPotential,
            resumeText: rehydrated.parsedResumeText ?? '',
            jobDescription,
        });

        expect(presentation.counts).toEqual({
            actionableTotal: 2,
            actionableApplied: 1,
            recommendationTotal: 0,
            mergeFailed: 1,
        });
        expect(presentation.currentAppliedProjection).toBe(69);
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
    const context = () => createAssessmentContext({ resumeText: RESUME, jobDescription: JOB,
      language: 'en', kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });

    it('round-trips categoryScores and strategicRealityCheck', async () => {
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
      const assessment = await context();
      useResumeStore.getState().setCachedAssessment(assessment, {
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
      });

      const cached = useResumeStore.getState().getCachedAssessment(assessment);
      expect(cached?.categoryScores?.hard_skills.matched).toEqual(['React']);
      expect(cached?.strategicRealityCheck?.unclearRisks).toHaveLength(1);
      expect(cached?.strategicRealityCheck?.limits.assumptions).toEqual(['Assumed fluency']);
    });

    it('reads a minimal context-bound entry without optional explainability fields', async () => {
      const assessment = await context();
      useResumeStore.getState().setCachedAssessment(assessment, {
        score: 60,
        coverage: 0.6,
        similarity: 0.6,
        missingKeywords: [],
        strongMatches: [],
        recommendations: [],
        overallAssessment: '',
      });

      const cached = useResumeStore.getState().getCachedAssessment(assessment);
      expect(cached?.score).toBe(60);
      expect(cached?.categoryScores).toBeUndefined();
      expect(cached?.strategicRealityCheck).toBeUndefined();
    });

    it('does not reuse an analysis when text differs by surrounding whitespace', async () => {
      useResumeStore.getState().setShowOptimized(true);
      const spaced = await createAssessmentContext({ resumeText: '  resume text for cache  ',
        jobDescription: '  job description for cache  ', language: 'en', kind: 'match',
        isOptimized: false, rubricVersion: 'match-v1' });
      useResumeStore.getState().setCachedAssessment(spaced, {
        score: 64,
        matchedKeywords: ['React'],
        missingKeywords: ['Docker'],
      });

      const unspaced = await context();
      expect(useResumeStore.getState().getCachedAssessment(unspaced)).toBeNull();
    });
  });

  describe('context-bound assessment cache', () => {
    const input: AssessmentInput = {
      resumeText: 'r'.repeat(120) + 'A',
      jobDescription: 'j'.repeat(120) + 'A',
      language: 'en',
      kind: 'match',
      isOptimized: false,
      rubricVersion: 'match-v1',
    };
    const analysis = { score: 71, missingKeywords: ['Kubernetes'] };

    it('separates full-prefix collisions and all scoring dimensions', async () => {
      const base = await createAssessmentContext(input);
      useResumeStore.getState().setCachedAssessment(base, analysis);
      expect(useResumeStore.getState().getCachedAssessment(base)).toMatchObject({ ...analysis, context: base });

      const variations: AssessmentInput[] = [
        { ...input, resumeText: 'r'.repeat(120) + 'B' },
        { ...input, jobDescription: 'j'.repeat(120) + 'B' },
        { ...input, language: 'ar' },
        { ...input, kind: 'optimize' },
        { ...input, isOptimized: true },
        { ...input, rubricVersion: 'match-v2' },
      ];
      for (const variation of variations) {
        const changed = await createAssessmentContext(variation);
        expect(changed.key).not.toBe(base.key);
        expect(useResumeStore.getState().getCachedAssessment(changed)).toBeNull();
      }
      expect(useResumeStore.getState().getCachedAssessment({ ...base, language: 'ar' })).toBeNull();
    });

    it('confirms only the exact current proposal and preserves it across variants', async () => {
        const statement = 'Led delivery';
        const proposedFingerprint = await fingerprintText(statement);
        const evidence = { version: 1 as const, targetId: 'work:a', originalFingerprint: 'old', proposedFingerprint,
            references: [], sourceFingerprints: {}, status: 'needs_review' as const, reasons: ['semantic_review' as const] };
        const card = { sectionId: 'bullet-a', sectionType: 'experience' as const, original: 'Delivered', optimized: statement,
            applied: false, evidence };
        useResumeStore.getState().setOptimizations([card]);
        const source = { id: 'source-a', kind: 'resume' as const, targetId: 'work:a', text: 'Delivered', fingerprint: 'old' };
        useResumeStore.getState().setEvidenceSources([source]);
        const confirmation = { targetId: 'work:a', proposedFingerprint, statement, confirmedAt: '2026-09-24T12:00:00Z' };
        expect(useResumeStore.getState().confirmOptimization('bullet-a', { ...confirmation, statement: 'Other' })).toBe(false);
        expect(useResumeStore.getState().confirmOptimization('bullet-a', confirmation)).toBe(true);
        const variant = useResumeStore.getState().saveCurrentAsVariant('One', 'Job');
        useResumeStore.getState().setEvidenceSources([]);
        useResumeStore.getState().refineOptimization('bullet-a', { improved: 'Led another project', instruction: 'change' });
        expect(useResumeStore.getState().optimizations[0].confirmation).toBeUndefined();
        useResumeStore.getState().openVariant(variant);
        expect(useResumeStore.getState().optimizations[0].confirmation).toEqual(confirmation);
        expect(useResumeStore.getState().evidenceSources).toEqual([source]);
    });

    it('keeps old visible content while migrating versions 0–3 to unconfirmed legacy review', async () => {
        const migrate = useResumeStore.persist.getOptions().migrate;
        if (!migrate) throw new Error('Migration unavailable');
        for (const version of [0, 1, 2, 3]) {
            const restored = await migrate({ originalResume: buildFixture(), optimizations: [{
                sectionId: 'legacy', sectionType: 'summary', original: 'Old', optimized: 'Visible', applied: true,
                evidence: { status: 'source_matched' },
            }], jobVariants: [] }, version) as ReturnType<typeof useResumeStore.getState>;
            expect(restored.originalResume?.basics.name).toBe('Jane Doe');
            expect(restored.optimizations[0]).toMatchObject({ optimized: 'Visible', evidence: { status: 'legacy' } });
            expect(restored.optimizations[0].confirmation).toBeUndefined();
            expect(restored.evidenceSources).toEqual([]);
        }
        const missingBaseline = await migrate({ originalResume: null, parsedResumeText: 'Visible old resume',
            optimizations: [{ sectionId: 'old', sectionType: 'summary', original: '', optimized: 'Visible old claim', applied: true }],
            jobVariants: [] }, 3) as ReturnType<typeof useResumeStore.getState>;
        expect(missingBaseline.parsedResumeText).toBe('Visible old resume');
        expect(missingBaseline.optimizations[0].optimized).toBe('Visible old claim');
        expect(missingBaseline.optimizations[0].evidence?.status).toBe('legacy');
        const source = { id: 'source', kind: 'resume', text: 'Old', fingerprint: 'fingerprint', targetId: 'summary' };
        const withSources = await migrate({ optimizations: [], jobVariants: [],
            optimizeRun: { data: { evidenceSources: [source, { id: 1 }] } } }, 3) as ReturnType<typeof useResumeStore.getState>;
        expect(withSources.evidenceSources).toEqual([source]);
        const sourcedEvidence = { version: 1 as const, targetId: 'summary', originalFingerprint: 'old',
            proposedFingerprint: 'new', references: [{ sourceId: 'source', quote: 'Old' }],
            sourceFingerprints: { source: 'fingerprint' }, status: 'source_matched' as const, reasons: [] };
        const variantCard = { sectionId: 'same-id', sectionType: 'summary' as const, original: 'Old',
            optimized: 'New', applied: false, evidence: sourcedEvidence };
        const migratedVariant = await migrate({ optimizations: [variantCard], jobVariants: [{ id: 'legacy-variant',
            name: 'Legacy', jobDescription: 'Job', createdAt: '2026-09-24T12:00:00Z',
            updatedAt: '2026-09-24T12:00:00Z', snapshot: { optimizations: [variantCard] } }],
            optimizeRun: { data: { evidenceSources: [source] } } }, 3) as ReturnType<typeof useResumeStore.getState>;
        expect(migratedVariant.optimizations[0].evidence?.status).toBe('source_matched');
        expect(migratedVariant.jobVariants[0].snapshot.evidenceSources).toEqual([]);
        expect(migratedVariant.jobVariants[0].snapshot.optimizations[0].evidence?.status).toBe('legacy');
    });

    it('clears approval when candidate wording changes and keeps unrelated cards approved', async () => {
        const proposedFingerprint = await fingerprintText('Same claim');
        const evidence = { version: 1 as const, targetId: 'work:a', originalFingerprint: 'old', proposedFingerprint,
            references: [], sourceFingerprints: {}, status: 'needs_review' as const, reasons: ['semantic_review' as const] };
        useResumeStore.getState().setOptimizations([
            { sectionId: 'a', sectionType: 'experience', original: 'Old', optimized: 'Same claim', applied: false, evidence },
            { sectionId: 'b', sectionType: 'experience', original: 'Old', optimized: 'Same claim', applied: false,
                evidence: { ...evidence, targetId: 'work:b' } },
        ]);
        const confirmation = { proposedFingerprint, targetId: 'work:a', statement: 'Same claim', confirmedAt: '2026-09-24T12:00:00Z' };
        useResumeStore.getState().confirmOptimization('a', confirmation);
        useResumeStore.getState().confirmOptimization('b', { ...confirmation, targetId: 'work:b' });
        useResumeStore.getState().editOptimization('a', 'Corrected claim', await fingerprintText('Corrected claim'),
            useResumeStore.getState().optimizations[0]);
        expect(useResumeStore.getState().optimizations[0].confirmation).toBeUndefined();
        expect(useResumeStore.getState().optimizations[0].evidence?.proposedFingerprint).toBe(await fingerprintText('Corrected claim'));
        expect(useResumeStore.getState().optimizations[1].confirmation?.targetId).toBe('work:b');
    });

    it('refuses an edit completed after another variant reuses the section ID', async () => {
        useResumeStore.getState().setOptimizations([{ sectionId: 'same-id', sectionType: 'summary',
            original: 'Before A', optimized: 'Proposal A', applied: false }]);
        const staleCard = useResumeStore.getState().optimizations[0];
        useResumeStore.getState().saveCurrentAsVariant('A', 'Job A');
        useResumeStore.getState().setOptimizations([{ sectionId: 'same-id', sectionType: 'summary',
            original: 'Before B', optimized: 'Proposal B', applied: false }]);
        const variant = useResumeStore.getState().saveCurrentAsVariant('B', 'Job B');
        useResumeStore.getState().openVariant(variant);
        expect(useResumeStore.getState().editOptimization('same-id', 'Unsaved A',
            await fingerprintText('Unsaved A'), staleCard)).toBe(false);
        expect(useResumeStore.getState().optimizations[0].optimized).toBe('Proposal B');
    });

    it('does not report a saved confirmation when local storage rejects the write', async () => {
        const statement = 'Claim';
        const proposedFingerprint = await fingerprintText(statement);
        useResumeStore.getState().setOptimizations([{ sectionId: 'claim', sectionType: 'summary', original: 'Old',
            optimized: statement, applied: false, evidence: { version: 1, targetId: 'summary:1',
                originalFingerprint: 'old', proposedFingerprint, references: [], sourceFingerprints: {},
                status: 'needs_review', reasons: ['semantic_review'] } }]);
        const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('full'); });
        try {
            expect(useResumeStore.getState().confirmOptimization('claim', { targetId: 'summary:1',
                proposedFingerprint, statement, confirmedAt: '2026-09-24T12:00:00Z' })).toBe(false);
            expect(useResumeStore.getState().optimizations[0].confirmation).toBeUndefined();
        } finally { setItem.mockRestore(); }
    });

    it('replaces refinement evidence while keeping source records out of public resume metadata', async () => {
      const context = await createAssessmentContext(input);
      const evidence = { version: 1 as const, targetId: 'resume:1', originalFingerprint: 'a', proposedFingerprint: 'b',
        references: [{ sourceId: 'resume:1', quote: '<script>literal</script>' }], sourceFingerprints: { 'resume:1': 'a' },
        status: 'needs_review' as const, reasons: ['semantic_review' as const] };
      const source = { id: 'resume:1', kind: 'resume' as const, targetId: 'resume:1', text: '<script>literal</script>', fingerprint: 'a' };
      useResumeStore.getState().addOptimization(buildOpt({ sectionId: 'summary-evidence', assessmentKey: context.key, sectionType: 'summary', optimized: 'Initial', applied: false }));
      useResumeStore.getState().addOptimization(buildOpt({ sectionId: 'legacy-authored', assessmentKey: context.key, sectionType: 'summary', optimized: 'Candidate wording', applied: false }));
      useResumeStore.getState().setOptimizeRun({ status: 'succeeded', cards: useResumeStore.getState().optimizations,
        assessment: { context, jobSnapshot: input.jobDescription, requestId: 'test', createdAt: new Date().toISOString(), result: null },
        data: { evidenceSources: [] } });
      useResumeStore.getState().refineOptimization('summary-evidence', {
        improved: 'Revised', instruction: 'shorten', evidence, evidenceSources: [source],
        evidenceInputOmissions: { resumeCharacters: 5, clarificationCharacters: 0 },
      });
      const state = useResumeStore.getState();
      expect(state.optimizations[0].evidence).toEqual(evidence);
      expect(state.optimizeRun?.cards).toContainEqual(expect.objectContaining({ sectionId: 'summary-evidence', optimized: 'Revised', evidence }));
      expect(state.optimizeRun?.cards).toContainEqual(expect.objectContaining({ sectionId: 'legacy-authored', optimized: 'Candidate wording' }));
      expect(state.optimizeRun?.data).toMatchObject({ evidenceSources: [source], evidenceInputOmissions: { resumeCharacters: 5, clarificationCharacters: 0 } });
      expect(JSON.stringify(state.originalResume?.meta)).not.toContain(source.text);
    });

    it('does not admit legacy entries or mutate candidate data', async () => {
      const context = await createAssessmentContext(input);
      const originalResume = {
        basics: { name: 'Candidate', label: 'Engineer', email: '', phone: '', summary: 'Original summary', location: { city: '', countryCode: '', region: '' }, profiles: [] },
        work: [], education: [], skills: [], projects: [],
      } satisfies ResumeSchema;
      useResumeStore.setState({ originalResume });
      useResumeStore.setState({ analysisCache: { legacy: { ...analysis, timestamp: Date.now() } } });
      expect(useResumeStore.getState().getCachedAssessment(context)).toBeNull();
      useResumeStore.setState({ analysisCache: { [context.key]: { ...analysis, timestamp: Date.now() } } });
      expect(useResumeStore.getState().getCachedAssessment(context)).toBeNull();
      useResumeStore.getState().setCachedAssessment(context, analysis);
      expect(useResumeStore.getState().originalResume).toBe(originalResume);
      expect(originalResume.basics.summary).toBe('Original summary');
      expect(input.resumeText).toBe('r'.repeat(120) + 'A');
    });

    it('expires at 30 minutes and retains at most 10 entries', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-24T00:00:00Z'));
      const first = await createAssessmentContext(input);
      useResumeStore.getState().setCachedAssessment(first, analysis);
      vi.advanceTimersByTime(30 * 60 * 1000);
      expect(useResumeStore.getState().getCachedAssessment(first)).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(useResumeStore.getState().getCachedAssessment(first)).toBeNull();
      for (let index = 0; index < 11; index++) {
        vi.advanceTimersByTime(1);
        const context = await createAssessmentContext({ ...input, jobDescription: `job-${index}` });
        useResumeStore.getState().setCachedAssessment(context, analysis);
      }
      expect(Object.keys(useResumeStore.getState().analysisCache)).toHaveLength(10);
      expect(useResumeStore.getState().getCachedAssessment(first)).toBeNull();
    });
  });
});
