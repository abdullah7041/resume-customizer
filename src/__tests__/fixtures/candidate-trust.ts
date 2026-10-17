import type { ResumeSchema } from '../../types/resume.js';

export const trustFacts = {
  english: { name: 'Nora Example', employerA: 'Cedar Labs', employerB: 'Harbor Works',
    repeated: 'Maintained customer reports.', metric: 'Reduced API latency by 20%.',
    qualitative: 'Maintained internal reports without a measured outcome.' },
  arabic: { name: 'نورة المثال', employerA: 'مختبرات الأرز', employerB: 'أعمال الميناء',
    repeated: 'أعددت تقارير العملاء.', metric: 'خفضت زمن استجابة الواجهة بنسبة ٢٠٪.',
    qualitative: 'أعددت تقارير داخلية دون قياس للنتيجة.' },
};

export function trustResume(language: 'en' | 'ar' | 'mixed' = 'en'): ResumeSchema {
  const facts = trustFacts[language === 'ar' ? 'arabic' : 'english'];
  const mixed = language === 'mixed';
  return {
    basics: { name: facts.name, label: language === 'ar' ? 'مهندسة برمجيات' : 'Software Engineer',
      email: 'nora@example.test', phone: '+966500000001', url: 'https://nora.example.test',
      summary: language === 'ar' ? 'مهندسة تطور أنظمة التقارير.' : 'Engineer building reporting systems.',
      location: { city: language === 'ar' ? 'الرياض' : 'Riyadh', countryCode: 'SA', region: '' },
      profiles: [{ network: 'GitHub', username: 'nora-example', url: 'https://github.com/nora-example' }] },
    work: [
      { name: facts.employerA, position: language === 'ar' ? 'مهندسة أولى' : 'Senior Engineer',
        startDate: '2022-01', endDate: '2024-06', summary: '',
        highlights: [facts.repeated, facts.metric, ...(mixed ? Array.from({ length: 45 }, (_, index) => `Project detail ${index + 1}: ${'Documented technical delivery. '.repeat(8)}`) : [])] },
      { name: mixed ? trustFacts.arabic.employerB : facts.employerB,
        position: language === 'ar' ? 'محللة تقارير' : 'Reporting Analyst',
        startDate: '2020-01', endDate: '2021-12', summary: '',
        highlights: [mixed ? trustFacts.arabic.repeated : facts.repeated,
          mixed ? trustFacts.arabic.qualitative : facts.qualitative] },
    ],
    education: [{ institution: language === 'ar' ? 'جامعة المثال' : 'Example University',
      area: language === 'ar' ? 'علوم الحاسب' : 'Computer Science', studyType: language === 'ar' ? 'بكالوريوس' : 'Bachelor',
      startDate: '2016', endDate: '2020', highlights: [] }],
    skills: [{ name: 'Engineering', keywords: ['TypeScript', 'SQL'] }],
  };
}
