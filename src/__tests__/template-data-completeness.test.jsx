// src/__tests__/template-data-completeness.test.jsx
// Tests that all templates render all resume data fields consistently

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../hooks/useSectionLabel', () => ({
  useSectionLabel: () => (key) => {
    const labels = {
      summary: 'Summary',
      about: 'About',
      experience: 'Experience',
      workExperience: 'Work Experience',
      education: 'Education',
      skills: 'Skills',
      skillsExpertise: 'Skills & Expertise',
      technicalSkills: 'Technical Skills',
      coreCompetencies: 'Core Competencies',
      projects: 'Projects',
      keyProjects: 'Key Projects',
      certifications: 'Certifications',
      certificationsTraining: 'Certifications & Training',
      languages: 'Languages',
    };
    return labels[key] || key;
  },
}));

vi.mock('../components/providers/DirectionProvider', () => ({
  useDirection: () => ({ isRTL: false, direction: 'ltr' }),
  DirectionProvider: ({ children }) => children,
}));

import { ModernProfessional } from '../components/templates/ModernProfessional';
import { ClassicTraditional } from '../components/templates/ClassicTraditional';
import { TechnicalEngineer } from '../components/templates/TechnicalEngineer';
import { ATSOptimized } from '../components/templates/ATSOptimized';

// Full resume fixture with ALL fields populated
const fullResume = {
  basics: {
    name: 'Test Engineer',
    label: 'Senior Developer',
    email: 'test@example.com',
    phone: '+1234567890',
    summary: 'Experienced developer with 10 years in software engineering.',
    url: 'https://portfolio.example.com',
    location: {
      city: 'Riyadh',
      region: 'Riyadh Province',
      countryCode: 'SA',
    },
    profiles: [
      { network: 'LinkedIn', url: 'https://linkedin.com/in/test' },
    ],
  },
  work: [
    {
      name: 'TechCorp',
      position: 'Senior Developer',
      location: 'Jeddah, Saudi Arabia',
      startDate: '2020-01',
      endDate: 'Present',
      highlights: ['Led team of 5 developers', 'Improved performance by 40%'],
    },
  ],
  education: [
    {
      institution: 'King Saud University',
      studyType: 'Bachelor of Science',
      area: 'Computer Science',
      startDate: '2012',
      endDate: '2016',
      score: '3.8',
      highlights: ['Dean\'s List 2015', 'Graduated with honors'],
    },
  ],
  skills: [
    { name: 'JavaScript', keywords: ['React', 'Node.js'] },
    { name: 'Python', keywords: ['Django'] },
  ],
  projects: [
    {
      name: 'E-Commerce Platform',
      description: 'Built a full-stack e-commerce platform serving 10k users.',
      highlights: ['Implemented payment gateway', 'Reduced load time by 60%'],
    },
  ],
  certificates: [
    {
      name: 'AWS Solutions Architect',
      issuer: 'Amazon Web Services',
      date: '2023-06',
    },
  ],
  languages: [
    { language: 'Arabic', fluency: 'Native' },
    { language: 'English', fluency: 'Fluent' },
  ],
};

beforeAll(() => {
  // Mock matchMedia for any responsive behavior
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

const templates = [
  { name: 'ModernProfessional', Component: ModernProfessional },
  { name: 'ClassicTraditional', Component: ClassicTraditional },
  { name: 'TechnicalEngineer', Component: TechnicalEngineer },
  { name: 'ATSOptimized', Component: ATSOptimized },
];

describe('Template Data Completeness', () => {
  templates.forEach(({ name, Component }) => {
    describe(`${name} template`, () => {
      it('renders work.location', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain('Jeddah');
      });

      it('renders project.description', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain('full-stack e-commerce platform');
      });

      it('renders education.highlights', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain("Dean's List");
      });

      it('renders certificates issuer', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain('Amazon Web Services');
      });

      it('renders certificates date', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain('2023-06');
      });

      it('renders basics.location.region', () => {
        const { container } = render(<Component resume={fullResume} />);
        const html = container.innerHTML;
        expect(html).toContain('Riyadh Province');
      });
    });
  });
});
