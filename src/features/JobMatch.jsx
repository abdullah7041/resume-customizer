// src/components/Features/JobMatch.jsx
/* eslint-disable no-unused-vars */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Lightbulb } from "lucide-react";

export default function JobMatch() {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState("");
  const [result] = useState(null);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Step 2: Paste Job Description
        </h2>
        <label
          htmlFor="job-description"
          className="block mb-2 font-medium text-gray-700"
        >
          Job Description
        </label>
        <textarea
          id="job-description"
          className="mb-6 w-full border rounded p-2"
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
          <div className="mt-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center mb-2">
              <Gauge className="w-5 h-5 text-primary mr-2" />
              <span className="font-semibold text-gray-700">
                Score: {result.score}
              </span>
            </div>
            <div className="flex items-start">
              <Lightbulb className="w-5 h-5 text-primary mr-2 mt-1" />
              <ul className="list-disc pl-5 text-gray-700">
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
