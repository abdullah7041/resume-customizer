/**
 * Vision2030Section Component
 *
 * Full dedicated tab for Vision 2030 alignment analysis.
 * Costs 2 credits for detailed AI-powered sector analysis.
 * Results are persisted in localStorage to survive tab navigation.
 */

import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
const Joyride = lazy(() => import('react-joyride').then((m) => ({ default: m.Joyride })));
import { useTranslation } from 'react-i18next';
import { Target, Sparkles, Info, FileText, Trash2 } from 'lucide-react';
import { analyzeVision2030 } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useVision2030Tour } from '../../hooks/useVision2030Tour';
import { Vision2030AnalysisResponse } from '../../types/vision2030';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { SectorBreakdown } from './SectorBreakdown';
import { RecommendationsModal } from './RecommendationsModal';
import { GlassButton } from '../ui/GlassButton';
import { GlassCard } from '../ui/GlassCard';
import EmptyState from '../ui/EmptyState';
import { Vision2030CalculationModal } from '../ui/Vision2030CalculationModal';
import { TourTooltip } from '../Tour/TourTooltip';

const VISION2030_STORAGE_KEY = 'watheq:vision2030Analysis';
const VISION2030_ANALYZING_KEY = 'watheq:vision2030Analyzing';

interface Vision2030SectionProps {
  resumeText?: string;
  onToast?: (toast: any) => void;
}

