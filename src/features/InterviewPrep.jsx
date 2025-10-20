// src/features/InterviewPrep.jsx
// Interview question predictor and preparation tool

import { useState, useCallback } from "react";
import { MessageSquare, Lightbulb, Star, Save, Download, RefreshCw, AlertCircle } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/cn.js";

const FUNCTION_BASE_PATH = "/.netlify/functions";
const PREDICT_ENDPOINT = `${FUNCTION_BASE_PATH}/predict-questions`;
const STORAGE_KEY = "airo:interviewQuestions";

const QuestionTypeIcon = ({ type }) => {
  const icons = {
    technical: "💻",
    behavioral: "🤝",
    situational: "🎯",
    "case-study": "📊"
  };
  return <span className="text-xl">{icons[type] || "❓"}</span>;
};

const DifficultyBadge = ({ difficulty }) => {
  const colors = {
    easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", colors[difficulty] || colors.medium)}>
      {difficulty}
    </span>
  );
};

const QuestionCard = ({ question, index, onSaveAnswer }) => {
  const [showFramework, setShowFramework] = useState(false);
  const [answer, setAnswer] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  
  const handleSave = () => {
    onSaveAnswer(index, answer);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };
  
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <QuestionTypeIcon type={question.type} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
              {index + 1}. {question.question}
            </h3>
            <DifficultyBadge difficulty={question.difficulty} />
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs font-medium">
              {question.type}
            </span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
              {question.category}
            </span>
          </div>
          
          {/* Answer Framework */}
          {question.answerFramework && (
            <div className="mb-4">
              <button
                onClick={() => setShowFramework(!showFramework)}
                className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Lightbulb className="w-4 h-4" />
                {showFramework ? "Hide" : "Show"} Answer Framework
              </button>
              
              {showFramework && (
                <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {question.answerFramework}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Practice Answer */}
          <div className="space-y-2">
            <label htmlFor="practice-answer" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Practice Your Answer
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       resize-none"
              rows={4}
              id="practice-answer"
              name="practice-answer"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                variant={isSaved ? "primary" : "outline"}
                size="sm"
                disabled={!answer.trim()}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaved ? "Saved!" : "Save Answer"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const RoleInsights = ({ roleLevel, focusAreas }) => {
  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interview Insights</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Role Level</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 capitalize">
            {roleLevel}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Focus Areas</p>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area, idx) => (
              <span 
                key={idx}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function InterviewPrep({ jobDescription, resumeText }) {
  const [questions, setQuestions] = useState([]);
  const [roleLevel, setRoleLevel] = useState("");
  const [focusAreas, setFocusAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedAnswers, setSavedAnswers] = useState({});
  
  const predictQuestions = useCallback(async () => {
    if (!jobDescription) {
      setError("Please provide a job description first");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(PREDICT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          resumeText: resumeText || ""
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to predict questions: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setQuestions(data.questions || []);
      setRoleLevel(data.roleLevel || "mid");
      setFocusAreas(data.focusAreas || []);
      
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Error predicting questions:", err);
      setError(err.message || "Failed to generate interview questions");
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeText]);
  
  const handleSaveAnswer = useCallback((questionIndex, answer) => {
    setSavedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
    
    // Persist to localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          data.savedAnswers = { ...savedAnswers, [questionIndex]: answer };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
          console.error("Failed to save answer:", e);
        }
      }
    }
  }, [savedAnswers]);
  
  const exportQuestions = () => {
    const exportData = {
      questions,
      roleLevel,
      focusAreas,
      savedAnswers,
      jobDescription: jobDescription.substring(0, 200),
      generatedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview-questions-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  if (!jobDescription) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <EmptyState
          icon={MessageSquare}
          title="No Job Description"
          description="Add a job description in the Match tab to generate likely interview questions."
        />
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Interview Preparation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-predicted interview questions based on the job description
          </p>
        </div>
        
        <div className="flex gap-2">
          {questions.length > 0 && (
            <Button onClick={exportQuestions} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
          <Button 
            onClick={predictQuestions} 
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                {questions.length > 0 ? "Regenerate" : "Generate Questions"}
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Analyzing job description and predicting interview questions...
            </p>
          </div>
        </Card>
      )}
      
      {/* Results */}
      {!isLoading && questions.length > 0 && (
        <>
          {/* Role Insights */}
          <RoleInsights roleLevel={roleLevel} focusAreas={focusAreas} />
          
          {/* Questions List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Predicted Questions ({questions.length})
            </h2>
            
            {questions.map((question, index) => (
              <QuestionCard
                key={index}
                question={question}
                index={index}
                onSaveAnswer={handleSaveAnswer}
              />
            ))}
          </div>
        </>
      )}
      
      {/* Empty State */}
      {!isLoading && questions.length === 0 && !error && (
        <EmptyState
          icon={MessageSquare}
          title="No Questions Generated Yet"
          description="Click 'Generate Questions' to get AI-predicted interview questions for this role."
        />
      )}
    </div>
  );
}
