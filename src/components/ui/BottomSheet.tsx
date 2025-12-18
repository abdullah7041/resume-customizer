import { useEffect, useRef, useCallback, type ReactNode, type TouchEvent, type MouseEvent } from 'react';
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

/**
 * Mobile-native bottom sheet component
 * - Smooth slide-up animation
 * - Drag-to-dismiss (swipe down)
 * - Backdrop click to close
 * - ESC key to close
 * - Respects prefers-reduced-motion
 */
export function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    height = 'auto'
}: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef<number | null>(null);
    const currentY = useRef<number>(0);

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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

    // Handle drag gestures
    const handleTouchStart = useCallback((e: TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (dragStartY.current === null || !sheetRef.current) return;

        const deltaY = e.touches[0].clientY - dragStartY.current;

        // Only allow dragging down
        if (deltaY > 0) {
            currentY.current = deltaY;
            sheetRef.current.style.transform = `translateY(${deltaY}px)`;
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!sheetRef.current) return;

        // If dragged more than 100px, close the sheet
        if (currentY.current > 100) {
            onClose();
        } else {
            // Snap back
            sheetRef.current.style.transform = 'translateY(0)';
        }

        dragStartY.current = null;
        currentY.current = 0;
    }, [onClose]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) return null;

    const heightClasses = {
        auto: 'max-h-[85vh]',
        half: 'h-[50vh]',
        full: 'h-[90vh]',
    };

    return (
        <div
            className="fixed inset-0 z-50 md:hidden"
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800",
                    "rounded-t-2xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
                    "animate-slide-up transition-transform duration-200",
                    heightClasses[height]
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        <button
                            onClick={onClose}
                            className="inline-flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100% - 80px)' }}>
                    {children}
                </div>
            </div>

            {/* Animation keyframes */}
            <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-slide-up {
            animation: none;
          }
        }
      `}</style>
        </div>
    );
}

export default BottomSheet;
