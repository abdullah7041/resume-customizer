import {
  detectLanguage,
  detectArabicSection,
  extractSaudiPhone,
  extractEmail,
  ARABIC_JOB_TITLES,
} from './arabicTextUtils';

export interface ParsedResume {
  language: 'ar' | 'en' | 'mixed';
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  objective?: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  languages: Language[];
  rawText: string;
}

export interface WorkExperience {
  title: string;
  titleEn?: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description: string[];
}

export interface Education {
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
}

export interface Language {
  name: string;
  level: string;
}

/**
 * Parse Arabic/bilingual resume text
 */
export function parseArabicResume(text: string): ParsedResume {
  const language = detectLanguage(text);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const resume: ParsedResume = {
    language,
    personalInfo: {},
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    rawText: text,
  };

  // Extract contact info
  resume.personalInfo.email = extractEmail(text);
  resume.personalInfo.phone = extractSaudiPhone(text);

  // Extract LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
  if (linkedinMatch) {
    resume.personalInfo.linkedin = linkedinMatch[0];
  }

  // Parse sections
  let currentSection: string | null = null;
  let sectionContent: string[] = [];

  for (const line of lines) {
    const detectedSection = detectArabicSection(line) || detectEnglishSection(line);

    if (detectedSection) {
      // Process previous section
      if (currentSection && sectionContent.length > 0) {
        processSection(resume, currentSection, sectionContent);
      }
      currentSection = detectedSection;
      sectionContent = [];
    } else if (currentSection) {
      sectionContent.push(line);
    } else {
      // Before any section - likely personal info or name
      if (!resume.personalInfo.name && line.length < 50 && !line.includes('@')) {
        resume.personalInfo.name = line;
      }
    }
  }

  // Process last section
  if (currentSection && sectionContent.length > 0) {
    processSection(resume, currentSection, sectionContent);
  }

  return resume;
}

function detectEnglishSection(text: string): string | null {
  const normalizedText = text.toLowerCase().trim();

  const sectionMap: Record<string, string[]> = {
    personalInfo: ['personal information', 'contact', 'contact info'],
    experience: ['experience', 'work experience', 'employment', 'work history', 'professional experience'],
    education: ['education', 'academic', 'qualifications'],
    skills: ['skills', 'technical skills', 'competencies', 'abilities'],
    certifications: ['certifications', 'certificates', 'training', 'courses'],
    languages: ['languages', 'language skills'],
    projects: ['projects', 'portfolio'],
    objective: ['objective', 'summary', 'profile', 'about me'],
    references: ['references'],
  };

  for (const [section, headers] of Object.entries(sectionMap)) {
    for (const header of headers) {
      if (normalizedText.includes(header)) {
        return section;
      }
    }
  }
  return null;
}

function processSection(resume: ParsedResume, section: string, content: string[]): void {
  switch (section) {
    case 'objective':
      resume.objective = content.join(' ');
      break;

    case 'experience':
      resume.experience = parseExperience(content);
      break;

    case 'education':
      resume.education = parseEducation(content);
      break;

    case 'skills':
      resume.skills = parseSkills(content);
      break;

    case 'certifications':
      resume.certifications = content.filter(c => c.length > 3);
      break;

    case 'languages':
      resume.languages = parseLanguages(content);
      break;
  }
}

function parseExperience(content: string[]): WorkExperience[] {
  const experiences: WorkExperience[] = [];
  let currentExp: Partial<WorkExperience> | null = null;

  for (const line of content) {
    const isJobTitle = isLikelyJobTitle(line);

    if (isJobTitle && currentExp?.title) {
      // Save previous experience
      if (currentExp.title) {
        experiences.push(currentExp as WorkExperience);
      }
      currentExp = { title: line, description: [] };
    } else if (isJobTitle) {
      currentExp = { title: line, description: [] };
    } else if (currentExp) {
      if (isLikelyCompany(line)) {
        currentExp.company = line;
      } else if (isLikelyDate(line)) {
        const dates = extractDates(line);
        if (dates) {
          currentExp.startDate = dates.start;
          currentExp.endDate = dates.end;
          currentExp.current = dates.current;
        }
      } else {
        currentExp.description = currentExp.description || [];
        currentExp.description.push(line);
      }
    }
  }

  // Add last experience
  if (currentExp?.title) {
    experiences.push(currentExp as WorkExperience);
  }

  return experiences;
}

