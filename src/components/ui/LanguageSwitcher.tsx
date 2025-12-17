import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { currentLanguage, toggleLanguage } = useDirection();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4" />
      <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}




