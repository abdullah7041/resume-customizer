import { Eye, EyeOff, MessageCircle, Minus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils/cn';
import { useHRSuperSaud } from './HRSuperSaudProvider';
import type { HRSuperSaudMood, HRSuperSaudMovementPhase, HRSuperSaudReaction, HRSuperSaudTargetRegion, HRSuperSaudWorkflowState } from './model';

const MINIMIZED_STORAGE_KEY = 'watheq:hrSuperSaud:minimized';
const DISABLED_STORAGE_KEY = 'watheq:hrSuperSaud:disabled';
const MOVE_DURATION_MS = 720;
const RETURN_DURATION_MS = 560;
type MascotPose = 'idle' | 'wave' | 'fly';

interface MovementState {
  phase: HRSuperSaudMovementPhase;
  offsetX: number;
  offsetY: number;
  reaction: HRSuperSaudReaction | null;
}

type ShellStyle = CSSProperties & {
  '--hr-super-saud-offset-x': string;
  '--hr-super-saud-offset-y': string;
};

const HOME_MOVEMENT: MovementState = {
  phase: 'idle',
  offsetX: 0,
  offsetY: 0,
  reaction: null,
};

const mascotAssets: Record<MascotPose, { png: string; webp: string }> = {
  idle: {
    png: '/hr-super-saud/idle.png',
    webp: '/hr-super-saud/idle.webp',
  },
  wave: {
    png: '/hr-super-saud/wave.png',
    webp: '/hr-super-saud/wave.webp',
  },
  fly: {
    png: '/hr-super-saud/fly.png',
    webp: '/hr-super-saud/fly.webp',
  },
};

const MASCOT_IMAGE_FALLBACK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const moodStyles: Record<HRSuperSaudMood, {
  image: 'idle' | 'wave';
}> = {
  confident: {
    image: 'wave',
  },
  coach: {
    image: 'idle',
  },
  caution: {
    image: 'idle',
  },
};

function readStoredBoolean(key: string) {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(key) === 'true';
}

function hasStoredPreference(key: string) {
  return typeof window !== 'undefined' && window.localStorage.getItem(key) !== null;
}

function HRSuperSaudMascotImage({ className, pose }: { className: string; pose: MascotPose }) {
  const asset = mascotAssets[pose];
  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.src = MASCOT_IMAGE_FALLBACK;
  };

  return (
    <picture className="hr-super-saud-avatar-frame" data-pose={pose}>
      <source srcSet={asset.webp} type="image/webp" />
      <img
        className={className}
        src={asset.png}
        alt=""
        draggable={false}
        onError={handleImageError}
      />
    </picture>
  );
}

function readInitialMinimized() {
  if (hasStoredPreference(MINIMIZED_STORAGE_KEY)) {
    return readStoredBoolean(MINIMIZED_STORAGE_KEY);
  }
  return true;
}

