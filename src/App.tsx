import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import Header from "./components/Layout/Header";
import MainContent from "./components/Layout/MainContent";
import Footer from "./components/Layout/Footer";

import EnvironmentBadge from "./components/ui/EnvironmentBadge";
import OfflineIndicator from "./components/ui/OfflineIndicator";
import { DirectionProvider } from "./components/providers/DirectionProvider";
import { ConsentBanner } from "./components/compliance/ConsentBanner";
import { migrateStorageKeys } from "./lib/utils/storage-migration";
import { PricingWaitlistModal } from "./components/Credits/PricingWaitlistModal";
import { useUserCredits } from "./hooks/useUserCredits";
import { useOnboardingTour } from "./hooks/useOnboardingTour";
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

  // Onboarding tour (Joyride removed — run is permanently false)
  const { run } = useOnboardingTour();

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

            {/* Low-credits pricing-waitlist modal */}
            <PricingWaitlistModal
              isOpen={showUpgrade}
              onClose={() => setShowUpgrade(false)}
              creditsRemaining={credits?.remaining || 0}
              dismissKey={upgradeDismissedKey || ''}
              source="credits"
            />

            {currentPath !== "/privacy" && currentPath !== "/terms" && currentPath !== "/admin/feedback" && (
              <HRSuperSaudOverlay isOnboardingActive={run} forceMinimized={!hasResume} />
            )}
          </div>
        </HRSuperSaudProvider>
      </DirectionProvider>
    </MotionConfig>
  );
}
