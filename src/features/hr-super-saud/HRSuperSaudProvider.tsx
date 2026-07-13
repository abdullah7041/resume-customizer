import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HR_SUPER_SAUD_EVENT, readHRSuperSaudEvent } from './events';
import { getHRSuperSaudReaction, type HRSuperSaudReaction, type HRSuperSaudWorkflowState } from './model';

interface HRSuperSaudContextValue {
  reaction: HRSuperSaudReaction | null;
  workflowState: HRSuperSaudWorkflowState;
  isOverlaySuppressed: boolean;
  dismissReaction: () => void;
  registerCompanion: () => () => void;
  setWorkflowState: (state: HRSuperSaudWorkflowState) => void;
}

const HRSuperSaudContext = createContext<HRSuperSaudContextValue | null>(null);

export function HRSuperSaudProvider({ children }: { children: ReactNode }) {
  const [reaction, setReaction] = useState<HRSuperSaudReaction | null>(null);
  const [workflowState, setWorkflowState] = useState<HRSuperSaudWorkflowState>('noResume');
  const [companionCount, setCompanionCount] = useState(0);

  const dismissReaction = useCallback(() => {
    setReaction(null);
  }, []);

  const registerCompanion = useCallback(() => {
    setCompanionCount((count) => count + 1);
    let isRegistered = true;

    return () => {
      if (!isRegistered) return;
      isRegistered = false;
      setCompanionCount((count) => Math.max(0, count - 1));
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleMascotEvent = (event: Event) => {
      const detail = readHRSuperSaudEvent((event as CustomEvent<unknown>).detail);
      if (!detail) {
        return;
      }

      setReaction(getHRSuperSaudReaction(detail));
    };

    window.addEventListener(HR_SUPER_SAUD_EVENT, handleMascotEvent);
    return () => window.removeEventListener(HR_SUPER_SAUD_EVENT, handleMascotEvent);
  }, []);

  const value = useMemo(
    () => ({
      reaction,
      workflowState,
      isOverlaySuppressed: companionCount > 0,
      dismissReaction,
      registerCompanion,
      setWorkflowState,
    }),
    [companionCount, dismissReaction, reaction, registerCompanion, workflowState],
  );

  return (
    <HRSuperSaudContext.Provider value={value}>
      {children}
    </HRSuperSaudContext.Provider>
  );
}

export function useHRSuperSaud() {
  const context = useContext(HRSuperSaudContext);
  if (!context) {
    return {
      reaction: null,
      workflowState: 'noResume' as HRSuperSaudWorkflowState,
      isOverlaySuppressed: false,
      dismissReaction: () => undefined,
      registerCompanion: () => () => undefined,
      setWorkflowState: () => undefined,
    };
  }
  return context;
}