function readInitialDisabled() {
  return readStoredBoolean(DISABLED_STORAGE_KEY);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

function getFallbackTarget(region: HRSuperSaudTargetRegion) {
  switch (region) {
    case 'upload':
      return { xRatio: 0.28, yRatio: 0.36 };
    case 'match':
      return { xRatio: 0.64, yRatio: 0.38 };
    case 'optimize':
      return { xRatio: 0.66, yRatio: 0.56 };
    case 'status':
      return { xRatio: 0.5, yRatio: 0.36 };
  }
}

function getTargetElement(region: HRSuperSaudTargetRegion) {
  if (typeof document === 'undefined') {
    return null;
  }

  const selectors: Partial<Record<HRSuperSaudTargetRegion, string>> = {
    upload: '[data-tour="upload"]',
    match: '[data-tour="features"]',
    optimize: '[data-tour="features"]',
  };
  const selector = selectors[region];
  if (!selector) {
    return null;
  }

  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  return isVisible ? element : null;
}

function getMovementOffset(shell: HTMLElement, currentOffset: { offsetX: number; offsetY: number }, region: HRSuperSaudTargetRegion) {
  const shellRect = shell.getBoundingClientRect();
  const homeLeft = shellRect.left - currentOffset.offsetX;
  const homeTop = shellRect.top - currentOffset.offsetY;
  const targetElement = getTargetElement(region);
  const fallback = getFallbackTarget(region);
  const targetRect = targetElement?.getBoundingClientRect();
  const targetCenterX = targetRect
    ? targetRect.left + targetRect.width / 2
    : window.innerWidth * fallback.xRatio;
  const targetCenterY = targetRect
    ? targetRect.top + targetRect.height / 2
    : window.innerHeight * fallback.yRatio;
  const padding = 16;
  const targetLeft = clamp(
    targetCenterX - shellRect.width / 2,
    padding,
    window.innerWidth - shellRect.width - padding,
  );
  const targetTop = clamp(
    targetCenterY - shellRect.height - 28,
    padding,
    window.innerHeight - shellRect.height - padding,
  );

  return {
    offsetX: Math.round(targetLeft - homeLeft),
    offsetY: Math.round(targetTop - homeTop),
  };
}

function getWorkflowHint(workflowState: HRSuperSaudWorkflowState) {
  if (workflowState === 'resumeUploaded') {
    return {
      key: 'hrSuperSaud.resumeUploadedHint',
      fallback: 'Great. Now continue to match your resume with a job ad.',
    };
  }

  return {
    key: 'hrSuperSaud.stepOneHint',
    fallback: 'Upload a selectable PDF, DOCX, or TXT resume to begin.',
  };
}

export function HRSuperSaudOverlay({ isOnboardingActive = false, forceMinimized = false }: { isOnboardingActive?: boolean; forceMinimized?: boolean }) {
  const { dismissReaction, isOverlaySuppressed, reaction, workflowState } = useHRSuperSaud();
  const { t } = useTranslation();
  const [isMinimized, setIsMinimized] = useState(readInitialMinimized);
  const [hasMinimizedPreference, setHasMinimizedPreference] = useState(() => hasStoredPreference(MINIMIZED_STORAGE_KEY));
  const [isDisabled, setIsDisabled] = useState(readInitialDisabled);
  const [movement, setMovement] = useState<MovementState>(HOME_MOVEMENT);
  const shellRef = useRef<HTMLElement>(null);
  const movementRef = useRef<MovementState>(HOME_MOVEMENT);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isCompact = useMediaQuery('(max-width: 1023px)');
  const [isUserWaving, setIsUserWaving] = useState(false);
  const userWaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasMinimizedPreference) {
      return;
    }
    window.localStorage.setItem(MINIMIZED_STORAGE_KEY, String(isMinimized));
  }, [hasMinimizedPreference, isMinimized]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(DISABLED_STORAGE_KEY, String(isDisabled));
  }, [isDisabled]);

  useEffect(() => {
    movementRef.current = movement;
  }, [movement]);

  useEffect(() => {
    if (!reaction) {
      return undefined;
    }

    if (isDisabled || isMinimized || isOnboardingActive || isOverlaySuppressed) {
      dismissReaction();
      return undefined;
    }

    const shell = shellRef.current;
    const shouldReduceTravel = prefersReducedMotion || isCompact || !shell;
    const timers: number[] = [];

    if (shouldReduceTravel) {
      setMovement({
        phase: 'reacting',
        offsetX: 0,
        offsetY: 0,
        reaction,
      });
      timers.push(window.setTimeout(() => {
        setMovement(HOME_MOVEMENT);
        dismissReaction();
      }, reaction.durationMs));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const targetOffset = getMovementOffset(shell, movementRef.current, reaction.targetRegion);
    setMovement({
      phase: 'moving',
      offsetX: targetOffset.offsetX,
      offsetY: targetOffset.offsetY,
      reaction,
    });

    timers.push(window.setTimeout(() => {
      setMovement((current) => ({
        ...current,
        phase: 'reacting',
      }));
    }, MOVE_DURATION_MS));

    timers.push(window.setTimeout(() => {
      setMovement((current) => ({
        ...current,
        phase: 'returning',
        offsetX: 0,
        offsetY: 0,
      }));
    }, MOVE_DURATION_MS + reaction.durationMs));

    timers.push(window.setTimeout(() => {
      setMovement(HOME_MOVEMENT);
      dismissReaction();
    }, MOVE_DURATION_MS + reaction.durationMs + RETURN_DURATION_MS));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissReaction, isCompact, isDisabled, isMinimized, isOnboardingActive, isOverlaySuppressed, prefersReducedMotion, reaction]);

  const handleMascotClick = useCallback(() => {
    if (isDisabled || isMinimized || movement.phase !== 'idle') {
      return;
    }
    if (userWaveTimerRef.current) {
      window.clearTimeout(userWaveTimerRef.current);
    }
    setIsUserWaving(true);
    userWaveTimerRef.current = window.setTimeout(() => {
      setIsUserWaving(false);
      userWaveTimerRef.current = null;
    }, 2000);
  }, [isDisabled, isMinimized, movement.phase]);

  const activeReaction = movement.reaction ?? reaction;
  const mood = activeReaction?.mood ?? 'coach';
  const styles = moodStyles[mood];
  const workflowHint = getWorkflowHint(workflowState);
  const workflowMessage = t(workflowHint.key, workflowHint.fallback);
  const message = activeReaction
    ? t(activeReaction.messageKey, activeReaction.fallbackMessage)
    : workflowMessage;
  const shouldUseMinimalPresentation = isCompact || isOnboardingActive;

  const mascotPose = useMemo<MascotPose>(() => {
    if (movement.phase === 'moving' || movement.phase === 'returning') {
      return 'fly';
    }
    if (isUserWaving) {
      return 'wave';
    }
    return styles.image;
  }, [movement.phase, styles.image, isUserWaving]);
  const shellStyle: ShellStyle = {
    '--hr-super-saud-offset-x': `${movement.offsetX}px`,
    '--hr-super-saud-offset-y': `${movement.offsetY}px`,
  };

  if (isOverlaySuppressed) {
    return null;
  }

  if (isDisabled) {
    return (
      <aside
        className={cn('hr-super-saud-shell', isOnboardingActive && 'hr-super-saud-shell--onboarding')}
        aria-label="HR Super Saud"
        aria-live="polite"
      >
        <div className="hr-super-saud-card hr-super-saud-card--disabled">
          <HRSuperSaudMascotImage
            className="hr-super-saud-avatar hr-super-saud-avatar--disabled"
            pose="idle"
          />
          <div className="hr-super-saud-controls">
            <button
              type="button"
              onClick={() => setIsDisabled(false)}
              className="hr-super-saud-control"
              aria-label={t('sections.match.assistant.enable', 'Enable HR Super Saud')}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setHasMinimizedPreference(true);
                setIsMinimized(true);
              }}
              className="hr-super-saud-control"
              aria-label={t('sections.match.assistant.hide', 'Hide HR Super Saud feedback')}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (isMinimized || shouldUseMinimalPresentation || forceMinimized) {
    if (shouldUseMinimalPresentation) {
      return (
        <div
          className={cn('hr-super-saud-shell hr-super-saud-shell--minimal', isOnboardingActive && 'hr-super-saud-shell--onboarding')}
          role="status"
          aria-live="polite"
        >
          <div className="hr-super-saud-restore hr-super-saud-restore--minimal">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{workflowMessage}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="hr-super-saud-shell">
        <button
          type="button"
          onClick={() => {
            setHasMinimizedPreference(true);
            setIsMinimized(false);
          }}
          className="hr-super-saud-restore"
          aria-label={t('sections.match.assistant.restore', 'Show HR Super Saud feedback')}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {workflowMessage}
        </button>
      </div>
    );
  }

  return (
    <aside
      ref={shellRef}
      className={cn('hr-super-saud-shell', activeReaction && 'hr-super-saud-shell--active')}
      data-phase={movement.phase}
      style={shellStyle}
      aria-label="HR Super Saud"
      aria-live="polite"
    >
      {((movement.phase === 'idle' && !activeReaction) || (movement.phase === 'reacting' && activeReaction) || isUserWaving) && (
        <div className="hr-super-saud-bubble" dir="auto">
          {isUserWaving
            ? t('hrSuperSaud.waveGreeting', 'Hello. Ready to help you sharpen this application.')
            : message}
        </div>
      )}
      <div className="hr-super-saud-card">
        <button
          type="button"
          className="hr-super-saud-avatar-btn"
          onClick={handleMascotClick}
          aria-label={t('hrSuperSaud.waveLabel', 'Wave to HR Super Saud')}
        >
          <HRSuperSaudMascotImage
            className="hr-super-saud-avatar"
            pose={mascotPose}
          />
        </button>
        <div className="hr-super-saud-controls">
          <button
            type="button"
            onClick={() => setIsDisabled(true)}
            className="hr-super-saud-control"
            aria-label={t('sections.match.assistant.disable', 'Disable HR Super Saud')}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setHasMinimizedPreference(true);
              setIsMinimized(true);
            }}
            className="hr-super-saud-control"
            aria-label={t('sections.match.assistant.hide', 'Hide HR Super Saud feedback')}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
