// Failing-first regression tests (Task 6): merge integrity + recommendation-only
// cards at the store level. Written as it.fails BEFORE the fix to prove the
// defects; each flips to it() in the commit that fixes it.
import { describe, it, expect, beforeEach } from 'vitest';
import { useResumeStore } from './resumeStore';
import type { ResumeSchema } from '../../types/resume';
import type { OptimizationResult } from '../../types/templates';

const resumeWithContent = (): ResumeSchema => ({
  basics: {
    name: 'Sara Al-Otaibi',
    label: 'Software Engineer',
    email: 's@example.com',
    phone: '',
    summary: 'Engineer with five years of backend experience.',
    location: { city: 'Riyadh', countryCode: 'SA', region: '' },
    profiles: [],
  },
  work: [
    {
      name: 'Acme',
      position: 'Backend Engineer',
      startDate: '2020-01',
      endDate: 'Present',
      summary: '',
      highlights: ['Built payment APIs used by 40 merchants'],
    },
  ],
  education: [],
  skills: [{ name: 'Node.js', level: '', keywords: [] }],
  projects: [],
  certificates: [{ name: 'AWS Solutions Architect', issuer: 'AWS', date: '2022' }],
});

const experienceCard = (over: Partial<OptimizationResult> = {}): OptimizationResult => ({
  sectionId: 'experience-0',
  sectionType: 'experience',
  original: 'Built payment APIs used by 40 merchants',
  optimized: 'Engineered payment APIs adopted by 40 merchants',
  applied: false,
  ...over,
});

const skillsCard = (over: Partial<OptimizationResult> = {}): OptimizationResult => ({
  sectionId: 'skills-0',
  sectionType: 'skills',
  original: 'Current: Node.js',
  optimized: 'Add: TypeScript, Kubernetes',
  applied: false,
  ...over,
});

const certCard = (over: Partial<OptimizationResult> = {}): OptimizationResult => ({
  sectionId: 'certifications-0',
  sectionType: 'certifications',
  original: 'Recommended Certification',
  optimized: 'CISSP (ISC2) - security roles increasingly require it',
  applied: false,
  ...over,
});

describe('resumeStore merge integrity (Task 6 regressions)', () => {
  beforeEach(() => {
    useResumeStore.getState().clearAll();
    useResumeStore.getState().setOriginalResume(resumeWithContent());
  });

  // R7: an actionable card whose original text matches nothing in the resume must
  // NOT be marked applied — "marked applied" has to mean "changed resume content".
  it.fails('R7: applyOptimization refuses an unmergeable actionable card (mergeStatus failed)', () => {
    useResumeStore.getState().setOptimizations([
      experienceCard({ original: 'A bullet that appears nowhere in this resume document' }),
    ]);

    useResumeStore.getState().applyOptimization('experience-0');

    const card = useResumeStore.getState().optimizations[0];
    expect(card.applied).toBe(false);
    expect(card.mergeStatus).toBe('failed');
  });

  it.fails('applyOptimization marks a mergeable card applied with mergeStatus mergeable', () => {
    useResumeStore.getState().setOptimizations([experienceCard()]);

    useResumeStore.getState().applyOptimization('experience-0');

    const card = useResumeStore.getState().optimizations[0];
    expect(card.applied).toBe(true);
    expect(card.mergeStatus).toBe('mergeable');
  });

  // R8: certification cards are recommendations — an existing certificate name must
  // never be rewritten into a recommended certification.
  it.fails('R8: applied certification cards never mutate existing certificates', () => {
    useResumeStore.getState().setOptimizations([
      // Legacy persisted state where a cert card ended up applied with an original
      // that fuzzy-matches a real certificate.
      certCard({ original: 'AWS Solutions Architect', applied: true }),
    ]);
    useResumeStore.getState().setShowOptimized(true);

    const active = useResumeStore.getState().getActiveResume();
    expect(active?.certificates?.[0]?.name).toBe('AWS Solutions Architect');
  });

  // R5: Apply All means "apply all actionable resume changes", never recommendations.
  it.fails('R5: applyAllOptimizations leaves recommendation-only cards un-applied', () => {
    useResumeStore.getState().setOptimizations([experienceCard(), skillsCard(), certCard()]);

    useResumeStore.getState().applyAllOptimizations();

    const cards = useResumeStore.getState().optimizations;
    expect(cards.find((c) => c.sectionId === 'experience-0')?.applied).toBe(true);
    expect(cards.find((c) => c.sectionId === 'skills-0')?.applied).toBe(false);
    expect(cards.find((c) => c.sectionId === 'certifications-0')?.applied).toBe(false);
  });

  it.fails('applyOptimization ignores recommendation-only cards entirely', () => {
    useResumeStore.getState().setOptimizations([skillsCard(), certCard()]);

    useResumeStore.getState().applyOptimization('skills-0');
    useResumeStore.getState().applyOptimization('certifications-0');

    const cards = useResumeStore.getState().optimizations;
    expect(cards.every((c) => c.applied === false)).toBe(true);
  });
});
