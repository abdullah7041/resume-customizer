import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import {
  MessageSquare,
  Lightbulb,
  AlertCircle,
  Sparkles,
  Monitor,
  Users,
  Target,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
  Award,
  Zap,
  Brain,
  Code,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useFeatureTracking } from '../../hooks/useFeatureTracking';
import { UpgradeModal } from '../Credits/UpgradeModal';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { FeedbackModal } from '../Feedback/FeedbackModal';
import type { VulnerabilityType } from '../../types/analysis';

const FUNCTION_BASE_PATH = '/.netlify/functions';
const PREDICT_ENDPOINT = `${FUNCTION_BASE_PATH}/predict-questions`;
const STORAGE_KEY = 'watheq:interviewQuestions';

// === Types ===
interface Question {
  question: string;
  type: string;
  difficulty: string;
  category: string;
  answerFramework?: string;
  skills_tested?: string[];
  coachingTip?: string;
  vulnerabilityType?: VulnerabilityType;
}

interface WorkEntry {
  name?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
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
    work?: WorkEntry[];
    data?: { work?: WorkEntry[] };
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
const STARMethodTip = () => {
  const { t } = useTranslation();

  return (
    <GlassCard className="mb-8 border-emerald-500/30">
      <div className="flex flex-col md:flex-row items-start gap-6">
        <div className="flex-shrink-0">
          <GlassCircle size="lg" className="bg-emerald-500/20 border-emerald-500/40">
            <Lightbulb className="w-6 h-6 text-emerald-300" />
          </GlassCircle>
        </div>
        <div className="flex-1 w-full">
          <h4 className="text-lg font-bold text-emerald-300 mb-2 flex items-center gap-2">
            {t('sections.interview.starMethod.title')}
            <span className="text-xs font-normal text-emerald-400/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              {t('sections.interview.starMethod.recommended')}
            </span>
          </h4>
          <p className="text-gray-700 dark:text-white/80 leading-relaxed mb-6 max-w-2xl">
            {t('sections.interview.starMethod.description')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { letter: 'S', word: t('sections.interview.starMethod.steps.situation.title'), desc: t('sections.interview.starMethod.steps.situation.desc'), icon: <Target className="w-4 h-4" /> },
              { letter: 'T', word: t('sections.interview.starMethod.steps.task.title'), desc: t('sections.interview.starMethod.steps.task.desc'), icon: <FileSpreadsheet className="w-4 h-4" /> },
              { letter: 'A', word: t('sections.interview.starMethod.steps.action.title'), desc: t('sections.interview.starMethod.steps.action.desc'), icon: <Zap className="w-4 h-4" /> },
              { letter: 'R', word: t('sections.interview.starMethod.steps.result.title'), desc: t('sections.interview.starMethod.steps.result.desc'), icon: <Award className="w-4 h-4" /> }
            ].map((item, idx) => (
              <GlassCard key={idx} padding="sm" className="group border-emerald-500/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-300 group-hover:scale-110 transition-transform">
                    {item.letter}
                  </div>
                  <span className="text-emerald-200 font-semibold">{item.word}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-white/60 ps-1">{item.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

// Get contextual STAR tips based on question type
const getSTARTips = (q: string, t: TFunction) => {
  const lower = q.toLowerCase();

  if (lower.includes('describe') || lower.includes('tell me about')) {
    return {
      situation: t('sections.interview.starTips.behavioral.situation'),
      task: t('sections.interview.starTips.behavioral.task'),
      action: t('sections.interview.starTips.behavioral.action'),
      result: t('sections.interview.starTips.behavioral.result')
    };
  }
  if (lower.includes('how do you') || lower.includes('how would you')) {
    return {
      situation: t('sections.interview.starTips.situational.situation'),
      task: t('sections.interview.starTips.situational.task'),
      action: t('sections.interview.starTips.situational.action'),
      result: t('sections.interview.starTips.situational.result')
    };
  }
  // Default tips
  return {
    situation: t('sections.interview.starTips.default.situation'),
    task: t('sections.interview.starTips.default.task'),
    action: t('sections.interview.starTips.default.action'),
    result: t('sections.interview.starTips.default.result')
  };
};

// Helper function to infer skills from question text (backward compatibility)
const inferSkillsFromQuestion = (questionText: string, type: string): string[] => {
  const lower = questionText.toLowerCase();
  const skills: string[] = [];

  // Behavioral indicators
  if (lower.includes('team') || lower.includes('leadership')) skills.push('Leadership');
  if (lower.includes('conflict') || lower.includes('disagree')) skills.push('Conflict Resolution');
  if (lower.includes('pressure') || lower.includes('deadline')) skills.push('Time Management');
  if (lower.includes('problem') || lower.includes('challenge')) skills.push('Problem Solving');
  if (lower.includes('communicate') || lower.includes('presentation')) skills.push('Communication');

  // Technical indicators
  if (type === 'technical') {
    if (lower.includes('react')) skills.push('React');
    if (lower.includes('typescript') || lower.includes('javascript')) skills.push('TypeScript');
    if (lower.includes('python')) skills.push('Python');
    if (lower.includes('sql') || lower.includes('database')) skills.push('SQL');
    if (lower.includes('system design') || lower.includes('architecture')) skills.push('System Design');
    if (!skills.length) skills.push('Technical Knowledge');
  }

  // Default fallback for behavioral/situational questions
  if (skills.length === 0 && (type === 'behavioral' || type === 'situational')) {
    skills.push('Communication', 'Critical Thinking');
  }

  return skills.slice(0, 3); // Max 3 skills
};

// Normalize question - handles different data formats
const normalizeQuestion = (question: unknown, index: number): Question | null => {
  if (typeof question === 'object' && question !== null) {
    const q = question as Record<string, unknown>;
    const questionText = (q.question || q.text || `Question ${index + 1}`) as string;
    const type = (q.type || 'general') as string;

    return {
      question: questionText,
      type,
      difficulty: (q.difficulty || 'medium') as string,
      category: (q.category || 'General') as string,
      answerFramework: (q.answerFramework || q.answer_framework || '') as string,
      skills_tested: Array.isArray(q.skills_tested)
        ? q.skills_tested.map(s => String(s)).filter(Boolean)
        : inferSkillsFromQuestion(questionText, type),
      coachingTip: (q.coachingTip || q.coaching_tip || '') as string || undefined,
      vulnerabilityType: (q.vulnerabilityType || q.vulnerability_type) as VulnerabilityType | undefined,
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

    return {
      question: question.trim(),
      type,
      difficulty,
      category: 'Interview',
      answerFramework: '',
      skills_tested: inferSkillsFromQuestion(question.trim(), type)
    };
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
  const { t, i18n } = useTranslation();
  const { credits, refetch: refetchCredits } = useUserCredits();
  const { trackFeatureUse, shouldShowFeedback, dismissFeedback } = useFeatureTracking();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roleLevel, setRoleLevel] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [savedAnswers, setSavedAnswers] = useState<Record<number, string>>({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [pendingRegenerate, setPendingRegenerate] = useState(false);
  const [skillFilter, setSkillFilter] = useState<string | null>(null);

  // Get unique skills from standard questions (vulnerability questions have their own section)
  const uniqueSkills = useMemo(() => {
    const allSkills = questions.filter(q => !q.vulnerabilityType).flatMap(q => q.skills_tested || []);
    return Array.from(new Set(allSkills)).sort();
  }, [questions]);

  // Split questions into vulnerability and standard groups
  const vulnerabilityQuestions = useMemo(() =>
    questions.filter(q => q.vulnerabilityType),
    [questions]);

  const standardQuestions = useMemo(() =>
    questions.filter(q => !q.vulnerabilityType),
    [questions]);

  // Filter standard questions by selected skill
  const filteredQuestions = useMemo(() => {
    if (!skillFilter) return standardQuestions;
    return standardQuestions.filter(q => q.skills_tested?.includes(skillFilter));
  }, [standardQuestions, skillFilter]);

  // Count questions for each skill
  const getSkillCount = (skill: string) =>
    questions.filter(q => q.skills_tested?.includes(skill)).length;

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

  // Generate questions via API (actual implementation)
  const predictQuestionsActual = useCallback(async (questionType: 'behavioral' | 'technical' = 'behavioral', forceRegenerate = false) => {
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
      // Get authenticated headers (includes Authorization Bearer token)
      const { getAuthHeaders } = await import('../../lib/auth/authHeaders');
      const headers = await getAuthHeaders();

      // Extract structured work history for vulnerability detection
      const workEntries = (resumeData?.work || resumeData?.data?.work || [])
        .filter((w): w is WorkEntry & { name: string; position: string; startDate: string; endDate: string } =>
          Boolean(w.name && w.position && w.startDate && w.endDate)
        );

      const response = await fetch(PREDICT_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobDescription,
          resumeText: resumeText || '',
          questionType,
          language: i18n.language,
          ...(workEntries.length > 0 && { workHistory: workEntries }),
        }),
      });

      // Handle insufficient credits (403)
      if (response.status === 403) {
        setShowUpgradeModal(true);
        setIsLoading(false);
        return;
      }

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

      // Track feature use for feedback prompt
      trackFeatureUse('interview');

      // Check if we should show feedback modal (with 5-10 second delay for better UX)
      if (shouldShowFeedback) {
        const delay = 5000 + Math.random() * 5000; // Random 5-10 seconds
        setTimeout(() => {
          setShowFeedbackModal(true);
        }, delay);
      }

      // Refetch credits to update balance (credits were consumed by backend)
      setTimeout(() => refetchCredits(), 500);
    } catch (err) {
      setError((err as Error).message || t('sections.interview.errors.failed', 'Failed to generate questions'));
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, resumeText, extractQuestionsFromData, onUpdate, resumeData, refetchCredits, trackFeatureUse, shouldShowFeedback, t, i18n.language]);

  // State to track which question type was selected
  const [pendingQuestionType, setPendingQuestionType] = useState<'behavioral' | 'technical'>('behavioral');

  // Wrapper function that shows confirmation modal first
  const predictQuestions = (questionType: 'behavioral' | 'technical', forceRegenerate = false) => {
    if (!jobDescription) {
      setError(t('sections.interview.errors.noJob', 'Please provide a job description first'));
      return;
    }
    setPendingQuestionType(questionType);
    setPendingRegenerate(forceRegenerate);
    setShowConfirmModal(true);
  };

  // Handler for confirmed interview prep action
  const handleConfirmGenerate = async () => {
    setShowConfirmModal(false);
    await predictQuestionsActual(pendingQuestionType, pendingRegenerate);
    setPendingRegenerate(false);
  };

  // Auto-load on mount from props or localStorage
  useEffect(() => {
    // First, try to load from props
    const existingData = extractQuestionsFromData();
    if (existingData) {
      const normalized = existingData.questions.map((q, i) => normalizeQuestion(q, i)).filter(Boolean) as Question[];
      setQuestions(normalized);
      setRoleLevel(existingData.roleLevel);
      setFocusAreas(existingData.focusAreas);
      return;
    }

    // If no data from props, try localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.questions?.length) {
            setQuestions(parsed.questions);
            setRoleLevel(parsed.roleLevel || '');
            setFocusAreas(parsed.focusAreas || []);
          }
        }
      } catch (err) {
        console.warn('[InterviewSection] Failed to load from localStorage:', err);
      }
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
    const headers = [
      t('sections.interview.csvHeaders.number', '#'),
      t('sections.interview.csvHeaders.question', 'Question'),
      t('sections.interview.csvHeaders.type', 'Type'),
      t('sections.interview.csvHeaders.difficulty', 'Difficulty'),
      t('sections.interview.csvHeaders.category', 'Category'),
      t('sections.interview.csvHeaders.answer', 'Your Answer'),
    ];
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

  // Clear interview cache and reset state
  const clearInterviewCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setQuestions([]);
    setRoleLevel('');
    setFocusAreas([]);
    setSavedAnswers({});
    setExpandedQuestions(new Set());
    setError(null);
  };

  // Empty state - no job description
  if (!jobDescription) {
    return (
      <GlassCard className="relative overflow-hidden">
        <div className="py-12 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
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
      <GlassCard className="relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <GlassCircle size="lg" variant="blue" className="bg-blue-500/10">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </GlassCircle>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
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
                <GlassButton
                  variant="secondary"
                  onClick={clearInterviewCache}
                  className="text-gray-400 hover:text-red-400 hover:border-red-400/30"
                >
                  <RotateCcw className="w-4 h-4 me-2" />
                  {t('sections.interview.clear', 'Clear')}
                </GlassButton>
              </>
            )}
          </div>
        </div>

        {/* Role Insights */}
        {(roleLevel || focusAreas.length > 0) && (
          <GlassCard className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
            {/* Decorative background gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 flex items-start gap-4 p-2">
              <GlassCircle size="md" variant="warning" className="mt-1">
                <Award className="w-5 h-5 text-amber-400" />
              </GlassCircle>
              <div>
                <p className="text-sm text-gray-400 mb-1 font-medium">{t('sections.interview.roleLevel', 'Role Level')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">{roleLevel || 'Mid-Senior'}</p>
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
                    <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200/50 dark:hover:bg-white/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-full text-xs font-medium transition-colors cursor-default backdrop-blur-sm">
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

        {/* Always show generate buttons when job description exists */}
        {!isLoading && (
          <div className={questions.length === 0 ? "text-center py-12" : "mb-6"}>
            {questions.length === 0 && (
              <>
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]">
                  <Sparkles className="w-10 h-10 text-emerald-400" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('sections.interview.readyTitle', 'Prepare for Your Interview')}
                </h4>
                <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                  {t('sections.interview.readyDesc', 'Generate AI-predicted interview questions based on the job description.')}
                </p>
              </>
            )}

            {/* Two Question Type Buttons - Always visible */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto mb-4">
              <GlassButton
                size={questions.length === 0 ? "lg" : "md"}
                onClick={() => predictQuestions('behavioral', true)}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/20"
              >
                <Brain className="w-5 h-5 me-2" />
                {questions.length > 0
                  ? t('sections.interview.regenerateBehavioral')
                  : t('sections.interview.generateBehavioral')}
                <span className="ml-2 text-xs opacity-75">(3 {t('common.credits', 'credits')})</span>
              </GlassButton>

              <GlassButton
                size={questions.length === 0 ? "lg" : "md"}
                onClick={() => predictQuestions('technical', true)}
                disabled={isLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white border-0 shadow-lg shadow-purple-900/20"
              >
                <Code className="w-5 h-5 me-2" />
                {questions.length > 0
                  ? t('sections.interview.regenerateTechnical')
                  : t('sections.interview.generateTechnical')}
                <span className="ml-2 text-xs opacity-75">(3 {t('common.credits', 'credits')})</span>
              </GlassButton>
            </div>

            {/* Explanatory Text */}
            <p className="text-xs text-gray-500 max-w-2xl mx-auto text-center leading-relaxed">
              <strong>{t('sections.interview.typesDescription.behavioral.label')}</strong> {t('sections.interview.typesDescription.behavioral.desc')}
              <br />
              <strong>{t('sections.interview.typesDescription.technical.label')}</strong> {t('sections.interview.typesDescription.technical.desc')}
            </p>
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

          {/* Vulnerability Questions Section */}
          {vulnerabilityQuestions.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    {t('sections.interview.vulnerability.title', 'Career Vulnerability Questions')}
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-xs font-normal border border-amber-500/30">
                      {vulnerabilityQuestions.length}
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-amber-400/60">
                  {t('sections.interview.vulnerability.subtitle', 'Questions targeting potential red flags in your career timeline')}
                </p>
              </div>

              <div className="space-y-4">
                {vulnerabilityQuestions.map((question, index) => {
                  const globalIdx = questions.indexOf(question);
                  return (
                    <GlassCard
                      key={`vuln-${index}`}
                      padding="none"
                      className={cn(
                        "overflow-hidden transition-all duration-300 border-amber-500/20",
                        expandedQuestions.has(globalIdx) ? "ring-1 ring-amber-500/30" : "hover:border-amber-500/30"
                      )}
                    >
                      <div
                        className="p-5 flex items-start gap-4 cursor-pointer"
                        onClick={() => toggleQuestion(globalIdx)}
                      >
                        <div className="mt-1">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-bold">
                            {index + 1}
                          </span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h4 className={cn(
                              "font-semibold text-gray-800 dark:text-white/90 leading-relaxed transition-colors",
                              expandedQuestions.has(globalIdx) ? "text-amber-600 dark:text-amber-300" : ""
                            )}>
                              {question.question}
                            </h4>
                            <button className={cn(
                              "p-2 rounded-full transition-all duration-300",
                              expandedQuestions.has(globalIdx) ? "bg-amber-500/20 text-amber-400 rotate-180" : "bg-white/5 text-gray-400 hover:bg-white/10"
                            )}>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <DifficultyBadge difficulty={question.difficulty} />
                            {question.vulnerabilityType && (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                <ShieldAlert className="w-3 h-3" />
                                {t(`sections.interview.vulnerability.types.${question.vulnerabilityType}`, question.vulnerabilityType)}
                              </span>
                            )}
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {question.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      {expandedQuestions.has(globalIdx) && (
                        <div className="px-5 pb-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="h-px w-full bg-amber-500/10 mb-4" />

                          {/* Coaching Tip */}
                          {question.coachingTip && (
                            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/15">
                              <div className="flex items-center gap-2 mb-2">
                                <GlassCircle size="sm" className="bg-amber-500/20">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                                </GlassCircle>
                                <span className="text-sm font-bold text-amber-400">
                                  {t('sections.interview.vulnerability.coachingTip', 'Coaching Tip')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 leading-relaxed ps-9">{question.coachingTip}</p>
                            </div>
                          )}

                          {/* STAR Guidance */}
                          <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                            <div className="flex items-center gap-2 mb-3">
                              <GlassCircle size="sm" className="bg-emerald-500/20">
                                <Lightbulb className="w-3.5 h-3.5 text-emerald-300" />
                              </GlassCircle>
                              <span className="text-sm font-bold text-emerald-400">
                                {t('sections.interview.starTips.header')}
                              </span>
                            </div>
                            {(() => {
                              const starTips = getSTARTips(question.question, t);
                              return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div className="space-y-1">
                                    <div className="flex gap-2">
                                      <span className="font-bold text-emerald-400 min-w-[1.5rem]">S:</span>
                                      <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.situation}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="font-bold text-emerald-400 min-w-[1.5rem]">T:</span>
                                      <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.task}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex gap-2">
                                      <span className="font-bold text-emerald-400 min-w-[1.5rem]">A:</span>
                                      <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.action}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="font-bold text-emerald-400 min-w-[1.5rem]">R:</span>
                                      <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.result}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Practice answer */}
                          <div className="pt-2">
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex justify-between">
                              {t('sections.interview.practiceAnswer', 'Practice Your Answer')}
                              <span className="text-xs text-gray-500 font-normal">{t('sections.interview.privateToYou', 'Private to you')}</span>
                            </label>
                            <textarea
                              value={savedAnswers[globalIdx] || ''}
                              onChange={(e) => setSavedAnswers(prev => ({ ...prev, [globalIdx]: e.target.value }))}
                              placeholder={t('sections.interview.answerPlaceholder', 'Write your answer here using the STAR method...')}
                              className="w-full h-32 p-4 rounded-xl bg-black/20 border border-white/10 text-white placeholder-gray-600 resize-y focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-sans text-sm leading-relaxed"
                            />
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          ) : questions.length > 0 ? (
            /* No vulnerabilities detected — positive message */
            <GlassCard className="border-emerald-500/20">
              <div className="flex items-center gap-4 py-2">
                <GlassCircle size="md" className="bg-emerald-500/15 border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </GlassCircle>
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">
                    {t('sections.interview.vulnerability.noVulnerabilities', 'No red flags detected in your career timeline')}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t('sections.interview.vulnerability.noVulnerabilitiesDesc', 'Your career progression looks consistent. Focus on the standard questions below.')}
                  </p>
                </div>
              </div>
            </GlassCard>
          ) : null}

          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {t('sections.interview.questionsTitle', 'Predicted Questions')}
                <span className="bg-gray-200/50 dark:bg-white/10 text-gray-600 dark:text-white/70 px-2 py-0.5 rounded-full text-xs font-normal">
                  {skillFilter ? filteredQuestions.length : standardQuestions.length}
                </span>
              </h3>
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full">
              <Target className="h-4 w-4" />
              {t('trust.interviewQuestions')}
            </p>
          </div>

          {/* Skill Filter */}
          {uniqueSkills.length > 0 && (
            <div className="mb-6 p-5 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  {t('sections.interview.filterBySkill', 'Filter by Skill')}
                </label>
                <span className="text-xs text-gray-400 dark:text-white/40 font-medium px-2 py-1 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/5">
                  {uniqueSkills.length} {t('common.skills', 'Skills')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => setSkillFilter(null)}
                  className={cn(
                    'group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border flex items-center justify-between',
                    skillFilter === null
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200/50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20'
                  )}
                >
                  <span className="truncate">{t('sections.interview.all', 'All')}</span>
                  <span className={cn(
                    "text-xs py-0.5 px-2 rounded-full transition-colors font-semibold ml-2 min-w-[1.5rem] text-center",
                    skillFilter === null ? "bg-white/20 text-white" : "bg-gray-200/50 dark:bg-white/10 text-gray-400 dark:text-white/50 group-hover:bg-gray-300/50 dark:group-hover:bg-white/20 group-hover:text-gray-800 dark:group-hover:text-white/90"
                  )}>
                    {questions.length}
                  </span>
                </button>
                {uniqueSkills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => setSkillFilter(skill)}
                    className={cn(
                      'group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border flex items-center justify-between',
                      skillFilter === skill
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                    )}
                  >
                    <span className="truncate text-start" title={skill}>{skill}</span>
                    <span className={cn(
                      "text-xs py-0.5 px-2 rounded-full transition-colors font-semibold ml-2 min-w-[1.5rem] text-center",
                      skillFilter === skill ? "bg-white/20 text-white" : "bg-gray-200/50 dark:bg-white/10 text-gray-400 dark:text-white/50 group-hover:bg-gray-300/50 dark:group-hover:bg-white/20 group-hover:text-gray-800 dark:group-hover:text-white/90"
                    )}>
                      {getSkillCount(skill)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {filteredQuestions.map((question, index) => (
              <GlassCard
                key={index}
                padding="none"
                className={cn(
                  "overflow-hidden transition-all duration-300 border-white/5",
                  expandedQuestions.has(index) ? "ring-1 ring-emerald-500/30" : "hover:border-white/10"
                )}
              >
                {/* Header / Question Summary */}
                <div
                  className="p-5 flex items-start gap-4 cursor-pointer"
                  onClick={() => toggleQuestion(index)}
                >
                  <div className="mt-1">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/50 text-sm font-bold">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className={cn(
                        "font-semibold text-gray-800 dark:text-white/90 leading-relaxed transition-colors",
                        expandedQuestions.has(index) ? "text-emerald-700 dark:text-emerald-300" : ""
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

                    {/* Skills Being Evaluated */}
                    {question.skills_tested && question.skills_tested.length > 0 && (
                      <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                        <h5 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                          <Target className="w-3.5 h-3.5" />
                          {t('sections.interview.skillsEvaluated', 'Skills Being Evaluated')}
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {question.skills_tested.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/5 text-blue-600 dark:text-blue-300 border border-blue-500/20 hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors cursor-default"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STAR Guidance for this question */}
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <GlassCircle size="sm" className="bg-emerald-500/20">
                          <Lightbulb className="w-3.5 h-3.5 text-emerald-300" />
                        </GlassCircle>
                        <span className="text-sm font-bold text-emerald-400">
                          {t('sections.interview.starTips.header')}
                        </span>
                      </div>
                      {(() => {
                        // Call getSTARTips once and destructure (was called 4x before)
                        const starTips = getSTARTips(question.question, t);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <div className="flex gap-2">
                                <span className="font-bold text-emerald-400 min-w-[1.5rem]">S:</span>
                                <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.situation}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="font-bold text-emerald-400 min-w-[1.5rem]">T:</span>
                                <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.task}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex gap-2">
                                <span className="font-bold text-emerald-400 min-w-[1.5rem]">A:</span>
                                <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.action}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="font-bold text-emerald-400 min-w-[1.5rem]">R:</span>
                                <span className="text-gray-600 dark:text-white/70 text-xs leading-relaxed">{starTips.result}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
                        <span className="text-xs text-gray-500 font-normal">{t('sections.interview.privateToYou', 'Private to you')}</span>
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        creditsRemaining={credits?.remaining || 0}
        dismissKey="watheq:upgradeDismissed-interview"
      />

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmGenerate}
        feature="interview_prep"
        isLoading={isLoading}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          dismissFeedback();
        }}
      />
    </div>
  );
}

