import React from 'react';
import { cn } from '../../lib/utils/cn';

interface Tab {
  id: string;
  label: string;
  labelAr: string;
  icon?: React.ReactNode;
}

interface GlassTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isArabic?: boolean;
}

export function GlassTabs({ tabs, activeTab, onTabChange, isArabic }: GlassTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-1 bg-white/5 backdrop-blur-sm rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          )}
        >
          {tab.icon}
          <span>{isArabic ? tab.labelAr : tab.label}</span>
        </button>
      ))}
    </div>
  );
}

