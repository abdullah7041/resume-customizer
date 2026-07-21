// src/components/ui/FormattingPanel.tsx
// Collapsible side panel for live resume formatting controls

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronUp, Type, FileText, RotateCcw, Sparkles } from 'lucide-react';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { cn } from '../../lib/utils/cn';

// Font family options
const FONT_OPTIONS = [
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Palatino Linotype", Palatino, serif', label: 'Palatino' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: '"Segoe UI", Tahoma, sans-serif', label: 'Segoe UI' },
    { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
];

// Default values for reset
const DEFAULTS = {
    baseFontSize: 10.5,
    headingSize: 13,
    nameSize: 20,
    fontFamily: 'Georgia, serif',
    sectionSpacing: 8,
    paragraphSpacing: 6,
    lineHeight: 1.55,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginSide: 0.6,
};

// Recommended compact fit - optimized for 1-page resume
// Reduces white space while maintaining readability
const COMPACT_FIT = {
    baseFontSize: 10,
    headingSize: 12.5,
    nameSize: 18,
    fontFamily: 'Arial, Helvetica, sans-serif', // Clean, compact font
    sectionSpacing: 8,
    paragraphSpacing: 4,
    lineHeight: 1.35,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginSide: 0.5,
};

// Panel variants for spring animation
const panelVariants = {
    expanded: {
        width: 288,
        transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 }
    },
    collapsed: {
        width: 56,
        transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 }
    }
};

const contentVariants = {
    hidden: { opacity: 0, y: -10, transition: { duration: 0.1 } },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 20, delay: 0.1 } }
};

interface SliderControlProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (value: number) => void;
}

function SliderControl({ label, value, min, max, step, unit, onChange }: SliderControlProps) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-white/70">{label}</span>
                <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                    {value}{unit}
                </span>
            </div>
            <m.input
                whileHover={{ scaleY: 1.2 }}
                whileTap={{ scaleY: 1.5 }}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors origin-left"
            />
        </div>
    );
}

