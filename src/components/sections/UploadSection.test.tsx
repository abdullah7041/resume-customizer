import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useResumeLibraryStore, type ResumeLibraryEntry } from '@/lib/resumeLibrary';
import type { ResumeSchema } from '@/types/resume';
import UploadSection from './UploadSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      fallback.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values?.[key] ?? key),
  }),
}));
vi.mock('../ui/UploadCard', () => ({ default: () => <div data-testid="upload-card" /> }));

it('offers immediate selection from saved resumes before one is active', () => {
  const parsedResume = { basics: { name: 'Candidate' } } as ResumeSchema;
  const entries = [
    { id: 'one', name: 'Resume A.pdf', parsedResume, plainText: 'Resume A text', fingerprint: 'a', createdAt: 1, updatedAt: 1 },
    { id: 'two', name: 'Resume B.pdf', parsedResume, plainText: 'Resume B text', fingerprint: 'b', createdAt: 2, updatedAt: 2 },
  ] as ResumeLibraryEntry[];
  useResumeLibraryStore.setState({ entries, activeResumeId: null, initialized: true });
  const activate = vi.fn();

  const { container } = render(
    <UploadSection
      onParseResume={vi.fn().mockResolvedValue({})}
      resumeDocument={{ fileName: 'Resume A.pdf', plainText: 'Resume A text' }}
      onToast={vi.fn()}
      onClear={vi.fn()}
      onActivateResume={activate}
    />,
  );

  const manager = container.querySelector('details');
  expect(manager).not.toBeNull();
  expect(manager).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Use Resume B.pdf' }));
  expect(activate).toHaveBeenCalledWith('two');
  expect(screen.getByRole('button', { name: 'Rename Resume B.pdf' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove Resume B.pdf' })).toBeInTheDocument();
});
