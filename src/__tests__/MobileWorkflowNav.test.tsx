import { fireEvent, render, screen, within } from '@testing-library/react';
import { FileText, LayoutTemplate, Sparkles, Target } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { MobileWorkflowNav, type MobileWorkflowItem } from '../components/ui/MobileWorkflowNav';

let language = 'en';

const translations: Record<string, Record<string, string>> = {
  en: {
    'workspace.mobileWorkflow.ariaLabel': 'Workflow navigation',
    'workspace.mobileWorkflow.stepProgress': 'Step {{current}} of {{total}}',
    'workspace.mobileWorkflow.toolProgress': 'Tool',
    'workspace.mobileWorkflow.currentStep': 'Current step',
    'workspace.mobileWorkflow.nextAction': 'Next: {{label}}',
    'workspace.mobileWorkflow.openSteps': 'All steps and tools',
    'workspace.mobileWorkflow.moreTools': 'More tools',
    'workspace.mobileWorkflow.current': 'Current',
    'workspace.mobileWorkflow.available': 'Available',
    'workspace.mobileWorkflow.locked': 'Locked',
  },
  ar: {
    'workspace.mobileWorkflow.ariaLabel': 'تنقل خطوات العمل',
    'workspace.mobileWorkflow.stepProgress': 'الخطوة {{current}} من {{total}}',
    'workspace.mobileWorkflow.toolProgress': 'أداة',
    'workspace.mobileWorkflow.currentStep': 'الخطوة الحالية',
    'workspace.mobileWorkflow.nextAction': 'التالي: {{label}}',
    'workspace.mobileWorkflow.openSteps': 'كل الخطوات والأدوات',
    'workspace.mobileWorkflow.moreTools': 'أدوات إضافية',
    'workspace.mobileWorkflow.current': 'الحالية',
    'workspace.mobileWorkflow.available': 'متاحة',
    'workspace.mobileWorkflow.locked': 'مغلقة',
  },
};

function translate(key: string, fallbackOrOptions?: string | Record<string, unknown>) {
  const fallback =
    typeof fallbackOrOptions === 'object' && fallbackOrOptions
      ? String(fallbackOrOptions.defaultValue ?? key)
      : typeof fallbackOrOptions === 'string'
        ? fallbackOrOptions
        : key;
  const options = typeof fallbackOrOptions === 'object' && fallbackOrOptions ? fallbackOrOptions : {};
  let value = translations[language]?.[key] ?? fallback;

  Object.entries(options).forEach(([name, optionValue]) => {
    if (name !== 'defaultValue') {
      value = value.replaceAll(`{{${name}}}`, String(optionValue));
    }
  });

  return value;
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

const primarySteps: MobileWorkflowItem[] = [
  { value: 'resume', label: 'Resume', icon: FileText },
  { value: 'match', label: 'Job Ad', icon: Target },
  { value: 'optimize', label: 'Optimize', icon: Sparkles },
  { value: 'templates', label: 'Export', icon: LayoutTemplate },
];

const renderNav = (
  props: Partial<{
    primarySteps: MobileWorkflowItem[];
    secondarySteps: MobileWorkflowItem[];
    activeValue: string;
    onStepChange: (value: string) => void;
    gateReason: string;
  }> = {}
) => {
  const onStepChange = props.onStepChange ?? vi.fn();

  render(
    <MobileWorkflowNav
      primarySteps={props.primarySteps ?? primarySteps}
      secondarySteps={props.secondarySteps ?? []}
      activeValue={props.activeValue ?? 'resume'}
      onStepChange={onStepChange}
      gateReason={props.gateReason ?? 'Upload a resume first to unlock the next steps.'}
    />
  );

  return { onStepChange };
};

describe('MobileWorkflowNav', () => {
  it('keeps Resume current and locked future steps disabled before upload', () => {
    language = 'en';
    const lockedSteps = primarySteps.map((step) =>
      step.value === 'resume'
        ? step
        : { ...step, disabledReason: 'Upload a resume first to unlock the next steps.' }
    );

    renderNav({ primarySteps: lockedSteps });

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Upload a resume first to unlock the next steps.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('All steps and tools'));

    const resumeStep = screen.getByRole('button', { name: /Resume Current/i });
    const jobAdStep = screen.getByRole('button', { name: /Job Ad Locked/i });
    expect(resumeStep).toHaveAttribute('aria-current', 'step');
    expect(jobAdStep).toBeDisabled();
    expect(jobAdStep).toHaveAttribute('aria-disabled', 'true');
  });

  it('makes Job Ad the next mobile action after resume upload', () => {
    language = 'en';
    const { onStepChange } = renderNav();

    fireEvent.click(screen.getByRole('button', { name: 'Next: Job Ad' }));

    expect(onStepChange).toHaveBeenCalledWith('match');
  });

  it('renders Arabic workflow labels without raw keys or English leakage', () => {
    language = 'ar';
    const arabicSteps: MobileWorkflowItem[] = [
      { value: 'resume', label: 'السيرة الذاتية', icon: FileText },
      { value: 'match', label: 'إعلان الوظيفة', icon: Target },
      { value: 'optimize', label: 'التحسين', icon: Sparkles },
      { value: 'templates', label: 'التصدير', icon: LayoutTemplate },
    ];

    renderNav({
      primarySteps: arabicSteps,
      gateReason: 'ارفع سيرتك الذاتية أولاً لفتح الخطوات التالية.',
    });

    const nav = screen.getByRole('navigation', { name: 'تنقل خطوات العمل' });
    expect(nav).toHaveAttribute('dir', 'rtl');
    expect(within(nav).getAllByText('السيرة الذاتية').length).toBeGreaterThan(0);
    expect(within(nav).getAllByText('التالي: إعلان الوظيفة').length).toBeGreaterThan(0);
    expect(within(nav).queryByText(/workspace\.mobileWorkflow|Job Ad|Resume|Next/)).not.toBeInTheDocument();
  });
});
