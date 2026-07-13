import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

/**
 * Displays an indicator when the user goes offline.
 * Mobile users often have spotty connections - this provides clear feedback.
 * 
 * Shows:
 * - Red banner when offline
 * - Brief green "Back online" message when connection restores
 */
export function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            // Hide "back online" message after 3 seconds
            setTimeout(() => setShowReconnected(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Don't render anything if online and not showing reconnected message
    if (isOnline && !showReconnected) return null;

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-medium",
                "transition-colors duration-300 ease-out",
                !isOnline && "bg-red-500 text-white",
                showReconnected && isOnline && "bg-emerald-500 text-white"
            )}
            role="alert"
            aria-live="polite"
        >
            <div className="flex items-center justify-center gap-2">
                {!isOnline ? (
                    <>
                        <WifiOff className="h-4 w-4" />
                        <span>You're offline. Some features may not work.</span>
                    </>
                ) : (
                    <>
                        <Wifi className="h-4 w-4" />
                        <span>Back online!</span>
                    </>
                )}
            </div>
        </div>
    );
}

export default OfflineIndicator;
