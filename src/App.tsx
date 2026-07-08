import { useEffect, useState, lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import Header from "./components/Layout/Header";
import MainContent from "./components/Layout/MainContent";
import Footer from "./components/Layout/Footer";

import EnvironmentBadge from "./components/ui/EnvironmentBadge";
import OfflineIndicator from "./components/ui/OfflineIndicator";
import { DirectionProvider } from "./components/providers/DirectionProvider";
import { ConsentBanner } from "./components/compliance/ConsentBanner";
import { migrateStorageKeys } from "./lib/utils/storage-migration";
import { useUserCredits } from "./hooks/useUserCredits";
import { useOnboardingTour } from "./hooks/useOnboardingTour";
import { HRSuperSaudOverlay, HRSuperSaudProvider } from "./features/hr-super-saud";
import { useResumeStore } from "./lib/stores/resumeStore";
import OnboardingChat from "./components/onboarding/OnboardingChat";
import { isOnboarded, markOnboarded } from "./lib/onboarding/onboardedFlag";

// Route pages are path-gated, so lazy-load them out of the entry chunk instead
// of eagerly bundling on every visit. OnboardingChat stays eager: it is the
// first-run gate's initial paint, so a Suspense flash there would be visible.
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./pages/TermsOfService").then((m) => ({ default: m.TermsOfService })));
const AdminFeedbackPage = lazy(() => import("./pages/AdminFeedbackPage").then((m) => ({ default: m.AdminFeedbackPage })));
const PricingWaitlistModal = lazy(() => import("./components/Credits/PricingWaitlistModal").then((m) => ({ default: m.PricingWaitlistModal })));
import { useAuth } from "./hooks/useAuth";
import { FeedbackPromptController } from "./components/Feedback/FeedbackPromptController";

// Launch flag: mascot hidden for launch (decision 2026-07-06). Flip to true to re-enable.
const ENABLE_HR_MASCOT = false;

const GUEST_MODE_STORAGE_KEY = "watheq:guestMode";
const GUEST_MODE_CHANGED_EVENT = "watheq:guestModeChanged";

const getCurrentPath = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
};

export default function App() {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const [guestModeActive, setGuestModeActive] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === "true";
  });
  const hasResume = useResumeStore((state) => Boolean(state.originalResume || state.parsedResumeText));

  // First-run onboarding gate (profile state, not device). The localStorage flag
  // breaks the loop for a user who skips every slot (no resume + no intent).
  const [onboardedFlag, setOnboardedFlag] = useState(isOnboarded);
  const [onboardingGateActive, setOnboardingGateActive] = useState(
    () => {
      const resumeState = useResumeStore.getState();
      return (
        !isOnboarded() &&
        !(resumeState.originalResume || resumeState.parsedResumeText) &&
        !resumeState.searchIntent
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
    const handleGuestModeChange = () => {
      setGuestModeActive(window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === "true");
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("watheq:navigate", handleLocationChange);
    window.addEventListener(GUEST_MODE_CHANGED_EVENT, handleGuestModeChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("watheq:navigate", handleLocationChange);
      window.removeEventListener(GUEST_MODE_CHANGED_EVENT, handleGuestModeChange);
    };
  }, []);

  // Credit system integration
  const { credits, showUpgrade, setShowUpgrade, upgradeDismissedKey } = useUserCredits();

  // Onboarding tour (Joyride removed — run is permanently false)
  const { run } = useOnboardingTour();
  const isStaticPage = currentPath === "/privacy" || currentPath === "/terms" || currentPath === "/admin/feedback";
  const isSignedOutLanding = !user && !needsOnboarding && !guestModeActive && currentPath === "/";

  return (
    <MotionConfig reducedMotion="user">
      <DirectionProvider>
        <HRSuperSaudProvider>
          <div id="app-root" className="relative flex min-h-screen flex-col overflow-x-hidden bg-noise bg-[color:var(--bg)] dark:bg-gradient-to-b dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
            <OfflineIndicator />
            <EnvironmentBadge />
            {!isSignedOutLanding && <Header showDecorativeSkyline={!isStaticPage} />}

            <Suspense fallback={null}>
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
                        setGuestModeActive(true);
                        window.dispatchEvent(new Event(GUEST_MODE_CHANGED_EVENT));
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
            </Suspense>
            {!needsOnboarding && !isSignedOutLanding && <Footer />}
            <ConsentBanner />
            <FeedbackPromptController />

            {/* Low-credits pricing-waitlist modal (lazy: only when shown) */}
            {showUpgrade && (
              <Suspense fallback={null}>
                <PricingWaitlistModal
                  isOpen={showUpgrade}
                  onClose={() => setShowUpgrade(false)}
                  creditsRemaining={credits?.remaining || 0}
                  dismissKey={upgradeDismissedKey || ''}
                  source="credits"
                />
              </Suspense>
            )}

            {ENABLE_HR_MASCOT && !isStaticPage && (
              <HRSuperSaudOverlay isOnboardingActive={run} forceMinimized={!hasResume} />
            )}
          </div>
        </HRSuperSaudProvider>
      </DirectionProvider>
    </MotionConfig>
  );
}
