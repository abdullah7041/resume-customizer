import { render, screen } from '@testing-library/react';
import JobMatch from '../components/Features/JobMatch.jsx';

describe('JobMatch', () => {
  it('renders analysis results with Saudi styling', () => {
    const match = {
      score: 80,
      missingKeywords: ['React'],
      suggestions: ['Add React experience'],
    };
    render(
      <JobMatch
        onAnalyzeMatch={async () => {}}
        matchAnalysis={match}
        isAnalyzing={false}
      />
    );
    expect(
      screen.getByRole('heading', { name: /match to a saudi job role/i })
    ).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(
      screen.getByText(/add react experience/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/missing keywords/i)).toBeInTheDocument();
  });
});
