import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditBalance } from '../components/Credits/CreditBalance';
import Header from '../components/Layout/Header';
import { SettingsModal } from '../components/Settings/SettingsModal';

let language = 'ar';

const translations: Record<string, Record<string, string>> = {
  en: {
    'common.appName': 'Watheq',
    'common.byAuthor': 'By Abdullah bin Ahmed',
    'common.language': 'Language',
    'common.settings': 'Settings',
    'common.signOut': 'Sign Out',
    'common.signIn': 'Sign In',
    'common.yes': 'Yes',
    'common.cancel': 'Cancel',
    'common.toggleTheme': 'Toggle theme',
    'common.openNavigation': 'Open navigation menu',
    'common.accountMenu': 'Account menu',
    'common.closeNavigation': 'Close navigation menu',
    'common.closeDialog': 'Close dialog',
    'credits.balance': 'Credits',
    'credits.balanceDisplay': '{{remaining}} / {{total}} credits',
    'credits.refresh': 'Refresh credits',
    'referrals.inviteEarn': 'Invite friends and earn',
    'referrals.inviteShort': 'Invite',
    'referrals.inviteFriends': 'Invite Friends',
    'referrals.creditsBonus': '+5 Credits',
    'pricing.workspaceCta': 'Need more credits? View plans',
    'settings.accountInformation': 'Account information',
    'settings.verifiedAccount': 'Verified account',
    'settings.dataPrivacy': 'Data & Privacy',
    'settings.exportPersonalData': 'Export personal data',
    'settings.exportPersonalDataDescription': 'Download a copy of your resumes and optimizations in JSON format.',
    'settings.deleteAccountDescription': 'Permanently delete your account and all associated data.',
    'settings.deleteConfirmQuestion': 'Are you sure?',
    'dataRights.export.button': 'Export Data',
    'dataRights.export.exporting': 'Exporting...',
    'dataRights.delete.title': 'Delete Account',
    'dataRights.delete.button': 'Delete Account',
  },
  ar: {
    'common.appName': 'واثق',
    'common.byAuthor': 'من تطوير عبدالله بن أحمد',
    'common.language': 'اللغة',
    'common.settings': 'الإعدادات',
    'common.signOut': 'خروج',
    'common.signIn': 'دخول',
    'common.yes': 'نعم',
    'common.cancel': 'إلغاء',
    'common.toggleTheme': 'تبديل المظهر',
    'common.openNavigation': 'فتح قائمة التنقل',
    'common.accountMenu': 'قائمة الحساب',
    'common.closeNavigation': 'إغلاق قائمة التنقل',
    'common.closeDialog': 'إغلاق النافذة',
    'credits.balance': 'الرصيد',
    'credits.balanceDisplay': '{{remaining}} من {{total}} رصيد',
    'credits.refresh': 'تحديث الرصيد',
    'referrals.inviteEarn': 'ادعُ الأصدقاء واكسب',
    'referrals.inviteShort': 'دعوة',
    'referrals.inviteFriends': 'دعوة الأصدقاء',
    'referrals.creditsBonus': '+5 رصيد',
    'pricing.workspaceCta': 'تحتاج رصيدًا أكثر؟ عرض الباقات',
    'settings.accountInformation': 'معلومات الحساب',
    'settings.verifiedAccount': 'حساب موثّق',
    'settings.dataPrivacy': 'البيانات والخصوصية',
    'settings.exportPersonalData': 'تصدير البيانات الشخصية',
    'settings.exportPersonalDataDescription': 'نزّل نسخة من سيرك الذاتية والتحسينات بصيغة JSON.',
    'settings.deleteAccountDescription': 'حذف حسابك نهائياً مع كل البيانات المرتبطة به.',
    'settings.deleteConfirmQuestion': 'هل أنت متأكد؟',
    'dataRights.export.button': 'تصدير البيانات',
    'dataRights.export.exporting': 'جاري التصدير...',
    'dataRights.delete.title': 'حذف الحساب',
    'dataRights.delete.button': 'حذف الحساب',
  },
};

