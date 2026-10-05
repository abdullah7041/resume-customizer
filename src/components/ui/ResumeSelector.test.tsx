import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ResumeSelector } from './ResumeSelector';
import type { ResumeLibraryEntry } from '@/lib/resumeLibrary';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

const entries = [
  { id: 'one', name: 'Engineering Resume.pdf', sourceFileName: 'Engineering Resume.pdf', parsedResume: { basics: { name: 'Same Candidate' } }, updatedAt: 1 },
  { id: 'two', name: 'Customer Success Resume.pdf', sourceFileName: 'Customer Success Resume.pdf', parsedResume: { basics: { name: 'Same Candidate' } }, updatedAt: 2 },
] as ResumeLibraryEntry[];

it('shows the active filename and allows switching between versions with the same candidate name', () => {
  const activate = vi.fn();
  render(<ResumeSelector entries={entries} activeResumeId="one" onActivate={activate} />);
  fireEvent.click(screen.getByRole('button', { name: /Engineering Resume.pdf/ }));
  expect(screen.getByText('Customer Success Resume.pdf')).toBeInTheDocument();
  expect(screen.getAllByText('Same Candidate')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /Customer Success Resume.pdf/ }));
  expect(activate).toHaveBeenCalledWith('two');
});

it('gives duplicate filenames distinct accessible option names', () => {
  const duplicates = [
    { ...entries[0], id: 'resume-one-aaaaaa', name: 'Resume.pdf' },
    { ...entries[1], id: 'resume-two-bbbbbb', name: 'Resume.pdf' },
  ];
  render(<ResumeSelector entries={duplicates} activeResumeId={duplicates[0].id} onActivate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Select resume: Resume.pdf' }));
  expect(screen.getByRole('button', { name: /Resume.pdf, Same Candidate.*aaaaaa/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Resume.pdf, Same Candidate.*bbbbbb/ })).toBeInTheDocument();
});
