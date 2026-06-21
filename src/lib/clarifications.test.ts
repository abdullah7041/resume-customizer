import { describe, expect, it } from 'vitest';
import {
  filterClarificationQuestionsByHardStops,
  formatClarificationAnswers,
  loadPersistentHardStops,
  normalizeClarificationQuestion,
  persistHardStops,
  shouldRequestClarifications,
  type ClarificationAnswers,
  type ClarificationQuestion,
} from '@/lib/clarifications';

const excelQuestion: ClarificationQuestion = {
  id: 'excelExperience',
  theme: 'Excel',
  rationale: 'The role requires Excel evidence.',
  question: 'Which Excel work can you verify?',
  type: 'multi',
  options: [
    { value: 'dashboards', label: 'Built Excel dashboards' },
    { value: 'no_excel', label: "I don't have Excel experience", isHardStop: true },
  ],
  allowOther: true,
};

describe('clarification helpers', () => {
  it('adds a localized hard-stop as the final option when the model omits one', () => {
    const normalized = normalizeClarificationQuestion(
      { ...excelQuestion, options: excelQuestion.options.slice(0, 1) },
      "I don't have this experience",
    );

    expect(normalized.options.at(-1)).toEqual({
      value: '__hard_stop__',
      label: "I don't have this experience",
      isHardStop: true,
    });
  });

  it('splits positive selections from hard-stop suppression items', () => {
    const answers: ClarificationAnswers = {
      excelExperience: {
        selectedValues: ['no_excel'],
        otherText: '',
      },
    };

    expect(formatClarificationAnswers([excelQuestion], answers)).toEqual({
      userClarifications: undefined,
      userHardStops: ["I don't have Excel experience"],
      persistentHardStops: ['Excel'],
    });
  });

  it('uses the selected hard-stop option instead of a generic question theme', () => {
    const question: ClarificationQuestion = {
      ...excelQuestion,
      theme: 'Tool experience',
      options: [
        { value: 'dashboards', label: 'Built dashboards' },
        { value: 'salesforce', label: "I don't have Salesforce experience", isHardStop: true },
      ],
    };
    const answers: ClarificationAnswers = {
      excelExperience: {
        selectedValues: ['salesforce'],
        otherText: '',
      },
    };

    expect(formatClarificationAnswers([question], answers)).toEqual({
      userClarifications: undefined,
      userHardStops: ["I don't have Salesforce experience"],
      persistentHardStops: ['salesforce'],
    });
  });

  it('keeps a keyword-bearing hard-stop term when the display label is localized', () => {
    const question: ClarificationQuestion = {
      ...excelQuestion,
      theme: 'Excel',
      options: [
        { value: 'dashboards', label: 'Built Excel dashboards' },
        { value: 'no_excel', label: 'ليست لدي خبرة بهذا', isHardStop: true },
      ],
    };
    const answers: ClarificationAnswers = {
      excelExperience: {
        selectedValues: ['no_excel'],
        otherText: '',
      },
    };

    expect(formatClarificationAnswers([question], answers)).toEqual({
      userClarifications: undefined,
      userHardStops: ['Excel: ليست لدي خبرة بهذا'],
      persistentHardStops: ['Excel'],
    });
  });

  it('preserves fallback hard-stop selections when the source question omitted a hard-stop option', () => {
    const answers: ClarificationAnswers = {
      excelExperience: {
        selectedValues: ['__hard_stop__'],
        otherText: '',
      },
    };

    expect(formatClarificationAnswers([{
      ...excelQuestion,
      options: excelQuestion.options.filter(option => !option.isHardStop),
    }], answers, "I don't have this experience")).toEqual({
      userClarifications: undefined,
      userHardStops: ["Excel: I don't have this experience"],
      persistentHardStops: ['Excel'],
    });
  });

  it('keeps valid Other evidence in the positive clarification block', () => {
    const answers: ClarificationAnswers = {
      excelExperience: {
        selectedValues: ['__other__'],
        otherText: 'Built monthly forecasting models',
      },
    };

    expect(formatClarificationAnswers([excelQuestion], answers)).toEqual({
      userClarifications: '[Excel]\nQ: Which Excel work can you verify?\nA: Built monthly forecasting models',
      userHardStops: undefined,
    });
  });

  it('skips the clarification call only for a known strong match with no vulnerabilities', () => {
    expect(shouldRequestClarifications(85, [])).toBe(false);
    expect(shouldRequestClarifications(79, [])).toBe(true);
    expect(shouldRequestClarifications(null, [])).toBe(true);
    expect(shouldRequestClarifications(90, [{
      name: 'Acme',
      position: 'Analyst',
      startDate: '2025-01',
      endDate: '2025-06',
    }])).toBe(true);
  });

  it('persists a normalized, case-insensitive union of hard stops', () => {
    const values = new Map<string, string>([
      ['watheq:hardStops', JSON.stringify([' Excel ', 'Power BI'])],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(persistHardStops(['excel', 'Tableau', ''], storage)).toEqual([
      'Excel',
      'Power BI',
      'Tableau',
    ]);
    expect(loadPersistentHardStops(storage)).toEqual(['Excel', 'Power BI', 'Tableau']);
  });

  it('filters future questions whose themes are already persistent hard stops', () => {
    const powerBiQuestion: ClarificationQuestion = {
      ...excelQuestion,
      id: 'powerBiExperience',
      theme: 'Power BI',
    };

    expect(filterClarificationQuestionsByHardStops(
      [excelQuestion, powerBiQuestion],
      [' excel '],
    )).toEqual([powerBiQuestion]);
  });
});
