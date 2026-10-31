import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ManualDataEditor } from './ManualDataEditor';
import { useResumeStore } from '@/lib/stores/resumeStore';
import { addResumeToLibrary, useResumeLibraryStore } from '@/lib/resumeLibrary';
import type { ResumeSchema } from '@/types/resume';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
const saveResume = useResumeLibraryStore.getState().saveResume;
const original: ResumeSchema = {
  basics: { name: 'Original', label: '', email: '', phone: '', summary: '',
    location: { city: '', region: '', countryCode: '' }, profiles: [] },
  work: [], education: [], skills: [],
};

beforeEach(() => {
  useResumeStore.getState().clearAll();
  useResumeStore.getState().setOriginalResume(original);
  const { entries, entry } = addResumeToLibrary([], { parsedResume: original, plainText: 'source document', name: 'My resume' });
  useResumeLibraryStore.setState({ entries, activeResumeId: entry.id, initialized: true });
});
afterEach(() => { cleanup(); useResumeLibraryStore.setState({ saveResume }); });

it('persists corrections to the active library entry as well as the open resume', async () => {
  const save = vi.fn().mockResolvedValue({});
  useResumeLibraryStore.setState({ saveResume: save });
  const close = vi.fn();
  render(<ManualDataEditor isOpen onClose={close} />);
  fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Corrected' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    plainText: 'source document', name: 'My resume', parsedResume: expect.objectContaining({
      basics: expect.objectContaining({ name: 'Corrected' }),
    }),
  }));
  expect(useResumeStore.getState().originalResume?.basics.name).toBe('Corrected');
});

it('keeps edits open and the previous resume intact when the library write fails', async () => {
  useResumeLibraryStore.setState({ saveResume: vi.fn().mockRejectedValue(new Error('Storage full')) });
  const close = vi.fn();
  render(<ManualDataEditor isOpen onClose={close} />);
  fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Corrected' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(close).not.toHaveBeenCalled();
  expect(useResumeStore.getState().originalResume?.basics.name).toBe('Original');
  expect(screen.getByDisplayValue('Corrected')).toBeInTheDocument();
});

it('prevents editing and closing until the requested save finishes', async () => {
  let finish!: () => void;
  useResumeLibraryStore.setState({ saveResume: vi.fn().mockImplementation(() => new Promise<void>(resolve => { finish = resolve; })) });
  const close = vi.fn();
  render(<ManualDataEditor isOpen onClose={close} />);
  fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Corrected' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByDisplayValue('Corrected')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(close).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(close).toHaveBeenCalledOnce();
  expect(useResumeStore.getState().originalResume?.basics.name).toBe('Corrected');
});
