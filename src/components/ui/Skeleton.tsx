import React from 'react';
import { cn } from '../../lib/utils/cn';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
    className,
    variant = 'rectangular',
    width,
    height,
    animation = 'wave',
}: SkeletonProps): React.JSX.Element {
    return (
        <div
            className={cn(
                'bg-white/5 relative overflow-hidden',
                variant === 'circular' && 'rounded-full',
                variant === 'text' && 'rounded h-4',
                variant === 'rectangular' && 'rounded-lg',
                animation === 'pulse' && 'animate-pulse',
                animation === 'wave' && 'skeleton-wave',
                className
            )}
            style={{ width, height }}
        />
    );
}

interface SkeletonTextProps {
    lines?: number;
    className?: string;
}

function SkeletonText({ lines = 3, className }: SkeletonTextProps): React.JSX.Element {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={`skeleton-text-line-${i}`}
                    variant="text"
                    className={cn(
                        'h-4',
                        i === lines - 1 && 'w-3/4' // Last line shorter
                    )}
                />
            ))}
        </div>
    );
}

interface SkeletonAvatarProps {
    size?: number;
}

function SkeletonAvatar({ size = 40 }: SkeletonAvatarProps): React.JSX.Element {
    return <Skeleton variant="circular" width={size} height={size} />;
}

interface SkeletonCardProps {
    className?: string;
}

function SkeletonCard({ className }: SkeletonCardProps): React.JSX.Element {
    return (
        <div className={cn('p-4 rounded-xl bg-white/5 border border-white/10', className)}>
            <Skeleton className="h-32 mb-4" />
            <SkeletonText lines={2} />
        </div>
    );
}

// Attach compound components
Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Card = SkeletonCard;
