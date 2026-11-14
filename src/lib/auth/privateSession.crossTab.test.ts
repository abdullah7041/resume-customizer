import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

it('keeps late writes in their original owner namespace before storage events arrive', async () => {
  const a = await import('./privateSession');
  a.activatePrivateSession('a', () => {});
  const revision = a.getPrivateSessionRevision();
  a.privateStorage.setItem('watheq:interviewQuestions', 'A questions');
  vi.resetModules();
  const b = await import('./privateSession');
  b.activatePrivateSession('b', () => {});
  expect(a.getPrivateSessionRevision()).not.toBe(revision);
  // An old synchronous continuation still belongs to A, never B.
  a.privateStorage.setItem('watheq:interviewQuestions', 'late A');
  expect(b.privateStorage.getItem('watheq:interviewQuestions')).toBeNull();
  b.activatePrivateSession('b', () => {});
  expect(b.privateStorage.getItem('watheq:interviewQuestions')).toBeNull();
  b.activatePrivateSession('a', () => {});
  expect(a.getPrivateSessionRevision()).not.toBe(revision);
  expect(b.privateStorage.getItem('watheq:interviewQuestions')).toBe('late A');
});
