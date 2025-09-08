import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

function Welcome() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col justify-center items-center bg-white">
      <h1 className="text-3xl font-bold mb-6 text-[#006C35]">
        Welcome to Resume Optimizer
      </h1>
      <p className="mb-6 text-gray-600">by Abdullah bin Ahmed</p>

      {user ? (
        <>
          <p className="mb-4">Signed in as {user.email}</p>
          <button onClick={() => navigate("/resume")} className="px-6 py-2 rounded bg-[#006C35] text-white">
            Get Started
          </button>
          <button onClick={signOut} className="mt-2 text-red-500">
            Sign Out
          </button>
        </>
      ) : (
        <button onClick={signInWithGoogle} className="px-6 py-2 rounded bg-[#006C35] text-white">
          Sign in with Google
        </button>
      )}
    </div>
  );
}

// keep ResumeUpload, JobUpload, Results same as before

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/resume" element={<div>Resume Upload Page</div>} />
      <Route path="/job" element={<div>Job Upload Page</div>} />
      <Route path="/results" element={<div>Results Page</div>} />
    </Routes>
  );
}
