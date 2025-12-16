// src/features/InterviewPrep.jsx
// Interview question predictor and preparation tool

import { useState, useCallback, useEffect } from "react";
import { MessageSquare, Lightbulb, Star, Save, RefreshCw, AlertCircle, Sparkles, Monitor, Users, Target, BarChart3, HelpCircle, FileSpreadsheet } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/utils/cn.ts";

const FUNCTION_BASE_PATH = "/.netlify/functions";
const PREDICT_ENDPOINT = `${FUNCTION_BASE_PATH}/predict-questions`;
const STORAGE_KEY = "airo:interviewQuestions";

const QuestionTypeIcon = ({ type }) => {
  const iconClass = "w-6 h-6 text-emerald-600 dark:text-emerald-400";
  const icons = {
    technical: <Monitor className={iconClass} />,
    behavioral: <Users className={iconClass} />,
    situational: <Target className={iconClass} />,
    "case-study": <BarChart3 className={iconClass} />,
    general: <HelpCircle className={iconClass} />
  };
  return <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">{icons[type] || icons.general}</span>;
};

const DifficultyBadge = ({ difficulty }) => {
  const colors = {
    easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
  };

  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", colors[difficulty] || colors.medium)}>
      {difficulty || "medium"}
    </span>
  );
};

/**
 * Normalize question data - handles both string questions and structured objects
 */
