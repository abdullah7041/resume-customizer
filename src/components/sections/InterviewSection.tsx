import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import {
  MessageSquare,
  Lightbulb,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Monitor,
  Users,
  Target,
  BarChart3,
  HelpCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

const FUNCTION_BASE_PATH = '/.netlify/functions';
const PREDICT_ENDPOINT = `${FUNCTION_BASE_PATH}/predict-questions`;
const STORAGE_KEY = 'airo:interviewQuestions';

// === Types ===
interface Question {
  question: string;
  type: string;
  difficulty: string;
  category: string;
  answerFramework?: string;
}

interface InterviewSectionProps {
  jobDescription?: string;
  resumeText?: string;
  matchAnalysis?: {
    interviewPrep?: {
      predicted_questions?: Question[];
      role_level?: string;
      focus_areas?: string[];
    };
  };
  resumeData?: {
    meta?: {
      interview_prep?: {
        predicted_questions?: Question[];
        role_level?: string;
        focus_areas?: string[];
      };
    };
    interviewPrep?: {
      predicted_questions?: Question[];
      roleLevel?: string;
      focusAreas?: string[];
    };
  };
  onUpdate?: (u: Record<string, unknown>) => void;
}

// === Sub-components ===
const QuestionTypeIcon = ({ type }: { type: string }) => {
  const iconClass = 'w-5 h-5 text-emerald-400';
  const icons: Record<string, React.ReactNode> = {
    technical: <Monitor className={iconClass} />,
    behavioral: <Users className={iconClass} />,
    situational: <Target className={iconClass} />,
    'case-study': <BarChart3 className={iconClass} />,
    general: <HelpCircle className={iconClass} />
  };
  return (
    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20">
      {icons[type] || icons.general}
    </span>
  );
};

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const colors: Record<string, string> = {
    easy: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    hard: 'bg-rose-500/20 text-rose-400'
  };
  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', colors[difficulty] || colors.medium)}>
      {difficulty || 'medium'}
    </span>
  );
};

// Normalize question - handles different data formats
const normalizeQuestion = (question: unknown, index: number): Question | null => {
  if (typeof question === 'object' && question !== null) {
    const q = question as Record<string, unknown>;
    return {
      question: (q.question || q.text || `Question ${index + 1}`) as string,
      type: (q.type || 'general') as string,
      difficulty: (q.difficulty || 'medium') as string,
      category: (q.category || 'General') as string,
      answerFramework: (q.answerFramework || q.answer_framework || '') as string
    };
  }
  if (typeof question === 'string' && question.trim()) {
    const lowerQ = question.toLowerCase();
    let type = 'general';
    let difficulty = 'medium';

    if (lowerQ.includes('technical') || lowerQ.includes('code')) type = 'technical';
    else if (lowerQ.includes('tell me about a time')) type = 'behavioral';
    else if (lowerQ.includes('what would you do')) type = 'situational';

    if (lowerQ.includes('senior') || lowerQ.includes('complex')) difficulty = 'hard';
    else if (lowerQ.includes('basic') || lowerQ.includes('simple')) difficulty = 'easy';

    return { question: question.trim(), type, difficulty, category: 'Interview', answerFramework: '' };
  }
  return null;
};

