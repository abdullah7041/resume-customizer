import { describe, expect, it } from 'vitest';
import { suggestRolesFromResume } from '@/lib/jobs/roleSuggestions';
import type { ResumeSchema } from '@/types/resume';

function resume(overrides: Partial<ResumeSchema> = {}): ResumeSchema {
  return {
    basics: { name: 'Abdullah', label: 'Senior AI Engineer', summary: '', location: {} },
    work: [],
    education: [],
    skills: [],
    projects: [],
    ...overrides,
  } as unknown as ResumeSchema;
}

const job = (position: string) => ({ name: 'Salla', position, startDate: '', endDate: '', highlights: [] });

describe('suggestRolesFromResume', () => {
  it('leads with the headline, which is the closest thing to a stated target', () => {
    const roles = suggestRolesFromResume(
      resume({ work: [job('Backend Engineer'), job('Data Analyst')] as never }),
    );

    expect(roles[0]).toBe('Senior AI Engineer');
    expect(roles).toContain('Backend Engineer');
    expect(roles).toContain('Data Analyst');
  });

  it('keeps the CV order of the work entries behind the headline', () => {
    const roles = suggestRolesFromResume(
      resume({
        basics: { name: 'Abdullah' } as never,
        work: [job('Backend Engineer'), job('Data Analyst')] as never,
      }),
    );

    expect(roles).toEqual(['Backend Engineer', 'Data Analyst']);
  });

  it('collapses titles that would filter the feed identically', () => {
    // "Senior AI Engineer" and "AI Engineer" derive the same terms — senior is a
    // level, not a function — so offering both is offering the same chip twice.
    const roles = suggestRolesFromResume(resume({ work: [job('AI Engineer')] as never }));

    expect(roles).toEqual(['Senior AI Engineer']);
  });

  it('drops a title that carries no role terms at all', () => {
    // A headline of nothing but a level would match every posting on every board.
    const roles = suggestRolesFromResume(
      resume({ basics: { name: 'A', label: 'Senior' } as never, work: [job('Data Analyst')] as never }),
    );

    expect(roles).toEqual(['Data Analyst']);
  });

  it('keeps Arabic titles, which are role terms like any other', () => {
    const roles = suggestRolesFromResume(
      resume({ basics: { name: 'A', label: 'مهندس برمجيات' } as never }),
    );

    expect(roles).toEqual(['مهندس برمجيات']);
  });

  it('offers a few, not a career history', () => {
    const roles = suggestRolesFromResume(
      resume({
        work: [
          job('Backend Engineer'),
          job('Data Analyst'),
          job('Product Manager'),
          job('QA Lead'),
          job('Support Specialist'),
        ] as never,
      }),
    );

    expect(roles).toHaveLength(4);
  });

  it('does not re-offer a role the feed is already filtering on', () => {
    // Chips that change nothing when tapped are worse than no chips: the user
    // taps, the feed does not move, and the suggestion looks broken.
    const roles = suggestRolesFromResume(
      resume({ work: [job('Data Analyst')] as never }),
      { exclude: ['AI Engineer'] },
    );

    expect(roles).toEqual(['Data Analyst']);
  });

  it('has nothing to offer without a resume', () => {
    expect(suggestRolesFromResume(null)).toEqual([]);
    expect(suggestRolesFromResume(resume({ basics: { name: 'A' } as never }))).toEqual([]);
  });
});