function translate(key: string, fallbackOrOptions?: string | Record<string, unknown>) {
  const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key;
  const options = typeof fallbackOrOptions === 'object' && fallbackOrOptions ? fallbackOrOptions : {};
  let value = translations[language]?.[key] ?? fallback;

  Object.entries(options).forEach(([name, optionValue]) => {
    value = value.replaceAll(`{{${name}}}`, String(optionValue));
  });

  return value;
}

const refetchMock = vi.fn();
const signOutMock = vi.fn();
const signInWithGoogleMock = vi.fn();

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

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: {
      remaining: 14,
      total: 20,
      feedbackCreditsEarned: 0,
      referralCreditsEarned: 0,
      resetDate: null,
    },
    isLoading: false,
    error: null,
    refetch: refetchMock,
    showUpgrade: false,
    setShowUpgrade: vi.fn(),
    upgradeDismissedKey: null,
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'sara@example.com', user_metadata: {}, app_metadata: {} },
    loading: false,
    signOut: signOutMock,
    signInWithGoogle: signInWithGoogleMock,
  }),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ['light', vi.fn()],
}));

vi.mock('../lib/assets', () => ({
  getSkylineUrls: () => ({
    desktop: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    mobile: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  }),
}));

vi.mock('../components/ui/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <button type="button">English</button>,
}));

vi.mock('../components/Credits/CreditUsageModal', () => ({
  CreditUsageModal: () => null,
}));

vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Plans modal</div> : null),
}));
vi.mock('../components/Credits/PricingWaitlistModal', () => ({
  PricingWaitlistModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Pricing waitlist modal</div> : null),
}));

describe('Arabic workspace localization', () => {
  beforeEach(() => {
    language = 'ar';
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders Arabic credit balance without ambiguous slash ordering', () => {
    render(<CreditBalance onClick={vi.fn()} />);

    expect(screen.getByText('14 من 20 رصيد')).toBeInTheDocument();
    expect(screen.queryByText(/14\s*\/\s*20/)).not.toBeInTheDocument();
  });

  it('keeps the English credit balance compact and semantic', () => {
    language = 'en';

    render(<CreditBalance onClick={vi.fn()} />);

    expect(screen.getByText('14 / 20 credits')).toBeInTheDocument();
  });

  it('localizes authenticated mobile menu labels in Arabic', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'فتح قائمة التنقل' }));

    const menu = screen.getByRole('dialog');
    expect(within(menu).getByText('اللغة')).toBeInTheDocument();
    expect(within(menu).getByText('تحتاج رصيدًا أكثر؟ عرض الباقات')).toBeInTheDocument();
    expect(within(menu).getByText('دعوة الأصدقاء')).toBeInTheDocument();
    expect(within(menu).getByText('الإعدادات')).toBeInTheDocument();
    expect(within(menu).queryByText(/COMMON\.LANGUAGE|common\.language|Invite Friends|Settings|Need more credits|View plans/)).not.toBeInTheDocument();
  });

  it('keeps authenticated desktop secondary actions inside the account menu', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'قائمة الحساب' })).toBeInTheDocument();
    expect(screen.queryByText('دعوة الأصدقاء')).not.toBeInTheDocument();
    expect(screen.queryByText('الإعدادات')).not.toBeInTheDocument();
    expect(screen.queryByText('خروج')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'قائمة الحساب' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('اللغة')).toBeInTheDocument();
    expect(within(menu).getByText('تحتاج رصيدًا أكثر؟ عرض الباقات')).toBeInTheDocument();
    expect(within(menu).getByText('دعوة الأصدقاء')).toBeInTheDocument();
    expect(within(menu).getByText('الإعدادات')).toBeInTheDocument();
    expect(within(menu).getByText('خروج')).toBeInTheDocument();
  });

  it('localizes the settings modal in Arabic', () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'الإعدادات' })).toBeInTheDocument();
    expect(screen.getByText('معلومات الحساب')).toBeInTheDocument();
    expect(screen.getByText('البيانات والخصوصية')).toBeInTheDocument();
    expect(screen.getByText('تصدير البيانات الشخصية')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تصدير البيانات' })).toBeInTheDocument();
    expect(screen.getAllByText('حذف الحساب')).toHaveLength(2);
    expect(screen.queryByText(/Account Information|Data & Privacy|Export Personal Data/)).not.toBeInTheDocument();
  });
});
