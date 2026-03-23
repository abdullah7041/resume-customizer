import { lazy, Suspense, useEffect } from "react";
// react-joyride v3 uses named exports (no default export)
const Joyride = lazy(() => import("react-joyride").then((m) => ({ default: m.Joyride })));
import { MotionConfig } from "framer-motion";
import Header from "./components/Layout/Header";
import MainContent from "./components/Layout/MainContent";

import EnvironmentBadge from "./components/ui/EnvironmentBadge";
import OfflineIndicator from "./components/ui/OfflineIndicator";
import { DirectionProvider } from "./components/providers/DirectionProvider";
import { ConsentBanner } from "./components/compliance/ConsentBanner";
import { UserProgressNav } from "./components/ui/UserProgressNav";
import { migrateStorageKeys } from "./lib/utils/storage-migration";
import { UpgradeModal } from "./components/Credits/UpgradeModal";
import { useUserCredits } from "./hooks/useUserCredits";
import { useOnboardingTour } from "./hooks/useOnboardingTour";
import { TourTooltip } from "./components/Tour/TourTooltip";

export default function App() {
  // Run storage migration once on app initialization
  useEffect(() => {
    migrateStorageKeys();
  }, []);

  // Credit system integration
  const { credits, showUpgrade, setShowUpgrade, upgradeDismissedKey } = useUserCredits();

  // Onboarding tour
  const { run, steps, stepIndex, handleEvent } = useOnboardingTour();

  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider>
        <div id="app-root" className="relative flex min-h-screen flex-col overflow-x-hidden bg-noise bg-gradient-to-b from-[#f1fcf7] via-[#e6f7f1] to-[#dcf2e9] dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
          <OfflineIndicator />
          <EnvironmentBadge />
          <Header />
          <UserProgressNav />

          <MainContent />
          <ConsentBanner />

          {/* Credit Upgrade Modal */}
          <UpgradeModal
            isOpen={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            creditsRemaining={credits?.remaining || 0}
            dismissKey={upgradeDismissedKey || ''}
          />

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
      </DirectionProvider>
    </MotionConfig>
  );
}