function isLikelyJobTitle(text: string): boolean {
  // Check Arabic job titles
  for (const arabicTitle of Object.keys(ARABIC_JOB_TITLES)) {
    if (text.includes(arabicTitle)) {
      return true;
    }
  }

  // Check English job titles
  const englishTitlePatterns = [
    /manager/i, /engineer/i, /developer/i, /analyst/i, /director/i,
    /specialist/i, /coordinator/i, /consultant/i, /supervisor/i,
    /officer/i, /executive/i, /lead/i, /head/i, /chief/i,
  ];

  return englishTitlePatterns.some(pattern => pattern.test(text));
}

function isLikelyCompany(text: string): boolean {
  const companyIndicators = [
    'شركة', 'مؤسسة', 'مجموعة', 'بنك', 'جامعة', 'مستشفى', 'وزارة',
    'company', 'inc', 'llc', 'ltd', 'corp', 'group', 'bank', 'university',
  ];

  return companyIndicators.some(ind => text.toLowerCase().includes(ind));
}

function isLikelyDate(text: string): boolean {
  const datePatterns = [
    /\d{4}/,
    /\d{1,2}\/\d{4}/,
    /\d{1,2}-\d{4}/,
    /حتى الآن/,
    /present/i,
    /current/i,
    /الحالي/,
  ];

  return datePatterns.some(pattern => pattern.test(text));
}

function extractDates(text: string): { start?: string; end?: string; current: boolean } | null {
  const current = /حتى الآن|present|current|الحالي/i.test(text);
  const years = text.match(/\d{4}/g);

  if (years && years.length >= 1) {
    return {
      start: years[0],
      end: years[1] || (current ? undefined : years[0]),
      current,
    };
  }

  return { current };
}

function parseEducation(content: string[]): Education[] {
  const education: Education[] = [];
  let current: Partial<Education> = {};

  const degreePatterns = [
    /بكالوريوس|bachelor/i,
    /ماجستير|master/i,
    /دكتوراه|phd|doctorate/i,
    /دبلوم|diploma/i,
    /ثانوية|high school/i,
  ];

  for (const line of content) {
    const isDegree = degreePatterns.some(p => p.test(line));

    if (isDegree) {
      if (current.degree) {
        education.push(current as Education);
      }
      current = { degree: line };
    } else if (current.degree) {
      if (isLikelyCompany(line) || line.includes('جامعة') || line.includes('كلية')) {
        current.institution = line;
      } else if (isLikelyDate(line)) {
        const dates = extractDates(line);
        current.graduationDate = dates?.end || dates?.start;
      }
    }
  }

  if (current.degree) {
    education.push(current as Education);
  }

  return education;
}

function parseSkills(content: string[]): string[] {
  const skills: string[] = [];

  for (const line of content) {
    const lineSkills = line
      .split(/[,،•\-|]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50);

    skills.push(...lineSkills);
  }

  return [...new Set(skills)];
}

function parseLanguages(content: string[]): Language[] {
  const languages: Language[] = [];

  const levelMap: Record<string, string> = {
    'اللغة الأم': 'Native',
    'ممتاز': 'Fluent',
    'جيد جداً': 'Advanced',
    'جيد': 'Intermediate',
    'متوسط': 'Intermediate',
    'مبتدئ': 'Beginner',
    'native': 'Native',
    'fluent': 'Fluent',
    'advanced': 'Advanced',
    'intermediate': 'Intermediate',
    'beginner': 'Beginner',
  };

  for (const line of content) {
    for (const [levelKey, levelValue] of Object.entries(levelMap)) {
      if (line.toLowerCase().includes(levelKey)) {
        const langName = line.replace(new RegExp(levelKey, 'i'), '').trim();
        if (langName) {
          languages.push({ name: langName, level: levelValue });
        }
        break;
      }
    }
  }

  return languages;
}



