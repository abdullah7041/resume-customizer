import {
  detectVulnerabilities,
  type WorkEntry,
} from '../../netlify/lib/vulnerability-detector';

export type { WorkEntry } from '../../netlify/lib/vulnerability-detector';

export const OTHER_OPTION_VALUE = '__other__';
export const FALLBACK_HARD_STOP_VALUE = '__hard_stop__';
export const STRONG_MATCH_THRESHOLD = 80;

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
  const hardStops: string[] = [];

  for (const sourceQuestion of questions) {
    const question = normalizeClarificationQuestion(sourceQuestion, fallbackHardStopLabel);
    const answer = answers[question.id];
    if (!answer) continue;

    const selectedOptions = question.options.filter(option => answer.selectedValues.includes(option.value));
    const hardStopOptions = selectedOptions.filter(option => option.isHardStop);
    const positiveLabels = selectedOptions.filter(option => !option.isHardStop).map(option => option.label);
    const otherText = answer.selectedValues.includes(OTHER_OPTION_VALUE) && isValidOtherAnswer(answer.otherText)
      ? answer.otherText.trim()
      : '';

    for (const term of hardStopOptions.map(option => formatHardStopTerm(question, option))) {
      if (!hardStops.includes(term)) hardStops.push(term);
    }

    const positiveEvidence = [...positiveLabels, ...(otherText ? [otherText] : [])];
    if (positiveEvidence.length > 0) {
      positiveBlocks.push(`[${question.theme}]\nQ: ${question.question}\nA: ${positiveEvidence.join('; ')}`);
    }
  }

  return {
    userClarifications: positiveBlocks.length > 0 ? positiveBlocks.join('\n\n') : undefined,
    userHardStops: hardStops.length > 0 ? hardStops : undefined,
  };
}

export function shouldRequestClarifications(
  matchScore: number | null | undefined,
  workHistory: WorkEntry[] | undefined,
): boolean {
  if (typeof matchScore !== 'number' || matchScore < STRONG_MATCH_THRESHOLD) return true;
  return detectVulnerabilities(workHistory ?? []).length > 0;
}
