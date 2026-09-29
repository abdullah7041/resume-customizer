import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { JobGroupCard } from '@/components/sections/optimize/JobGroupCard';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string | { defaultValue?: string }) => typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? key }) }));

it('shows literal source text and refuses confirmation when the displayed claim fingerprint differs', async () => {
  const quote = '<img src=x onerror=alert(1)>';
  const noop = vi.fn();
  const confirm = vi.fn(() => true);
  render(<JobGroupCard
    group={{ id: 'summary', title: 'Summary', type: 'summary', kind: 'actionable', items: [{
      sectionId: 'summary-1', sectionType: 'summary', original: 'Before', optimized: 'After', applied: false,
      evidence: { version: 1, targetId: 'resume:1', originalFingerprint: 'a', proposedFingerprint: 'b',
        status: 'needs_review', reasons: ['semantic_review'], references: [{ sourceId: 'answer-1', quote }],
        sourceFingerprints: { 'answer-1': 'a' } },
    }] }}
    evidenceSources={[{ id: 'answer-1', kind: 'clarification', targetId: 'resume:1', text: quote, fingerprint: 'a' }]}
    viewMode="split" expandedCards={new Set(['summary-1'])} compareMode={null}
    refiningCardId={null} refineInstruction="" refineLoadingId={null} refineError={null}
    refinableSections={new Set()} isArabic={false} onToggleCard={noop} onToggleCompare={noop}
    onApply={noop} onRevert={noop} onConfirm={confirm} onEdit={noop} onApplyGroup={noop} onRevertGroup={noop}
    onStartRefine={noop} onRefineInstructionChange={noop} onSubmitRefine={noop}
  />);
  expect(screen.getByText(/Needs your review/)).toBeInTheDocument();
  expect(screen.getByText(/Your answer/).parentElement?.textContent).toContain(quote);
  expect(document.querySelector('img[src="x"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm this claim' }));
  expect(await screen.findByText('This claim changed. Edit or regenerate it before confirming.')).toBeInTheDocument();
  expect(confirm).not.toHaveBeenCalled();
});
