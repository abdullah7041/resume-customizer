import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useResumeStore } from './resumeStore';
import type { OptimizationResult } from '../../types/templates';

const makeOpt = (id: string, applied = false): OptimizationResult => ({
  sectionId: id,
  sectionType: 'summary',
  original: `original-${id}`,
  optimized: `optimized-${id}`,
  applied,
});

describe('resumeStore job variants (Phase 1)', () => {
  beforeEach(() => {
    useResumeStore.getState().clearAll();
  });

  it('initializes with no variants and no active variant', () => {
    const state = useResumeStore.getState();
    expect(state.jobVariants).toEqual([]);
    expect(state.activeVariantId).toBeNull();
  });

  it('saveCurrentAsVariant snapshots the working set and returns a new id', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', true)]);
    store.setSelectedTemplate('technical-engineer');
    store.setBaselineMatchScore(72);

    const id = store.saveCurrentAsVariant('Senior PM @ Aramco', 'JD text here', 'Senior PM');

    const state = useResumeStore.getState();
    expect(id).toBeTruthy();
    expect(state.jobVariants).toHaveLength(1);
    expect(state.activeVariantId).toBe(id);

    const variant = state.jobVariants[0];
    expect(variant.label).toBe('Senior PM @ Aramco');
    expect(variant.jobTitle).toBe('Senior PM');
    expect(variant.jobDescription).toBe('JD text here');
    expect(variant.snapshot.optimizations).toHaveLength(1);
    expect(variant.snapshot.optimizations[0].applied).toBe(true);
    expect(variant.snapshot.selectedTemplate).toBe('technical-engineer');
    expect(variant.snapshot.baselineMatchScore).toBe(72);
    expect(variant.createdAt).toBeTruthy();
  });

  it('openVariant restores a saved snapshot into the working set and returns the variant', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', true)]);
    store.setSelectedTemplate('technical-engineer');
    const id = store.saveCurrentAsVariant('Job A', 'JD A');

    // Mutate the working set as if the user started a different run.
    store.setOptimizations([makeOpt('experience-9', false)]);
    store.setSelectedTemplate('ats-optimized');

    const restored = useResumeStore.getState().openVariant(id);

    const state = useResumeStore.getState();
    expect(restored?.jobDescription).toBe('JD A');
    expect(state.activeVariantId).toBe(id);
    expect(state.optimizations).toHaveLength(1);
    expect(state.optimizations[0].sectionId).toBe('summary-0');
    expect(state.optimizations[0].applied).toBe(true);
    expect(state.selectedTemplate).toBe('technical-engineer');
  });

  it('openVariant returns null and changes nothing for an unknown id', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', true)]);
    const restored = store.openVariant('does-not-exist');
    expect(restored).toBeNull();
    expect(useResumeStore.getState().optimizations).toHaveLength(1);
    expect(useResumeStore.getState().activeVariantId).toBeNull();
  });

  it('snapshots are decoupled from later working-set edits (no shared reference)', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', false)]);
    const id = store.saveCurrentAsVariant('Job A', 'JD A');

    // Apply an optimization after saving — the saved snapshot must not change.
    store.applyOptimization('summary-0');

    const variant = useResumeStore.getState().jobVariants.find((v) => v.id === id)!;
    expect(variant.snapshot.optimizations[0].applied).toBe(false);
  });

  it('updateVariant re-snapshots the current working set into an existing variant', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', false)]);
    const id = store.saveCurrentAsVariant('Job A', 'JD A');

    store.setOptimizations([makeOpt('summary-0', true), makeOpt('skills-1', true)]);
    store.updateVariant(id, 'JD A updated');

    const variant = useResumeStore.getState().jobVariants.find((v) => v.id === id)!;
    expect(variant.snapshot.optimizations).toHaveLength(2);
    expect(variant.jobDescription).toBe('JD A updated');
  });

  it('keeps only the ten most recent variants', () => {
    const store = useResumeStore.getState();
    for (let index = 0; index < 12; index += 1) {
      store.saveCurrentAsVariant(`Job ${index}`, `JD ${index}`);
    }

    const state = useResumeStore.getState();
    expect(state.jobVariants).toHaveLength(10);
    expect(state.jobVariants[0].label).toBe('Job 2');
    expect(state.jobVariants.at(-1)?.label).toBe('Job 11');
  });

  it('keeps the in-session variant when persistence reports a storage failure', () => {
    const storageError = vi.fn();
    window.addEventListener('watheq:storage-error', storageError);
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    try {
      useResumeStore.getState().saveCurrentAsVariant('Job A', 'JD A');

      expect(useResumeStore.getState().jobVariants).toHaveLength(1);
      expect(storageError).toHaveBeenCalledWith(expect.objectContaining({
        detail: { key: 'resume-storage', code: 'quota_exceeded' },
      }));
    } finally {
      setItem.mockRestore();
      window.removeEventListener('watheq:storage-error', storageError);
    }
  });

  it('deleteVariant removes it and clears activeVariantId when it was active', () => {
    const store = useResumeStore.getState();
    const id = store.saveCurrentAsVariant('Job A', 'JD A');
    expect(useResumeStore.getState().activeVariantId).toBe(id);

    store.deleteVariant(id);

    const state = useResumeStore.getState();
    expect(state.jobVariants).toHaveLength(0);
    expect(state.activeVariantId).toBeNull();
  });

  it('never mutates the base resume when saving or opening variants', () => {
    const store = useResumeStore.getState();
    store.setOriginalResume({
      basics: { name: 'Ada', label: '', email: '', phone: '', summary: 'base summary', location: { city: '', countryCode: '', region: '' }, profiles: [] },
      work: [],
      education: [],
      skills: [],
      projects: [],
    });
    const before = JSON.stringify(useResumeStore.getState().originalResume);

    const id = store.saveCurrentAsVariant('Job A', 'JD A');
    store.openVariant(id);

    expect(JSON.stringify(useResumeStore.getState().originalResume)).toBe(before);
  });

  it('bumps variantRestoreNonce when opening a variant but not when saving one', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([makeOpt('summary-0', true)]);

    const nonceBeforeSave = useResumeStore.getState().variantRestoreNonce;
    const id = store.saveCurrentAsVariant('Job A', 'JD A');
    // Saving the current run must NOT bump the nonce (would wipe the just-verified score).
    expect(useResumeStore.getState().variantRestoreNonce).toBe(nonceBeforeSave);

    store.openVariant(id);
    // Reopening a variant bumps the nonce so views can drop stale per-run UI state.
    expect(useResumeStore.getState().variantRestoreNonce).toBe(nonceBeforeSave + 1);
  });

  it('clearAll and resetForNewUpload remove all variants', () => {
    const store = useResumeStore.getState();
    store.saveCurrentAsVariant('Job A', 'JD A');
    store.saveCurrentAsVariant('Job B', 'JD B');
    expect(useResumeStore.getState().jobVariants).toHaveLength(2);

    store.resetForNewUpload();
    expect(useResumeStore.getState().jobVariants).toHaveLength(0);
    expect(useResumeStore.getState().activeVariantId).toBeNull();

    store.saveCurrentAsVariant('Job C', 'JD C');
    store.clearAll();
    expect(useResumeStore.getState().jobVariants).toHaveLength(0);
    expect(useResumeStore.getState().activeVariantId).toBeNull();
  });
});
