import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Step, EventData } from 'react-joyride';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'watheq:vision2030TourCompleted';

export function useVision2030Tour() {
  const { t } = useTranslation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size for mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const steps: Step[] = useMemo(() => [
    {
      target: '[data-tour="vision2030-intro"]',
      content: t('tour.vision2030.steps.intro.content'),
      title: t('tour.vision2030.steps.intro.title'),
      placement: 'bottom',
      skipBeacon: true,
      spotlightPadding: 10,
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
        overlayClickAction: false, // replaces disableOverlayClose
      },
    },
    {
      target: '[data-tour="vision2030-calculate"]',
      content: t('tour.vision2030.steps.calculate.content'),
      title: t('tour.vision2030.steps.calculate.title'),
      placement: 'top',
      skipBeacon: true,
      spotlightPadding: 10,
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
      },
    },
    {
      target: '[data-tour="vision2030-methodology"]',
      content: t('tour.vision2030.steps.methodology.content'),
      title: t('tour.vision2030.steps.methodology.title'),
      placement: 'top',
      skipBeacon: true,
      spotlightPadding: 10,
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
      },
    },
  ], [t, isMobile]);

  // v3: onEvent replaces callback; EventData shape is different
  const handleEvent = useCallback((data: EventData) => {
    const { action, index, type, status } = data;

    // Handle manual navigation (controlled mode via stepIndex)
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
    const hasCompletedTour = localStorage.getItem(STORAGE_KEY);
    if (!hasCompletedTour) {
      // Small delay to ensure elements are mounted
      setTimeout(() => {
        setStepIndex(0);
        setRun(true);
      }, 500);
    }
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
    handleEvent,
    startTour,
    resetTour,
  };
}
