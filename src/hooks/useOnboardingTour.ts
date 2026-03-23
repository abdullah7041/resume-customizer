import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Step, EventData } from 'react-joyride';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'watheq:onboardingTourCompleted';

export function useOnboardingTour() {
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

  // Check if tour should run (wait for credit balance to render)
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(STORAGE_KEY);
    if (hasCompletedTour) return;

    // Wait for the credit balance element to be in the DOM before starting tour
    const checkElement = () => {
      const creditElement = document.querySelector('[data-tour="credits"]');
      if (creditElement) {
        setRun(true);
      } else {
        // Retry after a short delay if element not found
        setTimeout(checkElement, 500);
      }
    };

    // Start checking after a short delay to allow initial render
    const timeoutId = setTimeout(checkElement, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const steps: Step[] = useMemo(() => [
    {
      target: '[data-tour="credits"]',
      content: t('tour.onboarding.steps.credits.content'),
      title: t('tour.onboarding.steps.credits.title'),
      placement: 'bottom',
      // v3: skipBeacon replaces disableBeacon; options.blockTargetInteraction replaces disableOverlayClose
      skipBeacon: true,
      isFixed: true, // credit badge is in a fixed header
      spotlightPadding: 8,
      // v3: tooltip width is set via options.width (per-step via options prop)
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
      },
    },
    {
      target: '[data-tour="upload-header"]',
      content: t('tour.onboarding.steps.upload.content'),
      title: t('tour.onboarding.steps.upload.title'),
      placement: 'bottom',
      skipBeacon: true,
      spotlightPadding: 8,
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
      },
    },
    {
      target: '[data-tour="features"]',
      content: t('tour.onboarding.steps.features.content'),
      title: t('tour.onboarding.steps.features.title'),
      placement: 'bottom',
      skipBeacon: true,
      spotlightPadding: 8,
      options: {
        width: isMobile ? 'calc(100vw - 32px)' : 400,
      },
    },
    {
      target: '[data-tour="referral"]',
      content: t('tour.onboarding.steps.referral.content'),
      title: t('tour.onboarding.steps.referral.title'),
      placement: 'left',
      skipBeacon: true,
      spotlightPadding: 8,
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
    handleEvent,
    startTour,
    resetTour,
  };
}
