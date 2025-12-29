import { useDirection } from '../providers/DirectionProvider';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { currentLanguage, toggleLanguage } = useDirection();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all text-sm font-medium shadow-lg"
      aria-label="Toggle language"
    >
      <Globe className="w-4 h-4" />
      <span>{currentLanguage === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}




