// src/components/sections/ResumeDiffView.tsx
// Side-by-side (desktop) / toggle (mobile) comparison of original vs optimized resume

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ArrowLeftRight } from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import type { OptimizationResult } from '@/types/templates';

interface ResumeDiffViewProps {
  isOpen: boolean;
  onClose: () => void;
  optimizations: OptimizationResult[];
}

const SECTION_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  summary: { en: 'Summary', ar: 'الملخص' },
  headline: { en: 'Headline', ar: 'العنوان' },
  experience: { en: 'Experience', ar: 'الخبرة' },
  education: { en: 'Education', ar: 'التعليم' },
  projects: { en: 'Projects', ar: 'المشاريع' },
  certifications: { en: 'Certifications', ar: 'الشهادات' },
  skills: { en: 'Skills', ar: 'المهارات' },
};

function formatContent(value: string | string[]): string {
  if (Array.isArray(value)) return value.join('\n• ');
  return value;
}

function DiffSection({ opt, lang }: { opt: OptimizationResult; lang: string }) {
  const isAr = lang === 'ar';
  const label = SECTION_TYPE_LABELS[opt.sectionType] ?? { en: opt.sectionType, ar: opt.sectionType };
  const originalText = formatContent(opt.original);
  const optimizedText = formatContent(opt.optimized);
  const isChanged = originalText !== optimizedText;
  const isAdded = !originalText.trim() && optimizedText.trim();

  if (!isChanged) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wide">
          {isAr ? label.ar : label.en}
        </h3>
        {isAdded ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {isAr ? 'مُضاف' : 'Added'}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {isAr ? 'مُحسَّن' : 'Improved'}
          </span>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-medium text-white/50 mb-2 uppercase">
            {isAr ? 'الأصلي' : 'Original'}
          </p>
          <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
            {Array.isArray(opt.original) ? opt.original.map((item, i) => (
              <span key={i} className="block">• {item}</span>
            )) : originalText || <span className="italic text-white/30">{isAr ? 'فارغ' : 'Empty'}</span>}
          </p>
        </div>
        <div className={`rounded-lg border p-4 ${isAdded ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
          <p className="text-xs font-medium text-emerald-400/70 mb-2 uppercase">
            {isAr ? 'المحسّن' : 'Optimized'}
          </p>
          <p className="text-sm text-white/90 whitespace-pre-line leading-relaxed">
            {Array.isArray(opt.optimized) ? opt.optimized.map((item, i) => (
              <span key={i} className="block">• {item}</span>
            )) : optimizedText}
          </p>
        </div>
      </div>

      {/* Mobile: stacked with green accent on optimized */}
      <div className="md:hidden space-y-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-medium text-white/50 mb-1 uppercase">
            {isAr ? 'الأصلي' : 'Original'}
          </p>
          <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
            {Array.isArray(opt.original) ? opt.original.map((item, i) => (
              <span key={i} className="block">• {item}</span>
            )) : originalText || <span className="italic text-white/30">{isAr ? 'فارغ' : 'Empty'}</span>}
          </p>
        </div>
        <div className={`rounded-lg border-l-4 border-emerald-500/50 ${isAdded ? 'bg-emerald-500/10' : 'bg-emerald-500/5'} p-3`}>
          <p className="text-xs font-medium text-emerald-400/70 mb-1 uppercase">
            {isAr ? 'المحسّن' : 'Optimized'}
          </p>
          <p className="text-sm text-white/90 whitespace-pre-line leading-relaxed">
            {Array.isArray(opt.optimized) ? opt.optimized.map((item, i) => (
              <span key={i} className="block">• {item}</span>
            )) : optimizedText}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResumeDiffView({ isOpen, onClose, optimizations }: ResumeDiffViewProps) {
  const { i18n } = useTranslation();
  const [mobileView, setMobileView] = useState<'original' | 'optimized'>('optimized');
  const lang = i18n.language;
  const isAr = lang === 'ar';

  const appliedOpts = optimizations.filter(o => o.applied);

  if (!isOpen) return null;

  // Group by sectionType for organized display
  const grouped = appliedOpts.reduce<Record<string, OptimizationResult[]>>((acc, opt) => {
    const key = opt.sectionType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {});

  const sectionOrder = ['summary', 'headline', 'experience', 'education', 'projects', 'certifications', 'skills'];

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isAr ? 'عرض التغييرات' : 'View Changes'}
            </h2>
            <p className="text-sm text-white/50 mt-0.5">
              {isAr
                ? `${appliedOpts.length} تحسين مطبّق`
                : `${appliedOpts.length} optimization${appliedOpts.length !== 1 ? 's' : ''} applied`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mobile toggle */}
            <div className="md:hidden flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setMobileView('original')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mobileView === 'original' ? 'bg-white/15 text-white' : 'text-white/50'}`}
              >
                {isAr ? 'الأصلي' : 'Original'}
              </button>
              <button
                onClick={() => setMobileView('optimized')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mobileView === 'optimized' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50'}`}
              >
                {isAr ? 'المحسّن' : 'Optimized'}
              </button>
            </div>
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          {appliedOpts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
              <ArrowLeftRight className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg">{isAr ? 'لا توجد تغييرات مطبّقة بعد' : 'No changes applied yet'}</p>
            </div>
          ) : (
            /* Desktop: full diff sections, Mobile: filtered by toggle */
            <>
              {/* Desktop view */}
              <div className="hidden md:block">
                {sectionOrder.map(type => {
                  const opts = grouped[type];
                  if (!opts) return null;
                  return opts.map(opt => (
                    <DiffSection key={opt.sectionId} opt={opt} lang={lang} />
                  ));
                })}
              </div>

              {/* Mobile view - show only selected side */}
              <div className="md:hidden space-y-4">
                {sectionOrder.map(type => {
                  const opts = grouped[type];
                  if (!opts) return null;
                  return opts.map(opt => {
                    const originalText = formatContent(opt.original);
                    const optimizedText = formatContent(opt.optimized);
                    if (originalText === optimizedText) return null;
                    const label = SECTION_TYPE_LABELS[opt.sectionType] ?? { en: opt.sectionType, ar: opt.sectionType };
                    const isAdded = !originalText.trim() && optimizedText.trim();
                    const content = mobileView === 'original' ? opt.original : opt.optimized;
                    const isOptimizedView = mobileView === 'optimized';

                    return (
                      <div
                        key={opt.sectionId}
                        className={`rounded-lg p-4 border ${isOptimizedView
                          ? (isAdded ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-500/20 bg-emerald-500/5')
                          : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-white/90">
                            {isAr ? label.ar : label.en}
                          </h3>
                          {isOptimizedView && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isAdded
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {isAdded ? (isAr ? 'مُضاف' : 'Added') : (isAr ? 'مُحسَّن' : 'Improved')}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm whitespace-pre-line leading-relaxed ${isOptimizedView ? 'text-white/90' : 'text-white/70'}`}>
                          {Array.isArray(content) ? content.map((item, i) => (
                            <span key={i} className="block">• {item}</span>
                          )) : formatContent(content) || <span className="italic text-white/30">{isAr ? 'فارغ' : 'Empty'}</span>}
                        </p>
                      </div>
                    );
                  });
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-3 flex justify-end">
          <GlassButton onClick={onClose} variant="secondary" size="sm" className="border border-white/20">
            {isAr ? 'إغلاق' : 'Close'}
          </GlassButton>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
