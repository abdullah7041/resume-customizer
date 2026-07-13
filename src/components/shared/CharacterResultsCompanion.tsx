import { useLayoutEffect, useMemo, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import femaleTier1 from '@/assets/character/female-tier-1.webp';
import femaleTier2 from '@/assets/character/female-tier-2.webp';
import femaleTier3 from '@/assets/character/female-tier-3.webp';
import maleTier1 from '@/assets/character/male-tier-1.webp';
import maleTier2 from '@/assets/character/male-tier-2.webp';
import maleTier3 from '@/assets/character/male-tier-3.webp';
import { useHRSuperSaud } from '@/features/hr-super-saud';
import { cn } from '@/lib/utils/cn';
import { getCompatibleStorageItem, setCompatibleStorageItem } from '@/lib/utils/storage-migration';
import type { CharacterGender, CharacterResultsCompanionProps, CharacterScoreTier } from '@/types/characterResults';

const CHARACTER_GENDER_KEY = 'watheq:characterGender';

const tierRanks: Record<CharacterScoreTier, number> = {
  struggling: 1,
  confident: 2,
  celebrating: 3,
};

const characterAssets: Record<CharacterGender, Record<CharacterScoreTier, string>> = {
  male: {
    struggling: maleTier1,
    confident: maleTier2,
    celebrating: maleTier3,
  },
  female: {
    struggling: femaleTier1,
    confident: femaleTier2,
    celebrating: femaleTier3,
  },
};

type ScoreBarStyle = CSSProperties & { '--character-score': string };

function getTier(score: number): CharacterScoreTier {
  if (score < 60) return 'struggling';
  if (score < 80) return 'confident';
  return 'celebrating';
}

function readGenderPreference(): CharacterGender | null {
  if (typeof window === 'undefined') return null;
  const stored = getCompatibleStorageItem(CHARACTER_GENDER_KEY);
  return stored === 'male' || stored === 'female' ? stored : null;
}

export function CharacterResultsCompanion(props: CharacterResultsCompanionProps) {
  const { t } = useTranslation();
  const { registerCompanion } = useHRSuperSaud();
  const [gender, setGender] = useState<CharacterGender | null>(readGenderPreference);
  const [failedAssets, setFailedAssets] = useState<Set<string>>(() => new Set());
  const [entranceKey, setEntranceKey] = useState(0);

  useLayoutEffect(() => registerCompanion(), [registerCompanion]);

  const beforeScore = props.variant === 'optimize' ? props.beforeScore : null;
  const afterScore = props.variant === 'optimize' ? props.afterScore : props.score;
  const finalScore = afterScore ?? beforeScore;
  const finalTier = finalScore === null ? null : getTier(finalScore);
  const beforeTier = beforeScore === null ? null : getTier(beforeScore);
  const isTierUp = props.variant === 'optimize'
    && beforeTier !== null
    && afterScore !== null
    && finalTier !== null
    && tierRanks[finalTier] > tierRanks[beforeTier];
  const stateLabel = finalTier === null
    ? t('sections.characterResults.unavailableScore', 'Unavailable')
    : t(`sections.characterResults.states.${finalTier}`);

  const handleGenderChange = (nextGender: CharacterGender) => {
    setCompatibleStorageItem(CHARACTER_GENDER_KEY, nextGender);
    setGender(nextGender);
    setEntranceKey((value) => value + 1);
  };

  const markAssetFailed = (event: SyntheticEvent<HTMLImageElement>) => {
    const source = event.currentTarget.src;
    setFailedAssets((current) => new Set(current).add(source));
  };

  const genderLabels = useMemo<Record<CharacterGender, string>>(() => ({
    male: t('sections.characterResults.male', 'Male companion'),
    female: t('sections.characterResults.female', 'Female companion'),
  }), [t]);

  const renderImage = (imageGender: CharacterGender, tier: CharacterScoreTier, className: string) => {
    const source = characterAssets[imageGender][tier];
    if (failedAssets.has(source) || [...failedAssets].some((failed) => failed.endsWith(source))) return null;
    const alt = t('sections.characterResults.imageAlt', {
      defaultValue: '{{gender}}: {{state}}',
      gender: genderLabels[imageGender],
      state: t(`sections.characterResults.states.${tier}`),
    });

    return (
      <img
        key={`${imageGender}-${tier}-${entranceKey}`}
        src={source}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={markAssetFailed}
      />
    );
  };

  const scoreBar = (label: string, score: number | null, testId: string, tone: 'before' | 'after') => {
    const style: ScoreBarStyle = { '--character-score': score === null ? '0%' : `${score}%` };
    return (
      <div className="character-results__score" data-testid={testId}>
        <div className="character-results__score-copy">
          <span>{label}</span>
          <strong>{score === null ? t('sections.characterResults.unavailableScore', 'Unavailable') : `${score}%`}</strong>
        </div>
        <div className="character-results__track" aria-hidden="true">
          <span className={cn('character-results__fill', `character-results__fill--${tone}`)} style={style} />
        </div>
      </div>
    );
  };

  if (gender === null) {
    return (
      <section
        className={cn('character-results', `character-results--${props.variant}`, 'character-results--picker')}
        data-testid="character-results-companion"
        data-variant={props.variant}
        data-tier={finalTier ?? 'unavailable'}
        data-tier-up="false"
      >
        {props.variant === 'optimize' && (
          <div className="character-results__scores">
            {scoreBar(t('sections.characterResults.before', 'Before'), beforeScore, 'before-score-bar', 'before')}
            {scoreBar(t('sections.characterResults.after', 'After'), afterScore, 'after-score-bar', 'after')}
          </div>
        )}
        <div className="character-results__picker" role="group" aria-label={t('sections.characterResults.picker', 'Choose your companion')}>
          <p>{t('sections.characterResults.picker', 'Choose your companion')}</p>
          <div className="character-results__picker-options">
            {(['male', 'female'] as const).map((option) => (
              <button key={option} type="button" aria-label={genderLabels[option]} onClick={() => handleGenderChange(option)}>
                {renderImage(option, 'confident', 'character-results__picker-image')}
                <span>{genderLabels[option]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn('character-results', `character-results--${props.variant}`, isTierUp && 'character-results--tier-up')}
      data-testid="character-results-companion"
      data-variant={props.variant}
      data-tier={finalTier ?? 'unavailable'}
      data-tier-up={String(isTierUp)}
    >
      {props.variant === 'optimize' && (
        <div className="character-results__scores">
          {scoreBar(t('sections.characterResults.before', 'Before'), beforeScore, 'before-score-bar', 'before')}
          {scoreBar(t('sections.characterResults.after', 'After'), afterScore, 'after-score-bar', 'after')}
        </div>
      )}

      <div className="character-results__character">
        <div className="character-results__art" aria-live="polite">
          {isTierUp && beforeTier !== null && renderImage(gender, beforeTier, 'character-results__image character-results__image--before')}
          {finalTier !== null && renderImage(gender, finalTier, cn('character-results__image', isTierUp && 'character-results__image--after'))}
          {isTierUp && (
            <span className="character-results__confetti" data-testid="tier-up-confetti" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
            </span>
          )}
        </div>
        <div className="character-results__meta">
          <strong>{stateLabel}</strong>
          <div className="character-results__toggle" role="group" aria-label={t('sections.characterResults.changeCompanion', 'Change companion')}>
            {(['male', 'female'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-label={genderLabels[option]}
                aria-pressed={gender === option}
                onClick={() => handleGenderChange(option)}
              >
                {genderLabels[option]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
