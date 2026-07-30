import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Vision2030Section } from '@/components/Vision2030/Vision2030Section';

vi.mock('@/services/api', () => ({
  analyzeVision2030: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

vi.mock('@/hooks/useUserCredits', () => ({
  useUserCredits: () => ({ credits: 20, isLoading: false, refetch: vi.fn() }),
}));

const resumeText = 'Resume text';

describe('Vision2030Section', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes a cached fractional score before rendering it', () => {
    window.localStorage.setItem('watheq:vision2030Analysis', JSON.stringify({
      resumeHash: resumeText,
      analysis: {
        overallScore: 0.85,
        matchedSkills: [{
          skillNameEn: 'React',
          skillNameAr: 'رياكت',
          sectorId: 'technology',
          sectorNameEn: 'Technology',
          sectorNameAr: 'التقنية',
          matchedKeyword: 'React',
          weight: 8,
          context: 'Built React dashboards for enterprise customers.',
        }],
        missingSuggestions: [],
        sectorBreakdown: [{
          sectorId: 'technology',
          sectorNameEn: 'Technology',
          sectorNameAr: 'التقنية',
          icon: 'technology',
          score: 0.72,
          matchedCount: 0,
          totalSkills: 1,
          suggestedKeywords: [],
        }],
        topSectors: ['technology'],
        allSectorsWithMatches: [],
        detectedCareer: {
          archetypeId: 'technology',
          archetypeNameEn: 'Technology Professional',
          archetypeNameAr: 'متخصص تقني',
          confidence: 'medium',
        },
      },
    }));

    render(<Vision2030Section resumeText={resumeText} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('discards a cached score-only result instead of showing an empty report', () => {
    window.localStorage.setItem('watheq:vision2030Analysis', JSON.stringify({
      resumeHash: resumeText,
      analysis: {
        overallScore: 0.85,
        matchedSkills: [],
        missingSuggestions: [],
        sectorBreakdown: [{
          sectorId: 'technology',
          sectorNameEn: 'Technology',
          sectorNameAr: 'التقنية',
          icon: 'technology',
          score: 0.72,
          matchedCount: 0,
          totalSkills: 1,
          suggestedKeywords: [],
        }],
        topSectors: ['technology'],
        allSectorsWithMatches: [],
        detectedCareer: {
          archetypeId: 'technology',
          archetypeNameEn: 'Technology Professional',
          archetypeNameAr: 'متخصص تقني',
          confidence: 'medium',
        },
      },
    }));

    render(<Vision2030Section resumeText={resumeText} />);

    expect(screen.queryByText('85%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze resume/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('watheq:vision2030Analysis')).toBeNull();
  });
});
