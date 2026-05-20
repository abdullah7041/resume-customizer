import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCompatibleStorageItem,
  migrateStorageKeys,
  removeCompatibleStorageItem,
  setCompatibleStorageItem,
} from './storage-migration';

describe('storage migration compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('copies old airo keys to watheq keys without deleting the old data', () => {
    localStorage.setItem('airo:lastJobDescription', 'legacy job');
    localStorage.setItem('airo:coverLetter', '{"coverLetter":"legacy letter"}');

    migrateStorageKeys();

    expect(localStorage.getItem('watheq:lastJobDescription')).toBe('legacy job');
    expect(localStorage.getItem('watheq:coverLetter')).toBe('{"coverLetter":"legacy letter"}');
    expect(localStorage.getItem('airo:lastJobDescription')).toBe('legacy job');
    expect(localStorage.getItem('airo:coverLetter')).toBe('{"coverLetter":"legacy letter"}');
  });

  it('reads through old keys when the one-time migration flag already exists', () => {
    localStorage.setItem('watheq:migrationComplete', 'true');
    localStorage.setItem('airo:bulkAnalysis', '[{"id":"old"}]');

    expect(getCompatibleStorageItem('watheq:bulkAnalysis')).toBe('[{"id":"old"}]');
    expect(localStorage.getItem('watheq:bulkAnalysis')).toBe('[{"id":"old"}]');
  });

  it('prefers current watheq keys over old aliases', () => {
    localStorage.setItem('airo:lastJobDescription', 'legacy job');
    localStorage.setItem('watheq:lastJobDescription', 'current job');

    expect(getCompatibleStorageItem('watheq:lastJobDescription')).toBe('current job');
  });

  it('supports unprefixed workflow panel aliases', () => {
    localStorage.setItem('workflow-panel-position', '{"x":12,"y":34}');
    localStorage.setItem('workflow-panel-minimized', 'false');

    expect(getCompatibleStorageItem('watheq:workflow-panel-position')).toBe('{"x":12,"y":34}');
    expect(getCompatibleStorageItem('watheq:workflow-panel-minimized')).toBe('false');
    expect(localStorage.getItem('watheq:workflow-panel-position')).toBe('{"x":12,"y":34}');
    expect(localStorage.getItem('workflow-panel-position')).toBe('{"x":12,"y":34}');
  });

  it('writes current keys and clears current plus old aliases when requested', () => {
    setCompatibleStorageItem('watheq:workflow-panel-last-step', '3');
    localStorage.setItem('workflow-panel-last-step', '2');

    removeCompatibleStorageItem('watheq:workflow-panel-last-step');

    expect(localStorage.getItem('watheq:workflow-panel-last-step')).toBeNull();
    expect(localStorage.getItem('workflow-panel-last-step')).toBeNull();
  });
});
