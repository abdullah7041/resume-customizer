// src/components/ui/PageBreakIndicator.tsx
// Visual indicator for A4 page boundaries in resume preview

import { Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PageBreakIndicatorProps {
    /** Page number (1-indexed) after which this break appears */
    pageNumber: number;
}

/**
 * A4 page height at 96 DPI = 297mm * 96 / 25.4 ≈ 1123px
 */
export const A4_PAGE_HEIGHT_PX = 1123;

/**
 * Visual indicator showing where page breaks will occur in PDF
 */
export function PageBreakIndicator({ pageNumber }: PageBreakIndicatorProps) {
    const { t } = useTranslation();

    return (
        <div
            className="absolute left-0 right-0 flex items-center gap-2 pointer-events-none z-10"
            style={{ top: `${pageNumber * A4_PAGE_HEIGHT_PX}px` }}
        >
            {/* Left dashed line */}
            <div className="flex-1 border-t-2 border-dashed border-amber-500/60" />

            {/* Center badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 rounded-full">
                <Scissors className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">
                    {t('sections.templates.pageBreak', 'Page Break')}
                </span>
            </div>

            {/* Right dashed line */}
            <div className="flex-1 border-t-2 border-dashed border-amber-500/60" />
        </div>
    );
}

/**
 * Overlay component that renders page break indicators based on content height
 */
interface PageBreakOverlayProps {
    /** Total height of the resume content in pixels */
    contentHeight: number;
}

export function PageBreakOverlay({ contentHeight }: PageBreakOverlayProps) {
    // Calculate how many page breaks we need
    const pageCount = Math.ceil(contentHeight / A4_PAGE_HEIGHT_PX);

    // Render indicators for pages 1 to (pageCount - 1)
    const indicators = [];
    for (let i = 1; i < pageCount; i++) {
        indicators.push(<PageBreakIndicator key={i} pageNumber={i} />);
    }

    return <>{indicators}</>;
}
