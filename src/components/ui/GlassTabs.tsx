import React from 'react';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';

interface Tab {
  value: string;
  label: string;
  labelAr?: string;
  icon?: React.ElementType;
}

interface GlassTabsProps {
  tabs: Tab[];
  activeValue: string;
  onTabChange: (value: string) => void;
}

export function GlassTabs({ tabs, activeValue, onTabChange }: GlassTabsProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <div className="flex flex-wrap gap-1.5 p-1 bg-white/5 backdrop-blur-sm rounded-xl overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap',
              activeValue === tab.value
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span className="hidden sm:inline">{isArabic && tab.labelAr ? tab.labelAr : tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
