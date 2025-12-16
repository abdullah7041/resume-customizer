import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const setLanguage = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <DirectionContext.Provider
      value={{
        direction,
        isRTL: direction === 'rtl',
        toggleLanguage,
        setLanguage,
        currentLanguage: i18n.language,
      }}
    >
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