const normalizeQuestion = (question, index) => {
  // If it's already a structured object
  if (typeof question === "object" && question !== null) {
    return {
      question: question.question || question.text || `Question ${index + 1}`,
      type: question.type || "general",
      difficulty: question.difficulty || "medium",
      category: question.category || "General",
      answerFramework: question.answerFramework || question.answer_framework || ""
    };
  }

  // If it's a string, convert to structured format
  if (typeof question === "string" && question.trim()) {
    // Try to infer type from question content
    const lowerQ = question.toLowerCase();
    let type = "general";

    // Distribute difficulty based on index for variety (40% easy, 35% medium, 25% hard)
    const difficultyDistribution = ["easy", "medium", "hard", "easy", "medium", "easy", "hard", "medium", "easy", "medium"];
    let difficulty = difficultyDistribution[index % difficultyDistribution.length];

    if (lowerQ.includes("technical") || lowerQ.includes("code") || lowerQ.includes("algorithm") || lowerQ.includes("system design")) {
      type = "technical";
    } else if (lowerQ.includes("tell me about a time") || lowerQ.includes("describe a situation") || lowerQ.includes("behavioral")) {
      type = "behavioral";
    } else if (lowerQ.includes("what would you do") || lowerQ.includes("how would you handle")) {
      type = "situational";
    }

    // Override difficulty based on content keywords
    if (lowerQ.includes("senior") || lowerQ.includes("architect") || lowerQ.includes("lead") || lowerQ.includes("complex") || lowerQ.includes("scale")) {
      difficulty = "hard";
    } else if (lowerQ.includes("junior") || lowerQ.includes("basic") || lowerQ.includes("entry") || lowerQ.includes("simple") || lowerQ.includes("introduce")) {
      difficulty = "easy";
    }

    return {
      question: question.trim(),
      type,
      difficulty,
      category: "Interview",
      answerFramework: ""
    };
  }

  return null; // Invalid question
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
            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs font-medium">
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
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                    {question.answerFramework}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Practice Answer */}
          <div className="space-y-2">
            <label htmlFor={`practice-answer-${index}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Practice Your Answer
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium
                       focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                       placeholder:text-gray-500 dark:placeholder:text-gray-400
                       resize-none"
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
    <Card className="p-6 border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)] backdrop-blur-soft shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interview Insights</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Role Level</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 capitalize">
            {roleLevel || "Mid"}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Focus Areas</p>
          <div className="flex flex-wrap gap-2">
            {(focusAreas && focusAreas.length > 0) ? focusAreas.map((area, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded text-xs font-medium border border-emerald-500/30"
              >
                {area}
              </span>
            )) : (
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                Click "Generate Questions" to analyze
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Empty state with Generate Questions CTA
 */
const GenerateQuestionsPrompt = ({ onGenerate, isLoading }) => {
  return (
    <Card className="p-12 text-center border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)] backdrop-blur-soft shadow-card">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Prepare for Your Interview
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Generate AI-predicted interview questions based on the job description.
            Practice your answers and ace your interview!
          </p>
        </div>

        <Button
          onClick={onGenerate}
          variant="primary"
          size="lg"
          disabled={isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <MessageSquare className="w-5 h-5 mr-2" />
              Generate Questions
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

export default function InterviewPrep({ jobDescription, resumeText, matchAnalysis, resumeData, onUpdate }) {
  const [questions, setQuestions] = useState([]);
  const [roleLevel, setRoleLevel] = useState("");
  const [focusAreas, setFocusAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedAnswers, setSavedAnswers] = useState({});

  /**
   * Extract interview questions from available data sources
   * Priority: matchAnalysis.interviewPrep > resumeData.meta.interview_prep > resumeData.interviewPrep
   */
  const extractQuestionsFromData = useCallback(() => {
    // Source 1: matchAnalysis.interviewPrep (from ai-match endpoint)
    if (matchAnalysis?.interviewPrep?.predicted_questions?.length > 0) {
      return {
        questions: matchAnalysis.interviewPrep.predicted_questions,
        roleLevel: matchAnalysis.interviewPrep.roleLevel || matchAnalysis.interviewPrep.role_level,
        focusAreas: matchAnalysis.interviewPrep.focusAreas || matchAnalysis.interviewPrep.focus_areas || []
      };
    }

    // Source 2: resumeData.meta.interview_prep (JSON Resume schema)
    if (resumeData?.meta?.interview_prep?.predicted_questions?.length > 0) {
      return {
        questions: resumeData.meta.interview_prep.predicted_questions,
        roleLevel: resumeData.meta.interview_prep.role_level,
        focusAreas: resumeData.meta.interview_prep.focus_areas || []
      };
    }

    // Source 3: resumeData.interviewPrep (legacy/backwards compatibility)
    if (resumeData?.interviewPrep?.predicted_questions?.length > 0) {
      return {
        questions: resumeData.interviewPrep.predicted_questions,
        roleLevel: resumeData.interviewPrep.roleLevel,
        focusAreas: resumeData.interviewPrep.focusAreas || []
      };
    }

    return null;
  }, [matchAnalysis, resumeData]);

  const predictQuestions = useCallback(async (forceRegenerate = false) => {
    // First, check if we already have data from props (skip if force regenerating)
    if (!forceRegenerate) {
      const existingData = extractQuestionsFromData();
      if (existingData) {
        const normalized = existingData.questions
          .map((q, i) => normalizeQuestion(q, i))
          .filter(Boolean);

        setQuestions(normalized);
        setRoleLevel(existingData.roleLevel || "mid");
        setFocusAreas(existingData.focusAreas);
        return;
      }
    }

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

      // Normalize questions from API response
      const rawQuestions = data.questions || [];
      const normalized = rawQuestions
        .map((q, i) => normalizeQuestion(q, i))
        .filter(Boolean);

      setQuestions(normalized);
      setRoleLevel(data.roleLevel || data.role_level || "mid");
      setFocusAreas(data.focusAreas || data.focus_areas || []);

      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          questions: normalized,
          roleLevel: data.roleLevel || data.role_level,
          focusAreas: data.focusAreas || data.focus_areas,
          generatedAt: new Date().toISOString()
        }));
      }

      // Persist to Resume Data (Meta)
      if (onUpdate) {
        onUpdate({
          meta: {
            ...resumeData?.meta,
            interview_prep: {
              predicted_questions: normalized,
              role_level: data.roleLevel || data.role_level,
              focus_areas: data.focusAreas || data.focus_areas,
              generated_at: new Date().toISOString()
            }
          }
        });
      }
    } catch (err) {
      console.error("Error predicting questions:", err);
      setError(err.message || "Failed to generate interview questions");
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeText, extractQuestionsFromData, onUpdate, resumeData]);

  // Auto-populate if data is available on mount or change
  useEffect(() => {
    const existingData = extractQuestionsFromData();
    if (existingData) {
      const normalized = existingData.questions
        .map((q, i) => normalizeQuestion(q, i))
        .filter(Boolean);

      setQuestions(normalized);
      setRoleLevel(existingData.roleLevel || "mid");
      setFocusAreas(existingData.focusAreas);
    }
  }, [extractQuestionsFromData]);

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
    // Build CSV content for Excel compatibility
    const headers = ["#", "Question", "Type", "Difficulty", "Category", "Answer Framework", "Your Answer"];
    const rows = questions.map((q, idx) => [
      idx + 1,
      `"${(q.question || "").replace(/"/g, '""')}"`,
      q.type || "general",
      q.difficulty || "medium",
      q.category || "General",
      `"${(q.answerFramework || "").replace(/"/g, '""')}"`,
      `"${(savedAnswers[idx] || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview-questions-${Date.now()}.csv`;
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
            <>
              <Button onClick={exportQuestions} variant="outline">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
              <Button
                onClick={() => predictQuestions(true)}
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                Regenerate
              </Button>
            </>
          )}
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Analyzing job description and predicting interview questions...
            </p>
          </div>
        </Card>
      )}

      {/* Generate Questions CTA - Show when no questions exist */}
      {!isLoading && questions.length === 0 && !error && (
        <GenerateQuestionsPrompt onGenerate={predictQuestions} isLoading={isLoading} />
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
    </div>
  );
}



