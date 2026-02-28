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
  'data-tour'?: string;
}

export function GlassTabs({ tabs, activeValue, onTabChange, rightAction, 'data-tour': dataTour }: GlassTabsProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <nav
      className="neu-card relative flex w-full items-center p-1.5 rounded-2xl transition-all duration-300"
      role="tablist"
    >
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1">
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
                'relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap outline-none select-none shrink-0',
                isActive
                  ? 'tab-embossed active'
                  : 'tab-embossed text-gray-400 hover:text-white'
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

