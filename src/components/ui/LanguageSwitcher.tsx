import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/cn';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { currentLanguage, toggleLanguage } = useDirection();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        'flex items-center rounded-xl bg-[color:var(--surface-control)] dark:bg-black/40 backdrop-blur-xl border border-[color:var(--glass-border)] dark:border-white/10 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/15 hover:border-[color:var(--glass-border-strong)] dark:hover:border-white/20 transition-[color,background-color,border-color,scale] duration-200 ease-out active:scale-[0.96] text-sm font-medium shadow-sm text-gray-800 dark:text-white',
        compact
          ? 'h-11 w-11 min-h-[44px] min-w-[44px] justify-center p-0'
          : 'gap-2 px-3 py-2'
      )}
      aria-label={t('common.language', 'Language')}
    >
      <Globe className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      <span className={compact ? 'sr-only' : undefined}>
        {currentLanguage === 'ar' ? 'English' : 'العربية'}
      </span>
    </button>
  );
}




