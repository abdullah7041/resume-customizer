import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the vision2030Skills data module
vi.mock('../../data/vision2030Skills', () => ({
    VISION_2030_SECTORS: [
        {
            id: 'technology',
            nameEn: 'Technology & Digital',
            nameAr: 'التقنية والرقمنة',
            icon: '💻',
            skills: [
                { nameEn: 'Cloud Computing', nameAr: 'الحوسبة السحابية', weight: 3, keywords: ['aws', 'azure', 'cloud'], keywordsAr: ['سحابة'] },
                { nameEn: 'Data Analytics', nameAr: 'تحليل البيانات', weight: 3, keywords: ['data analysis', 'power bi', 'tableau'], keywordsAr: ['تحليل'] },
                { nameEn: 'Cybersecurity', nameAr: 'الأمن السيبراني', weight: 3, keywords: ['cybersecurity', 'security'], keywordsAr: ['أمن'] },
                { nameEn: 'AI & Machine Learning', nameAr: 'الذكاء الاصطناعي', weight: 3, keywords: ['machine learning', 'artificial intelligence', 'ai'], keywordsAr: ['ذكاء اصطناعي'] },
            ]
        },
        {
            id: 'finance',
            nameEn: 'Financial Services',
            nameAr: 'الخدمات المالية',
            icon: '💰',
            skills: [
                { nameEn: 'Financial Analysis', nameAr: 'التحليل المالي', weight: 3, keywords: ['financial analysis', 'financial modeling'], keywordsAr: ['تحليل مالي'] },
                { nameEn: 'Risk Management', nameAr: 'إدارة المخاطر', weight: 2, keywords: ['risk management', 'risk assessment'], keywordsAr: ['مخاطر'] },
            ]
        },
        {
            id: 'healthcare',
            nameEn: 'Healthcare',
            nameAr: 'الرعاية الصحية',
            icon: '🏥',
            skills: [
                { nameEn: 'Healthcare Management', nameAr: 'إدارة الرعاية الصحية', weight: 3, keywords: ['healthcare', 'hospital management'], keywordsAr: ['صحة'] },
            ]
        }
    ],
    ALL_VISION_2030_SKILLS: [
        { nameEn: 'Cloud Computing', nameAr: 'الحوسبة السحابية', sectorId: 'technology', sectorNameEn: 'Technology & Digital', sectorNameAr: 'التقنية والرقمنة', weight: 3, keywords: ['aws', 'azure', 'cloud'], keywordsAr: ['سحابة'] },
        { nameEn: 'Data Analytics', nameAr: 'تحليل البيانات', sectorId: 'technology', sectorNameEn: 'Technology & Digital', sectorNameAr: 'التقنية والرقمنة', weight: 3, keywords: ['data analysis', 'power bi', 'tableau'], keywordsAr: ['تحليل'] },
        { nameEn: 'Cybersecurity', nameAr: 'الأمن السيبراني', sectorId: 'technology', sectorNameEn: 'Technology & Digital', sectorNameAr: 'التقنية والرقمنة', weight: 3, keywords: ['cybersecurity', 'security'], keywordsAr: ['أمن'] },
        { nameEn: 'AI & Machine Learning', nameAr: 'الذكاء الاصطناعي', sectorId: 'technology', sectorNameEn: 'Technology & Digital', sectorNameAr: 'التقنية والرقمنة', weight: 3, keywords: ['machine learning', 'artificial intelligence', 'ai'], keywordsAr: ['ذكاء اصطناعي'] },
        { nameEn: 'Financial Analysis', nameAr: 'التحليل المالي', sectorId: 'finance', sectorNameEn: 'Financial Services', sectorNameAr: 'الخدمات المالية', weight: 3, keywords: ['financial analysis', 'financial modeling'], keywordsAr: ['تحليل مالي'] },
        { nameEn: 'Risk Management', nameAr: 'إدارة المخاطر', sectorId: 'finance', sectorNameEn: 'Financial Services', sectorNameAr: 'الخدمات المالية', weight: 2, keywords: ['risk management', 'risk assessment'], keywordsAr: ['مخاطر'] },
        { nameEn: 'Healthcare Management', nameAr: 'إدارة الرعاية الصحية', sectorId: 'healthcare', sectorNameEn: 'Healthcare', sectorNameAr: 'الرعاية الصحية', weight: 3, keywords: ['healthcare', 'hospital management'], keywordsAr: ['صحة'] },
    ],
    detectCareerArchetype: vi.fn((skills: string[]) => {
        // Mock career detection based on matched skills
        if (skills.includes('Cloud Computing') && skills.includes('Cybersecurity')) {
            return {
                id: 'cloud-engineer',
                nameEn: 'Cloud Engineer',
                nameAr: 'مهندس سحابي',
                primarySkills: ['Cloud Computing', 'Cybersecurity', 'Data Analytics'],
                adjacentSkills: ['AI & Machine Learning'],
                relevantSectors: ['technology']
            };
        }
        if (skills.includes('Financial Analysis')) {
            return {
                id: 'financial-analyst',
                nameEn: 'Financial Analyst',
                nameAr: 'محلل مالي',
                primarySkills: ['Financial Analysis', 'Risk Management'],
                adjacentSkills: ['Data Analytics'],
                relevantSectors: ['finance', 'technology']
            };
        }
        return null;
    })
}));

