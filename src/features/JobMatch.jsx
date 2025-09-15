// src/components/Features/JobMatch.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Lightbulb } from "lucide-react";

export default function JobMatch() {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState("");
  const [result] = useState(null);

  return (
    <div className="flex justify-center items-center h-screen" dir="auto">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Step 2: Paste Job Description
        </h2>
        <label
          htmlFor="job-description"
          className="block mb-2 font-medium text-neutral-700"
        >
          Job Description
        </label>
        <textarea
          id="job-description"
          className="input-base mb-6"
          rows="6"
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
        <button
          onClick={() => navigate("/results")}
          className="btn-primary w-full"
        >
          Next
        </button>

        {result && (
          <div className="mt-6 border border-neutral-200 rounded-2xl p-4 bg-neutral-50">
            <div className="flex items-center mb-2">
              <Gauge className="w-5 h-5 text-primary mr-2" />
              <span className="font-semibold text-gray-700">
                Score: {result.score}
              </span>
            </div>
            <div className="flex items-start">
              <Lightbulb className="w-5 h-5 text-primary mr-2 mt-1" />
              <ul className="list-disc pl-5 text-neutral-700">
                {result.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
