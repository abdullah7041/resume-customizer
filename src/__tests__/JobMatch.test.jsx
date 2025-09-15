import { render, screen } from '@testing-library/react';
import JobMatch from '../components/Features/JobMatch.jsx';

describe('JobMatch', () => {
  it('renders results when provided', () => {
    const match = {
      score: 80,
      missingKeywords: ['React'],
      suggestions: ['Add React experience'],
    };
    render(<JobMatch onAnalyzeMatch={async () => {}} matchAnalysis={match} />);
    expect(
      screen.getByRole('heading', { name: /paste job description/i })
    ).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText(/add react experience/i)).toBeInTheDocument();
  });
});
