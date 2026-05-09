import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HR_SUPER_SAUD_EVENT, readHRSuperSaudEvent } from './events';
import { getHRSuperSaudReaction, type HRSuperSaudReaction } from './model';

interface HRSuperSaudContextValue {
  reaction: HRSuperSaudReaction | null;
  dismissReaction: () => void;
}

const HRSuperSaudContext = createContext<HRSuperSaudContextValue | null>(null);

export function HRSuperSaudProvider({ children }: { children: ReactNode }) {
  const [reaction, setReaction] = useState<HRSuperSaudReaction | null>(null);

  const dismissReaction = useCallback(() => {
    setReaction(null);
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
      dismissReaction,
    }),
    [dismissReaction, reaction],
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
      dismissReaction: () => undefined,
    };
  }
  return context;
}
