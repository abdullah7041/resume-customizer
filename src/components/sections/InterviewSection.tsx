import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import {
  MessageSquare,
  Lightbulb,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Monitor,
  Users,
  Target,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
  Award,
  Zap
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
  onUpdate?: (updates: Record<string, unknown>) => void;
}

// === Sub-components ===
const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const colors: Record<string, string> = {
    easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    hard: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  };
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm', colors[difficulty] || colors.medium)}>
      {difficulty || 'medium'}
    </span>
  );
};

// STAR Method Tip component
const STARMethodTip = () => (
  <GlassCard variant="subtle" className="mb-8 border-emerald-500/30 bg-emerald-900/10">
    <div className="flex flex-col md:flex-row items-start gap-6">
      <div className="flex-shrink-0">
        <GlassCircle size="lg" className="bg-emerald-500/20 border-emerald-500/40">
          <Lightbulb className="w-6 h-6 text-emerald-300" />
        </GlassCircle>
      </div>
      <div className="flex-1 w-full">
        <h4 className="text-lg font-bold text-emerald-300 mb-2 flex items-center gap-2">
          Use the STAR Method
          <span className="text-xs font-normal text-emerald-400/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">Recommended</span>
        </h4>
        <p className="text-white/80 leading-relaxed mb-6 max-w-2xl">
          Structure your answers for maximum impact. This proven framework helps you tell compelling stories that demonstrate your skills effectively.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { letter: 'S', word: 'Situation', desc: 'Set the context', icon: <Target className="w-4 h-4" /> },
            { letter: 'T', word: 'Task', desc: 'Your responsibility', icon: <FileSpreadsheet className="w-4 h-4" /> },
            { letter: 'A', word: 'Action', desc: 'What you did', icon: <Zap className="w-4 h-4" /> },
            { letter: 'R', word: 'Result', desc: 'Measurable outcome', icon: <Award className="w-4 h-4" /> }
          ].map((item, idx) => (
            <GlassCard key={idx} variant="subtle" padding="sm" className="group hover:bg-emerald-500/10 transition-colors border-emerald-500/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-300 group-hover:scale-110 transition-transform">
                  {item.letter}
                </div>
                <span className="text-emerald-200 font-semibold">{item.word}</span>
              </div>
              <p className="text-xs text-white/60 ps-1">{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  </GlassCard>
);

// Get contextual STAR tips based on question type
const getSTARTips = (q: string) => {
  const lower = q.toLowerCase();
  if (lower.includes('describe') || lower.includes('tell me about')) {
    return {
      situation: 'Briefly describe the project/challenge context',
      task: "Explain your specific role and what was expected",
      action: "Detail the steps YOU took (use 'I', not 'we')",
      result: 'Quantify the outcome: %, $, time saved, etc.'
    };
  }
  if (lower.includes('how do you') || lower.includes('how would you')) {
    return {
      situation: 'Reference a specific instance when you did this',
      task: 'What problem were you solving?',
      action: 'Walk through your methodology step-by-step',
      result: 'What was the measurable improvement?'
    };
  }
  // Default tips
  return {
    situation: 'Set the scene with relevant context',
    task: 'Define what you needed to accomplish',
    action: 'Describe your specific contributions',
    result: 'Share concrete, quantifiable outcomes'
  };
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
      // Get beta code from localStorage
      const betaCode = typeof window !== 'undefined' ? localStorage.getItem('watheq:beta_access') : null;

      if (!betaCode) {
        throw new Error('Beta code not found. Please sign in again.');
      }

      const response = await fetch(PREDICT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Beta-Code': betaCode
        },
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <GlassCircle size="lg" variant="blue" className="bg-blue-500/10">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </GlassCircle>
            <div>
              <h3 className="text-xl font-bold text-white">
                {t('sections.interview.title', 'Interview Preparation')}
              </h3>
              <p className="text-sm text-gray-400">
                {t('sections.interview.subtitle', 'AI-predicted questions based on the job description')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
          <GlassCard variant="subtle" className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
            {/* Decorative background gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 flex items-start gap-4 p-2">
              <GlassCircle size="md" variant="warning" className="mt-1">
                <Award className="w-5 h-5 text-amber-400" />
              </GlassCircle>
              <div>
                <p className="text-sm text-gray-400 mb-1 font-medium">{t('sections.interview.roleLevel', 'Role Level')}</p>
                <p className="text-xl font-bold text-white capitalize">{roleLevel || 'Mid-Senior'}</p>
              </div>
            </div>

            <div className="relative z-10 flex items-start gap-4 p-2">
              <GlassCircle size="md" variant="success" className="mt-1">
                <Target className="w-5 h-5 text-emerald-400" />
              </GlassCircle>
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">{t('sections.interview.focusAreas', 'Focus Areas')}</p>
                <div className="flex flex-wrap gap-2">
                  {focusAreas.length > 0 ? focusAreas.map((area, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 rounded-full text-xs font-medium transition-colors cursor-default backdrop-blur-sm">
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
          </GlassCard>
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
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]">
              <Sparkles className="w-10 h-10 text-emerald-400" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-2">
              {t('sections.interview.readyTitle', 'Prepare for Your Interview')}
            </h4>
            <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
              {t('sections.interview.readyDesc', 'Generate AI-predicted interview questions based on the job description.')}
            </p>
            <GlassButton size="lg" onClick={() => predictQuestions(false)} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-900/20">
              <MessageSquare className="w-5 h-5 me-2" />
              {t('sections.interview.generate', 'Generate Questions')}
            </GlassButton>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
            <p className="text-gray-400 animate-pulse">
              {t('sections.interview.generating', 'Analyzing job description and generating questions...')}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Questions List */}
      {!isLoading && questions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* STAR Method Tip */}
          <STARMethodTip />

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {t('sections.interview.questionsTitle', 'Predicted Questions')}
              <span className="bg-white/10 text-white/70 px-2 py-0.5 rounded-full text-xs font-normal">
                {questions.length}
              </span>
            </h3>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <GlassCard
                key={index}
                variant="elevated"
                padding="none"
                className={cn(
                  "overflow-hidden transition-all duration-300 border-white/5",
                  expandedQuestions.has(index) ? "bg-white/5 ring-1 ring-emerald-500/30" : "hover:bg-white/5"
                )}
              >
                {/* Header / Question Summary */}
                <div
                  className="p-5 flex items-start gap-4 cursor-pointer"
                  onClick={() => toggleQuestion(index)}
                >
                  <div className="mt-1">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm font-bold">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className={cn(
                        "font-semibold text-white/90 leading-relaxed transition-colors",
                        expandedQuestions.has(index) ? "text-emerald-300" : ""
                      )}>
                        {question.question}
                      </h4>
                      <button className={cn(
                        "p-2 rounded-full transition-all duration-300",
                        expandedQuestions.has(index) ? "bg-emerald-500/20 text-emerald-400 rotate-180" : "bg-white/5 text-gray-400 hover:bg-white/10"
                      )}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <DifficultyBadge difficulty={question.difficulty} />
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {question.type === 'technical' && <Monitor className="w-3 h-3" />}
                        {question.type === 'behavioral' && <Users className="w-3 h-3" />}
                        {question.type === 'situational' && <Target className="w-3 h-3" />}
                        {question.type || 'General'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {question.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedQuestions.has(index) && (
                  <div className="px-5 pb-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="h-px w-full bg-white/5 mb-4" />

                    {/* STAR Guidance for this question */}
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <GlassCircle size="sm" className="bg-emerald-500/20">
                          <Lightbulb className="w-3.5 h-3.5 text-emerald-300" />
                        </GlassCircle>
                        <span className="text-sm font-bold text-emerald-400">
                          How to answer using STAR:
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <span className="font-bold text-emerald-400 min-w-[1.5rem]">S:</span>
                            <span className="text-white/70 text-xs leading-relaxed">{getSTARTips(question.question).situation}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-bold text-emerald-400 min-w-[1.5rem]">T:</span>
                            <span className="text-white/70 text-xs leading-relaxed">{getSTARTips(question.question).task}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <span className="font-bold text-emerald-400 min-w-[1.5rem]">A:</span>
                            <span className="text-white/70 text-xs leading-relaxed">{getSTARTips(question.question).action}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-bold text-emerald-400 min-w-[1.5rem]">R:</span>
                            <span className="text-white/70 text-xs leading-relaxed">{getSTARTips(question.question).result}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {question.answerFramework && (
                      <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <GlassCircle size="sm" className="bg-blue-500/20">
                            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                          </GlassCircle>
                          <span className="text-sm font-bold text-blue-400">
                            {t('sections.interview.framework', 'Answer Framework')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed ps-9">{question.answerFramework}</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex justify-between">
                        {t('sections.interview.practiceAnswer', 'Practice Your Answer')}
                        <span className="text-xs text-gray-500 font-normal">Private to you</span>
                      </label>
                      <textarea
                        value={savedAnswers[index] || ''}
                        onChange={(e) => setSavedAnswers(prev => ({ ...prev, [index]: e.target.value }))}
                        placeholder={t('sections.interview.answerPlaceholder', 'Write your answer here using the STAR method...')}
                        className="w-full h-32 p-4 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-600 resize-y focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans text-sm leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

