import { render, screen } from '@testing-library/react';
import JobMatch from '../components/Features/JobMatch.jsx';

describe('JobMatch', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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
        onAnalyzeMatch={async () => { }}
        matchAnalysis={match}
        isAnalyzing={false}
        hasResume
      />
    );

    expect(screen.getByRole('heading', { name: /match to a saudi job role/i })).toBeInTheDocument();
    expect(screen.getByText(/missing keywords/i)).toBeInTheDocument();
    expect(screen.getByText(/recognized strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/add react experience/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /score breakdown/i })).toBeInTheDocument();
  });

  it('prefills saved job description text', () => {
    window.localStorage.setItem('airo:lastJobDescription', 'Saved JD');

    render(
      <JobMatch
        onAnalyzeMatch={async () => { }}
        matchAnalysis={null}
        isAnalyzing={false}
        hasResume={false}
      />
    );

    expect(
      screen.getByPlaceholderText(/paste the job description/i)
    ).toHaveValue('Saved JD');
    expect(screen.getByText(/paste a job description to see match insights here/i)).toBeInTheDocument();
  });
});
