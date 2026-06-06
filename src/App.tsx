import { lazy, Suspense, useEffect, useState } from "react";
// react-joyride v3 uses named exports (no default export)
const Joyride = lazy(() => import("react-joyride").then((m) => ({ default: m.Joyride })));
import { MotionConfig } from "framer-motion";
import Header from "./components/Layout/Header";
import MainContent from "./components/Layout/MainContent";
import Footer from "./components/Layout/Footer";

import EnvironmentBadge from "./components/ui/EnvironmentBadge";
import OfflineIndicator from "./components/ui/OfflineIndicator";
import { DirectionProvider } from "./components/providers/DirectionProvider";
import { ConsentBanner } from "./components/compliance/ConsentBanner";
import { migrateStorageKeys } from "./lib/utils/storage-migration";
import { UpgradeModal } from "./components/Credits/UpgradeModal";
import { useUserCredits } from "./hooks/useUserCredits";
import { useOnboardingTour } from "./hooks/useOnboardingTour";
import { TourTooltip } from "./components/Tour/TourTooltip";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { AdminFeedbackPage } from "./pages/AdminFeedbackPage";
import { HRSuperSaudOverlay, HRSuperSaudProvider } from "./features/hr-super-saud";
import { useResumeStore } from "./lib/stores/resumeStore";

const getCurrentPath = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
};

export default function App() {
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const hasResume = useResumeStore((state) => Boolean(state.originalResume || state.parsedResumeText));

  // Run storage migration once on app initialization
  useEffect(() => {
    migrateStorageKeys();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("watheq:navigate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("watheq:navigate", handleLocationChange);
    };
  }, []);

  // Credit system integration
  const { credits, showUpgrade, setShowUpgrade, upgradeDismissedKey } = useUserCredits();

  // Onboarding tour
  const { run, steps, stepIndex, handleEvent } = useOnboardingTour();

  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider>
        <HRSuperSaudProvider>
          <div id="app-root" className="relative flex min-h-screen flex-col overflow-x-hidden bg-noise bg-[color:var(--bg)] dark:bg-gradient-to-b dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
            <OfflineIndicator />
            <EnvironmentBadge />
            <Header />

            {currentPath === "/privacy" ? (
              <PrivacyPolicy />
            ) : currentPath === "/terms" ? (
              <TermsOfService />
            ) : currentPath === "/admin/feedback" ? (
              <AdminFeedbackPage />
            ) : (
              <MainContent />
            )}
            <Footer />
            <ConsentBanner />

            {/* Credit Upgrade Modal */}
            <UpgradeModal
              isOpen={showUpgrade}
              onClose={() => setShowUpgrade(false)}
              creditsRemaining={credits?.remaining || 0}
              dismissKey={upgradeDismissedKey || ''}
            />

            {currentPath !== "/privacy" && currentPath !== "/terms" && currentPath !== "/admin/feedback" && (
              <HRSuperSaudOverlay isOnboardingActive={run} forceMinimized={!hasResume} />
            )}

            {/* Onboarding Tour — react-joyride v3 API */}
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
                  back: 'Back',
                  close: 'Close',
                  last: 'Finish',
                  next: 'Next',
                  skip: 'Skip Tour',
                }}
                options={{
                  showProgress: true,
                  buttons: ['back', 'close', 'primary', 'skip'],
                  scrollOffset: 20,
                  zIndex: 10000,
                  overlayColor: 'rgba(0, 0, 0, 0.65)',
                }}
              />
            </Suspense>
          </div>
        </HRSuperSaudProvider>
      </DirectionProvider>
    </MotionConfig>
  );
}
