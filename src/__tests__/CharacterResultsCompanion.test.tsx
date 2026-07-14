import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterResultsCompanion } from '@/components/shared/CharacterResultsCompanion';
import { HRSuperSaudOverlay, HRSuperSaudProvider } from '@/features/hr-super-saud';

let language = 'en';

const copy: Record<string, string> = {
  'sections.characterResults.picker': 'Choose your companion',
  'sections.characterResults.male': 'Male companion',
  'sections.characterResults.female': 'Female companion',
  'sections.characterResults.states.struggling': 'Needs strengthening',
  'sections.characterResults.states.confident': 'Competitive match',
  'sections.characterResults.states.celebrating': 'Strong result',
  'sections.characterResults.before': 'Before',
  'sections.characterResults.after': 'After',
  'sections.characterResults.unavailableScore': 'Unavailable',
  'sections.characterResults.changeCompanion': 'Change companion',
  'sections.characterResults.imageAlt': '{{gender}}: {{state}}',
};

const arabicCopy: Record<string, string> = {
  ...copy,
  'sections.characterResults.picker': 'اختر رفيقك',
  'sections.characterResults.male': 'رفيق',
  'sections.characterResults.female': 'رفيقة',
  'sections.characterResults.states.struggling': 'بحاجة إلى تعزيز',
  'sections.characterResults.states.confident': 'توافق تنافسي',
  'sections.characterResults.states.celebrating': 'نتيجة قوية',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, string>) => {
      const translations = language === 'ar' ? arabicCopy : copy;
      const template = translations[key] ?? (typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key);
      if (typeof fallbackOrOptions !== 'object') return template;
      return Object.entries(fallbackOrOptions).reduce(
        (value, [name, replacement]) => value.replace(`{{${name}}}`, replacement),
        template,
      );
    },
    i18n: { dir: () => (language === 'ar' ? 'rtl' : 'ltr') },
  }),
}));

function renderCompanion(props: Parameters<typeof CharacterResultsCompanion>[0]) {
  return render(
    <HRSuperSaudProvider>
      <CharacterResultsCompanion {...props} />
    </HRSuperSaudProvider>,
  );
}

function selectGender(gender: 'male' | 'female') {
  fireEvent.click(screen.getByRole('button', { name: copy[`sections.characterResults.${gender}`] }));
}

describe('CharacterResultsCompanion', () => {
  beforeEach(() => {
    language = 'en';
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  it('shows the first-use picker and persists the selected companion', () => {
    const { unmount } = renderCompanion({ variant: 'match', score: 60 });

    expect(screen.getByRole('group', { name: 'Choose your companion' })).toBeInTheDocument();
    selectGender('female');
    expect(window.localStorage.getItem('watheq:characterGender')).toBe('female');
    expect(screen.getByRole('img').getAttribute('src')).toContain('female-tier-2');

    unmount();
    renderCompanion({ variant: 'match', score: 60 });
    expect(screen.queryByRole('group', { name: 'Choose your companion' })).not.toBeInTheDocument();
  });

  it('treats invalid storage as unset', () => {
    window.localStorage.setItem('watheq:characterGender', 'invalid');
    renderCompanion({ variant: 'match', score: 80 });
    expect(screen.getByRole('group', { name: 'Choose your companion' })).toBeInTheDocument();
  });

  it.each([
    ['male', 59, 'male-tier-1'],
    ['male', 60, 'male-tier-2'],
    ['male', 80, 'male-tier-3'],
    ['female', 59, 'female-tier-1'],
    ['female', 79, 'female-tier-2'],
    ['female', 80, 'female-tier-3'],
  ] as const)('uses the %s asset for score %s', (gender, score, asset) => {
    window.localStorage.setItem('watheq:characterGender', gender);
    renderCompanion({ variant: 'match', score });
    expect(screen.getByRole('img').getAttribute('src')).toContain(asset);
  });

  it.each([
    ['male', 59, 'male-tier-1'],
    ['male', 60, 'male-tier-2'],
    ['male', 80, 'male-tier-3'],
    ['female', 59, 'female-tier-1'],
    ['female', 79, 'female-tier-2'],
    ['female', 80, 'female-tier-3'],
  ] as const)('uses the %s optimize asset for score %s', (gender, score, asset) => {
    window.localStorage.setItem('watheq:characterGender', gender);
    renderCompanion({ variant: 'optimize', beforeScore: score, afterScore: score });
    expect(screen.getByRole('img').getAttribute('src')).toContain(asset);
  });

  it.each([
    [59, 'Needs strengthening'],
    [60, 'Competitive match'],
    [79, 'Competitive match'],
    [80, 'Strong result'],
  ])('maps match score %s without optimize-only UI', (score, label) => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'match', score });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByTestId('before-score-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tier-up-confetti')).not.toBeInTheDocument();
  });

  it.each([[59, 60], [79, 80], [59, 80]])('celebrates upward tier crossings from %s to %s', (beforeScore, afterScore) => {
    window.localStorage.setItem('watheq:characterGender', 'female');
    renderCompanion({ variant: 'optimize', beforeScore, afterScore });
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier-up', 'true');
    expect(screen.getByTestId('tier-up-confetti')).toBeInTheDocument();
  });

  it.each([[60, 79], [70, 70], [80, 79], [null, 80]])('does not celebrate without an upward boundary crossing (%s to %s)', (beforeScore, afterScore) => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'optimize', beforeScore, afterScore });
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier-up', 'false');
    expect(screen.queryByTestId('tier-up-confetti')).not.toBeInTheDocument();
  });

  it('exposes the final and outgoing layers targeted by the reduced-motion stylesheet', () => {
    window.localStorage.setItem('watheq:characterGender', 'female');
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderCompanion({ variant: 'optimize', beforeScore: 59, afterScore: 80 });

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveClass('character-results__image--before');
    expect(images[1]).toHaveClass('character-results__image--after');
  });

  it('keeps optimize bars and fallback copy when scores or art are unavailable', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'optimize', beforeScore: null, afterScore: null });
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier', 'unavailable');
    expect(screen.queryByText('Needs strengthening')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps controls and bars when selected art fails', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'optimize', beforeScore: 60, afterScore: 60 });
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    fireEvent.error(image);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('before-score-bar')).toBeInTheDocument();
  });

  it.each([null, 'male'] as const)('suppresses the HR Super Saud overlay for picker and selected state (%s)', (storedGender) => {
    if (storedGender) window.localStorage.setItem('watheq:characterGender', storedGender);

    render(
      <HRSuperSaudProvider>
        <HRSuperSaudOverlay />
        <CharacterResultsCompanion variant="match" score={60} />
      </HRSuperSaudProvider>,
    );

    expect(screen.queryByText('hrSuperSaud.stepOneHint')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('HR Super Saud')).not.toBeInTheDocument();
  });

  it('changes gender through an accessible persisted toggle', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'match', score: 80 });
    fireEvent.click(screen.getByRole('button', { name: 'Female companion' }));
    expect(window.localStorage.getItem('watheq:characterGender')).toBe('female');
    expect(screen.getByRole('button', { name: 'Female companion' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img').getAttribute('src')).toContain('female-tier-3');
  });

  it('uses Arabic state and picker copy', () => {
    language = 'ar';
    renderCompanion({ variant: 'match', score: 80 });
    expect(screen.getByRole('group', { name: 'اختر رفيقك' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'رفيقة' }));
    expect(screen.getByText('نتيجة قوية')).toBeInTheDocument();
  });
});
