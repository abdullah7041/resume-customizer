import { useLayoutEffect, useMemo, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import femaleTier1 from '@/assets/character/female-tier-1.webp';
import femaleTier2 from '@/assets/character/female-tier-2.webp';
import femaleTier3 from '@/assets/character/female-tier-3.webp';
import maleTier1 from '@/assets/character/male-tier-1.webp';
import maleTier2 from '@/assets/character/male-tier-2.webp';
import maleTier3 from '@/assets/character/male-tier-3.webp';
import { useHRSuperSaud } from '@/features/hr-super-saud/HRSuperSaudProvider';
import { cn } from '@/lib/utils/cn';
import { CAREER_LEVELS, getCareerLevel, getLevelUp } from '@/lib/progression/careerLevels';
import { getCompatibleStorageItem, setCompatibleStorageItem } from '@/lib/utils/storage-migration';
import type { CharacterGender, CharacterResultsCompanionProps, CharacterScoreTier } from '@/types/characterResults';

const CHARACTER_GENDER_KEY = 'watheq:characterGender';

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

type ProgressionStyle = CSSProperties & { '--character-score': string };
type MarkerStyle = CSSProperties & { '--marker-at': string };

// Interior level boundaries (level minimums above 0) — the bar's tick marks.
const LEVEL_TICKS = CAREER_LEVELS.slice(1).map((level) => level.min);

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

  // The character represents the ACTUAL current resume: the Match score, or in
  // Optimize the applied-only projection (falling back to the baseline when
  // nothing is applied). The all-suggestions potential is only ever the ghost
  // target marker below — it never levels the character up.
  const baselineScore = props.variant === 'optimize' ? props.baselineScore : null;
  const displayedScore = props.variant === 'optimize'
    ? (props.projectedScore ?? props.baselineScore)
    : props.score;
  const targetScore = props.variant === 'optimize' ? props.targetScore : null;
  const targetKind = props.variant === 'optimize' ? props.targetKind : null;
  const suppressCelebration = props.variant === 'optimize' && Boolean(props.suppressCelebration);

  const level = displayedScore === null ? null : getCareerLevel(displayedScore);
  const baselineLevel = baselineScore === null ? null : getCareerLevel(baselineScore);
  const finalTier = level?.artTier ?? null;
  const baselineTier = baselineLevel?.artTier ?? null;

  const isLevelUp = props.variant === 'optimize'
    && !suppressCelebration
    && getLevelUp(baselineScore, displayedScore);
  // Art only changes at the 60/80 tier boundaries; a level-up within the same art
  // tier keeps a single layer (no crossfade) but still celebrates.
  const showTierCrossfade = isLevelUp && baselineTier !== null && finalTier !== null && baselineTier !== finalTier;

  const levelName = level === null ? null : t(`sections.characterResults.levels.${level.key}`);
  const levelLabel = level === null
    ? t('sections.characterResults.unavailableScore', 'Unavailable')
    : t('sections.characterResults.levelLabel', {
      defaultValue: 'Level {{level}} of 5 · {{name}}',
      level: String(level.index),
      name: levelName ?? '',
    });

  const showTarget = targetScore !== null && displayedScore !== null && targetScore > displayedScore;
  const targetCaption = showTarget
    ? (targetKind === 'verified'
      ? t('sections.characterResults.targetVerified', { defaultValue: 'Target {{score}}% · Verified', score: String(targetScore) })
      : t('sections.characterResults.targetEstimate', { defaultValue: 'Target ~{{score}}% (estimate)', score: String(targetScore) }))
    : null;

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
        width={1254}
        height={1254}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={markAssetFailed}
      />
    );
  };

  // The ONE progression metaphor: a single bar at the displayed (actual) score
  // with the five level boundaries ticked and an optional ghost target marker.
  const progressionBar = () => {
    const fillStyle: ProgressionStyle = { '--character-score': displayedScore === null ? '0%' : `${displayedScore}%` };
    return (
      <div className="character-results__progression" data-testid="companion-progression">
        <div className="character-results__score-copy">
          <span>{levelLabel}</span>
          <strong data-testid="companion-score">
            {displayedScore === null ? t('sections.characterResults.unavailableScore', 'Unavailable') : `${displayedScore}%`}
          </strong>
        </div>
        <div className="character-results__track character-results__track--progression" aria-hidden="true">
          <span className="character-results__fill character-results__fill--level" style={fillStyle} />
          {LEVEL_TICKS.map((tick) => (
            <i key={tick} className="character-results__tick" style={{ '--marker-at': `${tick}%` } as MarkerStyle} />
          ))}
          {showTarget && (
            <i
              className="character-results__ghost"
              style={{ '--marker-at': `${targetScore}%` } as MarkerStyle}
              data-testid="companion-target-marker"
            />
          )}
        </div>
        {targetCaption && (
          <p className="character-results__target-caption" data-testid="companion-target-caption">
            {targetCaption}
          </p>
        )}
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
        data-level={level?.index ?? 'unavailable'}
        data-tier-up="false"
      >
        {props.variant === 'optimize' && progressionBar()}
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
      className={cn('character-results', `character-results--${props.variant}`, isLevelUp && 'character-results--tier-up')}
      data-testid="character-results-companion"
      data-variant={props.variant}
      data-tier={finalTier ?? 'unavailable'}
      data-level={level?.index ?? 'unavailable'}
      data-tier-up={String(isLevelUp)}
    >
      {progressionBar()}

      <div className="character-results__character">
        <div className="character-results__art" aria-live="polite">
          {showTierCrossfade && baselineTier !== null && renderImage(gender, baselineTier, 'character-results__image character-results__image--before')}
          {finalTier !== null && renderImage(gender, finalTier, cn('character-results__image', showTierCrossfade && 'character-results__image--after'))}
          {isLevelUp && (
            <span className="character-results__confetti" data-testid="tier-up-confetti" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
            </span>
          )}
        </div>
        <div className="character-results__meta">
          <strong>{levelName ?? t('sections.characterResults.unavailableScore', 'Unavailable')}</strong>
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
