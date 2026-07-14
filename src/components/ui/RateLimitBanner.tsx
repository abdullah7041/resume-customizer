import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface RateLimitBannerProps {
    retryAfter: number;
    onRetry: () => void;
    onDismiss: () => void;
}

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
};

export function RateLimitBanner({ retryAfter, onRetry, onDismiss }: RateLimitBannerProps) {
    const { t, i18n } = useTranslation();
    const [countdown, setCountdown] = useState(retryAfter);
    const [canRetry, setCanRetry] = useState(false);

    useEffect(() => {
        if (countdown <= 0) {
            setCanRetry(true);
            return;
        }

        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown]);

    return (
        <div
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 
                 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4
                 backdrop-blur-md shadow-lg z-50"
            dir={i18n.dir()}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-full 
                        flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <div className="flex-1">
                    <h4 className="font-medium text-amber-200">
                        {t('rateLimit.title', 'Slow down there!')}
                    </h4>
                    <p className="text-sm text-amber-200/70 mt-1">
                        {t('rateLimit.message', "You've made too many requests. Please wait before trying again.")}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                        {canRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg
                           hover:bg-amber-400 transition-colors"
                            >
                                {t('rateLimit.retry', 'Try Again')}
                            </button>
                        ) : (
                            <div className="px-4 py-2 bg-amber-500/20 rounded-lg">
                                <span className="text-amber-300 font-mono text-lg">
                                    {formatTime(countdown)}
                                </span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onDismiss}
                            className="text-amber-400/60 hover:text-amber-400 text-sm"
                        >
                            {t('rateLimit.dismiss', 'Dismiss')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
