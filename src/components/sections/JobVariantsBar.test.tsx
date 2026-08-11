import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { JobVariantsBar } from './JobVariantsBar';
import { useResumeStore } from '../../lib/stores/resumeStore';
import type { OptimizationResult } from '../../types/templates';

// t returns the provided fallback so assertions can match on English strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const { analyticsMock } = vi.hoisted(() => ({
  analyticsMock: {
    trackVariantSaved: vi.fn(),
    trackVariantOpened: vi.fn(),
  },
}));

vi.mock('../../services/analytics', () => ({
  analytics: analyticsMock,
}));

const sampleOpt: OptimizationResult = {
  sectionId: 'summary-0',
  sectionType: 'summary',
  original: 'before',
  optimized: 'after',
  applied: true,
};

describe('JobVariantsBar', () => {
  beforeEach(() => {
    useResumeStore.getState().clearAll();
    window.localStorage.clear();
    cleanup();
    analyticsMock.trackVariantSaved.mockClear();
    analyticsMock.trackVariantOpened.mockClear();
  });

  it('renders nothing when there is no run to save and no variants', () => {
    const { container } = render(<JobVariantsBar />);
    expect(container.firstChild).toBeNull();
  });

  it('saves the current run as a named variant and shows it as a chip', () => {
    useResumeStore.getState().setOptimizations([sampleOpt]);
    window.localStorage.setItem('watheq:lastJobDescription', 'Backend role JD');
    render(<JobVariantsBar />);

    fireEvent.click(screen.getByText('Save as variant'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Senior PM @ Aramco'), {
      target: { value: 'Backend @ STC' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Backend @ STC')).toBeInTheDocument();
    const state = useResumeStore.getState();
    expect(state.jobVariants).toHaveLength(1);
    expect(state.jobVariants[0].jobDescription).toBe('Backend role JD');
    expect(state.activeVariantId).toBe(state.jobVariants[0].id);
  });

  it('reopening a variant restores its snapshot and syncs the job description', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([sampleOpt]);
    const id = store.saveCurrentAsVariant('Variant A', 'JD A');
    // Simulate a different working run, then clear the active pointer.
    store.setOptimizations([]);
    useResumeStore.setState({ activeVariantId: null });

    render(<JobVariantsBar />);
    fireEvent.click(screen.getByText('Variant A'));

    const state = useResumeStore.getState();
    expect(state.activeVariantId).toBe(id);
    expect(state.optimizations).toHaveLength(1);
    expect(window.localStorage.getItem('watheq:lastJobDescription')).toBe('JD A');
  });

  it('updates the active variant and briefly confirms the save', () => {
    vi.useFakeTimers();
    try {
      const store = useResumeStore.getState();
      store.setOptimizations([sampleOpt]);
      const id = store.saveCurrentAsVariant('Variant A', 'JD A');
      window.localStorage.setItem('watheq:lastJobDescription', 'JD A updated');

      render(<JobVariantsBar />);
      fireEvent.click(screen.getByText('Save changes'));

      expect(useResumeStore.getState().jobVariants.find((variant) => variant.id === id)?.jobDescription).toBe('JD A updated');
      expect(screen.getByText('Saved')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(2000));
      expect(screen.getByText('Save changes')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes a variant', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([sampleOpt]);
    store.saveCurrentAsVariant('Variant A', 'JD A');

    render(<JobVariantsBar />);
    fireEvent.click(screen.getByLabelText('Delete'));

    expect(useResumeStore.getState().jobVariants).toHaveLength(0);
  });

  // --- Analytics for the ADR Phase-2 gate (docs/adr/ADR-job-specific-resume-builder.md) ---

  it('fires the variant-saved analytics event exactly once when saving a variant', () => {
    useResumeStore.getState().setOptimizations([sampleOpt]);
    window.localStorage.setItem('watheq:lastJobDescription', 'Backend role JD');
    render(<JobVariantsBar />);

    fireEvent.click(screen.getByText('Save as variant'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Senior PM @ Aramco'), {
      target: { value: 'Backend @ STC' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(analyticsMock.trackVariantSaved).toHaveBeenCalledTimes(1);
    expect(analyticsMock.trackVariantOpened).not.toHaveBeenCalled();
  });

  it('fires the variant-opened analytics event exactly once on a deliberate reopen click', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([sampleOpt]);
    const id = store.saveCurrentAsVariant('Variant A', 'JD A');
    // Simulate a different working run, then clear the active pointer — the
    // saved variant is no longer active, so clicking it is a genuine reopen.
    store.setOptimizations([]);
    useResumeStore.setState({ activeVariantId: null });
    analyticsMock.trackVariantSaved.mockClear();

    render(<JobVariantsBar />);
    fireEvent.click(screen.getByText('Variant A'));

    expect(useResumeStore.getState().activeVariantId).toBe(id);
    expect(analyticsMock.trackVariantOpened).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire the variant-opened event when a variant is merely restored as active on mount', () => {
    // Mirrors what zustand's persist rehydration does on page load: it sets
    // jobVariants/activeVariantId directly from storage, it never calls the
    // openVariant() action. This must not be counted as a "reopen" — doing
    // so would inflate the ADR's reopen-rate gate with passive restores
    // instead of deliberate user actions.
    const store = useResumeStore.getState();
    store.setOptimizations([sampleOpt]);
    const id = store.saveCurrentAsVariant('Variant A', 'JD A');
    analyticsMock.trackVariantSaved.mockClear();
    analyticsMock.trackVariantOpened.mockClear();

    // saveCurrentAsVariant already left activeVariantId === id (as a real
    // save does); re-mounting the component (e.g. a page refresh) must not
    // re-fire the reopen event just because the variant renders as active.
    render(<JobVariantsBar />);

    expect(useResumeStore.getState().activeVariantId).toBe(id);
    expect(analyticsMock.trackVariantOpened).not.toHaveBeenCalled();
  });

  it('sends no properties — and therefore no variant label or JD text — on the save/open analytics calls', () => {
    const store = useResumeStore.getState();
    store.setOptimizations([sampleOpt]);
    window.localStorage.setItem('watheq:lastJobDescription', 'Confidential JD text for Aramco');
    render(<JobVariantsBar />);

    fireEvent.click(screen.getByText('Save as variant'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Senior PM @ Aramco'), {
      target: { value: 'Secret Label For Employer X' },
    });
    fireEvent.click(screen.getByText('Save'));

    // Zero arguments — not just "no PII field" but no payload at all.
    expect(analyticsMock.trackVariantSaved).toHaveBeenCalledWith();

    store.setOptimizations([]);
    useResumeStore.setState({ activeVariantId: null });
    fireEvent.click(screen.getByText('Secret Label For Employer X'));

    expect(analyticsMock.trackVariantOpened).toHaveBeenCalledWith();

    // Belt-and-suspenders: scan every call's arguments for the secret strings.
    const allCallArgs = [
      ...analyticsMock.trackVariantSaved.mock.calls,
      ...analyticsMock.trackVariantOpened.mock.calls,
    ];
    const serialized = JSON.stringify(allCallArgs);
    expect(serialized).not.toMatch(/Aramco|Employer X|Confidential/);
  });
});
