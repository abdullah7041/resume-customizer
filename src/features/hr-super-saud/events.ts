import {
  isHRSuperSaudEventName,
  type HRSuperSaudEvent,
  type HRSuperSaudEventName,
  type HRSuperSaudEventPayload,
} from './model';

export const HR_SUPER_SAUD_EVENT = 'watheq:hr-super-saud:event';

export function emitHRSuperSaudEvent(
  name: HRSuperSaudEventName,
  payload?: HRSuperSaudEventPayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<HRSuperSaudEvent>(HR_SUPER_SAUD_EVENT, {
      detail: { name, payload },
    }),
  );
}

export function readHRSuperSaudEvent(detail: unknown): HRSuperSaudEvent | null {
  if (!detail || typeof detail !== 'object') {
    return null;
  }

  const candidate = detail as Partial<HRSuperSaudEvent>;
  if (!isHRSuperSaudEventName(candidate.name)) {
    return null;
  }

  return {
    name: candidate.name,
    payload: candidate.payload,
  };
}
