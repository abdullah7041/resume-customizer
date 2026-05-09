export type HRSuperSaudEventName =
  | 'resume.uploaded'
  | 'match.high'
  | 'match.low'
  | 'optimize.success'
  | 'error.generic';

export type HRSuperSaudMood = 'confident' | 'coach' | 'caution';
export type HRSuperSaudMovementPhase = 'idle' | 'moving' | 'reacting' | 'returning';
export type HRSuperSaudTargetRegion = 'upload' | 'match' | 'optimize' | 'status';

export interface HRSuperSaudEventPayload {
  score?: number | null;
}

export interface HRSuperSaudEvent {
  name: HRSuperSaudEventName;
  payload?: HRSuperSaudEventPayload;
}

export interface HRSuperSaudReaction {
  eventName: HRSuperSaudEventName;
  mood: HRSuperSaudMood;
  targetRegion: HRSuperSaudTargetRegion;
  messageKey: string;
  fallbackMessage: string;
  durationMs: number;
}

export const HR_SUPER_SAUD_EVENT_NAMES: HRSuperSaudEventName[] = [
  'resume.uploaded',
  'match.high',
  'match.low',
  'optimize.success',
  'error.generic',
];

const REACTIONS: Record<HRSuperSaudEventName, Omit<HRSuperSaudReaction, 'eventName'>> = {
  'resume.uploaded': {
    mood: 'coach',
    targetRegion: 'upload',
    messageKey: 'hrSuperSaud.reactions.resumeUploaded',
    fallbackMessage: 'Resume received. Next, compare it with the role.',
    durationMs: 4200,
  },
  'match.high': {
    mood: 'confident',
    targetRegion: 'match',
    messageKey: 'hrSuperSaud.reactions.matchHigh',
    fallbackMessage: 'Strong match. Review the evidence, then tailor with care.',
    durationMs: 4200,
  },
  'match.low': {
    mood: 'caution',
    targetRegion: 'match',
    messageKey: 'hrSuperSaud.reactions.matchLow',
    fallbackMessage: 'There are gaps to close before this application is ready.',
    durationMs: 4600,
  },
  'optimize.success': {
    mood: 'confident',
    targetRegion: 'optimize',
    messageKey: 'hrSuperSaud.reactions.optimizeSuccess',
    fallbackMessage: 'Optimization is ready. Review every suggestion before export.',
    durationMs: 4400,
  },
  'error.generic': {
    mood: 'caution',
    targetRegion: 'status',
    messageKey: 'hrSuperSaud.reactions.errorGeneric',
    fallbackMessage: 'Something did not complete. Save your work and try again.',
    durationMs: 5200,
  },
};

export function isHRSuperSaudEventName(value: unknown): value is HRSuperSaudEventName {
  return typeof value === 'string' && HR_SUPER_SAUD_EVENT_NAMES.includes(value as HRSuperSaudEventName);
}

export function getHRSuperSaudReaction(event: HRSuperSaudEvent): HRSuperSaudReaction {
  return {
    eventName: event.name,
    ...REACTIONS[event.name],
  };
}
