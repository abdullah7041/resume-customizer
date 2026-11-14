import { expect, it, vi } from 'vitest';

it('preserves exact unowned legacy bytes before authentication activates a namespace', async () => {
  vi.resetModules();
  localStorage.clear();
  const legacy = JSON.stringify({ version: 3, state: { parsedResumeText: 'Private legacy source', unknownPrivateField: 'Preserve these bytes' } });
  localStorage.setItem('resume-storage', legacy);
  await import('@/lib/stores/resumeStore');
  expect(localStorage.getItem('resume-storage')).toBe(legacy);
});
