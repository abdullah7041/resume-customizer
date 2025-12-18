import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export function MatchSkeleton(): React.JSX.Element {
    return (
        <div className="space-y-6">
            {/* Score circle skeleton */}
            <div className="flex justify-center">
                <Skeleton variant="circular" width={160} height={160} />
            </div>

            {/* Stats row skeleton */}
            <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`match-stat-${i}`} className="text-center space-y-2">
                        <Skeleton className="h-8 w-12 mx-auto" />
                        <Skeleton className="h-4 w-20 mx-auto" />
                    </div>
                ))}
            </div>

            {/* Keywords section skeleton */}
            <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton
                            key={`keyword-${i}`}
                            className="h-7 rounded-full"
                            width={60 + (i % 3) * 15}
                        />
                    ))}
                </div>
            </div>

            {/* Missing keywords skeleton */}
            <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton
                            key={`missing-keyword-${i}`}
                            className="h-7 rounded-full"
                            width={50 + (i % 4) * 10}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
