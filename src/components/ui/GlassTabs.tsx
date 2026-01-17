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
  rightAction?: React.ReactNode;
}

export function GlassTabs({ tabs, activeValue, onTabChange, rightAction }: GlassTabsProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <nav
      className="relative flex w-full items-center p-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-black/50"
      role="tablist"
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeValue === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap outline-none select-none shrink-0',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-white/20 scale-[1.02]'
                  : 'text-gray-400 hover:text-white hover:bg-white/10 active:scale-95'
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
              )}
              {/* Show text on mobile for better UX, container scrolls */}
              <span>{isArabic && tab.labelAr ? tab.labelAr : tab.label}</span>

              {/* Subtle shine effect for active tab */}
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              )}
            </button>
          );
        })}
      </div>

      {rightAction && (
        <div className="flex-shrink-0 flex items-center pl-1 ml-1 border-l border-white/10">
          {rightAction}
        </div>
      )}
    </nav>
  );
}

