import React from 'react';
import { motion } from 'framer-motion';
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
  className?: string;
}

// Spring physics for the sliding tab indicator
const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8
};

export function GlassTabs({ tabs, activeValue, onTabChange, rightAction, 'data-tour': dataTour, className }: GlassTabsProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <nav
      className={cn("neu-card relative flex w-full items-center p-1.5 rounded-2xl", className)}
      role="tablist"
      data-tour={dataTour}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeValue === tab.value;

          return (
            <motion.button
              key={tab.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 20 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onTabChange(tab.value)}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap outline-none select-none shrink-0 z-10',
                isActive
                  ? 'text-gray-900 dark:text-white drop-shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {/* Animated active indicator background */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 tab-embossed rounded-xl -z-10"
                  transition={springTransition}
                >
                  {/* Subtle shine effect for active tab */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </motion.div>
              )}

              {Icon && (
                <Icon
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
              )}
              {/* Show text on mobile for better UX, container scrolls */}
              <span className="relative z-10">{isArabic && tab.labelAr ? tab.labelAr : tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {rightAction && (
        <div className="flex-shrink-0 flex items-center pl-1 ml-1 border-l border-gray-200 dark:border-white/10">
          {rightAction}
        </div>
      )}
    </nav>
  );
}


