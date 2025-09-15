// src/components/Features/JobMatch.jsx
import { useState } from 'react';

export default function JobMatch({ onAnalyzeMatch, matchAnalysis }) {
  const [jobText, setJobText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setError(null);
    setLoading(true);
    try {
      await onAnalyzeMatch(jobText);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Step 2: Paste Job Description</h2>
        <textarea
          className="input-base mb-6 resize-none"
          rows="6"
          placeholder="Paste the job description here..."
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          className="btn-primary w-full disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
        {error && <p className="text-red-600 mt-4">{error}</p>}
        {matchAnalysis && (
          <div className="mt-6 text-left space-y-2">
            <p className="font-medium">Score: {matchAnalysis.score}</p>
            {matchAnalysis.missingKeywords?.length > 0 && (
              <p className="text-sm">Missing Keywords: {matchAnalysis.missingKeywords.join(', ')}</p>
            )}
            {matchAnalysis.suggestions?.length > 0 && (
              <ul className="text-sm list-disc pl-5">
                {matchAnalysis.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
