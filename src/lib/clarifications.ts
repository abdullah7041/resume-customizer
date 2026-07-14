import {
  detectVulnerabilities,
  type WorkEntry,
} from '../../netlify/lib/vulnerability-detector';

export type { WorkEntry } from '../../netlify/lib/vulnerability-detector';

export const OTHER_OPTION_VALUE = '__other__';
export const FALLBACK_HARD_STOP_VALUE = '__hard_stop__';
export const STRONG_MATCH_THRESHOLD = 80;
export const HARD_STOPS_STORAGE_KEY = 'watheq:hardStops';

type HardStopStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface ClarificationOption {
  value: string;
  label: string;
  isHardStop?: boolean;
}

export interface ClarificationQuestion {
  id: string;
  theme: string;
  rationale: string;
  question: string;
  type: 'single' | 'multi';
  options: ClarificationOption[];
  allowOther: boolean;
  defaultValue?: string;
}

export interface ClarificationAnswer {
  selectedValues: string[];
  otherText: string;
}

export type ClarificationAnswers = Record<string, ClarificationAnswer>;

export interface FormattedClarifications {
  userClarifications?: string;
  userHardStops?: string[];
  persistentHardStops?: string[];
}

function keywordFromHardStopOption(question: ClarificationQuestion, option: ClarificationOption): string {
  const rawValue = option.value.trim();
  const theme = question.theme.trim();
  const genericTheme = /^(?:tool|tools?|skill|skills?|experience|background|tool experience|skill gap)$/i.test(theme);

  if (theme && !genericTheme) return theme;
  if (rawValue === FALLBACK_HARD_STOP_VALUE || rawValue === OTHER_OPTION_VALUE) return theme;

  const valueKeyword = rawValue
    .replace(/^(?:no|not|dont|don't|without)[_-]+/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return valueKeyword || theme;
}

function formatHardStopTerm(question: ClarificationQuestion, option: ClarificationOption): string {
  const label = option.label.trim();
  const keyword = keywordFromHardStopOption(question, option);
  if (!keyword) return label;

  const labelLower = label.toLocaleLowerCase();
  const keywordLower = keyword.toLocaleLowerCase();
  return labelLower.includes(keywordLower) ? label : `${keyword}: ${label}`;
}

function getBrowserStorage(): HardStopStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

function normalizeHardStops(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length === 20) break;
  }
  return normalized;
}

export function loadPersistentHardStops(storage = getBrowserStorage()): string[] {
  if (!storage) return [];
  try {
    return normalizeHardStops(JSON.parse(storage.getItem(HARD_STOPS_STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function persistHardStops(
  hardStops: string[],
  storage = getBrowserStorage(),
): string[] {
  const merged = normalizeHardStops([
    ...loadPersistentHardStops(storage),
    ...hardStops,
  ]);
  if (!storage) return merged;
  try {
    storage.setItem(HARD_STOPS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Storage can be unavailable in privacy mode; optimization still proceeds.
  }
  return merged;
}

export function filterClarificationQuestionsByHardStops(
  questions: ClarificationQuestion[],
  hardStops: string[],
): ClarificationQuestion[] {
  const suppressedThemes = new Set(normalizeHardStops(hardStops).map(value => value.toLocaleLowerCase()));
  return questions.filter(question => !suppressedThemes.has(question.theme.trim().toLocaleLowerCase()));
}

export function isValidOtherAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  const words = trimmed.match(/\p{L}{2,}/gu) || [];
  return words.length >= 3;
}

export function normalizeClarificationQuestion(
  question: ClarificationQuestion,
  fallbackHardStopLabel: string,
): ClarificationQuestion {
  const options = Array.isArray(question.options) ? question.options : [];
  const regularOptions = options.filter(option => !option.isHardStop).slice(0, 4);
  const hardStop = options.find(option => option.isHardStop) ?? {
    value: FALLBACK_HARD_STOP_VALUE,
    label: fallbackHardStopLabel,
    isHardStop: true,
  };

  return {
    ...question,
    type: question.type === 'multi' ? 'multi' : 'single',
    allowOther: question.allowOther !== false,
    options: [...regularOptions, hardStop],
  };
}

export function formatClarificationAnswers(
  questions: ClarificationQuestion[],
  answers: ClarificationAnswers,
  fallbackHardStopLabel = "I don't have this experience",
): FormattedClarifications {
  const positiveBlocks: string[] = [];
  const hardStopSet = new Set<string>();
  const persistentHardStopSet = new Set<string>();

  for (const sourceQuestion of questions) {
    const question = normalizeClarificationQuestion(sourceQuestion, fallbackHardStopLabel);
    const answer = answers[question.id];
    if (!answer) continue;

    const selectedValueSet = new Set(answer.selectedValues);
    const selectedOptions = question.options.filter(option => selectedValueSet.has(option.value));
    const hardStopOptions = selectedOptions.filter(option => option.isHardStop);
    const positiveLabels = selectedOptions.flatMap(option => option.isHardStop ? [] : [option.label]);
    const otherText = selectedValueSet.has(OTHER_OPTION_VALUE) && isValidOtherAnswer(answer.otherText)
      ? answer.otherText.trim()
      : '';

    for (const term of hardStopOptions.map(option => formatHardStopTerm(question, option))) {
      hardStopSet.add(term);
    }
    for (const term of hardStopOptions.map(option => keywordFromHardStopOption(question, option))) {
      if (term) persistentHardStopSet.add(term);
    }

    const positiveEvidence = [...positiveLabels, ...(otherText ? [otherText] : [])];
    if (positiveEvidence.length > 0) {
      positiveBlocks.push(`[${question.theme}]\nQ: ${question.question}\nA: ${positiveEvidence.join('; ')}`);
    }
  }

  return {
    userClarifications: positiveBlocks.length > 0 ? positiveBlocks.join('\n\n') : undefined,
    userHardStops: hardStopSet.size > 0 ? [...hardStopSet] : undefined,
    ...(persistentHardStopSet.size > 0 ? { persistentHardStops: [...persistentHardStopSet] } : {}),
  };
}

export function shouldRequestClarifications(
  matchScore: number | null | undefined,
  workHistory: WorkEntry[] | undefined,
): boolean {
  if (typeof matchScore !== 'number' || matchScore < STRONG_MATCH_THRESHOLD) return true;
  return detectVulnerabilities(workHistory ?? []).length > 0;
}
