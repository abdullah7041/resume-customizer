import { useEffect, useState } from 'react';

export const EXIT_PRESENCE_MS = 200;

export function useExitPresence(isOpen: boolean, exitMs = EXIT_PRESENCE_MS) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
      return undefined;
    }

    if (!shouldRender) return undefined;

    setIsExiting(true);
    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
      setIsExiting(false);
    }, exitMs);

    return () => window.clearTimeout(timeoutId);
  }, [exitMs, isOpen, shouldRender]);

  return { shouldRender, isExiting };
}
