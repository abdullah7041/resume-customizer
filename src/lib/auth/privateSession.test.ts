import { beforeEach, expect, it } from 'vitest';
import { activatePrivateSession, privateStorage } from './privateSession';

beforeEach(() => localStorage.clear());

it('quarantines unknown legacy content without assigning it to a signed-in visitor', () => {
  localStorage.setItem('watheq:resumeData', 'legacy private resume');
  activatePrivateSession('new-user', () => {});
  expect(localStorage.getItem('watheq:resumeData')).toBeNull();
  expect(localStorage.getItem('watheq:privateSession:legacy')).toContain('legacy private resume');
});

it('keeps ten owner/guest transitions isolated and restores each owner without data loss', () => {
  activatePrivateSession('a', () => {});
  privateStorage.setItem('watheq:resumeData', 'A');
  for (let index = 0; index < 10; index++) {
    activatePrivateSession(null, () => {});
    expect(privateStorage.getItem('watheq:resumeData')).toBeNull();
    activatePrivateSession('b', () => {});
    expect(privateStorage.getItem('watheq:resumeData')).toBeNull();
    activatePrivateSession('a', () => {});
    expect(privateStorage.getItem('watheq:resumeData')).toBe('A');
  }
});
