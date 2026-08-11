import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InterviewSection } from '../components/sections/InterviewSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 10 },
    refetch: vi.fn(),
  }),
}));

vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

vi.mock('../components/Credits/ConfirmActionModal', () => ({
  ConfirmActionModal: () => null,
}));

// Fixture: one vulnerability question plus two standard questions. The
// collision this bug produces (vulnerability card 0 sharing a state slot
// with standard card 0) does NOT reproduce with an all-standard set, so a
// vulnerability question must be present.
const VULN_QUESTION = 'Tell me about the 8-month gap in your resume.';
const STANDARD_QUESTION_1 = 'Describe a time you led a cross-functional project.';
const STANDARD_QUESTION_2 = 'How do you approach debugging a production incident?';

const matchAnalysis = {
  interviewPrep: {
    predicted_questions: [
      {
        question: VULN_QUESTION,
        type: 'behavioral',
        difficulty: 'medium',
        category: 'Career History',
        vulnerabilityType: 'gap' as const,
      },
      {
        question: STANDARD_QUESTION_1,
        type: 'behavioral',
        difficulty: 'medium',
        category: 'Leadership',
      },
      {
        question: STANDARD_QUESTION_2,
        type: 'technical',
        difficulty: 'hard',
        category: 'Engineering',
      },
    ],
  },
};

const renderInterviewSection = () => render(
  <InterviewSection
    jobDescription="Senior Software Engineer job description"
    resumeText="Resume text"
    matchAnalysis={matchAnalysis}
  />
);

describe('InterviewSection cross-list state isolation', () => {
  it('does not bleed card expansion between the vulnerability list and the standard list', async () => {
    const user = userEvent.setup({ delay: null });
    renderInterviewSection();

    // Expand the vulnerability card (first card overall).
    const vulnHeader = screen.getByText(VULN_QUESTION);
    await user.click(vulnHeader);

    // The first standard card's STAR guidance section should NOT appear as a
    // side effect of expanding the vulnerability card. Each expanded card
    // renders its own "Practice Your Answer" textarea; there should be
    // exactly one visible (the vulnerability card's), not two.
    const textareas = screen.getAllByPlaceholderText(/Write your answer here/i);
    expect(textareas).toHaveLength(1);

    // Expanding the first standard card independently should bring the
    // total to two visible textareas (both expanded), not replace the first.
    const standardHeader = screen.getByText(STANDARD_QUESTION_1);
    await user.click(standardHeader);

    const textareasAfter = screen.getAllByPlaceholderText(/Write your answer here/i);
    expect(textareasAfter).toHaveLength(2);
  });

  it('REGRESSION: does not let a standard card overwrite the vulnerability card practice answer', async () => {
    const user = userEvent.setup({ delay: null });
    renderInterviewSection();

    // Expand both the vulnerability card and the first standard card.
    await user.click(screen.getByText(VULN_QUESTION));
    await user.click(screen.getByText(STANDARD_QUESTION_1));

    const textareas = screen.getAllByPlaceholderText(/Write your answer here/i);
    expect(textareas).toHaveLength(2);
    const [vulnTextarea, standardTextarea] = textareas;

    await user.type(vulnTextarea, 'vuln-a');
    await user.type(standardTextarea, 'std-b');

    // Before the fix, both cards keyed their answer off array position 0 in
    // their respective (different) index spaces, so the second textarea's
    // keystrokes silently overwrote the first textarea's saved value (and
    // vice versa on re-render). Both must retain their own, distinct text.
    expect(vulnTextarea).toHaveValue('vuln-a');
    expect(standardTextarea).toHaveValue('std-b');
  });
});

describe('InterviewSection CSV export answer pairing', () => {
  it('pairs the typed answer with the correct question in the exported CSV', async () => {
    const user = userEvent.setup({ delay: null });

    const originalCreateObjectURL = URL.createObjectURL;
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });

    // jsdom does not implement anchor.click() navigation; stub it out so the
    // export handler runs without throwing.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderInterviewSection();

      await user.click(screen.getByText(VULN_QUESTION));
      await user.click(screen.getByText(STANDARD_QUESTION_1));

      const textareas = screen.getAllByPlaceholderText(/Write your answer here/i);
      await user.type(textareas[0], 'vuln-csv');
      await user.type(textareas[1], 'std-csv');

      await user.click(screen.getByRole('button', { name: /Export/i }));

      expect(capturedBlob).not.toBeNull();
      const csvText = await capturedBlob!.text();

      // Each row is: #, "question", type, difficulty, category, "answer".
      // Assert the vulnerability question's row contains its own answer and
      // NOT the standard question's answer (and vice versa) — proving the
      // CSV export (a third, independently-computed index space) also keys
      // off the question rather than array position.
      const vulnLine = csvText.split('\n').find((line) => line.includes(VULN_QUESTION));
      const standardLine = csvText.split('\n').find((line) => line.includes(STANDARD_QUESTION_1));

      expect(vulnLine).toContain('vuln-csv');
      expect(vulnLine).not.toContain('std-csv');
      expect(standardLine).toContain('std-csv');
      expect(standardLine).not.toContain('vuln-csv');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      clickSpy.mockRestore();
    }
  });
});
