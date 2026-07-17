import { describe, expect, it } from 'vitest';
import { canMergeOptimization, findMergeTarget, mergeOptimizedResume } from '../mergeResume';
import type { ResumeSchema } from '@/types/resume';
import type { OptimizationResult } from '@/types/templates';

const baseResume = (): ResumeSchema => ({
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
      highlights: [
        'Built payment APIs used by 40 merchants',
        'Maintained CI pipeline',
      ],
    },
  ],
  education: [
    { institution: 'KSU', area: 'Computer Science', studyType: 'BSc', startDate: '2014', endDate: '2018' },
  ],
  skills: [{ name: 'Node.js', level: '', keywords: [] }],
  projects: [
    { name: 'Dashboard', description: 'Internal analytics dashboard', highlights: ['Cut report time by 30%'] },
  ],
  certificates: [{ name: 'AWS Cloud Practitioner', issuer: 'AWS', date: '2022' }],
});

const card = (over: Partial<OptimizationResult>): OptimizationResult => ({
  sectionId: 'experience-0',
  sectionType: 'experience',
  original: 'Built payment APIs used by 40 merchants',
  optimized: 'Engineered payment APIs adopted by 40 merchants, cutting settlement time 25%',
  applied: true,
  ...over,
});

describe('findMergeTarget / canMergeOptimization', () => {
  it('locates a work highlight by fuzzy content match', () => {
    expect(findMergeTarget(card({}), baseResume())).toEqual({ kind: 'work.highlight', workIdx: 0, hlIdx: 0 });
    expect(canMergeOptimization(card({}), baseResume())).toBe(true);
  });

  it('returns null when the original text exists nowhere in the resume', () => {
    const missing = card({ original: 'Completely unrelated bullet about welding certifications' });
    expect(findMergeTarget(missing, baseResume())).toBeNull();
    expect(canMergeOptimization(missing, baseResume())).toBe(false);
  });

  it('summary/headline target basics directly', () => {
    expect(findMergeTarget(card({ sectionType: 'summary', original: 'x' }), baseResume()))
      .toEqual({ kind: 'basics.summary' });
    expect(findMergeTarget(card({ sectionType: 'headline', original: 'x' }), baseResume()))
      .toEqual({ kind: 'basics.label' });
  });

  it('locates education area and project fields', () => {
    expect(findMergeTarget(card({ sectionType: 'education', original: 'Computer Science' }), baseResume()))
      .toEqual({ kind: 'education.area', eduIdx: 0 });
    expect(findMergeTarget(card({ sectionType: 'projects', original: 'Dashboard' }), baseResume()))
      .toEqual({ kind: 'project.name', projIdx: 0 });
    expect(findMergeTarget(card({ sectionType: 'projects', original: 'Cut report time by 30%' }), baseResume()))
      .toEqual({ kind: 'project.highlight', projIdx: 0, hlIdx: 0 });
  });

  it('never locates a target for skills cards', () => {
    expect(findMergeTarget(card({ sectionType: 'skills', original: 'Node.js' }), baseResume())).toBeNull();
  });

  it('returns null for empty optimized text', () => {
    expect(findMergeTarget(card({ optimized: '' }), baseResume())).toBeNull();
  });
});

describe('mergeOptimizedResume', () => {
  it('applies matched cards without mutating the original', () => {
    const original = baseResume();
    const { resume, diagnostics } = mergeOptimizedResume(original, [card({})], { isSaudiNational: false });

    expect(resume.work![0].highlights![0]).toContain('Engineered payment APIs');
    expect(original.work![0].highlights![0]).toBe('Built payment APIs used by 40 merchants');
    expect(diagnostics.appliedCount).toBe(1);
    expect(diagnostics.failedCount).toBe(0);
  });

  it('skips non-applied cards entirely', () => {
    const { resume, diagnostics } = mergeOptimizedResume(baseResume(), [card({ applied: false })], { isSaudiNational: false });
    expect(resume.work![0].highlights![0]).toBe('Built payment APIs used by 40 merchants');
    expect(diagnostics.appliedCount).toBe(0);
  });

  it('records a failure (and changes nothing) when the content match misses', () => {
    const missing = card({ original: 'Nonexistent bullet with zero overlap whatsoever' });
    const { resume, diagnostics } = mergeOptimizedResume(baseResume(), [missing], { isSaudiNational: false });

    expect(resume).toEqual(mergeOptimizedResume(baseResume(), [], { isSaudiNational: false }).resume);
    expect(diagnostics.failedCount).toBe(1);
    expect(diagnostics.failedMatches[0]).toMatchObject({ sectionType: 'experience', sectionId: 'experience-0' });
  });

  it('replaces summary and headline directly', () => {
    const cards = [
      card({ sectionId: 'summary-0', sectionType: 'summary', original: 'old', optimized: 'Sharper professional summary.' }),
      card({ sectionId: 'headline-0', sectionType: 'headline', original: 'old', optimized: 'Senior Backend Engineer' }),
    ];
    const { resume } = mergeOptimizedResume(baseResume(), cards, { isSaudiNational: false });
    expect(resume.basics!.summary).toBe('Sharper professional summary.');
    expect(resume.basics!.label).toBe('Senior Backend Engineer');
  });

  it('prepends Saudi to the summary for Saudi nationals (idempotently)', () => {
    const { resume } = mergeOptimizedResume(baseResume(), [], { isSaudiNational: true });
    expect(resume.basics!.summary!.startsWith('Saudi ')).toBe(true);
    const again = mergeOptimizedResume(resume, [], { isSaudiNational: true }).resume;
    expect(again.basics!.summary).toBe(resume.basics!.summary);
  });

  it('matches sequential cards against the progressively-merged clone (first-match-wins parity)', () => {
    // Two cards share the same original. The first rewrites the highlight into text
    // with no word overlap with the original, so the second no longer finds it and
    // fails — mirroring the store's historical progressive-merge behavior exactly.
    const first = card({ sectionId: 'experience-0', optimized: 'Delivered the core services platform for the fintech group' });
    const second = card({ sectionId: 'experience-1', optimized: 'A different rewrite of the same bullet' });
    const { resume, diagnostics } = mergeOptimizedResume(baseResume(), [first, second], { isSaudiNational: false });

    expect(resume.work![0].highlights![0]).toBe('Delivered the core services platform for the fintech group');
    expect(diagnostics.appliedCount).toBe(1);
    expect(diagnostics.failedCount).toBe(1);
  });
});
