export type CharacterGender = 'male' | 'female';

/** Art tiers — three illustration sets shared across the five career levels. */
export type CharacterScoreTier = 'struggling' | 'confident' | 'celebrating';

export type CharacterResultsCompanionProps =
  | {
      variant: 'match';
      /** The verified Match score — the character's current level. */
      score: number;
    }
  | {
      variant: 'optimize';
      /** The user's actual current score (Match baseline). */
      baselineScore: number | null;
      /**
       * Applied-only projection — where the resume stands with the suggestions
       * the user has actually applied. Null when nothing is applied; the
       * character then stays at the baseline. Never the hypothetical
       * all-suggestions score.
       */
      projectedScore: number | null;
      /**
       * Where all suggestions could take the resume — rendered only as a ghost
       * marker on the progression bar, never as the character's own level.
       */
      targetScore: number | null;
      targetKind: 'verified' | 'estimate' | null;
      /** True on a verified score decrease: never celebrate a level-up. */
      suppressCelebration?: boolean;
    };
