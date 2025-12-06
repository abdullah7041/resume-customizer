import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { subscribe } from "../../lib/apiStatus";

export default function EnvironmentBadge() {
    const [status, setStatus] = useState({ active: false, operation: null, source: null });
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        return subscribe((newStatus) => {
            setStatus(newStatus);
            if (!newStatus.active && newStatus.source) {
                setShowResult(true);
                const timer = setTimeout(() => setShowResult(false), 3000);
                return () => clearTimeout(timer);
            }
        });
    }, []);

    if (status.active) {
        return (
            <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-full border-2 border-sky-600 bg-sky-100 px-4 py-2 shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 text-sky-900">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">
                    {status.operation || "Processing..."}
                </span>
            </div>
        );
    }

    if (showResult && status.source) {
        const isMock = status.source === "mock";
        return (
            <div
                className={cn(
                    "fixed top-4 right-4 z-50 flex items-center gap-3 rounded-full border-2 px-4 py-2 shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4",
                    isMock
                        ? "border-yellow-600 bg-yellow-100 text-yellow-900"
                        : "border-emerald-600 bg-emerald-100 text-emerald-900"
                )}
            >
                {isMock ? (
                    <AlertTriangle className="h-4 w-4" />
                ) : (
                    <CheckCircle2 className="h-4 w-4" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider">
                    {isMock ? "Mock Data (Fallback)" : "Live Data"}
                </span>
                <button
                    onClick={() => setShowResult(false)}
                    className="ml-1 rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Dismiss"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        );
    }

    return null;
}
