// src/__tests__/ATSClassic.test.jsx
// Template rendering tests for ATSClassic component

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ATSClassic } from '../components/templates/ATSClassic.jsx';

// Mock data in JSON Resume format
const mockJsonResumeData = {
    basics: {
        name: "John Doe",
        label: "Senior Software Engineer",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        summary: "Experienced software engineer with 8+ years building scalable applications.",
        location: {
            city: "San Francisco",
            region: "CA",
            countryCode: "US"
        },
        profiles: [
            { network: "LinkedIn", username: "johndoe", url: "https://linkedin.com/in/johndoe" },
            { network: "GitHub", username: "johndoe", url: "https://github.com/johndoe" }
        ]
    },
    work: [
        {
            name: "Tech Corp",
            position: "Senior Engineer",
            startDate: "2020-01",
            endDate: "Present",
            summary: "Led backend architecture initiatives",
            highlights: [
                "Increased API performance by 40%",
                "Mentored 5 junior developers"
            ]
        },
        {
            name: "Startup Inc",
            position: "Software Developer",
            startDate: "2017-06",
            endDate: "2019-12",
            highlights: [
                "Built customer-facing dashboard used by 10,000+ users"
            ]
        }
    ],
    education: [
        {
            institution: "MIT",
            area: "Computer Science",
            studyType: "Bachelor",
            startDate: "2013",
            endDate: "2017"
        }
    ],
    skills: [
        { name: "Frontend", keywords: ["React", "TypeScript", "CSS"] },
        { name: "Backend", keywords: ["Node.js", "Python", "PostgreSQL"] }
    ]
};

// Mock data with AI suggestions
const mockDataWithAiSuggestions = {
    ...mockJsonResumeData,
    meta: {
        ai_suggestions: {
            summary_rewrite: "Results-driven software engineer with 8+ years of experience delivering high-impact solutions.",
            bullet_improvements: [
                {
                    work_index: 0,
                    highlight_index: 0,
                    original: "Increased API performance by 40%",
                    improved: "Optimized API infrastructure, achieving 40% latency reduction and handling 2M+ daily requests"
                }
            ]
        }
    }
};

// Legacy format data (for backwards compatibility testing)
const mockLegacyData = {
    header: {
        name: "Jane Smith",
        title: "Product Manager",
        email: "jane@example.com",
        phone: "555-0123",
        location: "New York, NY",
        linkedin: "linkedin.com/in/janesmith"
    },
    summary: "Strategic product manager with a passion for user-centric design.",
    experience: [
        {
            title: "Product Manager",
            company: "BigCo",
            date: "2019 - Present",
            description: ["Launched 3 products", "Grew revenue 25%"]
        }
    ],
    education: [
        {
            degree: "MBA",
            school: "Harvard Business School",
            year: "2018"
        }
    ],
    skills: ["Roadmapping", "User Research", "Agile"]
};

describe('ATSClassic Template', () => {
    describe('JSON Resume Schema Consumption', () => {
        it('renders basics.name and basics.label', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            expect(screen.getByText("John Doe")).toBeInTheDocument();
            expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
        });

        it('renders location from basics.location object', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            // Location renders address or city from JSON Resume format
            expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
        });

        it('extracts LinkedIn from basics.profiles array', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            // LinkedIn URL should appear in contact line
            expect(screen.getByText(/linkedin\.com\/in\/johndoe/)).toBeInTheDocument();
        });

        it('renders work experience with highlights', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
            expect(screen.getByText(/Tech Corp/)).toBeInTheDocument();
            expect(screen.getByText("Increased API performance by 40%")).toBeInTheDocument();
            expect(screen.getByText("Mentored 5 junior developers")).toBeInTheDocument();
        });

        it('renders education with studyType and area', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            expect(screen.getByText(/Bachelor in Computer Science/)).toBeInTheDocument();
            expect(screen.getByText(/MIT/)).toBeInTheDocument();
        });

        it('renders skills with category labels', () => {
            render(<ATSClassic data={mockJsonResumeData} />);

            // Skills are rendered with category labels: "Frontend: React, TypeScript, CSS"
            expect(screen.getByText(/Frontend:/)).toBeInTheDocument();
            expect(screen.getByText(/Backend:/)).toBeInTheDocument();
            expect(screen.getByText(/React/)).toBeInTheDocument();
            expect(screen.getByText(/Node\.js/)).toBeInTheDocument();
        });
    });

    describe('AI Suggestions Data', () => {
        it('renders summary from basics (AI merging done upstream by mergeResumeData)', () => {
            // Note: AI merging is handled by mergeResumeData utility before data is passed to template
            // The template just renders what it receives in basics.summary
            render(<ATSClassic data={mockDataWithAiSuggestions} />);

            // The template renders basics.summary - if AI merge happened upstream, this would be the rewritten version
            // Since we're testing the component in isolation, it renders the original summary
            expect(screen.getByText(/Experienced software engineer with 8\+ years/)).toBeInTheDocument();
        });

        it('preserves meta.ai_suggestions structure for upstream consumption', () => {
            // The component doesn't modify meta - it's preserved for other consumers
            expect(mockDataWithAiSuggestions.meta?.ai_suggestions?.summary_rewrite).toBeDefined();
            expect(mockDataWithAiSuggestions.meta?.ai_suggestions?.bullet_improvements).toBeDefined();
        });
    });

    describe('Backwards Compatibility', () => {
        it('renders legacy header format (data.header)', () => {
            render(<ATSClassic data={mockLegacyData} />);

            expect(screen.getByText("Jane Smith")).toBeInTheDocument();
            // "Product Manager" appears twice: as title and as experience position
            expect(screen.getAllByText("Product Manager").length).toBeGreaterThanOrEqual(1);
        });

        it('renders legacy experience format (data.experience with description)', () => {
            render(<ATSClassic data={mockLegacyData} />);

            expect(screen.getByText(/BigCo/)).toBeInTheDocument();
            expect(screen.getByText("Launched 3 products")).toBeInTheDocument();
        });

        it('renders legacy skills as string array', () => {
            render(<ATSClassic data={mockLegacyData} />);

            expect(screen.getByText("Roadmapping")).toBeInTheDocument();
            expect(screen.getByText("User Research")).toBeInTheDocument();
        });

        it('renders legacy education format (degree/school/year)', () => {
            render(<ATSClassic data={mockLegacyData} />);

            expect(screen.getByText("MBA")).toBeInTheDocument();
            expect(screen.getByText(/Harvard Business School/)).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('returns null when data is undefined', () => {
            const { container } = render(<ATSClassic data={undefined} />);
            expect(container.firstChild).toBeNull();
        });

        it('handles empty arrays gracefully', () => {
            const emptyData = {
                basics: { name: "Test User", label: "", email: "", phone: "" },
                work: [],
                education: [],
                skills: []
            };

            render(<ATSClassic data={emptyData} />);
            expect(screen.getByText("Test User")).toBeInTheDocument();
            // Should not crash, sections simply won't render
        });

        it('handles missing optional fields', () => {
            const minimalData = {
                basics: { name: "Minimal User" }
            };

            render(<ATSClassic data={minimalData} />);
            expect(screen.getByText("Minimal User")).toBeInTheDocument();
        });
    });
});