export function FormattingPanel() {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [isExpanded, setIsExpanded] = useState(true);
    const fontStyleId = useId();

    const displayOptions = useResumeStore((state) => state.displayOptions);
    const setDisplayOptions = useResumeStore((state) => state.setDisplayOptions);

    const handleReset = () => {
        setDisplayOptions(DEFAULTS);
    };

    const handleCompactFit = () => {
        setDisplayOptions(COMPACT_FIT);
    };

    return (
        <m.div
            variants={panelVariants}
            initial="expanded"
            animate={isExpanded ? "expanded" : "collapsed"}
            className={cn(
                "neu-card rounded-2xl overflow-hidden"
            )}
        >
            {/* Header Toggle */}
            <m.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <AnimatePresence initial={false}>
                        {isExpanded && (
                            <m.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="font-semibold text-gray-900 dark:text-white whitespace-nowrap"
                            >
                                {t('templates.formatting.title', 'Formatting')}
                            </m.span>
                        )}
                    </AnimatePresence>
                </div>
                <m.div
                    animate={{ rotate: isExpanded ? 0 : 180 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-900 dark:text-white/50 dark:group-hover:text-white transition-colors" />
                </m.div>
            </m.button>

            {/* Expanded Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <m.div
                        variants={contentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="px-4 pb-4 space-y-6 origin-top overflow-hidden"
                    >
                        {/* Font Formatting Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-white/50">
                                <Type className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase tracking-wider">
                                    {t('templates.formatting.fontFormatting', 'Font Formatting')}
                                </span>
                            </div>

                            {/* Font Style Dropdown */}
                            <div className="space-y-2">
                                <label htmlFor={fontStyleId} className="text-sm text-gray-700 dark:text-white/70">
                                    {t('templates.formatting.fontStyle', 'Font Style')}
                                </label>
                                <m.select
                                    id={fontStyleId}
                                    whileTap={{ scale: 0.96 }}
                                    value={displayOptions.fontFamily}
                                    onChange={(e) => setDisplayOptions({ fontFamily: e.target.value })}
                                    className="w-full px-3 py-2 neu-inset rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                                >
                                    {FONT_OPTIONS.map((font) => (
                                        <option key={font.value} value={font.value} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                            {font.label}
                                        </option>
                                    ))}
                                </m.select>
                            </div>

                            <SliderControl
                                label={t('templates.formatting.fontSize', 'Font Size')}
                                value={displayOptions.baseFontSize}
                                min={9}
                                max={12}
                                step={0.5}
                                unit="pt"
                                onChange={(v) => setDisplayOptions({ baseFontSize: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.nameSize', 'Name Size')}
                                value={displayOptions.nameSize ?? 20}
                                min={16}
                                max={28}
                                step={0.5}
                                unit="pt"
                                onChange={(v) => setDisplayOptions({ nameSize: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.headingSize', 'Heading Size')}
                                value={displayOptions.headingSize}
                                min={12}
                                max={18}
                                step={0.5}
                                unit="pt"
                                onChange={(v) => setDisplayOptions({ headingSize: v })}
                            />
                        </div>

                        {/* Divider */}
                        <div className="border-t border-dashed border-gray-300 dark:border-white/10" />

                        {/* Document Formatting Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-white/50">
                                <FileText className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase tracking-wider">
                                    {t('templates.formatting.documentFormatting', 'Document Formatting')}
                                </span>
                            </div>

                            <SliderControl
                                label={t('templates.formatting.sectionSpacing', 'Section Spacing')}
                                value={displayOptions.sectionSpacing}
                                min={4}
                                max={20}
                                step={1}
                                unit="px"
                                onChange={(v) => setDisplayOptions({ sectionSpacing: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.paragraphSpacing', 'Paragraph Spacing')}
                                value={displayOptions.paragraphSpacing}
                                min={2}
                                max={12}
                                step={1}
                                unit="px"
                                onChange={(v) => setDisplayOptions({ paragraphSpacing: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.lineSpacing', 'Line Spacing')}
                                value={displayOptions.lineHeight}
                                min={1.2}
                                max={2.0}
                                step={0.05}
                                unit=""
                                onChange={(v) => setDisplayOptions({ lineHeight: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.verticalMargins', 'Top & Bottom Margin')}
                                value={displayOptions.marginTop}
                                min={0.3}
                                max={1.0}
                                step={0.1}
                                unit="in"
                                onChange={(v) => setDisplayOptions({ marginTop: v, marginBottom: v })}
                            />

                            <SliderControl
                                label={t('templates.formatting.sideMargins', 'Side Margins')}
                                value={displayOptions.marginSide}
                                min={0.3}
                                max={1.0}
                                step={0.1}
                                unit="in"
                                onChange={(v) => setDisplayOptions({ marginSide: v })}
                            />

                            {/* Page Break Toggle */}
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-sm text-gray-700 dark:text-white/70">
                                    {t('templates.formatting.showPageBreaks', 'Show Page Breaks')}
                                </span>
                                <m.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setDisplayOptions({ showPageBreaks: !displayOptions.showPageBreaks })}
                                    className={cn(
                                        "relative w-10 h-5 rounded-full transition-colors",
                                        displayOptions.showPageBreaks
                                            ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                                            : "bg-gray-300 dark:bg-white/20 shadow-inner"
                                    )}
                                >
                                    <m.span
                                        animate={{ x: displayOptions.showPageBreaks ? (isArabic ? -20 : 20) : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className={cn(
                                            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm"
                                        )}
                                    />
                                </m.button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-2">
                            {/* Recommended Fit Button - Primary CTA */}
                            <m.button
                                whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(16,185,129,0.2)' }}
                                whileTap={{ scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                onClick={handleCompactFit}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 btn-metal rounded-lg text-white text-sm font-medium"
                            >
                                <Sparkles className="w-4 h-4" />
                                {t('templates.formatting.recommendedFit', 'Recommended Fit')}
                            </m.button>

                            {/* Reset Button - Secondary */}
                            <m.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                onClick={handleReset}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 btn-spring neu-inset hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white text-sm"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {t('templates.formatting.reset', 'Reset to Defaults')}
                            </m.button>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </m.div>
    );
}
