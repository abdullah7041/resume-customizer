import { render, screen } from '@testing-library/react';
import JobMatch from '../components/Features/JobMatch.jsx';

describe('JobMatch', () => {
  it('renders analysis results with Saudi styling', () => {
    const match = {
      score: 80,
      missingKeywords: ['React'],
      suggestions: ['Add React experience'],
      topHits: ['Leadership'],
      coverage: 0.52,
      cosine: 0.71,
    };
    render(
      <JobMatch
        onAnalyzeMatch={async () => {}}
        matchAnalysis={match}
        isAnalyzing={false}
        hasResume
      />
    );

    expect(screen.getByRole('heading', { name: /match to a saudi job role/i })).toBeInTheDocument();
    expect(screen.getByText(/top missing keywords/i)).toBeInTheDocument();
    expect(screen.getByText(/recognized strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/add react experience/i)).toBeInTheDocument();
  });
});