export function InterviewSection({
  jobDescription,
  resumeText,
  matchAnalysis,
  resumeData,
  onUpdate
}: InterviewSectionProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roleLevel, setRoleLevel] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [savedAnswers, setSavedAnswers] = useState<Record<number, string>>({});

  // Extract questions from available sources
  const extractQuestionsFromData = useCallback(() => {
    if (matchAnalysis?.interviewPrep?.predicted_questions?.length) {
      return {
        questions: matchAnalysis.interviewPrep.predicted_questions,
        roleLevel: matchAnalysis.interviewPrep.role_level || '',
        focusAreas: matchAnalysis.interviewPrep.focus_areas || []
      };
    }
    if (resumeData?.meta?.interview_prep?.predicted_questions?.length) {
      return {
        questions: resumeData.meta.interview_prep.predicted_questions,
        roleLevel: resumeData.meta.interview_prep.role_level || '',
        focusAreas: resumeData.meta.interview_prep.focus_areas || []
      };
    }
    if (resumeData?.interviewPrep?.predicted_questions?.length) {
      return {
        questions: resumeData.interviewPrep.predicted_questions,
        roleLevel: resumeData.interviewPrep.roleLevel || '',
        focusAreas: resumeData.interviewPrep.focusAreas || []
      };
    }
    return null;
  }, [matchAnalysis, resumeData]);

  // Generate questions via API
  const predictQuestions = useCallback(async (forceRegenerate = false) => {
    if (!forceRegenerate) {
      const existingData = extractQuestionsFromData();
      if (existingData) {
        const normalized = existingData.questions.map((q, i) => normalizeQuestion(q, i)).filter(Boolean) as Question[];
        setQuestions(normalized);
        setRoleLevel(existingData.roleLevel);
        setFocusAreas(existingData.focusAreas);
        return;
      }
    }

    if (!jobDescription) {
      setError(t('sections.interview.errors.noJob', 'Please provide a job description first'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(PREDICT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText: resumeText || '' }),
      });

      if (!response.ok) throw new Error(`Failed to predict questions: ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const normalized = (data.questions || []).map((q: unknown, i: number) => normalizeQuestion(q, i)).filter(Boolean) as Question[];
      setQuestions(normalized);
      setRoleLevel(data.roleLevel || data.role_level || 'mid');
      setFocusAreas(data.focusAreas || data.focus_areas || []);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          questions: normalized,
          roleLevel: data.roleLevel || data.role_level,
          focusAreas: data.focusAreas || data.focus_areas,
          generatedAt: new Date().toISOString()
        }));
      }

      // Update parent
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
      setError((err as Error).message || t('sections.interview.errors.failed', 'Failed to generate questions'));
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeText, extractQuestionsFromData, onUpdate, resumeData, t]);

  // Auto-load on mount
  useEffect(() => {
    const existingData = extractQuestionsFromData();
    if (existingData) {
      const normalized = existingData.questions.map((q, i) => normalizeQuestion(q, i)).filter(Boolean) as Question[];
      setQuestions(normalized);
      setRoleLevel(existingData.roleLevel);
      setFocusAreas(existingData.focusAreas);
    }
  }, [extractQuestionsFromData]);

  const toggleQuestion = (index: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.has(index) ? newSet.delete(index) : newSet.add(index);
      return newSet;
    });
  };

  const exportQuestions = () => {
    const headers = ['#', 'Question', 'Type', 'Difficulty', 'Category', 'Your Answer'];
    const rows = questions.map((q, idx) => [
      idx + 1,
      `"${(q.question || '').replace(/"/g, '""')}"`,
      q.type,
      q.difficulty,
      q.category,
      `"${(savedAnswers[idx] || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `interview-questions-${Date.now()}.csv`;
    link.click();
  };

  // Empty state - no job description
  if (!jobDescription) {
    return (
      <GlassCard variant="elevated">
        <div className="py-12 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('sections.interview.noJobTitle', 'No Job Description')}
          </h3>
          <p>{t('sections.interview.noJobDesc', 'Add a job description in the Match tab to generate interview questions.')}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('sections.interview.title', 'Interview Preparation')}
              </h3>
              <p className="text-sm text-gray-400">
                {t('sections.interview.subtitle', 'AI-predicted questions based on the job description')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {questions.length > 0 && (
              <>
                <GlassButton variant="secondary" onClick={exportQuestions}>
                  <FileSpreadsheet className="w-4 h-4 me-2" />
                  {t('sections.interview.export', 'Export')}
                </GlassButton>
                <GlassButton variant="secondary" onClick={() => predictQuestions(true)} disabled={isLoading}>
                  <RefreshCw className={cn('w-4 h-4 me-2', isLoading && 'animate-spin')} />
                  {t('sections.interview.regenerate', 'Regenerate')}
                </GlassButton>
              </>
            )}
          </div>
        </div>

        {/* Role Insights */}
        {(roleLevel || focusAreas.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-white/5 rounded-xl">
            <div>
              <p className="text-sm text-gray-400 mb-1">{t('sections.interview.roleLevel', 'Role Level')}</p>
              <p className="text-xl font-bold text-emerald-400 capitalize">{roleLevel || 'Mid'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">{t('sections.interview.focusAreas', 'Focus Areas')}</p>
              <div className="flex flex-wrap gap-2">
                {focusAreas.length > 0 ? focusAreas.map((area, idx) => (
                  <span key={idx} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                    {area}
                  </span>
                )) : (
                  <span className="text-sm text-gray-500 italic">
                    {t('sections.interview.noFocusAreas', 'Generate questions to see focus areas')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        {questions.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-emerald-400" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">
              {t('sections.interview.readyTitle', 'Prepare for Your Interview')}
            </h4>
            <p className="text-gray-400 max-w-md mx-auto mb-6">
              {t('sections.interview.readyDesc', 'Generate AI-predicted interview questions based on the job description.')}
            </p>
            <GlassButton onClick={() => predictQuestions(false)} disabled={isLoading}>
              <MessageSquare className="w-4 h-4 me-2" />
              {t('sections.interview.generate', 'Generate Questions')}
            </GlassButton>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
            <p className="text-gray-400">
              {t('sections.interview.generating', 'Analyzing job description and generating questions...')}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Questions List */}
      {!isLoading && questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.interview.questionsTitle', 'Predicted Questions')} ({questions.length})
          </h3>
          {questions.map((question, index) => (
            <GlassCard key={index} variant="subtle" padding="sm">
              <div className="flex items-start gap-4">
                <QuestionTypeIcon type={question.type} />
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-white pe-4">
                      {index + 1}. {question.question}
                    </h4>
                    <div className="flex items-center gap-2">
                      <DifficultyBadge difficulty={question.difficulty} />
                      <button
                        onClick={() => toggleQuestion(index)}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {expandedQuestions.has(index) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{question.type}</span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">{question.category}</span>
                  </div>

                  {/* Expanded Content */}
                  {expandedQuestions.has(index) && (
                    <div className="mt-4 space-y-3">
                      {question.answerFramework && (
                        <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-400">
                              {t('sections.interview.framework', 'Answer Framework')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{question.answerFramework}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          {t('sections.interview.practiceAnswer', 'Practice Your Answer')}
                        </label>
                        <textarea
                          value={savedAnswers[index] || ''}
                          onChange={(e) => setSavedAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                          placeholder={t('sections.interview.answerPlaceholder', 'Write your answer here...')}
                          className="w-full h-24 p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
