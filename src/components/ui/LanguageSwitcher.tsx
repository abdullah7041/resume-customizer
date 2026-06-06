import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { currentLanguage, toggleLanguage } = useDirection();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--surface-control)] dark:bg-black/40 backdrop-blur-xl border border-[color:var(--glass-border)] dark:border-white/10 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/15 hover:border-[color:var(--glass-border-strong)] dark:hover:border-white/20 transition-all text-sm font-medium shadow-sm text-gray-800 dark:text-white"
      aria-label={t('common.language', 'Language')}
    >
      <Globe className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}




