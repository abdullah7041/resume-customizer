import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { currentLanguage, toggleLanguage } = useDirection();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 dark:bg-black/40 backdrop-blur-xl border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/15 hover:border-gray-400 dark:hover:border-white/20 transition-all text-sm font-medium shadow-sm text-gray-800 dark:text-white"
      aria-label={t('common.language', 'Language')}
    >
      <Globe className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}




