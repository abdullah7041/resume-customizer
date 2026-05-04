import { detectLanguage } from './arabicTextUtils';

export type ResumeDirection = 'ltr' | 'rtl';

function collectText(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectText(item, output));
  }
}

export function detectResumeDirection(value: unknown): ResumeDirection {
  const textParts: string[] = [];
  collectText(value, textParts);
  const language = detectLanguage(textParts.join(' '));
  return language === 'ar' || language === 'mixed' ? 'rtl' : 'ltr';
}

export function directionFromLanguage(language: string | null | undefined): ResumeDirection {
  return language === 'ar' || language === 'mixed' ? 'rtl' : 'ltr';
}
