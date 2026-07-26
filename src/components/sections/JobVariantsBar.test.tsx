import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { JobVariantsBar } from './JobVariantsBar';
import { useResumeStore } from '../../lib/stores/resumeStore';
import type { OptimizationResult } from '../../types/templates';

// t returns the provided fallback so assertions can match on English strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
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
});
