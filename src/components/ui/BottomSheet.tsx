import { useEffect, useRef, useCallback, useState, type ReactNode, type PointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    /** Height: 'auto' | 'half' | 'full' */
    height?: 'auto' | 'half' | 'full';
}

/** iOS-like drawer curve. Duration mirrors --duration-expand + a touch more. */
const SHEET_MS = 300;
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** Fling threshold: dismiss when the finger is still moving down faster than
 *  this (px/ms) on release, regardless of distance. */
const VELOCITY_DISMISS = 0.11;
/** Distance fallback when the release is slow. */
const DISTANCE_DISMISS = 100;

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const HEIGHT_CLASSES = {
    auto: 'max-h-[85vh]',
    half: 'h-[50vh]',
    full: 'h-[90vh]',
};

/**
 * Mobile-native bottom sheet.
 * - Transition-based slide-up entrance and slide-down exit (interruptible,
 *   no restart-from-zero keyframe pinning the drag transform).
 * - Drag-to-dismiss tracks the finger 1:1 with transition disabled; dismissal
 *   is velocity-based (a fast flick) OR distance-based.
 * - Upward drag rubber-bands with rising friction instead of a dead stop.
 * - Backdrop click / ESC to close. Respects prefers-reduced-motion (fades in
 *   place, no translate).
 */
export function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    height = 'auto',
}: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const reduce = prefersReducedMotion();

    // Keep the sheet mounted through its exit animation.
    const [render, setRender] = useState(isOpen);
    // Drives the entrance/exit transition (false = off-screen/hidden).
    const [entered, setEntered] = useState(false);
    // Live drag state.
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState(0);

    const drag = useRef({ startY: 0, prevY: 0, prevT: 0, lastY: 0, lastT: 0 });
    const activePointerId = useRef<number | null>(null);

    // Mount on open; on close, play the exit then unmount.
    useEffect(() => {
        if (isOpen) {
            setRender(true);
            return;
        }
        if (render) {
            activePointerId.current = null;
            setDragging(false);
            setOffset(0);
            setEntered(false);
            const timer = setTimeout(() => setRender(false), reduce ? 0 : SHEET_MS);
            return () => clearTimeout(timer);
        }
    }, [isOpen, render, reduce]);

    // Trigger the entrance once mounted (next frame, so the off-screen initial
    // state is painted first).
    useEffect(() => {
        if (render && isOpen) {
            const raf = requestAnimationFrame(() => setEntered(true));
            return () => cancelAnimationFrame(raf);
        }
    }, [render, isOpen]);

    // Body scroll lock
    useEffect(() => {
        if (render) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [render]);

    // ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (activePointerId.current !== null) return;

        activePointerId.current = e.pointerId;
        const now = performance.now();
        drag.current = { startY: e.clientY, prevY: e.clientY, prevT: now, lastY: e.clientY, lastT: now };
        setOffset(0);
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragging || activePointerId.current !== e.pointerId) return;
        const deltaY = e.clientY - drag.current.startY;
        // Downward: track 1:1. Upward: rubber-band with rising friction.
        const next = deltaY >= 0 ? deltaY : deltaY * 0.2;
        drag.current.prevY = drag.current.lastY;
        drag.current.prevT = drag.current.lastT;
        drag.current.lastY = e.clientY;
        drag.current.lastT = performance.now();
        setOffset(next);
    }, [dragging]);

    const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragging || activePointerId.current !== e.pointerId) return;
        activePointerId.current = null;
        const releaseT = performance.now();
        const dt = releaseT - drag.current.prevT;
        const velocity = dt > 0 ? (e.clientY - drag.current.prevY) / dt : 0;
        const shouldClose = velocity > VELOCITY_DISMISS || offset > DISTANCE_DISMISS;

        setDragging(false);
        if (shouldClose) {
            // Slide down from the current dragged position, then unmount.
            setEntered(false);
            onClose();
        } else {
            // Snap back up.
            setOffset(0);
        }
    }, [dragging, offset, onClose]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: ReactMouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    if (!render) return null;

    const translateY = dragging
        ? `${offset}px`
        : entered || reduce
            ? '0px'
            : '100%';

    return (
        <div
            className="fixed inset-0 z-50 md:hidden"
            onClick={handleBackdropClick}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            aria-modal="true"
            role="dialog"
            aria-labelledby={title ? 'bottom-sheet-heading' : undefined}
            aria-label={title ? undefined : 'Dialog'}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out"
                style={{ opacity: entered ? 1 : 0 }}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800",
                    "rounded-t-2xl border-t border-gray-200 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
                    HEIGHT_CLASSES[height]
                )}
                style={{
                    transform: `translateY(${translateY})`,
                    opacity: reduce ? (entered ? 1 : 0) : 1,
                    transition: dragging
                        ? 'none'
                        : `transform ${SHEET_MS}ms ${SHEET_EASE}, opacity ${SHEET_MS}ms ease-out`,
                }}
            >
                {/* Drag grabber — handle + header. touch-none here so the drag
                    gesture never fights the content's own touch scrolling. */}
                <div
                    className="touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    {/* Header */}
                    {title && (
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                            <h3 id="bottom-sheet-heading" className="text-lg font-semibold text-white">{title}</h3>
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.96]"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100% - 80px)' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default BottomSheet;
