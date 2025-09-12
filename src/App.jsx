import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

function Welcome() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <section className="min-h-screen flex flex-col items-center justify-center text-center gap-6">
      <h1 className="text-4xl font-bold text-primary">AI Resume Optimizer</h1>
      <p className="text-secondary">by Abdullah bin Ahmed</p>

      {user ? (
        <>
          <p>Signed in as {user.email}</p>
          <button
            onClick={() => navigate("/resume")}
            className="btn-primary mt-2"
          >
            Get Started
          </button>
          <button onClick={signOut} className="btn-secondary mt-2">
            Sign Out
          </button>
        </>
      ) : (
        <button onClick={signInWithGoogle} className="btn-primary">
          Sign in with Google
        </button>
      )}
    </section>
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
