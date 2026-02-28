// src/components/ui/FormattingPanel.tsx
// Collapsible side panel for live resume formatting controls

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Type, FileText, RotateCcw, Sparkles } from 'lucide-react';
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
    headingSize: 14,
    fontFamily: 'Georgia, serif',
    sectionSpacing: 12,
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
    fontFamily: 'Arial, Helvetica, sans-serif', // Clean, compact font
    sectionSpacing: 8,
    paragraphSpacing: 4,
    lineHeight: 1.35,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginSide: 0.5,
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
                <span className="text-sm text-white/70">{label}</span>
                <span className="text-sm font-mono text-emerald-400 bg-white/5 px-2 py-0.5 rounded">
                    {value}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:bg-white/20 transition-colors"
            />
        </div>
    );
}

export function FormattingPanel() {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const [isExpanded, setIsExpanded] = useState(true);

    const { displayOptions, setDisplayOptions } = useResumeStore();

    const handleReset = () => {
        setDisplayOptions(DEFAULTS);
    };

    const handleCompactFit = () => {
        setDisplayOptions(COMPACT_FIT);
    };

    return (
        <div className={cn(
            "neu-card rounded-2xl overflow-hidden transition-all duration-300",
            isExpanded ? "w-72" : "w-14"
        )}>
            {/* Header Toggle */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-emerald-400" />
                    {isExpanded && (
                        <span className="font-semibold text-white">
                            {isArabic ? 'التنسيق' : 'Formatting'}
                        </span>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Font Formatting Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-white/50">
                            <Type className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wider">
                                {isArabic ? 'تنسيق الخط' : 'Font Formatting'}
                            </span>
                        </div>

                        {/* Font Style Dropdown */}
                        <div className="space-y-2">
                            <label className="text-sm text-white/70">
                                {isArabic ? 'نوع الخط' : 'Font Style'}
                            </label>
                            <select
                                value={displayOptions.fontFamily}
                                onChange={(e) => setDisplayOptions({ fontFamily: e.target.value })}
                                className="w-full px-3 py-2 neu-inset rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                            >
                                {FONT_OPTIONS.map((font) => (
                                    <option key={font.value} value={font.value} className="bg-gray-900">
                                        {font.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <SliderControl
                            label={isArabic ? 'حجم الخط' : 'Font Size'}
                            value={displayOptions.baseFontSize}
                            min={9}
                            max={12}
                            step={0.5}
                            unit="pt"
                            onChange={(v) => setDisplayOptions({ baseFontSize: v })}
                        />

                        <SliderControl
                            label={isArabic ? 'حجم العناوين' : 'Heading Size'}
                            value={displayOptions.headingSize}
                            min={12}
                            max={18}
                            step={0.5}
                            unit="pt"
                            onChange={(v) => setDisplayOptions({ headingSize: v })}
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed border-white/10" />

                    {/* Document Formatting Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-white/50">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wider">
                                {isArabic ? 'تنسيق المستند' : 'Document Formatting'}
                            </span>
                        </div>

                        <SliderControl
                            label={isArabic ? 'تباعد الأقسام' : 'Section Spacing'}
                            value={displayOptions.sectionSpacing}
                            min={4}
                            max={20}
                            step={1}
                            unit="px"
                            onChange={(v) => setDisplayOptions({ sectionSpacing: v })}
                        />

                        <SliderControl
                            label={isArabic ? 'تباعد الفقرات' : 'Paragraph Spacing'}
                            value={displayOptions.paragraphSpacing}
                            min={2}
                            max={12}
                            step={1}
                            unit="px"
                            onChange={(v) => setDisplayOptions({ paragraphSpacing: v })}
                        />

                        <SliderControl
                            label={isArabic ? 'تباعد الأسطر' : 'Line Spacing'}
                            value={displayOptions.lineHeight}
                            min={1.2}
                            max={2.0}
                            step={0.05}
                            unit=""
                            onChange={(v) => setDisplayOptions({ lineHeight: v })}
                        />

                        <SliderControl
                            label={isArabic ? 'الهوامش العلوية/السفلية' : 'Top & Bottom Margin'}
                            value={displayOptions.marginTop}
                            min={0.3}
                            max={1.0}
                            step={0.1}
                            unit="in"
                            onChange={(v) => setDisplayOptions({ marginTop: v, marginBottom: v })}
                        />

                        <SliderControl
                            label={isArabic ? 'الهوامش الجانبية' : 'Side Margins'}
                            value={displayOptions.marginSide}
                            min={0.3}
                            max={1.0}
                            step={0.1}
                            unit="in"
                            onChange={(v) => setDisplayOptions({ marginSide: v })}
                        />

                        {/* Page Break Toggle */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-white/70">
                                {isArabic ? 'إظهار فواصل الصفحات' : 'Show Page Breaks'}
                            </span>
                            <button
                                onClick={() => setDisplayOptions({ showPageBreaks: !displayOptions.showPageBreaks })}
                                className={cn(
                                    "relative w-10 h-5 rounded-full transition-colors",
                                    displayOptions.showPageBreaks
                                        ? "bg-emerald-500"
                                        : "bg-white/20"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                        displayOptions.showPageBreaks && "translate-x-5"
                                    )}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                        {/* Recommended Fit Button - Primary CTA */}
                        <button
                            onClick={handleCompactFit}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 btn-metal rounded-lg text-white text-sm font-medium"
                        >
                            <Sparkles className="w-4 h-4" />
                            {isArabic ? 'ضبط تلقائي مُحسَّن' : 'Recommended Fit'}
                        </button>

                        {/* Reset Button - Secondary */}
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 btn-spring neu-inset hover:bg-white/5 rounded-lg text-white/70 hover:text-white text-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                            {isArabic ? 'إعادة تعيين' : 'Reset to Defaults'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
