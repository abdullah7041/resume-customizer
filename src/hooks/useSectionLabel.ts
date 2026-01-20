// src/hooks/useSectionLabel.ts
// Hook for getting section labels based on resume content language (not UI language)

import { useResumeStore } from '../lib/stores/resumeStore';

/**
 * English section labels for resume templates
 */
const EN_SECTIONS: Record<string, string> = {
    about: 'About',
    summary: 'Professional Summary',
    experience: 'Experience',
    workExperience: 'Professional Experience',
    projects: 'Projects',
    keyProjects: 'Key Projects',
    education: 'Education',
    skills: 'Skills',
    skillsExpertise: 'Skills & Expertise',
    technicalSkills: 'Technical Skills',
    coreCompetencies: 'Core Competencies',
    languages: 'Languages',
    certificates: 'Certificates',
    certifications: 'Certifications',
    certificationsTraining: 'Certifications & Training',
};

/**
 * Arabic section labels for resume templates
 */
const AR_SECTIONS: Record<string, string> = {
    about: 'نبذة عني',
    summary: 'الملخص المهني',
    experience: 'الخبرة',
    workExperience: 'الخبرة المهنية',
    projects: 'المشاريع',
    keyProjects: 'المشاريع الرئيسية',
    education: 'التعليم',
    skills: 'المهارات',
    skillsExpertise: 'المهارات والخبرات',
    technicalSkills: 'المهارات التقنية',
    coreCompetencies: 'الكفاءات الأساسية',
    languages: 'اللغات',
    certificates: 'الشهادات',
    certifications: 'الشهادات',
    certificationsTraining: 'الشهادات والتدريب',
};

/**
 * Hook that returns section labels based on resume content language
 * Uses content language detection (not UI language) to match section headers
 * with the actual resume content language
 * 
 * @returns Function to get section label by key
 */
export function useSectionLabel() {
    const contentLanguage = useResumeStore((s) => s.contentLanguage);

    /**
     * Get section label based on detected content language
     * Falls back to English for null, mixed, or unknown languages
     */
    const getSectionLabel = (sectionKey: string): string => {
        const useArabic = contentLanguage === 'ar';
        const sections = useArabic ? AR_SECTIONS : EN_SECTIONS;
        return sections[sectionKey] ?? EN_SECTIONS[sectionKey] ?? sectionKey;
    };

    return getSectionLabel;
}
