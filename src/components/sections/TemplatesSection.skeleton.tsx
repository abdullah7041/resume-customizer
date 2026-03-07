import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export function TemplatesSkeleton(): React.JSX.Element {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={`template-skeleton-${i}`}
                    className="rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden"
                >
                    {/* Template preview skeleton */}
                    <Skeleton className="h-64 rounded-none" />

                    {/* Template info */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                        <Skeleton.Text lines={2} />
                        <Skeleton className="h-10 w-full rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
