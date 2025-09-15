import { useState } from 'react';

const ScoreDisplay = ({ score }) => {
  const color =
    score >= 85
      ? 'from-green-500 to-emerald-600'
      : score >= 70
      ? 'from-yellow-500 to-orange-600'
      : 'from-red-500 to-rose-600';
  return (
    <div className={`bg-gradient-to-br ${color} text-white p-6 rounded-xl text-center`}>
      <p className="text-4xl font-bold">{score}</p>
      <p className="text-sm opacity-90">Match Score</p>
    </div>
  );
};

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
      <div className="card w-full max-w-xl space-y-4">
        <h2 className="text-2xl font-semibold text-center text-primary">
          Paste Job Description
        </h2>
        <textarea
          className="input-base h-48 resize-none"
          placeholder="Paste the job description here..."
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          className="btn-primary w-full disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Analyzing…' : 'Analyze Match'}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {matchAnalysis && (
          <div className="space-y-4">
            <ScoreDisplay score={matchAnalysis.score} />
            {matchAnalysis.missingKeywords?.length > 0 && (
              <div>
                <h3 className="font-medium text-neutral-700 mb-1">
                  Missing Keywords
                </h3>
                <p className="text-sm text-neutral-600">
                  {matchAnalysis.missingKeywords.join(', ')}
                </p>
              </div>
            )}
            {matchAnalysis.suggestions?.length > 0 && (
              <div>
                <h3 className="font-medium text-neutral-700 mb-1">Suggestions</h3>
                <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
                  {matchAnalysis.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
