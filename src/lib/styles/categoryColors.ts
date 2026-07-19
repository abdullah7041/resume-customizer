export type CategoryColorKey = 'hard_skills' | 'experience' | 'education' | 'soft_skills';

export interface CategoryColorClasses {
  readonly textClass: string;
  readonly backgroundClass: string;
  readonly barClass: string;
}

export const CATEGORY_COLORS = {
  hard_skills: {
    textClass: 'text-teal-700 dark:text-teal-300',
    backgroundClass: 'bg-teal-500/20',
    barClass: 'bg-teal-500',
  },
  experience: {
    textClass: 'text-purple-700 dark:text-purple-300',
    backgroundClass: 'bg-purple-500/20',
    barClass: 'bg-purple-500',
  },
  education: {
    textClass: 'text-amber-700 dark:text-amber-300',
    backgroundClass: 'bg-amber-500/20',
    barClass: 'bg-amber-500',
  },
  soft_skills: {
    textClass: 'text-emerald-700 dark:text-emerald-300',
    backgroundClass: 'bg-emerald-500/20',
    barClass: 'bg-emerald-500',
  },
} as const satisfies Record<CategoryColorKey, CategoryColorClasses>;
