import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export function OptimizeSkeleton(): React.JSX.Element {
    return (
        <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32 rounded-full" />
            </div>

            {/* Optimization cards skeleton */}
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={`optimize-skeleton-card-${i}`}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
                >
                    {/* Section title */}
                    <div className="flex items-center gap-2">
                        <Skeleton variant="circular" width={24} height={24} />
                        <Skeleton className="h-5 w-24" />
                    </div>

                    {/* Original text */}
                    <div className="p-3 rounded-lg bg-white/5">
                        <Skeleton className="h-3 w-16 mb-2" />
                        <Skeleton.Text lines={2} />
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <Skeleton variant="circular" width={32} height={32} />
                    </div>

                    {/* Optimized text */}
                    <div className="p-3 rounded-lg bg-emerald-500/10">
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton.Text lines={3} />
                    </div>

                    {/* Apply button */}
                    <div className="flex justify-end">
                        <Skeleton className="h-9 w-24 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
