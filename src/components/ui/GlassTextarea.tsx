import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils/cn';

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
    ({ label, error, className, ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={props.id}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    <textarea
                        ref={ref}
                        className={cn(
                            'w-full border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-4 py-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-[border-color,background-color,box-shadow]',
                            'min-h-[120px] resize-y',
                            'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50',
                            error && 'border-red-500/50 focus:border-red-500',
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

GlassTextarea.displayName = 'GlassTextarea';
