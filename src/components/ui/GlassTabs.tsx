import React from 'react';
import { motion } from 'framer-motion';
import { LockKeyhole } from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';

export interface Tab {
  value: string;
  label: string;
  labelAr?: string;
  icon?: React.ElementType;
  isPremium?: boolean;
  disabledReason?: string;
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
      className={cn("relative flex w-full items-center rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] p-1.5 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-black/50", className)}
      role="tablist"
      data-tour={dataTour}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1 py-1">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeValue === tab.value;
          const isDisabled = Boolean(tab.disabledReason);

          return (
            <motion.button
              key={tab.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 20 }}
              whileHover={isDisabled ? undefined : { scale: 1.02 }}
              whileTap={isDisabled ? undefined : { scale: 0.95 }}
              onClick={() => {
                if (!isDisabled) {
                  onTabChange(tab.value);
                }
              }}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={tab.disabledReason}
              className={cn(
                'relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold whitespace-nowrap outline-none select-none shrink-0 z-10 rounded-xl ml-0.5 mr-0.5 border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
                isDisabled
                  ? 'cursor-not-allowed border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-500 opacity-75 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45'
                  : isActive
                  ? tab.isPremium ? 'text-white drop-shadow-md' : 'text-gray-950 dark:text-white'
                  : tab.isPremium
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-100 dark:border-emerald-500/20'
                    : 'text-gray-600 hover:bg-[color:var(--surface-control-hover)] hover:text-gray-950 dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white'
              )}
            >
              {/* Animated active indicator background */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className={cn(
                    "absolute inset-0 rounded-xl -z-10",
                    tab.isPremium 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/30" 
                      : "tab-embossed"
                  )}
                  transition={springTransition}
                >
                  {/* Subtle shine effect for active tab */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-70" />
                </motion.div>
              )}

              {Icon && (
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
              )}
              {isDisabled && <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {/* Show text on mobile for better UX, container scrolls */}
              <span className="relative z-10">{isArabic && tab.labelAr ? tab.labelAr : tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {rightAction && (
        <div className="flex-shrink-0 flex items-center ps-1 ms-1 border-s border-[color:var(--glass-border)] dark:border-white/10">
          {rightAction}
        </div>
      )}
    </nav>
  );
}