export function Vision2030Section({ resumeText, onToast }: Vision2030SectionProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { credits: _credits, isLoading: creditsLoading, refetch: refreshCredits } = useUserCredits();
  const isArabic = i18n.language === 'ar';

  // Initialize analysis from localStorage
  const [analysis, setAnalysis] = useState<Vision2030AnalysisResponse | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(VISION2030_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Also check if the stored analysis was for the same resume
        if (parsed?.resumeHash && resumeText) {
          // Simple hash comparison - use first 100 chars as quick identifier
          const currentHash = resumeText.slice(0, 100);
          if (parsed.resumeHash === currentHash) {
            return parsed.analysis;
          }
        }
        return parsed.analysis || null;
      }
    } catch (err) {
      console.warn('[Vision2030Section] Failed to load cached analysis:', err);
    }
    return null;
  });

  // Initialize isAnalyzing from localStorage to persist loading state across tab switches
  const [isAnalyzing, setIsAnalyzing] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(VISION2030_ANALYZING_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);
  const [showCalculationModal, setShowCalculationModal] = useState(false);

  // Vision 2030 tour
  const { run, steps, stepIndex, handleEvent, startTour } = useVision2030Tour();

  // Start tour when component mounts (first time only)
  useEffect(() => {
    if (resumeText) {
      startTour();
    }
  }, [resumeText, startTour]);

  // Persist analysis to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (analysis && resumeText) {
      try {
        localStorage.setItem(VISION2030_STORAGE_KEY, JSON.stringify({
          analysis,
          resumeHash: resumeText.slice(0, 100), // Store hash for resume matching
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('[Vision2030Section] Failed to cache analysis:', err);
      }
    }
  }, [analysis, resumeText]);

  // Timeout safeguard: if isAnalyzing was restored from localStorage but no
  // actual API call completes within 60 seconds, clear the stuck state
  useEffect(() => {
    if (!isAnalyzing) return;

    const timeout = setTimeout(() => {
      console.warn('[Vision2030Section] Clearing stale analyzing state (timeout)');
      setIsAnalyzing(false);
      try {
        localStorage.removeItem(VISION2030_ANALYZING_KEY);
      } catch {
        // Ignore
      }
    }, 60000); // 60 seconds timeout

    return () => clearTimeout(timeout);
  }, [isAnalyzing]);

  // Handle analyze action
  const handleAnalyze = useCallback(async () => {
    if (!resumeText || !user) {
      onToast?.({
        type: 'warning',
        title: t('vision2030.section.noResume', 'Resume Required'),
        description: t('vision2030.section.noResumeDesc', 'Please upload a resume first.'),
      });
      return;
    }

    // Wait for credits to load before showing modal
    if (creditsLoading) {
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  }, [resumeText, user, creditsLoading, onToast, t]);

  // Execute analysis after credit confirmation
  const executeAnalysis = useCallback(async () => {
    if (!resumeText) return;

    setShowConfirmModal(false);
    setIsAnalyzing(true);

    // Persist analyzing state so it survives tab switches
    try {
      localStorage.setItem(VISION2030_ANALYZING_KEY, 'true');
    } catch {
      // Ignore storage errors
    }

    try {
      onToast?.({
        type: 'info',
        title: t('vision2030.section.analyzing', 'Analyzing...'),
        description: t('vision2030.section.analyzingDesc', 'Analyzing your resume against Vision 2030 sectors...'),
      });

      const result = await analyzeVision2030(resumeText, isArabic ? 'ar' : 'en', null);
      setAnalysis(result);

      // Save to storage immediately to persist result even if component unmounts (tab switch)
      try {
        localStorage.setItem(VISION2030_STORAGE_KEY, JSON.stringify({
          analysis: result,
          resumeHash: resumeText.slice(0, 100),
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        console.warn('[Vision2030Section] Failed to save analysis immediately:', err);
      }

      onToast?.({
        type: 'success',
        title: t('vision2030.section.complete', 'Analysis Complete'),
        description: t('vision2030.section.completeDesc', 'Your Vision 2030 alignment report is ready.'),
      });

      // Refresh credits after consumption
      await refreshCredits();
    } catch (error: any) {
      console.error('[Vision2030Section] Analysis failed:', error);

      onToast?.({
        type: 'danger',
        title: t('vision2030.section.failed', 'Analysis Failed'),
        description: error?.message || t('vision2030.section.failedDesc', 'Failed to analyze Vision 2030 alignment. Please try again.'),
      });
    } finally {
      setIsAnalyzing(false);
      // Clear analyzing state from storage
      try {
        localStorage.removeItem(VISION2030_ANALYZING_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, [resumeText, isArabic, onToast, t, refreshCredits]);

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  // Empty state when no resume uploaded
  if (!resumeText) {
    return (
      <EmptyState
        icon={FileText}
        title={t('vision2030.section.uploadResume', 'Upload Your Resume')}
        description={t('vision2030.section.uploadResumeDesc', 'Upload your resume on the Resume tab to analyze your alignment with Saudi Vision 2030.')}
      />
    );
  }

  // Loading state
  if (isAnalyzing) {
    return (
      <GlassCard className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <div className="relative">

            <div className="relative p-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('vision2030.section.analyzing', 'Analyzing...')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-white/60 max-w-md text-center">
            {t('vision2030.section.analyzingProgress', 'Analyzing your resume against Saudi Vision 2030 strategic sectors...')}
          </p>
        </div>
      </GlassCard>
    );
  }

  // Results state
  if (analysis) {
    return (
      <div className="space-y-6">
        {/* Overall Score Card */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('vision2030.section.yourAlignment', 'Your Vision 2030 Alignment')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-white/60">
                  {t('vision2030.section.careerPath', 'Detected Career Path')}: <span className="font-medium text-gray-700 dark:text-white/80">{isArabic ? analysis.detectedCareer.archetypeNameAr : analysis.detectedCareer.archetypeNameEn}</span>
                </p>
              </div>
            </div>

            {/* Overall Score */}
            <div className={`px-6 py-4 rounded-xl border backdrop-blur-md ${getScoreBg(analysis.overallScore)}`}>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400 dark:text-white/50 uppercase tracking-wider mb-1">
                  {t('vision2030.section.overallScore', 'Overall Score')}
                </span>
                <span className={`text-3xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                  {analysis.overallScore}%
                </span>
              </div>
            </div>
          </div>

          {/* Top Sectors */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              {t('vision2030.section.topSectors', 'Top Aligned Sectors')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {analysis.sectorBreakdown
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((sector) => (
                  <div
                    key={sector.sectorId}
                    className="p-4 rounded-lg bg-gradient-to-br from-gray-100 dark:from-white/5 to-gray-50 dark:to-white/[0.02] border border-gray-200 dark:border-white/10 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                      </span>
                      <span className={`text-lg font-bold ${getScoreColor(sector.score)}`}>
                        {sector.score}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-900/50 rounded-full overflow-hidden">
                      <div
                        className="h-full w-full origin-left rtl:origin-right bg-gradient-to-r from-emerald-600 to-emerald-400 transition-transform duration-1000"
                        style={{ transform: `scaleX(${Math.min(Math.max(sector.score, 0), 100) / 100})` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
            <GlassButton
              variant="secondary"
              onClick={() => {
                setAnalysis(null);
                setIsAnalyzing(false);
                try {
                  localStorage.removeItem(VISION2030_STORAGE_KEY);
                  localStorage.removeItem(VISION2030_ANALYZING_KEY);
                } catch (err) {
                  console.warn('[Vision2030Section] Failed to clear storage:', err);
                }
                onToast?.({
                  type: 'success',
                  title: t('vision2030.section.cleared', 'Results Cleared'),
                  description: t('vision2030.section.clearedDesc', 'Analysis results have been cleared.'),
                });
              }}
              className="px-3"
              title={t('vision2030.section.clear', 'Clear Results')}
            >
              <Trash2 className="w-4 h-4" />
            </GlassButton>
            <GlassButton
              variant="secondary"
              onClick={() => setShowRecommendationsModal(true)}
              className="flex-1"
            >
              <Info className="w-4 h-4 me-2" />
              {t('vision2030.section.viewRecommendations', 'Recommendations')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleAnalyze}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4 me-2" />
              {t('vision2030.section.reanalyze', 'Re-analyze (2 credits)')}
            </GlassButton>
          </div>
        </GlassCard>

        {/* Detailed Sector Breakdown */}
        <SectorBreakdown
          sectorBreakdown={analysis.sectorBreakdown}
          matchedSkills={analysis.matchedSkills}
          isArabic={isArabic}
        />

        {/* Recommendations Modal */}
        <RecommendationsModal
          isOpen={showRecommendationsModal}
          onClose={() => setShowRecommendationsModal(false)}
          missingSuggestions={analysis.missingSuggestions}
          isArabic={isArabic}
        />

        {/* Credit Confirmation Modal - needed for re-analyze */}
        <ConfirmActionModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={executeAnalysis}
          feature="vision2030"
          isLoading={isAnalyzing}
        />
      </div>
    );
  }

  // Initial state - prompt to analyze
  return (
    <GlassCard className="p-8">
      <div className="flex flex-col items-center justify-center space-y-6 py-12">
        <div className="relative">

          <div className="relative p-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30">
            <Target className="w-12 h-12 text-emerald-400" />
          </div>
        </div>

        <div data-tour="vision2030-intro" className="text-center space-y-2 max-w-lg">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('vision2030.section.title', 'Vision 2030 Alignment Analysis')}
          </h2>
          <p className="text-gray-500 dark:text-white/60">
            {t('vision2030.section.description', 'Discover how your skills and experience align with Saudi Vision 2030 strategic sectors. Get AI-powered insights and recommendations.')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <GlassButton
            data-tour="vision2030-calculate"
            variant="primary"
            onClick={handleAnalyze}
            disabled={creditsLoading || !user}
            className="flex-1 justify-center"
          >
            <Sparkles className="w-4 h-4 me-2" />
            {t('vision2030.section.analyze', 'Analyze Resume (2 credits)')}
          </GlassButton>
          <GlassButton
            data-tour="vision2030-methodology"
            variant="secondary"
            onClick={() => setShowCalculationModal(true)}
            className="flex-shrink-0"
          >
            <Info className="w-4 h-4 me-2" />
            {t('vision2030.section.howCalculated', 'How is this calculated?')}
          </GlassButton>
        </div>

        {/* Info about what's included */}
        <div className="mt-8 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 max-w-lg">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-3">
            {t('vision2030.section.included', "What's Included:")}
          </h4>
          <ul className="space-y-2 text-sm text-gray-500 dark:text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>{t('vision2030.section.feature1', 'Overall alignment score across all Vision 2030 sectors')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>{t('vision2030.section.feature2', 'Sector-by-sector breakdown with matched skills')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>{t('vision2030.section.feature3', 'Personalized recommendations to improve alignment')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span>{t('vision2030.section.feature4', 'Keywords and skills to add (Arabic + English)')}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeAnalysis}
        feature="vision2030"
        isLoading={isAnalyzing}
      />

      {/* Calculation Methodology Modal */}
      <Vision2030CalculationModal
        isOpen={showCalculationModal}
        onClose={() => setShowCalculationModal(false)}
      />

      {/* Vision 2030 Tour */}
      <Suspense fallback={null}>
        <Joyride
          steps={steps}
          run={run}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          onEvent={handleEvent}
          tooltipComponent={(props) => <TourTooltip {...props} size={steps.length} />}
          locale={{
            back: isArabic ? 'السابق' : 'Back',
            close: isArabic ? 'إغلاق' : 'Close',
            last: isArabic ? 'إنهاء' : 'Finish',
            next: isArabic ? 'التالي' : 'Next',
            skip: isArabic ? 'تخطي الجولة' : 'Skip Tour',
          }}
          options={{
            showProgress: true,
            buttons: ['back', 'close', 'primary', 'skip'],
            zIndex: 10000,
          }}
        />
      </Suspense>
    </GlassCard>
  );
}
