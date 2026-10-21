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

it('discards an unsaved review draft when a reused card ID receives another proposal', () => {
  const noop = vi.fn();
  const card = (optimized: string) => ({ sectionId: 'same-id', sectionType: 'summary' as const,
    original: 'Before', optimized, applied: false });
  const renderCard = (optimized: string) => <JobGroupCard
    group={{ id: 'summary', title: 'Summary', type: 'summary', kind: 'actionable', items: [card(optimized)] }}
    viewMode="split" expandedCards={new Set(['same-id'])} compareMode={null}
    refiningCardId={null} refineInstruction="" refineLoadingId={null} refineError={null}
    refinableSections={new Set()} isArabic={false} onToggleCard={noop} onToggleCompare={noop}
    onApply={noop} onRevert={noop} onConfirm={noop} onEdit={noop} onApplyGroup={noop} onRevertGroup={noop}
    onStartRefine={noop} onRefineInstructionChange={noop} onSubmitRefine={noop}
  />;
  const view = render(renderCard('Variant A'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit wording' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Edit claim wording' }), { target: { value: 'Unsaved A' } });
  view.rerender(renderCard('Variant B'));
  expect(screen.queryByRole('textbox', { name: 'Edit claim wording' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit wording' }));
  expect(screen.getByRole('textbox', { name: 'Edit claim wording' })).toHaveValue('Variant B');
});
