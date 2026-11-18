import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import UploadSection from './UploadSection';
import { useResumeStore } from '@/lib/stores/resumeStore';
import { useResumeLibraryStore } from '@/lib/resumeLibrary';
import { trustResume } from '@/__tests__/fixtures/candidate-trust';

vi.mock('../ui/UploadCard', () => ({ default: ({ pastedText, onTextChange, isSaved }: {
  pastedText: string; onTextChange: (text: string) => void; isSaved: boolean;
}) => <><textarea aria-label="Paste" value={pastedText} onChange={event => onTextChange(event.target.value)} /><span>{isSaved ? 'Saved' : 'Pending'}</span></> }));

beforeEach(() => {
  localStorage.clear();
  useResumeStore.getState().clearAll();
  useResumeLibraryStore.setState({ entries: [], activeResumeId: null, initialized: true });
});

it('prepares a pending paste before Continue and preserves the current resume while waiting', async () => {
  let complete!: (value: Record<string, unknown>) => void;
  const parse = vi.fn(() => new Promise<Record<string, unknown>>(resolve => { complete = resolve; }));
  const next = vi.fn();
  render(<><UploadSection onParseResume={parse} resumeDocument={{ fileName: 'old.pdf', plainText: 'Old resume' }} onToast={vi.fn()} onClear={vi.fn()} onContinue={next} /><button type="submit" form="resume-upload-form">Continue</button></>);
  fireEvent.change(screen.getByLabelText('Paste'), { target: { value: 'Nora new resume source '.repeat(8) } });
  expect(screen.getByText('Pending')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Continue'));
  expect(parse).toHaveBeenCalledWith(expect.objectContaining({ plainText: expect.stringContaining('Nora') }), expect.any(AbortSignal), expect.any(Function));
  expect(next).not.toHaveBeenCalled();
  await act(async () => { complete({ data: { basics: { name: 'Nora' } }, plainText: 'Nora new resume source '.repeat(8) }); });
  await waitFor(() => expect(next).toHaveBeenCalledOnce());
});

it('retains a failed pasted draft after navigating away and returning', async () => {
  const props = { onParseResume: vi.fn().mockRejectedValue(new Error('Try again')), resumeDocument: null, onToast: vi.fn(), onClear: vi.fn() };
  const view = render(<><UploadSection {...props} /><button type="submit" form="resume-upload-form">Continue</button></>);
  fireEvent.change(screen.getByLabelText('Paste'), { target: { value: 'ليان اختبار الجودة source '.repeat(8) } });
  fireEvent.click(screen.getByText('Continue'));
  await waitFor(() => expect(props.onToast).toHaveBeenCalled());
  view.unmount();
  render(<UploadSection {...props} />);
  expect((screen.getByLabelText('Paste') as HTMLTextAreaElement).value).toContain('ليان');
});

it('preserves the active resume and source when a replacement parse fails', async () => {
  const original = trustResume('en');
  original.basics.name = 'Saved candidate';
  useResumeStore.getState().setOriginalResume(original);
  useResumeStore.getState().setParsedResumeText('Saved candidate source');
  const savedResume = useResumeStore.getState().originalResume;
  const next = vi.fn();
  const toast = vi.fn();
  render(<><UploadSection onParseResume={vi.fn().mockRejectedValue(Object.assign(new Error('Unreadable file'), { status: 422 }))} resumeDocument={{ fileName: 'saved.txt', plainText: 'Saved candidate source' }} onToast={toast} onClear={vi.fn()} onContinue={next} /><button type="submit" form="resume-upload-form">Continue</button></>);
  fireEvent.change(screen.getByLabelText('Paste'), { target: { value: 'Replacement source '.repeat(8) } });
  fireEvent.click(screen.getByText('Continue'));
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger' })));
  expect(useResumeStore.getState().originalResume).toEqual(savedResume);
  expect(useResumeStore.getState().parsedResumeText).toBe('Saved candidate source');
  expect(next).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Paste')).toHaveValue('Replacement source '.repeat(8));
});
