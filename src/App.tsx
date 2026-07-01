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
import OnboardingChat from "./components/onboarding/OnboardingChat";
import { isOnboarded, markOnboarded } from "./lib/onboarding/onboardedFlag";
import { useAuth } from "./hooks/useAuth";

const GUEST_MODE_STORAGE_KEY = "watheq:guestMode";

const getCurrentPath = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
};

export default function App() {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const hasResume = useResumeStore((state) => Boolean(state.originalResume || state.parsedResumeText));

  // First-run onboarding gate (profile state, not device). The localStorage flag
  // breaks the loop for a user who skips every slot (no resume + no intent).
  const [onboardedFlag, setOnboardedFlag] = useState(isOnboarded);
  const [onboardingGateActive, setOnboardingGateActive] = useState(
    () => {
      const resumeState = useResumeStore.getState();
      return (
        !isOnboarded() &&
        !Boolean(resumeState.originalResume || resumeState.parsedResumeText) &&
        !Boolean(resumeState.searchIntent)
      );
    }
  );
  const needsOnboarding = onboardingGateActive && !onboardedFlag;

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
  const isStaticPage = currentPath === "/privacy" || currentPath === "/terms" || currentPath === "/admin/feedback";

  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider>
        <HRSuperSaudProvider>
          <div id="app-root" className="relative flex min-h-screen flex-col overflow-x-hidden bg-noise bg-[color:var(--bg)] dark:bg-gradient-to-b dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
            <OfflineIndicator />
            <EnvironmentBadge />
            <Header showDecorativeSkyline={!isStaticPage} />

            {currentPath === "/privacy" ? (
              <PrivacyPolicy />
            ) : currentPath === "/terms" ? (
              <TermsOfService />
            ) : currentPath === "/admin/feedback" ? (
              <AdminFeedbackPage />
            ) : needsOnboarding ? (
              <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
                <OnboardingChat
                  onComplete={() => {
                    if (!user && typeof window !== "undefined") {
                      window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, "true");
                    }
                    markOnboarded();
                    setOnboardedFlag(true);
                    setOnboardingGateActive(false);
                  }}
                />
              </main>
            ) : (
              <MainContent />
            )}
            {!needsOnboarding && <Footer />}
            <ConsentBanner />

            {/* Low-credits pricing-waitlist modal */}
            <PricingWaitlistModal
              isOpen={showUpgrade}
              onClose={() => setShowUpgrade(false)}
              creditsRemaining={credits?.remaining || 0}
              dismissKey={upgradeDismissedKey || ''}
              source="credits"
            />

            {!isStaticPage && (
              <HRSuperSaudOverlay isOnboardingActive={run} forceMinimized={!hasResume} />
            )}
          </div>
        </HRSuperSaudProvider>
      </DirectionProvider>
    </MotionConfig>
  );
}
