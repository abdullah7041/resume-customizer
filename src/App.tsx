import { useEffect } from "react";
import Joyride from "react-joyride";
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
  const { run, steps, stepIndex, handleCallback } = useOnboardingTour();

  return (
    <DirectionProvider>
      <div id="app-root" className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-[rgba(11,107,58,0.92)] via-[rgba(20,99,86,0.95)] to-[rgba(12,83,53,0.97)] dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
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

        {/* Onboarding Tour */}
        <Joyride
          steps={steps}
          run={run}
          stepIndex={stepIndex}
          continuous
          showProgress
          showSkipButton
          callback={handleCallback}
          disableScrolling={false}
          scrollToFirstStep
          scrollOffset={100}
          spotlightClicks={false}
          tooltipComponent={(props) => <TourTooltip {...props} size={steps.length} />}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            skip: 'Skip Tour',
          }}
          floaterProps={{
            disableAnimation: true,
            disableFlip: true,
            offset: 20,
          }}
        />
      </div>
    </DirectionProvider>
  );
}




