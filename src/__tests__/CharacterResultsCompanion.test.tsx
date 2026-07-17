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
  'sections.characterResults.levels.foundation': 'Foundation Stage',
  'sections.characterResults.levels.builder': 'Profile Builder',
  'sections.characterResults.levels.candidate': 'Qualified Candidate',
  'sections.characterResults.levels.competitor': 'Strong Competitor',
  'sections.characterResults.levels.frontRunner': 'Front-Runner',
  'sections.characterResults.levelLabel': 'Level {{level}} of 5 · {{name}}',
  'sections.characterResults.targetVerified': 'Target {{score}}% · Verified',
  'sections.characterResults.targetEstimate': 'Target ~{{score}}% (estimate)',
  'sections.characterResults.unavailableScore': 'Unavailable',
  'sections.characterResults.changeCompanion': 'Change companion',
  'sections.characterResults.imageAlt': '{{gender}}: {{state}}',
};

const arabicCopy: Record<string, string> = {
  ...copy,
  'sections.characterResults.picker': 'اختر رفيقك',
  'sections.characterResults.male': 'رفيق',
  'sections.characterResults.female': 'رفيقة',
  'sections.characterResults.levels.frontRunner': 'مرشح متصدر',
  'sections.characterResults.levelLabel': 'المستوى {{level}} من 5 · {{name}}',
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

const optimizeProps = (over: Partial<Extract<Parameters<typeof CharacterResultsCompanion>[0], { variant: 'optimize' }>> = {}) => ({
  variant: 'optimize' as const,
  baselineScore: null as number | null,
  projectedScore: null as number | null,
  targetScore: null as number | null,
  targetKind: null as 'verified' | 'estimate' | null,
  ...over,
});

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

  // Art keeps its established 60/80 tier boundaries even though levels also
  // change at 40 and 70.
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
    ['female', 79, 'female-tier-2'],
  ] as const)('uses the %s optimize asset for baseline %s', (gender, score, asset) => {
    window.localStorage.setItem('watheq:characterGender', gender);
    renderCompanion(optimizeProps({ baselineScore: score }));
    expect(screen.getByRole('img').getAttribute('src')).toContain(asset);
  });

  it.each([
    [0, 1], [39, 1],
    [40, 2], [59, 2],
    [60, 3], [69, 3],
    [70, 4], [79, 4],
    [80, 5], [100, 5],
  ])('derives the deterministic career level for score %s', (score, levelIndex) => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'match', score });
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-level', String(levelIndex));
  });

  it.each([
    [39, 'Foundation Stage', '1'],
    [59, 'Profile Builder', '2'],
    [60, 'Qualified Candidate', '3'],
    [79, 'Strong Competitor', '4'],
    [80, 'Front-Runner', '5'],
  ])('labels match score %s with its level name', (score, name, index) => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion({ variant: 'match', score });
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByText(`Level ${index} of 5 · ${name}`)).toBeInTheDocument();
    expect(screen.queryByTestId('companion-target-marker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tier-up-confetti')).not.toBeInTheDocument();
  });

  it('renders exactly one progression bar at the displayed score', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps({ baselineScore: 10, projectedScore: 18 }));
    expect(screen.getAllByTestId('companion-progression')).toHaveLength(1);
    expect(screen.getByTestId('companion-score')).toHaveTextContent('18%');
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-level', '1');
  });

  it('keeps the character at the baseline when nothing is applied', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps({ baselineScore: 10, projectedScore: null, targetScore: 24, targetKind: 'verified' }));
    expect(screen.getByTestId('companion-score')).toHaveTextContent('10%');
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-level', '1');
  });

  it('renders a verified target as a ghost marker, never as the character level', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps({ baselineScore: 10, projectedScore: null, targetScore: 24, targetKind: 'verified' }));
    expect(screen.getByTestId('companion-target-marker')).toBeInTheDocument();
    expect(screen.getByTestId('companion-target-caption')).toHaveTextContent('Target 24% · Verified');
    // Level stays at the actual score (10 -> level 1), not the target.
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-level', '1');
  });

  it('labels an estimated target distinctly and hides targets at/below the displayed score', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    const { unmount } = renderCompanion(optimizeProps({ baselineScore: 10, targetScore: 22, targetKind: 'estimate' }));
    expect(screen.getByTestId('companion-target-caption')).toHaveTextContent('Target ~22% (estimate)');
    unmount();

    renderCompanion(optimizeProps({ baselineScore: 30, targetScore: 30, targetKind: 'estimate' }));
    expect(screen.queryByTestId('companion-target-marker')).not.toBeInTheDocument();
  });

  it.each([[35, 45], [59, 63], [69, 71], [79, 80], [59, 80]])(
    'celebrates a level-up from %s to %s',
    (baselineScore, projectedScore) => {
      window.localStorage.setItem('watheq:characterGender', 'female');
      renderCompanion(optimizeProps({ baselineScore, projectedScore }));
      expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier-up', 'true');
      expect(screen.getByTestId('tier-up-confetti')).toBeInTheDocument();
    },
  );

  it.each([[41, 59], [61, 69], [70, 70], [80, 79], [null, 80]])(
    'does not celebrate without an upward level crossing (%s to %s)',
    (baselineScore, projectedScore) => {
      window.localStorage.setItem('watheq:characterGender', 'male');
      renderCompanion(optimizeProps({ baselineScore, projectedScore }));
      expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier-up', 'false');
      expect(screen.queryByTestId('tier-up-confetti')).not.toBeInTheDocument();
    },
  );

  it('never celebrates when a verified decrease suppresses celebration', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps({ baselineScore: 59, projectedScore: 80, suppressCelebration: true }));
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

    renderCompanion(optimizeProps({ baselineScore: 59, projectedScore: 80 }));

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveClass('character-results__image--before');
    expect(images[1]).toHaveClass('character-results__image--after');
  });

  it('keeps the progression bar and fallback copy when scores or art are unavailable', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps());
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier', 'unavailable');
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-level', 'unavailable');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps controls and the progression bar when selected art fails', () => {
    window.localStorage.setItem('watheq:characterGender', 'male');
    renderCompanion(optimizeProps({ baselineScore: 60 }));
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    fireEvent.error(image);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('companion-progression')).toBeInTheDocument();
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

  it('uses Arabic level and picker copy', () => {
    language = 'ar';
    renderCompanion({ variant: 'match', score: 80 });
    expect(screen.getByRole('group', { name: 'اختر رفيقك' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'رفيقة' }));
    expect(screen.getAllByText('مرشح متصدر').length).toBeGreaterThan(0);
  });
});
