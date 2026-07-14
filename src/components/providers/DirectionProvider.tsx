import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analytics } from '../../services/analytics';

const DirectionContext = createContext(undefined);

export function DirectionProvider({ children }) {
  const { i18n } = useTranslation();
  const [direction, setDirection] = useState('ltr');

  useEffect(() => {
    const isArabic = i18n.language === 'ar';
    const dir = isArabic ? 'rtl' : 'ltr';

    setDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;

    // Update font family for Arabic
    if (isArabic) {
      document.documentElement.style.setProperty('--font-family', "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif");
    } else {
      document.documentElement.style.setProperty('--font-family', "'Inter', sans-serif");
    }
  }, [i18n.language]);

  const toggleLanguage = useCallback(() => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'ar' ? 'en' : 'ar';
    analytics.trackLanguageChange(currentLang, newLang);
    i18n.changeLanguage(newLang);
  }, [i18n]);

  const setLanguage = useCallback((lang) => {
    const currentLang = i18n.language;
    if (currentLang !== lang) {
      analytics.trackLanguageChange(currentLang, lang);
    }
    i18n.changeLanguage(lang);
  }, [i18n]);

  const value = useMemo(
    () => ({
      direction,
      isRTL: direction === 'rtl',
      toggleLanguage,
      setLanguage,
      currentLanguage: i18n.language,
    }),
    [direction, i18n, toggleLanguage, setLanguage],
  );

  return (
    <DirectionContext.Provider value={value}>
      {children}
    </DirectionContext.Provider>
  );
}

export function useDirection() {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider');
  }
  return context;
}