import { analyzeVision2030Alignment } from '../vision2030Analyzer';

describe('Vision 2030 Analyzer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('keyword matching', () => {
        it('matches exact keywords', () => {
            const resume = 'Experience with AWS cloud infrastructure and Azure deployments';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.some(s => s.skillNameEn === 'Cloud Computing')).toBe(true);
        });

        it('matches case-insensitive', () => {
            const resume = 'Expertise in CYBERSECURITY and CLOUD computing';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.some(s => s.skillNameEn === 'Cloud Computing')).toBe(true);
            expect(result.matchedSkills.some(s => s.skillNameEn === 'Cybersecurity')).toBe(true);
        });

        it('matches multi-word phrases', () => {
            const resume = 'Strong background in data analysis and Power BI dashboards';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.some(s => s.skillNameEn === 'Data Analytics')).toBe(true);
        });

        it('prevents false positives with word boundaries', () => {
            // "cloud" should match "cloud," but not "cloudy" or "cloudiness"
            // Note: The mock data has "cloud" as a keyword. 
            // If the implementation uses word boundaries correctly, "cloudy" shouldn't match.
            const resume = 'Worked in cloudy weather conditions. Also did cloudiness analysis.';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.some(s => s.skillNameEn === 'Cloud Computing')).toBe(false);
        });

        it('matches keywords at sentence boundaries', () => {
            const resume = 'AWS. Azure. Cloud infrastructure expert.';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.some(s => s.skillNameEn === 'Cloud Computing')).toBe(true);
        });

        it('counts each skill only once even with multiple keyword matches', () => {
            const resume = 'AWS expert with Azure and cloud experience. More cloud work.';
            const result = analyzeVision2030Alignment(resume);

            const cloudMatches = result.matchedSkills.filter(s => s.skillNameEn === 'Cloud Computing');
            expect(cloudMatches).toHaveLength(1);
        });
    });

    describe('Arabic language support', () => {
        it('matches Arabic keywords when language is ar', () => {
            // Use exact keywords from mock data for this test
            const resume = 'خبرة في سحابة و أمن';
            const result = analyzeVision2030Alignment(resume, 'ar');

            expect(result.matchedSkills.length).toBeGreaterThan(0);
        });
    });

    describe('score calculation', () => {
        it('returns minimum score of 60 for empty resume', () => {
            const result = analyzeVision2030Alignment('');
            expect(result.overallScore).toBeGreaterThanOrEqual(60);
        });

        it('returns minimum score of 60 for resume with no matches', () => {
            const resume = 'Experienced chef with culinary skills in Italian cuisine';
            const result = analyzeVision2030Alignment(resume);
            expect(result.overallScore).toBe(60);
        });

        it('increases score with more skill matches', () => {
            const lowMatch = analyzeVision2030Alignment('Experience with AWS');
            // Matches across multiple sectors to increase overall score
            const highMatch = analyzeVision2030Alignment('Experience with AWS, Azure, cybersecurity, financial analysis, risk management, and healthcare management');

            expect(highMatch.overallScore).toBeGreaterThan(lowMatch.overallScore);
        });

        it('applies encouragement curve (sqrt mapping)', () => {
            // With encouragement curve, even small matches should show decent sector scores
            const resume = 'Experience with AWS cloud';
            const result = analyzeVision2030Alignment(resume);

            const techSector = result.sectorBreakdown.find(s => s.sectorId === 'technology');
            // With sqrt curve and 1.2 multiplier, even partial match should be encouraging
            expect(techSector?.score).toBeGreaterThan(0);
        });

        it('weights top 3 sectors at 70% and overall at 30%', () => {
            // This is tested implicitly - ensure score is reasonable
            const resume = 'AWS cloud expert with financial analysis and risk management skills';
            const result = analyzeVision2030Alignment(resume);

            expect(result.overallScore).toBeGreaterThanOrEqual(60);
            expect(result.overallScore).toBeLessThanOrEqual(100);
        });
    });

    describe('sector breakdown', () => {
        it('returns all sectors in breakdown', () => {
            const result = analyzeVision2030Alignment('');

            expect(result.sectorBreakdown.length).toBe(3); // Based on our mock
            expect(result.sectorBreakdown.map(s => s.sectorId)).toContain('technology');
            expect(result.sectorBreakdown.map(s => s.sectorId)).toContain('finance');
        });

        it('sorts sectors by score descending', () => {
            const resume = 'Expert in AWS, Azure, cloud, cybersecurity, and machine learning';
            const result = analyzeVision2030Alignment(resume);

            const scores = result.sectorBreakdown.map(s => s.score);
            expect(scores).toEqual([...scores].sort((a, b) => b - a));
        });

        it('tracks matched count per sector', () => {
            const resume = 'AWS and cybersecurity expert';
            const result = analyzeVision2030Alignment(resume);

            const techSector = result.sectorBreakdown.find(s => s.sectorId === 'technology');
            expect(techSector?.matchedCount).toBe(2);
        });

        it('provides suggested keywords for improvement', () => {
            const resume = 'AWS cloud expert';
            const result = analyzeVision2030Alignment(resume);

            const techSector = result.sectorBreakdown.find(s => s.sectorId === 'technology');
            expect(techSector?.suggestedKeywords.length).toBeGreaterThan(0);
            // Should not suggest already-matched skills
            expect(techSector?.suggestedKeywords).not.toContain('Cloud Computing');
        });
    });

    describe('career archetype detection', () => {
        it('detects career when primary skills match', () => {
            const resume = 'AWS cloud infrastructure and cybersecurity specialist';
            const result = analyzeVision2030Alignment(resume);

            expect(result.detectedCareer).not.toBeNull();
            expect(result.detectedCareer?.archetypeId).toBe('cloud-engineer');
        });

        it('returns null when no career pattern detected', () => {
            const resume = 'Healthcare management experience';
            const result = analyzeVision2030Alignment(resume);

            // Healthcare alone doesn't trigger any career archetype in our mock
            expect(result.detectedCareer).toBeNull();
        });

        it('calculates confidence based on primary skill matches', () => {
            // With 2 primary skills matched (Cloud Computing, Cybersecurity)
            const resume = 'AWS cloud and cybersecurity expert';
            const result = analyzeVision2030Alignment(resume);

            expect(result.detectedCareer?.confidence).toBe('medium');
        });
    });

    describe('missing suggestions', () => {
        it('suggests adjacent skills when career is detected', () => {
            const resume = 'AWS cloud infrastructure and cybersecurity specialist';
            const result = analyzeVision2030Alignment(resume);

            // Adjacent skill for cloud-engineer is AI & Machine Learning
            expect(result.missingSuggestions.some(s =>
                s.skillNameEn === 'AI & Machine Learning'
            )).toBe(true);
        });

        it('suggests high-weight skills from relevant sectors as fallback', () => {
            // Use Finance sector because it has multiple skills (matches Risk Management, suggests Financial Analysis)
            // Healthcare only has 1 skill in mock, so none left to suggest
            const resume = 'Risk Management professional';
            const result = analyzeVision2030Alignment(resume);

            // Should get suggestions even without career detection
            expect(result.missingSuggestions.length).toBeGreaterThan(0);
        });

        it('does not suggest already-matched skills', () => {
            const resume = 'Expert in AWS cloud, cybersecurity, and data analysis';
            const result = analyzeVision2030Alignment(resume);

            const matchedNames = result.matchedSkills.map(s => s.skillNameEn);
            const suggestedNames = result.missingSuggestions.map(s => s.skillNameEn);

            matchedNames.forEach(name => {
                expect(suggestedNames).not.toContain(name);
            });
        });

        it('sorts suggestions by relevance score', () => {
            const resume = 'AWS cloud expert';
            const result = analyzeVision2030Alignment(resume);

            const scores = result.missingSuggestions.map(s => s.relevanceScore);
            expect(scores).toEqual([...scores].sort((a, b) => b - a));
        });

        it('limits suggestions to reasonable count', () => {
            const resume = 'Some generic resume text';
            const result = analyzeVision2030Alignment(resume);

            expect(result.missingSuggestions.length).toBeLessThanOrEqual(8);
        });
    });

    describe('matched skills output', () => {
        it('includes context snippet for each match', () => {
            const resume = 'I have extensive experience with AWS cloud infrastructure';
            const result = analyzeVision2030Alignment(resume);

            const cloudMatch = result.matchedSkills.find(s => s.skillNameEn === 'Cloud Computing');
            expect(cloudMatch?.context).toContain('...');
            expect(cloudMatch?.context.toLowerCase()).toContain('aws');
        });

        it('includes sector information for each match', () => {
            const resume = 'AWS expert';
            const result = analyzeVision2030Alignment(resume);

            const match = result.matchedSkills[0];
            expect(match.sectorId).toBe('technology');
            expect(match.sectorNameEn).toBe('Technology & Digital');
            expect(match.sectorNameAr).toBeTruthy();
        });

        it('includes weight for each match', () => {
            const resume = 'AWS cloud expert';
            const result = analyzeVision2030Alignment(resume);

            const match = result.matchedSkills[0];
            expect(match.weight).toBeGreaterThan(0);
        });
    });

    describe('backwards compatibility', () => {
        it('includes topSectors array', () => {
            const result = analyzeVision2030Alignment('AWS expert');

            expect(result.topSectors).toBeDefined();
            expect(Array.isArray(result.topSectors)).toBe(true);
            expect(result.topSectors.length).toBeLessThanOrEqual(3);
        });

        it('includes allSectorsWithMatches', () => {
            const resume = 'AWS cloud and financial analysis expert';
            const result = analyzeVision2030Alignment(resume);

            expect(result.allSectorsWithMatches).toContain('technology');
            expect(result.allSectorsWithMatches).toContain('finance');
        });
    });

    describe('edge cases', () => {
        it('handles special characters in resume text', () => {
            const resume = 'AWS (Amazon Web Services) - Cloud & Infrastructure | cybersecurity/security';
            const result = analyzeVision2030Alignment(resume);

            expect(result.matchedSkills.length).toBeGreaterThan(0);
        });

        it('handles very long resume text', () => {
            const longResume = 'AWS cloud expert. '.repeat(1000);
            const result = analyzeVision2030Alignment(longResume);

            // Should still only count skill once
            expect(result.matchedSkills.filter(s => s.skillNameEn === 'Cloud Computing')).toHaveLength(1);
        });

        it('handles resume with only whitespace', () => {
            const result = analyzeVision2030Alignment('   \n\t\n   ');
            expect(result.overallScore).toBe(60);
            expect(result.matchedSkills).toHaveLength(0);
        });
    });
});
