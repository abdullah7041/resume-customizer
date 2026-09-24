import { describe, expect, it } from 'vitest';
import type { ResumeSchema } from '@/types/resume';
import {
  MAX_RESUME_LIBRARY_SIZE,
  addResumeToLibrary,
  migrateLegacyResume,
  removeResumeFromLibrary,
} from './resumeLibrary';

const resume = (name: string): ResumeSchema => ({
  basics: { name, label: '', email: '', phone: '', summary: '', location: { city: '', countryCode: '', region: '' }, profiles: [] },
  work: [], education: [], skills: [], projects: [],
});

describe('resume library', () => {
  it('migrates the existing resume once only when the library is empty', () => {
    const migrated = migrateLegacyResume([], { parsedResume: resume('Universal'), plainText: 'universal resume', sourceFileName: 'universal.pdf' }, 10);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({ name: 'universal.pdf', sourceFileName: 'universal.pdf' });
    expect(migrateLegacyResume(migrated, { parsedResume: resume('Other'), plainText: 'other' }, 20)).toBe(migrated);
  });

  it('allows five distinct resumes, rejects a sixth, and updates a duplicate in place', () => {
    let entries = [];
    for (let index = 0; index < MAX_RESUME_LIBRARY_SIZE; index += 1) {
      entries = addResumeToLibrary(entries, { parsedResume: resume(`Resume ${index}`), plainText: `resume ${index}` }, index).entries;
    }
    expect(entries).toHaveLength(5);
    expect(() => addResumeToLibrary(entries, { parsedResume: resume('Six'), plainText: 'sixth' }, 10)).toThrow(/five resumes/i);

    const updated = addResumeToLibrary(entries, { parsedResume: resume('Updated'), plainText: 'resume 0' }, 20);
    expect(updated.entries).toHaveLength(5);
    expect(updated.entry.id).toBe(entries[0].id);
  });

  it('selects the newest remaining resume when the active resume is deleted', () => {
    const first = addResumeToLibrary([], { parsedResume: resume('First'), plainText: 'first' }, 1);
    const second = addResumeToLibrary(first.entries, { parsedResume: resume('Second'), plainText: 'second' }, 2);
    const removed = removeResumeFromLibrary(second.entries, second.entry.id, second.entry.id);
    expect(removed.activeResumeId).toBe(first.entry.id);
    expect(removed.entries[0].parsedResume.basics.name).toBe('First');
  });

  it('keeps parsed resume objects isolated from caller mutations', () => {
    const source = resume('Original');
    const result = addResumeToLibrary([], { parsedResume: source, plainText: 'text' }, 1);
    source.basics.name = 'Mutated';
    expect(result.entry.parsedResume.basics.name).toBe('Original');
  });

  it('uses the complete filename for new uploads and distinct labels for pasted versions', () => {
    const first = addResumeToLibrary([], { parsedResume: resume('Same Person'), plainText: 'first', sourceFileName: 'Engineering Resume.pdf' }, 1);
    const second = addResumeToLibrary(first.entries, { parsedResume: resume('Same Person'), plainText: 'second' }, 2);
    expect(first.entry.name).toBe('Engineering Resume.pdf');
    expect(second.entry.name).toContain('Same Person');
    expect(second.entry.name).not.toBe(first.entry.name);
  });
});
