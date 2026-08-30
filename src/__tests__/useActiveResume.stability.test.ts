import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveResume, useResumeStore } from '@/lib/stores/resumeStore';
import type { ResumeSchema } from '@/types/resume';

/**
 * zustand 5 reads selectors through useSyncExternalStore and compares snapshots by
 * reference. A selector that allocates on every call therefore never settles, and
 * React re-renders until it throws error #185.
 *
 * `getActiveResume` allocates in exactly two cases — the Saudi summary prepend and
 * the optimized merge — so the hook was stable for a plain resume and looped for a
 * real one. Production found it; no local test had, because the fixtures happened
 * to leave both flags off. These assert the reference holds in the allocating cases.
 */
const BASE: ResumeSchema = {
  basics: {
    name: 'Test Candidate',
    label: 'Senior AI Engineer',
    email: 't@example.com',
    phone: '',
    summary: 'Engineer based in Riyadh.',
    location: { city: 'Riyadh', countryCode: 'SA', region: 'Riyadh' },
    profiles: [],
  },
  work: [{ name: 'Salla', position: 'Engineer', startDate: '2022-01', endDate: '2025-01', highlights: [] }],
  education: [],
  skills: [],
  projects: [],
  certificates: [],
  languages: [],
} as unknown as ResumeSchema;

beforeEach(() => {
  useResumeStore.setState({
    originalResume: BASE,
    optimizations: [],
    showOptimized: false,
    isSaudiNational: false,
  });
});

describe('useActiveResume reference stability', () => {
  it('holds its reference across re-renders for a plain resume', () => {
    const { result, rerender } = renderHook(() => useActiveResume());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('holds its reference when the Saudi prepend allocates a clone', () => {
    useResumeStore.setState({ isSaudiNational: true });

    const { result, rerender } = renderHook(() => useActiveResume());
    const first = result.current;
    rerender();
    rerender();

    // The prepend applied, and the same object came back each time.
    expect(first?.basics?.summary).toMatch(/^Saudi /);
    expect(result.current).toBe(first);
  });

  it('holds its reference when the optimized merge allocates', () => {
    useResumeStore.setState({ showOptimized: true });

    const { result, rerender } = renderHook(() => useActiveResume());
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('produces a new reference only when an input actually changes', () => {
    const { result, rerender } = renderHook(() => useActiveResume());
    const first = result.current;

    useResumeStore.setState({ isSaudiNational: true });
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current?.basics?.summary).toMatch(/^Saudi /);
  });
});
