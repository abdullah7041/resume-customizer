// src/components/MainContent.jsx
import React, { useState, useCallback } from 'react';
import { FileText, Target, Sparkles, Loader2, Check, X, AlertCircle, LogIn, ChevronRight } from 'lucide-react';

// FIXED: All paths are now corrected to match your file structure.
import { parseResume, analyzeResume } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import ResumeUpload from '../features/ResumeUpload.jsx';
import JobMatch from './Features/JobMatch.jsx';
import Optimization from '../features/Optimization.jsx';

// --- Reusable UI Components ---
const ProgressBar = ({ progress }) => (
  <div
    className="h-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full overflow-hidden"
    role="progressbar"
    aria-valuenow={progress}
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500"
      style={{ width: `${progress}%` }}
    />
  </div>
);

const LoadingOverlay = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-4">
      <Loader2 className="w-12 h-12 text-purple-600 animate-spin motion-reduce:animate-none" />
      <p className="text-gray-700 font-medium">{message}</p>
    </div>
  </div>
);

const Notification = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' };
  const icon = { success: <Check />, error: <X />, info: <AlertCircle /> };
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 right-4 ${colors[type]} text-white px-6 py-4 rounded-xl shadow-xl z-50 flex items-center space-x-3`}
    >
      {icon[type]} <span>{message}</span>
    </div>
  );
};

const TabButton = ({ active, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className={`relative px-6 py-4 font-semibold transition-all duration-300 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? 'text-purple-700 bg-white/90 shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
  >
    <div className="flex items-center justify-center space-x-2">
      {icon}
      <span>{children}</span>
    </div>
    {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-600" />}
  </button>
);

const AuthScreen = ({ onLogin }) => (
    <div className="text-center p-8 md:p-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome!</h2>
        <p className="text-gray-600 mb-8 text-lg">Sign in to begin optimizing your resume.</p>
        <button
            onClick={onLogin}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center space-x-3 text-lg"
        >
            <LogIn className="w-5 h-5" />
            <span>Sign In with Google</span>
            <ChevronRight className="w-5 h-5" />
        </button>
    </div>
);


export default function MainContent() { 
   const { user, isPremium, signInWithGoogle } = useAuth();
   const [activeTab, setActiveTab] = useState('resume'); 
   const [progress, setProgress] = useState(0); 
   const [loading, setLoading] = useState(false); 
   const [loadingMessage, setLoadingMessage] = useState(''); 
   const [notification, setNotification] = useState(null); 
   const [resumeData, setResumeData] = useState(null); 
   const [matchAnalysis, setMatchAnalysis] = useState(null); 
   const [optimizations] = useState([]);
   const showNotification = useCallback((message, type = 'info') => { setNotification({ message, type }); }, []);
   const handleParseResume = useCallback(async (resumeInput) => { setLoading(true); setLoadingMessage('AI is parsing your resume...'); setProgress(15); try { const content = typeof resumeInput === 'string' ? resumeInput : await resumeInput.text(); const parsed = await parseResume(content); setResumeData(parsed); setProgress(35); showNotification('Resume parsed successfully!', 'success'); setActiveTab('job'); } catch (error) { showNotification(`Parsing failed: ${error.message}`, 'error'); } finally { setLoading(false); } }, [showNotification]);
   const handleAnalyzeMatch = useCallback(async (jobDescription) => { if (!resumeData) { throw new Error('Please parse a resume first.'); } const result = await analyzeResume(resumeData, jobDescription); setMatchAnalysis(result); return result; }, [resumeData]); 
  return (
    <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden">
      {loading && <LoadingOverlay message={loadingMessage} />}
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      {!user ? ( <AuthScreen onLogin={signInWithGoogle} /> ) : (
        <>
          <div className="px-8 py-4"> <ProgressBar progress={progress} /> </div>
          <div className="grid grid-cols-1 md:grid-cols-3 bg-gray-50/90 border-b border-gray-200">
            <TabButton active={activeTab === 'resume'} onClick={() => setActiveTab('resume')} icon={<FileText />}>Resume</TabButton>
            <TabButton active={activeTab === 'job'} onClick={() => setActiveTab('job')} icon={<Target />}>Match</TabButton>
            <TabButton active={activeTab === 'optimize'} onClick={() => setActiveTab('optimize')} icon={<Sparkles />}>Optimize</TabButton>
          </div>
          <div className="p-8 min-h-[500px]">
            {activeTab === 'resume' && <ResumeUpload onParseResume={handleParseResume} resumeData={resumeData} />} 
            {activeTab === 'job' && <JobMatch onAnalyzeMatch={handleAnalyzeMatch} matchAnalysis={matchAnalysis} />} 
            {activeTab === 'optimize' && <Optimization isPremium={isPremium} optimizations={optimizations} />}
          </div>
        </>
      )}
    </div>
  );
}

