import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CandidateEvidenceReport } from '@/components/sections/optimize/CandidateEvidenceReport';
import { createAssessmentContext, fingerprintText } from '@/lib/match/assessmentContext';
import type { EvidenceReportInput } from '@/types/evidence-report';
import english from '@/locales/en/export.json';
import arabic from '@/locales/ar/export.json';

let language: 'en' | 'ar' = 'en';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => {
  const messages = language === 'ar' ? arabic.export.evidenceReport : english.export.evidenceReport;
  return messages[key.split('.').at(-1) as keyof typeof messages] ?? key;
} }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); language = 'en'; });

async function props(): Promise<Omit<EvidenceReportInput, 'requirements' | 'includedClarificationIds'>> {
  const resumeText = 'Built reporting APIs.';
  const jobDescription = 'Build APIs.';
  const context = await createAssessmentContext({ resumeText, jobDescription, language, kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
  const sources: EvidenceReportInput['sources'] = [
    { id: 'resume', kind: 'resume', text: resumeText, targetId: 'resume:role', fingerprint: await fingerprintText(resumeText) },
    { id: 'private', kind: 'clarification', text: 'Private confidential detail', targetId: 'clarification:answer', fingerprint: await fingerprintText('Private confidential detail') },
  ];
  return { resumeText, jobDescription, language, assessmentCurrent: true, cards: [], sources, run: { status: 'succeeded', startedAt: '2026-10-04', finishedAt: '2026-10-04', phase: null, error: null, cards: [], data: { evidenceSources: structuredClone(sources) },
    keywords: { add: [], remove: [], neutral: [] }, assessment: { context, jobSnapshot: jobDescription, requestId: 'fictional', createdAt: '2026-10-04', result: null } } };
}

describe('candidate controlled report panel', () => {
  it.each(['context', 'request'] as const)('resets rows and private opt-ins on a new %s identity, preserving same-assessment edits', async identity => {
    const input = await props();
    const messages = english.export.evidenceReport;
    const { rerender } = render(<CandidateEvidenceReport {...input} />);
    fireEvent.click(screen.getByText(messages.title));
    fireEvent.click(screen.getByRole('button', { name: messages.add }));
    fireEvent.change(screen.getByRole('textbox', { name: messages.requirement }), { target: { value: 'Build APIs.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    rerender(<CandidateEvidenceReport {...input} cards={[...input.cards]} />);
    expect(screen.getByRole('textbox', { name: messages.requirement })).toHaveValue('Build APIs.');
    expect(screen.getByRole('checkbox')).toBeChecked();
    const jobDescription = identity === 'context' ? 'Build APIs. Lead teams.' : input.jobDescription;
    const context = await createAssessmentContext({ resumeText: input.resumeText, jobDescription, language: 'en', kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
    const run = { ...input.run!, assessment: { ...input.run!.assessment!, context, requestId: identity === 'request' ? 'next-request' : input.run!.assessment!.requestId } };
    rerender(<CandidateEvidenceReport {...input} jobDescription={jobDescription} run={run} />);
    expect(screen.queryByRole('textbox', { name: messages.requirement })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it.each(['en', 'ar'] as const)('offers accessible %s controls with private sources excluded by default', async locale => {
    language = locale;
    const messages = locale === 'ar' ? arabic.export.evidenceReport : english.export.evidenceReport;
    render(<CandidateEvidenceReport {...await props()} />);
    fireEvent.click(screen.getByText(messages.title));
    const checkbox = screen.getByRole('checkbox', { name: `${messages.includeClarification}: Private confidential detail` });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: messages.add }));
    fireEvent.change(screen.getByRole('textbox', { name: messages.requirement }), { target: { value: 'Build APIs.' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: messages.source }), { target: { value: 'resume' } });
    fireEvent.click(screen.getByRole('button', { name: messages.review }));
    const preview = await screen.findByRole('textbox', { name: messages.preview });
    expect((preview as HTMLTextAreaElement).value).toContain('candidate_associated');
    expect((preview as HTMLTextAreaElement).value).not.toContain('Private confidential detail');
    fireEvent.click(checkbox);
    expect(screen.queryByRole('button', { name: messages.download })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(messages.changed);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('downloads identical reviewed bytes and invalidates the preview when bound inputs change', async () => {
    const input = await props();
    const messages = english.export.evidenceReport;
    const createUrl = vi.fn().mockReturnValue('blob:reviewed-report');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { rerender } = render(<CandidateEvidenceReport {...input} />);
    fireEvent.click(screen.getByText(messages.title));
    fireEvent.click(screen.getByRole('button', { name: messages.review }));
    const preview = await screen.findByRole('textbox', { name: messages.preview });
    const exact = (preview as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole('button', { name: messages.download }));
    expect(click).toHaveBeenCalledOnce();
    const blob = createUrl.mock.calls[0][0] as Blob;
    const downloaded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(downloaded).toBe(exact);
    expect(revokeUrl).not.toHaveBeenCalled();
    rerender(<CandidateEvidenceReport {...input} jobDescription="Changed job" assessmentCurrent={false} />);
    expect(screen.queryByRole('button', { name: messages.download })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(messages.changed);
    vi.unstubAllGlobals();
  });

  it('rejects an asynchronous preview completed after a job edit', async () => {
    const input = await props();
    const { rerender } = render(<CandidateEvidenceReport {...input} />);
    fireEvent.click(screen.getByText(english.export.evidenceReport.title));
    fireEvent.click(screen.getByRole('button', { name: english.export.evidenceReport.review }));
    rerender(<CandidateEvidenceReport {...input} jobDescription="Changed during hashing" assessmentCurrent={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: english.export.evidenceReport.review })).not.toBeDisabled());
    expect(screen.queryByRole('textbox', { name: english.export.evidenceReport.preview })).not.toBeInTheDocument();
  });

  it.each([null, [null], [{ id: 'partial' }]])('renders safely with malformed hydrated sources', async sources => {
    const input = await props();
    render(<CandidateEvidenceReport {...input} sources={sources as unknown as EvidenceReportInput['sources']} />);
    fireEvent.click(screen.getByText(english.export.evidenceReport.title));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: english.export.evidenceReport.review }));
    expect(await screen.findByRole('textbox', { name: english.export.evidenceReport.preview })).toBeInTheDocument();
  });

  it('renders only the valid choice but rejects its duplicate raw ID', async () => {
    const input = await props();
    const messages = english.export.evidenceReport;
    const sources = [...input.sources, { id: 'resume' }] as unknown as typeof input.sources;
    render(<CandidateEvidenceReport {...input} sources={sources} />);
    fireEvent.click(screen.getByText(messages.title));
    fireEvent.click(screen.getByRole('button', { name: messages.add }));
    fireEvent.change(screen.getByRole('textbox', { name: messages.requirement }), { target: { value: 'Build APIs.' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox', { name: messages.source }), { target: { value: 'resume' } });
    fireEvent.click(screen.getByRole('button', { name: messages.review }));
    const preview = await screen.findByRole('textbox', { name: messages.preview });
    expect((preview as HTMLTextAreaElement).value).toContain('"status": "invalid_selection"');
    expect((preview as HTMLTextAreaElement).value).not.toContain('candidate_associated');
  });

});
