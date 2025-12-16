import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassTabs } from '../ui/GlassTabs';
import {
  MessageSquare,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface InterviewQuestion {
  id: string;
  category: 'behavioral' | 'technical' | 'situational' | 'general';
  question: string;
  sampleAnswer: string;
  tips: string[];
}

interface InterviewSectionProps {
  questions: InterviewQuestion[];
  onGenerate: (category: string, difficulty: string, count: number) => Promise<void>;
  isGenerating: boolean;
}

export function InterviewSection({
  questions,
  onGenerate,
  isGenerating,
}: InterviewSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [activeCategory, setActiveCategory] = useState('behavioral');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const tabs = [
    { id: 'behavioral', label: 'Behavioral', labelAr: 'سلوكية', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'technical', label: 'Technical', labelAr: 'تقنية', icon: null },
    { id: 'situational', label: 'Situational', labelAr: 'موقفية', icon: null },
    { id: 'general', label: 'General', labelAr: 'عامة', icon: null },
  ];

  const filteredQuestions = questions.filter(q => q.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.interview.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.interview.subtitle')}
            </p>
          </div>
        </div>

        <GlassTabs
          tabs={tabs}
          activeTab={activeCategory}
          onTabChange={setActiveCategory}
          isArabic={isArabic}
        />

        {/* Settings Row */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {t('sections.interview.settings.difficulty')}:
            </span>
            <div className="flex gap-1">
              {['easy', 'medium', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    difficulty === d
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  )}
                >
                  {t(`sections.interview.settings.${d}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {t('sections.interview.settings.count')}:
            </span>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
            >
              {[3, 5, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <GlassButton
            onClick={() => onGenerate(activeCategory, difficulty, questionCount)}
            isLoading={isGenerating}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="ms-auto"
          >
            {t('sections.interview.generate')}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <GlassCard variant="subtle" className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500">{t('sections.interview.subtitle')}</p>
          </GlassCard>
        ) : (
          filteredQuestions.map((q, index) => (
            <GlassCard
              key={q.id}
              variant="default"
              className="cursor-pointer hover:bg-gray-900/70 transition-all"
              onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400 font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-white font-medium">{q.question}</p>
                    {expandedQuestion === q.id && (
                      <div className="mt-4 space-y-4">
                        {/* Sample Answer */}
                        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <p className="text-xs text-emerald-400 font-medium mb-2">
                            {t('sections.interview.question.sample')}
                          </p>
                          <p className="text-sm text-gray-300">{q.sampleAnswer}</p>
                        </div>

                        {/* Tips */}
                        <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <p className="text-xs text-amber-400 font-medium">
                              {t('sections.interview.question.tips')}
                            </p>
                          </div>
                          <ul className="text-sm text-gray-300 space-y-1">
                            {q.tips.map((tip, i) => (
                              <li key={i}>• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {expandedQuestion === q.id
                  ? <ChevronUp className="w-5 h-5 text-gray-400" />
                  : <ChevronDown className="w-5 h-5 text-gray-400" />
                }
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
