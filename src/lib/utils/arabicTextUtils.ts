/**
 * Arabic text processing utilities
 */

// Arabic Unicode ranges
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Detect if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/**
 * Detect dominant language of text
 */
export function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = (text.match(new RegExp(ARABIC_RANGE.source, 'g')) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const total = arabicChars + latinChars;

  if (total === 0) return 'en';

  const arabicRatio = arabicChars / total;

  if (arabicRatio > 0.7) return 'ar';
  if (arabicRatio < 0.3) return 'en';
  return 'mixed';
}

/**
 * Normalize Arabic text
 * - Remove diacritics (tashkeel)
 * - Normalize alef variants
 * - Normalize yaa and taa marbuta
 */
export function normalizeArabic(text: string): string {
  return text
    // Remove diacritics
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variants to bare alef
    .replace(/[أإآ]/g, 'ا')
    // Normalize alef maksura to yaa
    .replace(/ى/g, 'ي')
    // Normalize taa marbuta to haa
    .replace(/ة/g, 'ه');
}

/**
 * Arabic section headers for resume parsing
 */
export const ARABIC_SECTION_HEADERS = {
  personalInfo: [
    'المعلومات الشخصية',
    'البيانات الشخصية',
    'معلومات التواصل',
    'بيانات الاتصال',
  ],
  experience: [
    'الخبرات العملية',
    'الخبرة العملية',
    'الخبرات',
    'الخبرة المهنية',
    'التجربة العملية',
    'سجل العمل',
  ],
  education: [
    'التعليم',
    'المؤهلات العلمية',
    'المؤهلات الأكاديمية',
    'الشهادات العلمية',
    'التحصيل العلمي',
  ],
  skills: [
    'المهارات',
    'المهارات التقنية',
    'المهارات الفنية',
    'القدرات',
    'الكفاءات',
  ],
  certifications: [
    'الشهادات',
    'الشهادات المهنية',
    'الدورات التدريبية',
    'التدريب',
  ],
  languages: [
    'اللغات',
    'المهارات اللغوية',
  ],
  projects: [
    'المشاريع',
    'مشاريع سابقة',
    'أعمال سابقة',
  ],
  objective: [
    'الهدف الوظيفي',
    'الهدف المهني',
    'نبذة شخصية',
    'ملخص',
  ],
  references: [
    'المراجع',
    'المعرفون',
  ],
};

/**
 * Common Arabic job titles
 */
export const ARABIC_JOB_TITLES: Record<string, string> = {
  'مدير': 'Manager',
  'مدير عام': 'General Manager',
  'مدير تنفيذي': 'CEO',
  'مدير مشروع': 'Project Manager',
  'مهندس': 'Engineer',
  'مهندس برمجيات': 'Software Engineer',
  'مطور': 'Developer',
  'محلل': 'Analyst',
  'محلل بيانات': 'Data Analyst',
  'محاسب': 'Accountant',
  'مصمم': 'Designer',
  'مسؤول': 'Officer',
  'مشرف': 'Supervisor',
  'مستشار': 'Consultant',
  'أخصائي': 'Specialist',
  'فني': 'Technician',
  'مساعد': 'Assistant',
  'منسق': 'Coordinator',
  'مدير موارد بشرية': 'HR Manager',
  'مدير مبيعات': 'Sales Manager',
  'مدير تسويق': 'Marketing Manager',
  'مدير مالي': 'Financial Manager',
};

/**
 * Extract Arabic phone numbers (Saudi format)
 */
export function extractSaudiPhone(text: string): string | null {
  // Match +966 5X XXX XXXX or 05X XXX XXXX
  const patterns = [
    /\+966\s*5[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
    /00966\s*5[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
    /05[0-9]\s*[0-9]{3}\s*[0-9]{4}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s/g, '');
    }
  }
  return null;
}

/**
 * Extract Arabic email (handles Arabic text around email)
 */
export function extractEmail(text: string): string | null {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailPattern);
  return match ? match[0] : null;
}

/**
 * Detect resume section from text
 */
export function detectArabicSection(text: string): string | null {
  const normalizedText = normalizeArabic(text.trim());

  for (const [section, headers] of Object.entries(ARABIC_SECTION_HEADERS)) {
    for (const header of headers) {
      if (normalizedText.includes(normalizeArabic(header))) {
        return section;
      }
    }
  }
  return null;
}

/**
 * Split mixed Arabic/English text into segments
 */
export function splitMixedText(text: string): Array<{ text: string; lang: 'ar' | 'en' }> {
  const segments: Array<{ text: string; lang: 'ar' | 'en' }> = [];
  let currentSegment = '';
  let currentLang: 'ar' | 'en' | null = null;

  for (const char of text) {
    const isArabic = ARABIC_RANGE.test(char);
    const isLatin = /[a-zA-Z]/.test(char);

    if (isArabic && currentLang !== 'ar') {
      if (currentSegment && currentLang) {
        segments.push({ text: currentSegment, lang: currentLang });
      }
      currentSegment = char;
      currentLang = 'ar';
    } else if (isLatin && currentLang !== 'en') {
      if (currentSegment && currentLang) {
        segments.push({ text: currentSegment, lang: currentLang });
      }
      currentSegment = char;
      currentLang = 'en';
    } else {
      currentSegment += char;
    }
  }

  if (currentSegment && currentLang) {
    segments.push({ text: currentSegment, lang: currentLang });
  }

  return segments;
}



