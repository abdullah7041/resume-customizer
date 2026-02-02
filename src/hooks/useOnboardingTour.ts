import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Step, CallBackProps } from 'react-joyride';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'watheq:onboardingTourCompleted';

export function useOnboardingTour() {
  const { t } = useTranslation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Check if tour should run
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(STORAGE_KEY);
    if (!hasCompletedTour) {
      setRun(true);
    }
  }, []);

  const steps: Step[] = useMemo(() => [
    {
      target: '[data-tour="credits"]',
      content: t('tour.onboarding.steps.credits.content'),
      title: t('tour.onboarding.steps.credits.title'),
      placement: 'bottom-start',
      disableBeacon: true,
      disableOverlayClose: true,
      hideCloseButton: false,
      spotlightPadding: 8,
    },
    {
      target: '[data-tour="upload-header"]',
      content: t('tour.onboarding.steps.upload.content'),
      title: t('tour.onboarding.steps.upload.title'),
      placement: 'bottom',
      disableBeacon: true,
      spotlightPadding: 8,
    },
    {
      target: '[data-tour="features"]',
      content: t('tour.onboarding.steps.features.content'),
      title: t('tour.onboarding.steps.features.title'),
      placement: 'bottom',
      disableBeacon: true,
      spotlightPadding: 8,
    },
    {
      target: '[data-tour="referral"]',
      content: t('tour.onboarding.steps.referral.content'),
      title: t('tour.onboarding.steps.referral.title'),
      placement: 'left',
      disableBeacon: true,
      spotlightPadding: 8,
    },
  ], [t]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { action, index, type, status } = data;

    // Handle manual navigation
    if (type === 'step:after' && action === 'next') {
      setStepIndex(index + 1);
    } else if (type === 'step:after' && action === 'prev') {
      setStepIndex(index - 1);
    }

    // Mark tour as completed
    if (status === 'finished' || status === 'skipped' || action === 'close') {
      localStorage.setItem(STORAGE_KEY, 'true');
      setRun(false);
    }
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStepIndex(0);
    setRun(true);
  }, []);

  return {
    run,
    steps,
    stepIndex,
    handleCallback,
    startTour,
    resetTour,
  };
}
