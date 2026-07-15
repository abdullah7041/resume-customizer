import { X, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { GlassButton } from "./GlassButton";
import { cn } from "@/lib/utils/cn";
import { useExitPresence } from "@/hooks/useExitPresence";

export default function ViewTextModal({ isOpen, onClose, text }) {
    const [copied, setCopied] = useState(false);
    const { shouldRender, isExiting } = useExitPresence(isOpen);

    useEffect(() => {
        if (shouldRender) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [shouldRender]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text:", err);
        }
    };

    if (!shouldRender) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
                isExiting && "pointer-events-none"
            )}
            aria-hidden={isExiting || undefined}
            inert={isExiting}
        >
            <div
                className={cn(
                    "absolute inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity duration-200",
                    isExiting ? "animate-out fade-out ease-out" : "animate-in fade-in"
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                className={cn(
                    "relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-50 dark:bg-ink-800 shadow-2xl ring-1 ring-black/5 duration-200 ease-out",
                    isExiting ? "animate-out fade-out zoom-out-95" : "animate-in fade-in zoom-in-95"
                )}
            >
                <div className="flex items-center justify-between border-b border-ink-200/50 dark:border-white/10 bg-white/50 dark:bg-ink-800/50 px-6 py-4 backdrop-blur-md">
                    <h3 className="text-lg font-semibold text-ink-900 dark:text-white">Extracted Resume Text</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-full p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10 hover:text-ink-600 dark:hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-ink-50/50 dark:bg-ink-900/30 p-6">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-ink-600 dark:text-ink-300 leading-relaxed">
                        {text || "No text extracted."}
                    </pre>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-ink-200/50 dark:border-white/10 bg-white/50 dark:bg-ink-800/50 px-6 py-4 backdrop-blur-md">
                    <GlassButton
                        variant="secondary"
                        onClick={onClose}
                    >
                        Close
                    </GlassButton>
                    <GlassButton
                        variant="primary"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="w-4 h-4 me-2" /> : <Copy className="w-4 h-4 me-2" />}
                        {copied ? "Copied!" : "Copy Text"}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}




