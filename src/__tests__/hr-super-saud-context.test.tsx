import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HRSuperSaudOverlay, HRSuperSaudProvider, useHRSuperSaud, type HRSuperSaudWorkflowState } from '../features/hr-super-saud';

let language = 'en';

const translations: Record<string, Record<string, string>> = {
  en: {
    'hrSuperSaud.stepOneHint': 'Upload a selectable PDF, DOCX, or TXT resume to begin.',
    'hrSuperSaud.resumeUploadedHint': 'Great. Now continue to match your resume with a job ad.',
    'hrSuperSaud.waveGreeting': 'Hello. Ready to help you sharpen this application.',
    'hrSuperSaud.waveLabel': 'Wave to HR Super Saud',
    'hrSuperSaud.reactions.resumeUploaded': 'Great. Now continue to match your resume with a job ad.',
    'sections.match.assistant.restore': 'Show HR Super Saud feedback',
    'sections.match.assistant.hide': 'Hide HR Super Saud feedback',
    'sections.match.assistant.disable': 'Disable HR Super Saud',
    'sections.match.assistant.enable': 'Enable HR Super Saud',
  },
  ar: {
    'hrSuperSaud.stepOneHint': 'ارفع سيرة ذاتية قابلة للتحديد بصيغة PDF أو DOCX أو TXT للبدء.',
    'hrSuperSaud.resumeUploadedHint': 'ممتاز. الآن تابع لمطابقة سيرتك مع إعلان وظيفي.',
    'hrSuperSaud.waveGreeting': 'أهلًا. جاهز أساعدك تصقل هذا الطلب.',
    'hrSuperSaud.waveLabel': 'لوّح لـ HR Super Saud',
    'hrSuperSaud.reactions.resumeUploaded': 'ممتاز. الآن تابع لمطابقة سيرتك مع إعلان وظيفي.',
    'sections.match.assistant.restore': 'إظهار ملاحظات HR Super Saud',
    'sections.match.assistant.hide': 'إخفاء ملاحظات HR Super Saud',
    'sections.match.assistant.disable': 'تعطيل HR Super Saud',
    'sections.match.assistant.enable': 'تفعيل HR Super Saud',
  },
};

function translate(key: string, fallback?: string) {
  return translations[language]?.[key] ?? fallback ?? key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: {
      get language() {
        return language;
      },
      dir: () => (language === 'ar' ? 'rtl' : 'ltr'),
    },
  }),
}));

function WorkflowStateSetter({ state }: { state: HRSuperSaudWorkflowState }) {
  const { setWorkflowState } = useHRSuperSaud();

  useEffect(() => {
    setWorkflowState(state);
  }, [setWorkflowState, state]);

  return null;
}

function renderAssistant({
  isCompact = false,
  isOnboardingActive = false,
  state = 'noResume',
}: {
  isCompact?: boolean;
  isOnboardingActive?: boolean;
  state?: HRSuperSaudWorkflowState;
} = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width') ? isCompact : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return render(
    <HRSuperSaudProvider>
      <WorkflowStateSetter state={state} />
      <HRSuperSaudOverlay isOnboardingActive={isOnboardingActive} />
    </HRSuperSaudProvider>,
  );
}

describe('HR Super Saud contextual assistant', () => {
  beforeEach(() => {
    language = 'en';
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows one actionable Step 1 upload hint by default', () => {
    renderAssistant();

    expect(screen.getByText('Upload a selectable PDF, DOCX, or TXT resume to begin.')).toBeInTheDocument();
    expect(screen.queryByText('Upload a selectable PDF or DOCX to begin.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready when you are.')).not.toBeInTheDocument();
  });

  it('updates the hint after a resume is uploaded', () => {
    renderAssistant({ state: 'resumeUploaded' });

    expect(screen.getByText('Great. Now continue to match your resume with a job ad.')).toBeInTheDocument();
    expect(screen.queryByText('Upload a selectable PDF, DOCX, or TXT resume to begin.')).not.toBeInTheDocument();
  });

  it('uses Arabic copy without raw keys in Arabic mode', () => {
    language = 'ar';

    renderAssistant({ state: 'resumeUploaded' });

    expect(screen.getByText('ممتاز. الآن تابع لمطابقة سيرتك مع إعلان وظيفي.')).toBeInTheDocument();
    expect(screen.queryByText(/hrSuperSaud|Great\. Now|Upload a selectable/)).not.toBeInTheDocument();
  });

  it('collapses to a minimal status hint while onboarding is active', () => {
    window.localStorage.setItem('watheq:hrSuperSaud:minimized', 'false');

    renderAssistant({ isOnboardingActive: true });

    expect(screen.getByRole('status')).toHaveTextContent('Upload a selectable PDF, DOCX, or TXT resume to begin.');
    expect(screen.queryByRole('button', { name: /wave to hr super saud/i })).not.toBeInTheDocument();
  });
});
