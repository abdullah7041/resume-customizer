export type CharacterGender = 'male' | 'female';

export type CharacterScoreTier = 'struggling' | 'confident' | 'celebrating';

export type CharacterResultsCompanionProps =
  | {
      variant: 'match';
      score: number;
    }
  | {
      variant: 'optimize';
      beforeScore: number | null;
      afterScore: number | null;
    };
