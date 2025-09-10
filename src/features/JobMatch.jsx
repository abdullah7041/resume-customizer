// src/components/Features/JobMatch.jsx
import { useNavigate } from "react-router-dom";

export default function JobMatch() {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="card w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Step 2: Paste Job Description
        </h2>
        <textarea
          className="mb-6 w-full border rounded p-2"
          rows="6"
          placeholder="Paste the job description here..."
        />
        <button
          onClick={() => navigate("/results")}
          className="btn btn-primary w-full"
        >
          Next
        </button>
      </div>
    </div>
  );
}
